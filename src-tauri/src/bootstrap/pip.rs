// bootstrap/pip.rs

use super::{errors::BootstrapError, events::*, venv};
use std::path::Path;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Install the bundled Flinch wheel into the managed venv.
///
/// Pry's install_runtime_deps installed torch / transformer-lens / sae-lens in
/// separate stages (each its own CUDA-aware index resolution). Flinch has no ML
/// dependencies — everything it needs is declared in its own wheel's metadata,
/// so this reduces to a single `pip install <wheel>` pulling deps from PyPI.
pub async fn install_runtime_deps(
    emit: &Emitter,
    runtime_dir: &Path,
) -> Result<(), BootstrapError> {
    let pip = venv::venv_pip(runtime_dir);
    if !pip.exists() {
        return Err(BootstrapError::PipInstall(format!(
            "pip not found at {}",
            pip.display()
        )));
    }

    emit.stage(
        BootstrapStage::InstallingDeps,
        "installing flinch package and dependencies...",
    );

    let sidecar_source = locate_sidecar_source()?;
    let src_str = sidecar_source.to_str().ok_or_else(|| {
        BootstrapError::Internal(format!(
            "sidecar source path not utf8: {}",
            sidecar_source.display()
        ))
    })?;

    stream_pip_install(
        emit,
        &pip,
        &["install", src_str],
        BootstrapStage::InstallingDeps,
    )
    .await?;

    // Write initial sidecar hash marker so subsequent bootstraps recognize the
    // install as current and only reinstall the flinch package when source changes.
    if let Ok(hash) = super::bundle_hash() {
        if let Ok(marker) = super::sidecar_hash_marker_path() {
            if let Err(e) = tokio::fs::write(&marker, &hash).await {
                tracing::warn!("failed to write initial sidecar hash marker: {e}");
            }
        }
    }

    emit.progress(
        BootstrapStage::InstallingDeps,
        "flinch package installed",
        1.0,
    );
    Ok(())
}

/// Re-install the local `flinch` package from the bundled source
/// (used when the bundle hash differs from the installed marker). Uses
/// `--force-reinstall --no-deps` so only the flinch package is touched —
/// its transitive dependencies are NOT reinstalled.
#[allow(dead_code)]
pub async fn reinstall_sidecar_package(
    emit: &Emitter,
    runtime_dir: &Path,
) -> Result<(), BootstrapError> {
    emit.stage(BootstrapStage::InstallingDeps, "updating flinch package...");

    let pip = venv::venv_pip(runtime_dir);
    if !pip.exists() {
        return Err(BootstrapError::PipInstall(format!(
            "venv pip not found at {}",
            pip.display()
        )));
    }

    let sidecar_source = locate_sidecar_source()?;
    let src_str = sidecar_source.to_str().ok_or_else(|| {
        BootstrapError::Internal(format!(
            "sidecar source path not utf8: {}",
            sidecar_source.display()
        ))
    })?;

    stream_pip_install(
        emit,
        &pip,
        &["install", "--force-reinstall", "--no-deps", src_str],
        BootstrapStage::InstallingDeps,
    )
    .await?;

    let new_hash = super::bundle_hash()
        .map_err(|e| BootstrapError::Internal(format!("bundle hash: {e}")))?;
    let marker_path = super::sidecar_hash_marker_path()
        .map_err(|e| BootstrapError::Internal(format!("marker path: {e}")))?;
    tokio::fs::write(&marker_path, &new_hash)
        .await
        .map_err(|e| BootstrapError::Io(format!("write sidecar hash marker: {e}")))?;

    emit.progress(
        BootstrapStage::InstallingDeps,
        "flinch package updated",
        1.0,
    );
    Ok(())
}

/// Locate the bundled Flinch source tree (the directory containing
/// `pyproject.toml` + the `flinch/` package) that `pip install <dir>` can consume.
///
/// Resolution order:
/// 1. `FLINCH_SIDECAR_SOURCE` env var (set by tauri-build / wrapper scripts).
/// 2. Walk-up from `CARGO_MANIFEST_DIR`-style parents — useful during
///    `cargo tauri dev` where the source tree lives at `<repo>/` and the
///    executable lives under `<repo>/src-tauri/target/debug/`.
/// 3. Installer-shipped builds: `resources/sidecar/` next to the exe, which
///    Tauri's bundler populates from `tauri.conf.json`'s `bundle.resources`.
pub fn locate_sidecar_source() -> Result<std::path::PathBuf, BootstrapError> {
    // 1. Explicit env var.
    if let Ok(p) = std::env::var("FLINCH_SIDECAR_SOURCE") {
        let path = std::path::PathBuf::from(p);
        if path.join("pyproject.toml").exists() {
            return Ok(path);
        }
    }

    // 2. Walk up from current_exe looking for a directory that holds both
    //    `pyproject.toml` and a `flinch/` package dir.
    if let Ok(exe) = std::env::current_exe() {
        let mut cur: Option<std::path::PathBuf> = exe.parent().map(|p| p.to_path_buf());
        while let Some(d) = cur {
            if d.join("pyproject.toml").exists() && d.join("flinch").is_dir() {
                return Ok(d);
            }
            cur = d.parent().map(|p| p.to_path_buf());
        }
    }

    // 3. Installer-shipped `resources/sidecar/` next to the exe.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let resource = parent.join("resources").join("sidecar");
            if resource.join("pyproject.toml").exists() {
                return Ok(resource);
            }
        }
    }

    Err(BootstrapError::Internal(
        "could not locate flinch source tree for pip install. Set FLINCH_SIDECAR_SOURCE env var."
            .into(),
    ))
}

async fn stream_pip_install(
    emit: &Emitter,
    pip: &Path,
    args: &[&str],
    _stage: BootstrapStage,
) -> Result<(), BootstrapError> {
    use std::collections::VecDeque;
    use std::sync::{Arc, Mutex};

    let mut cmd = Command::new(pip);
    cmd.args(args);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| BootstrapError::PipInstall(e.to_string()))?;

    let stdout = child.stdout.take().ok_or_else(|| {
        BootstrapError::PipInstall("no stdout pipe on child (Stdio::piped not set)".into())
    })?;
    let stderr = child.stderr.take().ok_or_else(|| {
        BootstrapError::PipInstall("no stderr pipe on child (Stdio::piped not set)".into())
    })?;

    // Tail the last ~100 stderr lines so we can scan for AV/permission patterns
    // on failure. Bounded ring buffer so we don't balloon memory on a runaway
    // pip install.
    const STDERR_TAIL: usize = 100;
    let stderr_tail: Arc<Mutex<VecDeque<String>>> = Arc::new(Mutex::new(VecDeque::new()));

    let emit_out = Emitter::new(emit.handle_clone());
    let stdout_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            emit_out.log(line);
        }
    });
    let emit_err = Emitter::new(emit.handle_clone());
    let stderr_tail_clone = stderr_tail.clone();
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            emit_err.log(format!("[stderr] {line}"));
            let mut buf = stderr_tail_clone
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            buf.push_back(line);
            while buf.len() > STDERR_TAIL {
                buf.pop_front();
            }
        }
    });

    let status = child
        .wait()
        .await
        .map_err(|e| BootstrapError::PipInstall(e.to_string()))?;
    let _ = tokio::try_join!(stdout_task, stderr_task);

    if !status.success() {
        // Scan the captured stderr tail for known-AV/permission patterns and
        // surface a typed `Antivirus` error so the UI can show a targeted
        // remediation hint instead of a generic pip failure.
        let tail = {
            let buf = stderr_tail.lock().unwrap_or_else(|e| e.into_inner());
            buf.iter().cloned().collect::<Vec<_>>().join("\n")
        };
        let tail_lower = tail.to_lowercase();
        let av_hit = tail_lower.contains("access is denied")
            || tail_lower.contains("operation did not complete successfully")
            || tail_lower.contains("winerror 5")
            || tail_lower.contains("defender")
            || tail_lower.contains("virus")
            || tail_lower.contains("oserror: [errno 13]")
            || tail_lower.contains("permission denied");
        if av_hit {
            return Err(BootstrapError::Antivirus(format!(
                "pip exit {}; Windows Defender or another AV likely quarantined a wheel. \
                 Add %LOCALAPPDATA%\\Flinch\\runtime\\ as an exclusion and retry. Tail:\n{}",
                status, tail
            )));
        }
        return Err(BootstrapError::PipInstall(format!(
            "pip exit {}\n{}",
            status, tail
        )));
    }
    Ok(())
}
