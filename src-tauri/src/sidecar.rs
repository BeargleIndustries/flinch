// sidecar.rs — Flinch sidecar lifecycle manager.
//
// Adapted from Pry's sidecar.rs. Key differences from the reference:
//   - Spawn command: `python -m flinch.app --port {port} --db-path {db_path}`
//     (Pry runs `python -m pry_sidecar.main`). The Python side's FlinchServer
//     prints `READY {port}` after binding the socket — we scan for that exact
//     sentinel on stdout.
//   - API keys are handed to the child over the stdin pipe as a single line of
//     JSON (`{"keys": {provider: value, ...}}\n`). We then drop the write half
//     so Python's `sys.stdin.readline()` returns. `cmd.env()` is intentionally
//     NOT used for API keys — the point of this story is to keep keys out of
//     the process environment block where other processes can sniff them.
//   - Env vars renamed: FLINCH_PORT / FLINCH_PYTHON_OVERRIDE / FLINCH_SIDECAR_DIR.
//   - Managed runtime path: `%LOCALAPPDATA%/Flinch/runtime/venv/Scripts/python.exe`.
//
//! Concurrency note:
//!   SidecarState = Arc<tokio::sync::Mutex<Option<SidecarHandle>>>
//!     — uses tokio::sync::Mutex because Tauri commands hold the guard
//!     across .await points (e.g. while the sidecar spawns or heartbeats)
//!     and std::sync::Mutex would deadlock the tokio runtime.
//!   stderr ring buffer uses std::sync::Mutex
//!     — held only briefly in the producer/consumer sync paths, never
//!     across awaits. Cheaper than tokio::sync::Mutex.

use anyhow::{anyhow, Context};
use serde::Serialize;
use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::oneshot;
use tokio::time::{timeout, Duration};

#[cfg(target_os = "windows")]
use windows::Win32::{
    Foundation::HANDLE,
    System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    },
};

pub struct SidecarHandle {
    pub port: u16,
    pub base_url: String,
    child: Option<Child>,
    #[cfg(target_os = "windows")]
    job: Option<HANDLE>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    pub stderr_buffer: Arc<Mutex<VecDeque<String>>>,
}

// SAFETY: HANDLE is `*mut c_void` and thus !Send/!Sync by default. We assert
// Send+Sync because the handle is written once in `launch()` before crossing
// thread boundaries, read once in Drop, and otherwise serialized by the
// Tokio Mutex that wraps this struct in lib.rs.
#[cfg(target_os = "windows")]
unsafe impl Send for SidecarHandle {}
#[cfg(target_os = "windows")]
unsafe impl Sync for SidecarHandle {}

#[derive(Serialize, Clone, Debug)]
pub struct RuntimeStatus {
    pub ready: bool,
}

impl SidecarHandle {
    pub async fn shutdown(&mut self) -> anyhow::Result<()> {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }

        if let Some(child) = self.child.as_mut() {
            if let Some(pid) = child.id() {
                #[cfg(target_os = "windows")]
                {
                    tracing::info!("sidecar: sending taskkill /T to pid {pid}");
                    let pid_str = pid.to_string();
                    let kill_result = tokio::task::spawn_blocking(move || {
                        std::process::Command::new("taskkill")
                            .args(["/PID", &pid_str, "/T", "/F"])
                            .output()
                    })
                    .await;
                    match kill_result {
                        Ok(Ok(out)) if out.status.success() => {
                            tracing::debug!("taskkill succeeded for pid {pid}");
                        }
                        Ok(Ok(out)) => {
                            let stderr = String::from_utf8_lossy(&out.stderr);
                            tracing::warn!(
                                "taskkill failed for pid {pid}: status {} stderr: {}",
                                out.status,
                                stderr
                            );
                        }
                        Ok(Err(e)) => {
                            tracing::warn!("taskkill spawn failed for pid {pid}: {e}");
                        }
                        Err(e) => {
                            tracing::warn!("taskkill join error for pid {pid}: {e}");
                        }
                    }
                }

                #[cfg(not(target_os = "windows"))]
                {
                    tracing::info!("sidecar: sending SIGTERM to pid {pid}");
                    unsafe {
                        libc::kill(pid as i32, libc::SIGTERM);
                    }
                }
            }

            match timeout(Duration::from_secs(5), child.wait()).await {
                Ok(Ok(status)) => tracing::info!("sidecar exited with {status}"),
                Ok(Err(e)) => tracing::warn!("sidecar wait error: {e}"),
                Err(_) => {
                    tracing::warn!("sidecar did not exit within 5s, force-killing");
                    let _ = child.kill().await;
                }
            }
        }

        self.child = None;
        Ok(())
    }

    pub fn stderr_snapshot(&self) -> Vec<String> {
        let buf = self
            .stderr_buffer
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        buf.iter().cloned().collect()
    }
}

impl Drop for SidecarHandle {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        if let Some(child) = self.child.as_mut() {
            let _ = child.start_kill();
        }
        #[cfg(target_os = "windows")]
        if let Some(handle) = self.job.take() {
            unsafe {
                let _ = windows::Win32::Foundation::CloseHandle(handle);
            }
        }
    }
}

/// Indicates where the Python executable came from.
#[derive(Debug)]
pub enum PythonSource {
    /// `%LOCALAPPDATA%/Flinch/runtime/venv/Scripts/python.exe` — managed runtime.
    ManagedRuntime,
    /// `FLINCH_PYTHON_OVERRIDE` env var — advanced user escape hatch.
    EnvOverride,
    /// `which python` / `python3` — dev-mode fallback.
    SystemPath,
}

/// Find the Python executable using managed-runtime-first resolution.
///
/// Priority:
///   1. Managed venv  (bootstrap::is_runtime_ready() + venv path exists)
///   2. FLINCH_PYTHON_OVERRIDE env var
///   3. System PATH  (dev mode — cargo tauri dev without managed runtime)
fn find_python() -> anyhow::Result<(PathBuf, PythonSource)> {
    if crate::bootstrap::is_runtime_ready() {
        if let Ok(runtime_dir) = crate::bootstrap::runtime_dir() {
            let venv_python = runtime_dir.join("venv").join("Scripts").join("python.exe");
            if venv_python.exists() {
                return Ok((venv_python, PythonSource::ManagedRuntime));
            }
        }
    }

    if let Ok(p) = std::env::var("FLINCH_PYTHON_OVERRIDE") {
        let path = PathBuf::from(p);
        if path.exists() {
            return Ok((path, PythonSource::EnvOverride));
        }
    }

    if let Ok(p) = which::which("python") {
        return Ok((p, PythonSource::SystemPath));
    }
    if let Ok(p) = which::which("python3") {
        return Ok((p, PythonSource::SystemPath));
    }

    anyhow::bail!(
        "no Python found: managed runtime not ready, FLINCH_PYTHON_OVERRIDE not set, \
        and no python/python3 on PATH"
    )
}

/// Locate the flinch source tree (directory containing `pyproject.toml` + the
/// `flinch/` package). Dev-mode only — the managed runtime has flinch
/// pip-installed into the venv so cwd is not used to find the module.
pub fn find_sidecar_dir() -> anyhow::Result<PathBuf> {
    if let Ok(dir) = std::env::var("FLINCH_SIDECAR_DIR") {
        let p = PathBuf::from(&dir);
        if p.join("pyproject.toml").exists() && p.join("flinch").is_dir() {
            tracing::info!("sidecar: using FLINCH_SIDECAR_DIR={dir}");
            return Ok(p);
        }
        tracing::warn!("FLINCH_SIDECAR_DIR={dir} set but flinch package not found there");
    }

    if let Some(config) = dirs::data_local_dir() {
        let runtime_sidecar = config.join("Flinch").join("runtime");
        if runtime_sidecar.exists() {
            return Ok(runtime_sidecar);
        }
    }

    const WALK_UP_LIMIT: usize = 8;
    let exe = std::env::current_exe().context("could not get current exe path")?;
    let mut dir = exe.parent().map(|p| p.to_path_buf()).unwrap_or_default();

    for _ in 0..WALK_UP_LIMIT {
        if dir.join("pyproject.toml").exists() && dir.join("flinch").is_dir() {
            tracing::info!("sidecar: found flinch source tree at {}", dir.display());
            return Ok(dir);
        }
        match dir.parent() {
            Some(p) => dir = p.to_path_buf(),
            None => break,
        }
    }

    Err(anyhow!(
        "Could not locate flinch source tree. Set FLINCH_SIDECAR_DIR, or reinstall Flinch."
    ))
}

/// Resolve the path Flinch should pass to `--db-path`. Creates the parent dir
/// (`%APPDATA%/Flinch/`) if needed.
pub fn db_path(app_handle: &tauri::AppHandle) -> anyhow::Result<PathBuf> {
    use tauri::Manager;
    let app_data = app_handle
        .path()
        .app_data_dir()
        .context("resolving app_data_dir")?;
    std::fs::create_dir_all(&app_data)
        .with_context(|| format!("mkdir {}", app_data.display()))?;
    Ok(app_data.join("flinch.db"))
}

#[cfg(target_os = "windows")]
fn create_job_object() -> anyhow::Result<HANDLE> {
    unsafe {
        let job = CreateJobObjectW(None, None).context("CreateJobObjectW failed")?;

        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        if let Err(e) = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        ) {
            let _ = windows::Win32::Foundation::CloseHandle(job);
            return Err(anyhow::Error::from(e).context("SetInformationJobObject failed"));
        }

        Ok(job)
    }
}

/// RAII guard for a Windows Job Object HANDLE.
#[cfg(target_os = "windows")]
struct JobGuard(Option<HANDLE>);

#[cfg(target_os = "windows")]
unsafe impl Send for JobGuard {}

#[cfg(target_os = "windows")]
const _: fn() = || {
    fn assert_send<T: Send>() {}
    assert_send::<JobGuard>();
};

#[cfg(target_os = "windows")]
impl JobGuard {
    fn new(handle: HANDLE) -> Self {
        Self(Some(handle))
    }
    fn take(mut self) -> HANDLE {
        self.0.take().expect("JobGuard already taken")
    }
}

#[cfg(target_os = "windows")]
impl Drop for JobGuard {
    fn drop(&mut self) {
        if let Some(h) = self.0.take() {
            unsafe { let _ = windows::Win32::Foundation::CloseHandle(h); }
        }
    }
}

#[cfg(target_os = "windows")]
fn assign_to_job(job: HANDLE, child: &Child) -> anyhow::Result<()> {
    let pid = child.id().ok_or_else(|| anyhow!("child has no PID"))?;
    unsafe {
        let proc = windows::Win32::System::Threading::OpenProcess(
            windows::Win32::System::Threading::PROCESS_SET_QUOTA
                | windows::Win32::System::Threading::PROCESS_TERMINATE,
            false,
            pid,
        )
        .context("OpenProcess failed for sidecar pid")?;

        let result = AssignProcessToJobObject(job, proc).context("AssignProcessToJobObject failed");
        let _ = windows::Win32::Foundation::CloseHandle(proc);
        result?;
    }
    Ok(())
}

/// Launch the Flinch sidecar and hand off API keys via stdin. If `app_handle`
/// is provided, the heartbeat loop will emit `sidecar:crashed` events so the
/// UI can react.
pub async fn launch_with_app(
    app_handle: Option<tauri::AppHandle>,
    db_path: PathBuf,
) -> anyhow::Result<SidecarHandle> {
    let port =
        portpicker::pick_unused_port().ok_or_else(|| anyhow!("no free port available"))?;

    tracing::info!("sidecar: picked port {port}");

    let (python, python_source) = find_python()?;
    tracing::info!(
        "sidecar using Python from {:?}: {}",
        python_source,
        python.display()
    );

    // cwd resolution:
    //   ManagedRuntime: flinch is pip-installed into the venv, so cwd just
    //     needs to exist — use the runtime root.
    //   SystemPath: dev mode — find the flinch source tree via walk-up.
    //   EnvOverride: honor FLINCH_SIDECAR_DIR if set, else runtime_dir.
    let sidecar_dir: PathBuf = match python_source {
        PythonSource::ManagedRuntime => crate::bootstrap::runtime_dir()
            .map_err(|e| anyhow!("runtime_dir: {e}"))?,
        PythonSource::SystemPath => {
            find_sidecar_dir().map_err(|e| anyhow!("find_sidecar_dir: {e}"))?
        }
        PythonSource::EnvOverride => find_sidecar_dir().or_else(|_| {
            crate::bootstrap::runtime_dir()
                .map_err(|e| anyhow!("runtime_dir fallback: {e}"))
        })?,
    };

    let db_path_str = db_path
        .to_str()
        .ok_or_else(|| anyhow!("db_path not utf8: {}", db_path.display()))?;

    // Build the child process. CRITICAL: do NOT pass API keys via cmd.env()
    // or cmd.args(). Keys are delivered over stdin AFTER spawn, below.
    let mut cmd = Command::new(&python);
    cmd.args([
        "-m",
        "flinch.app",
        "--port",
        &port.to_string(),
        "--db-path",
        db_path_str,
    ]);
    cmd.current_dir(&sidecar_dir);
    cmd.env("PYTHONUNBUFFERED", "1");
    // FLINCH_PORT is advisory metadata for the child — the authoritative value
    // is --port on the command line. No secrets here.
    cmd.env("FLINCH_PORT", port.to_string());

    cmd.stdin(std::process::Stdio::piped());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().with_context(|| {
        format!(
            "failed to spawn sidecar: python={} cwd={}",
            python.display(),
            sidecar_dir.display()
        )
    })?;

    // STDIN key handoff. Read keys from Credential Manager, serialize to
    // {"keys": {...}}, write to the child's stdin, then drop the write half
    // so Python's readline() returns EOF-terminated (Python does readline()
    // which is satisfied by the newline, but dropping the pipe also releases
    // the file descriptor cleanly).
    {
        let payload = crate::api_keys::load_all_for_sidecar()
            .map_err(|e| anyhow!("load api keys: {e:#}"))?;
        let json = serde_json::to_string(&payload).context("serialize keys payload")?;
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow!("child stdin not piped"))?;
        stdin
            .write_all(json.as_bytes())
            .await
            .context("write keys json to child stdin")?;
        stdin
            .write_all(b"\n")
            .await
            .context("write newline to child stdin")?;
        stdin.flush().await.context("flush child stdin")?;
        // Dropping `stdin` at end of scope closes the write half so Python's
        // `sys.stdin.readline()` returns. The `json` String holding key
        // material also drops here.
        drop(stdin);
        drop(json);
        drop(payload);
    }

    // Windows Job Object — assign child before it can spawn sub-processes.
    #[cfg(target_os = "windows")]
    let job_guard: Option<JobGuard> = {
        match create_job_object() {
            Ok(job) => {
                let guard = JobGuard::new(job);
                if let Err(e) = assign_to_job(job, &child) {
                    tracing::warn!("sidecar: job object assign failed (non-fatal): {e}");
                }
                Some(guard)
            }
            Err(e) => {
                tracing::warn!("sidecar: job object creation failed (non-fatal): {e}");
                None
            }
        }
    };

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow!("child stdout not piped"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| anyhow!("child stderr not piped"))?;

    // Stderr ring buffer for diagnostics.
    let stderr_buffer: Arc<Mutex<VecDeque<String>>> = Arc::new(Mutex::new(VecDeque::new()));
    let stderr_buf_clone = stderr_buffer.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        const STDERR_BUFFER_BYTES: usize = 64 * 1024;
        let mut total_bytes: usize = 0;
        while let Ok(Some(line)) = reader.next_line().await {
            tracing::debug!("sidecar stderr: {}", line);
            crate::crash::record_line(line.clone());
            let line_len = line.len() + 1;
            let mut buf = stderr_buf_clone
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            buf.push_back(line);
            total_bytes += line_len;
            while total_bytes > STDERR_BUFFER_BYTES && buf.len() > 1 {
                if let Some(popped) = buf.pop_front() {
                    total_bytes -= popped.len() + 1;
                }
            }
        }
    });

    // Wait for READY sentinel with 60s timeout.
    let expected_sentinel = format!("READY {port}");

    let mut stdout_reader = BufReader::new(stdout).lines();
    let sentinel_task = tokio::spawn(async move {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            tracing::debug!("sidecar stdout: {}", line);
            if line.trim() == expected_sentinel {
                return Ok(stdout_reader);
            }
        }
        Err(anyhow!("sidecar stdout closed before READY sentinel"))
    });

    let ready_result = timeout(Duration::from_secs(60), sentinel_task).await;

    let stdout_after_ready = match ready_result {
        Err(_elapsed) => {
            let _ = child.kill().await;
            return Err(anyhow!(
                "sidecar failed to start within 60s — Windows Defender may have \
                quarantined python.exe; check %LOCALAPPDATA%/Flinch/runtime/ and \
                add it as an AV exclusion."
            ));
        }
        Ok(Err(join_err)) => {
            let _ = child.kill().await;
            return Err(anyhow!("sidecar sentinel task panicked: {join_err}"));
        }
        Ok(Ok(Err(e))) => {
            let _ = child.kill().await;
            return Err(e.context("sidecar did not emit READY sentinel"));
        }
        Ok(Ok(Ok(reader))) => {
            tracing::info!("sidecar: READY on port {port}");
            reader
        }
    };

    // Drain stdout for the child's lifetime — otherwise the OS pipe buffer
    // (~64 KB on Windows) fills up and the child blocks on write.
    tokio::spawn(async move {
        let mut drain_reader = stdout_after_ready;
        loop {
            match drain_reader.next_line().await {
                Ok(Some(line)) => tracing::debug!("[sidecar stdout] {}", line),
                Ok(None) => break,
                Err(e) => {
                    tracing::warn!("sidecar stdout read error: {e}");
                    break;
                }
            }
        }
    });

    // Heartbeat loop — GET /health every 10s. 3 consecutive misses emits
    // `sidecar:crashed` and exits the loop.
    let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
    let base_url = format!("http://127.0.0.1:{port}");
    let health_url = format!("{base_url}/health");
    let stderr_for_heartbeat = stderr_buffer.clone();
    let heartbeat_app = app_handle.clone();

    tokio::spawn(async move {
        use tauri::Emitter;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .user_agent(concat!("flinch/", env!("CARGO_PKG_VERSION")))
            .build()
            .unwrap_or_default();
        let mut misses: u8 = 0;

        loop {
            tokio::select! {
                _ = &mut shutdown_rx => {
                    tracing::info!("sidecar: heartbeat loop shutting down");
                    return;
                }
                _ = tokio::time::sleep(Duration::from_secs(10)) => {
                    match client.get(&health_url).timeout(Duration::from_secs(5)).send().await {
                        Ok(resp) if resp.status().is_success() => {
                            misses = 0;
                        }
                        other => {
                            misses += 1;
                            tracing::warn!("sidecar heartbeat miss {misses}/3: {:?}", other.err());

                            if misses >= 3 {
                                let snapshot: Vec<String> = {
                                    let buf = stderr_for_heartbeat
                                        .lock()
                                        .unwrap_or_else(|e| e.into_inner());
                                    buf.iter().rev().take(20).cloned().collect()
                                };
                                tracing::error!(
                                    "SIDECAR CRASHED — emitting sidecar:crashed event. \
                                    Last stderr tail:\n{}",
                                    snapshot.join("\n")
                                );
                                if let Some(app) = &heartbeat_app {
                                    let payload = serde_json::json!({
                                        "stderr_tail": snapshot,
                                        "reason": "3 consecutive health misses",
                                    });
                                    if let Err(e) = app.emit("sidecar:crashed", payload) {
                                        tracing::warn!("failed to emit sidecar:crashed: {e}");
                                    }
                                }
                                return;
                            }
                        }
                    }
                }
            }
        }
    });

    Ok(SidecarHandle {
        port,
        base_url,
        child: Some(child),
        #[cfg(target_os = "windows")]
        job: job_guard.map(|g| g.take()),
        shutdown_tx: Some(shutdown_tx),
        stderr_buffer,
    })
}
