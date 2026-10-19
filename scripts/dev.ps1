#!powershell
# Browser dev mode (brief 12.6): the sidecar on 8000 and `vite dev` on 5173,
# which proxies the API to the sidecar. Ctrl+C stops both.
#
# Keys come from `.env` through the sidecar, so the sidecar never waits on the
# desktop shell's stdin handoff (--no-stdin-keys).
#
# Usage:
#   pwsh scripts/dev.ps1   (set $env:PYTHON to pick an interpreter; default python)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$python = if ($env:PYTHON) { $env:PYTHON } else { "python" }
$sidecar = $null

Push-Location $repoRoot
try {
    $sidecar = Start-Process -FilePath $python `
        -ArgumentList @("-m", "flinch.app", "--port", "8000", "--no-stdin-keys") `
        -WorkingDirectory $repoRoot -NoNewWindow -PassThru

    Write-Host "Open http://127.0.0.1:5173" -ForegroundColor Green
    # In the foreground, so Ctrl+C reaches vite; the finally block then stops the sidecar.
    npm --prefix ui run dev
} finally {
    if ($sidecar -and -not $sidecar.HasExited) {
        Stop-Process -Id $sidecar.Id -Force -ErrorAction SilentlyContinue
    }
    Pop-Location
}
