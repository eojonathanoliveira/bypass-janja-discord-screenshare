import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

declare const VencordNative: {
    pluginHelpers: {
        WireGuardCallRouter: {
            start(rawConf: string): Promise<{ ok: boolean; error?: string; status?: any }>;
            stop(): Promise<{ ok: boolean }>;
            getStatus(): Promise<{ active: boolean; endpoint?: string; hasConfig: boolean; savedConfig?: string }>;
        };
    };
};

const settings = definePluginSettings({
    autoConnect: {
        type: OptionType.BOOLEAN,
        description: "Automatically connect the WireGuard tunnel when joining a voice call",
        default: true
    },
    preserveLan: {
        type: OptionType.BOOLEAN,
        description: "Exclude local network (192.168.0.0/16) from the tunnel to keep LAN and SSH direct",
        default: true
    },
    wireguardConfig: {
        type: OptionType.STRING,
        description: "WireGuard configuration content (.conf)",
        default: ""
    }
});

export default definePlugin({
    name: "WireGuardCallRouter",
    description: "Plugin ANTI Janja Burra - Roteia voz, vídeo e compartilhamento de tela do Discord via WireGuard embutido, preservando a rede local.",
    authors: [
        {
            name: "Jonathan Oliveira",
            id: 0n
        }
    ],
    settings,

    async start() {
        const native = VencordNative?.pluginHelpers?.WireGuardCallRouter;
        if (!native) {
            console.warn("[WireGuardCallRouter] Native helpers not available.");
            return;
        }

        const status = await native.getStatus();
        if (settings.store.autoConnect && status.hasConfig && !status.active) {
            const conf = settings.store.wireguardConfig || status.savedConfig;
            if (conf) {
                await native.start(conf);
            }
        }
    },

    async stop() {
        const native = VencordNative?.pluginHelpers?.WireGuardCallRouter;
        if (native) {
            await native.stop();
        }
    }
});
