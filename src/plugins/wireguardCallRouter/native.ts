import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const WIREGUARD_BIN_LOCAL = path.join(__dirname, "..", "..", "..", "bin", "wireguard.exe");
const WIREGUARD_SYS = "C:\\Program Files\\WireGuard\\wireguard.exe";
const WIREGUARD_EXE = fs.existsSync(WIREGUARD_BIN_LOCAL) ? WIREGUARD_BIN_LOCAL : WIREGUARD_SYS;

const DATA_DIR = path.join(process.env.APPDATA || "", "Vencord");
const CONF_INPUT = path.join(DATA_DIR, "proton_vpn.conf");
const CONF_OUTPUT = path.join(DATA_DIR, "proton_discord.conf");
const STATUS_FILE = path.join(DATA_DIR, "proton_status.json");
const TUNNEL_NAME = "proton_discord";

const SPLIT_ALLOWED_IPS = "0.0.0.0/1, 128.0.0.0/2, 192.0.0.0/9, 192.128.0.0/11, 192.160.0.0/13, 192.169.0.0/16, 192.170.0.0/15, 192.172.0.0/14, 192.176.0.0/12, 192.192.0.0/10, 193.0.0.0/8, 194.0.0.0/7, 196.0.0.0/6, 200.0.0.0/5, 208.0.0.0/4, 224.0.0.0/3";

function sleepSync(ms: number) {
    try {
        execSync(`ping -n 1 -w ${ms} 127.255.255.255 >nul 2>&1`, { shell: "cmd.exe" });
    } catch (_) {}
}

function runWireGuardCmd(args: string) {
    try {
        return execSync(`"${WIREGUARD_EXE}" ${args}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], shell: "cmd.exe" });
    } catch (_) {
        const homeDir = process.env.USERPROFILE || "";
        const adminKey = path.join(homeDir, ".ssh", "id_ed25519");
        let keyFlag = "";
        if (fs.existsSync(adminKey)) {
            keyFlag = `-i "${adminKey}" `;
        }
        const sshCmd = `ssh ${keyFlag}-o StrictHostKeyChecking=no -o BatchMode=yes 127.0.0.1 "\"${WIREGUARD_EXE}\" ${args}"`;
        return execSync(sshCmd, { encoding: "utf-8", shell: "cmd.exe" });
    }
}

export function getActiveTunnelName(): string | null {
    try {
        const out = execSync("sc.exe query state= all", { encoding: "utf-8", shell: "cmd.exe", stdio: ["pipe", "pipe", "ignore"], timeout: 2000 });
        const match = out.match(/WireGuardTunnel\$([a-zA-Z0-9_\-\.]+)/i);
        if (match && match[1]) {
            return match[1];
        }
    } catch (_) {}
    return null;
}

export function isTunnelRunning(): boolean {
    const activeName = getActiveTunnelName();
    if (!activeName) return false;
    try {
        const out = execSync(`sc.exe query "WireGuardTunnel$${activeName}"`, { encoding: "utf-8", shell: "cmd.exe", stdio: ["pipe", "pipe", "ignore"], timeout: 2000 });
        return out.includes("RUNNING") || out.includes("ESTADO                     : 4");
    } catch (_) {
        return false;
    }
}

export function stopTunnel() {
    try {
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
    } catch (e: any) {
        return { ok: false, error: String(e.message || e) };
    }
}

function prepareConfig(rawConf: string): string {
    const lines = rawConf.split(/\r?\n/);
    const outputLines: string[] = [];
    let peerSection = false;
    let allowedIpsSet = false;

    for (let rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith("[Peer]")) {
            peerSection = true;
        }
        if (line.startsWith("AllowedIPs")) {
            outputLines.push(`AllowedIPs = ${SPLIT_ALLOWED_IPS}`);
            allowedIpsSet = true;
            continue;
        }
        if (line.startsWith("Address") && line.includes(":")) {
            const addrs = line.split("=")[1].split(",").map(a => a.trim()).filter(a => !a.includes(":"));
            if (addrs.length > 0) {
                outputLines.push(`Address = ${addrs.join(", ")}`);
                continue;
            }
        }
        if (line.startsWith("DNS") && line.includes(":")) {
            const dnsList = line.split("=")[1].split(",").map(d => d.trim()).filter(d => !d.includes(":"));
            if (dnsList.length > 0) {
                outputLines.push(`DNS = ${dnsList.join(", ")}`);
                continue;
            }
        }
        outputLines.push(rawLine);
    }

    if (peerSection && !allowedIpsSet) {
        outputLines.push(`AllowedIPs = ${SPLIT_ALLOWED_IPS}`);
    }

    return outputLines.join("\r\n");
}

export function startTunnel(rawConf: string) {
    try {
        if (!fs.existsSync(WIREGUARD_EXE)) {
            return { ok: false, error: "WireGuard binary not found at " + WIREGUARD_EXE };
        }

        const safeConf = prepareConfig(rawConf);

        if (isTunnelRunning()) {
            stopTunnel();
            sleepSync(800);
        }

        fs.writeFileSync(CONF_INPUT, rawConf, "utf-8");
        fs.writeFileSync(CONF_OUTPUT, safeConf, "utf-8");

        try {
            runWireGuardCmd(`/installtunnelservice "${CONF_OUTPUT}"`);
        } catch (installErr: any) {
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
            lastStarted: new Date().toISOString()
        };
        fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), "utf-8");
        return { ok: true, status };
    } catch (e: any) {
        return { ok: false, error: String(e.message || e) };
    }
}

export function getStatus() {
    const activeName = getActiveTunnelName();
    let saved: any = {};
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
        endpoint: saved.endpoint || (activeName ? "Connected via WireGuard (" + activeName + ")" : null)
    };
}
