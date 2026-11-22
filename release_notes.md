# 🚀 Bypass Janja Discord Screenshare - v1.1.0

Segunda versão estável do roteador de chamadas e compartilhamento de tela com WireGuard embutido para Discord (Vencord).

---

## 📋 Changelog (v1.1.0)

### ✨ Principais Novidades
- **🛡️ Roteamento Exclusivo para Discord (Internet 100% Protegida)**:
  - O túnel agora roteia exclusivamente a infraestrutura de voz, vídeo e screenshare do Discord (`66.22.192.0/18` + IP dinâmico do servidor de voz ativo).
  - Seus navegadores, jogos, Steam e downloads continuam na conexão normal e **sua internet nunca cai**, mesmo se a sessão do arquivo `.conf` expirar.
  - O DNS do sistema não é mais alterado por diretivas do WireGuard, prevenindo falhas de resolução ao encerrar a VPN.

- **⏱️ Watchdog de Sessão Automático**:
  - Monitoramento contínuo do handshake do WireGuard. Se o servidor encerrar a sessão por expiração da conta, o túnel é desligado automaticamente sem deixar rotas travadas.

- **🎨 Banner Oficial Meme & Nova Identidade Visual**:
  - Banner full-width no topo do repositório: *"Aqui não Janja!! FAZ O L NA PQP"* com selos de WireGuard, Proton VPN, 1080p60 e Ping LAN 0ms.
  - Badges profissionais Shields.io integradas no topo do README.
  - Tópicos e tags oficiais adicionados ao repositório no GitHub.

- **🔌 Integração Nativa no Catálogo de Plugins do Vencord**:
  - O plugin agora é automaticamente registrado nas tabelas de plugins do Vencord (`Oe` e `yi`).
  - Aparece diretamente em **Configurações de Usuário -> Vencord -> Plugins -> BypassJanjaDiscordScreenshare**, podendo ser ativado/desativado pelo switch nativo do Discord.

- **📦 Pacote de Instalação Simplificado (Extrair e Usar)**:
  - Eliminação completa de pastas intermediárias confusas (`/plugin`).
  - O arquivo `bypass-janja-discord-screenshare.zip` agora espelha 1:1 a pasta raiz do Vencord (`%APPDATA%\Vencord\`).
  - **Instalação sem comandos**: basta extrair o ZIP diretamente dentro de `%APPDATA%\Vencord\` e reiniciar o Discord!

- **📋 Pré-requisitos com Suporte a Winget e Links Oficiais**:
  - Documentados os 3 pré-requisitos essenciais com links fonte e comandos `winget`:
    - **Discord Desktop**: [discord.com/download](https://discord.com/download) (`winget install Discord.Discord`)
    - **Vencord**: [vencord.dev/download](https://vencord.dev/download) (`winget install Vendicated.Vencord`)
    - **WireGuard**: [wireguard.com/install](https://www.wireguard.com/install/) (`winget install WireGuard.WireGuard`)
  - Comando único para instalar todos de uma vez:
    ```cmd
    winget install Discord.Discord Vendicated.Vencord WireGuard.WireGuard
    ```

- **🆓 Configurações Gratuitas do Proton VPN**:
  - Documentação adicionada sobre como baixar arquivos `.conf` gratuitos de alta velocidade no link:
    👉 [account.protonvpn.com/downloads](https://account.protonvpn.com/downloads) (seção Downloads -> WireGuard).

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

Copie e envie para qualquer assistente de I.A. (funciona diretamente mesmo sem Git instalado):

```text
Você é um assistente técnico de automação no Windows. Execute a instalação e configuração do projeto "Bypass Janja Discord Screenshare" nesta máquina seguindo com rigor as etapas abaixo:

1. Verifique se o WireGuard está instalado. Se não estiver, instale-o via winget:
   winget install WireGuard.WireGuard --accept-package-agreements --accept-source-agreements --silent

2. Baixe o pacote oficial da release e extraia diretamente na pasta do Vencord (funciona mesmo sem Git):
   $zipUrl = "https://github.com/eojonathanoliveira/bypass-janja-discord-screenshare/releases/latest/download/bypass-janja-discord-screenshare.zip"
   $zipPath = "$env:TEMP\bypass-janja.zip"
   Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
   Expand-Archive -Path $zipPath -DestinationPath "$env:APPDATA\Vencord" -Force

3. Garanta que os binários do WireGuard estejam presentes em "$env:APPDATA\Vencord\bin\":
   - O pacote já inclui os binários standalone. Caso necessário, copie wireguard.exe e wg.exe de "C:\Program Files\WireGuard\" para "$env:APPDATA\Vencord\bin\".

4. Verifique o gancho de inicialização no patcher do Vencord:
   - No arquivo "$env:APPDATA\Vencord\dist\patcher.js", garanta que a primeira linha contenha:
     try { require("../loader.js"); } catch (e) {}

5. Reinicie o Discord:
   - Finalize os processos do Discord: Stop-Process -Name Discord -Force -ErrorAction SilentlyContinue
   - Inicie o Discord novamente via "$env:LOCALAPPDATA\Discord\Update.exe --processStart Discord.exe"

6. Informe ao usuário que a instalação foi concluída com sucesso! Para obter um arquivo .conf gratuito, basta acessar account.protonvpn.com/downloads.
```
