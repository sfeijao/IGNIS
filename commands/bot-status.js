const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EMBED_COLORS, EMOJIS } = require('../constants/ui');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');
const config = require('../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot-status')
        .setDescription('Verifica o status e configuração do bot'),

    async execute(interaction) {
        try {
            logger.command('bot-status', interaction);
            
            // Calcular uptime
            const uptime = Math.floor((Date.now() - interaction.client.readyTimestamp) / 1000);
            
            // Verificar permissões essenciais
            const permissions = interaction.guild.members.me.permissions;
            const hasEssentialPerms = permissions.has(['ManageRoles', 'ManageChannels', 'SendMessages']);
            
            // Verificar status do sistema
            const databaseConnected = global.database ? '🟢 Conectada' : '🔴 Desconectada';
            const socketConnected = global.socketManager ? '🟢 Ativo' : '🔴 Inativo';
            
            const embed = new EmbedBuilder()
                .setColor(hasEssentialPerms ? EMBED_COLORS.SUCCESS : EMBED_COLORS.WARNING)
                .setTitle(`${EMOJIS.BOT} Status do Bot YSNM`)
                .addFields(
                    { name: '🆔 Bot ID', value: interaction.client.user.id, inline: true },
                    { name: '🏷️ Bot Tag', value: interaction.client.user.tag, inline: true },
                    { name: '🌐 Servidor', value: interaction.guild.name, inline: true },
                    { name: '📊 Comandos', value: `${interaction.client.commands?.size || 0}`, inline: true },
                    { name: '🏓 Ping API', value: `${interaction.client.ws.ping}ms`, inline: true },
                    { name: '⏰ Online há', value: `<t:${uptime}:R>`, inline: true },
                    { name: '🔧 Permissões', value: hasEssentialPerms ? `${EMOJIS.SUCCESS} OK` : `${EMOJIS.ERROR} Limitadas`, inline: true },
                    { name: '🗄️ Database', value: databaseConnected, inline: true },
                    { name: '🔌 Socket', value: socketConnected, inline: true },
                    { name: '🏠 Ambiente', value: config.NODE_ENV, inline: true },
                    { name: '🌐 Dashboard', value: `[Acesso](${config.getBaseUrl()})`, inline: true },
                    { name: '� Versão', value: '2.1.1', inline: true }
                )
                .setTimestamp()
                .setFooter({ 
                    text: `Sistema YSNM v2.1.1 • ${hasEssentialPerms ? 'Funcionando' : 'Limitado'}`,
                    iconURL: interaction.client.user.displayAvatarURL()
                });

            await interaction.reply({ embeds: [embed] });
            
            logger.info('Status do bot verificado', {
                userId: interaction.user.id,
                username: interaction.user.tag,
                botPing: interaction.client.ws.ping,
                uptime: uptime,
                hasEssentialPerms,
                commandCount: interaction.client.commands?.size || 0
            });
            
        } catch (error) {
            await errorHandler.handleInteractionError(interaction, error);
        }
    },
};
