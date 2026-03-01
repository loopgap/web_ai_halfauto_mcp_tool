$ErrorActionPreference = "Stop"

Write-Host "[env] checking required tools..."

function Test-Tool($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($null -eq $cmd) {
    Write-Host "[env] missing: $name" -ForegroundColor Yellow
    return $false
  }
  Write-Host "[env] found: $name -> $($cmd.Source)"
  return $true
}

$okNode = Test-Tool "node"
$okNpm = Test-Tool "npm"
$okCargo = Test-Tool "cargo"
$okRustc = Test-Tool "rustc"

if (-not ($okNode -and $okNpm)) {
  Write-Host "[env] node/npm are required for frontend and governance scripts." -ForegroundColor Red
  exit 1
}

Write-Host "[env] running governance baseline checks..."
npm run env:check
npm run governance:validate
npm run governance:evidence:example

if ($okCargo -and $okRustc) {
  Write-Host "[env] rust toolchain detected." -ForegroundColor Green
} else {
  Write-Host "[env] rust toolchain missing; tauri build will be unavailable." -ForegroundColor Yellow
}

Write-Host "[env] bootstrap complete"
