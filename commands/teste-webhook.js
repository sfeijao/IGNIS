const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('teste-webhook')
        .setDescription('Testa o sistema de webhooks para logs cross-server (apenas para administradores)')
        .addStringOption(option =>
            option.setName('servidor-id')
                .setDescription('ID do servidor onde testar o webhook')
                .setRequired(true)
        ),
        // Removido .setDefaultMemberPermissions() para disponibilizar globalmente

    async execute(interaction) {
        try {
            // Verificar se o usuário é administrador
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: '❌ Apenas administradores podem testar webhooks.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const serverId = interaction.options.getString('servidor-id');

            // Verificar se o servidor existe
            const targetGuild = await interaction.client.guilds.fetch(serverId).catch(() => null);
            if (!targetGuild) {
                return await interaction.editReply({
                    content: '❌ Servidor não encontrado ou o bot não está presente nele.'
                });
            }

            logger.info(`Testando webhook para servidor: ${targetGuild.name} (${serverId})`);

            // Acessar o WebhookManager
            const webhookManager = interaction.client.webhooks || interaction.client.ticketManager.webhooks;
            
            if (!webhookManager) {
                return await interaction.editReply({
                    content: '❌ WebhookManager não está disponível.'
                });
            }

            // Configurar webhook para o servidor
            const setupSuccess = await webhookManager.setupForGuild(targetGuild);

            if (!setupSuccess) {
                return await interaction.editReply({
                    content: `❌ Falha ao configurar webhook para **${targetGuild.name}**. Verifique os logs para mais detalhes.`
                });
            }

            // Testar envio de webhook
            const testData = {
                author: interaction.user,
                ticketId: 'TEST-' + Date.now(),
                category: 'Teste'
            };

            await webhookManager.sendTicketLog(serverId, 'create', testData);

            // Criar embed de confirmação
            const successEmbed = new EmbedBuilder()
                .setColor(0x4CAF50)
                .setTitle('✅ Teste de Webhook Concluído')
                .setDescription(`Webhook configurado e testado com sucesso!`)
                .addFields(
                    { name: '🖥️ Servidor', value: `${targetGuild.name}`, inline: false },
                    { name: '🆔 Server ID', value: serverId, inline: false },
                    { name: '✅ Status', value: 'Webhook funcionando corretamente', inline: false }
                )
                .setFooter({ text: 'Sistema de Webhooks YSNM' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            logger.info(`✅ Teste de webhook concluído com sucesso para ${targetGuild.name}`);

        } catch (error) {
            logger.error('❌ Erro no comando teste-webhook:', { 
                error: error.message, 
                stack: error.stack,
                guildId: interaction.guild?.id,
                userId: interaction.user?.id
            });
            
            const errorMessage = `❌ Erro ao testar webhook: ${error.message}`;
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.editReply({ content: errorMessage });
            }
        }
    },
};
