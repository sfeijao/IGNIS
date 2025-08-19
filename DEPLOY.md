# 🚀 DEPLOY RÁPIDO - YSNM Discord Bot

## ⚡ Railway Deploy em 5 Passos

### 1. 📁 **Preparar Repositório GitHub**
```bash
# Fazer upload dos arquivos para GitHub
# Certifica-te que o .env NÃO está incluído (só .env.example)
```

### 2. 🔗 **Conectar Railway**
1. Acede a [railway.app](https://railway.app)
2. Clica **"New Project"** → **"Deploy from GitHub repo"**
3. Seleciona o repositório **YSNM-Discord-Bot**
4. Railway detecta automaticamente o Node.js

### 3. ⚙️ **Configurar Variáveis de Ambiente**

No Railway Dashboard, vai a **"Variables"** e adiciona:

```env
DISCORD_TOKEN=MEU_TOKEN_REAL_AQUI
CLIENT_ID=1404584949285388339
GUILD_ID=1333820000791691284

# IDs dos Canais (atualiza conforme teu servidor)
VERIFICATION_CHANNEL_ID=1333825066928214056
LOGS_CHANNEL_ID=1333825113212407829
STATUS_CHANNEL_ID=1333825139275378689
SOLICITAR_TAG_CHANNEL_ID=1333825165732786237
COMANDOS_ADM_CHANNEL_ID=1333825189048999946

# IDs dos Cargos (atualiza conforme teu servidor)
VERIFIED_ROLE_ID=1333825223484645378
ADMIN_ROLE_ID=1333825248281772092
STAFF_ROLE_ID=1333825272423505950
OWNER_ROLE_ID=1333825295668613131
VIP_ROLE_ID=1333825318678355999
MEMBER_ROLE_ID=1333825341503823882
MOD_ROLE_ID=1333825364593303552
SUPPORT_ROLE_ID=1333825387162554398
```

### 4. 🚀 **Deploy Automático**
- Railway automaticamente:
  - ✅ Executa `npm install`
  - ✅ Executa `npm run deploy` (regista comandos)
  - ✅ Executa `npm start` (inicia bot)

### 5. ✅ **Verificar Status**
- No Railway Dashboard: **"Deployments"**
- Logs devem mostrar: **"✅ YSNMbot está online!"**

---

## 🔧 Comandos Úteis

### **Atualizar Comandos Discord**
```bash
# Localmente (depois fazer push)
npm run deploy
```

### **Ver Logs Railway**
```bash
# No Railway Dashboard → "Deployments" → Ver logs
```

### **Reiniciar Bot**
```bash
# No Railway Dashboard → "Settings" → "Restart"
```

---

## 🆘 Resolução de Problemas

### ❌ **Bot não inicia**
1. **Verifica variáveis de ambiente** no Railway
2. **Verifica TOKEN válido** no Discord Developer Portal
3. **Verifica logs** no Railway Dashboard

### ❌ **Comandos não funcionam**
1. **Bot tem permissões Administrator** no servidor?
2. **IDs de canais/cargos corretos** no config.json?
3. **Comandos registados** com `npm run deploy`?

### ❌ **Deploy falha**
1. **package.json tem start script**?
2. **railway.json configurado**?
3. **Node.js versão compatível** (>=16.9.0)?

---

##  Suporte

- 🐛 **Bugs**: [Issues GitHub](https://github.com/SEU_USUARIO/YSNM-Discord-Bot/issues)
- 💬 **Discussões**: [Discord YSNM](https://discord.gg/ysnm)
- 📖 **Docs**: [README completo](README.md)

---

**🎉 Bot online? Testa com `/ping` no Discord!**
