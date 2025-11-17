const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { GiveawayModel, GiveawayEntryModel } = require('../db/giveawayModels');
const { getClient } = require('../discordClient');
const logger = require('../logger');

/**
 * Atualizar contador de participantes na mensagem do giveaway
 */
async function updateGiveawayMessage(giveawayId) {
    try {
        const giveaway = await GiveawayModel.findById(giveawayId);
        if (!giveaway || !giveaway.message_id || !giveaway.channel_id) {
            return { ok: false, error: 'giveaway_or_message_not_found' };
        }

        const client = getClient();
        if (!client) return { ok: false, error: 'discord_client_unavailable' };

        const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
        if (!channel) return { ok: false, error: 'channel_not_found' };

        const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
        if (!message) return { ok: false, error: 'message_not_found' };

        // Contar participantes
        const entryCount = await GiveawayEntryModel.countDocuments({ giveaway_id: giveawayId });

        // Atualizar botão com contador
        if (giveaway.method === 'button' && message.components.length > 0) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`gw-enter:${giveawayId}`)
                    .setLabel(String(entryCount))
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(giveaway.icon_emoji || '🎉')
            );

            await message.edit({ components: [row] });
        }

        logger.debug(`Updated giveaway message ${giveaway.message_id} with ${entryCount} participants`);
        return { ok: true, entryCount };

    } catch (error) {
        logger.error('Error updating giveaway message:', error);
        return { ok: false, error: error.message };
    }
}

module.exports = {
    updateGiveawayMessage
};
