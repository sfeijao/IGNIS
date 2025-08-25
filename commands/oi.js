const { SlashCommandBuilder } = require('discord.js');
const { EMOJIS } = require('../constants/ui');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oi')
        .setDescription('Teste ultra simples'),

    async execute(interaction) {
        try {
            logger.command('oi', interaction);
            
            await interaction.reply(`${EMOJIS.SUCCESS} Oi! Sistema funcionando perfeitamente!`);
            
            logger.info('Comando oi executado', {
                userId: interaction.user.id,
                username: interaction.user.tag
            });
            
        } catch (error) {
            await errorHandler.handleInteractionError(interaction, error);
        }
    },
};
