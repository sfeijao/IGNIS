const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
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

async function updatePanelHeader(channel, ticket) {
  if (!ticket?.panel_message_id) return;
  try {
    const msg = await channel.messages.fetch(ticket.panel_message_id).catch(() => null);
    if (!msg) return;
    const base = msg.embeds?.[0] ? EmbedBuilder.from(msg.embeds[0]) : new EmbedBuilder();

    // Preservar título/descrição/cores existentes; atualizar campos com info atual
    const openedAt = ticket.created_at ? Math.floor(new Date(ticket.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
    base.setFields(
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
    return interaction.reply({ content: `❌ Já tens um ticket aberto: <#${t.channel_id}>`, flags: MessageFlags.Ephemeral });
  }

  const cat = await ensureCategory(interaction.guild);
  const info = departmentInfo(type);
  const channelName = `${info.emoji}-${interaction.user.username}`.toLowerCase();

  const overwrites = [
    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
  ];

  // Permitir staff: usar config se existir, senão tentar detetar automaticamente
  try {
    const staffRole = await findStaffRole(interaction.guild);
    if (staffRole) {
      overwrites.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
    }
  } catch {}

  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: cat.id,
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

  // Mensagem inicial no canal
  const intro = new EmbedBuilder()
    .setColor(info.color)
    .setTitle(`${info.emoji} ${info.name}`)
    .setDescription([
      `Olá ${interaction.user}, obrigado por abrir um ticket!`,
      'Conta-nos resumidamente o que precisas; a equipa será notificada. ',
      '',
      'Quando terminar, podes fechar o ticket com o botão abaixo.'
    ].join('\n'))
    .addFields(
      { name: 'Utilizador', value: `${interaction.user}`, inline: true },
      { name: 'Abertura', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true },
      { name: 'ID', value: `#${ticket.id}`, inline: true },
      { name: 'Prioridade', value: priorityLabel(ticket.priority), inline: true },
      { name: 'Responsável', value: '—', inline: true }
    )
    .setTimestamp();

  const controlsRow1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close:request').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setEmoji('✋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket:release').setLabel('Libertar').setEmoji('👐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:resolve').setLabel('Resolvido').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket:reopen').setLabel('Reabrir').setEmoji('♻️').setStyle(ButtonStyle.Secondary)
  );
  const controlsRow2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:priority:open').setLabel('Prioridade').setEmoji('⚡').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:note:open').setLabel('Nota').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:member:add').setLabel('Adicionar').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:member:remove').setLabel('Remover').setEmoji('➖').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary)
  );
  // Linha 3: novos botões (renomear, bloquear/desbloquear)
  const controlsRow3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:rename:open').setLabel('Renomear canal').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:lock-toggle').setLabel('Bloquear').setEmoji('🔐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:unlock:author').setLabel('Desbloquear autor').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:unlock:everyone').setLabel('Desbloquear todos').setEmoji('🔓').setStyle(ButtonStyle.Secondary)
  );

  const panelMsg = await channel.send({ content: `${interaction.user}`, embeds: [intro], components: [controlsRow1, controlsRow2, controlsRow3] });
  // Guardar referência para futuras edições do cabeçalho
  try { await storage.updateTicket(ticket.id, { panel_message_id: panelMsg.id }); } catch {}

  return interaction.reply({ content: `✅ Ticket criado: ${channel}`, flags: MessageFlags.Ephemeral });
}

async function requestClose(interaction) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close:confirm').setLabel('Confirmar').setEmoji('✅').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket:close:cancel').setLabel('Cancelar').setEmoji('❌').setStyle(ButtonStyle.Secondary)
  );
  return interaction.reply({ content: 'Tens a certeza que queres fechar este ticket?', components: [row], flags: MessageFlags.Ephemeral });
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
    const logCh = await findLogsChannel(interaction.guild);
    if (logCh && logCh.send) {
      const { AttachmentBuilder } = require('discord.js');
        await logCh.send({ content: `📄 Transcript do ticket em ${interaction.guild.name}: #${interaction.channel.name}` });
        const file = new AttachmentBuilder(Buffer.from(transcript,'utf8'), { name: `transcript-${interaction.channel.id}.txt` });
        await logCh.send({ files: [file] }).catch(()=>null);
    }
  } catch {}
  try { await interaction.editReply({ content: '✅ Ticket será arquivado. Obrigado!', components: [] }); } catch {}

  setTimeout(() => {
    interaction.channel.delete('Ticket fechado');
  }, 5 * 60 * 1000);
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
  if (id === 'ticket:close:cancel') return interaction.update({ content: '❎ Cancelado.', components: [], ephemeral: true });

  // Painel staff efémero
  // (Removido) painel efémero Ctrl-Staff: botões agora estão sempre visíveis nas linhas principais

  // Ações administrativas (staff)
  if (id === 'ticket:claim' || id === 'ticket:release' || id === 'ticket:resolve' || id === 'ticket:reopen' || id.startsWith('ticket:priority') || id === 'ticket:note:open' || id === 'ticket:transcript' || id === 'ticket:member:add' || id === 'ticket:member:remove' || id === 'ticket:rename:open' || id === 'ticket:lock-toggle' || id === 'ticket:unlock:author' || id === 'ticket:unlock:everyone') {
    const staff = await isStaff(interaction);
    if (!staff) {
      return interaction.reply({ content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }

    // Obter ticket pelo canal
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t) return interaction.reply({ content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });

    if (id === 'ticket:claim') {
      if (t.assigned_to) {
        return interaction.reply({ content: `⚠️ Já está reclamado por <@${t.assigned_to}>.`, flags: MessageFlags.Ephemeral });
      }
      const updated = await storage.updateTicket(t.id, { assigned_to: interaction.user.id, status: 'claimed' });
      const embed = new EmbedBuilder().setColor(0x10B981).setDescription(`✋ Ticket reclamado por ${interaction.user}.`);
      await interaction.channel.send({ embeds: [embed] });
      await updatePanelHeader(interaction.channel, updated || { ...t, assigned_to: interaction.user.id, status: 'claimed' });
      return interaction.reply({ content: '✅ Reclamado.', flags: MessageFlags.Ephemeral });
    }

    if (id === 'ticket:release') {
      if (!t.assigned_to) {
        return interaction.reply({ content: '⚠️ Este ticket não está reclamado.', flags: MessageFlags.Ephemeral });
      }
      if (t.assigned_to !== interaction.user.id) {
        // Permitir qualquer staff libertar? Mantemos permissivo.
      }
      const updated = await storage.updateTicket(t.id, { assigned_to: null, status: t.status === 'claimed' ? 'open' : t.status });
      const embed = new EmbedBuilder().setColor(0xF59E0B).setDescription(`👐 Ticket libertado por ${interaction.user}.`);
      await interaction.channel.send({ embeds: [embed] });
      await updatePanelHeader(interaction.channel, updated || { ...t, assigned_to: null, status: t.status === 'claimed' ? 'open' : t.status });
      return interaction.reply({ content: '✅ Libertado.', flags: MessageFlags.Ephemeral });
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
      return interaction.reply({ content: '⚡ Escolhe a nova prioridade para este ticket:', components: [row], flags: MessageFlags.Ephemeral });
    }

    if (id === 'ticket:resolve') {
      if (t.status === 'closed') return interaction.reply({ content: '⚠️ Já está fechado.', flags: MessageFlags.Ephemeral });
      const updated = await storage.updateTicket(t.id, { status: 'closed', closed_at: new Date().toISOString(), close_reason: 'Resolvido' });
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x10B981).setDescription(`✅ Marcado como resolvido por ${interaction.user}.`)] });
      await updatePanelHeader(interaction.channel, updated || { ...t, status: 'closed' });
      return interaction.reply({ content: '✅ Resolvido.', flags: MessageFlags.Ephemeral });
    }

    if (id === 'ticket:reopen') {
      if (t.status !== 'closed') return interaction.reply({ content: '⚠️ Só podes reabrir tickets fechados.', flags: MessageFlags.Ephemeral });
      const updated = await storage.updateTicket(t.id, { status: 'open', reopened_at: new Date().toISOString() });
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x3B82F6).setDescription(`♻️ Ticket reaberto por ${interaction.user}.`)] });
      await updatePanelHeader(interaction.channel, updated || { ...t, status: 'open' });
      return interaction.reply({ content: '✅ Reaberto.', flags: MessageFlags.Ephemeral });
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
          try { await interaction.deferReply({ ephemeral: true }); } catch {}
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
        const logCh = await findLogsChannel(interaction.guild);
        const { AttachmentBuilder } = require('discord.js');
        const file = new AttachmentBuilder(Buffer.from(transcript,'utf8'), { name: `transcript-${interaction.channel.id}.txt` });
        let sent = false;
        if (logCh && logCh.send) {
            await logCh.send({ content: `📄 Transcript solicitado por ${interaction.user} em ${interaction.channel}`, files: [file] });
            sent = true;
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
          return interaction.reply({ content: '✅ Bloqueado.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: null });
          if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: true });
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x10B981).setDescription(`🔓 Canal desbloqueado por ${interaction.user}.`)] });
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
          return interaction.reply({ content: '✅ Desbloqueado para autor.', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.channel.permissionOverwrites.edit(everyoneId, { SendMessages: null });
          if (t.user_id) await interaction.channel.permissionOverwrites.edit(t.user_id, { SendMessages: true, ViewChannel: true });
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x10B981).setDescription(`🔓 Canal desbloqueado para todos por ${interaction.user}.`)] });
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
      return interaction.reply({ content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t) return interaction.reply({ content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });
    const content = interaction.fields.getTextInputValue('ticket:note:content');
    const notes = Array.isArray(t.notes) ? t.notes.slice() : [];
    notes.push({ id: Date.now().toString(), content, author: interaction.user.id, timestamp: new Date().toISOString() });
    await storage.updateTicket(t.id, { notes });
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
    if (!mId) return interaction.reply({ content: 'Fornece um ID ou menção válida.', flags: MessageFlags.Ephemeral });
    const member = await interaction.guild.members.fetch(mId).catch(() => null);
    if (!member) return interaction.reply({ content: 'Membro não encontrado.', flags: MessageFlags.Ephemeral });
    try {
      if (mode === 'add') {
        await interaction.channel.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
        await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x60A5FA).setDescription(`➕ ${member} adicionado ao ticket por ${interaction.user}.`)] });
        return interaction.reply({ content: '✅ Membro adicionado.', flags: MessageFlags.Ephemeral });
      } else {
        await interaction.channel.permissionOverwrites.edit(member.id, {
          ViewChannel: false,
          SendMessages: false
        });
        await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0xF87171).setDescription(`➖ ${member} removido do ticket por ${interaction.user}.`)] });
        return interaction.reply({ content: '✅ Membro removido.', flags: MessageFlags.Ephemeral });
      }
    } catch (e) {
      return interaction.reply({ content: '❌ Falha ao atualizar permissões.', flags: MessageFlags.Ephemeral });
    }
  }

  if (id === 'ticket:rename:submit') {
    const staff = await isStaff(interaction);
    if (!staff) {
      return interaction.reply({ content: '🚫 Apenas a equipa pode usar esta ação.', flags: MessageFlags.Ephemeral });
    }
    const t = await storage.getTicketByChannel(interaction.channel.id);
    if (!t) return interaction.reply({ content: '⚠️ Ticket não encontrado no armazenamento.', flags: MessageFlags.Ephemeral });
    const newName = interaction.fields.getTextInputValue('ticket:rename:newname').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '').slice(1, 90);
    if (!newName) return interaction.reply({ content: 'Fornece um nome válido.', flags: MessageFlags.Ephemeral });
    try {
      await interaction.channel.setName(newName, `Renomeado por ${interaction.user.tag}`);
      await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x60A5FA).setDescription(`✏️ Canal renomeado para #${newName} por ${interaction.user}.`)] });
      return interaction.reply({ content: '✅ Canal renomeado.', flags: MessageFlags.Ephemeral });
    } catch {
      return interaction.reply({ content: '❌ Falha ao renomear canal.', flags: MessageFlags.Ephemeral });
    }
  }
}

async function handleSelect(interaction) {
  const id = interaction.customId;
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
}

module.exports = { handleButton, handleModal, handleSelect };
