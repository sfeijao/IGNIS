const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { ensureDeferred, safeReply, safeUpdate } = require('./interactionHelpers');
const storage = require('./storage');

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
  } catch {}
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
  } catch {}
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

async function createTicket(interaction, type) {
  // Impedir múltiplos tickets abertos por utilizador
  const existing = (await storage.getUserActiveTickets(interaction.user.id, interaction.guild.id)) || [];
  if (existing.length > 0) {
    const t = existing[0];
    return safeReply(interaction, { content: `❌ Já tens um ticket aberto: <#${t.channel_id}>`, flags: MessageFlags.Ephemeral });
  }

  // Ler configuração de tickets
  let cfg;
  try { cfg = await storage.getGuildConfig(interaction.guild.id); } catch {}
  let parentCategoryId = cfg?.tickets?.ticketsCategoryId || null;
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
  const info = departmentInfo(type);
  const channelName = `${info.emoji}-${interaction.user.username}`.toLowerCase();

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
    } catch {}
  }

  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parentCategoryId,
    permissionOverwrites: overwrites,
    topic: `Ticket • ${info.name} • ${interaction.user.tag}`
  });

  // Persistir
  const ticket = await storage.createTicket({
    guild_id: interaction.guild.id,
    channel_id: channel.id,
    user_id: interaction.user.id,
    type,
    description: null,
    priority: 'normal'
  });

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
  const welcome = (cfgTickets.welcomeMsg || `Olá {user}, obrigado por abrir um ticket!`).replace(/\{user\}|\{user_tag\}|\{server\}|\{ticket_id\}/g, (m)=> placeholders[m] || m);

  // Usar os builders V2 do serviço TS para padronizar a aparência
  let embeds;
  try {
    const svc = require('../dist/services/ticketService.js');
    if (svc && typeof svc.buildPanelEmbedsV2 === 'function') {
      embeds = svc.buildPanelEmbedsV2(interaction.member, departmentInfo(type)?.name || info.name, interaction.guild.iconURL?.() || visualAssets?.realImages?.supportIcon);
    }
  } catch {}
  if (!embeds) {
    // Fallback simples caso o dist ainda não exista
    const introMain = new EmbedBuilder()
      .setColor(info.color)
      .setTitle('Ticket Criado com Sucesso! 📌')
      .setDescription('Todos os responsáveis pelo ticket já estão cientes da abertura.\nEvite chamar alguém via DM, basta aguardar alguém já irá lhe atender..')
      .addFields(
        { name: 'Categoria Escolhida:', value: `🧾 \`Ticket ${info.name}\``, inline: false },
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
      } catch {}
    }
  } catch {}
  if (!components) {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:cancel').setLabel('Desejo sair ou cancelar este ticket').setStyle(ButtonStyle.Danger).setEmoji('🧯'),
      new ButtonBuilder().setCustomId('ticket:how_dm').setLabel('Como libero minha DM?').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:call_member').setLabel('Chamar Membro').setStyle(ButtonStyle.Primary).setEmoji('🔔'),
      new ButtonBuilder().setCustomId('ticket:add_member').setLabel('Adicionar Membro').setStyle(ButtonStyle.Success).setEmoji('➕'),
      new ButtonBuilder().setCustomId('ticket:remove_member').setLabel('Remover Membro').setStyle(ButtonStyle.Danger).setEmoji('❌'),
      new ButtonBuilder().setCustomId('ticket:move').setLabel('Mover Ticket').setStyle(ButtonStyle.Secondary).setEmoji('🔁'),
      new ButtonBuilder().setCustomId('ticket:rename').setLabel('Trocar Nome do Canal').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
    );
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:claim').setLabel('Assumir Atendimento').setStyle(ButtonStyle.Primary).setEmoji('🟦'),
      new ButtonBuilder().setCustomId('ticket:greet').setLabel('Saudar Atendimento').setStyle(ButtonStyle.Primary).setEmoji('👋'),
      new ButtonBuilder().setCustomId('ticket:note').setLabel('Adicionar Observação Interna').setStyle(ButtonStyle.Secondary).setEmoji('🗒️'),
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Finalizar Ticket').setStyle(ButtonStyle.Success).setEmoji('✅'),
    );
    components = [row1, row2, row3];
  }

  const panelMsg = await channel.send({ content: `${interaction.user}`, embeds, components });
  // Guardar referência para futuras edições do cabeçalho
  try { await storage.updateTicket(ticket.id, { panel_message_id: panelMsg.id }); } catch {}

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
      } catch {}
      if (!logCh) logCh = await findLogsChannel(interaction.guild);
      if (logCh && logCh.send) {
        await logCh.send({ embeds: [new EmbedBuilder().setColor(0x7C3AED).setTitle('📩 Ticket Aberto').setDescription(`${interaction.user} abriu um ticket: ${channel}`)] });
      }
    }
  } catch {}

  return safeReply(interaction, { content: `✅ Ticket criado: ${channel}`, flags: MessageFlags.Ephemeral });
}

async function requestClose(interaction) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close:confirm').setLabel('Confirmar').setEmoji('✅').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket:close:cancel').setLabel('Cancelar').setEmoji('❌').setStyle(ButtonStyle.Secondary)
  );
  return safeReply(interaction, { content: 'Tens a certeza que queres fechar este ticket?', components: [row], flags: MessageFlags.Ephemeral });
}

async function confirmClose(interaction) {
  // Evitar timeout da interação ao executar operações pesadas
  try { await interaction.deferUpdate(); } catch {}
  // Atualizar storage
  try {
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (t) await storage.updateTicket(t.id, { status: 'closed', closed_at: new Date().toISOString(), closed_by: interaction.user.id });
  } catch {}

  const closed = new EmbedBuilder()
    .setColor(0xEF4444)
    .setTitle('🔒 Ticket Fechado')
    .setDescription(`Fechado por ${interaction.user} • <t:${Math.floor(Date.now()/1000)}:R>`)
    .setTimestamp();

  await interaction.channel.send({ embeds: [closed] });
  // Gerar transcript completo (paginado) e enviar para canal de logs, se configurado
  try {
    const messages = await fetchAllMessages(interaction.channel, 2000);
    let transcript = `TRANSCRICAO TICKET ${interaction.channel.name} (canal ${interaction.channel.id})\nServidor: ${interaction.guild?.name} (${interaction.guildId})\nFechado por: ${interaction.user.tag} em ${new Date().toISOString()}\n\n`;
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
        await wm.sendTicketLog(interaction.guild.id, 'close', {
          closedBy: interaction.user,
          ticketId: (await storage.getTicketByChannel(interaction.channel.id))?.id?.toString(),
          duration: '—',
          guild: interaction.guild,
          files: [file]
        });
        sent = true;
      }
    } catch {}
    if (!sent) {
      const logCh = await findLogsChannel(interaction.guild);
      if (logCh && logCh.send) {
        await logCh.send({ content: `📄 Transcript do ticket em ${interaction.guild.name}: #${interaction.channel.name}`, files: [file] });
        sent = true;
      }
    }
  } catch {}
  try { await interaction.editReply({ content: '✅ Ticket será apagado automaticamente em 10 segundos. Obrigado!', components: [] }); } catch {}
  try { await interaction.channel.send({ content: '🗑️ Este canal será apagado automaticamente em 10 segundos.' }); } catch {}

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
  if (id.startsWith('ticket:create:')) {
    const type = id.split(':')[2];
    return createTicket(interaction, type);
  }
  if (id === 'ticket:close:request') return requestClose(interaction);
  if (id === 'ticket:close:confirm') return confirmClose(interaction);
  if (id === 'ticket:close:cancel') return interaction.update({ content: '❎ Cancelado.', components: [] });

  // --- Novos botões do layout unificado (quando canal é legado e não existe TicketModel TS) ---
  // Para estes IDs o handler TS não responde porque resolveTicket() retorna null.
  // Implementamos respostas básicas aqui.
  if (id === 'ticket:cancel') {
    try { await interaction.reply({ content: '✅ Ticket será cancelado e apagado.', flags: MessageFlags.Ephemeral }); } catch {}
    setTimeout(()=>{ try { interaction.channel.delete('Ticket cancelado'); } catch {} }, 1500);
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
    const modal = new ModalBuilder().setCustomId('ticket:note:modal').setTitle('Nota interna');
    const input = new TextInputBuilder().setCustomId('ticket:note:text').setLabel('Conteúdo da nota').setStyle(TextInputStyle.Paragraph).setMinLength(2).setMaxLength(500).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    try { await interaction.showModal(modal); } catch { return safeReply(interaction, { content: '❌ Falha ao mostrar modal.', flags: MessageFlags.Ephemeral }); }
    return;
  }
  if (id === 'ticket:rename') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('ticket:rename:modal').setTitle('Renomear Canal');
    const input = new TextInputBuilder().setCustomId('ticket:rename:name').setLabel('Novo nome').setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(90).setRequired(true);
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
      r.addComponents(new ButtonBuilder().setCustomId(`ticket:move:cat:${cat.id}`).setLabel(cat.name.substring(0,20)).setStyle(ButtonStyle.Secondary));
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
    try { const t = await storage.getTicketByChannel(interaction.channel.id); if (t) await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'move', message: `move->${targetId}` }); } catch {}
    return safeReply(interaction, { content: '🔁 Ticket movido.', flags: MessageFlags.Ephemeral });
  }
  if (id === 'ticket:move:other') {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('ticket:move:other:modal').setTitle('Mover Ticket - Categoria Manual');
    const input = new TextInputBuilder().setCustomId('ticket:move:other:category_id').setLabel('ID da Categoria').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    try { await interaction.showModal(modal); } catch {}
    return;
  }
  if (id === 'ticket:add_member') {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('ticket:add_member:modal').setTitle('Adicionar Membros (IDs)');
    const input = new TextInputBuilder().setCustomId('ticket:add_member:ids').setLabel('IDs ou menções (separados por espaço)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(400);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    try { await interaction.showModal(modal); } catch {}
    return;
  }
  if (id === 'ticket:remove_member') {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('ticket:remove_member:modal').setTitle('Remover Membros (IDs)');
    const input = new TextInputBuilder().setCustomId('ticket:remove_member:ids').setLabel('IDs ou menções (separados por espaço)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(400);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    try { await interaction.showModal(modal); } catch {}
    return;
  }
  if (id === 'ticket:call_member') {
    // Novo comportamento: mencionar diretamente o autor do ticket para chamar atenção
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t || !(t.user_id || t.ownerId)) return safeReply(interaction, { content: '⚠️ Não foi possível identificar o autor do ticket.', flags: MessageFlags.Ephemeral });
    const ownerId = t.user_id || t.ownerId;
    try { await interaction.channel.send({ content: `🔔 <@${ownerId}> a equipa precisa da tua resposta. (${interaction.user})` }); } catch {}
    try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'call_owner', message: `Chamado owner ${ownerId}` }); } catch {}
    return safeReply(interaction, { content: '🔔 Membro chamado.', flags: MessageFlags.Ephemeral });
  }

  // Painel staff efémero
  // (Removido) painel efémero Ctrl-Staff: botões agora estão sempre visíveis nas linhas principais

  // Ações administrativas (staff)
  if (id === 'ticket:finalize:open' || id === 'ticket:claim' || id === 'ticket:release' || id === 'ticket:resolve' || id === 'ticket:reopen' || id.startsWith('ticket:priority') || id === 'ticket:note:open' || id === 'ticket:transcript' || id === 'ticket:member:add' || id === 'ticket:member:remove' || id === 'ticket:rename:open' || id === 'ticket:lock-toggle' || id === 'ticket:unlock:author' || id === 'ticket:unlock:everyone') {
    const staff = await isStaff(interaction);
    if (!staff) {
      return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    // Obter ticket pelo canal (necessário para todas as ações abaixo)
    const t = await storage.getTicketByChannel(interaction.channel.id);
  if (!t) return safeReply(interaction, { content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });

    if (id === 'ticket:finalize:open') {
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

    if (id === 'ticket:claim') {
      if (t.assigned_to) {
        return interaction.reply({ content: `⚠️ Já está reclamado por <@${t.assigned_to}>.`, flags: MessageFlags.Ephemeral });
      }
      const updated = await storage.updateTicket(t.id, { assigned_to: interaction.user.id, status: 'claimed' });
      const embed = new EmbedBuilder().setColor(0x10B981).setDescription(`✋ Ticket reclamado por ${interaction.user}.`);
  await interaction.channel.send({ embeds: [embed] });
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'claim', message: 'Ticket reclamado', data: { channel_id: interaction.channel.id } }); } catch {}
  try { const wm = interaction.client?.webhooks; if (wm?.sendTicketLog) await wm.sendTicketLog(interaction.guild.id, 'claim', { claimedBy: interaction.user, ticketId: String(t.id), guild: interaction.guild, channelId: interaction.channel.id, previousStatus: t.status, newStatus: 'claimed' }); } catch {}
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
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'release', message: 'Ticket libertado', data: { channel_id: interaction.channel.id } }); } catch {}
  try { const wm = interaction.client?.webhooks; if (wm?.sendTicketLog) await wm.sendTicketLog(interaction.guild.id, 'release', { releasedBy: interaction.user, ticketId: String(t.id), guild: interaction.guild, channelId: interaction.channel.id, previousAssigneeId: t.assigned_to, previousStatus: t.status, newStatus: (t.status === 'claimed' ? 'open' : t.status) }); } catch {}
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
      try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'finalize', message: 'Ticket finalizado (resolve)', data: { reason: 'Resolvido' } }); } catch {}
      try { const wm = interaction.client?.webhooks; if (wm?.sendTicketLog) await wm.sendTicketLog(interaction.guild.id, 'close', { closedBy: interaction.user, ticketId: String(t.id), guild: interaction.guild, reason: 'Resolvido' }); } catch {}
      await updatePanelHeader(interaction.channel, updated || { ...t, status: 'closed' });
      // Remover imediatamente acesso de não-staff (autor e membros adicionados)
      try {
        const everyoneId = interaction.guild.id;
        await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: false });
        if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: false, ViewChannel: false });
      } catch {}
      // Avisar que o canal será apagado em ~3 minutos e gerar transcript
      try { await interaction.channel.send({ content: '🗑️ Este canal será arquivado e apagado automaticamente em cerca de 3 minutos.' }); } catch {}
      try {
        const messages = await fetchAllMessages(interaction.channel, 2000);
        let transcript = `TRANSCRICAO TICKET ${interaction.channel.name} (canal ${interaction.channel.id})\nServidor: ${interaction.guild?.name} (${interaction.guildId})\nResolvido por: ${interaction.user.tag} em ${new Date().toISOString()}\n\n`;
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
        try {
          const wm = interaction.client?.webhooks;
          if (wm && typeof wm.sendTicketLog === 'function') {
            await wm.sendTicketLog(interaction.guild.id, 'close', {
              closedBy: interaction.user,
              ticketId: String(t.id),
              guild: interaction.guild,
              files: [file]
            });
            sent = true;
          }
        } catch {}
        if (!sent) {
          const logCh = await findLogsChannel(interaction.guild);
          if (logCh && logCh.send) {
            await logCh.send({ content: `📄 Transcript do ticket em ${interaction.guild.name}: #${interaction.channel.name}`, files: [file] });
            sent = true;
          }
        }
      } catch {}
      setTimeout(async () => {
        try {
          await interaction.channel.delete('Ticket resolvido (auto delete ~3min)');
          try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'delete', message: 'Canal apagado automaticamente após resolver' }); } catch {}
        } catch {}
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
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'reopen', message: 'Ticket reaberto' }); } catch {}
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

    if (id === 'ticket:note:open') {
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
          try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
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
        } catch {}
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
          try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'lock', message: 'Canal bloqueado' }); } catch {}
          await updatePanelHeader(interaction.channel, updated || { ...t, locked: true });
          return interaction.reply({ content: '✅ Bloqueado.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: null });
          if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: true });
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x10B981).setDescription(`🔓 Canal desbloqueado por ${interaction.user}.`)] });
          const updated = await storage.updateTicket(t.id, { locked: false });
          try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'unlock', message: 'Canal desbloqueado' }); } catch {}
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
          try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'unlock:author', message: 'Desbloqueado para autor' }); } catch {}
          await updatePanelHeader(interaction.channel, updated || { ...t, locked: true });
          return interaction.reply({ content: '✅ Desbloqueado para autor.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: null });
          if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: true, ViewChannel: true });
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x10B981).setDescription(`🔓 Canal desbloqueado para todos por ${interaction.user}.`)] });
          const updated = await storage.updateTicket(t.id, { locked: false });
          try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'unlock:all', message: 'Desbloqueado para todos' }); } catch {}
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
  if (id === 'ticket:note:submit') {
    const staff = await isStaff(interaction);
    if (!staff) {
  return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    const t = await storage.getTicketByChannel(interaction.channel.id);
  if (!t) return safeReply(interaction, { content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });
    const content = interaction.fields.getTextInputValue('ticket:note:content');
    const notes = Array.isArray(t.notes) ? t.notes.slice() : [];
    notes.push({ id: Date.now().toString(), content, author: interaction.user.id, timestamp: new Date().toISOString() });
  await storage.updateTicket(t.id, { notes });
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'note', message: content }); } catch {}
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
    } catch {}
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
  try { if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch {}
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
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'finalize', message, data: { reason: 'Finalizado' } }); } catch {}
  try { const wm = interaction.client?.webhooks; if (wm?.sendTicketLog) await wm.sendTicketLog(interaction.guild.id, 'close', { closedBy: interaction.user, ticketId: String(t.id), guild: interaction.guild, reason: message || 'Finalizado' }); } catch {}
    await updatePanelHeader(interaction.channel, updated || { ...t, status: 'closed' });
    // Remover imediatamente acesso de não-staff (autor e membros adicionados)
    try {
      const everyoneId = interaction.guild.id;
      await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: false });
      if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: false, ViewChannel: false });
    } catch {}
    // Anunciar eliminação do canal em ~3 minutos
    try { await interaction.channel.send({ content: '🗑️ Este canal será arquivado e apagado automaticamente em cerca de 3 minutos.' }); } catch {}
    // Gerar transcript e enviar para logs antes de apagar
    try {
      const messages = await fetchAllMessages(interaction.channel, 2000);
      let transcript = `TRANSCRICAO TICKET ${interaction.channel.name} (canal ${interaction.channel.id})\nServidor: ${interaction.guild?.name} (${interaction.guildId})\nFinalizado por: ${interaction.user.tag} em ${new Date().toISOString()}\n\n`;
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
      try {
        const wm = interaction.client?.webhooks;
        if (wm && typeof wm.sendTicketLog === 'function') {
          await wm.sendTicketLog(interaction.guild.id, 'close', {
            closedBy: interaction.user,
            ticketId: String(t.id),
            guild: interaction.guild,
            files: [file]
          });
          sent = true;
        }
      } catch {}
      if (!sent) {
        const logCh = await findLogsChannel(interaction.guild);
        if (logCh && logCh.send) {
          await logCh.send({ content: `📄 Transcript do ticket em ${interaction.guild.name}: #${interaction.channel.name}`, files: [file] });
          sent = true;
        }
      }
    } catch {}
    // Agendar eliminação do canal em ~3 minutos
    setTimeout(async () => {
      try {
        await interaction.channel.delete('Ticket finalizado (auto delete ~3min)');
        try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'delete', message: 'Canal apagado automaticamente após finalizar' }); } catch {}
      } catch {}
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
    const ids = Array.from(new Set(raw.split(/[\s,]+/).map(s=>s.replace(/[^0-9]/g,'')).filter(Boolean))).slice(0,10);
    const added = [];
    for (const uid of ids) {
      try { await interaction.channel.permissionOverwrites.edit(uid, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); added.push(uid); } catch {}
    }
    try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'member:add:bulk', message: `IDs: ${added.join(',')}` }); } catch {}
    return safeReply(interaction, { content: added.length ? `✅ Adicionados: ${added.map(i=>`<@${i}>`).join(', ')}` : '❌ Nenhum ID válido.', flags: MessageFlags.Ephemeral });
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
      try { await interaction.channel.permissionOverwrites.delete(uid).catch(()=>{}); removed.push(uid); } catch {}
    }
    try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'member:remove:bulk', message: `IDs: ${removed.join(',')}` }); } catch {}
    return safeReply(interaction, { content: removed.length ? `✅ Removidos: ${removed.map(i=>`<@${i}>`).join(', ')}` : '❌ Nenhum ID válido.', flags: MessageFlags.Ephemeral });
  }
  if (id === 'ticket:move:other:modal') {
    const staff = await isStaff(interaction);
    if (!staff) return safeReply(interaction, { content: '🚫 Apenas a equipa.', flags: MessageFlags.Ephemeral });
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t) return safeReply(interaction, { content: '⚠️ Ticket não encontrado.', flags: MessageFlags.Ephemeral });
    const raw = interaction.fields.getTextInputValue('ticket:move:other:category_id').trim();
    const catId = raw.replace(/[^0-9]/g,'');
    if (!catId) return safeReply(interaction, { content: 'ID inválido.', flags: MessageFlags.Ephemeral });
    try { await interaction.channel.setParent(catId, { lockPermissions: false }); } catch { return safeReply(interaction, { content: '❌ Falha ao mover (verifica o ID).', flags: MessageFlags.Ephemeral }); }
    try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'move', message: `move->${catId}`, data: { manual: true } }); } catch {}
    return safeReply(interaction, { content: '🔁 Ticket movido (manual).', flags: MessageFlags.Ephemeral });
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
        try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'member:add', message: `Adicionado ${member.id}` }); } catch {}
  return safeReply(interaction, { content: '✅ Membro adicionado.', flags: MessageFlags.Ephemeral });
      } else {
        await interaction.channel.permissionOverwrites.edit(member.id, {
          ViewChannel: false,
          SendMessages: false
        });
        await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0xF87171).setDescription(`➖ ${member} removido do ticket por ${interaction.user}.`)] });
        try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'member:remove', message: `Removido ${member.id}` }); } catch {}
  return safeReply(interaction, { content: '✅ Membro removido.', flags: MessageFlags.Ephemeral });
      }
    } catch (e) {
  return safeReply(interaction, { content: '❌ Falha ao atualizar permissões.', flags: MessageFlags.Ephemeral });
    }
  }

  if (id === 'ticket:rename:submit') {
    const staff = await isStaff(interaction);
    if (!staff) {
  return safeReply(interaction, { content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    const t = await storage.getTicketByChannel(interaction.channel.id);
  if (!t) return safeReply(interaction, { content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });
    const newName = interaction.fields.getTextInputValue('ticket:rename:newname')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .slice(0, 90);
    if (!newName) return interaction.reply({ content: 'Fornece um nome válido.', flags: MessageFlags.Ephemeral });
    try {
  await interaction.channel.setName(newName, `Renomeado por ${interaction.user.tag}`);
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x60A5FA).setDescription(`✏️ Canal renomeado para #${newName} por ${interaction.user}.`)] });
  try { await storage.addTicketLog({ ticket_id: t.id, guild_id: interaction.guild.id, actor_id: interaction.user.id, action: 'rename', message: `Renomeado para ${newName}` }); } catch {}
      return interaction.reply({ content: '✅ Canal renomeado.', flags: MessageFlags.Ephemeral });
    } catch {
      return interaction.reply({ content: '❌ Falha ao renomear canal.', flags: MessageFlags.Ephemeral });
    }
  }
}

async function handleSelect(interaction) {
  const id = interaction.customId;
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
