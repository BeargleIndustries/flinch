//! Crash logging with path/username/key sanitization and clipboard export.
//! No network telemetry — logs live only on the user's machine and can be
//! manually shared via the Settings screen's "Copy diagnostic" button.
//!
//! Adapted from Pry's crash module; the key-sanitization regex set is tuned
//! for Flinch's API providers (Anthropic, OpenAI, Google, xAI, Together).

use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::Mutex;

use chrono::Utc;
use once_cell::sync::Lazy;
use regex::Regex;

const MAX_LOG_BYTES: usize = 1024 * 1024;  // 1MB per log file
const MAX_LOG_FILES: usize = 10;           // keep last 10 crash logs
const MAX_BUFFER_LINES: usize = 500;       // in-memory tail for diagnostic export

static IN_MEMORY_TAIL: Lazy<Mutex<VecDeque<String>>> =
    Lazy::new(|| Mutex::new(VecDeque::with_capacity(MAX_BUFFER_LINES)));

// Compiled once at first use.
static ANTHROPIC_KEY_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"sk-ant-[a-zA-Z0-9_\-]{20,}").expect("ANTHROPIC_KEY_RE is valid"));
static OPENAI_KEY_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"sk-[a-zA-Z0-9_\-]{32,}").expect("OPENAI_KEY_RE is valid"));
static BEARER_TOKEN_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"Bearer\s+[a-zA-Z0-9._~+/=\-]{20,}").expect("BEARER_TOKEN_RE is valid")
});
// Google API keys are typically 39 chars starting with "AIza"
static GOOGLE_KEY_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"AIza[a-zA-Z0-9_\-]{35}").expect("GOOGLE_KEY_RE is valid"));
// xAI keys use the openai-style "xai-" prefix
static XAI_KEY_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"xai-[a-zA-Z0-9_\-]{32,}").expect("XAI_KEY_RE is valid"));

pub fn logs_dir() -> anyhow::Result<PathBuf> {
    let base = dirs::data_local_dir()
        .ok_or_else(|| anyhow::anyhow!("could not resolve local data dir"))?;
    let dir = base.join("Flinch").join("logs");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn record_line(line: impl Into<String>) {
    let line = line.into();
    let mut buf = IN_MEMORY_TAIL
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    buf.push_back(line);
    while buf.len() > MAX_BUFFER_LINES {
        buf.pop_front();
    }
}

pub fn record_crash(context: &str, detail: &str) -> anyhow::Result<PathBuf> {
    let dir = logs_dir()?;
    let filename = format!("crash-{}.log", Utc::now().format("%Y%m%d-%H%M%S"));
    let path = dir.join(filename);

    let mut content = String::new();
    content.push_str(&format!("[Flinch crash report — {}]\n", Utc::now().to_rfc3339()));
    content.push_str(&format!("Context: {context}\n\n"));
    content.push_str("=== OS ===\n");
    content.push_str(&format!("{}\n\n", os_info::get()));
    content.push_str("=== Detail ===\n");
    content.push_str(detail);
    content.push_str("\n\n=== Log tail (last 500 lines) ===\n");
    {
        let buf = IN_MEMORY_TAIL
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        for line in buf.iter() {
            content.push_str(line);
            content.push('\n');
        }
    }

    let sanitized = sanitize(&content);
    let capped = if sanitized.len() > MAX_LOG_BYTES {
        format!(
            "{}\n[... truncated at {} bytes ...]",
            &sanitized[..MAX_LOG_BYTES],
            MAX_LOG_BYTES
        )
    } else {
        sanitized
    };

    std::fs::write(&path, capped)?;
    rotate_old_logs(&dir)?;
    Ok(path)
}

/// Strip username from paths, API keys, and other identifying tokens.
fn sanitize(input: &str) -> String {
    let mut out = input.to_string();

    if let Ok(username) = std::env::var("USERNAME") {
        if !username.is_empty() && username.len() > 2 {
            out = out.replace(&username, "<user>");
        }
    }
    if let Ok(profile) = std::env::var("USERPROFILE") {
        out = out.replace(&profile, "<profile>");
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        out = out.replace(&appdata, "<appdata>");
    }
    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        out = out.replace(&localappdata, "<localappdata>");
    }

    // Order matters: Anthropic keys match the OpenAI pattern too, so check the
    // more specific prefix first.
    out = ANTHROPIC_KEY_RE.replace_all(&out, "<anthropic_key>").to_string();
    out = OPENAI_KEY_RE.replace_all(&out, "<openai_key>").to_string();
    out = GOOGLE_KEY_RE.replace_all(&out, "<google_key>").to_string();
    out = XAI_KEY_RE.replace_all(&out, "<xai_key>").to_string();
    out = BEARER_TOKEN_RE.replace_all(&out, "Bearer <token>").to_string();

    out
}

fn rotate_old_logs(dir: &std::path::Path) -> anyhow::Result<()> {
    let mut entries: Vec<_> = std::fs::read_dir(dir)?
        .filter_map(Result::ok)
        .filter(|e| e.file_name().to_string_lossy().starts_with("crash-"))
        .collect();
    entries.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
    while entries.len() > MAX_LOG_FILES {
        let oldest = entries.remove(0);
        let _ = std::fs::remove_file(oldest.path());
    }
    Ok(())
}

/// Get the in-memory log tail as a single sanitized string, for the Copy
/// Diagnostic button.
pub fn diagnostic_snapshot() -> String {
    let mut content = String::new();
    content.push_str(&format!("[Flinch diagnostic — {}]\n", Utc::now().to_rfc3339()));
    content.push_str(&format!("OS: {}\n\n", os_info::get()));
    content.push_str("=== Log tail ===\n");
    {
        let buf = IN_MEMORY_TAIL
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        for line in buf.iter() {
            content.push_str(line);
            content.push('\n');
        }
    }
    sanitize(&content)
}

#[tauri::command]
pub fn copy_diagnostic() -> Result<String, String> {
    Ok(diagnostic_snapshot())
}

#[tauri::command]
pub fn list_crash_logs() -> Result<Vec<String>, String> {
    let dir = logs_dir().map_err(|e| e.to_string())?;
    let mut entries: Vec<_> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .filter(|e| e.file_name().to_string_lossy().starts_with("crash-"))
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    entries.sort();
    entries.reverse();
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_redacts_anthropic_key() {
        let redacted = sanitize("ANTHROPIC_API_KEY=sk-ant-abcdefghijklmnopqrstuvwxyz1234567890");
        assert!(!redacted.contains("sk-ant-abcdef"));
        assert!(redacted.contains("<anthropic_key>"));
    }

    #[test]
    fn sanitize_redacts_openai_key() {
        let redacted = sanitize("OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABC");
        assert!(!redacted.contains("sk-proj-abc"));
        assert!(redacted.contains("<openai_key>"));
    }

    #[test]
    fn sanitize_redacts_google_key() {
        let redacted = sanitize("key=AIzaBCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abc");
        assert!(!redacted.contains("AIzaBCD"));
        assert!(redacted.contains("<google_key>"));
    }

    #[test]
    fn sanitize_redacts_bearer_token() {
        let redacted = sanitize("Authorization: Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaa");
        assert!(!redacted.contains("aaaaaaaaaaaaaaaaaaaaaaaaaaa"));
        assert!(redacted.contains("Bearer <token>"));
    }

    #[test]
    fn sanitize_leaves_normal_text_alone() {
        let input = "This is a normal error message without any credentials in it.";
        assert_eq!(sanitize(input), input);
    }
}
