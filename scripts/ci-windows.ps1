<#
.SYNOPSIS
    Windows CI gate (plan F11, R19). The GitHub workflow calls only this script.

.DESCRIPTION
    Builds the UI, rebuilds the gitignored bundle resources, checks that
    bundle-resources.py left src-tauri/src/bootstrap/pbs.rs unchanged, then runs
    cargo check. The resources step runs unconditionally: tauri-build copies
    bundle resources during cargo check and fails on an empty glob (A10).

.EXAMPLE
    pwsh scripts/ci-windows.ps1
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Native {
    param([string]$Exe, [string[]]$Arguments)
    Write-Host "`n== $Exe $($Arguments -join ' ')"
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Exe $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

# node:sqlite (ui/tests/e2e/batch-cancel.spec.ts) needs Node 22.13 or newer.
$nodeVersion = [version]((& node --version).TrimStart('v'))
if ($nodeVersion -lt [version]'22.13') {
    throw 'Node 22.13 or newer is required (node:sqlite)'
}

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    Invoke-Native 'npm' @('--prefix', 'ui', 'ci')
    Invoke-Native 'npm' @('--prefix', 'ui', 'run', 'build')
    Invoke-Native 'python' @('scripts/bundle-resources.py')
    Invoke-Native 'git' @('diff', '--exit-code', '--', 'src-tauri/src/bootstrap/pbs.rs')
    Invoke-Native 'cargo' @('check', '--manifest-path', 'src-tauri/Cargo.toml')
    Write-Host "`n== ci-windows.ps1 passed"
}
finally {
    Pop-Location
}
