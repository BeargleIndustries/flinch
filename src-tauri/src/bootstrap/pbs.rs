// bootstrap/pbs.rs

use super::{errors::BootstrapError, events::*};
use std::path::Path;
use tauri::{AppHandle, Manager};

// Pinned python-build-standalone release.
// https://github.com/astral-sh/python-build-standalone/releases
// The bundle-resources script (US-004) downloads this tarball to
// src-tauri/resources/ and Tauri ships it inside the installer.
#[allow(dead_code)]
const PBS_VERSION: &str = "3.11.9";
#[allow(dead_code)]
const PBS_RELEASE_TAG: &str = "20240415";
const PBS_ARCHIVE: &str = "cpython-3.11.9+20240415-x86_64-pc-windows-msvc-install_only.tar.gz";

// SHA256 of the pinned python-build-standalone tarball.
// PLACEHOLDER — US-004's bundle-resources script writes the verified digest here.
const EXPECTED_PBS_SHA256: &str = "368474c69f476e7de4adaf50b61d9fcf6ec8b4db88cc43c5f71c860b3cd29c69";

/// Locate the bundled PBS tarball on disk.
///
/// Resolution order:
/// 1. Tauri resource directory (`app.path().resource_dir()`) — the installer ships the
///    tarball under `resources/cpython-3.11.9+20240415-*.tar.gz`.
/// 2. Dev fallbacks — `src-tauri/resources/` relative to the current exe (walk up a
///    few parents) so `cargo tauri dev` works without a full installer build.
fn locate_pbs_archive(app: &AppHandle) -> Result<std::path::PathBuf, BootstrapError> {
    // 1. Installer-shipped resource dir.
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join("resources").join(PBS_ARCHIVE);
        if candidate.exists() {
            return Ok(candidate);
        }
        let candidate_flat = resource_dir.join(PBS_ARCHIVE);
        if candidate_flat.exists() {
            return Ok(candidate_flat);
        }
    }

    // 2. Dev-mode walk-up from current exe.
    if let Ok(exe) = std::env::current_exe() {
        let mut cur: Option<std::path::PathBuf> = exe.parent().map(|p| p.to_path_buf());
        while let Some(d) = cur {
            let candidate = d.join("resources").join(PBS_ARCHIVE);
            if candidate.exists() {
                return Ok(candidate);
            }
            let candidate_tauri = d.join("src-tauri").join("resources").join(PBS_ARCHIVE);
            if candidate_tauri.exists() {
                return Ok(candidate_tauri);
            }
            cur = d.parent().map(|p| p.to_path_buf());
        }
    }

    Err(BootstrapError::Internal(format!(
        "could not locate bundled PBS tarball '{}' in resource_dir or ancestors of current_exe",
        PBS_ARCHIVE
    )))
}

/// Extract the bundled python-build-standalone tarball into `runtime_dir`.
///
/// Unlike Pry's pbs.rs, there is no network download. The installer ships the
/// tarball as a Tauri resource; we locate it on disk, SHA256-verify it, and
/// extract with tar+gz. The `install_only` tarball unpacks to
/// `runtime_dir/python/install/python.exe`; we flatten the top-level `python/`
/// directory so `runtime_dir/python.exe` is the canonical path (matches venv.rs).
pub async fn extract_bundled(
    app: &AppHandle,
    emit: &Emitter,
    runtime_dir: &Path,
) -> Result<(), BootstrapError> {
    emit.stage(
        BootstrapStage::ExtractingPbs,
        format!("locating bundled Python runtime ({})...", PBS_ARCHIVE),
    );

    let archive_path = locate_pbs_archive(app)?;

    // SHA256 verify on a blocking thread.
    let archive_path_clone = archive_path.clone();
    let actual = tokio::task::spawn_blocking(move || -> Result<String, String> {
        use sha2::Digest;
        let mut hasher = sha2::Sha256::new();
        let mut file = std::fs::File::open(&archive_path_clone).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut hasher).map_err(|e| e.to_string())?;
        Ok(format!("{:x}", hasher.finalize()))
    })
    .await
    .map_err(|e| BootstrapError::Io(e.to_string()))?
    .map_err(BootstrapError::Io)?;

    // Only enforce when the baked-in hash has been filled in by US-004's script.
    // The placeholder string is checked verbatim — any other value is treated as
    // a real expected digest and a mismatch is fatal.
    if EXPECTED_PBS_SHA256 != "PLACEHOLDER_SHA256_FILLED_BY_BUNDLE_RESOURCES_SCRIPT"
        && actual != EXPECTED_PBS_SHA256
    {
        return Err(BootstrapError::ChecksumMismatch {
            expected: EXPECTED_PBS_SHA256.to_string(),
            actual,
        });
    }

    emit.stage(BootstrapStage::ExtractingPbs, "extracting Python runtime...");

    let archive_path_clone = archive_path.clone();
    let runtime_dir_clone = runtime_dir.to_path_buf();
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let file = std::fs::File::open(&archive_path_clone).map_err(|e| e.to_string())?;
        let gz = flate2::read::GzDecoder::new(file);
        let mut archive = tar::Archive::new(gz);
        archive
            .unpack(&runtime_dir_clone)
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| BootstrapError::Extract(e.to_string()))?
    .map_err(BootstrapError::Extract)?;

    // python-build-standalone's `install_only` tarball layout is
    // `python/install/...` — flatten into runtime_dir so `runtime_dir/python.exe`
    // is the canonical path.
    let py_subdir = runtime_dir.join("python");
    let install_subdir = py_subdir.join("install");
    let source_root = if install_subdir.exists() {
        install_subdir
    } else if py_subdir.exists() {
        py_subdir.clone()
    } else {
        // Already flat somehow — nothing to do.
        emit.progress(BootstrapStage::ExtractingPbs, "python runtime ready", 1.0);
        return Ok(());
    };

    let mut entries = tokio::fs::read_dir(&source_root)
        .await
        .map_err(|e| BootstrapError::Io(e.to_string()))?;
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| BootstrapError::Io(e.to_string()))?
    {
        let src = entry.path();
        let dst = runtime_dir.join(entry.file_name());
        tokio::fs::rename(&src, &dst)
            .await
            .map_err(|e| BootstrapError::Io(format!("move {}: {}", src.display(), e)))?;
    }
    // Best-effort cleanup of the now-empty python/ scaffold.
    let _ = tokio::fs::remove_dir_all(&py_subdir).await;

    emit.progress(BootstrapStage::ExtractingPbs, "python runtime ready", 1.0);
    Ok(())
}
