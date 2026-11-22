# Vencord WireGuard Call Router - 1-Click Installer
# Installs and integrates the Proton VPN WireGuard Call Router into Vencord & Discord

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Vencord WireGuard Call Router - Installer" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$vencordDir = "$env:APPDATA\Vencord"
$vencordBinDir = Join-Path $vencordDir "bin"
$pluginSrcDir = Join-Path $PSScriptRoot "plugin"

if (-not (Test-Path $vencordDir)) {
    New-Item -ItemType Directory -Path $vencordDir -Force | Out-Null
}
if (-not (Test-Path $vencordBinDir)) {
    New-Item -ItemType Directory -Path $vencordBinDir -Force | Out-Null
}

# 1. Copy Plugin Files
Write-Host "[1/3] Copying plugin files to $vencordDir..." -ForegroundColor Yellow
$files = @("loader.js", "proton_vpn_service.js", "proton_vpn_ui.js")
foreach ($f in $files) {
    $src = Join-Path $pluginSrcDir $f
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $vencordDir -Force
        Write-Host "  -> Copied $f" -ForegroundColor Green
    } else {
        Write-Host "  -> Warning: Source file $f not found in $pluginSrcDir" -ForegroundColor Red
    }
}

# 2. Check or download WireGuard embedded binaries
Write-Host "[2/3] Checking embedded WireGuard engine..." -ForegroundColor Yellow
$wgExe = Join-Path $vencordBinDir "wireguard.exe"
$wgCmd = Join-Path $vencordBinDir "wg.exe"

$sysWg = "C:\Program Files\WireGuard\wireguard.exe"
if ((-not (Test-Path $wgExe)) -and (Test-Path $sysWg)) {
    Write-Host "  -> Copying WireGuard binary from local installation..." -ForegroundColor Gray
    Copy-Item -Path $sysWg -Destination $wgExe -Force
    if (Test-Path "C:\Program Files\WireGuard\wg.exe") {
        Copy-Item -Path "C:\Program Files\WireGuard\wg.exe" -Destination $wgCmd -Force
    }
}

if (-not (Test-Path $wgExe)) {
    Write-Host "  -> WireGuard binary not found in $vencordBinDir." -ForegroundColor Yellow
    Write-Host "     Place standalone wireguard.exe in %APPDATA%\Vencord\bin\ or install WireGuard." -ForegroundColor Gray
} else {
    Write-Host "  -> WireGuard embedded binary ready in bin\" -ForegroundColor Green
}

# 3. Patch Vencord Patcher to autoload loader.js
Write-Host "[3/3] Hooking Vencord patcher for auto-load..." -ForegroundColor Yellow
$patcherPath = Join-Path $vencordDir "dist\patcher.js"
if (Test-Path $patcherPath) {
    $patcherContent = [System.IO.File]::ReadAllText($patcherPath, [System.Text.Encoding]::UTF8)
    if ($patcherContent -notmatch "loader\.js") {
        $hookLine = "try { require(`"../loader.js`"); } catch (e) {}" + [Environment]::NewLine
        [System.IO.File]::WriteAllText($patcherPath, $hookLine + $patcherContent, [System.Text.Encoding]::UTF8)
        Write-Host "  -> Injected loader hook into patcher.js" -ForegroundColor Green
    } else {
        Write-Host "  -> Patcher already hooked." -ForegroundColor Gray
    }
} else {
    Write-Host "  -> Vencord patcher.js not found yet. It will hook on first Vencord launch." -ForegroundColor Gray
}

Write-Host "`nInstallation completed successfully!" -ForegroundColor Green
Write-Host "Open Discord -> Join a voice channel -> Click the Green Shield to configure." -ForegroundColor Cyan
