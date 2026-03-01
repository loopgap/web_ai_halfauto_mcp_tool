#Requires -Version 5.1
<#
.SYNOPSIS
    AI Workbench - Release workflow
.DESCRIPTION
    Automates the release process:
    1. Run full test suite
    2. Bump version in package.json + Cargo.toml
    3. Generate changelog
    4. Create release commit + tag
.EXAMPLE
    .\scripts\release.ps1 -Version 0.2.0
    .\scripts\release.ps1 -Bump patch      # 0.1.0 -> 0.1.1
    .\scripts\release.ps1 -Bump minor      # 0.1.0 -> 0.2.0
    .\scripts\release.ps1 -Bump major      # 0.1.0 -> 1.0.0
#>
[CmdletBinding()]
param(
    [string]$Version,
    [ValidateSet("major","minor","patch")]
    [string]$Bump
)

$ErrorActionPreference = "Stop"

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
Write-Host "    AI Workbench - Release Workflow" -ForegroundColor Cyan
Write-Host "  =============================================" -ForegroundColor Cyan
Write-Host ""

# -- 1. Determine version --
$pkgJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$currentVersion = $pkgJson.version
Write-Host "  Current version: $currentVersion" -ForegroundColor White

if (-not $Version -and -not $Bump) {
    Write-Host ""
    Write-Host "  Select bump type:" -ForegroundColor Yellow
    Write-Host "    1) patch  ($currentVersion -> ?)" -ForegroundColor White
    Write-Host "    2) minor" -ForegroundColor White
    Write-Host "    3) major" -ForegroundColor White
    Write-Host "  Choice (1-3): " -ForegroundColor Yellow -NoNewline
    $choice = Read-Host
    switch ($choice) {
        "1" { $Bump = "patch" }
        "2" { $Bump = "minor" }
        "3" { $Bump = "major" }
        default { $Bump = "patch" }
    }
}

if ($Bump) {
    $parts = $currentVersion.Split(".")
    switch ($Bump) {
        "major" { $parts[0] = [string]([int]$parts[0] + 1); $parts[1] = "0"; $parts[2] = "0" }
        "minor" { $parts[1] = [string]([int]$parts[1] + 1); $parts[2] = "0" }
        "patch" { $parts[2] = [string]([int]$parts[2] + 1) }
    }
    $Version = $parts -join "."
}

Write-Host "  New version: $Version" -ForegroundColor Green
Write-Host ""

# -- 2. Check working tree --
$dirty = & git status --porcelain 2>&1
if ($dirty) {
    Write-Host "  [WARN] Working tree has uncommitted changes." -ForegroundColor Yellow
    Write-Host "  Commit or stash them first." -ForegroundColor Yellow
    Write-Host ""
    $dirty | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    Write-Host ""
    Write-Host "  Continue anyway? (y/N): " -ForegroundColor Yellow -NoNewline
    $answer = Read-Host
    if ($answer -ne "y" -and $answer -ne "Y") { exit 0 }
}

# -- 3. Run full test suite --
Write-Host "  -- Running Tests --" -ForegroundColor Cyan

Write-Host "  [1/3] TypeScript..." -ForegroundColor Gray
$tsResult = cmd /c "npx tsc --noEmit 2>&1"
$tsErrors = @($tsResult | Where-Object { $_ -match "error TS\d+" })
if ($tsErrors.Count -gt 0) {
    Write-Host "  [FAIL] TypeScript: $($tsErrors.Count) errors" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK]   TypeScript: 0 errors" -ForegroundColor Green

Write-Host "  [2/3] Governance..." -ForegroundColor Gray
cmd /c "node scripts/test-governance-api-contract.mjs 2>&1" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAIL] Governance tests" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK]   Governance tests" -ForegroundColor Green

Write-Host "  [3/3] Rust..." -ForegroundColor Gray
cmd /c "cargo test --manifest-path src-tauri/Cargo.toml 2>&1" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAIL] Rust tests" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK]   Rust tests" -ForegroundColor Green
Write-Host ""

# -- 4. Bump version in package.json --
Write-Host "  Bumping version..." -ForegroundColor Cyan
$pkgContent = Get-Content "package.json" -Raw
$pkgContent = $pkgContent -replace "`"version`": `"$currentVersion`"", "`"version`": `"$Version`""
$pkgContent | Set-Content "package.json" -Encoding UTF8 -NoNewline
Write-Host "  [OK] package.json: $currentVersion -> $Version" -ForegroundColor Green

# -- 5. Bump version in Cargo.toml --
$cargoToml = "src-tauri\Cargo.toml"
if (Test-Path $cargoToml) {
    $cargoContent = Get-Content $cargoToml -Raw
    # Match the first version = "x.y.z" in [package] section
    if ($cargoContent -match 'version = "([^"]+)"') {
        $cargoVersion = $Matches[1]
        $cargoContent = $cargoContent -replace "version = `"$cargoVersion`"", "version = `"$Version`""
        $cargoContent | Set-Content $cargoToml -Encoding UTF8 -NoNewline
        Write-Host "  [OK] Cargo.toml: $cargoVersion -> $Version" -ForegroundColor Green
    }
}

# -- 6. Bump version in tauri.conf.json --
$tauriConf = "src-tauri\tauri.conf.json"
if (Test-Path $tauriConf) {
    $tauriContent = Get-Content $tauriConf -Raw
    if ($tauriContent -match '"version": "([^"]+)"') {
        $tauriVersion = $Matches[1]
        $tauriContent = $tauriContent -replace "`"version`": `"$tauriVersion`"", "`"version`": `"$Version`""
        $tauriContent | Set-Content $tauriConf -Encoding UTF8 -NoNewline
        Write-Host "  [OK] tauri.conf.json: $tauriVersion -> $Version" -ForegroundColor Green
    }
}

# -- 7. Generate changelog --
Write-Host ""
Write-Host "  Generating changelog..." -ForegroundColor Cyan
$changelogFile = "CHANGELOG.md"
$date = Get-Date -Format "yyyy-MM-dd"

# Get commits since last tag
$lastTag = & git describe --tags --abbrev=0 2>&1
if ($LASTEXITCODE -ne 0) {
    $commits = & git log --oneline 2>&1
} else {
    $commits = & git log --oneline "$lastTag..HEAD" 2>&1
}

$changelogEntry = @()
$changelogEntry += ""
$changelogEntry += "## [$Version] - $date"
$changelogEntry += ""

$feats = @(); $fixes = @(); $others = @()
foreach ($c in $commits) {
    if ($c -match "^[a-f0-9]+ feat") { $feats += $c }
    elseif ($c -match "^[a-f0-9]+ fix") { $fixes += $c }
    else { $others += $c }
}

if ($feats.Count -gt 0) {
    $changelogEntry += "### Added"
    foreach ($f in $feats) { $changelogEntry += "- $f" }
    $changelogEntry += ""
}
if ($fixes.Count -gt 0) {
    $changelogEntry += "### Fixed"
    foreach ($f in $fixes) { $changelogEntry += "- $f" }
    $changelogEntry += ""
}
if ($others.Count -gt 0) {
    $changelogEntry += "### Other"
    foreach ($o in $others) { $changelogEntry += "- $o" }
    $changelogEntry += ""
}

if (Test-Path $changelogFile) {
    $existingContent = Get-Content $changelogFile -Raw
    $header = "# Changelog`n`nAll notable changes to AI Workbench.`n"
    $body = $existingContent -replace "^# Changelog.*?`n`n", ""
    $newContent = $header + ($changelogEntry -join "`n") + "`n" + $body
} else {
    $newContent = "# Changelog`n`nAll notable changes to AI Workbench.`n" + ($changelogEntry -join "`n")
}
$newContent | Set-Content $changelogFile -Encoding UTF8
Write-Host "  [OK] CHANGELOG.md updated" -ForegroundColor Green

# -- 8. Commit and tag --
Write-Host ""
Write-Host "  Creating release commit..." -ForegroundColor Cyan
git add -A
git commit -m "build(release): v$Version" --no-verify
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAIL] Commit failed" -ForegroundColor Red
    exit 1
}

git tag -a "v$Version" -m "Release v$Version"
Write-Host "  [OK] Tagged: v$Version" -ForegroundColor Green

Write-Host ""
Write-Host "  =============================================" -ForegroundColor Green
Write-Host "    Release v$Version complete!" -ForegroundColor Green
Write-Host "  =============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  To push: git push && git push --tags" -ForegroundColor White
Write-Host ""
