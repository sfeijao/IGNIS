const { MessageFlags } = require('discord.js');
const logger = require('../logger');

/**
 * Handle giveaway entry button click
 */
async function handleGiveawayEntry(interaction, giveawayId) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Validate giveaway exists and is active
        const { GiveawayModel } = require('../db/giveawayModels');
        const giveaway = await GiveawayModel.findById(giveawayId);

        if (!giveaway) {
            return await interaction.editReply({ content: '❌ Este sorteio não existe ou foi removido.' });
        }

        if (giveaway.status !== 'active') {
            return await interaction.editReply({ content: '❌ Este sorteio não está mais ativo.' });
        }

        // Check if already entered
        const userId = interaction.user.id;
        const alreadyEntered = giveaway.entries && giveaway.entries.some(e => e.user_id === userId);

        if (alreadyEntered) {
            return await interaction.editReply({ content: '⚠️ Você já está participando deste sorteio!' });
        }

        // Check if giveaway has ended
        if (giveaway.end_at && new Date(giveaway.end_at) < new Date()) {
            return await interaction.editReply({ content: '❌ Este sorteio já terminou.' });
        }

        // Add entry
        if (!giveaway.entries) giveaway.entries = [];
        giveaway.entries.push({
            user_id: userId,
            username: interaction.user.username,
            entered_at: new Date()
        });

        await giveaway.save();

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
            totalEntries: giveaway.entries.length
        });

        await interaction.editReply({
            content: `✅ **Entrada confirmada!**\n🎉 Você está participando de **${giveaway.title}**\n👥 Total de participantes: **${giveaway.entries.length}**`
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

        const { GiveawayModel } = require('../db/giveawayModels');
        const giveaway = await GiveawayModel.findById(giveawayId);

        if (!giveaway) {
            return await interaction.editReply({ content: '❌ Este sorteio não existe ou foi removido.' });
        }

        const userId = interaction.user.id;
        const entryIndex = giveaway.entries ? giveaway.entries.findIndex(e => e.user_id === userId) : -1;

        if (entryIndex === -1) {
            return await interaction.editReply({ content: '⚠️ Você não está participando deste sorteio.' });
        }

        // Remove entry
        giveaway.entries.splice(entryIndex, 1);
        await giveaway.save();

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
            totalEntries: giveaway.entries.length
        });

        await interaction.editReply({
            content: `✅ Você saiu do sorteio **${giveaway.title}**`
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
