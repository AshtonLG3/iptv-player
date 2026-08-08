param(
  [string]$SiteRoot = 'C:\Users\mangezi\mangezi.xyz\tv'
)

$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resolvedSiteRoot = (Resolve-Path -LiteralPath $SiteRoot).Path
$expectedSiteRoot = (Resolve-Path -LiteralPath 'C:\Users\mangezi\mangezi.xyz\tv').Path

if ($resolvedSiteRoot -ne $expectedSiteRoot) {
  throw "Refusing to sync outside the Rugare TV site root: $resolvedSiteRoot"
}

foreach ($file in @('app.js', 'index.html', 'style.css')) {
  Copy-Item -LiteralPath (Join-Path $sourceRoot $file) -Destination (Join-Path $resolvedSiteRoot $file) -Force
}

$sourceModules = Join-Path $sourceRoot 'src'
$siteModules = Join-Path $resolvedSiteRoot 'src'
Get-ChildItem -LiteralPath $sourceModules -Filter '*.js' -File | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $siteModules $_.Name) -Force
}

Write-Output "Synchronized Rugare TV web shell and all runtime modules to $resolvedSiteRoot"
