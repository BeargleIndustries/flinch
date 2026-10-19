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
/// whenever `pyproject.toml` or any packaged file under `flinch/` changes, so
/// the bootstrap can tell when the packaged wheel has drifted from the
/// installed copy in the managed venv.
pub fn bundle_hash() -> anyhow::Result<String> {
    let bundle_dir = pip::locate_sidecar_source()
        .map_err(|e| anyhow::anyhow!("could not locate flinch bundle: {e}"))?;
    hash_bundle_dir(&bundle_dir)
}

/// Extensions of the packaged files under `flinch/` (P03): code, the
/// playbook, themes, probes, strategies, variants and seeds.
const HASHED_EXTENSIONS: &[&str] = &["py", "md", "yaml", "yml", "json"];

/// Hash `pyproject.toml` plus every file under `flinch/` (recursively) with a
/// hashed extension. Files are sorted by their relative path (forward
/// slashes), and that path is hashed with the contents, so the result does
/// not depend on the order the filesystem lists directories in.
fn hash_bundle_dir(bundle_dir: &std::path::Path) -> anyhow::Result<String> {
    let mut files: Vec<(String, PathBuf)> =
        vec![("pyproject.toml".to_string(), bundle_dir.join("pyproject.toml"))];

    let pkg_dir = bundle_dir.join("flinch");
    let mut pending = vec![pkg_dir.clone()];
    while let Some(dir) = pending.pop() {
        if !dir.is_dir() {
            continue;
        }
        for entry in std::fs::read_dir(&dir)? {
            let path = entry?.path();
            if path.is_dir() {
                pending.push(path);
                continue;
            }
            let hashed = path
                .extension()
                .and_then(|s| s.to_str())
                .is_some_and(|ext| HASHED_EXTENSIONS.contains(&ext));
            if !hashed {
                continue;
            }
            let rel = path.strip_prefix(bundle_dir)?;
            let rel = rel
                .components()
                .map(|c| c.as_os_str().to_string_lossy())
                .collect::<Vec<_>>()
                .join("/");
            files.push((rel, path));
        }
    }

    files.sort_by(|a, b| a.0.cmp(&b.0));

    let mut hasher = Sha256::new();
    for (rel, path) in &files {
        let bytes = std::fs::read(path)?;
        hasher.update(rel.as_bytes());
        hasher.update(b":");
        hasher.update(&bytes);
        hasher.update(b"\n");
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

/// The runtime is installed and its flinch package matches the bundled one
/// (P01). After an app upgrade this is false until `bootstrap_runtime`
/// reinstalls the package, so the shell never launches a stale sidecar.
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

#[cfg(test)]
mod tests {
    use super::hash_bundle_dir;
    use std::path::{Path, PathBuf};

    /// A fresh, empty directory under the system temp dir.
    fn scratch_dir(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!(
            "flinch-bundle-hash-{}-{}-{}",
            name,
            std::process::id(),
            nanos
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write(root: &Path, rel: &str, contents: &str) {
        let path = root.join(rel);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, contents).unwrap();
    }

    const FILES: &[(&str, &str)] = &[
        ("pyproject.toml", "[project]\nname = \"flinch\"\n"),
        ("flinch/__init__.py", ""),
        ("flinch/app.py", "print('app')\n"),
        ("flinch/playbook.md", "# Playbook\n"),
        ("flinch/themes/__init__.py", ""),
        ("flinch/themes/presets.md", "## Preset one\n"),
        ("flinch/seeds/policies.py", "POLICIES = []\n"),
        ("flinch/variants/lexical-complexity.md", "# Variants\n"),
        ("flinch/probes/example-probes.md", "# Probes\n"),
    ];

    #[test]
    fn bundle_hash_changes_when_a_theme_file_changes() {
        let root = scratch_dir("theme");
        for (rel, contents) in FILES {
            write(&root, rel, contents);
        }
        let before = hash_bundle_dir(&root).unwrap();
        assert_eq!(before, hash_bundle_dir(&root).unwrap(), "hash is stable");

        write(&root, "flinch/themes/presets.md", "## Preset one, edited\n");
        let after = hash_bundle_dir(&root).unwrap();
        assert_ne!(before, after, "a change under flinch/themes/ changes the hash");

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn bundle_hash_ignores_traversal_order() {
        let forward = scratch_dir("forward");
        for (rel, contents) in FILES {
            write(&forward, rel, contents);
        }
        let reverse = scratch_dir("reverse");
        for (rel, contents) in FILES.iter().rev() {
            write(&reverse, rel, contents);
        }
        assert_eq!(
            hash_bundle_dir(&forward).unwrap(),
            hash_bundle_dir(&reverse).unwrap(),
            "creation and listing order do not change the hash"
        );

        std::fs::remove_dir_all(&forward).ok();
        std::fs::remove_dir_all(&reverse).ok();
    }

    #[test]
    fn bundle_hash_skips_bytecode_caches() {
        let root = scratch_dir("pycache");
        for (rel, contents) in FILES {
            write(&root, rel, contents);
        }
        let before = hash_bundle_dir(&root).unwrap();
        write(&root, "flinch/__pycache__/app.cpython-311.pyc", "bytecode");
        assert_eq!(before, hash_bundle_dir(&root).unwrap());

        std::fs::remove_dir_all(&root).ok();
    }
}
