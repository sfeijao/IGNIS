# 🤖 IGNIS Community Discord Bot

![Discord](https://img.shields.io/badge/Discord.js-v14.14.1-blue.svg)
[![Node CI](https://github.com/sfeijao/IGNIS_BOT/actions/workflows/node-ci.yml/badge.svg)](https://github.com/sfeijao/IGNIS_BOT/actions/workflows/node-ci.yml)
[![Markdownlint](https://github.com/sfeijao/IGNIS_BOT/actions/workflows/markdownlint.yml/badge.svg)](https://github.com/sfeijao/IGNIS_BOT/actions/workflows/markdownlint.yml)
![Node.js](https://img.shields.io/badge/Node.js-16.9.0+-green.svg)
![Railway](https://img.shields.io/badge/Railway-Deploy%20Ready-purple.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

**Bot Discord completo para a comunidade IGNIS com sistema de verificação, gestão de tags, logs automáticos e tema roxo personalizado.**

[🚀 Deploy no Railway](#-deploy-no-railway) • [📖 Documentação](#-comandos-disponíveis) • [⚙️ Configuração](#️-configuração)

---

## 🚀 Funcionalidades

### 🔐 **Sistema de Verificação Automática**

- ✅ Painel de verificação com botão interativo
- 📝 Logs automáticos de novos membros verificados
- 🎉 Mensagens de boas-vindas personalizadas
- 🛡️ Proteção anti-spam e verificação dupla

### 🏷️ **Sistema de Tags/Cargos Avançado**

- 👑 Painel de gestão de tags para staff
- 📋 Solicitação de tags especiais pelos utilizadores
- 🎯 Tags básicas (VIP, Member) e administrativas (Mod, Support)
- ✅ Sistema de aprovação automático para cargos especiais

### 📊 **Painel de Status em Tempo Real**

- 💜 **Tema roxo personalizado** (#7B68EE, #9932CC, #8B5FBF)
- 📈 Monitorização em tempo real do servidor
- 🔄 Botões interativos (Atualizar, Detalhes, Sistema)
- 📊 Estatísticas de performance e uptime
- 🌐 Status da API Discord e base de dados

### 📝 **Sistema de Logs Completo**

- 📥 Logs automáticos de verificações
- 👥 Logs de entrada/saída de membros
- ⚡ Logs de ações administrativas
- 🕒 Timestamps e informações detalhadas

## 🎮 Comandos Disponíveis

### 📌 **Comandos Básicos**

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `/ping` | Testa a latência do bot | `/ping` |
| `/ajuda` | Lista completa de comandos | `/ajuda` |
| `/info-servidor` | Informações do servidor | `/info-servidor` |


### ⚙️ **Comandos de Configuração** (Apenas Admins)

| Comando | Descrição | Permissão |
|---------|-----------|-----------|
| `/configurar-verificacao` | Configura painel de verificação | Administrator |
| `/configurar-tags` | Configura painel de gestão de tags | Administrator |
| `/configurar-status` | Configura painel de status roxo | Administrator |
| `/dar-cargo` | Atribui cargo a um membro | Administrator |
| `/remover-cargo` | Remove cargo de um membro | Administrator |


### 🏷️ **Sistema de Tags**

| Comando | Descrição | Acesso |
|---------|-----------|---------|
| `/solicitar-tag` | Solicita tags especiais | Todos os membros |

---

## 🚀 Deploy no Railway

### **Método 1: Deploy Direto (Recomendado)**

1. **Fork este repositório** no GitHub
2. **Acesse [Railway.app](https://railway.app)** e faça login
3. **Clique em "New Project"** → **"Deploy from GitHub repo"**
4. **Selecione o repositório** IGNIS que você fez fork
5. **Adicione as variáveis de ambiente** (ver [Configuração](#️-configuração))
6. **Clique em Deploy** - O Railway detecta automaticamente as configurações!

### **Método 2: Deploy Manual**

```bash
# 1. Clone o repositório
git clone https://github.com/SEU_USUARIO/IGNIS-Discord-Bot.git
cd IGNIS-Discord-Bot

# 2. Instale dependências
npm install

# 3. Configure variáveis de ambiente
cp .env.example .env
# Edite o .env com seus dados

# 4. Deploy comandos
npm run deploy

# 5. Inicie o bot
npm start
```

---

## ⚙️ Configuração

### 🔑 **Variáveis de Ambiente Obrigatórias**

Adicione estas variáveis no Railway ou no seu arquivo `.env`:

```env
# 🤖 Configurações do Bot Discord
DISCORD_TOKEN=SEU_TOKEN_AQUI
CLIENT_ID=SEU_CLIENT_ID_AQUI
GUILD_ID=1333820000791691284

# 📺 IDs dos Canais
VERIFICATION_CHANNEL_ID=1333825066928214056
LOGS_CHANNEL_ID=1333825113212407829
STATUS_CHANNEL_ID=1333825139275378689
SOLICITAR_TAG_CHANNEL_ID=1333825165732786237
COMANDOS_ADM_CHANNEL_ID=1333825189048999946

# 👥 IDs dos Cargos
VERIFIED_ROLE_ID=1333825223484645378
ADMIN_ROLE_ID=1333825248281772092
STAFF_ROLE_ID=1333825272423505950
OWNER_ROLE_ID=1333825295668613131
VIP_ROLE_ID=1333825318678355999
MEMBER_ROLE_ID=1333825341503823882
MOD_ROLE_ID=1333825364593303552
SUPPORT_ROLE_ID=1333825387162554398
```

### 🔧 **Arquivo de Configuração (config.json)**

O bot inclui um arquivo `config.json` pré-configurado:

```json
{
  "guildId": "1333820000791691284",
  "channels": {
    "verification": "1333825066928214056",
    "logs": "1333825113212407829",
    "status": "1333825139275378689",
    "solicitarTag": "1333825165732786237",
    "comandosAdm": "1333825189048999946"
  },
  "roles": {
    "verified": "1333825223484645378",
    "admin": "1333825248281772092",
    "staff": "1333825272423505950",
    "owner": "1333825295668613131",
    "vip": "1333825318678355999",
    "member": "1333825341503823882",
    "mod": "1333825364593303552",
    "support": "1333825387162554398"
  }
}
```

---

## 🛠️ Estrutura do Projeto

```text
IGNIS-Discord-Bot/
├── 📁 commands/           # Comandos do bot
│   ├── ajuda.js          # Sistema de ajuda
│   ├── configurar-status.js   # Painel roxo de status
│   ├── configurar-tags.js     # Gestão de tags
│   ├── configurar-verificacao.js  # Sistema verificação
│   ├── dar-cargo.js      # Atribuir cargos
│   ├── info-servidor.js  # Info do servidor
│   ├── ping.js          # Teste de latência
│   ├── remover-cargo.js  # Remover cargos
│   └── solicitar-tag.js  # Solicitar tags
├── 📁 events/            # Eventos do bot
│   ├── ready.js         # Bot online
│   ├── interactionCreate.js  # Comandos e botões
│   └── guildMemberAdd.js     # Novos membros
├── 📄 index.js          # Arquivo principal
├── 📄 config.json       # Configurações
├── 📄 package.json      # Dependências
├── 📄 railway.json      # Config Railway
├── 📄 Procfile         # Config deploy
├── 📄 .env.example     # Exemplo variáveis
├── 📄 .gitignore       # Arquivos ignorados
└── 📄 README.md        # Documentação
```

---

## � Private delivery (PRIVATE_LOG_ENDPOINT)

The bot supports sending archived ticket payloads to a private endpoint under your control. Use the following environment variables:

- `PRIVATE_LOG_ENDPOINT` — URL to POST ticket payloads (example: `https://example.com/hooks/tickets`).
- `PRIVATE_LOG_TOKEN` — optional Bearer token the receiver should expect.
- `PRIVATE_LOG_HMAC_SECRET` — optional HMAC secret; when set the bot will sign payloads with HMAC-SHA256 using a timestamped scheme.
- `PRIVATE_LOG_HMAC_TTL` — TTL in seconds for timestamped signatures (default 300).

Security recommendations:

- Use HTTPS and a trusted certificate for any public endpoint.
- Use `PRIVATE_LOG_HMAC_SECRET` and verify signatures server-side; prefer timestamped signatures to avoid replay attacks.
- Rotate shared secrets periodically and store them in a secure secret manager.
- Consider additional authentication layers (mutual TLS, IP allow lists) for production.

The repo includes an example local receiver under `examples/private-receiver/` with tests and a small helper `website/utils/privateLogger.js` that signs payloads and retries on failure.

---

## �📋 Passo a Passo para Discord Developer

### 1. **Criar Aplicação Discord**

1. Acesse [Discord Developer Portal](https://discord.com/developers/applications)
2. Clique em **"New Application"**
3. Nomeie como **"IGNIS Bot"**
4. Vá para **"Bot"** → **"Add Bot"**
5. Copie o **Token** (DISCORD_TOKEN)
6. Copie o **Application ID** (CLIENT_ID)

### 2. **Configurar Permissões**

Em **OAuth2** → **URL Generator**:

- **Scopes**: `bot`, `applications.commands`
- **Permissions**: `Administrator` (ou permissões específicas)

### 3. **Adicionar ao Servidor**

1. Gere a URL de convite
2. Adicione o bot ao seu servidor
3. Execute `/deploy-commands` para registrar comandos slash

---

## Funcionalidades Técnicas

### 🎨 **Tema Roxo Personalizado**

- **Cores principais**: `#7B68EE`, `#9932CC`, `#8B5FBF`
- **Embeds responsivos** com gradientes roxos
- **Botões interativos** com emojis funcionais
- **Design moderno** e profissional

### ⚡ **Performance**

- **Discord.js v14** - Última versão estável
- **Slash Commands** - Comandos nativos Discord
- **Event-driven** - Arquitetura eficiente
- **Error handling** - Tratamento robusto de erros

### 🔒 **Segurança**

- **Verificação de permissões** em todos comandos admin
- **Rate limiting** automático
- **Logs detalhados** de todas ações
- **Configurações isoladas** por servidor

---

## 🐛 Solução de Problemas

### **Bot não responde aos comandos**

```bash
# Verifique se os comandos foram registrados
npm run deploy

# Reinicie o bot
npm start
```

### **Emojis aparecem como quadrados**

- ✅ **Resolvido!** Emojis Unicode funcionais
- Tema roxo com emojis nativos Discord

### **Erro de permissões**

- Verifique se o bot tem permissão **Administrator**
- Confirme IDs de canais e cargos no `config.json`

### **Deploy Railway falha**

- Confirme variáveis de ambiente no Railway
- Verifique logs no dashboard Railway
- NODE_ENV deve estar como **production**

---

## 📝 Changelog

### **v2.1.0** (Atual)

- ✅ **Tema roxo** completo implementado
- ✅ **Emojis funcionais** (não mais quadrados)
- ✅ **Painel de status** interativo
- ✅ **Deploy Railway** otimizado
- ✅ **Documentação** completa GitHub

### **v2.0.0**

- 🔄 Migração para Discord.js v14
- ⚡ Slash commands implementados
- 🎨 Interface renovada
- 📊 Sistema de status avançado

---

## 👥 Contribuição

1. **Fork** o repositório
2. **Crie** uma branch: `git checkout -b feature/nova-funcionalidade`
3. **Commit** suas mudanças: `git commit -m 'Adiciona nova funcionalidade'`
4. **Push** para a branch: `git push origin feature/nova-funcionalidade`
5. **Abra** um Pull Request

---

## 📜 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## 🔗 Links Úteis

- 📘 [Documentação Discord.js](https://discord.js.org/)
- 🚀 [Railway Docs](https://docs.railway.app/)
- 🤖 [Discord Developer Portal](https://discord.com/developers/applications)
- 💜 [IGNIS Community](https://discord.gg/ignis)

---

> Desenvolvido com 💜 para IGNIS Community

[![Discord](https://img.shields.io/discord/GUILD_ID?color=7289da&logo=discord&logoColor=white)](https://discord.gg/ignis)
[![GitHub](https://img.shields.io/github/stars/USUARIO/IGNIS-Discord-Bot?style=social)](https://github.com/USUARIO/IGNIS-Discord-Bot)

```bash
git clone <seu-repositorio>
cd ignis-community-bot
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configuração

1. Copie `.env.example` para `.env`
2. Preencha as variáveis no arquivo `.env`:

```env
DISCORD_TOKEN=seu_token_aqui
CLIENT_ID=id_do_cliente
GUILD_ID=id_do_servidor
```

1. Configure os IDs no arquivo `config.json`:

```json
{
  "token": "SEU_TOKEN_AQUI",
  "clientId": "SEU_CLIENT_ID_AQUI",
  "guildId": "SEU_GUILD_ID_AQUI",
  "channels": {
    "verification": "ID_DO_CANAL_VERIFICACAO",
    "logs": "ID_DO_CANAL_LOGS",
    "status": "ID_DO_CANAL_STATUS",
    "solicitarTag": "ID_DO_CANAL_SOLICITAR_TAG",
    "comandosAdm": "ID_DO_CANAL_COMANDOS_ADM"
  },
  "roles": {
    "verified": "ID_DO_CARGO_VERIFICADO",
    "admin": "ID_DO_CARGO_ADMIN",
    "staff": "ID_DO_CARGO_STAFF",
    "owner": "ID_DO_CARGO_OWNER",
    "vip": "ID_DO_CARGO_VIP",
    "member": "ID_DO_CARGO_MEMBER",
    "mod": "ID_DO_CARGO_MOD",
    "support": "ID_DO_CARGO_SUPPORT"
  }
}
```

### 4. Deploy dos Comandos

```bash
npm run deploy
```

### 5. Iniciar o Bot

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 🚀 Deploy para Railway

### 1. Configuração no Railway

1. Conecte seu repositório GitHub ao Railway
2. Configure as variáveis de ambiente:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- Todas as outras variáveis do `.env`

### 2. Arquivo railway.json (opcional)

```json
{
  "build": {
    "command": "npm install"
  },
  "start": {
    "command": "npm start"
  }
}
```

---

## 🔧 Configuração do Servidor Discord

### Permissões Necessárias

O bot precisa das seguintes permissões:

- Ler Mensagens

---

## 📝 Notas importantes (mudanças recentes)

- O esquema da base de dados (`website/database/schema.sql`) foi atualizado para incluir duas colunas na tabela `tickets` usadas pelas novas features de arquivamento e envio de webhook:
  - `bug_webhook_sent INTEGER DEFAULT 0` — flag para evitar envios duplicados ao bug server
  - `archived INTEGER DEFAULT 0` — marca tickets arquivados para exclusão de listas ativas

- Logging: o backend foi migrado para usar um logger central (`utils/logger.js`) em vez de `console.*`. Isso melhora rotacionamento e estrutura dos logs.

- Testes: há scripts de testes e2e/unit em `website/tools/`. Execute o mock webhook e depois o e2e para validar o fluxo de arquivar/fechar tickets:

```powershell
# Em um terminal
node website/tools/mock-webhook-server.js

# Em outro terminal
node website/tools/e2e-ticket-test.js
```

Se quiser que eu execute o e2e agora ou abra um PR com estas alterações, diga-me e eu faço isso.

- Enviar Mensagens
- Usar Comandos de Barra
- Gerenciar Cargos
- Ver Histórico de Mensagens
- Adicionar Reações
- Usar Embeds

### Canais Necessários

Crie os seguintes canais no seu servidor:

- `#verificar` - Canal de verificação
- `#logs-verificação` - Canal de logs
- `#status` - Canal de status do bot
- `#solicitar-tag` - Canal para pedidos de tags
- `#comandos-adm` - Canal para comandos administrativos

### Cargos Necessários

Crie os seguintes cargos:

- `Verificado` - Cargo dado após verificação
- `Admin` - Cargo de administrador
- `Staff` - Cargo de staff
- `Owner` - Cargo de dono
- `VIP` - Tag VIP
- `Member` - Tag de membro
- `Mod` - Tag de moderador
- `Support` - Tag de suporte

## 📁 Estrutura do Projeto

```text
ignis-community-bot/
├── commands/           # Comandos slash
│   ├── ajuda.js
│   ├── configurar-verificacao.js
│   ├── configurar-tags.js
│   ├── configurar-status.js
│   ├── ping.js
│   └── solicitar-tag.js
├── events/             # Eventos do Discord
│   ├── ready.js
│   ├── interactionCreate.js
│   └── guildMemberAdd.js
├── config.json         # Configurações do bot
├── .env.example        # Exemplo de variáveis de ambiente
├── deploy-commands.js  # Script para deploy dos comandos
├── index.js           # Arquivo principal
├── package.json       # Dependências e scripts
└── README.md          # Este arquivo
```

## 🛠️ Personalização

### Adicionando Novos Comandos

1. Crie um arquivo `.js` na pasta `commands/`
2. Use a estrutura padrão:

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nome-comando')
        .setDescription('Descrição do comando'),
    async execute(interaction) {
        // Lógica do comando
    },
};
```

### Adicionando Novos Eventos

1. Crie um arquivo `.js` na pasta `events/`
2. Use a estrutura padrão:

```javascript
const { Events } = require('discord.js');

module.exports = {
    name: Events.EventName,
    async execute(...args) {
        // Lógica do evento
    },
};
```

## 🔍 Troubleshooting

### Bot Não Inicia

- Verifique se o token está correto
- Confirme se todas as dependências estão instaladas
- Verifique os logs de erro no console

### Comandos Não Aparecem

- Execute `npm run deploy` para registrar os comandos
- Verifique se o CLIENT_ID e GUILD_ID estão corretos
- Aguarde alguns minutos para o Discord processar

### Permissões Negadas

- Verifique se o bot tem as permissões necessárias
- Confirme se os IDs dos cargos e canais estão corretos
- Verifique a hierarquia de cargos

## 📞 Suporte

Para suporte, entre em contacto através do servidor Discord da IGNIS Community.

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

---

Desenvolvido com ❤️ para a IGNIS Community
