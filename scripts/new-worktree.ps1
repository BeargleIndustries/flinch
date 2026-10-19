<#
.SYNOPSIS
    Create or provision a Flinch 0.9 worktree.

.DESCRIPTION
    -Task <id>   Creates ..\flinch-wt\<id> (next to the main worktree) on branch
                 flinch-0.9-ui-<id> from flinch-0.9-ui, then provisions it.
    -Provision   Provisions the current worktree.

    Provisioning is file based (agent tool calls keep no shell state):
      1. Copy src-tauri\resources\* from the main worktree (the first entry of
         `git worktree list --porcelain`), or run scripts/bundle-resources.py
         when the main worktree has no resources.
      2. When ui/package.json exists, run `npm --prefix ui ci`; when it lists
         @playwright/test, run `npx --prefix ui playwright install chromium`.
      3. Write the gitignored ui/.e2e-ports.json with this worktree's e2e ports.
      4. Write the gitignored .cargo/config.toml pointing Cargo at the shared
         <parent of main>\flinch-wt\cargo-target directory.
    It writes no environment file and nothing needs to be dot-sourced.

.EXAMPLE
    pwsh scripts/new-worktree.ps1 -Provision
    pwsh scripts/new-worktree.ps1 -Task T11
#>
[CmdletBinding()]
param(
    [string]$Task,
    [switch]$Provision
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$IntegrationBranch = 'flinch-0.9-ui'

# Task row order from the plan's section 7 table; a task's row number n sets
# its ports (fake 20000 + 10n, sidecar +1, preview +2).
$TaskRows = @(
    'T01', 'T02', 'T03', 'T04', 'T05', 'T06a', 'T06b', 'T07', 'T08', 'T09',
    'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19',
    'T20', 'T21', 'T22', 'T23', 'T24', 'T25', 'T26', 'T27', 'T28', 'T29',
    'T30', 'T31', 'T32', 'T33', 'T34a', 'T34b', 'T35'
)
$DefaultPorts = [ordered]@{ fake = 8766; sidecar = 8765; preview = 4173 }

function Invoke-Native {
    param([string]$Exe, [string[]]$Arguments)
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Exe $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-MainWorktree {
    $lines = git worktree list --porcelain
    if ($LASTEXITCODE -ne 0) { throw 'git worktree list failed' }
    $first = $lines | Where-Object { $_ -like 'worktree *' } | Select-Object -First 1
    if (-not $first) { throw 'git worktree list returned no worktree entry' }
    return [IO.Path]::GetFullPath(($first -replace '^worktree ', ''))
}

function Get-TaskRow {
    param([string]$Id)
    for ($i = 0; $i -lt $TaskRows.Count; $i++) {
        if ($TaskRows[$i] -ieq $Id) { return $i + 1 }
    }
    throw "Unknown task id '$Id'. Known ids: $($TaskRows -join ', ')"
}

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [IO.File]::WriteAllText($Path, $Content, [Text.UTF8Encoding]::new($false))
}

function Copy-Resources {
    param([string]$Root, [string]$Main)
    $dest = Join-Path $Root 'src-tauri\resources'
    $src = Join-Path $Main 'src-tauri\resources'
    $samePlace = [IO.Path]::GetFullPath($Root).TrimEnd('\') -ieq $Main.TrimEnd('\')
    $srcFiles = @()
    if (Test-Path $src) {
        $srcFiles = @(Get-ChildItem -Path $src -File | Where-Object {
                $_.Name -like '*.tar.gz' -or $_.Name -like '*.whl'
            })
    }
    if ($samePlace) {
        if ($srcFiles.Count -eq 0) {
            Write-Host 'Main worktree has no resources; running scripts/bundle-resources.py'
            Invoke-Native 'python' @('scripts/bundle-resources.py')
        }
        else {
            Write-Host 'Resources: this is the main worktree; nothing to copy'
        }
        return
    }
    if ($srcFiles.Count -eq 0) {
        Write-Host 'Main worktree has no resources; running scripts/bundle-resources.py'
        Invoke-Native 'python' @('scripts/bundle-resources.py')
        return
    }
    if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Force -Path $dest | Out-Null }
    foreach ($f in $srcFiles) {
        $target = Join-Path $dest $f.Name
        if ((Test-Path $target) -and ((Get-Item $target).Length -eq $f.Length)) {
            Write-Host "Resources: $($f.Name) already present"
            continue
        }
        Copy-Item -Path $f.FullName -Destination $target -Force
        Write-Host "Resources: copied $($f.Name)"
    }
}

function Invoke-Provision {
    param([string]$Root, [string]$TaskId)
    $Root = [IO.Path]::GetFullPath($Root)
    $main = Get-MainWorktree
    Push-Location $Root
    try {
        Copy-Resources -Root $Root -Main $main

        $pkg = Join-Path $Root 'ui\package.json'
        if (Test-Path $pkg) {
            Invoke-Native 'npm' @('--prefix', 'ui', 'ci')
            if ((Get-Content -Raw $pkg) -match '"@playwright/test"') {
                Invoke-Native 'npx' @('--prefix', 'ui', 'playwright', 'install', 'chromium')
            }
        }
        else {
            Write-Host 'ui/package.json not found; skipping npm steps'
        }

        if ($TaskId) {
            $n = Get-TaskRow $TaskId
            $fake = 20000 + 10 * $n
            $ports = [ordered]@{ fake = $fake; sidecar = $fake + 1; preview = $fake + 2 }
        }
        else {
            $ports = $DefaultPorts
        }
        $portsJson = "{`n" +
        "  `"fake`": $($ports.fake),`n" +
        "  `"sidecar`": $($ports.sidecar),`n" +
        "  `"preview`": $($ports.preview)`n" +
        "}`n"
        Write-Utf8File -Path (Join-Path $Root 'ui\.e2e-ports.json') -Content $portsJson
        Write-Host "Ports: fake $($ports.fake), sidecar $($ports.sidecar), preview $($ports.preview)"

        $cargoTarget = Join-Path (Split-Path -Parent $main) 'flinch-wt\cargo-target'
        $escaped = $cargoTarget -replace '\\', '\\'
        $cargoToml = "[build]`ntarget-dir = `"$escaped`"`n"
        Write-Utf8File -Path (Join-Path $Root '.cargo\config.toml') -Content $cargoToml
        Write-Host "Cargo target-dir: $cargoTarget"
    }
    finally {
        Pop-Location
    }
}

if (-not $Task -and -not $Provision) {
    throw 'Pass -Task <id> to create a task worktree or -Provision to provision the current one.'
}

if ($Task) {
    $null = Get-TaskRow $Task
    $main = Get-MainWorktree
    $path = Join-Path (Split-Path -Parent $main) "flinch-wt\$Task"
    $branch = "$IntegrationBranch-$Task"
    if (Test-Path $path) {
        Write-Host "Worktree $path already exists; provisioning it"
    }
    else {
        Invoke-Native 'git' @('worktree', 'add', $path, '-b', $branch, $IntegrationBranch)
    }
    Invoke-Provision -Root $path -TaskId $Task
}
else {
    $root = git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0) { throw 'Not inside a git worktree' }
    $branchName = git rev-parse --abbrev-ref HEAD
    $taskId = $null
    if ($branchName -match "^$([regex]::Escape($IntegrationBranch))-(T\w+)$") {
        $taskId = $Matches[1]
    }
    Invoke-Provision -Root $root -TaskId $taskId
}
