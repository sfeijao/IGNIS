const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
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
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🌟 VERIFICAÇÃO DO SERVIDOR 🌟')
            .setDescription(`Bem-vindo(a) ao **${config.serverName || interaction.guild.name}**!\n\n` +
                '📋 **Sistema de Verificação**\n' +
                'Para aceder todos os canais e interagir com a nossa comunidade, é necessário passar pela verificação.\n\n' +
                'O processo é rápido e garante um ambiente seguro para todos os membros.\n\n' +
                '⚡ **Processo de Verificação:**\n' +
                '1. 🔄 Clique no botão "Verificar" abaixo\n' +
                '2. 📝 Preenche o formulário solicitado\n' +
                '3. 🎯 Escolhe um nickname adequado\n' +
                '4. ✅ Recebe acesso completo ao servidor\n\n' +
                '✨ **Benefícios:**\n' +
                '• Acesso a todos os canais\n' +
                '• Participação em eventos exclusivos\n' +
                '• Tag de membro verificado\n' +
                '• Interação com a comunidade\n\n' +
                '⚠️ **Importante:**\n' +
                '• Siga as regras do servidor\n' +
                '• Mantenha um perfil adequado\n' +
                '• Divirta-se!')
            .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }))
            .setFooter({ 
                text: 'IGNIS COMMUNITY™ • Sistema de verificação seguro • 2025'
            })
            .setTimestamp();

        const button = new ButtonBuilder()
            .setCustomId(BUTTON_IDS.VERIFY_USER)
            .setLabel('🔒 Verificar Conta')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(button);

        try {
            await interaction.reply({
                content: '✅ Configurando sistema de verificação...',
                ephemeral: true
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
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: '❌ Erro ao configurar o sistema de verificação!'
                });
            }
        }
    },
};
