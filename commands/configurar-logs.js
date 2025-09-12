const { 
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-logs')
        .setDescription('Configura o webhook para logs de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('adicionar')
                .setDescription('Adiciona ou atualiza o webhook de logs')
                .addStringOption(option =>
                    option
                        .setName('webhook')
                        .setDescription('URL do webhook do Discord')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remover')
                .setDescription('Remove o webhook de logs atual'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('testar')
                .setDescription('Envia uma mensagem de teste para o webhook')),

    async execute(interaction) {
        try {
            // Tentar defer reply com timeout
            await Promise.race([
                interaction.deferReply({ ephemeral: true }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Defer timeout')), 2000)
                )
            ]);
        } catch (error) {
            logger.error('Erro no defer reply:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ Erro interno. Tente novamente em alguns segundos.', 
                        ephemeral: true 
                    });
                }
                return;
            } catch (replyError) {
                logger.error('Erro ao responder com erro:', replyError);
                return;
            }
        }

        const subcommand = interaction.options.getSubcommand();
        const webhookManager = interaction.client.ticketManager.webhooks;

        try {
            switch (subcommand) {
                case 'adicionar': {
                    const webhookUrl = interaction.options.getString('webhook');

                    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                        return await interaction.editReply({
                            content: '❌ URL de webhook inválida! Certifique-se de copiar a URL completa do webhook.'
                        });
                    }

                    try {
                        await webhookManager.setWebhookUrl(interaction.guildId, webhookUrl);
                        
                        await interaction.editReply({
                            content: '✅ Webhook de logs configurado com sucesso! As configurações são permanentes e persistem após redeploys.'
                        });
                    } catch (error) {
                        logger.error('Erro ao configurar webhook:', error);
                        await interaction.editReply({
                            content: '❌ Erro ao configurar webhook. Verifique a URL e tente novamente.'
                        });
                    }
                    break;
                }

                case 'remover': {
                    try {
                        await webhookManager.setWebhookUrl(interaction.guildId, null);
                        
                        await interaction.editReply({
                            content: '✅ Webhook de logs removido com sucesso!'
                        });
                    } catch (error) {
                        logger.error('Erro ao remover webhook:', error);
                        await interaction.editReply({
                            content: '❌ Erro ao remover webhook.'
                        });
                    }
                    break;
                }

                case 'testar': {
                    try {
                        const success = await webhookManager.testWebhook(interaction.guildId);
                        
                        if (success) {
                            await interaction.editReply({
                                content: '✅ Mensagem de teste enviada! Verifique o canal de logs.'
                            });
                        } else {
                            await interaction.editReply({
                                content: '❌ Webhook não configurado ou inválido. Configure primeiro com `/configurar-logs adicionar`.'
                            });
                        }
                    } catch (error) {
                        logger.error('Erro ao testar webhook:', error);
                        await interaction.editReply({
                            content: '❌ Erro ao testar webhook. Verifique se está configurado corretamente.'
                        });
                    }
                    break;
                }
            }
        } catch (error) {
            logger.error('Erro ao executar comando de webhook:', error);
            try {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: '❌ Ocorreu um erro ao processar o comando. Tente novamente mais tarde.'
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: '❌ Ocorreu um erro ao processar o comando. Tente novamente mais tarde.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                logger.error('Erro ao responder com erro final:', replyError);
            }
        }
    }
};
