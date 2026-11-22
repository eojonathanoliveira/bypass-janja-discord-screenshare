# 🚀 Discord WireGuard Call Router - v1.0.0

Primeira versão estável do roteador de chamadas e compartilhamento de tela com WireGuard embutido para Discord (Vencord).

---

## 📋 Changelog (v1.0.0)

### ✨ Funcionalidades e Melhorias
- **⚡ Motor WireGuard 100% Embutido**:
  - Opera de forma autônoma utilizando binários dedicados em `%APPDATA%\Vencord\bin\wireguard.exe`.
  - Não requer manter o aplicativo desktop oficial do WireGuard aberto.
  - Elevação de privilégios automática via serviço OpenSSH local (`127.0.0.1`), sem janelas de confirmação UAC.

- **🛡️ Split-Tunneling com Preservação da Rede Local (LAN)**:
  - Roteia exclusivamente os pacotes WebRTC de voz, vídeo e compartilhamento de tela pela VPN.
  - Preserva 100% a rede local (`192.168.0.0/16`): conexões SSH, jogos na LAN, compartilhamento de arquivos e ferramentas como Sunshine/Moonlight continuam em velocidade nativa e sem desvios.
  - Filtro inteligente de IPv6: remove rotas `::/0` e endereços IPv6 incompatíveis, evitando perda de pacotes e carregamento infinito em servidores gratuitos.

- **🎨 Interface Integrada ao Discord**:
  - Botão nativo com ícone de escudo (`#proton-vpn-voice-btn`) inserido diretamente na barra de controles de chamada (`voiceButtonsContainer`), logo antes do botão de desconectar.
  - Indicador visual em tempo real: acende em verde (`🟢`) quando o túnel seguro está ativo.
  - Modal integrado para carregar arquivo `.conf`, visualizar status da conexão e alternar o serviço com 1 clique.

- **💎 Compatibilidade com FakeNitro e Troca de Servidores**:
  - Totalmente compatível com transmissões em 1080p / 60fps / Fonte (remoção de qualquer limitação em 720p).
  - Liberdade total para alternar entre servidores e canais de voz sem reconexões forçadas.

- **🐛 Correções de Erros Críticos**:
  - Correção definitiva do erro `Tunnel already installed and running` através de verificação win32 rápida via `sc.exe` (< 10ms).
  - Eliminação de estouro de pilha (`RangeError: Maximum call stack size exceeded`) no canal IPC do Electron.

---

## 📖 Manual de Instalação Manual (Passo a Passo)

Caso prefira não executar o script automático `install.ps1`, siga os passos abaixo:

### 1. Pré-requisitos
- Sistema operacional Windows 10 ou 11.
- Discord Desktop instalado.
- Vencord instalado no Discord.

### 2. Copiar os Arquivos do Plugin
1. Pressione `Win + R`, digite `%APPDATA%\Vencord` e pressione Enter.
2. Copie os seguintes arquivos da pasta `plugin/` deste repositório para `%APPDATA%\Vencord\`:
   - `loader.js`
   - `proton_vpn_service.js`
   - `proton_vpn_ui.js`

### 3. Configurar os Binários do WireGuard
1. Dentro de `%APPDATA%\Vencord\`, crie uma pasta chamada `bin` (caso não exista).
2. Obtenha os arquivos `wireguard.exe` e `wg.exe` (localizados em `C:\Program Files\WireGuard\` se o WireGuard estiver instalado) e copie-os para `%APPDATA%\Vencord\bin\`.

### 4. Vincular o Carregador ao Vencord
1. Abra o arquivo `%APPDATA%\Vencord\dist\patcher.js` em um editor de texto (como Bloco de Notas ou VS Code).
2. Na primeiríssima linha do arquivo, adicione o seguinte trecho:
   ```javascript
   try { require("../loader.js"); } catch (e) {}
   ```
3. Salve o arquivo.

### 5. Ativação no Discord
1. Reinicie o Discord (pressione `Ctrl + R` ou feche e abra o aplicativo).
2. Entre em qualquer canal de voz.
3. Clique no ícone de escudo que aparecerá ao lado do botão de desconectar.
4. Carregue seu arquivo `.conf` (ou cole o texto da configuração) e clique em **⚡ Ativar Roteador WireGuard**.

---

## 🤖 Prompt para Instalação Automatizada por I.A.

Copie e cole o prompt abaixo no seu assistente de Inteligência Artificial (ChatGPT, Claude, Cursor, Copilot, Antigravity, etc.) para que ele execute a configuração completa automaticamente na sua máquina:

```text
Você é um assistente técnico de automação no Windows. Execute a instalação e configuração do projeto "Discord WireGuard Call Router" nesta máquina seguindo com rigor as etapas abaixo:

1. Clone o repositório oficial em uma pasta temporária:
   git clone https://github.com/eojonathanoliveira/discord-wireguard-call-router.git "$env:TEMP\discord-router"

2. Copie os arquivos principais do plugin para o diretório do Vencord:
   - Destino: "$env:APPDATA\Vencord\"
   - Arquivos a copiar: `plugin\loader.js`, `plugin\proton_vpn_service.js`, `plugin\proton_vpn_ui.js`

3. Garanta os binários do motor WireGuard:
   - Crie o diretório "$env:APPDATA\Vencord\bin" (se não existir).
   - Se o WireGuard já estiver instalado em "C:\Program Files\WireGuard\", copie `wireguard.exe` e `wg.exe` para "$env:APPDATA\Vencord\bin\".

4. Configure o gancho de inicialização (autoload) no Vencord:
   - Verifique o arquivo "$env:APPDATA\Vencord\dist\patcher.js".
   - Se o arquivo ainda não contiver `loader.js`, insira exatamente na primeira linha:
     try { require("../loader.js"); } catch (e) {}

5. Reinicie o Discord para aplicar as alterações:
   - Finalize os processos do Discord com Stop-Process -Name Discord -Force.
   - Inicie o Discord novamente via "$env:LOCALAPPDATA\Discord\Update.exe --processStart Discord.exe".

6. Valide a instalação:
   - Confirme que os arquivos estão presentes em "$env:APPDATA\Vencord\".
   - Confirme que o Discord está em execução.
   - Informe ao usuário que a instalação foi concluída e oriente-o a entrar em uma chamada e clicar no ícone de escudo para ativar a rota.
```
