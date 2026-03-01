#Requires -Version 5.1
<#
.SYNOPSIS
    AI Workbench - Dev server launcher
.DESCRIPTION
    Auto-fix env -> install deps -> start Tauri dev.
    Falls back to setup.ps1 if environment is broken.
.EXAMPLE
    .\scripts\dev.ps1              # Start full Tauri dev
    .\scripts\dev.ps1 -FrontendOnly  # Vite only (no Rust)
    .\scripts\dev.ps1 -Build        # Production build
    .\scripts\dev.ps1 -Check        # Check only, no start
#>
[CmdletBinding()]
param(
    [switch]$FrontendOnly,
    [switch]$Build,
    [switch]$Check,
    [switch]$SkipSetup
)

$ErrorActionPreference = "Continue"

function Write-Banner {
    $mode = "Dev Mode"
    if ($Build) { $mode = "Build Mode" }
    elseif ($FrontendOnly) { $mode = "Frontend Only" }
    Write-Host ""
    Write-Host "  =============================================" -ForegroundColor Cyan
    Write-Host "    AI Workbench - $mode" -ForegroundColor Cyan
    Write-Host "  =============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Quick-PathFix {
    $paths = @(
        "C:\Program Files\nodejs",
        (Join-Path $env:USERPROFILE ".cargo\bin"),
        (Join-Path $env:APPDATA "npm"),
        "C:\Program Files\PowerShell\7"
    )
    foreach ($p in $paths) {
        if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
            $env:Path = "$p;$env:Path"
        }
    }
}

function Quick-Check {
    $ok = $true

    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host "  [FAIL] Node.js not found" -ForegroundColor Red
        $ok = $false
    } else {
        $nodeVer = & node --version 2>&1
        Write-Host "  [OK]   Node.js $nodeVer" -ForegroundColor Green
    }

    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm) {
        Write-Host "  [FAIL] npm not found" -ForegroundColor Red
        $ok = $false
    } else {
        $npmVer = & npm --version 2>&1
        Write-Host "  [OK]   npm $npmVer" -ForegroundColor Green
    }

    if (-not $FrontendOnly) {
        $cargo = Get-Command cargo -ErrorAction SilentlyContinue
        if (-not $cargo) {
            Write-Host "  [FAIL] Cargo not found" -ForegroundColor Red
            $ok = $false
        } else {
            $cargoVer = & cargo --version 2>&1
            Write-Host "  [OK]   $cargoVer" -ForegroundColor Green
        }
    }

    $projectRoot = Split-Path $PSScriptRoot -Parent
    $nodeModules = Join-Path $projectRoot "node_modules"
    if (-not (Test-Path $nodeModules)) {
        Write-Host "  [WARN] node_modules missing, need npm install" -ForegroundColor Yellow
        return "npm-install"
    }

    return $(if ($ok) { "ok" } else { "fail" })
}

# == Main ==================================================================
Write-Banner

$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

# 1. Quick PATH fix
Quick-PathFix

# 2. Quick check
Write-Host "  Checking environment..." -ForegroundColor Gray
$status = Quick-Check

if ($status -eq "fail" -and -not $SkipSetup) {
    Write-Host ""
    Write-Host "  Environment incomplete. Running setup.ps1 ..." -ForegroundColor Yellow
    Write-Host ""

    $setupScript = Join-Path $PSScriptRoot "setup.ps1"
    if (Test-Path $setupScript) {
        & $setupScript
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "  [FAIL] Setup failed. Fix errors above and retry." -ForegroundColor Red
            exit 1
        }
        Quick-PathFix
        $status = Quick-Check
    } else {
        Write-Host "  [FAIL] setup.ps1 not found" -ForegroundColor Red
        exit 1
    }
}

if ($status -eq "npm-install") {
    Write-Host ""
    Write-Host "  Installing dependencies..." -ForegroundColor Cyan
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FAIL] npm install failed" -ForegroundColor Red
        Write-Host "  Try: Remove-Item -Recurse -Force node_modules; npm install" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  [OK]   Dependencies installed" -ForegroundColor Green
}

if ($Check) {
    Write-Host ""
    Write-Host "  [OK]   Environment check passed. No server started (-Check mode)" -ForegroundColor Green
    exit 0
}

# 3. Launch
Write-Host ""
if ($Build) {
    Write-Host "  Building production release..." -ForegroundColor Cyan
    Write-Host ""
    & npm run tauri build
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "  [OK]   Build complete! Output: src-tauri\target\release" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "  [FAIL] Build failed (exit $LASTEXITCODE)" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Troubleshooting:" -ForegroundColor Yellow
        Write-Host "    1. TS errors  : npx tsc --noEmit" -ForegroundColor Gray
        Write-Host "    2. Rust errors: cd src-tauri && cargo check" -ForegroundColor Gray
        Write-Host "    3. Clean build: cd src-tauri && cargo clean" -ForegroundColor Gray
        exit 1
    }
} elseif ($FrontendOnly) {
    Write-Host "  Starting frontend dev server (Vite only)..." -ForegroundColor Cyan
    Write-Host "    URL: http://localhost:1420" -ForegroundColor White
    Write-Host "    Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""
    & npm run dev
} else {
    Write-Host "  Starting Tauri dev server..." -ForegroundColor Cyan
    Write-Host "    Frontend: http://localhost:1420" -ForegroundColor White
    Write-Host "    Tauri window will open automatically" -ForegroundColor White
    Write-Host "    Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""

    $srcTauri = Join-Path $projectRoot "src-tauri"
    $targetDir = Join-Path $srcTauri "target"
    if (-not (Test-Path $targetDir)) {
        Write-Host "  [INFO] First run: Rust compilation may take 3-10 min..." -ForegroundColor Yellow
        Write-Host ""
    }

    & npm run tauri dev
}
