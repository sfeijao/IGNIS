const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-painel-tags')
        .setDescription('Configura o painel de solicitação de tags para utilizadores')
        .setDefaultMemberPermissions('0'),
    
    async execute(interaction) {
        // Verificar permissões (apenas admin/owner)
        const config = await storage.getGuildConfig(interaction.guild.id);
        const isOwner = interaction.user.id === '381762006329589760';
        const hasAdminRole = config.roles?.admin ? interaction.member.roles.cache.has(config.roles.admin) : false;
        const hasAdminPerm = interaction.member.permissions.has('Administrator');
        
        if (!isOwner && !hasAdminRole && !hasAdminPerm) {
            return interaction.reply({ 
                content: '❌ Apenas administradores podem configurar este painel!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#9932CC')
            .setTitle('🏷️ Solicitação de Tags Especiais')
            .setDescription(`**Bem-vindo ao sistema de tags da IGNIS Community!**\n\n` +
                `Para solicitar uma tag especial, seleciona a opção desejada no menu abaixo e explica o motivo do teu pedido.\n\n` +
                `**🎯 Tags Disponíveis:**\n` +
                `⭐ **VIP** - Acesso especial VIP à comunidade\n` +
                `👑 **Membro** - Membro ativo e reconhecido\n` +
                `💎 **Moderador** - Moderador (requer experiência)\n` +
                `⚡ **Suporte** - Suporte técnico à comunidade\n\n` +
                `**📋 Como funciona:**\n` +
                `1️⃣ Seleciona a tag que desejas\n` +
                `2️⃣ Preenche o formulário com a justificação\n` +
                `3️⃣ A tua solicitação será analisada pela staff\n` +
                `4️⃣ Receberás uma resposta por mensagem privada\n\n` +
                `⚠️ **Importante:** Tags administrativas (Moderador, Suporte) requerem experiência comprovada.`)
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'IGNIS Community • Sistema de Tags' })
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
                    label: 'Membro',
                    description: 'Tag de membro ativo da comunidade',
                    value: 'tag_member',
                    emoji: '👑'
                },
                {
                    label: 'Moderador',
                    description: 'Tag de moderador (requer experiência)',
                    value: 'tag_mod',
                    emoji: '💎'
                },
                {
                    label: 'Suporte',
                    description: 'Tag de suporte técnico',
                    value: 'tag_support',
                    emoji: '⚡'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Resposta ephemeral para confirmar ao admin
        await interaction.reply({
            content: '✅ Configurando painel de tags...',
            flags: MessageFlags.Ephemeral
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
