// lib.rs — Flinch Tauri application entry.
//
// Orchestrates:
//   - Tauri builder + single-instance focus-existing-window handler
//   - Global panic hook -> crash::record_crash
//   - Setup hook: resolve bundled flinch source, launch sidecar in background
//     if runtime is ready; otherwise the frontend drives bootstrap via
//     `bootstrap_runtime_command`.
//   - Command surface for the frontend: sidecar lifecycle, API key CRUD
//     (boolean-only read), bootstrap, crash diagnostics.
//   - Exit handler: shuts the sidecar down cleanly on window close.

pub mod api_keys;
pub mod bootstrap;
pub mod crash;
pub mod error;
pub mod sidecar;

use std::collections::HashMap;
use std::sync::Arc;

use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

use error::AppError;
use sidecar::{RuntimeStatus, SidecarHandle};

type SidecarState = Arc<Mutex<Option<SidecarHandle>>>;

// ── Sidecar commands ──────────────────────────────────────────────────────────

#[tauri::command]
async fn sidecar_url(state: State<'_, SidecarState>) -> Result<String, AppError> {
    let arc: &Arc<Mutex<Option<SidecarHandle>>> = state.inner();
    let guard = arc.lock().await;
    match &*guard {
        Some(h) => Ok(h.base_url.clone()),
        None => Err(AppError::Sidecar("not running".into())),
    }
}

#[tauri::command]
async fn sidecar_stderr(state: State<'_, SidecarState>) -> Result<Vec<String>, AppError> {
    let arc: &Arc<Mutex<Option<SidecarHandle>>> = state.inner();
    let guard = arc.lock().await;
    match &*guard {
        Some(h) => Ok(h.stderr_snapshot()),
        None => Err(AppError::Sidecar("not running".into())),
    }
}

#[tauri::command]
async fn runtime_status(state: State<'_, SidecarState>) -> Result<RuntimeStatus, AppError> {
    let arc: &Arc<Mutex<Option<SidecarHandle>>> = state.inner();
    let guard = arc.lock().await;
    Ok(RuntimeStatus {
        ready: guard.is_some(),
    })
}

// ── Bootstrap command ─────────────────────────────────────────────────────────

/// Frontend-driven bootstrap entry. Called on first-run or retry after a
/// bootstrap error. Emits `bootstrap:progress` / `bootstrap:log` events the
/// splash UI subscribes to, then (on success) launches the sidecar.
#[tauri::command]
async fn bootstrap_runtime_command(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> Result<(), AppError> {
    bootstrap::bootstrap_runtime(app.clone())
        .await
        .map_err(|e| AppError::Bootstrap(format!("{e:#}")))?;

    let db = sidecar::db_path(&app).map_err(|e| AppError::Sidecar(format!("{e:#}")))?;
    match sidecar::launch_with_app(Some(app.clone()), db).await {
        Ok(handle) => {
            tracing::info!("sidecar launched on {}", handle.base_url);
            let arc: &Arc<Mutex<Option<SidecarHandle>>> = state.inner();
            *arc.lock().await = Some(handle);
            use tauri::Emitter;
            let _ = app.emit("sidecar:ready", ());
            Ok(())
        }
        Err(e) => {
            let detail = format!("{e:#}");
            if let Err(log_err) = crash::record_crash("sidecar launch (bootstrap)", &detail) {
                tracing::warn!("failed to write crash log: {log_err}");
            }
            Err(AppError::Sidecar(detail))
        }
    }
}

// ── API key commands (boolean-only read contract) ─────────────────────────────

#[tauri::command]
fn set_api_key(provider: String, key: String) -> Result<(), AppError> {
    api_keys::save_key(&provider, &key).map_err(|e| AppError::ApiKey(format!("{e:#}")))
}

#[tauri::command]
fn get_api_keys() -> HashMap<String, bool> {
    api_keys::list_configured()
}

#[tauri::command]
fn delete_api_key(provider: String) -> Result<(), AppError> {
    api_keys::delete_key(&provider).map_err(|e| AppError::ApiKey(format!("{e:#}")))
}

// ── Application entry ─────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Global panic hook — writes a crash log for any panic anywhere in the
    // process, including early setup-hook failures.
    let default_panic_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let detail = format!("{info}");
        tracing::error!("panic: {detail}");
        if let Err(e) = crash::record_crash("panic", &detail) {
            tracing::warn!("failed to write panic crash log: {e}");
        }
        default_panic_hook(info);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Focus the existing main window when a second launch is attempted.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .setup(|app| {
            // Step A — resolve the bundled flinch source directory (dev + installed
            // layouts) and publish it as FLINCH_SIDECAR_SOURCE for bootstrap::pip.
            if let Ok(resource_dir) = app.path().resource_dir() {
                let candidates = [
                    // Tauri v2 places `../`-prefixed resources directly under `_up_/`
                    // (our primary installer layout: `resource_dir/_up_/pyproject.toml`).
                    resource_dir.join("_up_"),
                    resource_dir.join("_up_").join("sidecar"),
                    resource_dir.join("sidecar"),
                    resource_dir.clone(),
                ];
                for candidate in &candidates {
                    if candidate.join("pyproject.toml").exists()
                        && candidate.join("flinch").is_dir()
                    {
                        tracing::info!(
                            "bundled flinch source resolved to {}",
                            candidate.display()
                        );
                        // SAFETY: setup hook runs on the main thread before any
                        // other thread touches the env block. Win32
                        // SetEnvironmentVariableW is additionally thread-safe.
                        #[allow(unused_unsafe)]
                        unsafe {
                            std::env::set_var("FLINCH_SIDECAR_SOURCE", candidate);
                            std::env::set_var("FLINCH_SIDECAR_DIR", candidate);
                        }
                        break;
                    }
                }
            }

            // Step B — register shared sidecar state.
            let state: SidecarState = Arc::new(Mutex::new(None));
            app.manage(state.clone());

            // Step C — if runtime is ready, launch sidecar in the background.
            // Otherwise the frontend will invoke `bootstrap_runtime_command`
            // (driven by the splash UI) to install the runtime + launch.
            if bootstrap::is_runtime_ready() {
                let state_for_launch = state.clone();
                let app_handle_for_launch = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let db = match sidecar::db_path(&app_handle_for_launch) {
                        Ok(p) => p,
                        Err(e) => {
                            tracing::error!("resolve db_path failed: {e:#}");
                            return;
                        }
                    };
                    match sidecar::launch_with_app(Some(app_handle_for_launch.clone()), db).await {
                        Ok(handle) => {
                            tracing::info!("sidecar launched on {}", handle.base_url);
                            *state_for_launch.lock().await = Some(handle);
                            use tauri::Emitter;
                            let _ = app_handle_for_launch.emit("sidecar:ready", ());
                        }
                        Err(e) => {
                            let detail = format!("{e:#}");
                            tracing::error!("sidecar launch failed: {detail}");
                            if let Err(log_err) =
                                crash::record_crash("sidecar launch (background)", &detail)
                            {
                                tracing::warn!("failed to write crash log: {log_err}");
                            }
                            use tauri::Emitter;
                            let _ = app_handle_for_launch.emit(
                                "bootstrap:error",
                                serde_json::json!({ "detail": detail }),
                            );
                        }
                    }
                });
            } else {
                tracing::info!(
                    "runtime not ready — skipping sidecar launch; frontend \
                    will invoke bootstrap_runtime_command to install + launch"
                );
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sidecar_url,
            sidecar_stderr,
            runtime_status,
            bootstrap_runtime_command,
            set_api_key,
            get_api_keys,
            delete_api_key,
            crash::copy_diagnostic,
            crash::list_crash_logs,
        ])
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                // Spawn (not block_on) — Drop may run on the Tokio runtime
                // thread and `block_on` panics in that case.
                let app = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    let state = app.state::<SidecarState>();
                    let arc: &Arc<Mutex<Option<SidecarHandle>>> = state.inner();
                    let mut guard = arc.lock().await;
                    let taken: Option<SidecarHandle> = guard.take();
                    if let Some(mut h) = taken {
                        if let Err(e) = h.shutdown().await {
                            tracing::warn!("sidecar shutdown error: {e}");
                        }
                    }
                });
            }
        });
}
