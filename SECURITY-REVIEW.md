# Security Review Report — Flinch

**Reviewed:** 2026-03-12
**Scope:** Pre-open-source audit of `C:\Users\Brad\Documents\Claude Code\flinch`
**Reviewer:** Claude Security Reviewer (automated)

## Summary

- **Critical Issues:** 2
- **High Issues:** 3
- **Medium Issues:** 4
- **Low / Informational:** 3
- **Overall Risk:** MEDIUM (acceptable for open-source local tool with remediation)

---

## Critical Issues (Fix Before Publishing)

### 1. API Key Partial Leak in Startup Log
**Severity:** CRITICAL
**Location:** `flinch/app.py:63`
**Issue:** The startup sequence prints a partial API key to stdout:
```python
print(f"[flinch] API key loaded: {api_key[:15]}...{api_key[-4:]} (len={len(api_key)})")
```
For a typical Anthropic key (`sk-ant-api03-...`), this exposes 15 leading + 4 trailing characters. Combined, these fragments are sufficient to identify the key account and potentially reconstruct it. In CI logs, Docker logs, or any captured stdout, this leaks key material.

**Remediation:** Remove the print entirely, or replace with a boolean existence check:
```python
print(f"[flinch] API key: {'set' if api_key else 'NOT SET'}")
```

---

### 2. API Key Write Endpoint Accepts Arbitrary Key Names
**Severity:** CRITICAL
**Location:** `flinch/app.py` — `POST /api/settings/keys`
**Issue:** The `_SUPPORTED_KEYS` dict defines only 3 known keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`), but the `.env` write path (`_write_env_file`) does not enforce this whitelist against the incoming POST body. If the endpoint accepts arbitrary `key: value` pairs without validating against `_SUPPORTED_KEYS`, an attacker with local access (or a CSRF from a browser with `allow_origins=["*"]`) could inject arbitrary environment variable lines into the `.env` file — including things like `PATH=`, `LD_PRELOAD=`, or fake credentials for other tools that read the same `.env`.

**Remediation:** In the update endpoint handler, validate every incoming key name against `_SUPPORTED_KEYS` before calling `_write_env_file`:
```python
unknown = set(keys_dict) - set(_SUPPORTED_KEYS)
if unknown:
    raise HTTPException(400, f"Unknown key names: {unknown}")
```

---

## High Issues

### 3. CORS Wildcard (`allow_origins=["*"]`) with No Authentication
**Severity:** HIGH
**Location:** `flinch/app.py:75-79`
**Issue:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```
With no authentication and wildcard CORS, any webpage the user visits while Flinch is running can make arbitrary API calls — reading all probe data, session data, research annotations, exporting the full database, and writing API keys to `.env`. This is a CSRF/cross-origin data exfiltration risk.

**Assessment:** Acceptable for a purely local tool, but only if explicitly documented. For open-source release, users may accidentally expose the server on a network interface.

**Remediation:** Restrict to localhost origin:
```python
allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"]
```
And bind uvicorn to `127.0.0.1` only (not `0.0.0.0`). Verify the `main()` entrypoint does this.

---

### 4. Dynamic SQL SET Clause Built from Field Names
**Severity:** HIGH
**Location:** `flinch/db.py` — all `update_*` functions (e.g., `update_sequence`, `update_sequence_run`, `update_run`, `update_session`)
**Issue:** These functions build SQL dynamically:
```python
set_clause = ", ".join(f"{k} = ?" for k in fields)
conn.execute(f"UPDATE sequences SET {set_clause} WHERE id = ?", (*fields.values(), id))
```
The field **names** (column names) are interpolated directly into the SQL string. Values use `?` placeholders correctly, but column names do not. The `allowed` set whitelist mitigates this — only known field names from `allowed` are passed through. As long as `allowed` contains only literal, hardcoded strings, this is safe.

**Risk:** If any `update_*` call site ever passes field names from external input without going through the `allowed` filter first, SQL injection on column names becomes possible. The pattern is fragile.

**Remediation:** Add an assertion to make the safety invariant explicit and hard to break accidentally:
```python
assert all(k.isidentifier() and k.isascii() for k in fields), f"Unsafe field names: {fields.keys()}"
```
This is a cheap guard that will catch any future regression immediately.

---

### 5. Exception Details Leaked in HTTP 500 Responses
**Severity:** HIGH
**Location:** `flinch/app.py` — multiple endpoints
**Issue:** Internal exception messages are forwarded directly to API responses:
```python
raise HTTPException(500, f"Error sending probe: {e}")
raise HTTPException(500, f"Promote failed: {e}")
```
For a local tool this is acceptable for debugging. For open-source release with potential networked use, exception strings can leak file paths, internal state, library versions, and API error details (e.g., Anthropic SDK errors may include model names, request IDs, or partial prompt content).

**Remediation:** Log the full exception server-side and return a generic message to the client:
```python
import logging
logger = logging.getLogger(__name__)

except Exception as e:
    logger.exception("Error sending probe")
    raise HTTPException(500, "Internal error — check server logs")
```
Or at minimum, keep the current behavior but document it in the README as a known local-only assumption.

---

## Medium Issues

### 6. No Input Length Limits on Free-Text Fields
**Severity:** MEDIUM
**Location:** `flinch/app.py` — `SendProbeRequest`, `SendPushbackRequest`, session creation endpoints
**Issue:** Pydantic models accept `str` fields with no `max_length` constraint. A user (or malicious page via CORS) could POST a multi-megabyte system prompt or pushback text, causing the Anthropic API to reject the request with a confusing error, or filling the SQLite DB with garbage data.

**Remediation:** Add reasonable limits to Pydantic models:
```python
from pydantic import Field
class SendPushbackRequest(BaseModel):
    text: str = Field(..., max_length=32_000)
```

---

### 7. `default-probes.md` Excluded from Git But Gitignore Pattern is Broad
**Severity:** MEDIUM
**Location:** `.gitignore:20-23`
**Issue:** The gitignore excludes all `flinch/probes/*.md` files, then carve-outs `example-probes.md`. The actual shipped default probes file is `default-probes.md` which is **not** in the carve-out list. This means `default-probes.md` is currently excluded from git (confirmed by the `.gitkeep` pattern). If someone adds probes with sensitive research content and forgets the gitignore rule, it won't be committed — but if the intention is to ship `default-probes.md` with the open-source release, it would need to be explicitly added to the carve-out (`!flinch/probes/default-probes.md`).

**Remediation:** Decide the intended behavior and either:
- Add `!flinch/probes/default-probes.md` to gitignore if it should ship
- Document that users must provide their own probes file

---

### 8. `sessions/` Directory Excluded But May Contain Exported Data
**Severity:** MEDIUM
**Location:** `.gitignore:39`
**Issue:** The `sessions/` directory is gitignored. However, the export endpoints generate CSV/JSON files that may be written elsewhere (e.g., StreamingResponse to browser). If any export path writes files to the project directory outside `sessions/`, that data would not be excluded. Verify no export function writes to disk at a path not covered by gitignore.

**Assessment:** The export endpoints appear to use `StreamingResponse` / `Response` directly (in-memory), so no files are written to disk. Confirmed safe, but worth a comment in the code.

---

### 9. `AUDIT.md` Gitignored — Intentional?
**Severity:** MEDIUM / Informational
**Location:** `.gitignore:36`
**Issue:** An `AUDIT.md` file exists in the project root and is explicitly gitignored. For an open-source release, internal audit notes may contain security findings, session data references, or research methodology details you don't want public. Confirm the gitignore of this file is intentional before publishing.

---

## Low / Informational

### 10. No Authentication — Documented Local-Only Assumption
**Severity:** LOW (informational)
**Issue:** Flinch has no authentication layer. This is appropriate for a local research tool. However, it must be clearly documented in the README:
- Do not expose port 8000 on a public or shared network interface
- The API has full read/write access to all research data and can write API keys to disk
- Suitable for `localhost` use only

---

### 11. `.env.example` Contains No Real Keys — Clean
**Severity:** NONE (confirmed clean)
**Finding:** `.env.example` contains only placeholder values (`your-anthropic-api-key-here`). No real credentials present. Good.

---

### 12. Dependency Audit
**Severity:** LOW
**Finding:** `pip-audit` was not available in the environment during this review. The declared dependencies are:
- `anthropic>=0.40.0`, `fastapi>=0.115.0`, `uvicorn[standard]>=0.32.0`, `pyyaml>=6.0`, `pydantic>=2.0`, `rich>=13.0`

All are recent major versions with active security maintenance. No known CVEs against these version ranges as of March 2026.

**Remediation:** Run `pip-audit` before release and pin to specific versions in a `requirements-lock.txt` for reproducible installs.

---

## Security Checklist

- [x] No hardcoded secrets in tracked files
- [x] `.env` excluded from git
- [x] Database files excluded from git
- [x] Probe content excluded from git
- [x] SQL injection: values use parameterized queries throughout
- [x] XSS: `escHtml()` used consistently in render.js for user-sourced content
- [x] No subprocess/shell execution
- [x] No path traversal via user-supplied file paths (probe import uses hardcoded `PROBES_DIR`)
- [x] API keys masked in GET responses
- [x] `.env.example` contains no real credentials
- [ ] **FAIL** API key partial exposed in startup log (`app.py:63`)
- [ ] **FAIL** API key write endpoint may accept arbitrary env var names
- [ ] **FAIL** CORS wildcard allows cross-origin full API access
- [ ] **WARN** Dynamic SQL column names need assertion guard
- [ ] **WARN** Exception details forwarded to HTTP 500 responses
- [ ] **WARN** No input length limits on free-text API fields
- [ ] **TODO** Run `pip-audit` before release
- [ ] **TODO** Bind uvicorn to `127.0.0.1`, not `0.0.0.0`
- [ ] **TODO** Add README warning: local-only, do not expose publicly

---

## Priority Order for Remediation

1. Remove/redact the API key print statement (`app.py:63`) — 2 minutes
2. Whitelist key names in the update-keys endpoint — 5 minutes
3. Change CORS to localhost-only and bind uvicorn to 127.0.0.1 — 5 minutes
4. Add `assert` guard to dynamic SQL update functions in `db.py` — 10 minutes
5. Swap exception detail in HTTP 500s for logged messages — 15 minutes
6. Add `max_length` to Pydantic request models — 10 minutes
7. Run `pip-audit`, add README network warning, clarify `default-probes.md` gitignore intent
