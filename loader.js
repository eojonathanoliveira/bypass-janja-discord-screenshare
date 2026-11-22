// Vencord Stream Fix & Proton VPN Persistent Loader
// Sits between Discord app.asar and Vencord dist/patcher.js
// Update-safe: lives outside dist/, survives both Discord and Vencord updates.
if (global.__StreamFixLoaderInitialized) return;
global.__StreamFixLoaderInitialized = true;

const fs = require("fs");
const path = require("path");

console.log("[StreamFix Loader] Initializing Vencord StreamFix & Proton VPN Persistent Loader...");

// 1. IPC Handlers in Main Process
try {
    const electron = require("electron");
    if (electron && electron.ipcMain) {
        electron.ipcMain.on("StreamFixLog", (event, msg) => {
            try {
                fs.appendFileSync(path.join(__dirname, "stream_fix.log"), `[${new Date().toISOString()}] ${msg}\n`);
            } catch (_) {}
        });
        console.log("[StreamFix Loader] Registered StreamFixLog IPC handler in ipcMain");

        // Proton VPN Service IPC Handlers
        try {
            let cachedService = null;
            let lastLoadTime = 0;
            const getService = () => {
                const sPath = path.join(__dirname, "proton_vpn_service.js");
                try {
                    const mtime = fs.statSync(sPath).mtimeMs;
                    if (!cachedService || mtime > lastLoadTime) {
                        const code = fs.readFileSync(sPath, "utf-8");
                        const fn = new Function("require", "__dirname", "module", "exports", code);
                        const mod = { exports: {} };
                        fn(require, __dirname, mod, mod.exports);
                        cachedService = mod.exports;
                        lastLoadTime = mtime;
                    }
                } catch (loadErr) {
                    console.error("[StreamFix Loader] Error loading proton_vpn_service:", loadErr);
                }
                return cachedService;
            };
            const registerHandlers = (prefix) => {
                electron.ipcMain.handle(`${prefix}Start`, async (event, conf, mode) => {
                    return getService().startTunnel(conf, mode);
                });
                electron.ipcMain.handle(`${prefix}Stop`, async () => {
                    return getService().stopTunnel();
                });
                electron.ipcMain.handle(`${prefix}GetStatus`, async () => {
                    return getService().getStatus();
                });
                electron.ipcMain.handle(`${prefix}RouteVoiceIP`, async (event, ip) => {
                    return getService().addVoiceRoute(ip);
                });
                electron.ipcMain.handle(`${prefix}CheckForUpdates`, async (event, force) => {
                    return checkForUpdates(force);
                });
            };
            registerHandlers("ProtonVPN_");
            registerHandlers("VencordPluginNative_ProtonVPN_");
            console.log("[StreamFix Loader] Registered dynamic ProtonVPN IPC handlers in ipcMain");
        } catch (vpne) {
            console.warn("[StreamFix Loader] Failed to load proton_vpn_service:", vpne);
        }
    }
} catch (e) {
    console.warn("[StreamFix Loader] Failed to register IPC handlers:", e);
}

// 1.1 Auto-Updater Module (Verifica e atualiza o plugin automaticamente via GitHub Releases)
const GITHUB_REPO = "eojonathanoliveira/bypass-janja-discord-screenshare";

function getLocalVersion() {
    try {
        const vPath = path.join(__dirname, "version.json");
        if (fs.existsSync(vPath)) {
            const data = JSON.parse(fs.readFileSync(vPath, "utf-8"));
            if (data.version) return data.version;
        }
    } catch (_) {}
    return "1.1.2";
}

function compareVersions(v1, v2) {
    const p1 = (v1 || "0").split(".").map(n => parseInt(n, 10) || 0);
    const p2 = (v2 || "0").split(".").map(n => parseInt(n, 10) || 0);
    const len = Math.max(p1.length, p2.length);
    for (let i = 0; i < len; i++) {
        const a = p1[i] || 0;
        const b = p2[i] || 0;
        if (a > b) return 1;
        if (a < b) return -1;
    }
    return 0;
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const get = (targetUrl, redirects = 0) => {
            if (redirects > 5) return reject(new Error("Muitos redirecionamentos"));
            const client = targetUrl.startsWith("https") ? require("https") : require("http");
            client.get(targetUrl, { headers: { "User-Agent": "BypassJanjaDiscordScreenshare-Updater" } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return get(res.headers.location, redirects + 1);
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`Falha HTTP ${res.statusCode}`));
                }
                const tmpPath = destPath + ".tmp";
                const fileStream = fs.createWriteStream(tmpPath);
                res.pipe(fileStream);
                fileStream.on("finish", () => {
                    fileStream.close(() => {
                        try {
                            fs.renameSync(tmpPath, destPath);
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
            }).on("error", reject);
        };
        get(url);
    });
}

async function checkForUpdates(force = false) {
    const currentVersion = getLocalVersion();
    try {
        const https = require("https");
        const options = {
            hostname: "api.github.com",
            path: `/repos/${GITHUB_REPO}/releases/latest`,
            headers: { "User-Agent": "BypassJanjaDiscordScreenshare-Updater" }
        };
        const data = await new Promise((resolve) => {
            https.get(options, (res) => {
                let body = "";
                res.on("data", chunk => body += chunk);
                res.on("end", () => {
                    try { resolve(JSON.parse(body)); } catch (_) { resolve(null); }
                });
            }).on("error", () => resolve(null));
        });

        if (!data || !data.tag_name) {
            return { ok: false, currentVersion, message: "Nao foi possivel consultar os servidores do GitHub." };
        }

        const remoteTag = data.tag_name.replace(/^v/, "").trim();
        const hasUpdate = compareVersions(remoteTag, currentVersion) > 0;

        if (!hasUpdate && !force) {
            return { ok: true, updateAvailable: false, currentVersion, latestVersion: remoteTag };
        }

        console.log(`[AutoUpdater] Nova versao detectada no GitHub: v${remoteTag} (versao instalada: v${currentVersion}). Aplicando atualizacao automatica...`);

        const filesToUpdate = ["loader.js", "proton_vpn_service.js", "proton_vpn_ui.js"];
        for (const file of filesToUpdate) {
            const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${file}`;
            await downloadFile(rawUrl, path.join(__dirname, file));
            console.log(`[AutoUpdater] Arquivo atualizado: ${file}`);
        }

        const vPath = path.join(__dirname, "version.json");
        fs.writeFileSync(vPath, JSON.stringify({
            version: remoteTag,
            name: "Bypass Janja Discord Screenshare",
            repo: GITHUB_REPO,
            lastUpdated: new Date().toISOString()
        }, null, 2), "utf-8");

        console.log(`[AutoUpdater] Atualizacao para v${remoteTag} concluida com sucesso!`);
        return {
            ok: true,
            updateAvailable: true,
            updated: true,
            currentVersion,
            latestVersion: remoteTag,
            changelog: data.body || ""
        };
    } catch (err) {
        console.error("[AutoUpdater] Erro ao atualizar:", err);
        return { ok: false, currentVersion, error: String(err.message || err) };
    }
}

// Verificacao automatica em segundo plano (20s apos inicio e a cada 6h)
setTimeout(() => {
    checkForUpdates().catch(() => {});
}, 20000);
setInterval(() => {
    checkForUpdates().catch(() => {});
}, 6 * 3600 * 1000);

// 2. Remote Command Evaluation Bridge (Reads eval_cmd.js and writes eval_res.json)
try {
    const actionFile = path.join(__dirname, "eval_cmd.js");
    const resultFile = path.join(__dirname, "eval_res.json");
    try { if (fs.existsSync(actionFile)) fs.unlinkSync(actionFile); } catch (_) {}

    setInterval(async () => {
        try {
            if (fs.existsSync(actionFile)) {
                let code = "";
                try {
                    code = fs.readFileSync(actionFile, "utf-8");
                    fs.unlinkSync(actionFile);
                } catch (readErr) {
                    return;
                }

                if (code.startsWith("// MAIN_EVAL")) {
                    try {
                        const evalFn = new Function("require", "__dirname", "process", `return (async () => { ${code} })()`);
                        const mainRes = await evalFn(require, __dirname, process);
                        fs.writeFileSync(resultFile, JSON.stringify({ ok: true, result: mainRes, time: Date.now() }), "utf-8");
                    } catch (mainErr) {
                        fs.writeFileSync(resultFile, JSON.stringify({ ok: false, error: String(mainErr.stack || mainErr), time: Date.now() }), "utf-8");
                    }
                    return;
                }

                try {
                    const electron = require("electron");
                    const wins = electron.BrowserWindow ? electron.BrowserWindow.getAllWindows() : [];
                    const win = wins.find(w => !w.isDestroyed() && w.webContents);
                    if (win) {
                        const res = await win.webContents.executeJavaScript(`(async () => {\n${code}\n})()`);
                        fs.writeFileSync(resultFile, JSON.stringify({ ok: true, result: res, time: Date.now() }), "utf-8");
                    } else {
                        fs.writeFileSync(resultFile, JSON.stringify({ ok: false, error: "No active BrowserWindow found (wins: " + wins.length + ")", time: Date.now() }), "utf-8");
                    }
                } catch (execErr) {
                    fs.writeFileSync(resultFile, JSON.stringify({ ok: false, error: String(execErr), time: Date.now() }), "utf-8");
                }
            }
        } catch (_) {}
    }, 250);
} catch (e) {
    console.warn("[StreamFix Loader] Failed to register eval bridge:", e);
}

// 3. Helper to bundle extra renderer scripts & dynamically inject BypassJanjaPlugin into Vencord plugin tables
function patchRendererCode(code) {
    if (typeof code !== "string" || code.includes("BypassJanjaDiscordScreenshare")) {
        return code;
    }
    const pluginDef = `
var BypassJanjaPlugin = {
    name: "BypassJanjaDiscordScreenshare",
    description: "Bypass janja discord screenshare - Roteia voz, video e compartilhamento de tela via WireGuard embutido, preservando a rede local (192.168.0.0/16).",
    tags: ["Media", "Voice", "WireGuard", "Screenshare", "VPN"],
    authors: [{ name: "Jonathan Oliveira", id: 0n }],
    start() {
        if (window.initBypassJanjaUI) window.initBypassJanjaUI();
    },
    stop() {
        if (window.stopBypassJanjaUI) window.stopBypassJanjaUI();
    }
};
`;
    let patched = code;
    if (patched.includes("var Oe={") && patched.includes("yi={")) {
        patched = pluginDef + patched;
        patched = patched.replace("var Oe={", "var Oe={[BypassJanjaPlugin.name]:BypassJanjaPlugin,");
        patched = patched.replace("yi={", "yi={[BypassJanjaPlugin.name]:{folderName:\"bypassJanja\",userPlugin:true},");
        console.log("[StreamFix Loader] Dynamically patched BypassJanjaPlugin into Vencord plugin tables (Oe/yi)!");
    }
    return patched;
}

function getExtraRendererScripts() {
    let extra = "";
    try {
        const fixPath = path.join(__dirname, "stream_fix.js");
        if (fs.existsSync(fixPath)) {
            extra += ";\n" + fs.readFileSync(fixPath, "utf-8");
        }
    } catch (_) {}
    try {
        const vpnUiPath = path.join(__dirname, "proton_vpn_ui.js");
        if (fs.existsSync(vpnUiPath)) {
            extra += ";\n" + fs.readFileSync(vpnUiPath, "utf-8");
        }
    } catch (_) {}
    return extra;
}

// 4. Monkey-patch fs.readFileSync to inject bridges and UI scripts
const origReadFileSync = fs.readFileSync;
fs.readFileSync = function (filePath, options) {
    const res = origReadFileSync.call(fs, filePath, options);
    if (typeof filePath === "string") {
        const lowerPath = filePath.toLowerCase();
        if ((lowerPath.endsWith("preload.js") || lowerPath.endsWith("vencorddesktoppreload.js")) && !lowerPath.includes("splash")) {
            try {
                const bridgeCode = `
                try {
                    const { contextBridge, ipcRenderer } = require("electron");
                    if (contextBridge && ipcRenderer) {
                        const bridgeObj = {
                            log: (msg) => { try { ipcRenderer.send("StreamFixLog", msg); } catch (_) {} }
                        };
                        const vpnObj = {
                            start: (conf, mode) => ipcRenderer.invoke("ProtonVPN_Start", conf, mode),
                            stop: () => ipcRenderer.invoke("ProtonVPN_Stop"),
                            getStatus: () => ipcRenderer.invoke("ProtonVPN_GetStatus"),
                            routeVoiceIP: (ip) => ipcRenderer.invoke("ProtonVPN_RouteVoiceIP", ip),
                            checkForUpdates: (force) => ipcRenderer.invoke("ProtonVPN_CheckForUpdates", force)
                        };
                        if (process.contextIsolated && contextBridge.exposeInMainWorld) {
                            try { contextBridge.exposeInMainWorld("StreamFixBridge", bridgeObj); } catch (_) {}
                            try { contextBridge.exposeInMainWorld("ProtonVPNBridge", vpnObj); } catch (_) {}
                        } else {
                            try { window.StreamFixBridge = bridgeObj; } catch (_) {}
                            try { window.ProtonVPNBridge = vpnObj; } catch (_) {}
                        }
                    }
                } catch (_) {}
                `;
                return (typeof res === "string" ? res : res.toString("utf-8")) + ";\n" + bridgeCode;
            } catch (err) {
                console.error("[StreamFix Loader] Error injecting bridge into preload:", err);
            }
        }
        if (filePath.endsWith("renderer.js") || filePath.endsWith("vencordDesktopRenderer.js")) {
            try {
                let code = typeof res === "string" ? res : res.toString("utf-8");
                code = patchRendererCode(code);
                const extra = getExtraRendererScripts();
                if (extra) {
                    code += extra;
                }
                console.log("[StreamFix Loader] Successfully prepared renderer bundle via fs.readFileSync!");
                return code;
            } catch (err) {
                console.error("[StreamFix Loader] Error injecting scripts via fs.readFileSync:", err);
            }
        }
    }
    return res;
};

// 5. Monkey-patch electron.ipcMain.on to ensure VencordPreloadGetRendererJs always includes extra scripts
try {
    const electron = require("electron");
    if (electron && electron.ipcMain) {
        const origIpcOn = electron.ipcMain.on.bind(electron.ipcMain);
        electron.ipcMain.on = function (channel, listener) {
            if (channel === "VencordPreloadGetRendererJs") {
                const wrappedListener = function (event, ...args) {
                    listener(event, ...args);
                    try {
                        if (typeof event.returnValue === "string") {
                            event.returnValue = patchRendererCode(event.returnValue);
                            const extra = getExtraRendererScripts();
                            if (extra && !event.returnValue.includes("[ProtonVoiceVPN]")) {
                                event.returnValue += extra;
                                console.log("[StreamFix Loader] Injected extra scripts into VencordPreloadGetRendererJs returnValue!");
                            }
                        }
                    } catch (e) {
                        console.error("[StreamFix Loader] Error appending scripts to VencordPreloadGetRendererJs:", e);
                    }
                };
                return origIpcOn(channel, wrappedListener);
            }
            if (channel === "VencordGetPluginIpcMethodMap") {
                const wrappedListener = function (event, ...args) {
                    listener(event, ...args);
                    try {
                        if (event.returnValue && typeof event.returnValue === "object") {
                            event.returnValue.ProtonVPN = {
                                start: "VencordPluginNative_ProtonVPN_Start",
                                stop: "VencordPluginNative_ProtonVPN_Stop",
                                getStatus: "VencordPluginNative_ProtonVPN_GetStatus"
                            };
                            console.log("[StreamFix Loader] Injected ProtonVPN methods into VencordGetPluginIpcMethodMap!");
                        }
                    } catch (e) {
                        console.error("[StreamFix Loader] Error injecting into VencordGetPluginIpcMethodMap:", e);
                    }
                };
                return origIpcOn(channel, wrappedListener);
            }
            return origIpcOn(channel, listener);
        };
    }
} catch (e) {
    console.warn("[StreamFix Loader] Failed to wrap ipcMain:", e);
}

// 6. Now load the official Vencord patcher (only if loader.js was direct entry point)
const patcherPath = path.join(__dirname, "dist", "patcher.js");
if (fs.existsSync(patcherPath) && !module.parent && !global.__VencordPatcherLoaded) {
    global.__VencordPatcherLoaded = true;
    console.log("[StreamFix Loader] Requiring official Vencord patcher at " + patcherPath);
    require(patcherPath);
}
