const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('solicitar-tag')
        .setDescription('Solicitar uma tag/cargo especial (Nota: Use o painel configurado pelos admins)'),

    async execute(interaction) {
        // Informar que este comando foi substituído pelo sistema de painéis
        const infoEmbed = new EmbedBuilder()
            .setColor('#9932CC')
            .setTitle('ℹ️ Sistema de Pedidos de Tags')
            .setDescription('**Este comando foi substituído pelo sistema de painéis!**\n\n' +
                           '🔧 **Como solicitar tags:**\n' +
                           '• Os administradores configuram painéis usando `/configurar-painel-tags`\n' +
                           '• Interaja com os painéis configurados para fazer seus pedidos\n' +
                           '• O sistema é mais organizado e controlado pelos administradores\n\n' +
                           '📍 **Procure pelos painéis de pedidos de tags nos canais apropriados!**')
            .setFooter({
                text: 'IGNIS Community • Sistema de Tags',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [infoEmbed],
            flags: MessageFlags.Ephemeral
        });
    },
};
