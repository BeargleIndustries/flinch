// lib.rs — Flinch Tauri application entry.
//
// Orchestrates:
//   - Tauri builder + single-instance focus-existing-window handler
//   - Global panic hook -> crash::record_crash
//   - Setup hook: resolve bundled flinch source, launch sidecar in background
//     if the runtime is current (P01); otherwise the frontend drives bootstrap
//     via `bootstrap_runtime_command`, which installs or updates it.
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

/// `{ready, installed, current}` (P01): `ready` means a sidecar handle exists.
#[tauri::command]
async fn runtime_status(state: State<'_, SidecarState>) -> Result<RuntimeStatus, AppError> {
    let arc: &Arc<Mutex<Option<SidecarHandle>>> = state.inner();
    let ready = arc.lock().await.is_some();
    Ok(RuntimeStatus::probe(ready))
}

/// Stop the sidecar in state, if any (a crashed one included), through the
/// taskkill path in `SidecarHandle::shutdown`.
async fn stop_sidecar(state: &SidecarState) {
    let taken = state.lock().await.take();
    if let Some(mut old) = taken {
        tracing::info!("stopping current sidecar on {}", old.base_url);
        if let Err(e) = old.shutdown().await {
            tracing::warn!("shutdown of previous sidecar failed: {e}");
        }
    }
}

/// Launch a sidecar into state and return its base URL. The state lock is
/// held across shutdown + launch, so concurrent launches are serialized, and
/// any handle already in state is shut down first: never two sidecars (P01).
async fn relaunch_sidecar(app: &AppHandle, state: &SidecarState) -> Result<String, String> {
    let mut guard = state.lock().await;
    if let Some(mut old) = guard.take() {
        tracing::info!("relaunch: stopping current sidecar on {}", old.base_url);
        if let Err(e) = old.shutdown().await {
            tracing::warn!("relaunch: shutdown of previous sidecar failed: {e}");
        }
    }
    let db = sidecar::db_path(app).map_err(|e| format!("{e:#}"))?;
    let handle = sidecar::launch_with_app(Some(app.clone()), db)
        .await
        .map_err(|e| format!("{e:#}"))?;
    let base_url = handle.base_url.clone();
    tracing::info!("sidecar launched on {base_url}");
    *guard = Some(handle);
    Ok(base_url)
}

/// P04: stop the current sidecar (a crashed one included), launch a new one,
/// emit `sidecar:restarted {base_url}` and return the base URL.
#[tauri::command]
async fn restart_sidecar(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> Result<String, AppError> {
    let state_arc: SidecarState = state.inner().clone();
    match relaunch_sidecar(&app, &state_arc).await {
        Ok(base_url) => {
            use tauri::Emitter;
            if let Err(e) = app.emit(
                "sidecar:restarted",
                serde_json::json!({ "base_url": base_url }),
            ) {
                tracing::warn!("failed to emit sidecar:restarted: {e}");
            }
            Ok(base_url)
        }
        Err(detail) => {
            tracing::error!("restart: sidecar launch failed: {detail}");
            if let Err(log_err) = crash::record_crash("sidecar restart", &detail) {
                tracing::warn!("failed to write crash log: {log_err}");
            }
            Err(AppError::Sidecar(detail))
        }
    }
}

/// P04: open the webview devtools. Gated by this crate's `devtools` feature
/// (default-on, so release builds have it too). Built with
/// `--no-default-features` the command still exists but returns an error.
#[tauri::command]
async fn open_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(feature = "devtools")]
    {
        window.open_devtools();
        Ok(())
    }
    #[cfg(not(feature = "devtools"))]
    {
        let _ = window;
        Err("DevTools not available in this build".to_string())
    }
}

// ── Bootstrap command ─────────────────────────────────────────────────────────

/// Frontend-driven bootstrap entry. Called on first run, after an upgrade
/// (runtime installed but not current), or on retry after a bootstrap error.
/// Stops any running sidecar first so the venv is not in use while pip
/// reinstalls, emits the `bootstrap:progress` / `bootstrap:log` events the
/// welcome Python step subscribes to, then (on success) launches the sidecar.
#[tauri::command]
async fn bootstrap_runtime_command(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> Result<(), AppError> {
    let state_arc: SidecarState = state.inner().clone();
    stop_sidecar(&state_arc).await;

    bootstrap::bootstrap_runtime(app.clone())
        .await
        .map_err(|e| AppError::Bootstrap(format!("{e:#}")))?;

    match relaunch_sidecar(&app, &state_arc).await {
        Ok(_) => {
            use tauri::Emitter;
            let _ = app.emit("sidecar:ready", ());
            Ok(())
        }
        Err(detail) => {
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
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

            // Step C - if the runtime is current (installed, and its flinch
            // package matches the bundled one), launch the sidecar in the
            // background. Otherwise (first run, or an upgrade left a stale
            // package) launch nothing: the welcome Python step invokes
            // `bootstrap_runtime_command` to install or update, then launch (P01).
            if bootstrap::is_runtime_current() {
                let state_for_launch = state.clone();
                let app_handle_for_launch = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    match relaunch_sidecar(&app_handle_for_launch, &state_for_launch).await {
                        Ok(_) => {
                            use tauri::Emitter;
                            let _ = app_handle_for_launch.emit("sidecar:ready", ());
                        }
                        Err(detail) => {
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
                    "runtime not current (installed: {}); skipping sidecar launch, \
                    frontend will invoke bootstrap_runtime_command to install + launch",
                    bootstrap::is_runtime_ready()
                );
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sidecar_url,
            sidecar_stderr,
            runtime_status,
            restart_sidecar,
            open_devtools,
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
