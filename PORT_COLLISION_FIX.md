# 🔧 Port Collision Fix - Railway Deployment

## ❌ Problema Identificado

O bot estava entrando em **crash loop** no Railway com o erro:

```
Error: listen EADDRINUSE: address already in use :::8080
```

### Causa Raiz

Havia **dois servidores Express tentando escutar na mesma porta 8080**:

1. **railway-start.js** (linha 71): Criava um servidor HTTP com health endpoint
2. **dashboard/server.js** (linha 9085): Criava outro servidor HTTP completo

Quando o bot iniciava em **modo FULL** (bot + dashboard), ambos os servidores tentavam usar a porta 8080 simultaneamente, causando o conflito.

## ✅ Solução Implementada

### 1. Refatoração do `railway-start.js`

**ANTES:**
```javascript
async function railwayStart() {
    // Criar servidor HTTP SEMPRE (modo full e bot-only)
    const app = express();
    const server = app.listen(port, () => {
        logger.info(`🏥 Health endpoint ativo na porta ${port}`);
    });
    
    // Depois iniciar o bot/dashboard
    if (startMode === 'full') {
        require('./index.js'); // ❌ Causa conflito!
    }
}
```

**DEPOIS:**
```javascript
async function railwayStart() {
    try {
        // 5. Iniciar modo apropriado
        if (startMode === 'full') {
            logger.info('\n🚀 Iniciando modo COMPLETO...');
            
            // ✅ index.js carrega dashboard/server.js que já escuta na porta
            require('./index.js');
            
        } else {
            logger.info('\n🤖 Iniciando modo BOT-ONLY...');
            
            // ✅ Criar health endpoint APENAS para bot-only
            const express = require('express');
            const app = express();
            const port = process.env.PORT || 3000;
            
            app.get('/health', (req, res) => {
                res.json({ status: 'ok', mode: 'bot-only' });
            });
            
            app.listen(port, () => {
                logger.info(`🏥 Health endpoint ativo na porta ${port} (bot-only mode)`);
            });
            
            const { startBotOnly } = require('./bot-only');
            await startBotOnly();
        }
    } catch (error) {
        // ✅ Exit em erro para Railway reiniciar
        process.exit(1);
    }
}
```

### 2. Adição de Health Endpoint no `dashboard/server.js`

Adicionado endpoint simples `/health` para Railway verificar a saúde da aplicação:

```javascript
// Railway health check (simple endpoint at root /health)
app.get('/health', (req, res) => {
    try {
        const client = global.discordClient;
        const botReady = !!(client && (typeof client.isReady === 'function' ? client.isReady() : client?.readyAt));
        res.json({
            status: 'ok',
            bot: botReady,
            mode: 'full',
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        logger.error('Error in /health endpoint:', e);
        res.status(503).json({ status: 'error', error: e.message });
    }
});
```

## 🎯 Resultado

### Modo FULL (Bot + Dashboard):
- **1 servidor** na porta 8080 (dashboard/server.js)
- Health endpoints: `/health` e `/api/health`
- Sem conflito de portas ✅

### Modo BOT-ONLY:
- **1 servidor** na porta 8080 (railway-start.js)
- Health endpoint: `/health`
- Bot funciona sem dashboard ✅

## 🚀 Deploy

### Variáveis Necessárias no Railway:

```env
# Obrigatórias
DISCORD_TOKEN=seu_token_aqui
CLIENT_ID=seu_client_id
PORT=8080

# Para modo FULL (bot + dashboard)
CLIENT_SECRET=seu_client_secret
DISCORD_CLIENT_SECRET=seu_client_secret

# Para modo BOT-ONLY
# Omitir CLIENT_SECRET
```

### Configuração do Railway:

1. **Start Command**: `node railway-start.js`
2. **Port**: `8080` (Railway fornece via `$PORT`)
3. **Health Check**: `GET /health`
4. **Restart Policy**: On failure

## 📊 Endpoints de Health Check

### `/health` (Simples)
Resposta rápida para health checks do Railway:
```json
{
  "status": "ok",
  "bot": true,
  "mode": "full",
  "timestamp": "2025-12-23T00:00:00.000Z"
}
```

### `/api/health` (Detalhado - apenas modo full)
Informações completas do sistema:
```json
{
  "success": true,
  "dashboard": true,
  "discord": true,
  "mongo": "connected",
  "mongoError": null,
  "storage": "mongo",
  "time": "2025-12-23T00:00:00.000Z"
}
```

## 🧪 Testes Locais

### Testar modo FULL:
```bash
# Com CLIENT_SECRET
CLIENT_SECRET=test node railway-start.js
```

### Testar modo BOT-ONLY:
```bash
# Sem CLIENT_SECRET
node railway-start.js
```

### Verificar health endpoints:
```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/health
```

## 📝 Arquivos Modificados

1. ✅ [railway-start.js](railway-start.js) - Removido servidor duplicado do modo FULL
2. ✅ [dashboard/server.js](dashboard/server.js) - Adicionado endpoint `/health`

## ⚠️ Notas Importantes

- **Não criar múltiplos listeners** na mesma porta
- **Modo FULL**: dashboard/server.js gerencia a porta
- **Modo BOT-ONLY**: railway-start.js gerencia a porta
- **Health checks** devem responder rapidamente (< 1s)
- **Error handling** com `process.exit(1)` para Railway reiniciar

## 🔗 Referências

- [Railway Documentation - Health Checks](https://docs.railway.app/deploy/healthchecks)
- [Node.js EADDRINUSE Error](https://nodejs.org/api/errors.html#errors_common_system_errors)
- [Express.js Server Configuration](https://expressjs.com/en/4x/api.html#app.listen)

---

**Status**: ✅ Implementado e testado
**Data**: 23/12/2025
**Versão**: 2.1.1
