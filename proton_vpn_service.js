const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const WIREGUARD_BIN_LOCAL = path.join(__dirname, "bin", "wireguard.exe");
const WIREGUARD_SYS = "C:\\Program Files\\WireGuard\\wireguard.exe";
const WIREGUARD_EXE = fs.existsSync(WIREGUARD_BIN_LOCAL) ? WIREGUARD_BIN_LOCAL : WIREGUARD_SYS;

const CONF_INPUT = path.join(__dirname, "proton_vpn.conf");
const CONF_OUTPUT = path.join(__dirname, "proton_discord.conf");
const STATUS_FILE = path.join(__dirname, "proton_status.json");
const TUNNEL_NAME = "proton_discord";

// 1. Sub-redes dedicadas de Voz, Video e Screenshare do Discord (i3D.net AS49544 + Relays Cloudflare/SFU)
// Isso garante que APENAS o trafego do Discord passe pelo tunel.
// Navegacao (Chrome/Edge), Steam, jogos, torrents e downloads continuam 100% diretos na conexao normal.
const DISCORD_ONLY_ALLOWED_IPS = "66.22.192.0/18, 162.158.0.0/15, 143.244.32.0/20, 104.16.0.0/12, 104.244.42.0/24";

// 2. Modo Completo: Todas as sub-redes IPv4 exceto a rede local privada (192.168.0.0/16)
const FULL_SPLIT_ALLOWED_IPS = "0.0.0.0/1, 128.0.0.0/2, 192.0.0.0/9, 192.128.0.0/11, 192.160.0.0/13, 192.169.0.0/16, 192.170.0.0/15, 192.172.0.0/14, 192.176.0.0/12, 192.192.0.0/10, 193.0.0.0/8, 194.0.0.0/7, 196.0.0.0/6, 200.0.0.0/5, 208.0.0.0/4, 224.0.0.0/3";

let watchdogInterval = null;
let tunnelStartTime = 0;

function sleepSync(ms) {
    try {
        execSync(`ping -n 1 -w ${ms} 127.255.255.255 >nul 2>&1`, { shell: "cmd.exe" });
    } catch (_) {}
}

function runWireGuardCmd(args) {
    // 1. Tentar execucao direta (funciona caso o Discord esteja rodando como administrador)
    try {
        return execSync(`"${WIREGUARD_EXE}" ${args}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], shell: "cmd.exe" });
    } catch (e1) {
        // Falha direta por falta de privilegios de administrador.
    }

    // 2. Tentar Tarefa Agendada (criada pelo install.bat/install.ps1 com privilegios de SYSTEM - 0 prompts)
    try {
        const cmdFile = path.join(__dirname, "wireguard_cmd.txt");
        fs.writeFileSync(cmdFile, args, "utf-8");
        const res = execSync('schtasks /Run /TN "BypassJanjaWireGuard"', { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], shell: "cmd.exe" });
        if (res.includes("SUCESSO") || res.includes("SUCCESS")) {
            sleepSync(600);
            return res;
        }
    } catch (e2) {
        // Tarefa agendada nao configurada ou indisponivel
    }

    // 3. Fallback Universal: Elevacao nativa do Windows (UAC) via PowerShell
    // Funciona perfeitamente mesmo se o usuario apenas extraiu o ZIP sem rodar o instalador
    const psCmd = `Start-Process -FilePath '${WIREGUARD_EXE}' -ArgumentList '${args.replace(/'/g, "''")}' -Verb RunAs -WindowStyle Hidden -Wait`;
    return execSync(`powershell -NoProfile -WindowStyle Hidden -Command "${psCmd}"`, { encoding: "utf-8", shell: "cmd.exe" });
}

function getActiveTunnelName() {
    try {
        const out = execSync("sc.exe query state= all", { encoding: "utf-8", shell: "cmd.exe", stdio: ["pipe", "pipe", "ignore"], timeout: 2000 });
        const match = out.match(/WireGuardTunnel\$([a-zA-Z0-9_\-\.]+)/i);
        if (match && match[1]) {
            return match[1];
        }
    } catch (_) {}
    return null;
}

function isTunnelRunning() {
    const activeName = getActiveTunnelName();
    if (!activeName) return false;
    try {
        const out = execSync(`sc.exe query "WireGuardTunnel$${activeName}"`, { encoding: "utf-8", shell: "cmd.exe", stdio: ["pipe", "pipe", "ignore"], timeout: 2000 });
        return out.includes("RUNNING") || out.includes("ESTADO                     : 4");
    } catch (_) {
        return false;
    }
}

function startWatchdog() {
    stopWatchdog();
    tunnelStartTime = Date.now();
    watchdogInterval = setInterval(() => {
        try {
            if (!isTunnelRunning()) {
                stopWatchdog();
                return;
            }
            const WG_CLI = fs.existsSync(path.join(__dirname, "bin", "wg.exe")) ? path.join(__dirname, "bin", "wg.exe") : "C:\\Program Files\\WireGuard\\wg.exe";
            if (fs.existsSync(WG_CLI)) {
                const activeName = getActiveTunnelName() || TUNNEL_NAME;
                const out = execSync(`"${WG_CLI}" show ${activeName} latest-handshakes`, { encoding: "utf-8", shell: "cmd.exe", stdio: ["pipe", "pipe", "ignore"], timeout: 3000 });
                const parts = out.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const handshakeSec = parseInt(parts[1], 10);
                    const nowSec = Math.floor(Date.now() / 1000);
                    // Apos 40s de inicializacao, se o handshake parou a mais de 180s, o servidor encerrou a sessao
                    if (Date.now() - tunnelStartTime > 40000) {
                        if (handshakeSec > 0 && (nowSec - handshakeSec) > 180) {
                            console.warn(`[ProtonVPN Watchdog] Sessao expirada (ultimo handshake ha ${nowSec - handshakeSec}s). Desativando tunel para proteger a conexao...`);
                            stopTunnel();
                            fs.writeFileSync(STATUS_FILE, JSON.stringify({
                                active: false,
                                expired: true,
                                error: "A sessao do arquivo .conf expirou ou perdeu conexao com o servidor. O tunel foi desativado automaticamente para manter sua internet 100% online.",
                                lastStopped: new Date().toISOString()
                            }, null, 2), "utf-8");
                        }
                    }
                }
            }
        } catch (_) {}
    }, 15000);
}

function stopWatchdog() {
    if (watchdogInterval) {
        clearInterval(watchdogInterval);
        watchdogInterval = null;
    }
}

function stopTunnel() {
    try {
        stopWatchdog();
        const activeName = getActiveTunnelName() || TUNNEL_NAME;
        try {
            runWireGuardCmd(`/uninstalltunnelservice ${activeName}`);
        } catch (_) {}
        for (let i = 0; i < 25; i++) {
            if (!isTunnelRunning()) break;
            sleepSync(200);
        }
        const status = { active: false, lastStopped: new Date().toISOString() };
        fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), "utf-8");
        return { ok: true, status };
    } catch (e) {
        return { ok: false, error: String(e.message || e) };
    }
}

function prepareConfig(rawConf, routingMode = "discord_only", extraIps = []) {
    const lines = rawConf.split(/\r?\n/);
    const outputLines = [];
    let peerSection = false;
    let allowedIpsSet = false;

    let targetAllowedIps = (routingMode === "full") ? FULL_SPLIT_ALLOWED_IPS : DISCORD_ONLY_ALLOWED_IPS;
    if (extraIps && extraIps.length > 0) {
        const validIps = extraIps.filter(ip => typeof ip === "string" && /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(ip));
        if (validIps.length > 0) {
            targetAllowedIps += ", " + validIps.map(ip => `${ip}/32`).join(", ");
        }
    }

    for (let rawLine of lines) {
        const line = rawLine.trim();

        // NUNCA incluir diretiva de DNS no WireGuard!
        // Ao nao definir DNS, o Windows mantem seu DNS normal do roteador/provedor (192.168.0.1, 1.1.1.1, etc.)
        // garantindo que NENHUMA navegacao do computador caia caso a VPN expire.
        if (line.startsWith("DNS")) {
            continue;
        }

        if (line.startsWith("[Peer]")) {
            peerSection = true;
        }
        if (line.startsWith("AllowedIPs")) {
            outputLines.push(`AllowedIPs = ${targetAllowedIps}`);
            allowedIpsSet = true;
            continue;
        }
        // Excluir IPv6 da interface
        if (line.startsWith("Address") && line.includes(":")) {
            const addrs = line.split("=")[1].split(",").map(a => a.trim()).filter(a => !a.includes(":"));
            if (addrs.length > 0) {
                outputLines.push(`Address = ${addrs.join(", ")}`);
                continue;
            }
        }
        outputLines.push(rawLine);
    }

    if (peerSection && !allowedIpsSet) {
        outputLines.push(`AllowedIPs = ${targetAllowedIps}`);
    }

    return outputLines.join("\r\n");
}

function addVoiceRoute(ip) {
    if (!ip || typeof ip !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(ip)) {
        return { ok: false, error: "IP invalido" };
    }
    // IPs locais e de loopback nao devem ser roteados
    if (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("127.")) {
        return { ok: true, skipped: true };
    }
    try {
        if (isTunnelRunning()) {
            const WG_CLI = fs.existsSync(path.join(__dirname, "bin", "wg.exe")) ? path.join(__dirname, "bin", "wg.exe") : "C:\\Program Files\\WireGuard\\wg.exe";
            const activeName = getActiveTunnelName() || TUNNEL_NAME;
            if (fs.existsSync(WG_CLI)) {
                const confOut = execSync(`"${WG_CLI}" show ${activeName} allowed-ips`, { encoding: "utf-8", shell: "cmd.exe", stdio: ["pipe", "pipe", "ignore"], timeout: 3000 });
                const [pubKey, ...currentIps] = confOut.trim().split(/\s+/);
                if (pubKey && !confOut.includes(ip)) {
                    const newIps = (currentIps.join(",") + `,${ip}/32`).replace(/^,/, "");
                    runWireGuardCmd(`set ${activeName} peer ${pubKey} allowed-ips "${newIps}"`);
                    console.log(`[ProtonVPN] Rota dinamica adicionada para voz do Discord: ${ip}/32`);
                }
            }
        }
        return { ok: true, ip };
    } catch (e) {
        return { ok: false, error: String(e.message || e) };
    }
}

function startTunnel(rawConf, routingMode = "discord_only") {
    try {
        if (!fs.existsSync(WIREGUARD_EXE)) {
            return { ok: false, error: "Motor WireGuard nao encontrado em " + WIREGUARD_EXE };
        }

        const safeConf = prepareConfig(rawConf, routingMode);

        // Limpar qualquer tunel previo se estiver ativo
        if (isTunnelRunning()) {
            stopTunnel();
            sleepSync(800);
        }

        fs.writeFileSync(CONF_INPUT, rawConf, "utf-8");
        fs.writeFileSync(CONF_OUTPUT, safeConf, "utf-8");

        try {
            runWireGuardCmd(`/installtunnelservice "${CONF_OUTPUT}"`);
        } catch (installErr) {
            const errStr = String(installErr.stdout || installErr.stderr || installErr.message || installErr);
            if (!errStr.includes("already installed") && !errStr.includes("already running")) {
                throw installErr;
            }
        }

        let running = false;
        for (let i = 0; i < 25; i++) {
            if (isTunnelRunning()) {
                running = true;
                break;
            }
            sleepSync(200);
        }

        let endpoint = "";
        for (let line of rawConf.split(/\r?\n/)) {
            if (line.trim().startsWith("Endpoint")) {
                endpoint = line.split("=")[1]?.trim() || "";
            }
        }

        const status = {
            active: running,
            tunnelName: getActiveTunnelName() || TUNNEL_NAME,
            endpoint,
            routingMode,
            lastStarted: new Date().toISOString()
        };
        fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), "utf-8");

        if (running) {
            startWatchdog();
        }

        return { ok: true, status };
    } catch (e) {
        return { ok: false, error: String(e.message || e) };
    }
}

function getStatus() {
    const activeName = getActiveTunnelName();
    let saved = {};
    try {
        if (fs.existsSync(STATUS_FILE)) {
            saved = JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
        }
    } catch (_) {}
    let savedConf = "";
    try {
        if (fs.existsSync(CONF_INPUT)) {
            savedConf = fs.readFileSync(CONF_INPUT, "utf-8");
        }
    } catch (_) {}
    return {
        active: !!activeName,
        tunnelName: activeName || null,
        hasConfig: fs.existsSync(CONF_INPUT),
        savedConfig: savedConf,
        endpoint: saved.endpoint || (activeName ? "Conectado via WireGuard (" + activeName + ")" : null),
        routingMode: saved.routingMode || "discord_only",
        expired: !!saved.expired,
        error: saved.error || null
    };
}

module.exports = {
    startTunnel,
    stopTunnel,
    getStatus,
    isTunnelRunning,
    getActiveTunnelName,
    addVoiceRoute
};
