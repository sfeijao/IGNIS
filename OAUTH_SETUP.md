# 🔧 Configuração OAuth2 Discord

## ❌ Problema Identificado
Erro 400 no OAuth2: `Bad Request` - indica que o `redirect_uri` não está configurado no Discord Developer Portal.

## ✅ Como Corrigir

### 1. Acesse o Discord Developer Portal
- Vá para: https://discord.com/developers/applications
- Selecione a aplicação do YSNM Bot (ID: `1404584949285388339`)

### 2. Configure OAuth2 Redirects
Na seção **OAuth2** → **Redirects**:

**Para desenvolvimento local:**
```
http://localhost:4000/auth/discord/callback
```

**Para produção Railway:**
```
https://ysnmbot-alberto.up.railway.app/auth/discord/callback
```

### 3. Configurar Scopes
Na seção **OAuth2** → **Scopes**, certifique-se que tem:
- ✅ `identify` - Acesso aos dados básicos do utilizador
- ✅ `guilds` - Acesso à lista de servidores do utilizador

### 4. Verificar Configuração Local
Execute o bot e verifique os logs:
```bash
node index.js
```

Acesse: `http://localhost:4000/auth/debug` para ver a configuração atual.

## 🔍 URLs de Teste

**Desenvolvimento:**
- Dashboard: http://localhost:4000
- Login: http://localhost:4000/login
- Debug OAuth: http://localhost:4000/auth/debug

**Produção:**
- Dashboard: https://ysnmbot-alberto.up.railway.app
- Login: https://ysnmbot-alberto.up.railway.app/login

## 📝 Variáveis de Ambiente Necessárias

Certifique-se que tem no `.env` ou nas variáveis de ambiente:
```bash
DISCORD_TOKEN=seu_token_aqui
CLIENT_ID=1404584949285388339
CLIENT_SECRET=seu_client_secret_aqui
DISCORD_GUILD_ID=seu_guild_id_aqui
```

## 🚨 Passos de Troubleshooting

1. **Verificar CLIENT_ID**: Deve ser `1404584949285388339`
2. **Verificar CLIENT_SECRET**: Não pode estar vazio
3. **Verificar Redirects**: Devem estar configurados no Discord Developer Portal
4. **Testar localmente**: `http://localhost:4000/auth/debug`
5. **Ver logs**: O bot deve mostrar a URL de callback ao iniciar

## ⚡ Solução Rápida
Se o problema persistir, adicione ambas as URLs no Discord Developer Portal:
- `http://localhost:4000/auth/discord/callback`
- `https://ysnmbot-alberto.up.railway.app/auth/discord/callback`
