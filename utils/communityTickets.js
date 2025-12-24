const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { ensureDeferred, safeReply, safeUpdate } = require('./interactionHelpers');
const storage = require('./storage');
const logger = require('./logger');
const { KeyedRateLimiter } = require('./retryHelper');
const { TicketCategoryModel } = require('./db/models');
const TICKET_IDS = require('../constants/ticketButtonIds');
const webhookSystem = require('./webhookSystem');

// Rate limiter: 2 tickets por minuto por usuário
const ticketRateLimiter = new KeyedRateLimiter(2, 2 / 60); // 2 tokens, refill 2 por 60s

async function ensureCategory(guild) {
  let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && (c.name === '📁 TICKETS' || c.name.toUpperCase() === 'TICKETS'));
  if (!cat) {
    cat = await guild.channels.create({
      name: '📁 TICKETS',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }
      ],
      reason: 'Categoria criada automaticamente para tickets'
    });
  }
  return cat;
}

function departmentInfo(type) {
  const map = {
    technical: { name: 'Suporte Técnico', emoji: '🔧', color: 0x7C3AED },
    incident: { name: 'Reportar Problema', emoji: '⚠️', color: 0xEF4444 },
    moderation: { name: 'Moderação & Segurança', emoji: '🛡️', color: 0x3B82F6 },
    general: { name: 'Dúvidas Gerais', emoji: '💬', color: 0x64748B },
    account: { name: 'Suporte de Conta', emoji: '🧾', color: 0x22C55E }
  };
  return map[type] || map.technical;
}

function priorityLabel(p) {
  const v = (p || 'normal').toLowerCase();
  if (v === 'urgent') return 'URGENTE';
  if (v === 'high') return 'ALTA';
  if (v === 'low') return 'BAIXA';
  return 'NORMAL';
}

// Tenta encontrar um cargo de staff automaticamente se não existir em config
async function findStaffRole(guild) {
  try {
    const cfg = await storage.getGuildConfig(guild.id);
    const configuredId = cfg?.roles?.staff;
    if (configuredId && guild.roles.cache.has(configuredId)) return guild.roles.cache.get(configuredId);
  } catch (e) {
    logger.warn(`[Tickets] Erro ao carregar config de staff para ${guild.id}:`, e.message);
  }
  // Heurística: escolher o cargo mais alto que tenha perms de gestão/moderação
  const candidates = guild.roles.cache
    .filter(r => r.editable || true) // apenas para iterar todos
    .filter(r => r.permissions.has(PermissionFlagsBits.Administrator)
              || r.permissions.has(PermissionFlagsBits.ManageGuild)
              || r.permissions.has(PermissionFlagsBits.ManageMessages)
              || r.permissions.has(PermissionFlagsBits.KickMembers)
              || r.permissions.has(PermissionFlagsBits.BanMembers))
    .sort((a, b) => b.position - a.position);
  return candidates.first() || null;
}

// Tenta encontrar um canal de logs automaticamente se não existir em config
async function findLogsChannel(guild) {
  try {
    const cfg = await storage.getGuildConfig(guild.id);
    const configuredId = cfg?.channels?.logs;
    if (configuredId) {
      return guild.channels.cache.get(configuredId) || await guild.client.channels.fetch(configuredId).catch(() => null);
    }
  } catch (e) {
    logger.warn(`[Tickets] Erro ao carregar config de logs para ${guild.id}:`, e.message);
  }
  // Heurística por nome
  const names = ['logs', 'log', 'mod-logs', 'modlogs', 'staff-logs', 'transcripts', 'ignis-logs'];
  const ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && names.some(n => c.name.toLowerCase().includes(n)));
  if (ch) return ch;
  return null;
}

function statusLabel(ticket) {
  const st = (ticket?.status || 'open').toLowerCase();
  const locked = ticket?.locked ? ' (bloqueado)' : '';
  if (st === 'claimed') return `Reclamado${locked}`;
  if (st === 'closed') return `Finalizado${locked}`;
  return `Aberto${locked}`;
}

function colorBy(ticket) {
  const st = (ticket?.status || 'open').toLowerCase();
  if (st === 'closed') return 0x10B981; // verde sucesso
  const p = (ticket?.priority || 'normal').toLowerCase();
  if (p === 'urgent') return 0xEF4444;
  if (p === 'high') return 0xF59E0B;
  if (p === 'low') return 0x6B7280;
  return 0x3B82F6;
}

async function updatePanelHeader(channel, ticket) {
  if (!ticket?.panel_message_id) return;
  try {
    const msg = await channel.messages.fetch(ticket.panel_message_id).catch(() => null);
    if (!msg) return;
    const base = msg.embeds?.[0] ? EmbedBuilder.from(msg.embeds[0]) : new EmbedBuilder();

    // Preservar título/descrição/cores existentes; atualizar campos com info atual
    const openedAt = ticket.created_at ? Math.floor(new Date(ticket.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
    base.setColor(colorBy(ticket));
    base.setFields(
      { name: 'Estado', value: statusLabel(ticket), inline: true },
      { name: 'Utilizador', value: `<@${ticket.user_id}>`, inline: true },
      { name: 'Abertura', value: `<t:${openedAt}:R>`, inline: true },
      { name: 'ID', value: `#${ticket.id}` , inline: true},
      { name: 'Prioridade', value: priorityLabel(ticket.priority), inline: true },
      { name: 'Responsável', value: ticket.assigned_to ? `<@${ticket.assigned_to}>` : '—', inline: true }
    );
    await msg.edit({ embeds: [base], components: msg.components });
  } catch (e) {
    // silencioso
  }
}

async function fetchAllMessages(channel, cap = 2000) {
  const all = [];
  let lastId = undefined;
  while (all.length < cap) {
    const limit = Math.min(100, cap - all.length);
    const batch = await channel.messages.fetch(lastId ? { limit, before: lastId } : { limit }).catch(() => null);
    if (!batch || batch.size === 0) break;
    const arr = Array.from(batch.values());
    all.push(...arr);
    lastId = arr[arr.length - 1].id;
    // Evitar loops muito longos
    if (batch.size < limit) break;
  }
  // Ordenar cronologicamente (antigos → novos)
  return all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

/**
 * 🎫 CRIAR TICKET COM SELEÇÃO DE CATEGORIA
 *
 * Se o servidor tiver categorias customizáveis habilitadas:
 * 1. Mostra StringSelectMenu com categorias disponíveis
 * 2. User escolhe categoria
 * 3. Cria ticket com categoria escolhida
 *
 * Se não tiver categorias custom → usa fluxo tradicional (departmentInfo)
 */
async function createTicketWithCategorySelection(interaction, defaultType) {
  try {
    // Buscar categorias customizáveis do servidor
    const customCategories = await TicketCategoryModel
      .find({ guild_id: interaction.guild.id, enabled: true })
      .sort({ order: 1 })
      .lean();

    // Se não existirem categorias custom, usar fluxo tradicional
    if (!customCategories || customCategories.length === 0) {
      return createTicket(interaction, defaultType);
    }

    // Se só existe 1 categoria, criar direto sem mostrar menu
    if (customCategories.length === 1) {
      return createTicket(interaction, defaultType, customCategories[0]);
    }

    // Mostrar seletor de categorias
    const options = customCategories.map((cat, idx) => ({
      label: cat.name,
      value: cat._id.toString(),
      description: cat.description || `Categoria ${idx + 1}`,
      emoji: cat.emoji
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(TICKET_IDS.CATEGORY_SELECT)
      .setPlaceholder('📋 Escolhe a categoria do ticket...')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle('🎫 Escolhe a Categoria')
      .setDescription(
        'Seleciona a categoria que melhor descreve o motivo do teu ticket.\n' +
        'Esta informação ajuda a equipa a direcionar o teu pedido corretamente.'
      )
      .setFooter({ text: 'Aguardamos a tua escolha...' });

    await safeReply(interaction, {
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral
    });

    // Guardar contexto temporário (tipo original) para usar depois
    // Quando user selecionar, handleSelect irá criar o ticket
    const tempKey = `ticket_category_context:${interaction.guild.id}:${interaction.user.id}`;
    await storage.setGeneric(tempKey, {
      defaultType,
      timestamp: Date.now()
    }, 60); // 60s TTL

  } catch (error) {
    logger.error('[Tickets] Error in category selection:', error);
    // Fallback para fluxo tradicional
    return createTicket(interaction, defaultType);
  }
}

async function createTicket(interaction, type, customCategory = null, panelConfig = null) {
  // Rate limiting: 2 tickets por minuto por usuário
  const rateLimitKey = `${interaction.guild.id}:${interaction.user.id}`;
  const rateCheck = ticketRateLimiter.check(rateLimitKey);

  if (!rateCheck.allowed) {
    const waitSeconds = Math.ceil(rateCheck.waitTime / 1000);
    return safeReply(interaction, {
      content: `⏱️ Aguarda ${waitSeconds}s antes de criar outro ticket.`,
      flags: MessageFlags.Ephemeral
    });
  }

  // CRITICAL: Atomic lock para prevenir race condition em double-click
  // Usa findOneAndUpdate com upsert para garantir apenas 1 ticket criado
  const storage = require('./storage');
  const lockKey = `ticket_creation_lock:${interaction.guild.id}:${interaction.user.id}`;
  const lockDoc = await storage.getGeneric(lockKey);

  // Se já existe lock recente (< 5 segundos), rejeitar
  if (lockDoc && Date.now() - new Date(lockDoc.created_at).getTime() < 5000) {
    return safeReply(interaction, {
      content: `⏳ Aguarda um momento... Ticket a ser criado.`,
      flags: MessageFlags.Ephemeral
    });
  }

  // Consumir token (apenas depois do lock check)
  await ticketRateLimiter.acquire(rateLimitKey, 1);

  // Criar lock
  await storage.setGeneric(lockKey, { created_at: new Date() });

  try {
    // Impedir múltiplos tickets abertos por utilizador
    const existing = (await storage.getUserActiveTickets(interaction.user.id, interaction.guild.id)) || [];
    if (existing.length > 0) {
      const t = existing[0];
      await storage.deleteGeneric(lockKey); // Liberar lock
      return safeReply(interaction, { content: `❌ Já tens um ticket aberto: <#${t.channel_id}>`, flags: MessageFlags.Ephemeral });
    }
  } catch (lockError) {
    // Se falhar verificação, liberar lock e rejeitar
    await storage.deleteGeneric(lockKey).catch(() => {});
    throw lockError;
  }

  // Ler configuração de tickets
  let cfg;
  try { cfg = await storage.getGuildConfig(interaction.guild.id); } catch (e) { logger.debug('Caught error:', e?.message || e); }

  // 🆕 Usar target_category_id do painel se disponível
  let parentCategoryId = panelConfig?.target_category_id || cfg?.tickets?.ticketsCategoryId || null;
  let accessRoleIds = Array.isArray(cfg?.tickets?.accessRoleIds) ? cfg.tickets.accessRoleIds.filter(Boolean) : [];

  // Resolva categoria alvo: usar configurada; senão, garantir uma por defeito
  let cat = null;
  if (parentCategoryId) {
    cat = interaction.guild.channels.cache.get(parentCategoryId) || await interaction.client.channels.fetch(parentCategoryId).catch(() => null);
    if (!cat || cat.type !== require('discord.js').ChannelType.GuildCategory) {
      cat = await ensureCategory(interaction.guild);
      parentCategoryId = cat.id;
    }
  } else {
    cat = await ensureCategory(interaction.guild);
    parentCategoryId = cat.id;
  }

  // Determinar info da categoria (custom ou padrão)
  let info;
  if (customCategory) {
    info = {
      name: customCategory.name,
      emoji: customCategory.emoji,
      color: customCategory.color
    };
  } else {
    info = departmentInfo(type);
  }

  const channelName = `${info.emoji}-${interaction.user.username}`.toLowerCase();

  // Verificar permissões do bot ANTES de criar canal
  const botMember = interaction.guild.members.me;
  if (!botMember) {
    await storage.deleteGeneric(lockKey).catch(() => {});
    return safeReply(interaction, { content: '❌ Erro: bot member não encontrado.', flags: MessageFlags.Ephemeral });
  }

  const requiredPerms = [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ManageRoles
  ];

  const missingPerms = requiredPerms.filter(perm => !botMember.permissions.has(perm));
  if (missingPerms.length > 0) {
    await storage.deleteGeneric(lockKey).catch(() => {});
    const permNames = missingPerms.map(p => {
      if (p === PermissionFlagsBits.ManageChannels) return 'Gerir Canais';
      if (p === PermissionFlagsBits.ManageRoles) return 'Gerir Cargos';
      if (p === PermissionFlagsBits.SendMessages) return 'Enviar Mensagens';
      return 'Ver Canal';
    }).join(', ');
    logger.warn(`[Tickets] Bot falta permissões em ${interaction.guild.name}: ${permNames}`);
    return safeReply(interaction, { content: `❌ Bot não tem permissões necessárias: **${permNames}**`, flags: MessageFlags.Ephemeral });
  }

  const overwrites = [
    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
  ];

  // Permitir staff: usar accessRoleIds configurados; senão tentar detetar automaticamente
  if (accessRoleIds.length > 0) {
    for (const rid of accessRoleIds) {
      if (interaction.guild.roles.cache.has(rid)) {
        overwrites.push({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      }
    }
  } else {
    try {
      const staffRole = await findStaffRole(interaction.guild);
      if (staffRole) {
        overwrites.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      }
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
  }

  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parentCategoryId,
    permissionOverwrites: overwrites,
    topic: `Ticket • ${info.name} • ${interaction.user.tag}`
  });

  let ticket;
  try {
    // Persistir ticket no DB (com categoria customizada se existir)
    const ticketData = {
      guild_id: interaction.guild.id,
      channel_id: channel.id,
      user_id: interaction.user.id,
      type,
      description: null,
      priority: 'normal'
    };

    // Se foi usada categoria customizada, guardar referência
    if (customCategory) {
      ticketData.category_id = customCategory._id.toString();
      ticketData.category_name = customCategory.name;
    }

    ticket = await storage.createTicket(ticketData);

    // Send webhook notification
    try {
      await webhookSystem.sendOrUpdateTicketWebhook(ticket, 'created', {
        createdBy: interaction.user,
        categoryName: departmentInfo(type)?.name || String(type || '')
      });
    } catch (err) {
      logger.error('[Tickets] Failed to send webhook for ticket creation:', err);
    }
  } catch (dbError) {
    // Rollback: apagar canal se falhar DB insert
    try {
      await channel.delete();
      logger.warn(`[Tickets] Rollback: canal ${channel.id} apagado após falha no DB`, dbError);
    } catch (delError) {
      logger.error(`[Tickets] Falha no rollback do canal ${channel.id}`, delError);
    }
    throw dbError; // Re-throw para lock cleanup upstream
  }

  // Mensagem inicial no canal (novo layout igual ao da imagem, sem dropdown)
  const visualAssets = require('../assets/visual-assets');
  const cfgTickets = (cfg && cfg.tickets) || {};
  const placeholders = {
    '{user}': `${interaction.user}`,
    '{user_tag}': `${interaction.user.tag}`,
    '{server}': interaction.guild?.name || '',
    '{ticket_id}': String(ticket.id),
    '{category}': departmentInfo(type)?.name || String(type || ''),
    '{priority}': priorityLabel(ticket.priority)
  };

  // 🆕 Usar welcomeMessage da categoria customizada se disponível
  let welcome = cfgTickets.welcomeMsg || `Olá {user}, obrigado por abrir um ticket!`;
  if (customCategory && customCategory.welcomeMessage) {
    welcome = customCategory.welcomeMessage;
  }
  welcome = welcome.replace(/\{user\}|\{user_tag\}|\{server\}|\{ticket_id\}/g, (m)=> placeholders[m] || m);

  // Usar os builders V2 do serviço TS para padronizar a aparência
  let embeds;
  try {
    const svc = require('../dist/services/ticketService.js');
    if (svc && typeof svc.buildPanelEmbedsV2 === 'function') {
      // 🆕 Usar nome da categoria customizada se disponível
      const categoryName = customCategory ? customCategory.name : (departmentInfo(type)?.name || info.name);
      embeds = svc.buildPanelEmbedsV2(interaction.member, categoryName, interaction.guild.iconURL?.() || visualAssets?.realImages?.supportIcon);
    }
  } catch (e) { logger.debug('Caught error:', e?.message || e); }
  if (!embeds) {
    // Fallback simples caso o dist ainda não exista
    // 🆕 Usar cor e nome da categoria customizada se disponível
    const categoryName = customCategory ? customCategory.name : info.name;
    const categoryColor = customCategory ? customCategory.color : info.color;

    const introMain = new EmbedBuilder()
      .setColor(categoryColor)
      .setTitle('Ticket Criado com Sucesso! 📌')
      .setDescription('Todos os responsáveis pelo ticket já estão cientes da abertura.\nEvite chamar alguém via DM, basta aguardar alguém já irá lhe atender..')
      .addFields(
        { name: 'Categoria Escolhida:', value: `🧾 \`Ticket ${categoryName}\``, inline: false },
        { name: 'Lembrando', value: 'que os botões são exclusivos para staff!\n\n`DESCREVA O MOTIVO DO CONTACTO COM O MÁXIMO DE DETALHES POSSÍVEIS QUE ALGUM RESPONSÁVEL JÁ IRÁ LHE ATENDER!`', inline: false }
      )
      .setThumbnail(interaction.guild.iconURL?.() || interaction.user.displayAvatarURL?.() || visualAssets?.realImages?.supportIcon)
      .setColor(0x2F3136);
    const introNotice = new EmbedBuilder()
      .setDescription('OBS: Procure manter sua DM aberta para receber uma cópia deste ticket e a opção de avaliar seu atendimento.')
      .setColor(0xED4245);
    embeds = [introMain, introNotice];
  }

  // Componentes: três linhas de botões, sem menu dropdown
  let components;
  try {
    const svc = require('../dist/services/ticketService.js');
    if (svc && typeof svc.buildPanelComponents === 'function') {
      components = svc.buildPanelComponents();
      // Opcional: remover o botão de prioridade para ficar idêntico ao print
      try {
        if (Array.isArray(components) && components[2]?.components) {
          components[2].components = components[2].components.filter((c)=> (c?.data?.custom_id || c?.customId) !== 'ticket:priority');
        }
      } catch (e) { logger.debug('Caught error:', e?.message || e); }
    }
  } catch (e) { logger.debug('Caught error:', e?.message || e); }
  if (!components) {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:cancel').setLabel('Desejo sair ou cancelar este ticket').setStyle(ButtonStyle.Danger).setEmoji('🧯'),
      new ButtonBuilder().setCustomId('ticket:how_dm').setLabel('Como libero minha DM?').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(TICKET_IDS.CALL_MEMBER).setLabel('Chamar Membro').setStyle(ButtonStyle.Primary).setEmoji('🔔'),
      new ButtonBuilder().setCustomId(TICKET_IDS.ADD_MEMBER).setLabel('Adicionar Membro').setStyle(ButtonStyle.Success).setEmoji('➕'),
      new ButtonBuilder().setCustomId(TICKET_IDS.REMOVE_MEMBER).setLabel('Remover Membro').setStyle(ButtonStyle.Danger).setEmoji('❌'),
      new ButtonBuilder().setCustomId(TICKET_IDS.MOVE).setLabel('Mover Ticket').setStyle(ButtonStyle.Secondary).setEmoji('🔁'),
      new ButtonBuilder().setCustomId(TICKET_IDS.RENAME).setLabel('Trocar Nome do Canal').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
    );
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(TICKET_IDS.CLAIM).setLabel('Assumir Atendimento').setStyle(ButtonStyle.Primary).setEmoji('🟦'),
      new ButtonBuilder().setCustomId(TICKET_IDS.GREET).setLabel('Saudar Atendimento').setStyle(ButtonStyle.Primary).setEmoji('👋'),
      new ButtonBuilder().setCustomId(TICKET_IDS.NOTE).setLabel('Adicionar Observação Interna').setStyle(ButtonStyle.Secondary).setEmoji('🗒️'),
      new ButtonBuilder().setCustomId(TICKET_IDS.CLOSE).setLabel('Finalizar Ticket').setStyle(ButtonStyle.Success).setEmoji('✅'),
    );
    components = [row1, row2, row3];
  }

  const panelMsg = await channel.send({ content: `${interaction.user}`, embeds, components });
  // Guardar referência para futuras edições do cabeçalho
  try { await storage.updateTicket(ticket.id, { panel_message_id: panelMsg.id }); } catch (e) { logger.debug('Caught error:', e?.message || e); }

  // Enviar log via webhook (preferência), com fallback para canal de logs
  try {
    const wm = interaction.client?.webhooks;
    if (wm && typeof wm.sendTicketLog === 'function') {
      await wm.sendTicketLog(interaction.guild.id, 'create', {
        author: interaction.user,
        ticketId: ticket.id?.toString(),
        category: departmentInfo(type)?.name || type,
        guild: interaction.guild
      });
    } else {
      // Prefer configuração explícita do dashboard
      let logCh = null;
      try {
        const logsId = cfgTickets.logsChannelId;
        if (logsId) logCh = interaction.guild.channels.cache.get(logsId) || await interaction.client.channels.fetch(logsId).catch(()=>null);
      } catch (e) { logger.debug('Caught error:', e?.message || e); }
      if (!logCh) logCh = await findLogsChannel(interaction.guild);
      if (logCh && logCh.send) {
        await logCh.send({ embeds: [new EmbedBuilder().setColor(0x7C3AED).setTitle('📩 Ticket Aberto').setDescription(`${interaction.user} abriu um ticket: ${channel}`)] });
      }
    }
  } catch (e) { logger.debug('Caught error:', e?.message || e); }

  // Liberar lock após criação bem-sucedida
  await storage.deleteGeneric(lockKey).catch(() => {});

  return safeReply(interaction, { content: `✅ Ticket criado: ${channel}`, flags: MessageFlags.Ephemeral });
}

async function requestClose(interaction) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(TICKET_IDS.CLOSE_CONFIRM).setLabel('Confirmar').setEmoji('✅').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(TICKET_IDS.CLOSE_CANCEL).setLabel('Cancelar').setEmoji('❌').setStyle(ButtonStyle.Secondary)
  );
  return safeReply(interaction, { content: 'Tens a certeza que queres fechar este ticket?', components: [row], flags: MessageFlags.Ephemeral });
}

async function confirmClose(interaction) {
  // Evitar timeout da interação ao executar operações pesadas
  try { await interaction.deferUpdate(); } catch (e) { logger.debug('Caught error:', e?.message || e); }
  // Atualizar storage
  try {
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (t) await storage.updateTicket(t.id, { status: 'closed', closed_at: new Date().toISOString(), closed_by: interaction.user.id });
  } catch (e) { logger.debug('Caught error:', e?.message || e); }

  const closed = new EmbedBuilder()
    .setColor(0xEF4444)
    .setTitle('🔒 Ticket Fechado')
    .setDescription(`Fechado por ${interaction.user} • <t:${Math.floor(Date.now()/1000)}:R>`)
    .setTimestamp();

  await interaction.channel.send({ embeds: [closed] });
  // Gerar transcript completo (paginado) e enviar para canal de logs, se configurado
  try {
    const transcriptHelper = require('./transcriptHelper');
    const ticketData = await storage.getTicketByChannel(interaction.channel.id);
    const { text, attachment } = await transcriptHelper.generateFullTranscript({
      channel: interaction.channel,
      ticketId: ticketData?.id?.toString() || interaction.channel.id,
      closedByTag: interaction.user.tag,
      action: 'fechado',
      maxMessages: 2000
    });

    // Update webhook with closed status
    try {
      if (ticketData) {
        const messageCount = interaction.channel.messages?.cache?.size || 0;
        await webhookSystem.sendOrUpdateTicketWebhook(ticketData, 'closed', {
          closer: interaction.user,
          reason: 'Fechado pelo staff',
          transcript: text || null
        });
      }
    } catch (err) {
      logger.error('[Tickets] Failed to update webhook for ticket close:', err);
    }

    let sent = false;
    if (attachment) {
      // Preferir webhook configurado
      try {
        const wm = interaction.client?.webhooks;
        if (wm && typeof wm.sendTicketLog === 'function') {
          await wm.sendTicketLog(interaction.guild.id, 'close', {
            closedBy: interaction.user,
            ticketId: ticketData?.id?.toString(),
            duration: '—',
            guild: interaction.guild,
            files: [attachment]
          });
          sent = true;
        }
      } catch (e) { logger.debug('Caught error:', e?.message || e); }
      if (!sent) {
        const logCh = await findLogsChannel(interaction.guild);
        if (logCh && logCh.send) {
          await logCh.send({ content: `📄 Transcript do ticket em ${interaction.guild.name}: #${interaction.channel.name}`, files: [attachment] });
          sent = true;
        }
      }
    }
  } catch (e) { logger.debug('Caught error:', e?.message || e); }
  try { await interaction.editReply({ content: '✅ Ticket será apagado automaticamente em 10 segundos. Obrigado!', components: [] }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
  try { await interaction.channel.send({ content: '🗑️ Este canal será apagado automaticamente em 10 segundos.' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }

  setTimeout(() => {
    interaction.channel.delete('Ticket fechado (auto delete 10s)');
  }, 10 * 1000);
}

function toPriority(nextOf) {
  const order = ['low', 'normal', 'high', 'urgent'];
  const idx = order.indexOf((nextOf || 'normal').toLowerCase());
  return order[(idx + 1) % order.length];
}

async function isStaff(interaction) {
  try {
    // Guild owner sempre tem acesso
    if (interaction.guild.ownerId && interaction.user.id === interaction.guild.ownerId) return true;
    // Administradores também têm acesso
    if (interaction.member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
    const cfg = await storage.getGuildConfig(interaction.guild.id);
    const staffRoleId = cfg?.roles?.staff;
    return !!(staffRoleId && interaction.member.roles.cache.has(staffRoleId));
  } catch {
    return false;
  }
}

async function handleButton(interaction) {
  const id = interaction.customId;
  
  logger.debug(`[CommunityTickets] handleButton called for: ${id}`);

  // 🆕 Handler para botões de categoria de painéis avançados
  if (id.startsWith('ticket:category:')) {
    const categoryId = id.split(':')[2];

    try {
      // Buscar categoria escolhida
      const category = await TicketCategoryModel.findOne({
        _id: categoryId,
        guild_id: interaction.guild.id,
        enabled: true
      }).lean();

      if (!category) {
        return safeReply(interaction, {
          content: '❌ Categoria não encontrada ou desativada.',
          flags: MessageFlags.Ephemeral
        });
      }

      // Buscar painel que contém este botão para obter target_category_id
      const { PanelModel } = require('./db/models');
      const panel = await PanelModel.findOne({
        guild_id: interaction.guild.id,
        channel_id: interaction.channel.id,
        message_id: interaction.message.id,
        selected_categories: categoryId
      }).lean();

      // Criar ticket com categoria e configuração do painel
      return createTicket(interaction, 'support', category, panel);

    } catch (error) {
      logger.error('[Tickets] Error handling category button:', error);
      return safeReply(interaction, {
        content: '❌ Erro ao processar categoria. Tenta novamente.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  if (TICKET_IDS.extractCategory(id)) {
    const type = id.split(':')[2];
    // Verificar se existem categorias customizáveis para este servidor
    return createTicketWithCategorySelection(interaction, type);
  }
  if (id === 'ticket:close:request') return requestClose(interaction);
  if (id === TICKET_IDS.CLOSE_CONFIRM) return confirmClose(interaction);
  if (id === TICKET_IDS.CLOSE_CANCEL) return interaction.update({ content: '❎ Cancelado.', components: [] });

  // 🆕 Botões de Giveaway Winner Ticket
  if (id === 'giveaway_ticket:confirm_receipt') {
    try {
      const ticket = await storage.getTicketByChannel(interaction.channel.id);
      if (ticket) {
        await storage.updateTicket(ticket.id, { responded: true });
        const embed = new EmbedBuilder()
          .setColor(0x10B981)
          .setTitle('✅ Recebimento Confirmado')
          .setDescription(
            `${interaction.user} confirmou o recebimento do prêmio.\n\n` +
            `A equipe será notificada.`
          )
          .setTimestamp();
        await interaction.channel.send({ embeds: [embed] });
        return safeReply(interaction, {
          content: '✅ Obrigado pela confirmação!',
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (err) {
      logger.error('[GiveawayTicket] confirm_receipt error:', err);
    }
    return safeReply(interaction, {
      content: '✅ Confirmação registada.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (id === 'giveaway_ticket:need_help') {
    const embed = new EmbedBuilder()
      .setColor(0x3B82F6)
      .setTitle('❓ Solicitação de Ajuda')
      .setDescription(
        `${interaction.user} solicitou ajuda adicional.\n\n` +
        `A equipe responderá em breve.`
      )
      .setTimestamp();
    await interaction.channel.send({ embeds: [embed] });
    return safeReply(interaction, {
      content: '✅ Equipe notificada. Aguarda resposta.',
      flags: MessageFlags.Ephemeral
    });
  }

  // --- Novos botões do layout unificado (quando canal é legado e não existe TicketModel TS) ---
  // Para estes IDs o handler TS não responde porque resolveTicket() retorna null.
  // Implementamos respostas básicas aqui.
  if (id === 'ticket:cancel') {
    try { await interaction.reply({ content: '✅ Ticket será cancelado e apagado.', flags: MessageFlags.Ephemeral }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    setTimeout(()=>{ try { interaction.channel.delete('Ticket cancelado'); } catch (e) { logger.debug('Caught error:', e?.message || e); } }, 1500);
    return;
  }
  if (id === 'ticket:how_dm') {
    return safeReply(interaction, { content: 'Para abrir DMs: Definições > Privacidade & Segurança > Permitir mensagens de membros do servidor.', flags: MessageFlags.Ephemeral });
  }
  if (id === 'ticket:greet') {
    return safeReply(interaction, { content: `👋 Olá ${interaction.user}, em que podemos ajudar?`, flags: MessageFlags.Ephemeral });
  }
  if (id === 'ticket:note') {
    // Modal para nota interna
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId(TICKET_IDS.MODAL_NOTE).setTitle('Nota interna');
    const input = new TextInputBuilder().setCustomId(TICKET_IDS.INPUT_NOTE_TEXT).setLabel('Conteúdo da nota').setStyle(TextInputStyle.Paragraph).setMinLength(2).setMaxLength(500).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    try { await interaction.showModal(modal); } catch { return safeReply(interaction, { content: '❌ Falha ao mostrar modal.', flags: MessageFlags.Ephemeral }); }
    return;
  }
  if (id === 'ticket:rename') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId(TICKET_IDS.MODAL_RENAME).setTitle('Renomear Canal');
    const input = new TextInputBuilder().setCustomId(TICKET_IDS.INPUT_CHANNEL_NAME).setLabel('Novo nome').setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(90).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    try { await interaction.showModal(modal); } catch { return safeReply(interaction, { content: '❌ Falha ao abrir modal.', flags: MessageFlags.Ephemeral }); }
    return;
  }
  if (id === 'ticket:move') {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;
    const cats = guild.channels.cache.filter(c => c.type === 4).first(15);
    if (!cats.length) return safeReply(interaction, { content: '❌ Sem categorias disponíveis.', flags: MessageFlags.Ephemeral });
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const rows = [];
    let r = new ActionRowBuilder();
    for (const cat of cats) {
      if (r.components.length >= 5) { rows.push(r); r = new ActionRowBuilder(); }
      r.addComponents(new ButtonBuilder().setCustomId(TICKET_IDS.MOVE_CATEGORY(cat.id)).setLabel(cat.name.substring(0,20)).setStyle(ButtonStyle.Secondary));
    }
    if (r.components.length) rows.push(r);
    const extra = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket:move:other').setLabel('Outra Categoria').setStyle(ButtonStyle.Primary));
    rows.push(extra);
    return safeReply(interaction, { content: '🔁 Escolhe a categoria destino ou usa "Outra" para ID manual:', components: rows, flags: MessageFlags.Ephemeral });
  }
  // Botões dinâmicos de mover para categoria específica (legacy)
  if (id.startsWith('ticket:move:cat:')) {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    const targetId = id.split(':').pop();
    try { await interaction.channel.setParent(targetId, { lockPermissions: false }); } catch { return safeReply(interaction, { content: '❌ Falha ao mover.', flags: MessageFlags.Ephemeral }); }
    try { const t = await storage.getTicketByChannel(interaction.channel.id); if (t) await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'move', message: `move->${targetId}` }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    return safeReply(interaction, { content: '🔁 Ticket movido.', flags: MessageFlags.Ephemeral });
  }
  if (id === 'ticket:move:other') {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('ticket:move:other:modal').setTitle('Mover Ticket - Categoria Manual');
    const input = new TextInputBuilder().setCustomId('ticket:move:other:category_id').setLabel('ID da Categoria').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30).setPlaceholder('Ex: 1234567890123456789');
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    try {
      await interaction.showModal(modal);
    } catch (e) {
      logger.warn('[Tickets] Erro ao mostrar modal de mover categoria:', e.message);
      return safeReply(interaction, { content: '❌ Falha ao abrir modal.', flags: MessageFlags.Ephemeral });
    }
    return;
  }
  if (id === 'ticket:add_member') {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('ticket:add_member:modal').setTitle('Adicionar Membros (IDs)');
    const input = new TextInputBuilder().setCustomId('ticket:add_member:ids').setLabel('IDs ou menções (separados por espaço)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(400).setPlaceholder('Ex: @user1 @user2 ou 123... 456...');
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    try {
      await interaction.showModal(modal);
    } catch (e) {
      logger.warn('[Tickets] Erro ao mostrar modal de adicionar membros:', e.message);
      return safeReply(interaction, { content: '❌ Falha ao abrir modal.', flags: MessageFlags.Ephemeral });
    }
    return;
  }
  if (id === 'ticket:remove_member') {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('ticket:remove_member:modal').setTitle('Remover Membros (IDs)');
    const input = new TextInputBuilder().setCustomId('ticket:remove_member:ids').setLabel('IDs ou menções (separados por espaço)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(400).setPlaceholder('Ex: @user1 @user2');
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    try {
      await interaction.showModal(modal);
    } catch (e) {
      logger.warn('[Tickets] Erro ao mostrar modal de remover membros:', e.message);
      return safeReply(interaction, { content: '❌ Falha ao abrir modal.', flags: MessageFlags.Ephemeral });
    }
    return;
  }
  if (id === 'ticket:call_member') {
    // Novo comportamento: mencionar diretamente o autor do ticket para chamar atenção
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t || !(t.user_id || t.ownerId)) return safeReply(interaction, { content: '⚠️ Não foi possível identificar o autor do ticket.', flags: MessageFlags.Ephemeral });
    const ownerId = t.user_id || t.ownerId;
    try { await interaction.channel.send({ content: `🔔 <@${ownerId}> a equipa precisa da tua resposta. (${interaction.user})` }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'call_owner', message: `Chamado owner ${ownerId}` }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    return safeReply(interaction, { content: '🔔 Membro chamado.', flags: MessageFlags.Ephemeral });
  }

  // Painel staff efémero
  // (Removido) painel efémero Ctrl-Staff: botões agora estão sempre visíveis nas linhas principais

  // Ações administrativas (staff)
  // Nota: Os botões usam IDs simples (ticket:close, ticket:claim) mas TICKET_IDS usa prefixos diferentes (ticket:action:close)
  // Adicionamos ambos para compatibilidade
  if (id === TICKET_IDS.CLOSE || id === 'ticket:close' || id === 'ticket:finalize:open' || id === TICKET_IDS.CLAIM || id === 'ticket:claim' || id === 'ticket:release' || id === 'ticket:resolve' || id === 'ticket:reopen' || id.startsWith('ticket:priority') || id === 'ticket:note:open' || id === 'ticket:note' || id === 'ticket:transcript' || id === 'ticket:member:add' || id === 'ticket:member:remove' || id === 'ticket:rename:open' || id === 'ticket:lock-toggle' || id === 'ticket:unlock:author' || id === 'ticket:unlock:everyone') {
    const staff = await isStaff(interaction);
    if (!staff) {
      return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    // Obter ticket pelo canal (necessário para todas as ações abaixo)
    const t = await storage.getTicketByChannel(interaction.channel.id);
  if (!t) return safeReply(interaction, { content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });

    if (id === TICKET_IDS.CLOSE || id === 'ticket:close' || id === 'ticket:finalize:open') {
      if (t.status === 'closed') return interaction.reply({ content: '⚠️ Já está finalizado/fechado.', flags: MessageFlags.Ephemeral });
      const modal = new ModalBuilder()
        .setCustomId('ticket:finalize:submit')
        .setTitle('Finalizar ticket');
      const input = new TextInputBuilder()
        .setCustomId('ticket:finalize:message')
        .setLabel('Mensagem final (opcional)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);
      const row = new (require('discord.js').ActionRowBuilder)().addComponents(input);
      modal.addComponents(row);
      return interaction.showModal(modal);
    }

    if (id === TICKET_IDS.CLAIM || id === 'ticket:claim') {
      if (t.assigned_to) {
        return interaction.reply({ content: `⚠️ Já está reclamado por <@${t.assigned_to}>.`, flags: MessageFlags.Ephemeral });
      }
      const updated = await storage.updateTicket(t.id, { assigned_to: interaction.user.id, status: 'claimed' });
      const embed = new EmbedBuilder().setColor(0x10B981).setDescription(`✋ Ticket reclamado por ${interaction.user}.`);
  await interaction.channel.send({ embeds: [embed] });
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'claim', message: 'Ticket reclamado', data: { channel_id: interaction.channel.id } }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
  try { const wm = interaction.client?.webhooks; if (wm?.sendTicketLog) await wm.sendTicketLog(interaction.guild.id, 'claim', { claimedBy: interaction.user, ticketId: String(t.id), guild: interaction.guild, channelId: interaction.channel.id, previousStatus: t.status, newStatus: 'claimed' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }

  // Update webhook message
  try {
    await webhookSystem.sendOrUpdateTicketWebhook(updated || { ...t, assigned_to: interaction.user.id, status: 'claimed' }, 'claimed', {
      claimedBy: interaction.user
    });
  } catch (err) {
    logger.error('[Tickets] Failed to update webhook for ticket claim:', err);
  }

      await updatePanelHeader(interaction.channel, updated || { ...t, assigned_to: interaction.user.id, status: 'claimed' });
  return safeReply(interaction, { content: '✅ Reclamado.', flags: MessageFlags.Ephemeral });
    }

    if (id === 'ticket:release') {
      if (!t.assigned_to) {
  return safeReply(interaction, { content: '⚠️ Este ticket não está reclamado.', flags: MessageFlags.Ephemeral });
      }
      if (t.assigned_to !== interaction.user.id) {
        // Permitir qualquer staff libertar? Mantemos permissivo.
      }
      const updated = await storage.updateTicket(t.id, { assigned_to: null, status: t.status === 'claimed' ? 'open' : t.status });
      const embed = new EmbedBuilder().setColor(0xF59E0B).setDescription(`👐 Ticket libertado por ${interaction.user}.`);
  await interaction.channel.send({ embeds: [embed] });
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'release', message: 'Ticket libertado', data: { channel_id: interaction.channel.id } }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
  try { const wm = interaction.client?.webhooks; if (wm?.sendTicketLog) await wm.sendTicketLog(interaction.guild.id, 'release', { releasedBy: interaction.user, ticketId: String(t.id), guild: interaction.guild, channelId: interaction.channel.id, previousAssigneeId: t.assigned_to, previousStatus: t.status, newStatus: (t.status === 'claimed' ? 'open' : t.status) }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
      await updatePanelHeader(interaction.channel, updated || { ...t, assigned_to: null, status: t.status === 'claimed' ? 'open' : t.status });
  return safeReply(interaction, { content: '✅ Libertado.', flags: MessageFlags.Ephemeral });
    }

    if (id === 'ticket:priority:open' || id === 'ticket:priority:cycle') {
      // Mostrar seletor de prioridade (compat: se vier de :cycle, abrimos o seletor também)
      const current = (t.priority || 'normal').toLowerCase();
      const menu = new StringSelectMenuBuilder()
        .setCustomId('ticket:priority:select')
        .setPlaceholder('Seleciona a prioridade')
        .addOptions(
          { label: 'Baixa', value: 'low', description: 'Menos urgente', default: current === 'low' },
          { label: 'Normal', value: 'normal', description: 'Prioridade padrão', default: current === 'normal' },
          { label: 'Alta', value: 'high', description: 'Requer atenção', default: current === 'high' },
          { label: 'URGENTE', value: 'urgent', description: 'Criticidade máxima', default: current === 'urgent' }
        );
      const row = new ActionRowBuilder().addComponents(menu);
  return safeReply(interaction, { content: '⚡ Escolhe a nova prioridade para este ticket:', components: [row], flags: MessageFlags.Ephemeral });
    }

    // Back-compat: map 'resolve' to finalize without message
    if (id === 'ticket:resolve') {
  if (t.status === 'closed') return safeReply(interaction, { content: '⚠️ Já está fechado.', flags: MessageFlags.Ephemeral });
  // Evitar timeout enquanto geramos transcript/avisos
  await ensureDeferred(interaction, { flags: MessageFlags.Ephemeral });
      const updated = await storage.updateTicket(t.id, { status: 'closed', closed_at: new Date().toISOString(), close_reason: 'Resolvido' });
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x10B981).setDescription(`✅ Marcado como resolvido por ${interaction.user}.`)] });
      try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'finalize', message: 'Ticket finalizado (resolve)', data: { reason: 'Resolvido' } }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
      try { const wm = interaction.client?.webhooks; if (wm?.sendTicketLog) await wm.sendTicketLog(interaction.guild.id, 'close', { closedBy: interaction.user, ticketId: String(t.id), guild: interaction.guild, reason: 'Resolvido' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }

      // Update webhook message
      try {
        await webhookSystem.sendOrUpdateTicketWebhook(updated || { ...t, status: 'closed' }, 'closed', {
          closer: interaction.user,
          reason: 'Resolvido'
        });
      } catch (err) {
        logger.error('[Tickets] Failed to update webhook for ticket resolve:', err);
      }

      await updatePanelHeader(interaction.channel, updated || { ...t, status: 'closed' });
      // Remover imediatamente acesso de não-staff (autor e membros adicionados)
      try {
        const everyoneId = interaction.guild.id;
        await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: false });
        if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: false, ViewChannel: false });
      } catch (e) { logger.debug('Caught error:', e?.message || e); }
      // Avisar que o canal será apagado em ~3 minutos e gerar transcript
      try { await interaction.channel.send({ content: '🗑️ Este canal será arquivado e apagado automaticamente em cerca de 3 minutos.' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
      try {
        const transcriptHelper = require('./transcriptHelper');
        const { text, attachment } = await transcriptHelper.generateFullTranscript({
          channel: interaction.channel,
          ticketId: String(t.id),
          closedByTag: interaction.user.tag,
          action: 'resolvido',
          maxMessages: 2000
        });
        let sent = false;
        if (attachment) {
          try {
            const wm = interaction.client?.webhooks;
            if (wm && typeof wm.sendTicketLog === 'function') {
              await wm.sendTicketLog(interaction.guild.id, 'close', {
                closedBy: interaction.user,
                ticketId: String(t.id),
                guild: interaction.guild,
                files: [attachment]
              });
              sent = true;
            }
          } catch (e) { logger.debug('Caught error:', e?.message || e); }
          if (!sent) {
            const logCh = await findLogsChannel(interaction.guild);
            if (logCh && logCh.send) {
              await logCh.send({ content: `📄 Transcript do ticket em ${interaction.guild.name}: #${interaction.channel.name}`, files: [attachment] });
              sent = true;
            }
          }
        }
      } catch (e) { logger.debug('Caught error:', e?.message || e); }
      setTimeout(async () => {
        try {
          await interaction.channel.delete('Ticket resolvido (auto delete ~3min)');
          try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'delete', message: 'Canal apagado automaticamente após resolver' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
        } catch (e) { logger.debug('Caught error:', e?.message || e); }
      }, 3 * 60 * 1000);
      if (interaction.deferred) {
        return interaction.editReply({ content: '✅ Resolvido. O canal será apagado automaticamente em ~3 minutos.' });
      }
      return safeReply(interaction, { content: '✅ Resolvido. O canal será apagado automaticamente em ~3 minutos.', flags: MessageFlags.Ephemeral });
    }

    if (id === 'ticket:reopen') {
      if (t.status !== 'closed') return interaction.reply({ content: '⚠️ Só podes reabrir tickets fechados.', flags: MessageFlags.Ephemeral });
      const updated = await storage.updateTicket(t.id, { status: 'open', reopened_at: new Date().toISOString() });
  await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x3B82F6).setDescription(`♻️ Ticket reaberto por ${interaction.user}.`)] });
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'reopen', message: 'Ticket reaberto' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }

  // Update webhook message
  try {
    await webhookSystem.sendOrUpdateTicketWebhook(updated || { ...t, status: 'open' }, 'reopened', {
      reopenedBy: interaction.user
    });
  } catch (err) {
    logger.error('[Tickets] Failed to update webhook for ticket reopen:', err);
  }

      await updatePanelHeader(interaction.channel, updated || { ...t, status: 'open' });
  return safeReply(interaction, { content: '✅ Reaberto.', flags: MessageFlags.Ephemeral });
    }

    if (id === 'ticket:member:add' || id === 'ticket:member:remove') {
      // Abrir modal para inserir ID ou @menção
      const modal = new ModalBuilder().setCustomId('ticket:member:submit').setTitle(id.endsWith('add') ? 'Adicionar membro' : 'Remover membro');
      const input = new TextInputBuilder().setCustomId('ticket:member:target').setLabel('ID ou @ menção').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
      const rowm = new (require('discord.js').ActionRowBuilder)().addComponents(input);
      modal.addComponents(rowm);
      // Guardar contexto em cache volátil via message reference (sem state server): encode in modal id
      modal.setCustomId(`ticket:member:submit:${id.endsWith('add') ? 'add':'remove'}`);
      return interaction.showModal(modal);
    }

    if (id === 'ticket:note:open' || id === 'ticket:note') {
      const modal = new ModalBuilder()
        .setCustomId('ticket:note:submit')
        .setTitle('📝 Nota interna');
      const input = new TextInputBuilder()
        .setCustomId('ticket:note:content')
        .setLabel('Conteúdo da nota')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);
      const row = new (require('discord.js').ActionRowBuilder)().addComponents(input);
      modal.addComponents(row);
      return interaction.showModal(modal);
    }

    if (id === 'ticket:transcript') {
      try {
        if (!interaction.deferred && !interaction.replied) {
          try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
        }
        const messages = await fetchAllMessages(interaction.channel, 2000);
        let transcript = `TRANSCRICAO TICKET ${interaction.channel.name} (canal ${interaction.channel.id})\nServidor: ${interaction.guild?.name} (${interaction.guildId})\nGerado por: ${interaction.user.tag} em ${new Date().toISOString()}\n\n`;
        for (const m of messages) {
          const ts = new Date(m.createdTimestamp).toISOString();
          const author = m.author?.tag || m.author?.id || 'Desconhecido';
          const content = (m.content || '').replace(/\n/g, ' ');
          const atts = m.attachments && m.attachments.size > 0 ? ` [anexos: ${Array.from(m.attachments.values()).map(a=>a.name).join(', ')}]` : '';
          transcript += `${ts} - ${author}: ${content}${atts}\n`;
        }
        const { AttachmentBuilder } = require('discord.js');
        const file = new AttachmentBuilder(Buffer.from(transcript,'utf8'), { name: `transcript-${interaction.channel.id}.txt` });
        let sent = false;
        // Preferir webhook configurado
        try {
          const wm = interaction.client?.webhooks;
          if (wm && typeof wm.sendTicketLog === 'function') {
            await wm.sendTicketLog(interaction.guild.id, 'update', {
              updatedBy: interaction.user,
              ticketId: (await storage.getTicketByChannel(interaction.channel.id))?.id?.toString(),
              guild: interaction.guild,
              files: [file]
            });
            sent = true;
          }
        } catch (e) { logger.debug('Caught error:', e?.message || e); }
        if (!sent) {
          const logCh = await findLogsChannel(interaction.guild);
          if (logCh && logCh.send) {
              await logCh.send({ content: `📄 Transcript solicitado por ${interaction.user} em ${interaction.channel}`, files: [file] });
              sent = true;
          }
        }
        if (!sent) {
          // fallback: enviar no próprio canal
          await interaction.channel.send({ files: [file] });
        }
        if (interaction.deferred) {
          return await interaction.editReply({ content: '✅ Transcript gerado.' });
        } else if (!interaction.replied) {
          return await interaction.reply({ content: '✅ Transcript gerado.', flags: MessageFlags.Ephemeral });
        }
        return;
      } catch (e) {
        if (interaction.deferred) {
          return await interaction.editReply({ content: '❌ Falha ao gerar transcript.' });
        }
        return interaction.reply({ content: '❌ Falha ao gerar transcript.', flags: MessageFlags.Ephemeral }).catch(()=>null);
      }
    }

    if (id === 'ticket:rename:open') {
      // Abrir modal para novo nome
      const modal = new ModalBuilder()
        .setCustomId('ticket:rename:submit')
        .setTitle('Renomear canal');
      const input = new TextInputBuilder()
        .setCustomId('ticket:rename:newname')
        .setLabel('Novo nome do canal')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(90);
      const row = new (require('discord.js').ActionRowBuilder)().addComponents(input);
      modal.addComponents(row);
      return interaction.showModal(modal);
    }

    if (id === 'ticket:lock-toggle') {
      try {
        // Toggle SendMessages para @everyone e autor do ticket (manter staff com envio)
        const everyoneId = interaction.guild.id;
        const overwrites = interaction.channel.permissionOverwrites;
        const current = overwrites?.cache?.get(everyoneId);
        const isLocked = current?.deny?.has?.(PermissionFlagsBits.SendMessages);

        // Bloquear: negar envio para everyone e autor; Desbloquear: permitir enviar para autor
        if (!isLocked) {
          await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: false });
          if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: false });
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0xF59E0B).setDescription(`🔐 Canal bloqueado por ${interaction.user}.`)] });
          const updated = await storage.updateTicket(t.id, { locked: true });
          try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'lock', message: 'Canal bloqueado' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
          await updatePanelHeader(interaction.channel, updated || { ...t, locked: true });
          return interaction.reply({ content: '✅ Bloqueado.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: null });
          if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: true });
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x10B981).setDescription(`🔓 Canal desbloqueado por ${interaction.user}.`)] });
          const updated = await storage.updateTicket(t.id, { locked: false });
          try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'unlock', message: 'Canal desbloqueado' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
          await updatePanelHeader(interaction.channel, updated || { ...t, locked: false });
          return interaction.reply({ content: '✅ Desbloqueado.', flags: MessageFlags.Ephemeral });
        }
      } catch {
        return interaction.reply({ content: '❌ Falha ao alternar bloqueio.', flags: MessageFlags.Ephemeral });
      }
    }

    if (id === 'ticket:unlock:author' || id === 'ticket:unlock:everyone') {
      try {
        const everyoneId = interaction.guild.id;
        // Garantir que bloqueio geral é levantado conforme escolha
        if (id === 'ticket:unlock:author') {
          await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: false });
          if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: true, ViewChannel: true });
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x10B981).setDescription(`🔓 Canal desbloqueado para o autor por ${interaction.user}.`)] });
          const updated = await storage.updateTicket(t.id, { locked: true });
          try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'unlock:author', message: 'Desbloqueado para autor' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
          await updatePanelHeader(interaction.channel, updated || { ...t, locked: true });
          return interaction.reply({ content: '✅ Desbloqueado para autor.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: null });
          if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: true, ViewChannel: true });
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x10B981).setDescription(`🔓 Canal desbloqueado para todos por ${interaction.user}.`)] });
          const updated = await storage.updateTicket(t.id, { locked: false });
          try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'unlock:all', message: 'Desbloqueado para todos' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
          await updatePanelHeader(interaction.channel, updated || { ...t, locked: false });
          return interaction.reply({ content: '✅ Desbloqueado para todos.', flags: MessageFlags.Ephemeral });
        }
      } catch {
        return interaction.reply({ content: '❌ Falha ao desbloquear.', flags: MessageFlags.Ephemeral });
      }
    }
  }
}

async function handleModal(interaction) {
  const id = interaction.customId;
  if (id === TICKET_IDS.MODAL_NOTE) {
    const staff = await isStaff(interaction);
    if (!staff) {
  return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    const t = await storage.getTicketByChannel(interaction.channel.id);
  if (!t) return safeReply(interaction, { content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });
    const content = interaction.fields.getTextInputValue(TICKET_IDS.INPUT_NOTE_TEXT);
    const notes = Array.isArray(t.notes) ? t.notes.slice() : [];
    notes.push({ id: Date.now().toString(), content, author: interaction.user.id, timestamp: new Date().toISOString() });
  await storage.updateTicket(t.id, { notes });
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'note', message: content }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    // Tentar enviar para canal de logs (só staff vê), senão apenas confirmar
    try {
      const cfg = await storage.getGuildConfig(interaction.guild.id);
      const logChannelId = cfg?.channels?.logs || null;
      if (logChannelId) {
        const logCh = interaction.guild.channels.cache.get(logChannelId) || await interaction.client.channels.fetch(logChannelId).catch(()=>null);
        if (logCh && logCh.send) {
          const embed = new EmbedBuilder().setColor(0x64748B).setTitle('📝 Nota interna').setDescription(content).setFooter({ text: `Por ${interaction.user.tag}` }).setTimestamp();
          await logCh.send({ embeds: [embed] });
        }
      }
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
    return interaction.reply({ content: '✅ Nota guardada.', flags: MessageFlags.Ephemeral });
  }

  if (id === 'ticket:finalize:submit') {
    const staff = await isStaff(interaction);
    if (!staff) {
      return interaction.reply({ content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t) return interaction.reply({ content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });
    if (t.status === 'closed') return interaction.reply({ content: '⚠️ Já está finalizado/fechado.', flags: MessageFlags.Ephemeral });
    // Evitar timeout enquanto processamos
  try { if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    const message = interaction.fields.getTextInputValue('ticket:finalize:message') || '';
  const updated = await storage.updateTicket(t.id, { status: 'closed', closed_at: new Date().toISOString(), close_reason: 'Finalizado' });
    const visualAssets = require('../assets/visual-assets');
    const embed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle('✅ Ticket Finalizado')
      .setThumbnail(visualAssets.realImages.successIcon)
      .setImage(visualAssets.realImages.successBanner)
      .setDescription(`${interaction.user} finalizou o ticket.${message ? `\n\nMensagem final:\n> ${message}` : ''}`)
      .setTimestamp();
  await interaction.channel.send({ embeds: [embed] });
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'finalize', message, data: { reason: 'Finalizado' } }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
  try { const wm = interaction.client?.webhooks; if (wm?.sendTicketLog) await wm.sendTicketLog(interaction.guild.id, 'close', { closedBy: interaction.user, ticketId: String(t.id), guild: interaction.guild, reason: message || 'Finalizado' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    await updatePanelHeader(interaction.channel, updated || { ...t, status: 'closed' });
    // Remover imediatamente acesso de não-staff (autor e membros adicionados)
    try {
      const everyoneId = interaction.guild.id;
      await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: false });
      if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: false, ViewChannel: false });
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
    // Anunciar eliminação do canal em ~3 minutos
    try { await interaction.channel.send({ content: '🗑️ Este canal será arquivado e apagado automaticamente em cerca de 3 minutos.' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    // Gerar transcript e enviar para logs antes de apagar
    try {
      const transcriptHelper = require('./transcriptHelper');
      const { text, attachment } = await transcriptHelper.generateFullTranscript({
        channel: interaction.channel,
        ticketId: String(t.id),
        closedByTag: interaction.user.tag,
        action: 'finalizado',
        maxMessages: 2000
      });
      let sent = false;
      if (attachment) {
        try {
          const wm = interaction.client?.webhooks;
          if (wm && typeof wm.sendTicketLog === 'function') {
            await wm.sendTicketLog(interaction.guild.id, 'close', {
              closedBy: interaction.user,
              ticketId: String(t.id),
              guild: interaction.guild,
              files: [attachment]
            });
            sent = true;
          }
        } catch (e) { logger.debug('Caught error:', e?.message || e); }
        if (!sent) {
          const logCh = await findLogsChannel(interaction.guild);
          if (logCh && logCh.send) {
            await logCh.send({ content: `📄 Transcript do ticket em ${interaction.guild.name}: #${interaction.channel.name}`, files: [attachment] });
            sent = true;
          }
        }
      }
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
    // Agendar eliminação do canal em ~3 minutos
    setTimeout(async () => {
      try {
        await interaction.channel.delete('Ticket finalizado (auto delete ~3min)');
        try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'delete', message: 'Canal apagado automaticamente após finalizar' }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
      } catch (e) { logger.debug('Caught error:', e?.message || e); }
    }, 3 * 60 * 1000);
    if (interaction.deferred) {
      return interaction.editReply({ content: '✅ Finalizado. O canal será apagado automaticamente em ~3 minutos.' });
    }
    return interaction.reply({ content: '✅ Finalizado. O canal será apagado automaticamente em ~3 minutos.', flags: MessageFlags.Ephemeral });
  }
  if (id === 'ticket:add_member:modal') {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa.', flags: MessageFlags.Ephemeral });
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t) return safeReply(interaction, { content: '⚠️ Ticket não encontrado.', flags: MessageFlags.Ephemeral });
    const raw = interaction.fields.getTextInputValue('ticket:add_member:ids');

    // Validar e sanitizar IDs
    const ids = Array.from(new Set(raw.split(/[\s,]+/).map(s=>s.replace(/[^0-9]/g,'')).filter(x => /^\d{17,20}$/.test(x)))).slice(0,10);
    if (!ids.length) return safeReply(interaction, { content: '❌ Nenhum ID válido. Use IDs numéricos (17-20 dígitos) ou menções.', flags: MessageFlags.Ephemeral });

    const added = [];
    const failed = [];
    for (const uid of ids) {
      try {
        // Verificar se membro existe no servidor
        const member = await interaction.guild.members.fetch(uid).catch(() => null);
        if (!member) {
          failed.push(`<@${uid}> (não encontrado)`);
          continue;
        }

        await interaction.channel.permissionOverwrites.edit(uid, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
        added.push(uid);
      } catch (e) {
        logger.warn(`[Tickets] Erro ao adicionar ${uid}:`, e.message);
        failed.push(`<@${uid}>`);
      }
    }
    try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'member:add:bulk', message: `IDs: ${added.join(',')}` }); } catch (e) { logger.debug('Caught error:', e?.message || e); }

    let msg = added.length ? `✅ Adicionados ${added.length}/${ids.length}: ${added.map(i=>`<@${i}>`).join(', ')}` : '❌ Nenhum membro adicionado.';
    if (failed.length > 0) msg += `\n⚠️ Falhados: ${failed.join(', ')}`;
    return safeReply(interaction, { content: msg, flags: MessageFlags.Ephemeral });
  }
  if (id === 'ticket:remove_member:modal') {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa.', flags: MessageFlags.Ephemeral });
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t) return safeReply(interaction, { content: '⚠️ Ticket não encontrado.', flags: MessageFlags.Ephemeral });
    const raw = interaction.fields.getTextInputValue('ticket:remove_member:ids');
    const ids = Array.from(new Set(raw.split(/[\s,]+/).map(s=>s.replace(/[^0-9]/g,'')).filter(Boolean))).slice(0,10);
    const removed = [];
    for (const uid of ids) {
      try { await interaction.channel.permissionOverwrites.delete(uid).catch(()=>{}); removed.push(uid); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    }
    try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'member:remove:bulk', message: `IDs: ${removed.join(',')}` }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    return safeReply(interaction, { content: removed.length ? `✅ Removidos: ${removed.map(i=>`<@${i}>`).join(', ')}` : '❌ Nenhum ID válido.', flags: MessageFlags.Ephemeral });
  }
  if (id === 'ticket:move:other:modal') {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa.', flags: MessageFlags.Ephemeral });
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t) return safeReply(interaction, { content: '⚠️ Ticket não encontrado.', flags: MessageFlags.Ephemeral });
    const raw = interaction.fields.getTextInputValue('ticket:move:other:category_id').trim();
    const catId = raw.replace(/[^0-9]/g,'');

    // Validar formato de ID
    if (!catId || !/^\d{17,20}$/.test(catId)) {
      return safeReply(interaction, { content: '❌ ID inválido. Use um ID de categoria válido (17-20 dígitos).', flags: MessageFlags.Ephemeral });
    }

    try {
      // Verificar se categoria existe
      const targetCat = await interaction.guild.channels.fetch(catId).catch(() => null);
      if (!targetCat || targetCat.type !== ChannelType.GuildCategory) {
        return safeReply(interaction, { content: '❌ Categoria não encontrada. Verifica se o ID está correto.', flags: MessageFlags.Ephemeral });
      }

      await interaction.channel.setParent(catId, { lockPermissions: false });
      await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'move', message: `move->${catId}`, data: { manual: true, categoryName: targetCat.name } });
      return safeReply(interaction, { content: `✅ Ticket movido para **${targetCat.name}**.`, flags: MessageFlags.Ephemeral });
    } catch (e) {
      logger.warn(`[Tickets] Erro ao mover ticket ${t.id}:`, e.message);
      return safeReply(interaction, { content: `❌ Falha ao mover: ${e.message}`, flags: MessageFlags.Ephemeral });
    }
  }

  if (id.startsWith('ticket:member:submit')) {
    const staff = await isStaff(interaction);
    if (!staff) {
      return interaction.reply({ content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    const mode = id.split(':').pop(); // 'add' | 'remove'
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t) return interaction.reply({ content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });
    const raw = interaction.fields.getTextInputValue('ticket:member:target').trim();
    const mId = (raw.match(/\d{17,20}/) || [])[0];
  if (!mId) return safeReply(interaction, { content: 'Fornece um ID ou menção válida.', flags: MessageFlags.Ephemeral });
    const member = await interaction.guild.members.fetch(mId).catch(() => null);
  if (!member) return safeReply(interaction, { content: 'Membro não encontrado.', flags: MessageFlags.Ephemeral });
    try {
      if (mode === 'add') {
        await interaction.channel.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
        await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x60A5FA).setDescription(`➕ ${member} adicionado ao ticket por ${interaction.user}.`)] });
        try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'member:add', message: `Adicionado ${member.id}` }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
  return safeReply(interaction, { content: '✅ Membro adicionado.', flags: MessageFlags.Ephemeral });
      } else {
        await interaction.channel.permissionOverwrites.edit(member.id, {
          ViewChannel: false,
          SendMessages: false
        });
        await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0xF87171).setDescription(`➖ ${member} removido do ticket por ${interaction.user}.`)] });
        try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'member:remove', message: `Removido ${member.id}` }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
  return safeReply(interaction, { content: '✅ Membro removido.', flags: MessageFlags.Ephemeral });
      }
    } catch (e) {
  return safeReply(interaction, { content: '❌ Falha ao atualizar permissões.', flags: MessageFlags.Ephemeral });
    }
  }

  if (id === TICKET_IDS.MODAL_RENAME) {
    const staff = await isStaff(interaction);
    if (!staff) {
  return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    const t = await storage.getTicketByChannel(interaction.channel.id);
  if (!t) return safeReply(interaction, { content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });
    const newName = interaction.fields.getTextInputValue(TICKET_IDS.INPUT_CHANNEL_NAME)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .slice(0, 90);
    if (!newName) return interaction.reply({ content: 'Fornece um nome válido.', flags: MessageFlags.Ephemeral });
    try {
  await interaction.channel.setName(newName, `Renomeado por ${interaction.user.tag}`);
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x60A5FA).setDescription(`✏️ Canal renomeado para #${newName} por ${interaction.user}.`)] });
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'rename', message: `Renomeado para ${newName}` }); } catch (e) { logger.debug('Caught error:', e?.message || e); }

  // Update webhook message
  try {
    await webhookSystem.sendOrUpdateTicketWebhook(t, 'renamed', {
      renamedBy: interaction.user,
      newName: newName
    });
  } catch (err) {
    logger.error('[Tickets] Failed to update webhook for ticket rename:', err);
  }

      return interaction.reply({ content: '✅ Canal renomeado.', flags: MessageFlags.Ephemeral });
    } catch {
      return interaction.reply({ content: '❌ Falha ao renomear canal.', flags: MessageFlags.Ephemeral });
    }
  }
}

async function handleSelect(interaction) {
  const id = interaction.customId;

  // 🆕 Handler para seleção de categoria customizável
  if (id === TICKET_IDS.CATEGORY_SELECT) {
    try {
      const categoryId = interaction.values?.[0];
      if (!categoryId) {
        return safeReply(interaction, {
          content: '❌ Nenhuma categoria selecionada.',
          flags: MessageFlags.Ephemeral
        });
      }

      // Buscar categoria escolhida
      const category = await TicketCategoryModel.findOne({
        _id: categoryId,
        guild_id: interaction.guild.id,
        enabled: true
      }).lean();

      if (!category) {
        return safeReply(interaction, {
          content: '❌ Categoria não encontrada ou desativada.',
          flags: MessageFlags.Ephemeral
        });
      }

      // Recuperar contexto original (tipo default)
      const tempKey = `ticket_category_context:${interaction.guild.id}:${interaction.user.id}`;
      const context = await storage.getGeneric(tempKey);
      const defaultType = context?.defaultType || 'technical';

      // Apagar contexto temporário
      await storage.deleteGeneric(tempKey).catch(() => {});

      // Atualizar mensagem de seleção
      await interaction.update({
        content: `✅ Categoria escolhida: **${category.emoji} ${category.name}**\n⏳ A criar ticket...`,
        embeds: [],
        components: []
      });

      // Criar ticket com categoria customizada
      await createTicket(interaction, defaultType, category);

    } catch (error) {
      logger.error('[Tickets] Error handling category selection:', error);
      return safeReply(interaction, {
        content: '❌ Erro ao processar seleção. Tenta novamente.',
        flags: MessageFlags.Ephemeral
      });
    }
    return;
  }

  // Handler para botões dinâmicos de mover (categoria direta)
  if (id.startsWith('ticket:move:cat:')) {
    const staff = await isStaff(interaction);
    if (!staff) return interaction.reply({ content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    const targetId = id.split(':').pop();
    try {
      await interaction.channel.setParent(targetId, { lockPermissions: false });
      return interaction.reply({ content: '🔁 Ticket movido.', flags: MessageFlags.Ephemeral });
    } catch {
      return interaction.reply({ content: '❌ Falha ao mover ticket.', flags: MessageFlags.Ephemeral });
    }
  }
  if (id === 'ticket:priority:select') {
    const staff = await isStaff(interaction);
    if (!staff) {
      return interaction.reply({ content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t) return interaction.reply({ content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });
    const value = interaction.values?.[0];
    const allowed = ['low','normal','high','urgent'];
    const chosen = allowed.includes((value||'').toLowerCase()) ? value.toLowerCase() : 'normal';
    const updated = await storage.updateTicket(t.id, { priority: chosen });
    const label = chosen.toUpperCase();
    const color = chosen === 'urgent' ? 0xEF4444 : chosen === 'high' ? 0xF59E0B : chosen === 'normal' ? 0x3B82F6 : 0x6B7280;
    const embed = new EmbedBuilder().setColor(color).setDescription(`⚡ Prioridade alterada para ${label} por ${interaction.user}.`);
    await interaction.channel.send({ embeds: [embed] });
    await updatePanelHeader(interaction.channel, updated || { ...t, priority: chosen });
    return interaction.update({ content: `✅ Prioridade definida: ${label}`, components: [] });
  }

  if (id === 'ticket:more') {
    const staff = await isStaff(interaction);
    if (!staff) {
      return interaction.reply({ content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t) return interaction.reply({ content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });
    const value = interaction.values?.[0];
    switch (value) {
      case 'priority': {
        const current = (t.priority || 'normal').toLowerCase();
        const menu = new StringSelectMenuBuilder()
          .setCustomId('ticket:priority:select')
          .setPlaceholder('Seleciona a prioridade')
          .addOptions(
            { label: 'Baixa', value: 'low', description: 'Menos urgente', default: current === 'low' },
            { label: 'Normal', value: 'normal', description: 'Prioridade padrão', default: current === 'normal' },
            { label: 'Alta', value: 'high', description: 'Requer atenção', default: current === 'high' },
            { label: 'URGENTE', value: 'urgent', description: 'Criticidade máxima', default: current === 'urgent' }
          );
        const row = new ActionRowBuilder().addComponents(menu);
  return safeReply(interaction, { content: '⚡ Escolhe a nova prioridade para este ticket:', components: [row], flags: MessageFlags.Ephemeral });
      }
      case 'note': {
        const modal = new ModalBuilder()
          .setCustomId('ticket:note:submit')
          .setTitle('📝 Nota interna');
        const input = new TextInputBuilder()
          .setCustomId('ticket:note:content')
          .setLabel('Conteúdo da nota')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);
        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
        return interaction.showModal(modal);
      }
      case 'member:add': {
        const modal = new ModalBuilder().setCustomId('ticket:member:submit:add').setTitle('Adicionar membro');
        const input = new TextInputBuilder().setCustomId('ticket:member:target').setLabel('ID ou @ menção').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
        return interaction.showModal(modal);
      }
      case 'member:remove': {
        const modal = new ModalBuilder().setCustomId('ticket:member:submit:remove').setTitle('Remover membro');
        const input = new TextInputBuilder().setCustomId('ticket:member:target').setLabel('ID ou @ menção').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
        return interaction.showModal(modal);
      }
      case 'rename': {
        const modal = new ModalBuilder().setCustomId('ticket:rename:submit').setTitle('Renomear canal');
        const input = new TextInputBuilder().setCustomId('ticket:rename:newname').setLabel('Novo nome do canal').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90);
        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
        return interaction.showModal(modal);
      }
      case 'reopen': {
  if (t.status !== 'closed') return safeReply(interaction, { content: '⚠️ Só podes reabrir tickets fechados.', flags: MessageFlags.Ephemeral });
        const updated = await storage.updateTicket(t.id, { status: 'open', reopened_at: new Date().toISOString() });
        await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x3B82F6).setDescription(`♻️ Ticket reaberto por ${interaction.user}.`)] });
        await updatePanelHeader(interaction.channel, updated || { ...t, status: 'open' });
  return safeReply(interaction, { content: '✅ Reaberto.', flags: MessageFlags.Ephemeral });
      }
      case 'close': {
        // Original fechar com confirmação (apagar canal)
        return requestClose(interaction);
      }
      default:
  return safeReply(interaction, { content: 'Ação inválida.', flags: MessageFlags.Ephemeral });
    }
  }
}

module.exports = { handleButton, handleModal, handleSelect };
