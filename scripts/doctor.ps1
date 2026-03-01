#Requires -Version 5.1
<#
.SYNOPSIS
    AI Workbench Doctor - Environment diagnostic tool
.DESCRIPTION
    Comprehensive check of the dev environment.
    Similar to "flutter doctor" experience.
.EXAMPLE
    .\scripts\doctor.ps1           # Full diagnosis
    .\scripts\doctor.ps1 -Fix      # Diagnose and auto-fix
    .\scripts\doctor.ps1 -Report   # Generate report file
#>
[CmdletBinding()]
param(
    [switch]$Fix,
    [switch]$Report
)

$ErrorActionPreference = "Continue"

$script:Results = @()
$script:TotalChecks = 0
$script:PassedChecks = 0
$script:WarningChecks = 0
$script:FailedChecks = 0

function Add-CheckResult {
    param(
        [string]$Category,
        [string]$Name,
        [ValidateSet("Pass","Warn","Fail")]
        [string]$Status,
        [string]$Detail,
        [string]$Solution = ""
    )
    switch ($Status) {
        "Pass" { $icon = "[OK]  "; $script:PassedChecks++ }
        "Warn" { $icon = "[WARN]"; $script:WarningChecks++ }
        "Fail" { $icon = "[FAIL]"; $script:FailedChecks++ }
    }
    $script:TotalChecks++
    $script:Results += [PSCustomObject]@{
        Category = $Category
        Name     = $Name
        Status   = $Status
        Icon     = $icon
        Detail   = $Detail
        Solution = $Solution
    }
    $color = switch ($Status) { "Pass" { "Green" } "Warn" { "Yellow" } "Fail" { "Red" } }
    Write-Host "  $icon $Name : $Detail" -ForegroundColor $color
    if ($Solution -and $Status -ne "Pass") {
        Write-Host "         -> $Solution" -ForegroundColor Gray
    }
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

# == Checks ================================================================

function Check-OS {
    Write-Host ""
    Write-Host "  -- System --" -ForegroundColor Cyan

    $osVer = [System.Environment]::OSVersion.Version
    $osName = (Get-CimInstance Win32_OperatingSystem).Caption
    Add-CheckResult "System" "OS" "Pass" "$osName (Build $($osVer.Build))"

    $arch = if ([System.Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    Add-CheckResult "System" "Arch" "Pass" "$arch"

    $projectRoot = Split-Path $PSScriptRoot -Parent
    $drive = (Get-Item $projectRoot).PSDrive
    $freeGB = [math]::Round($drive.Free / 1GB, 1)
    if ($freeGB -lt 2) {
        Add-CheckResult "System" "Disk" "Fail" "${freeGB}GB free" "Need at least 2GB"
    } elseif ($freeGB -lt 5) {
        Add-CheckResult "System" "Disk" "Warn" "${freeGB}GB free (5GB+ recommended)" "Consider cleaning up"
    } else {
        Add-CheckResult "System" "Disk" "Pass" "${freeGB}GB free"
    }

    $totalRAM = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
    if ($totalRAM -lt 4) {
        Add-CheckResult "System" "RAM" "Warn" "${totalRAM}GB (8GB+ recommended)" "Close unnecessary apps"
    } else {
        Add-CheckResult "System" "RAM" "Pass" "${totalRAM}GB"
    }

    $psVer = $PSVersionTable.PSVersion
    if ($psVer.Major -ge 7) {
        Add-CheckResult "System" "PowerShell" "Pass" "$psVer (pwsh 7+)"
    } elseif ($psVer.Major -ge 5) {
        Add-CheckResult "System" "PowerShell" "Warn" "$psVer (7+ recommended)" "winget install Microsoft.PowerShell"
    } else {
        Add-CheckResult "System" "PowerShell" "Fail" "$psVer (too old)" "winget install Microsoft.PowerShell"
    }
}

function Check-Tools {
    Write-Host ""
    Write-Host "  -- Dev Tools --" -ForegroundColor Cyan

    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        $nodeVer = (& node --version 2>&1).ToString().Trim()
        $nodeMajor = 0
        if ($nodeVer -match 'v(\d+)') { $nodeMajor = [int]$Matches[1] }
        if ($nodeMajor -ge 18) {
            Add-CheckResult "Tools" "Node.js" "Pass" "$nodeVer ($($node.Source))"
        } else {
            Add-CheckResult "Tools" "Node.js" "Warn" "$nodeVer (v18+ recommended)" "winget install OpenJS.NodeJS.LTS"
        }
    } else {
        Add-CheckResult "Tools" "Node.js" "Fail" "not found" "Run .\scripts\setup.ps1 or visit https://nodejs.org"
    }

    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if ($npm) {
        $npmVer = (& npm --version 2>&1).ToString().Trim()
        Add-CheckResult "Tools" "npm" "Pass" "v$npmVer ($($npm.Source))"
    } else {
        Add-CheckResult "Tools" "npm" "Fail" "not found" "Comes with Node.js. Check PATH if Node is installed"
    }

    $cargo = Get-Command cargo -ErrorAction SilentlyContinue
    if ($cargo) {
        $cargoVer = (& cargo --version 2>&1).ToString().Trim()
        Add-CheckResult "Tools" "Cargo" "Pass" "$cargoVer"
    } else {
        Add-CheckResult "Tools" "Cargo" "Fail" "not found" "Run .\scripts\setup.ps1 or visit https://rustup.rs"
    }

    $rustc = Get-Command rustc -ErrorAction SilentlyContinue
    if ($rustc) {
        $rustcVer = (& rustc --version 2>&1).ToString().Trim()
        Add-CheckResult "Tools" "rustc" "Pass" "$rustcVer"
    } else {
        Add-CheckResult "Tools" "rustc" "Fail" "not found" "Run .\scripts\setup.ps1 or visit https://rustup.rs"
    }

    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) {
        $gitVer = (& git --version 2>&1).ToString().Trim()
        Add-CheckResult "Tools" "Git" "Pass" "$gitVer"
    } else {
        Add-CheckResult "Tools" "Git" "Warn" "not found (optional)" "winget install Git.Git"
    }
}

function Check-Path {
    Write-Host ""
    Write-Host "  -- PATH --" -ForegroundColor Cyan

    $checkPaths = @(
        @{ Name = "Node.js";      Dir = "C:\Program Files\nodejs" },
        @{ Name = "Cargo";        Dir = (Join-Path $env:USERPROFILE ".cargo\bin") },
        @{ Name = "npm global";   Dir = (Join-Path $env:APPDATA "npm") },
        @{ Name = "PowerShell 7"; Dir = "C:\Program Files\PowerShell\7" }
    )

    foreach ($item in $checkPaths) {
        $dir = $item.Dir
        if (Test-Path $dir) {
            if ($env:Path -like "*$dir*") {
                Add-CheckResult "PATH" "$($item.Name) path" "Pass" "in PATH: $dir"
            } else {
                if ($Fix) {
                    $env:Path = "$dir;$env:Path"
                    Add-CheckResult "PATH" "$($item.Name) path" "Pass" "auto-fixed: $dir"
                } else {
                    Add-CheckResult "PATH" "$($item.Name) path" "Warn" "dir exists but not in PATH" "Run doctor.ps1 -Fix"
                }
            }
        } else {
            Add-CheckResult "PATH" "$($item.Name) path" "Warn" "dir not found: $dir" "Tool may not be installed"
        }
    }

    $profilePath = $PROFILE
    if (Test-Path $profilePath) {
        $content = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
        if ($content -like "*AI Workbench PATH Auto-Fix*") {
            Add-CheckResult "PATH" "Profile auto-fix" "Pass" "configured"
        } else {
            Add-CheckResult "PATH" "Profile auto-fix" "Warn" "not configured in profile" "Run .\scripts\setup.ps1 to add"
        }
    } else {
        Add-CheckResult "PATH" "Profile auto-fix" "Warn" "Profile does not exist" "Run .\scripts\setup.ps1 to create"
    }
}

function Check-Project {
    Write-Host ""
    Write-Host "  -- Project --" -ForegroundColor Cyan

    $projectRoot = Split-Path $PSScriptRoot -Parent

    $pkgJson = Join-Path $projectRoot "package.json"
    if (Test-Path $pkgJson) {
        $pkg = Get-Content $pkgJson -Raw | ConvertFrom-Json
        Add-CheckResult "Project" "package.json" "Pass" "v$($pkg.version) ($($pkg.name))"
    } else {
        Add-CheckResult "Project" "package.json" "Fail" "not found" "Make sure you run from project root"
    }

    $nodeModules = Join-Path $projectRoot "node_modules"
    if (Test-Path $nodeModules) {
        $modCount = (Get-ChildItem $nodeModules -Directory | Measure-Object).Count
        Add-CheckResult "Project" "node_modules" "Pass" "$modCount modules installed"
    } else {
        if ($Fix) {
            Write-Host "     Installing dependencies..." -ForegroundColor Cyan
            Push-Location $projectRoot
            & npm install 2>&1 | Out-Null
            Pop-Location
            if (Test-Path $nodeModules) {
                Add-CheckResult "Project" "node_modules" "Pass" "auto-installed"
            } else {
                Add-CheckResult "Project" "node_modules" "Fail" "install failed" "Run npm install manually"
            }
        } else {
            Add-CheckResult "Project" "node_modules" "Fail" "not installed" "Run npm install or .\scripts\dev.ps1"
        }
    }

    $tauriBin = Join-Path $projectRoot "node_modules\.bin\tauri.cmd"
    if (Test-Path $tauriBin) {
        $tauriVer = (& cmd /c "`"$tauriBin`" --version 2>&1").ToString().Trim()
        Add-CheckResult "Project" "Tauri CLI" "Pass" "v$tauriVer (local)"
    } else {
        Add-CheckResult "Project" "Tauri CLI" "Warn" "not installed" "Run npm install"
    }

    $srcTauri = Join-Path $projectRoot "src-tauri"
    if (Test-Path $srcTauri) {
        $cargoToml = Join-Path $srcTauri "Cargo.toml"
        if (Test-Path $cargoToml) {
            Add-CheckResult "Project" "Rust backend" "Pass" "src-tauri/Cargo.toml exists"
        } else {
            Add-CheckResult "Project" "Rust backend" "Fail" "Cargo.toml missing"
        }
    } else {
        Add-CheckResult "Project" "Rust backend" "Fail" "src-tauri dir not found"
    }

    $tscBin = Join-Path $projectRoot "node_modules\.bin\tsc.cmd"
    if (Test-Path $tscBin) {
        Write-Host "     Checking TypeScript..." -ForegroundColor Gray
        Push-Location $projectRoot
        $tscOutput = & cmd /c "`"$tscBin`" --noEmit 2>&1"
        Pop-Location
        $errorLines = @($tscOutput | Where-Object { $_ -match "error TS\d+" })
        if ($errorLines.Count -eq 0) {
            Add-CheckResult "Project" "TypeScript" "Pass" "0 errors"
        } else {
            Add-CheckResult "Project" "TypeScript" "Warn" "$($errorLines.Count) error(s)" "Run: npx tsc --noEmit"
        }
    }
}

function Check-Runtime {
    Write-Host ""
    Write-Host "  -- Runtime --" -ForegroundColor Cyan

    $regPaths = @(
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEB-E15AB5810B22}",
        "HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEB-E15AB5810B22}",
        "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEB-E15AB5810B22}"
    )

    $wv2Found = $false
    foreach ($rp in $regPaths) {
        if (Test-Path $rp) {
            try {
                $ver = (Get-ItemProperty $rp).pv
                if ($ver) {
                    Add-CheckResult "Runtime" "WebView2" "Pass" "v$ver"
                    $wv2Found = $true
                    break
                }
            } catch {}
        }
    }
    if (-not $wv2Found) {
        Add-CheckResult "Runtime" "WebView2" "Warn" "not detected (Win11/Edge built-in)" "https://developer.microsoft.com/en-us/microsoft-edge/webview2/"
    }

    $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vsWhere) {
        $vsName = & $vsWhere -latest -property displayName 2>&1
        if ($vsName) {
            Add-CheckResult "Runtime" "C++ Build Tools" "Pass" "$vsName"
        } else {
            Add-CheckResult "Runtime" "C++ Build Tools" "Warn" "not detected" "winget install Microsoft.VisualStudio.2022.BuildTools"
        }
    } else {
        $btPaths = @(
            "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools",
            "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community"
        )
        $found = $false
        foreach ($bt in $btPaths) {
            if (Test-Path $bt) {
                Add-CheckResult "Runtime" "C++ Build Tools" "Pass" "$bt"
                $found = $true
                break
            }
        }
        if (-not $found) {
            Add-CheckResult "Runtime" "C++ Build Tools" "Warn" "not detected (needed for Rust)" "winget install Microsoft.VisualStudio.2022.BuildTools"
        }
    }
}

function Check-Ports {
    Write-Host ""
    Write-Host "  -- Ports --" -ForegroundColor Cyan

    $ports = @(
        @{ Port = 1420; Name = "Vite dev server" },
        @{ Port = 1421; Name = "Tauri HMR" }
    )

    foreach ($p in $ports) {
        $conn = Get-NetTCPConnection -LocalPort $p.Port -ErrorAction SilentlyContinue
        if ($conn) {
            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            Add-CheckResult "Ports" "$($p.Name) (:$($p.Port))" "Warn" "in use (PID:$($conn.OwningProcess) $($proc.ProcessName))" "Stop the process or change port"
        } else {
            Add-CheckResult "Ports" "$($p.Name) (:$($p.Port))" "Pass" "available"
        }
    }
}

# == Main ==================================================================

Write-Host ""
Write-Host "  =============================================" -ForegroundColor Cyan
Write-Host "    AI Workbench Doctor" -ForegroundColor Cyan
Write-Host "  =============================================" -ForegroundColor Cyan

Quick-PathFix

Check-OS
Check-Tools
Check-Path
Check-Project
Check-Runtime
Check-Ports

# -- Summary ---------------------------------------------------------------
Write-Host ""
Write-Host "  =============================================" -ForegroundColor Cyan
if ($script:FailedChecks -gt 0) {
    $summaryColor = "Red"
    $summaryIcon = "[FAIL]"
} elseif ($script:WarningChecks -gt 0) {
    $summaryColor = "Yellow"
    $summaryIcon = "[WARN]"
} else {
    $summaryColor = "Green"
    $summaryIcon = "[ OK ]"
}
Write-Host "  $summaryIcon Result: $($script:PassedChecks)/$($script:TotalChecks) passed, $($script:WarningChecks) warnings, $($script:FailedChecks) failed" -ForegroundColor $summaryColor

if ($script:FailedChecks -gt 0) {
    Write-Host ""
    Write-Host "  $($script:FailedChecks) issue(s) must be fixed." -ForegroundColor Red
    if (-not $Fix) {
        Write-Host "  Run: .\scripts\doctor.ps1 -Fix    (auto-fix)" -ForegroundColor Yellow
        Write-Host "  Run: .\scripts\setup.ps1          (full setup)" -ForegroundColor Yellow
    }
}

if ($script:WarningChecks -gt 0 -and $script:FailedChecks -eq 0) {
    Write-Host ""
    Write-Host "  $($script:WarningChecks) suggestion(s) (non-blocking)." -ForegroundColor Yellow
}

if ($script:FailedChecks -eq 0 -and $script:WarningChecks -eq 0) {
    Write-Host ""
    Write-Host "  All clear! Ready to develop." -ForegroundColor Green
    Write-Host "  Run: .\scripts\dev.ps1" -ForegroundColor White
}

# -- Report ----------------------------------------------------------------
if ($Report) {
    $projectRoot = Split-Path $PSScriptRoot -Parent
    $reportFile = Join-Path $projectRoot "doctor-report.txt"
    $reportLines = @()
    $reportLines += "AI Workbench Doctor Report"
    $reportLines += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $reportLines += "Computer : $env:COMPUTERNAME"
    $reportLines += "User     : $env:USERNAME"
    $reportLines += ("=" * 60)
    $reportLines += ""

    $currentCat = ""
    foreach ($r in $script:Results) {
        if ($r.Category -ne $currentCat) {
            $reportLines += ""
            $reportLines += "-- $($r.Category) --"
            $currentCat = $r.Category
        }
        $statusStr = switch ($r.Status) { "Pass" { "[OK]  " } "Warn" { "[WARN]" } "Fail" { "[FAIL]" } }
        $reportLines += "  $statusStr $($r.Name): $($r.Detail)"
        if ($r.Solution -and $r.Status -ne "Pass") {
            $reportLines += "         Solution: $($r.Solution)"
        }
    }
    $reportLines += ""
    $reportLines += ("=" * 60)
    $reportLines += "Summary: $($script:PassedChecks)/$($script:TotalChecks) passed, $($script:WarningChecks) warnings, $($script:FailedChecks) failed"

    $reportLines | Out-File -FilePath $reportFile -Encoding UTF8
    Write-Host ""
    Write-Host "  Report saved: $reportFile" -ForegroundColor Cyan
}

Write-Host ""
