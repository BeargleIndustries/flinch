// bootstrap/mod.rs

//! First-run bootstrapper: extracts bundled python-build-standalone, creates a
//! managed venv, pip-installs the bundled Flinch wheel. Streams progress to the
//! Tauri webview via `bootstrap:progress` and `bootstrap:log` events.

use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tauri::AppHandle;

mod errors;
mod events;
mod pbs;
pub mod pip;
mod venv;

pub use errors::BootstrapError;
#[allow(unused_imports)]
pub use events::{BootstrapEvent, BootstrapStage};

pub fn runtime_dir() -> anyhow::Result<PathBuf> {
    // Use data_local_dir (%LOCALAPPDATA%) rather than config_dir
    // (%APPDATA%/Roaming) so runtime wheels don't get OneDrive/enterprise-synced
    // for users with roaming profiles.
    let base = dirs::data_local_dir()
        .ok_or_else(|| anyhow::anyhow!("could not resolve local data dir"))?;
    Ok(base.join("Flinch").join("runtime"))
}

#[allow(dead_code)]
pub fn runtime_python() -> anyhow::Result<PathBuf> {
    Ok(venv::venv_python(&runtime_dir()?))
}

pub fn ready_marker_path() -> anyhow::Result<PathBuf> {
    Ok(runtime_dir()?.join("ready.marker"))
}

pub fn is_runtime_ready() -> bool {
    ready_marker_path()
        .ok()
        .map(|p| p.exists())
        .unwrap_or(false)
        && runtime_python().ok().map(|p| p.exists()).unwrap_or(false)
}

/// Compute a SHA256 over the bundled Flinch source files. The result changes
/// whenever any top-level `flinch/*.py` or `pyproject.toml` changes, so the
/// bootstrap can tell when the packaged wheel has drifted from the installed
/// copy in the managed venv.
pub fn bundle_hash() -> anyhow::Result<String> {
    let bundle_dir = pip::locate_sidecar_source()
        .map_err(|e| anyhow::anyhow!("could not locate flinch bundle: {e}"))?;

    let mut files: Vec<std::path::PathBuf> = vec![bundle_dir.join("pyproject.toml")];

    // Top-level *.py only — matches Pry's pattern for pry_sidecar/*.py.
    let pkg_dir = bundle_dir.join("flinch");
    if pkg_dir.exists() {
        for entry in std::fs::read_dir(&pkg_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("py") {
                files.push(path);
            }
        }
    }

    // Sort for determinism across filesystems.
    files.sort();

    let mut hasher = Sha256::new();
    for file in &files {
        if let Ok(bytes) = std::fs::read(file) {
            if let Some(name) = file.file_name().and_then(|s| s.to_str()) {
                hasher.update(name.as_bytes());
                hasher.update(b":");
            }
            hasher.update(&bytes);
            hasher.update(b"\n");
        }
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn sidecar_hash_marker_path() -> anyhow::Result<PathBuf> {
    Ok(runtime_dir()?.join("sidecar.hash"))
}

/// Read the hash of the currently-installed flinch package from the marker file.
#[allow(dead_code)]
pub fn installed_sidecar_hash() -> Option<String> {
    sidecar_hash_marker_path()
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

#[allow(dead_code)]
pub fn sidecar_needs_reinstall() -> bool {
    match (bundle_hash().ok(), installed_sidecar_hash()) {
        (Some(bundled), Some(installed)) => bundled != installed,
        (Some(_), None) => true, // no marker -> needs install
        (None, _) => false,      // no bundle -> can't reinstall (dev mode)
    }
}

#[allow(dead_code)]
pub fn is_runtime_current() -> bool {
    is_runtime_ready() && !sidecar_needs_reinstall()
}

pub async fn bootstrap_runtime(app: AppHandle) -> Result<(), BootstrapError> {
    let emit = events::Emitter::new(app.clone());

    emit.stage(
        BootstrapStage::Probing,
        "checking runtime state...",
    );

    if is_runtime_ready() {
        // Runtime is installed — check whether the bundled flinch package has
        // drifted from the copy in the managed venv (triggered by app updates).
        let runtime_dir =
            runtime_dir().map_err(|e| BootstrapError::Internal(e.to_string()))?;
        if sidecar_needs_reinstall() {
            emit.stage(
                BootstrapStage::InstallingDeps,
                "updating flinch package to bundled version...",
            );
            pip::reinstall_sidecar_package(&emit, &runtime_dir).await?;
            if let Ok(hash) = bundle_hash() {
                if let Ok(marker) = sidecar_hash_marker_path() {
                    if let Err(e) = tokio::fs::write(&marker, &hash).await {
                        tracing::warn!("failed to refresh sidecar hash marker: {e}");
                    }
                }
            }
        }
        emit.stage(BootstrapStage::Ready, "runtime ready");
        return Ok(());
    }

    // Clean up any half-installed runtime dir.
    let runtime_dir =
        runtime_dir().map_err(|e| BootstrapError::Internal(e.to_string()))?;
    if runtime_dir.exists() {
        emit.stage(
            BootstrapStage::Cleaning,
            "removing previous incomplete install...",
        );
        tokio::fs::remove_dir_all(&runtime_dir)
            .await
            .map_err(|e| BootstrapError::Io(format!("cleanup: {e}")))?;
    }
    tokio::fs::create_dir_all(&runtime_dir)
        .await
        .map_err(|e| BootstrapError::Io(format!("mkdir: {e}")))?;

    // Extract bundled python-build-standalone tarball.
    pbs::extract_bundled(&app, &emit, &runtime_dir).await?;

    // Create venv.
    venv::create(&emit, &runtime_dir).await?;

    // pip install flinch wheel from bundled source.
    pip::install_runtime_deps(&emit, &runtime_dir).await?;

    // Mark ready.
    let marker =
        ready_marker_path().map_err(|e| BootstrapError::Internal(e.to_string()))?;
    tokio::fs::write(&marker, chrono::Utc::now().to_rfc3339())
        .await
        .map_err(|e| BootstrapError::Io(format!("marker: {e}")))?;

    emit.stage(BootstrapStage::Ready, "runtime installed and ready");
    Ok(())
}
