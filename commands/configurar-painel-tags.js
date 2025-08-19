const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-painel-tags')
        .setDescription('Configura o painel de solicitação de tags para utilizadores')
        .setDefaultMemberPermissions('0'),
    
    async execute(interaction) {
        // Verificar permissões (apenas admin/owner)
        const isOwner = interaction.user.id === '381762006329589760';
        const hasAdminRole = interaction.member.roles.cache.has(config.roles.admin);
        const hasAdminPerm = interaction.member.permissions.has('Administrator');
        
        if (!isOwner && !hasAdminRole && !hasAdminPerm) {
            return interaction.reply({ 
                content: '❌ Apenas administradores podem configurar este painel!', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#9932CC')
            .setTitle('🏷️ Solicitação de Tags Especiais')
            .setDescription(`**Bem-vindo ao sistema de tags da YSNM Community!**\n\n` +
                `Para solicitar uma tag especial, seleciona a opção desejada no menu abaixo e explica o motivo do teu pedido.\n\n` +
                `**🎯 Tags Disponíveis:**\n` +
                `⭐ **VIP** - Acesso especial VIP à comunidade\n` +
                `👑 **Member** - Membro ativo e reconhecido\n` +
                `💎 **Mod** - Moderador (requer experiência)\n` +
                `⚡ **Support** - Suporte técnico à comunidade\n\n` +
                `**📋 Como funciona:**\n` +
                `1️⃣ Seleciona a tag que desejas\n` +
                `2️⃣ Preenche o formulário com a justificação\n` +
                `3️⃣ A tua solicitação será analisada pela staff\n` +
                `4️⃣ Receberás uma resposta por mensagem privada\n\n` +
                `⚠️ **Importante:** Tags administrativas (Mod, Support) requerem experiência comprovada.`)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'YSNM Community • Sistema de Tags' })
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('solicitar_tag_menu')
            .setPlaceholder('🎯 Escolhe a tag que desejas solicitar...')
            .addOptions([
                {
                    label: 'VIP',
                    description: 'Tag VIP especial da comunidade',
                    value: 'tag_vip',
                    emoji: '⭐'
                },
                {
                    label: 'Member',
                    description: 'Tag de membro ativo da comunidade',
                    value: 'tag_member',
                    emoji: '👑'
                },
                {
                    label: 'Mod',
                    description: 'Tag de moderador (requer experiência)',
                    value: 'tag_mod',
                    emoji: '💎'
                },
                {
                    label: 'Support',
                    description: 'Tag de suporte técnico',
                    value: 'tag_support',
                    emoji: '⚡'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Resposta ephemeral para confirmar ao admin
        await interaction.reply({
            content: '✅ Configurando painel de tags...',
            ephemeral: true
        });

        // Enviar o painel no canal
        const painelMessage = await interaction.channel.send({
            embeds: [embed],
            components: [row]
        });

        // Editar a resposta para confirmar sucesso
        await interaction.editReply({
            content: `✅ Painel de solicitação de tags configurado com sucesso!\n📍 Mensagem criada: [Clica aqui para ver](${painelMessage.url})`
        });
    }
};
