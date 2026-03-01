#Requires -Version 5.1
<#
.SYNOPSIS
    AI Workbench - Automated commit workflow
.DESCRIPTION
    One-command workflow: stage -> check -> commit -> optionally push.
    Guides the user through the entire git flow.
.EXAMPLE
    .\scripts\git-commit.ps1                           # Interactive
    .\scripts\git-commit.ps1 -Type feat -Scope ui -Message "add dark mode"
    .\scripts\git-commit.ps1 -All -Push                # Stage all, push after commit
    .\scripts\git-commit.ps1 -Amend                    # Amend last commit
#>
[CmdletBinding()]
param(
    [ValidateSet("feat","fix","docs","style","refactor","test","chore","ci","perf","build")]
    [string]$Type,
    [string]$Scope,
    [string]$Message,
    [switch]$All,
    [switch]$Push,
    [switch]$Amend,
    [switch]$SkipChecks
)

$ErrorActionPreference = "Continue"

# -- PATH fix --
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

$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

Write-Host ""
Write-Host "  =============================================" -ForegroundColor Cyan
Write-Host "    AI Workbench - Git Commit Workflow" -ForegroundColor Cyan
Write-Host "  =============================================" -ForegroundColor Cyan
Write-Host ""

# -- 1. Show status --
Write-Host "  -- Current Status --" -ForegroundColor Cyan
$statusOutput = & git status --short 2>&1
if (-not $statusOutput) {
    Write-Host "  Nothing to commit (working tree clean)" -ForegroundColor Green
    exit 0
}
$statusOutput | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
Write-Host ""

# -- 2. Stage files --
if ($All) {
    Write-Host "  Staging all changes..." -ForegroundColor Cyan
    git add -A
    Write-Host "  [OK] All files staged" -ForegroundColor Green
} else {
    # Check if anything is staged
    $staged = & git diff --cached --name-only 2>&1
    if (-not $staged) {
        Write-Host "  No files staged. Stage all changes? (Y/n): " -ForegroundColor Yellow -NoNewline
        $answer = Read-Host
        if ($answer -eq "" -or $answer -eq "Y" -or $answer -eq "y") {
            git add -A
            Write-Host "  [OK] All files staged" -ForegroundColor Green
        } else {
            Write-Host "  Please stage files manually: git add <files>" -ForegroundColor Yellow
            exit 0
        }
    } else {
        Write-Host "  Staged files:" -ForegroundColor Cyan
        $staged | ForEach-Object { Write-Host "    + $_" -ForegroundColor Green }
    }
}
Write-Host ""

# -- 3. Show diff summary --
$diffStat = & git diff --cached --stat 2>&1
if ($diffStat) {
    Write-Host "  -- Changes Summary --" -ForegroundColor Cyan
    $diffStat | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    Write-Host ""
}

# -- 4. Run checks (unless skip) --
if (-not $SkipChecks -and -not $Amend) {
    Write-Host "  -- Pre-commit Checks --" -ForegroundColor Cyan
    
    # TypeScript
    Write-Host "  [1/2] TypeScript..." -ForegroundColor Gray
    $tsResult = cmd /c "npx tsc --noEmit 2>&1"
    $tsErrors = @($tsResult | Where-Object { $_ -match "error TS\d+" })
    if ($tsErrors.Count -gt 0) {
        Write-Host "  [FAIL] TypeScript: $($tsErrors.Count) error(s)" -ForegroundColor Red
        $tsErrors | Select-Object -First 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        Write-Host ""
        Write-Host "  Fix errors and retry, or use -SkipChecks to bypass." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  [OK]   TypeScript: 0 errors" -ForegroundColor Green

    # Governance
    Write-Host "  [2/2] Governance tests..." -ForegroundColor Gray
    $govResult = cmd /c "node scripts/test-governance-api-contract.mjs 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FAIL] Governance tests failed" -ForegroundColor Red
        exit 1
    }
    $govLine = $govResult | Select-Object -Last 1
    Write-Host "  [OK]   $govLine" -ForegroundColor Green
    Write-Host ""
}

# -- 5. Build commit message --
if ($Amend) {
    Write-Host "  Amending last commit..." -ForegroundColor Cyan
    git commit --amend --no-edit
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FAIL] Amend failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] Commit amended" -ForegroundColor Green
} else {
    # Interactive type selection if not provided
    if (-not $Type) {
        Write-Host "  -- Commit Type --" -ForegroundColor Cyan
        Write-Host "    1) feat     - New feature" -ForegroundColor White
        Write-Host "    2) fix      - Bug fix" -ForegroundColor White
        Write-Host "    3) docs     - Documentation" -ForegroundColor White
        Write-Host "    4) refactor - Code refactoring" -ForegroundColor White
        Write-Host "    5) style    - Code style" -ForegroundColor White
        Write-Host "    6) test     - Tests" -ForegroundColor White
        Write-Host "    7) chore    - Maintenance" -ForegroundColor White
        Write-Host "    8) ci       - CI/CD" -ForegroundColor White
        Write-Host "    9) perf     - Performance" -ForegroundColor White
        Write-Host "   10) build    - Build system" -ForegroundColor White
        Write-Host ""
        Write-Host "  Select type (1-10): " -ForegroundColor Yellow -NoNewline
        $typeNum = Read-Host
        $typeMap = @{
            "1" = "feat"; "2" = "fix"; "3" = "docs"; "4" = "refactor"; "5" = "style"
            "6" = "test"; "7" = "chore"; "8" = "ci"; "9" = "perf"; "10" = "build"
        }
        $Type = $typeMap[$typeNum]
        if (-not $Type) { $Type = "chore" }
    }

    # Scope
    if (-not $Scope) {
        Write-Host "  Scope (optional, e.g. ui/workflow/api): " -ForegroundColor Yellow -NoNewline
        $Scope = Read-Host
    }

    # Message
    if (-not $Message) {
        Write-Host "  Description: " -ForegroundColor Yellow -NoNewline
        $Message = Read-Host
        if (-not $Message) {
            Write-Host "  [FAIL] Description is required" -ForegroundColor Red
            exit 1
        }
    }

    # Build full message
    if ($Scope) {
        $fullMsg = "${Type}(${Scope}): ${Message}"
    } else {
        $fullMsg = "${Type}: ${Message}"
    }

    Write-Host ""
    Write-Host "  Commit message: $fullMsg" -ForegroundColor White
    Write-Host ""

    # Commit
    git commit -m "$fullMsg"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FAIL] Commit failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] Committed" -ForegroundColor Green
}

# -- 6. Show log --
Write-Host ""
Write-Host "  -- Recent Commits --" -ForegroundColor Cyan
git log --oneline -5 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }

# -- 7. Push if requested --
if ($Push) {
    Write-Host ""
    $remote = & git remote 2>&1
    if ($remote) {
        Write-Host "  Pushing to $remote..." -ForegroundColor Cyan
        git push
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Pushed" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] Push failed" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  [WARN] No remote configured. Skipping push." -ForegroundColor Yellow
        Write-Host "  Add remote: git remote add origin <url>" -ForegroundColor Gray
    }
}

Write-Host ""
