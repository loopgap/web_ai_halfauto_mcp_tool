#Requires -Version 5.1
<#
.SYNOPSIS
    Install git hooks into the local repository
.DESCRIPTION
    Copies hooks from .githooks/ to .git/hooks/ and sets
    git core.hooksPath so all team members use the same hooks.
.EXAMPLE
    .\scripts\install-hooks.ps1
#>

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "  Installing Git hooks..." -ForegroundColor Cyan
Write-Host ""

# Method 1: Set hooksPath (git 2.9+)
$gitVer = & git --version 2>&1
Write-Host "  Git: $gitVer" -ForegroundColor Gray

git config core.hooksPath .githooks
Write-Host "  [OK] core.hooksPath = .githooks" -ForegroundColor Green

# Ensure hooks are executable (Windows Git Bash needs this)
$hooksDir = Join-Path $projectRoot ".githooks"
$hooks = Get-ChildItem $hooksDir -File
foreach ($hook in $hooks) {
    # Try to mark as executable if already tracked (ignore errors for untracked files)
    $null = cmd /c "git update-index --chmod=+x `.githooks/$($hook.Name)` 2>nul"
    Write-Host "  [OK] $($hook.Name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Git hooks installed! They will run automatically on:" -ForegroundColor Green
Write-Host "    pre-commit  : TypeScript check + governance tests" -ForegroundColor White
Write-Host "    commit-msg  : Conventional commit format validation" -ForegroundColor White
Write-Host "    pre-push    : Full test suite (TS + Gov + Rust)" -ForegroundColor White
Write-Host "    post-commit : Changelog auto-update" -ForegroundColor White
Write-Host ""
Write-Host "  To bypass hooks: git commit --no-verify" -ForegroundColor Gray
Write-Host ""
