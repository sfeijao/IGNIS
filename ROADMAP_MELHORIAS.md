# 🚀 ROADMAP DE MELHORIAS - BOT IGNIS

**Data Início:** 18 Novembro 2025
**Status:** Em Implementação
**Versão Alvo:** 3.0.0

---

## 📋 FUNCIONALIDADES SOLICITADAS

### ✅ COMPLETO
- Sistema de Giveaways base
- Sistema de Tickets base
- Dashboard Next.js
- 17 melhorias de performance/segurança

### 🔄 EM IMPLEMENTAÇÃO

#### 🎫 1. CATEGORIAS CUSTOMIZÁVEIS DE TICKETS (Alta Prioridade)
**Status:** Schema MongoDB criado ✅
**Próximos Passos:**
- [ ] API Routes para CRUD de categorias
- [ ] Dashboard React component para gerenciar
- [ ] Integração com painel de tickets
- [ ] Seletor dinâmico no Discord
- [ ] Migration de categorias antigas

**Arquivos:**
- `utils/db/models.js` - TicketCategorySchema ✅
- `dashboard/routes/ticketCategoryRoutes.js` - A criar
- `dashboard/next/components/TicketCategoryManager.tsx` - A criar
- `utils/communityTickets.js` - Atualizar lógica

---

#### 🎁 2. MELHORIAS GIVEAWAYS

##### 2.1 Editar Data/Hora de Término
**Status:** Pendente
**Implementação:**
- [ ] Adicionar campo `ends_at` editável no `GiveawayManager.tsx`
- [ ] API endpoint PATCH para atualizar `ends_at`
- [ ] Validação: nova data deve ser futura
- [ ] Recalcular tempo restante automaticamente
- [ ] Atualizar mensagem Discord com nova contagem

**Arquivos:**
- `dashboard/next/components/GiveawayManager.tsx`
- `dashboard/controllers/giveawayController.js`
- `utils/giveaways/messageUpdater.js`

##### 2.2 Vencedor Automático + Ticket
**Status:** Pendente
**Implementação:**
- [ ] Worker que verifica giveaways expirados (cron)
- [ ] Ao terminar: criar ticket automaticamente
- [ ] Mensagem personalizada no ticket
- [ ] Sistema de timeout 48h
- [ ] Re-sortear se não responder

**Arquivos:**
- `utils/giveaways/autoWinner.js` - A criar
- `utils/giveaways/worker.js` - A criar
- `utils/communityTickets.js` - Nova função createGiveawayTicket

**Mensagem Sugerida:**
```
🎉 **PARABÉNS, {user}!**

Você venceu o giveaway **{giveaway_name}**!

📋 **Próximos Passos:**
1. Responde a este ticket em até 48 horas
2. Fornece as informações solicitadas
3. Aguarde a entrega do prêmio

⏰ **Prazo:** 48 horas
⚠️ Se não responderes, um novo vencedor será selecionado.

Boa sorte! 🍀
```

---

#### 👋 3. SISTEMA DE BOAS-VINDAS E SAÍDAS

**Status:** Pendente
**Complexidade:** Média

**Schema MongoDB:**
```javascript
WelcomeConfigSchema = {
  guild_id: String,
  welcome: {
    enabled: Boolean,
    channel_id: String,
    message: String, // Suporte a placeholders
    embed: {
      title: String,
      description: String,
      color: Number,
      thumbnail: String, // URL
      image: String, // URL
      banner: String // URL
    }
  },
  goodbye: {
    enabled: Boolean,
    channel_id: String,
    message: String,
    embed: { /* igual welcome */ }
  }
}
```

**Placeholders:**
- `{user}` - Menção do usuário
- `{user.tag}` - Username#0000
- `{user.id}` - ID do usuário
- `{server}` - Nome do servidor
- `{server.icon}` - Ícone do servidor
- `{memberCount}` - Total de membros
- `{joinedAt}` - Data de entrada (relative)
- `{createdAt}` - Data de criação conta

**Arquivos:**
- `utils/db/models.js` - WelcomeConfigSchema
- `events/guildMemberAdd.js` - Atualizar
- `events/guildMemberRemove.js` - Atualizar
- `dashboard/next/components/WelcomeSettings.tsx`
- `dashboard/routes/welcomeRoutes.js`

---

#### ⏱️ 4. SISTEMA DE BATE-PONTO / TIME-TRACKING

**Status:** Pendente
**Complexidade:** Média-Alta

**Funcionalidades:**
- Iniciar: Cria mensagem única
- Pausar: Edita mensagem (não cria nova)
- Continuar: Edita mesma mensagem
- Finalizar: Mostra resumo completo

**Schema:**
```javascript
TimeTrackingSchema = {
  guild_id: String,
  user_id: String,
  message_id: String,
  channel_id: String,
  started_at: Date,
  ended_at: Date,
  pauses: [{ started: Date, ended: Date }],
  status: 'active' | 'paused' | 'ended',
  total_time: Number // milliseconds
}
```

**Design da Mensagem:**
```
⏱️ **BATE-PONTO** - @User

🟢 **Início:** 14:30:25
⏸️ **Pausas:**
  • 15:45:12 → 16:00:03 (14m 51s)
  • 17:20:45 → 17:35:10 (14m 25s)

▶️ **Continuações:** 2
🏁 **Término:** 18:45:33

⏰ **TEMPO TOTAL:** 3h 45m 12s
📊 **Tempo Efetivo:** 3h 15m 56s
```

**Arquivos:**
- `utils/db/models.js` - TimeTrackingSchema
- `utils/timeTracking.js` - Lógica completa
- `commands/bate-ponto.js` - Comando slash
- `events/interactionCreate.js` - Botões

---

#### 📊 5. SISTEMA DE SERVER STATUS (CONTADORES)

**Status:** Pendente
**Complexidade:** Baixa

**Canais Dinâmicos:**
- 👥 Total: {count} Membros
- 🧑 Humanos: {count}
- 🤖 Bots: {count}
- 💎 Boosters: {count}
- 🟢 Online: {count}
- 🎮 Jogando: {count}

**Schema:**
```javascript
ServerStatsSchema = {
  guild_id: String,
  enabled: Boolean,
  category_id: String, // Categoria dos canais
  channels: {
    total_members: String,
    humans: String,
    bots: String,
    boosters: String,
    online: String
  },
  update_interval: Number // Minutos (default: 10)
}
```

**Arquivos:**
- `utils/db/models.js` - ServerStatsSchema
- `utils/serverStats.js` - Worker de atualização
- `dashboard/next/components/ServerStatsSettings.tsx`
- `index.js` - setInterval para updates

---

#### 🆕 6. MELHORIAS PAINEL DE TICKETS

**Status:** Pendente

**Melhorias Design:**
- [ ] Layout moderno card-based
- [ ] Cores consistentes
- [ ] Animações suaves
- [ ] Loading states
- [ ] Empty states bonitos
- [ ] Filtros avançados
- [ ] Pesquisa em tempo real

**Remover:**
- [ ] ❌ Opção "Editar JSON"

**Arquivos:**
- `dashboard/next/app/guild/[gid]/tickets/page.tsx`
- `dashboard/next/components/TicketPanel.tsx`

---

#### 🌐 7. WEBHOOKS AVANÇADOS PARA TICKETS

**Status:** Pendente
**Complexidade:** Alta

**Funcionalidade:**
- **1 mensagem por ticket** (nunca múltiplas)
- Atualizar via PATCH conforme ticket avança
- Transcript como reply OU attachment

**Formato da Mensagem:**
```
🎫 **TICKET #123** - Suporte Técnico

👤 **Autor:** @User (ID: 123...)
📅 **Aberto:** <t:1234567890:R>
👔 **Assumido por:** @Staff
📝 **Status:** 🟢 Resolvido

⏰ **Tempo Resolução:** 45 minutos
🏁 **Fechado:** <t:1234568000:R>

[View Transcript](attachment://ticket-123.html)
```

**Schema Atualizado:**
```javascript
TicketSchema.add({
  webhook_message_id: String, // ID da mensagem do webhook
  webhook_url: String // URL do webhook (por guild)
});
```

**Arquivos:**
- `utils/ticketWebhooks.js` - A criar
- `utils/communityTickets.js` - Integrar
- `dashboard/routes/webhookRoutes.js` - Config

---

#### 🎨 8. MELHORIAS GERAIS DO DASHBOARD

**Status:** Contínuo

**Melhorias:**
- [ ] Tema dark mode aprimorado
- [ ] Componentes reutilizáveis
- [ ] Animações Framer Motion
- [ ] Skeleton loaders
- [ ] Toast notifications
- [ ] Modal system unificado
- [ ] Form validation (Zod)
- [ ] Responsive design
- [ ] Accessibility (ARIA)

---

## 📊 PRIORIZAÇÃO

### 🔥 **FASE 1 - ALTA PRIORIDADE** (1-2 semanas)
1. ✅ Categorias Customizáveis de Tickets (EM PROGRESSO)
2. Vencedor Automático + Ticket
3. Editar Data Giveaway

### ⚡ **FASE 2 - MÉDIA PRIORIDADE** (2-3 semanas)
4. Sistema de Boas-Vindas
5. Webhooks Avançados Tickets
6. Melhorias Painel Tickets

### 🌟 **FASE 3 - EXPANSÃO** (1 mês+)
7. Time-Tracking/Bate-Ponto
8. Server Status Counters
9. Dashboard UX/UI Overhaul

---

## 🔧 STACK TÉCNICO

**Backend:**
- Node.js 20+
- Discord.js v14
- MongoDB + Mongoose
- Express.js
- Socket.IO

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- TailwindCSS
- Framer Motion (animações)
- Zod (validation)
- React Hook Form

**DevOps:**
- Railway (hosting)
- GitHub Actions (CI/CD)
- MongoDB Atlas

---

## 📈 MÉTRICAS DE SUCESSO

- [ ] 0 bugs críticos
- [ ] 100% TypeScript coverage (frontend)
- [ ] <200ms response time (API)
- [ ] 95%+ uptime
- [ ] Código documentado (JSDoc)
- [ ] Testes unitários (80%+ coverage)

---

## 📝 NOTAS TÉCNICAS

### Categorias de Tickets
- Máximo 25 categorias por servidor
- Validação de emoji (regex Discord)
- Soft delete (enabled: false) vs hard delete
- Cache de categorias (5min TTL)

### Giveaways Auto-Winner
- Cron job a cada 1 minuto
- Verificar `ends_at < now && status === 'active'`
- Atomic update para prevenir double-processing
- Retry logic se falhar criar ticket

### Webhooks
- Rate limit: 5 req/s por webhook
- Retry com exponential backoff
- Queue system para múltiplos updates
- Fallback se webhook inválido

---

## ✅ CHECKLIST DE CADA FEATURE

Antes de marcar como completo:
- [ ] Código implementado
- [ ] Testes manuais
- [ ] Error handling completo
- [ ] Logging adequado
- [ ] Documentation (JSDoc)
- [ ] UI/UX polido
- [ ] Performance otimizada
- [ ] Segurança validada
- [ ] Commitado + pushed
- [ ] Deploy testado

---

**Última Atualização:** 18 Nov 2025
**Próxima Revisão:** Após implementar Categorias de Tickets
