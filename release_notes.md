# 🚀 Bypass Janja Discord Screenshare - v1.1.0

Segunda versão estável do roteador de chamadas e compartilhamento de tela com WireGuard embutido para Discord (Vencord).

---

## 📋 Changelog (v1.1.0)

### ✨ Principais Novidades
- **🎨 Nova Identidade Visual - "Bypass Janja Discord Screenshare"**:
  - Modal estilizado com banner e avatar caricatural embutido em alta resolução.
  - Título oficial atualizado no cabeçalho e na barra de controle de voz.
  - Badge dedicada `WIREGUARD SCREEN & VOICE ROUTER`.

- **📦 Pacote de Instalação Simplificado (Extrair e Usar)**:
  - Eliminação completa de pastas intermediárias confusas (`/plugin`).
  - O arquivo `bypass-janja-discord-screenshare.zip` agora espelha 1:1 a pasta raiz do Vencord (`%APPDATA%\Vencord\`).
  - **Instalação sem comandos**: basta extrair o ZIP diretamente dentro de `%APPDATA%\Vencord\` e reiniciar o Discord!

- **⚡ Dependência WireGuard via Winget**:
  - Instalação oficial do WireGuard simplificada para apenas **1 comando**:
    ```cmd
    winget install WireGuard.WireGuard
    ```
  - O script `install.bat` / `install.ps1` agora verifica automaticamente a presença do WireGuard e executa o winget caso necessário.

- **🆓 Configurações Gratuitas do Proton VPN**:
  - Documentação adicionada sobre como baixar arquivos `.conf` gratuitos de alta velocidade no link:
    👉 [account.protonvpn.com/security](https://account.protonvpn.com/security) (seção Downloads -> WireGuard).

- **🛠️ Correção e Estabilidade no Carregador IPC**:
  - Resolução do erro `RangeError: Maximum call stack size exceeded` através de carregador isolado sem dependência de resolução recursiva do Discord.
  - Sincronização e resposta do status da VPN em tempo real (< 10ms).

---

## 🚀 Como Instalar

### Método 1: Extrair e Reiniciar (Sem Comandos) ⭐ RECOMENDADO
1. Baixe o arquivo **`bypass-janja-discord-screenshare.zip`** anexado a esta Release.
2. Pressione `Win + R`, digite `%APPDATA%\Vencord` e pressione Enter.
3. Extraia todos os arquivos do ZIP diretamente dentro da pasta `%APPDATA%\Vencord\`.
4. Reinicie o Discord (`Ctrl + R`).

### Método 2: Instalador em 1 Clique
1. Baixe o ZIP e execute `install.bat` com duplo clique.
2. O instalador cuidará de copiar os arquivos, instalar o WireGuard se necessário e ativar o plugin.
3. Reinicie o Discord.

---

## 🤖 Prompt para Instalação Automatizada por I.A.

Copie e envie para qualquer assistente de I.A.:

```text
Você é um assistente técnico de automação no Windows. Execute a instalação e configuração do projeto "Bypass Janja Discord Screenshare" nesta máquina seguindo com rigor as etapas abaixo:

1. Verifique se o WireGuard está instalado. Se não estiver, instale-o via winget:
   winget install WireGuard.WireGuard --accept-package-agreements --accept-source-agreements --silent

2. Clone o repositório oficial em uma pasta temporária:
   git clone https://github.com/eojonathanoliveira/bypass-janja-discord-screenshare.git "$env:TEMP\discord-router"

3. Copie os arquivos do plugin diretamente para a raiz do Vencord:
   - Destino: "$env:APPDATA\Vencord\"
   - Arquivos a copiar: loader.js, proton_vpn_service.js, proton_vpn_ui.js, proton_vpn.example.conf
   - Copie a pasta assets\ para "$env:APPDATA\Vencord\assets\"

4. Copie os binários standalone do WireGuard para "$env:APPDATA\Vencord\bin\":
   - Crie a pasta se não existir.
   - Copie wireguard.exe e wg.exe de "C:\Program Files\WireGuard\" para "$env:APPDATA\Vencord\bin\".

5. Configure o gancho de inicialização no patcher do Vencord:
   - No arquivo "$env:APPDATA\Vencord\dist\patcher.js", garanta que a primeira linha contenha:
     try { require("../loader.js"); } catch (e) {}

6. Reinicie o Discord:
   - Finalize os processos do Discord: Stop-Process -Name Discord -Force -ErrorAction SilentlyContinue
   - Inicie o Discord novamente via "$env:LOCALAPPDATA\Discord\Update.exe --processStart Discord.exe"

7. Informe ao usuário que a instalação foi concluída com sucesso! Para obter um arquivo .conf gratuito, basta acessar account.protonvpn.com/security.
```
