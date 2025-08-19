const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('solicitar-tag')
        .setDescription('Painel para solicitar tags especiais'),
    
    async execute(interaction) {
        // Verificar se está verificado
        if (!interaction.member.roles.cache.has(config.roles.verified)) {
            return interaction.reply({ 
                content: '❌ Precisas estar verificado para solicitar tags!', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('🏷️ Pedido de Tag')
            .setDescription('Pede uma tag especial!\n\n' +
                '**Tags Administrativas** ⭐ VIP ➤ Membro\n' +
                '⭐ Admin\n' +
                '💎 Mod\n' +
                '⚡ Support\n\n' +
                '**Tags Especiais** **Tags Básicas**\n' +
                '🎯 VIP ➤ Membro\n' +
                '👑 Member\n\n' +
                '📌 **Informação:**\n' +
                '• Tags administrativas incluem Staff Roles\n' +
                '• Apenas uma tag administrativa por utilizador\n' +
                '• Staff Roles aprovam pedidos')
            .setTimestamp()
            .setFooter({ text: 'Pedir Tag' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('tag_request_select')
            .setPlaceholder('Escolhe a tag que desejas...')
            .addOptions([
                {
                    label: 'VIP',
                    description: 'Tag VIP especial',
                    value: 'vip_tag',
                    emoji: '⭐'
                },
                {
                    label: 'Member',
                    description: 'Tag de membro',
                    value: 'member_tag',
                    emoji: '👑'
                },
                {
                    label: 'Mod',
                    description: 'Tag de moderador (apenas staff)',
                    value: 'mod_tag',
                    emoji: '💎'
                },
                {
                    label: 'Support',
                    description: 'Tag de suporte (apenas staff)',
                    value: 'support_tag',
                    emoji: '⚡'
                }
            ]);

        const row = new ActionRowBuilder()
            .addComponents(selectMenu);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    },
};
