const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS, EMOJIS } = require('../constants/ui');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Testa resposta do bot'),
    
    async execute(interaction) {
        try {
            logger.command('ping', interaction);
            
            const embed = new EmbedBuilder()
                .setColor(EMBED_COLORS.SUCCESS)
                .setTitle(`${EMOJIS.SUCCESS} Pong!`)
                .setDescription(`Latência: \`${Date.now() - interaction.createdTimestamp}ms\`\nAPI: \`${Math.round(interaction.client.ws.ping)}ms\``)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            
            logger.info('Comando ping executado', {
                userId: interaction.user.id,
                username: interaction.user.tag,
                latency: Date.now() - interaction.createdTimestamp,
                apiPing: Math.round(interaction.client.ws.ping)
            });
            
        } catch (error) {
            await errorHandler.handleInteractionError(interaction, error);
        }
    },
};
