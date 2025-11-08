const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-tags')
        .setDescription('Configura o sistema de tags personalizadas'),
    
    async execute(interaction) {
        // Verificar permissões (incluindo owner)
        const config = await storage.getGuildConfig(interaction.guild.id);
        const isOwner = interaction.user.id === '381762006329589760';
        const hasAdminRole = config.roles?.admin ? interaction.member.roles.cache.has(config.roles.admin) : false;
        const hasAdminPerm = interaction.member.permissions.has('Administrator');
        
        if (!isOwner && !hasAdminRole && !hasAdminPerm) {
            return interaction.reply({ 
                content: '❌ Não tens permissão para usar este comando!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🏷️ Painel de Gestão de Tags/Cargos')
            .setDescription('**Apenas Staff** - Gerir tags e cargos de utilizadores\n\n' +
                '🏷️ **Adicionar Tag** ➜ **Remover Tag** ➜ **Gerir Cargos**\n' +
                '• Adicionar tag → Adicionar/remover tag de um utilizador\n' +
                '• Remover tag → Adicionar/remover tag de um utilizador\n' +
                '• Gerir Cargos → Adicionar/remover cargos específicos\n\n' +
                '💡 **Como usar:**\n' +
                '• Clica no botão desejado\n' +
                '• Insere o ID do utilizador\n' +
                '• Especifica a tag/cargo\n' +
                '• Confirma a ação')
            .setTimestamp()
            .setFooter({ text: 'Sistema de Tags • Staff Roles' });

        const addTagButton = new ButtonBuilder()
            .setCustomId('add_tag_staff')
            .setLabel('✅ Adicionar Tag')
            .setStyle(ButtonStyle.Success);

        const removeTagButton = new ButtonBuilder()
            .setCustomId('remove_tag_staff')
            .setLabel('❌ Remover Tag')
            .setStyle(ButtonStyle.Danger);

        const manageRolesButton = new ButtonBuilder()
            .setCustomId('manage_roles_staff')
            .setLabel('⚙️ Gerir Cargos')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder()
            .addComponents(addTagButton, removeTagButton, manageRolesButton);

        await interaction.reply({
            content: '✅ Configurando sistema de tags...',
            flags: MessageFlags.Ephemeral
        });

        // Enviar o painel no canal
        const tagsMessage = await interaction.channel.send({
            embeds: [embed],
            components: [row]
        });

        // Editar resposta para confirmar
        await interaction.editReply({
            content: `✅ Sistema de tags configurado com sucesso!\n📍 Mensagem criada: [Clica aqui para ver](${tagsMessage.url})`
        });
    },
};
