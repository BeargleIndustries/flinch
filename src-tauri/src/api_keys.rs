//! Windows Credential Manager wrapper for Flinch API keys.
//!
//! Keys are stored with target names `Flinch/{provider}` using the generic
//! credential type. Raw key values never leave this module except via
//! `load_all_for_sidecar()`, which is the sole internal path for feeding keys
//! into a child sidecar process over stdin.
//!
//! Canonical provider names match the FastAPI `/api/settings/keys` contract:
//! `anthropic`, `openai`, `google`, `xai`, `meta` (Meta/Llama via Together).

use std::collections::HashMap;

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use windows::core::PWSTR;
use windows::Win32::Foundation::{GetLastError, ERROR_NOT_FOUND, FILETIME};
use windows::Win32::Security::Credentials::{
    CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_FLAGS,
    CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
};

/// Canonical provider names. Order here is the order the sidecar will see in
/// the stdin JSON payload, which is insertion-order-preserved for HashMap on
/// Windows' default hasher — but consumers must not rely on ordering.
pub const PROVIDERS: &[&str] = &["anthropic", "openai", "google", "xai", "meta"];

fn target_name(provider: &str) -> String {
    format!("Flinch/{provider}")
}

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Write a key for `provider` into Windows Credential Manager.
/// Overwrites any existing value for the same target.
pub fn save_key(provider: &str, key: &str) -> Result<()> {
    if !PROVIDERS.contains(&provider) {
        return Err(anyhow!("unknown provider: {provider}"));
    }
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("cannot save empty key for {provider}"));
    }

    let target = target_name(provider);
    let mut target_w = to_wide(&target);
    let mut blob: Vec<u8> = trimmed.as_bytes().to_vec();

    let cred = CREDENTIALW {
        Flags: CRED_FLAGS(0),
        Type: CRED_TYPE_GENERIC,
        TargetName: PWSTR(target_w.as_mut_ptr()),
        Comment: PWSTR::null(),
        LastWritten: FILETIME::default(),
        CredentialBlobSize: blob.len() as u32,
        CredentialBlob: blob.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        AttributeCount: 0,
        Attributes: std::ptr::null_mut(),
        TargetAlias: PWSTR::null(),
        UserName: PWSTR::null(),
    };

    unsafe {
        CredWriteW(&cred, 0)
            .with_context(|| format!("CredWriteW failed for {target}"))?;
    }
    Ok(())
}

/// Read a key for `provider` from Windows Credential Manager.
/// Returns `Ok(None)` if no credential is stored. This function is
/// **internal-only** and is called during sidecar launch to build the JSON
/// stdin payload. It must never be exposed through a Tauri command.
pub fn get_key(provider: &str) -> Result<Option<String>> {
    if !PROVIDERS.contains(&provider) {
        return Err(anyhow!("unknown provider: {provider}"));
    }
    let target = target_name(provider);
    let target_w = to_wide(&target);
    let mut cred_ptr: *mut CREDENTIALW = std::ptr::null_mut();

    unsafe {
        let res = CredReadW(
            PWSTR(target_w.as_ptr() as *mut u16),
            CRED_TYPE_GENERIC,
            0,
            &mut cred_ptr,
        );
        if let Err(err) = res {
            let last = GetLastError();
            if last == ERROR_NOT_FOUND {
                return Ok(None);
            }
            return Err(err).with_context(|| format!("CredReadW failed for {target}"));
        }
        if cred_ptr.is_null() {
            return Ok(None);
        }
        let cred = &*cred_ptr;
        let len = cred.CredentialBlobSize as usize;
        let slice = std::slice::from_raw_parts(cred.CredentialBlob, len);
        let value = std::str::from_utf8(slice)
            .map(|s| s.to_string())
            .with_context(|| format!("stored blob for {target} is not valid UTF-8"));
        CredFree(cred_ptr as *const _);
        value.map(Some)
    }
}

/// Delete the stored key for `provider`. No-ops if nothing is stored.
pub fn delete_key(provider: &str) -> Result<()> {
    if !PROVIDERS.contains(&provider) {
        return Err(anyhow!("unknown provider: {provider}"));
    }
    let target = target_name(provider);
    let target_w = to_wide(&target);
    unsafe {
        match CredDeleteW(PWSTR(target_w.as_ptr() as *mut u16), CRED_TYPE_GENERIC, 0) {
            Ok(()) => Ok(()),
            Err(err) => {
                let last = GetLastError();
                if last == ERROR_NOT_FOUND {
                    Ok(())
                } else {
                    Err(err).with_context(|| format!("CredDeleteW failed for {target}"))
                }
            }
        }
    }
}

/// Return `{provider: is_configured}` for every known provider. Does not
/// expose key values. Safe to return to the frontend.
pub fn list_configured() -> HashMap<String, bool> {
    let mut out = HashMap::new();
    for provider in PROVIDERS {
        let configured = get_key(provider).ok().flatten().is_some();
        out.insert((*provider).to_string(), configured);
    }
    out
}

/// Stdin payload sent to the Python sidecar. The top-level JSON shape is
/// `{"keys": {provider: value, ...}}` per US-001's `_read_stdin_keys`
/// contract. Only providers with a configured key are included.
#[derive(Serialize)]
pub struct SidecarKeysPayload {
    pub keys: HashMap<String, String>,
}

/// Build the stdin payload for the sidecar by reading every configured key
/// from CredMan. Keys stay in-process memory only until written to the child
/// pipe and then dropped. Intended to be called once at sidecar launch.
pub fn load_all_for_sidecar() -> Result<SidecarKeysPayload> {
    let mut keys = HashMap::new();
    for provider in PROVIDERS {
        if let Some(value) = get_key(provider)? {
            keys.insert((*provider).to_string(), value);
        }
    }
    Ok(SidecarKeysPayload { keys })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Integration tests require a Windows environment and will touch the real
    // Credential Manager. They are gated behind `FLINCH_CREDMAN_TESTS=1` so
    // running `cargo test` on a dev box does not accidentally mutate stored
    // credentials.
    fn credman_tests_enabled() -> bool {
        std::env::var_os("FLINCH_CREDMAN_TESTS").is_some()
    }

    #[test]
    fn rejects_unknown_provider() {
        assert!(save_key("nonexistent", "x").is_err());
        assert!(get_key("nonexistent").is_err());
        assert!(delete_key("nonexistent").is_err());
    }

    #[test]
    fn rejects_empty_key() {
        assert!(save_key("anthropic", "   ").is_err());
    }

    #[test]
    fn roundtrip() {
        if !credman_tests_enabled() {
            return;
        }
        let sample = "sk-flinch-roundtrip-test-key-do-not-use";
        save_key("anthropic", sample).expect("save");
        let got = get_key("anthropic").expect("read").expect("some value");
        assert_eq!(got, sample);
        delete_key("anthropic").expect("delete");
        let gone = get_key("anthropic").expect("read after delete");
        assert!(gone.is_none());
    }
}
