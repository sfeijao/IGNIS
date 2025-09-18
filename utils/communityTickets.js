const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
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

  // Permitir staff se configurado
  try {
    const cfg = await storage.getGuildConfig(interaction.guild.id);
    const staffRoleId = cfg?.roles?.staff;
    if (staffRoleId && interaction.guild.roles.cache.has(staffRoleId)) {
      overwrites.push({ id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
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
      { name: 'ID', value: `#${ticket.id}`, inline: true }
    )
    .setTimestamp();

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close:request').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ content: `${interaction.user}`, embeds: [intro], components: [controls] });

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
  // Gerar transcript simples e enviar para canal de logs, se configurado
  try {
    const fetched = await interaction.channel.messages.fetch({ limit: 200 }).catch(() => null);
    const messages = fetched ? Array.from(fetched.values()).sort((a,b)=>a.createdTimestamp-b.createdTimestamp) : [];
    let transcript = `TRANSCRICAO TICKET ${interaction.channel.name} (canal ${interaction.channel.id})\nServidor: ${interaction.guild?.name} (${interaction.guildId})\nFechado por: ${interaction.user.tag} em ${new Date().toISOString()}\n\n`;
    for (const m of messages) {
      const ts = new Date(m.createdTimestamp).toISOString();
      const author = m.author?.tag || m.author?.id || 'Desconhecido';
      const content = (m.content || '').replace(/\n/g, ' ');
      transcript += `${ts} - ${author}: ${content}\n`;
    }
    const cfg = await storage.getGuildConfig(interaction.guild.id);
    const logChannelId = cfg?.channels?.logs || null;
    if (logChannelId) {
      const { AttachmentBuilder } = require('discord.js');
      const logCh = interaction.guild.channels.cache.get(logChannelId) || await interaction.client.channels.fetch(logChannelId).catch(()=>null);
      if (logCh && logCh.send) {
        await logCh.send({ content: `📄 Transcript do ticket em ${interaction.guild.name}: #${interaction.channel.name}` });
        const file = new AttachmentBuilder(Buffer.from(transcript,'utf8'), { name: `transcript-${interaction.channel.id}.txt` });
        await logCh.send({ files: [file] }).catch(()=>null);
      }
    }
  } catch {}

  await interaction.update({ content: '✅ Ticket será arquivado. Obrigado!', components: [], ephemeral: true });

  setTimeout(() => {
    interaction.channel.delete('Ticket fechado');
  }, 5 * 60 * 1000);
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
}

module.exports = { handleButton };
