# 🚀 GUIA DE DEPLOYMENT - IGNIS BOT v2.0

## ✅ STATUS DO SISTEMA

### Sistemas Implementados (100%)
- ✅ **Sistema de Tickets** - Totalmente funcional
- ✅ **Sistema de Giveaways** - Totalmente funcional
- ✅ **Dashboard Next.js** - Interface moderna
- ✅ **Gestão de Permissões** - Cargos configuráveis
- ✅ **Socket.IO** - Updates em tempo real
- ✅ **Roleta Visual** - Sorteios animados

---

## 📋 CHECKLIST PRÉ-DEPLOYMENT

### 1. Variáveis de Ambiente
Verificar `.env`:
```bash
DISCORD_TOKEN=seu_token_bot
CLIENT_ID=id_do_bot
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=chave_secreta_aleatoria
GIVEAWAYS_MANAGER_ROLES=id_cargo1,id_cargo2 (opcional)
```

### 2. Dependências
```bash
npm install
cd dashboard/next && npm install && cd ../..
```

### 3. Build do Dashboard
```bash
npm run build:dashboards
```

Isso irá:
- Compilar frontend Vite (Moderation Center)
- Buildar e exportar Next.js (Dashboard principal)

---

## 🎯 DEPLOYMENT RAILWAY

### Passo 1: Configurar Variáveis
No Railway Dashboard:
1. Settings → Variables
2. Adicionar todas as variáveis do `.env`
3. Adicionar: `NODE_ENV=production`

### Passo 2: Deploy
```bash
git add .
git commit -m "feat: Sistema completo v2.0"
git push
```

Railway detecta automaticamente e faz deploy.

### Passo 3: Verificar Logs
```
railway logs
```

---

## 🔧 COMANDOS ÚTEIS

### Desenvolvimento Local
```bash
# Iniciar bot
node index.js

# Testar sistema
node test-system.js

# Build dashboards
npm run build:dashboards

# Iniciar website
npm run website
```

### Troubleshooting
```bash
# Limpar build cache
rm -rf dashboard/next/.next
rm -rf dashboard/next/out
rm -rf dashboard/public/next-export

# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install

# Verificar erros
node test-system.js
```

---

## 📊 FUNCIONALIDADES DISPONÍVEIS

### Sistema de Tickets
- ✅ Criação de tickets via botões
- ✅ Categorização automática
- ✅ Sistema de tags
- ✅ Logs completos
- ✅ Painel de gestão

### Sistema de Giveaways
- ✅ Criação via dashboard
- ✅ Botões de participação (Discord)
- ✅ **Lista de participantes** (paginada)
- ✅ **Roleta visual** para sorteio
- ✅ **Estatísticas em tempo real**
- ✅ **Gestão completa** (editar, terminar, reroll)
- ✅ Exportação CSV
- ✅ Socket.IO updates

### Dashboard Next.js
- ✅ Interface moderna e responsiva
- ✅ 3 tabs: Visão Geral / Participantes / Roleta
- ✅ Gráficos e métricas
- ✅ Pesquisa de participantes
- ✅ Configurações por servidor

---

## 🎰 COMO USAR GIVEAWAYS

### 1. Criar Giveaway
1. Aceder dashboard: `/next/giveaways`
2. Clicar "Criar Giveaway"
3. Preencher formulário:
   - Título, descrição
   - Canal do Discord
   - Data de término
   - Número de vencedores
4. Publicar no Discord

### 2. Gestão
No dashboard, clicar num giveaway ativo:

**Tab "Visão Geral":**
- Ver estatísticas em tempo real
- Taxa de participação
- Projeção de participantes
- Editar/Terminar

**Tab "Participantes":**
- Ver lista completa
- Pesquisar por nome/ID
- Navegação paginada

**Tab "Roleta":**
- Animação visual de sorteio
- Escolha aleatória de vencedores
- Efeitos visuais

### 3. Participação (Discord)
Utilizadores clicam:
- **🎉 Participar** - Entrar no giveaway
- **❌ Sair** - Remover participação

---

## 🐛 ERROS CONHECIDOS E SOLUÇÕES

### Erro 404 no Browser Console
```
691b9e4307c05341414acb9c:1 Failed to load resource: the server responded with a status of 404 ()
```

**Causa:** Browser pre-fetch tentando carregar rota Next.js como HTML estático.

**Solução:** Ignorar - é comportamento normal. Dados carregam via API corretamente.

### Socket.IO não conecta
**Verificar:**
1. `global.io` está definido em `dashboard/server.js`
2. Cliente conecta a URL correta
3. CORS configurado

### Botões de Giveaway não respondem
**Verificar:**
1. Handler em `events/interactionCreate.js` (linha ~131)
2. Arquivo `utils/giveaways/interactions.js` existe
3. Logs: `railway logs` ou console local

---

## 📱 ACESSOS

### Desenvolvimento Local
- Bot: `node index.js`
- Dashboard: `http://localhost:3001`
- Next Dashboard: `http://localhost:3001/next`
- Website: `http://localhost:8080`

### Produção Railway
- Dashboard: `https://seuapp.railway.app`
- Next Dashboard: `https://seuapp.railway.app/next`

---

## 🎉 PRONTO PARA USAR!

Sistema 100% funcional. Para testar:

1. **Tickets:**
   - Configurar painel: `/configurar-painel-tickets`
   - Utilizadores clicam botão
   - Staff gere via dashboard

2. **Giveaways:**
   - Criar no dashboard
   - Publicar no Discord
   - Users participam via botões
   - Sortear vencedores na roleta

---

## 📞 SUPORTE

Se encontrares problemas:
1. Executar: `node test-system.js`
2. Verificar logs: `railway logs`
3. Consultar este guia

**Versão:** 2.0.0
**Data:** Novembro 2025
**Status:** ✅ Produção Ready
