const { TicketModel } = require('../db/models');
const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../logger');
const storage = require('../storage');

/**
 * 🎁 GIVEAWAY AUTO-WINNER TICKET SYSTEM
 *
 * Cria automaticamente um ticket para o vencedor de um giveaway.
 * Mensagem personalizada com prazo de 48h para resposta.
 * Se não responder, permite re-sortear novo vencedor.
 */

/**
 * Criar ticket automático para vencedor de giveaway
 * @param {Object} params
 * @param {string} params.guildId - ID do servidor
 * @param {string} params.userId - ID do vencedor
 * @param {Object} params.giveaway - Dados do giveaway
 * @param {Object} params.client - Discord client
 * @returns {Promise<Object>} Ticket criado
 */
async function createGiveawayWinnerTicket({ guildId, userId, giveaway, client }) {
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      logger.warn(`[GiveawayTicket] Guild ${guildId} not found`);
      return { ok: false, error: 'Guild not found' };
    }

    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
      logger.warn(`[GiveawayTicket] User ${userId} not found`);
      return { ok: false, error: 'User not found' };
    }

    // Verificar se já existe ticket ativo para este user
    const existingTickets = await storage.getUserActiveTickets(userId, guildId);
    if (existingTickets && existingTickets.length > 0) {
      logger.info(`[GiveawayTicket] User ${userId} já tem ticket ativo em ${guildId}`);
      return {
        ok: false,
        error: 'User already has active ticket',
        existingTicket: existingTickets[0]
      };
    }

    // Obter configuração do servidor
    let cfg;
    try { cfg = await storage.getGuildConfig(guildId); } catch (e) { logger.debug('Caught error:', e?.message || e); }
    let parentCategoryId = cfg?.tickets?.ticketsCategoryId || null;

    // Encontrar ou criar categoria de tickets
    let category = null;
    if (parentCategoryId) {
      category = guild.channels.cache.get(parentCategoryId) ||
                 await client.channels.fetch(parentCategoryId).catch(() => null);
    }

    if (!category || category.type !== ChannelType.GuildCategory) {
      // Criar categoria padrão
      category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory &&
        (c.name === '📁 TICKETS' || c.name.toUpperCase() === 'TICKETS')
      );

      if (!category) {
        category = await guild.channels.create({
          name: '📁 TICKETS',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }
          ],
          reason: 'Categoria criada para tickets de giveaway'
        });
      }
      parentCategoryId = category.id;
    }

    // Permissões do canal
    const overwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ];

    // Adicionar staff roles se configurados
    const accessRoleIds = Array.isArray(cfg?.tickets?.accessRoleIds)
      ? cfg.tickets.accessRoleIds.filter(Boolean)
      : [];

    for (const roleId of accessRoleIds) {
      if (guild.roles.cache.has(roleId)) {
        overwrites.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }
    }

    // Criar canal do ticket
    const channelName = `🎁-vencedor-${user.username}`.toLowerCase();
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentCategoryId,
      permissionOverwrites: overwrites,
      topic: `Ticket Giveaway • Vencedor: ${user.tag} • Prêmio: ${giveaway.prize_name || 'Giveaway'}`
    });

    // Persistir ticket no DB
    const ticket = await storage.createTicket({
      guild_id: guildId,
      channel_id: channel.id,
      user_id: userId,
      type: 'giveaway_winner',
      description: `Vencedor do giveaway: ${giveaway.prize_name || giveaway._id}`,
      priority: 'high',
      giveaway_id: giveaway._id.toString(),
      deadline: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 horas
    });

    // Mensagem de boas-vindas personalizada
    const embed = new EmbedBuilder()
      .setColor(0xF59E0B) // Dourado
      .setTitle('🎉 PARABÉNS, VOCÊ VENCEU!')
      .setDescription(
        `**${user}, você foi sorteado como vencedor do giveaway!**\n\n` +
        `🎁 **Prêmio:** ${giveaway.prize_name || 'Giveaway'}\n` +
        `📋 **Giveaway ID:** \`${giveaway._id}\`\n\n` +
        `**📌 PRÓXIMOS PASSOS:**\n` +
        `1️⃣ Responda a este ticket em até **48 horas**\n` +
        `2️⃣ Forneça as informações solicitadas pela equipe\n` +
        `3️⃣ Aguarde a entrega do prêmio\n\n` +
        `⏰ **PRAZO:** <t:${Math.floor((Date.now() + 48 * 60 * 60 * 1000) / 1000)}:R>\n` +
        `⚠️ **IMPORTANTE:** Se não responder no prazo, um novo vencedor será sorteado!\n\n` +
        `Boa sorte! 🍀`
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({
        text: 'IGNIS Bot • Sistema de Giveaways',
        iconURL: client.user?.displayAvatarURL()
      })
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_ticket:confirm_receipt')
        .setLabel('✅ Confirmar Recebimento')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('giveaway_ticket:need_help')
        .setLabel('❓ Preciso de Ajuda')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket:close:request')
        .setLabel('❌ Fechar Ticket')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `${user}`,
      embeds: [embed],
      components: [buttons]
    });

    // Log de criação
    logger.info(
      `[GiveawayTicket] Created ticket ${ticket.id} for winner ${userId} ` +
      `in guild ${guildId} (giveaway: ${giveaway._id})`
    );

    // Enviar mensagem privada ao vencedor (opcional)
    try {
      await user.send({
        content: `🎉 **Você venceu um giveaway em ${guild.name}!**`,
        embeds: [
          new EmbedBuilder()
            .setColor(0xF59E0B)
            .setTitle('Ticket Criado')
            .setDescription(
              `Foi criado um ticket exclusivo para você no servidor **${guild.name}**.\n\n` +
              `Por favor, acesse o servidor e responda ao ticket <#${channel.id}> em até 48 horas.\n\n` +
              `**Prêmio:** ${giveaway.prize_name || 'Giveaway'}`
            )
            .setFooter({ text: 'Não responda a esta mensagem. Use o ticket no servidor.' })
        ]
      });
      logger.info(`[GiveawayTicket] DM sent to winner ${userId}`);
    } catch (dmError) {
      logger.warn(`[GiveawayTicket] Could not DM winner ${userId}:`, dmError.message);
      // Não é crítico se falhar DM
    }

    return {
      ok: true,
      ticket,
      channel,
      message: 'Ticket created successfully'
    };

  } catch (error) {
    logger.error('[GiveawayTicket] Error creating winner ticket:', error);
    return {
      ok: false,
      error: error.message
    };
  }
}

/**
 * Verificar tickets de giveaway expirados (48h sem resposta)
 * @param {Object} client - Discord client
 */
async function checkExpiredGiveawayTickets(client) {
  try {
    const now = new Date();

    // Buscar tickets de giveaway com deadline ultrapassado
    const expiredTickets = await TicketModel.find({
      type: 'giveaway_winner',
      status: 'open',
      deadline: { $lte: now },
      responded: { $ne: true } // Não respondeu
    }).lean();

    if (expiredTickets.length === 0) return { ok: true, expired: 0 };

    logger.info(`[GiveawayTicket] Found ${expiredTickets.length} expired giveaway tickets`);

    for (const ticket of expiredTickets) {
      try {
        const guild = await client.guilds.fetch(ticket.guild_id).catch(() => null);
        if (!guild) continue;

        const channel = guild.channels.cache.get(ticket.channel_id) ||
                       await client.channels.fetch(ticket.channel_id).catch(() => null);

        if (channel) {
          // Enviar mensagem de expiração
          const embed = new EmbedBuilder()
            .setColor(0xEF4444)
            .setTitle('⏰ Ticket Expirado')
            .setDescription(
              `O prazo de 48 horas expirou sem resposta.\n\n` +
              `Um novo vencedor será sorteado em breve.\n\n` +
              `Este ticket será fechado automaticamente.`
            )
            .setTimestamp();

          await channel.send({ embeds: [embed] });

          // Fechar canal após 10 segundos
          setTimeout(async () => {
            try {
              await channel.delete('Ticket giveaway expirado sem resposta');
              logger.info(`[GiveawayTicket] Deleted expired ticket channel ${ticket.channel_id}`);
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
          }, 10000);
        }

        // Atualizar ticket no DB
        await storage.updateTicket(ticket.id, {
          status: 'closed',
          closed_reason: 'expired_no_response',
          closed_at: now
        });

        logger.info(`[GiveawayTicket] Marked ticket ${ticket.id} as expired`);

      } catch (ticketError) {
        logger.error(`[GiveawayTicket] Error processing expired ticket ${ticket.id}:`, ticketError);
      }
    }

    return { ok: true, expired: expiredTickets.length };

  } catch (error) {
    logger.error('[GiveawayTicket] Error checking expired tickets:', error);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  createGiveawayWinnerTicket,
  checkExpiredGiveawayTickets
};
