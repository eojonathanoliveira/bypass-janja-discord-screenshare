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
            const getService = () => {
                const sPath = path.join(__dirname, "proton_vpn_service.js");
                try { delete require.cache[require.resolve(sPath)]; } catch (_) {}
                return require(sPath);
            };
            const registerHandlers = (prefix) => {
                electron.ipcMain.handle(`${prefix}Start`, async (event, conf) => {
                    return getService().startTunnel(conf);
                });
                electron.ipcMain.handle(`${prefix}Stop`, async () => {
                    return getService().stopTunnel();
                });
                electron.ipcMain.handle(`${prefix}GetStatus`, async () => {
                    return getService().getStatus();
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

// 3. Helper to bundle extra renderer scripts
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
                            start: (conf) => ipcRenderer.invoke("ProtonVPN_Start", conf),
                            stop: () => ipcRenderer.invoke("ProtonVPN_Stop"),
                            getStatus: () => ipcRenderer.invoke("ProtonVPN_GetStatus")
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
                const extra = getExtraRendererScripts();
                if (extra) {
                    console.log("[StreamFix Loader] Successfully appended extra scripts to renderer bundle via fs.readFileSync!");
                    return (typeof res === "string" ? res : res.toString("utf-8")) + extra;
                }
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
