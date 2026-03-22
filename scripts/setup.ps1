#Requires -Version 5.1
<#
.SYNOPSIS
    AI Workbench - One-click environment setup
.DESCRIPTION
    Auto-detect, fix, and install all dev dependencies.
    Supports winget / scoop / choco / manual install.
.EXAMPLE
    .\scripts\setup.ps1          # Full setup
    .\scripts\setup.ps1 -SkipRust # Frontend only
    .\scripts\setup.ps1 -Verbose  # Verbose output
#>
[CmdletBinding()]
param(
    [switch]$SkipRust,
    [switch]$SkipPnpmInstall,
    [switch]$Force
)

function Write-Step   { param($msg) Write-Host "`n== $msg" -ForegroundColor Cyan }
function Write-Ok     { param($msg) Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn   { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err    { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Info   { param($msg) Write-Host "  [INFO] $msg" -ForegroundColor Gray }
function Write-Fix    { param($msg) Write-Host "  [FIX]  $msg" -ForegroundColor Magenta }

$script:Errors   = @()
$script:Warnings = @()
$script:Fixed    = @()

# -- PATH repair -----------------------------------------------------------
function Repair-Path {
    Write-Step "Checking PATH"
    $requiredPaths = @(
        "C:\Program Files\nodejs",
        (Join-Path $env:USERPROFILE ".cargo\bin"),
        (Join-Path $env:APPDATA "npm"),
        "C:\Program Files\PowerShell\7"
    )
    $currentPath = $env:Path
    $changed = $false
    foreach ($p in $requiredPaths) {
        if (Test-Path $p) {
            if ($currentPath -notlike "*$p*") {
                $env:Path = "$p;$env:Path"
                $changed = $true
                Write-Fix "Added to PATH: $p"
                $script:Fixed += "PATH += $p"
            }
        }
    }
    # scan extra Node paths
    $extraNodePaths = @(
        "C:\nodejs",
        "C:\Program Files (x86)\nodejs",
        (Join-Path $env:LOCALAPPDATA "Programs\nodejs")
    )
    foreach ($p in $extraNodePaths) {
        if ((Test-Path "$p\node.exe") -and ($env:Path -notlike "*$p*")) {
            $env:Path = "$p;$env:Path"
            $changed = $true
            Write-Fix "Added to PATH (alt): $p"
            $script:Fixed += "PATH += $p"
        }
    }
    if (-not $changed) { Write-Ok "PATH is fine" }
}

# -- Persist PATH to Profile -----------------------------------------------
function Save-PathToProfile {
    Write-Step "Persisting PATH fix to PowerShell Profile"

    $profilePaths = @()
    $ps5Profile = Join-Path $env:USERPROFILE "Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"
    $ps7Profile = Join-Path $env:USERPROFILE "Documents\PowerShell\Microsoft.PowerShell_profile.ps1"
    if ($PSVersionTable.PSVersion.Major -ge 7) { $profilePaths += $ps7Profile }
    $profilePaths += $ps5Profile

    $pathBlock = @'

# -- AI Workbench PATH Auto-Fix --
$__awPaths = @(
    "C:\Program Files\nodejs",
    (Join-Path $env:USERPROFILE ".cargo\bin"),
    (Join-Path $env:APPDATA "npm"),
    "C:\Program Files\PowerShell\7"
)
foreach ($__p in $__awPaths) {
    if ((Test-Path $__p) -and ($env:Path -notlike "*$__p*")) {
        $env:Path = "$__p;$env:Path"
    }
}
Remove-Variable __awPaths,__p -ErrorAction SilentlyContinue
# -- END AI Workbench PATH Auto-Fix --
'@

    foreach ($prof in $profilePaths) {
        $dir = Split-Path $prof -Parent
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        if (Test-Path $prof) {
            $content = Get-Content $prof -Raw -ErrorAction SilentlyContinue
            if ($content -like "*AI Workbench PATH Auto-Fix*") {
                Write-Ok "Profile already has PATH fix: $prof"
                continue
            }
        }
        Add-Content -Path $prof -Value $pathBlock -Encoding UTF8
        Write-Fix "Wrote PATH fix to: $prof"
        $script:Fixed += "Profile updated: $prof"
    }
}

# -- Test tool presence ----------------------------------------------------
function Test-Tool {
    param([string]$Name, [string]$DisplayName, [switch]$Required)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -ne $cmd) {
        try { $ver = & $Name --version 2>&1 | Select-Object -First 1 } catch { $ver = "unknown" }
        Write-Ok "$DisplayName : $ver ($($cmd.Source))"
        return $true
    }
    if ($Required) { Write-Err "$DisplayName : not found" }
    else           { Write-Warn "$DisplayName : not found (optional)" }
    return $false
}

# -- Package managers ------------------------------------------------------
function Get-AvailablePackageManager {
    $managers = @()
    if (Get-Command winget -ErrorAction SilentlyContinue) { $managers += "winget" }
    if (Get-Command scoop  -ErrorAction SilentlyContinue) { $managers += "scoop"  }
    if (Get-Command choco  -ErrorAction SilentlyContinue) { $managers += "choco"  }
    return $managers
}

# -- Install Node.js -------------------------------------------------------
function Install-NodeJS {
    Write-Step "Installing Node.js"
    $managers = Get-AvailablePackageManager

    if ($managers -contains "winget") {
        Write-Info "Plan A (recommended): winget ..."
        try {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Repair-Path
            if (Get-Command node -ErrorAction SilentlyContinue) {
                Write-Ok "Node.js installed (winget)"; $script:Fixed += "Node.js installed (winget)"; return $true
            }
        } catch { Write-Warn "winget failed, trying next ..." }
    }
    if ($managers -contains "scoop") {
        Write-Info "Plan B: scoop ..."
        try {
            scoop install nodejs-lts 2>&1 | Out-Null
            if (Get-Command node -ErrorAction SilentlyContinue) {
                Write-Ok "Node.js installed (scoop)"; $script:Fixed += "Node.js installed (scoop)"; return $true
            }
        } catch { Write-Warn "scoop failed, trying next ..." }
    }
    if ($managers -contains "choco") {
        Write-Info "Plan C: choco ..."
        try {
            choco install nodejs-lts -y 2>&1 | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            if (Get-Command node -ErrorAction SilentlyContinue) {
                Write-Ok "Node.js installed (choco)"; $script:Fixed += "Node.js installed (choco)"; return $true
            }
        } catch { Write-Warn "choco failed" }
    }

    Write-Err "Auto-install failed. Please install manually:"
    Write-Info "  Plan A: https://nodejs.org (download LTS installer)"
    Write-Info "  Plan B: nvm-windows: https://github.com/coreybutler/nvm-windows"
    Write-Info "  Plan C: Admin PowerShell: winget install OpenJS.NodeJS.LTS"
    Write-Info "Then re-run this script."
    $script:Errors += "Node.js not installed"
    return $false
}

# -- Install Rust -----------------------------------------------------------
function Install-Rust {
    Write-Step "Installing Rust"
    $managers = Get-AvailablePackageManager

    Write-Info "Plan A (recommended): rustup ..."
    $rustupInit = Join-Path $env:TEMP "rustup-init.exe"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $rustupInit -UseBasicParsing
        & $rustupInit -y --default-toolchain stable 2>&1 | Out-Null
        $cargoPath = Join-Path $env:USERPROFILE ".cargo\bin"
        $env:Path = "$cargoPath;$env:Path"
        if (Get-Command cargo -ErrorAction SilentlyContinue) {
            Write-Ok "Rust installed (rustup)"; $script:Fixed += "Rust installed (rustup)"; return $true
        }
    } catch { Write-Warn "rustup failed: $_" }

    if ($managers -contains "winget") {
        Write-Info "Plan B: winget ..."
        try {
            winget install Rustlang.Rustup --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
            $cargoPath = Join-Path $env:USERPROFILE ".cargo\bin"
            $env:Path = "$cargoPath;$env:Path"
            if (Get-Command cargo -ErrorAction SilentlyContinue) {
                Write-Ok "Rust installed (winget)"; $script:Fixed += "Rust installed (winget)"; return $true
            }
        } catch { Write-Warn "winget Rust failed" }
    }

    Write-Err "Auto-install Rust failed. Please install manually:"
    Write-Info "  Plan A: https://rustup.rs (download rustup-init.exe)"
    Write-Info "  Plan B: Admin PowerShell: winget install Rustlang.Rustup"
    Write-Info "Then re-run this script."
    $script:Errors += "Rust not installed"
    return $false
}

# -- Tauri CLI check --------------------------------------------------------
function Install-TauriCLI {
    Write-Step "Checking Tauri CLI"
    $tauriBin = Join-Path $PSScriptRoot "..\node_modules\.bin\tauri.cmd"
    if (Test-Path $tauriBin) {
        $ver = & cmd /c "`"$tauriBin`" --version 2>&1" | Select-Object -First 1
        Write-Ok "Tauri CLI (local): $ver"
        return $true
    }
    $globalTauri = Get-Command tauri -ErrorAction SilentlyContinue
    if ($null -ne $globalTauri) {
        $ver = & tauri --version 2>&1 | Select-Object -First 1
        Write-Ok "Tauri CLI (global): $ver"
        return $true
    }
    Write-Warn "Tauri CLI will be installed via pnpm install"
    return $true
}

# -- pnpm install -----------------------------------------------------------
function Invoke-PnpmInstall {
    Write-Step "Installing project dependencies (pnpm install)"
    $projectRoot = Split-Path $PSScriptRoot -Parent
    $nodeModules = Join-Path $projectRoot "node_modules"

    if ((Test-Path $nodeModules) -and (-not $Force)) {
        Write-Ok "node_modules already exists"
        return $true
    }

    Push-Location $projectRoot
    try {
        Write-Info "Installing ... this may take 1-3 minutes on first run."
        & pnpm install 2>&1 | ForEach-Object { Write-Verbose $_ }
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "pnpm install done"; $script:Fixed += "pnpm deps installed"; return $true
        } else {
            Write-Err "pnpm install failed (exit $LASTEXITCODE)"
            Write-Info "  Try: Remove-Item -Recurse -Force node_modules; pnpm install"
            $script:Errors += "pnpm install failed"; return $false
        }
    } finally { Pop-Location }
}

# -- WebView2 ---------------------------------------------------------------
function Test-WebView2 {
    Write-Step "Checking WebView2"
    $regPaths = @(
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEB-E15AB5810B22}",
        "HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEB-E15AB5810B22}",
        "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEB-E15AB5810B22}"
    )
    foreach ($rp in $regPaths) {
        if (Test-Path $rp) {
            try { $ver = (Get-ItemProperty $rp).pv; if ($ver) { Write-Ok "WebView2: $ver"; return $true } } catch {}
        }
    }
    Write-Warn "WebView2 may not be installed (Win11/Edge has it built-in)"
    Write-Info "  If Tauri window fails: https://developer.microsoft.com/en-us/microsoft-edge/webview2/"
    $script:Warnings += "WebView2 may need install"
    return $true
}

# -- System requirements ----------------------------------------------------
function Test-SystemRequirements {
    Write-Step "System requirements"
    $drive = (Get-Item $PSScriptRoot).PSDrive
    $freeGB = [math]::Round($drive.Free / 1GB, 1)
    if ($freeGB -lt 2) { Write-Err "Disk: ${freeGB}GB (need 2GB+)"; $script:Errors += "Low disk" }
    elseif ($freeGB -lt 5) { Write-Warn "Disk: ${freeGB}GB (5GB+ recommended)"; $script:Warnings += "Low disk" }
    else { Write-Ok "Disk: ${freeGB}GB" }

    $totalRAM = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
    if ($totalRAM -lt 4) { Write-Warn "RAM: ${totalRAM}GB (8GB+ recommended)"; $script:Warnings += "Low RAM" }
    else { Write-Ok "RAM: ${totalRAM}GB" }

    $osVer = [System.Environment]::OSVersion.Version
    Write-Ok "Windows: $($osVer.Major).$($osVer.Minor) Build $($osVer.Build)"
}

# -- C++ Build Tools --------------------------------------------------------
function Test-VCBuildTools {
    Write-Step "Checking C++ Build Tools (needed for Rust)"
    $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vsWhere) {
        $vsInstall = & $vsWhere -latest -property installationPath 2>&1
        if ($vsInstall -and (Test-Path $vsInstall)) { Write-Ok "VS/Build Tools: $vsInstall"; return $true }
    }
    $btPaths = @(
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools",
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\BuildTools",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community"
    )
    foreach ($bt in $btPaths) {
        if (Test-Path $bt) { Write-Ok "Build Tools: $bt"; return $true }
    }
    Write-Warn "C++ Build Tools not detected"
    Write-Info "  If Rust compile fails, install:"
    Write-Info "  Plan A: winget install Microsoft.VisualStudio.2022.BuildTools"
    Write-Info "  Plan B: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
    Write-Info "  Select 'Desktop development with C++' workload"
    $script:Warnings += "C++ Build Tools missing"
    return $false
}

# ========================================================================
# Main
# ========================================================================

Write-Host ""
Write-Host "  =============================================" -ForegroundColor Cyan
Write-Host "    AI Workbench - Environment Setup" -ForegroundColor Cyan
Write-Host "  =============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  This script will auto-detect and configure:" -ForegroundColor White
Write-Host "    - Node.js + pnpm" -ForegroundColor White
Write-Host "    - Rust + Cargo" -ForegroundColor White
Write-Host "    - Tauri CLI" -ForegroundColor White
Write-Host "    - WebView2 runtime" -ForegroundColor White
Write-Host "    - PATH environment variable" -ForegroundColor White

# 1. System
Test-SystemRequirements
# 2. PATH
Repair-Path
# 3. Node
Write-Step "Checking Node.js"
$hasNode = Test-Tool "node" "Node.js" -Required
if (-not $hasNode) { $hasNode = Install-NodeJS }
# 4. pnpm
if ($hasNode) {
    Write-Step "Checking pnpm"
    $hasPnpm = Test-Tool "pnpm" "pnpm" -Required
    if (-not $hasPnpm) { Write-Warn "Install pnpm first (recommend: corepack enable)"; $script:Errors += "pnpm not found" }
}
# 5. Rust
if (-not $SkipRust) {
    Write-Step "Checking Rust"
    $hasCargo = Test-Tool "cargo" "Cargo" -Required
    $hasRustc = Test-Tool "rustc" "rustc" -Required
    if (-not ($hasCargo -and $hasRustc)) { Install-Rust | Out-Null }
    Test-VCBuildTools | Out-Null
} else { Write-Info "Skipping Rust (-SkipRust)" }
# 6. WebView2
Test-WebView2 | Out-Null
# 7. pnpm install
if ($hasNode -and (-not $SkipPnpmInstall)) { Invoke-PnpmInstall | Out-Null }
# 8. Tauri CLI
if ($hasNode) { Install-TauriCLI | Out-Null }
# 9. Persist PATH
Save-PathToProfile

# -- Summary ----------------------------------------------------------------
Write-Host ""
Write-Host "  =============================================" -ForegroundColor Cyan
Write-Host "    Setup Summary" -ForegroundColor Cyan
Write-Host "  =============================================" -ForegroundColor Cyan

if ($script:Fixed.Count -gt 0) {
    Write-Host "  Auto-fixed:" -ForegroundColor Green
    foreach ($f in $script:Fixed) { Write-Host "    - $f" -ForegroundColor Green }
}
if ($script:Warnings.Count -gt 0) {
    Write-Host "  Warnings:" -ForegroundColor Yellow
    foreach ($w in $script:Warnings) { Write-Host "    - $w" -ForegroundColor Yellow }
}
if ($script:Errors.Count -gt 0) {
    Write-Host "  Errors:" -ForegroundColor Red
    foreach ($e in $script:Errors) { Write-Host "    - $e" -ForegroundColor Red }
    Write-Host ""
    Write-Err "Setup incomplete. Fix errors above and re-run."
    exit 1
} else {
    Write-Host ""
    Write-Ok "Setup complete! Ready to develop."
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor White
    Write-Host "    .\scripts\dev.ps1       # Start dev server" -ForegroundColor White
    Write-Host "    .\scripts\doctor.ps1    # Run diagnostics" -ForegroundColor White
    Write-Host "    .\start.bat             # Double-click launcher" -ForegroundColor White
    exit 0
}
