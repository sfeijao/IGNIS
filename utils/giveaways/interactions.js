const { MessageFlags } = require('discord.js');
const logger = require('../logger');
const { updateGiveawayMessage } = require('./messageUpdater');
const { retryWithBackoff } = require('../retryHelper');

/**
 * Handle giveaway entry button click
 */
async function handleGiveawayEntry(interaction, giveawayId) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Validate giveaway exists and is active (com retry)
        const { GiveawayModel, GiveawayEntryModel } = require('../db/giveawayModels');
        const giveaway = await retryWithBackoff(
            () => GiveawayModel.findById(giveawayId),
            { 
                maxRetries: 2, 
                baseDelay: 500,
                onRetry: (attempt, max) => logger.debug(`[Giveaway] Retry ${attempt}/${max} - findById`) 
            }
        );

        if (!giveaway) {
            return await interaction.editReply({ content: '❌ Este sorteio não existe ou foi removido.' });
        }

        if (giveaway.status !== 'active') {
            return await interaction.editReply({ content: '❌ Este sorteio não está mais ativo.' });
        }

        // Check if giveaway has ended
        if (giveaway.ends_at && new Date(giveaway.ends_at) < new Date()) {
            return await interaction.editReply({ content: '❌ Este sorteio já terminou.' });
        }

        // Check if already entered
        const userId = interaction.user.id;
        const existingEntry = await GiveawayEntryModel.findOne({
            giveaway_id: giveawayId,
            user_id: userId
        });

        if (existingEntry) {
            return await interaction.editReply({ content: '⚠️ Você já está participando deste sorteio!' });
        }

        // Create entry (com retry para DB transient errors)
        await retryWithBackoff(
            () => GiveawayEntryModel.create({
                giveaway_id: giveawayId,
                guild_id: giveaway.guild_id,
                user_id: userId,
                username: interaction.user.username,
                avatar: interaction.user.avatar,
                method: 'button',
                joined_at: new Date(),
                weight: 1
            }),
            { maxRetries: 2, baseDelay: 500 }
        );

        // Count total entries
        const totalEntries = await GiveawayEntryModel.countDocuments({ giveaway_id: giveawayId });

        // Emit socket event for live updates
        try {
            const io = global.io;
            if (io) {
                io.to(`guild:${giveaway.guild_id}`).emit('dashboard_event', {
                    type: 'giveaway_enter',
                    giveawayId: giveaway._id.toString(),
                    userId: userId
                });
            }
        } catch (e) {
            logger.warn('Failed to emit giveaway entry socket event', e);
        }

        logger.info('User entered giveaway', {
            giveawayId: giveaway._id.toString(),
            userId,
            guildId: giveaway.guild_id,
            totalEntries
        });

        // Update Discord message button counter
        try {
            await updateGiveawayMessage(giveawayId);
        } catch (updateError) {
            logger.warn('Failed to update giveaway message counter', updateError);
        }

        await interaction.editReply({
            content: `✅ **Entrada confirmada!**\n🎉 Você está participando de **${giveaway.title}**\n👥 Total de participantes: **${totalEntries}**`
        });

    } catch (error) {
        logger.error('Error handling giveaway entry:', error);
        const replied = interaction.deferred || interaction.replied;
        const method = replied ? 'editReply' : 'reply';
        const options = { content: '❌ Erro ao processar sua participação. Tente novamente.' };
        if (!replied) options.flags = MessageFlags.Ephemeral;
        await interaction[method](options);
    }
}

/**
 * Handle giveaway leave button click
 */
async function handleGiveawayLeave(interaction, giveawayId) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { GiveawayModel, GiveawayEntryModel } = require('../db/giveawayModels');
        const giveaway = await GiveawayModel.findById(giveawayId);

        if (!giveaway) {
            return await interaction.editReply({ content: '❌ Este sorteio não existe ou foi removido.' });
        }

        const userId = interaction.user.id;
        const entry = await GiveawayEntryModel.findOne({
            giveaway_id: giveawayId,
            user_id: userId
        });

        if (!entry) {
            return await interaction.editReply({ content: '⚠️ Você não está participando deste sorteio.' });
        }

        // Remove entry
        await GiveawayEntryModel.deleteOne({ _id: entry._id });

        // Count remaining entries
        const totalEntries = await GiveawayEntryModel.countDocuments({ giveaway_id: giveawayId });

        // Emit socket event
        try {
            const io = global.io;
            if (io) {
                io.to(`guild:${giveaway.guild_id}`).emit('dashboard_event', {
                    type: 'giveaway_leave',
                    giveawayId: giveaway._id.toString(),
                    userId: userId
                });
            }
        } catch (e) {
            logger.warn('Failed to emit giveaway leave socket event', e);
        }

        logger.info('User left giveaway', {
            giveawayId: giveaway._id.toString(),
            userId,
            guildId: giveaway.guild_id,
            totalEntries
        });

        // Update Discord message button counter
        try {
            await updateGiveawayMessage(giveawayId);
        } catch (updateError) {
            logger.warn('Failed to update giveaway message counter', updateError);
        }

        await interaction.editReply({
            content: `✅ Você saiu do sorteio **${giveaway.title}**\n👥 Participantes restantes: **${totalEntries}**`
        });

    } catch (error) {
        logger.error('Error handling giveaway leave:', error);
        const replied = interaction.deferred || interaction.replied;
        const method = replied ? 'editReply' : 'reply';
        const options = { content: '❌ Erro ao processar. Tente novamente.' };
        if (!replied) options.flags = MessageFlags.Ephemeral;
        await interaction[method](options);
    }
}

module.exports = {
    handleGiveawayEntry,
    handleGiveawayLeave
};
