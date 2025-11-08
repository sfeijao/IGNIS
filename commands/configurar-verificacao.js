const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { BUTTON_IDS } = require('../constants/ui');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-verificacao')
        .setDescription('Configura o sistema de verificação de membros'),
    
    async execute(interaction) {
    // Verificar permissões (incluindo owner)
        const config = await storage.getGuildConfig(interaction.guild.id);
        const isOwner = interaction.user.id === '381762006329589760';
        const hasAdminRole = config.roles?.admin ? interaction.member.roles.cache.has(config.roles.admin) : false;
    const hasAdminPerm = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        
        if (!isOwner && !hasAdminRole && !hasAdminPerm) {
            return interaction.reply({ 
                content: '❌ Não tens permissão para usar este comando!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x7C3AED) // Roxo moderno (escuro). Alternativa clara: 0x60A5FA
            .setTitle('🔒 Verificação do Servidor')
            .setDescription(
                `Bem-vindo(a) a **${config.serverName || interaction.guild.name}**.\n\n` +
                'Para aceder a todos os canais, conclui a verificação clicando no botão abaixo. O processo é rápido e mantém a comunidade segura.'
            )
            .addFields(
                { name: '⚠️ Importante', value: 'Segue as regras do servidor e mantém um perfil adequado. Tentativas de burlar a verificação podem resultar em penalizações.' }
            )
            .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }))
            .setFooter({ text: 'IGNIS COMMUNITY™ • Sistema de verificação' })
            .setTimestamp();

        const button = new ButtonBuilder()
            .setCustomId(BUTTON_IDS.VERIFY_USER)
            .setLabel('Verificar')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder()
            .addComponents(button);

        try {
            await interaction.reply({
                content: '✅ Configurando sistema de verificação...',
                flags: MessageFlags.Ephemeral
            });

            // Enviar o painel no canal
            const verificationMessage = await interaction.channel.send({
                embeds: [embed],
                components: [row]
            });

            // Editar resposta para confirmar
            await interaction.editReply({
                content: `✅ Sistema de verificação configurado com sucesso!\n📍 Mensagem criada: [Clica aqui para ver](${verificationMessage.url})`
            });
        } catch (error) {
            const logger = require('../utils/logger');
            logger.error('❌ Erro ao configurar verificação:', { error });
            
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ Erro ao configurar o sistema de verificação!',
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.editReply({
                    content: '❌ Erro ao configurar o sistema de verificação!'
                });
            }
        }
    },
};
