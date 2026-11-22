// Proton VPN WireGuard Voice & Video Call Router UI
// Integrated with Vencord & Discord Native DOM
(function () {
    const TAG = "[ProtonVoiceVPN]";

    function createStyles() {
        if (document.getElementById("proton-vpn-styles")) return;
        const style = document.createElement("style");
        style.id = "proton-vpn-styles";
        style.textContent = `
            #proton-vpn-voice-btn {
                background: transparent;
                border: none;
                padding: 0;
                margin: 0 2px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                min-width: 32px;
                max-width: 32px;
                border-radius: 4px;
                cursor: pointer;
                color: #b5bac1;
                outline: none;
                transition: color 0.15s ease, background-color 0.15s ease;
                box-sizing: border-box;
                flex-shrink: 0;
            }
            #proton-vpn-voice-btn:hover {
                background-color: rgba(78, 80, 88, 0.3);
                color: #dbdee1;
            }
            #proton-vpn-voice-btn.active {
                color: #23a55a !important;
            }
            #proton-vpn-voice-btn.active svg {
                filter: drop-shadow(0 0 4px rgba(35, 165, 90, 0.8));
            }
            .proton-modal-backdrop {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: var(--font-primary, "gg sans", "Noto Sans", sans-serif);
            }
            .proton-modal {
                background: #313338;
                border-radius: 8px;
                width: 520px;
                max-width: 90vw;
                padding: 24px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                color: #dbdee1;
                position: relative;
            }
            .proton-modal h2 {
                margin: 0 0 8px 0;
                color: #ffffff;
                font-size: 20px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .proton-modal p {
                font-size: 13px;
                color: #949ba4;
                margin: 0 0 16px 0;
                line-height: 1.4;
            }
            .proton-status-card {
                background: #2b2d31;
                border-radius: 6px;
                padding: 12px 16px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-left: 4px solid #ed4245;
            }
            .proton-status-card.running {
                border-left-color: #23a55a;
            }
            .proton-status-text {
                font-size: 14px;
                font-weight: 600;
            }
            .proton-status-sub {
                font-size: 12px;
                color: #949ba4;
                margin-top: 2px;
            }
            .proton-textarea {
                width: 100%;
                box-sizing: border-box;
                height: 110px;
                background: #1e1f22;
                border: 1px solid #3b3e45;
                border-radius: 4px;
                color: #dbdee1;
                font-family: monospace;
                font-size: 11px;
                padding: 8px;
                resize: vertical;
                margin-bottom: 12px;
            }
            .proton-textarea:focus {
                outline: none;
                border-color: #5865f2;
            }
            .proton-file-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
            }
            .proton-btn {
                background: #5865f2;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                font-weight: 500;
                font-size: 14px;
                cursor: pointer;
                transition: background 0.15s ease;
            }
            .proton-btn:hover { background: #4752c4; }
            .proton-btn.danger { background: #da373c; }
            .proton-btn.danger:hover { background: #a12828; }
            .proton-btn.secondary { background: #4e5058; }
            .proton-btn.secondary:hover { background: #6d6f78; }
            .proton-close-btn {
                position: absolute;
                top: 16px;
                right: 16px;
                background: transparent;
                border: none;
                color: #949ba4;
                font-size: 20px;
                cursor: pointer;
            }
            .proton-close-btn:hover { color: #ffffff; }
        `;
        document.head.appendChild(style);
    }

    function getBridge() {
        if (window.VencordNative?.pluginHelpers?.ProtonVPN) {
            return window.VencordNative.pluginHelpers.ProtonVPN;
        }
        if (window.ProtonVPNBridge) {
            return window.ProtonVPNBridge;
        }
        return null;
    }

    async function checkStatus() {
        try {
            const bridge = getBridge();
            if (bridge && typeof bridge.getStatus === "function") {
                return await bridge.getStatus();
            }
        } catch (_) {}
        return { active: false };
    }

    function openModal() {
        createStyles();
        const existing = document.getElementById("proton-vpn-modal");
        if (existing) existing.remove();

        const backdrop = document.createElement("div");
        backdrop.id = "proton-vpn-modal";
        backdrop.className = "proton-modal-backdrop";

        backdrop.innerHTML = `
            <div class="proton-modal">
                <button class="proton-close-btn">&times;</button>
                <h2>🛡️ Proton VPN - Roteador de Chamadas</h2>
                <p>Roteia o tráfego de voz, vídeo e compartilhamento de tela com WireGuard embutido. Sua rede local (192.168.0.x), SSH e jogos na LAN permanecem 100% diretos.</p>
                
                <div class="proton-status-card" id="proton-card">
                    <div>
                        <div class="proton-status-text" id="proton-status-title">Verificando status...</div>
                        <div class="proton-status-sub" id="proton-status-desc">Aguarde...</div>
                    </div>
                    <button class="proton-btn danger" id="proton-toggle-btn" style="display:none;">Desconectar</button>
                </div>

                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; color: #b5bac1;">Carregar arquivo .conf do Proton VPN</div>
                <div class="proton-file-row">
                    <input type="file" id="proton-file-input" accept=".conf" style="display:none;">
                    <button class="proton-btn secondary" id="proton-browse-btn">📁 Escolher Arquivo .conf</button>
                    <span id="proton-file-name" style="font-size: 13px; color: #949ba4;">Nenhum arquivo selecionado</span>
                </div>

                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; color: #b5bac1;">Conteúdo da Configuração (.conf)</div>
                <textarea class="proton-textarea" id="proton-conf-text" placeholder="[Interface]\nPrivateKey = ...\nAddress = ...\n\n[Peer]\nPublicKey = ...\nEndpoint = ..."></textarea>

                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
                    <button class="proton-btn secondary" id="proton-cancel-btn">Fechar</button>
                    <button class="proton-btn" id="proton-start-btn">⚡ Ativar Roteador WireGuard</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        const close = () => backdrop.remove();
        backdrop.querySelector(".proton-close-btn").onclick = close;
        backdrop.querySelector("#proton-cancel-btn").onclick = close;
        backdrop.onclick = (e) => { if (e.target === backdrop) close(); };

        const fileInput = backdrop.querySelector("#proton-file-input");
        const browseBtn = backdrop.querySelector("#proton-browse-btn");
        const fileNameSpan = backdrop.querySelector("#proton-file-name");
        const confTextArea = backdrop.querySelector("#proton-conf-text");
        const startBtn = backdrop.querySelector("#proton-start-btn");
        const toggleBtn = backdrop.querySelector("#proton-toggle-btn");
        const card = backdrop.querySelector("#proton-card");
        const statusTitle = backdrop.querySelector("#proton-status-title");
        const statusDesc = backdrop.querySelector("#proton-status-desc");

        browseBtn.onclick = () => fileInput.click();
        fileInput.onchange = () => {
            const file = fileInput.files[0];
            if (file) {
                fileNameSpan.textContent = file.name;
                const reader = new FileReader();
                reader.onload = (e) => {
                    confTextArea.value = e.target.result;
                };
                reader.readAsText(file);
            }
        };

        async function refreshModal() {
            const st = await checkStatus();
            const btn = document.getElementById("proton-vpn-voice-btn");
            if (st.savedConfig && !confTextArea.value.trim()) {
                confTextArea.value = st.savedConfig;
                fileNameSpan.textContent = "proton_vpn.conf (salvo)";
            }
            if (st.active) {
                card.className = "proton-status-card running";
                statusTitle.textContent = "🟢 Roteador Ativo (WireGuard Embutido)";
                statusDesc.textContent = `Endpoint: ${st.endpoint || "Conectado"} | LAN 192.168.0.x Direta`;
                toggleBtn.style.display = "block";
                toggleBtn.textContent = "Desconectar";
                startBtn.textContent = "⚡ Reiniciar Conexão";
                if (btn) btn.classList.add("active");
            } else {
                card.className = "proton-status-card";
                statusTitle.textContent = "🔴 Roteador Inativo";
                statusDesc.textContent = st.hasConfig ? "Configuração salva pronta. Clique em ativar." : "Carregue ou cole o .conf para ativar.";
                toggleBtn.style.display = "none";
                startBtn.textContent = "⚡ Ativar Roteador WireGuard";
                if (btn) btn.classList.remove("active");
            }
        }

        startBtn.onclick = async () => {
            const text = confTextArea.value.trim();
            if (!text) {
                alert("Por favor, carregue ou cole o conteúdo do arquivo .conf do Proton VPN!");
                return;
            }
            startBtn.disabled = true;
            startBtn.textContent = "Iniciando WireGuard...";
            try {
                const bridge = getBridge();
                if (bridge && typeof bridge.start === "function") {
                    const res = await bridge.start(text);
                    if (res && res.ok) {
                        statusTitle.textContent = "🟢 Conectado com Sucesso!";
                        statusDesc.textContent = "O túnel WireGuard embutido está ativo e pronto.";
                    } else {
                        alert("Erro ao iniciar túnel: " + (res?.error || "Desconhecido"));
                    }
                } else {
                    alert("Bridge nativo do Proton VPN não disponível.");
                }
            } catch (err) {
                alert("Erro: " + err);
            }
            startBtn.disabled = false;
            await refreshModal();
        };

        toggleBtn.onclick = async () => {
            toggleBtn.disabled = true;
            try {
                const bridge = getBridge();
                if (bridge && typeof bridge.stop === "function") {
                    await bridge.stop();
                }
            } catch (_) {}
            toggleBtn.disabled = false;
            await refreshModal();
        };

        refreshModal();
    }

    // Attach button to Discord voice controls with native look
    function attachVoiceButton() {
        createStyles();

        // 1. Preferred location: Inside the voice connection action buttons (next to Krisp and Disconnect)
        const voiceContainer = document.querySelector('[class*="voiceButtonsContainer_"]');
        const userButtons = document.querySelector('div[class*="buttons_"]');
        const targetContainer = voiceContainer || userButtons;

        if (!targetContainer) return;

        let btn = document.getElementById("proton-vpn-voice-btn");
        if (!btn) {
            btn = document.createElement("button");
            btn.id = "proton-vpn-voice-btn";
            btn.type = "button";
            btn.title = "Proton VPN - Roteador de Chamadas";
            btn.setAttribute("aria-label", "Proton VPN - Roteador de Chamadas");
            btn.className = "button_Y-8oZW enabled_Y-8oZW button_9OQtot lookBlank_9OQtot colorBrand_9OQtot grow_9OQtot";
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
            btn.onclick = (e) => {
                e.stopPropagation();
                openModal();
            };
        }

        // If in voice container, insert before disconnect button
        if (voiceContainer) {
            const dcBtn = Array.from(voiceContainer.querySelectorAll("button")).find(b => (b.getAttribute("aria-label") || "").includes("Desconectar"));
            if (dcBtn && btn.nextSibling !== dcBtn) {
                voiceContainer.insertBefore(btn, dcBtn);
            } else if (!voiceContainer.contains(btn)) {
                voiceContainer.appendChild(btn);
            }
        } else if (userButtons && !userButtons.contains(btn)) {
            userButtons.appendChild(btn);
        }

        // Update active class
        checkStatus().then(st => {
            if (st.active) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    setInterval(attachVoiceButton, 1000);
    window.openProtonVPNModal = openModal;
    console.log(`${TAG} Proton VPN Call Router UI initialized!`);
})();
