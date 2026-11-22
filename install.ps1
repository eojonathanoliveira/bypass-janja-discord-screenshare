# Bypass Janja Discord Screenshare - Instalador Vencord
# Instala e integra o Roteador de Chamadas WireGuard diretamente na pasta base do Vencord

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Bypass Janja Discord Screenshare - Instalador Vencord  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$vencordDir = "$env:APPDATA\Vencord"
$vencordBinDir = Join-Path $vencordDir "bin"
$vencordAssetsDir = Join-Path $vencordDir "assets"
$vencordDistDir = Join-Path $vencordDir "dist"
$currentDir = $PSScriptRoot

if (-not (Test-Path $vencordDir)) {
    New-Item -ItemType Directory -Path $vencordDir -Force | Out-Null
}
if (-not (Test-Path $vencordBinDir)) {
    New-Item -ItemType Directory -Path $vencordBinDir -Force | Out-Null
}
if (-not (Test-Path $vencordAssetsDir)) {
    New-Item -ItemType Directory -Path $vencordAssetsDir -Force | Out-Null
}

# 1. Verificar dependência do WireGuard (ou instalar via winget)
Write-Host "[1/3] Verificando dependencia do WireGuard..." -ForegroundColor Yellow
$sysWg = "C:\Program Files\WireGuard\wireguard.exe"
$wgExe = Join-Path $vencordBinDir "wireguard.exe"
$hasWg = (Test-Path $wgExe) -or (Test-Path $sysWg) -or (Get-Command "wireguard.exe" -ErrorAction SilentlyContinue)

if (-not $hasWg) {
    Write-Host "  -> WireGuard nao encontrado. Instalando automaticamente via winget..." -ForegroundColor Cyan
    try {
        winget install WireGuard.WireGuard --accept-package-agreements --accept-source-agreements --silent
        Start-Sleep -Seconds 3
    } catch {
        Write-Host "  -> Aviso: winget falhou ou nao esta disponivel. Se necessario, instale com:" -ForegroundColor Red
        Write-Host "     winget install WireGuard.WireGuard" -ForegroundColor White
    }
}

if (Test-Path $sysWg) {
    if (-not (Test-Path $wgExe)) {
        Copy-Item -Path $sysWg -Destination $wgExe -Force
        Write-Host "  -> Binario WireGuard standalone copiado para bin\" -ForegroundColor Green
    }
    if ((Test-Path "C:\Program Files\WireGuard\wg.exe") -and (-not (Test-Path (Join-Path $vencordBinDir "wg.exe")))) {
        Copy-Item -Path "C:\Program Files\WireGuard\wg.exe" -Destination (Join-Path $vencordBinDir "wg.exe") -Force
    }
}

# Se os binários já vieram no pacote local
if (Test-Path (Join-Path $currentDir "bin\wireguard.exe")) {
    Copy-Item -Path (Join-Path $currentDir "bin\*") -Destination $vencordBinDir -Recurse -Force
    Write-Host "  -> Motor WireGuard standalone pronto em bin\" -ForegroundColor Green
}

# 2. Copiar arquivos base do plugin diretamente para a raiz do Vencord
Write-Host "[2/3] Copiando arquivos para $vencordDir..." -ForegroundColor Yellow
$baseFiles = @("loader.js", "proton_vpn_service.js", "proton_vpn_ui.js", "proton_vpn.example.conf", "version.json")
foreach ($f in $baseFiles) {
    $src = Join-Path $currentDir $f
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $vencordDir -Force
        Write-Host "  -> Copiado: $f" -ForegroundColor Green
    }
}

# Copiar assets
$assetSrc = Join-Path $currentDir "assets"
if (Test-Path $assetSrc) {
    Copy-Item -Path (Join-Path $assetSrc "*") -Destination $vencordAssetsDir -Recurse -Force
    Write-Host "  -> Copiado: assets\janja_burra.webp" -ForegroundColor Green
}

# 3. Vincular o carregador ao patcher.js do Vencord
Write-Host "[3/3] Vinculando carregador automatico no patcher do Vencord..." -ForegroundColor Yellow
$patcherPath = Join-Path $vencordDistDir "patcher.js"

if (Test-Path (Join-Path $currentDir "dist\patcher.js")) {
    Copy-Item -Path (Join-Path $currentDir "dist\patcher.js") -Destination $patcherPath -Force
    Write-Host "  -> patcher.js atualizado com sucesso!" -ForegroundColor Green
} elseif (Test-Path $patcherPath) {
    $patcherContent = [System.IO.File]::ReadAllText($patcherPath, [System.Text.Encoding]::UTF8)
    if ($patcherContent -notmatch "loader\.js") {
        $hookLine = "try { require(`"../loader.js`"); } catch (e) {}" + [Environment]::NewLine
        [System.IO.File]::WriteAllText($patcherPath, $hookLine + $patcherContent, [System.Text.Encoding]::UTF8)
        Write-Host "  -> Gancho injetado no patcher.js com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "  -> Patcher ja estava configurado." -ForegroundColor Gray
    }
} else {
    Write-Host "  -> Pasta dist\patcher.js ainda nao existia. Criando gancho inicial..." -ForegroundColor Gray
    New-Item -ItemType Directory -Path $vencordDistDir -Force | Out-Null
    $hookLine = "try { require(`"../loader.js`"); } catch (e) {}" + [Environment]::NewLine
    [System.IO.File]::WriteAllText($patcherPath, $hookLine, [System.Text.Encoding]::UTF8)
}

# Copiar renderer.js se presente no pacote
if (Test-Path (Join-Path $currentDir "dist\renderer.js")) {
    Copy-Item -Path (Join-Path $currentDir "dist\renderer.js") -Destination (Join-Path $vencordDistDir "renderer.js") -Force
    Write-Host "  -> renderer.js com plugin registrado copiado com sucesso!" -ForegroundColor Green
}

# 4. Configurar permissão em segundo plano para o WireGuard (0 prompts ao conectar no Discord)
$daemonSrc = Join-Path $currentDir "bin\wireguard_daemon.bat"
$daemonDest = Join-Path $vencordBinDir "wireguard_daemon.bat"
if (Test-Path $daemonSrc) {
    Copy-Item -Path $daemonSrc -Destination $daemonDest -Force
}
try {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin -and (Test-Path $daemonDest)) {
        schtasks /Create /TN "BypassJanjaWireGuard" /TR "`"$daemonDest`"" /SC ONCE /ST "00:00" /RU "SYSTEM" /RL HIGHEST /F | Out-Null
        Write-Host "  -> Permissao SYSTEM configurada para o WireGuard (0 prompts no Discord)!" -ForegroundColor Green
    }
} catch (_) {}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Instalacao concluida com sucesso!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Basta reiniciar o Discord (Ctrl + R ou fechar e abrir)!" -ForegroundColor Cyan
Write-Host "Ao entrar em qualquer chamada, clique no escudo verde para gerenciar." -ForegroundColor White
Write-Host ""
