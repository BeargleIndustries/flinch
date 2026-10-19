#!powershell
# Build the Flinch Windows NSIS installer end-to-end.
#
# Steps:
#   1. Build the app: `npm --prefix ui ci` and `npm --prefix ui run build`, which
#      writes ui/build (the shell's frontendDist).
#   2. Run bundle-resources.py to populate src-tauri/resources/ with the pinned
#      python-build-standalone tarball and a freshly built Flinch wheel.
#   3. Invoke `cargo tauri build` to compile the Tauri shell and produce the
#      NSIS installer.
#   4. Report the installer path, size, and contents-summary so a human can
#      sanity-check before shipping.
#
# Prerequisites:
#   - Node.js with npm on PATH
#   - Python 3.11+ with `pip` on PATH
#   - Rust toolchain (cargo)
#   - Tauri CLI: `cargo install tauri-cli --version "^2.0.0"` (one-time)
#   - WebView2 runtime on the build machine (comes with Windows 11)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$tauriDir = Join-Path $repoRoot "src-tauri"
$resourcesDir = Join-Path $tauriDir "resources"
$uiDir = Join-Path $repoRoot "ui"

function Section($label) {
    Write-Host ""
    Write-Host "=== $label ===" -ForegroundColor Cyan
}

Push-Location $repoRoot
try {
    Section "Step 1 / 4 - Build the app (ui)"
    npm --prefix ui ci
    if ($LASTEXITCODE -ne 0) {
        throw "npm --prefix ui ci failed (exit $LASTEXITCODE)"
    }
    npm --prefix ui run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm --prefix ui run build failed (exit $LASTEXITCODE)"
    }
    if (-not (Test-Path (Join-Path $uiDir "build\index.html"))) {
        throw "ui/build/index.html is missing after the app build."
    }

    Section "Step 2 / 4 - Bundle build-time resources"
    python scripts/bundle-resources.py
    if ($LASTEXITCODE -ne 0) {
        throw "bundle-resources.py failed (exit $LASTEXITCODE)"
    }

    $pbsTarball = Get-ChildItem -Path $resourcesDir -Filter "cpython-*.tar.gz" -ErrorAction SilentlyContinue | Select-Object -First 1
    $flinchWheel = Get-ChildItem -Path $resourcesDir -Filter "flinch-*.whl" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $pbsTarball -or -not $flinchWheel) {
        throw "Expected src-tauri/resources/cpython-*.tar.gz and flinch-*.whl after bundling; one or both are missing."
    }
    Write-Host ("  PBS tarball : {0} ({1:N1} MB)" -f $pbsTarball.Name, ($pbsTarball.Length / 1MB))
    Write-Host ("  Flinch wheel: {0} ({1:N1} KB)" -f $flinchWheel.Name, ($flinchWheel.Length / 1KB))

    Section "Step 3 / 4 - Build Tauri installer (cargo tauri build)"
    Push-Location $tauriDir
    try {
        cargo tauri build
        if ($LASTEXITCODE -ne 0) {
            throw "cargo tauri build failed (exit $LASTEXITCODE)"
        }
        # The target dir may be shared across worktrees (.cargo/config.toml or
        # CARGO_TARGET_DIR), so ask cargo where it is.
        $targetDir = (cargo metadata --format-version 1 --no-deps | ConvertFrom-Json).target_directory
        if ($LASTEXITCODE -ne 0 -or -not $targetDir) {
            $targetDir = Join-Path $tauriDir "target"
        }
    } finally {
        Pop-Location
    }

    Section "Step 4 / 4 - Report artifact"
    $nsisDir = Join-Path $targetDir "release\bundle\nsis"
    $installer = Get-ChildItem -Path $nsisDir -Filter "*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $installer) {
        throw "No NSIS installer found at $nsisDir"
    }
    $sizeMB = [Math]::Round($installer.Length / 1MB, 1)
    Write-Host ""
    Write-Host ("Installer: {0}" -f $installer.FullName) -ForegroundColor Green
    Write-Host ("Size     : {0} MB" -f $sizeMB) -ForegroundColor Green
    Write-Host ""
    if ($sizeMB -lt 50 -or $sizeMB -gt 80) {
        Write-Warning ("Installer size {0} MB is outside the expected 50-80 MB band - double-check bundled resources." -f $sizeMB)
    }
    Write-Host "Done. Next: test on a clean Windows 11 VM per acceptance criterion 1 in .omc/plans/no-cli-release-v2.md" -ForegroundColor Green
} finally {
    Pop-Location
}
