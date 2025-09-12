const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const SimpleWebhookManager = require('../utils/SimpleWebhookManager');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-webhook')
        .setDescription('Configura webhook para logs automáticos (sistema simplificado)')
        .setDefaultMemberPermissions('0')
        .addStringOption(option =>
            option.setName('webhook-url')
                .setDescription('URL do webhook para este servidor')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('acao')
                .setDescription('Ação a realizar')
                .setRequired(false)
                .addChoices(
                    { name: 'Configurar URL', value: 'set' },
                    { name: 'Ver Status', value: 'status' },
                    { name: 'Testar', value: 'test' }
                )
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const webhookManager = new SimpleWebhookManager();
            const guildId = interaction.guildId;
            const webhookUrl = interaction.options.getString('webhook-url');
            const acao = interaction.options.getString('acao') || 'status';

            switch (acao) {
                case 'set':
                    if (!webhookUrl) {
                        return await interaction.editReply({
                            content: '❌ Você precisa fornecer a URL do webhook para configurar.'
                        });
                    }

                    // Validar URL básica
                    if (!webhookUrl.includes('discord.com/api/webhooks/')) {
                        return await interaction.editReply({
                            content: '❌ URL de webhook inválida. Deve ser uma URL do Discord.'
                        });
                    }

                    await webhookManager.setWebhookUrl(guildId, webhookUrl);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Webhook Configurado!')
                        .setDescription('O webhook foi configurado com sucesso para este servidor.')
                        .setColor(0x4CAF50)
                        .addFields(
                            { name: '🏷️ Servidor', value: interaction.guild.name, inline: true },
                            { name: '🆔 Guild ID', value: guildId, inline: true },
                            { name: '🔗 Status', value: 'Configurado', inline: true }
                        )
                        .setFooter({ text: 'Os logs de tickets serão enviados automaticamente.' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed] });
                    break;

                case 'test':
                    const testResult = await webhookManager.testWebhook(guildId);

                    if (testResult) {
                        const testEmbed = new EmbedBuilder()
                            .setTitle('✅ Teste de Webhook')
                            .setDescription('Webhook testado com sucesso! Verifique o canal de logs.')
                            .setColor(0x4CAF50)
                            .setTimestamp();

                        await interaction.editReply({ embeds: [testEmbed] });
                    } else {
                        const errorEmbed = new EmbedBuilder()
                            .setTitle('❌ Falha no Teste')
                            .setDescription('Não foi possível enviar o teste. Verifique se o webhook está configurado corretamente.')
                            .setColor(0xF44336)
                            .setTimestamp();

                        await interaction.editReply({ embeds: [errorEmbed] });
                    }
                    break;

                case 'status':
                default:
                    const status = webhookManager.getStatus();
                    const currentUrl = await webhookManager.getWebhookUrl(guildId);

                    const statusEmbed = new EmbedBuilder()
                        .setTitle('📊 Status do Sistema de Webhooks')
                        .setColor(currentUrl ? 0x4CAF50 : 0xFF9800)
                        .addFields(
                            { name: '🏷️ Servidor Atual', value: interaction.guild.name, inline: true },
                            { name: '🆔 Guild ID', value: guildId, inline: true },
                            { name: '🔗 Webhook', value: currentUrl ? '✅ Configurado' : '❌ Não configurado', inline: true }
                        );

                    if (status.loaded) {
                        statusEmbed.addFields(
                            { name: '📈 Status Geral', value: `${status.configuredGuilds}/${status.totalGuilds} servidores configurados`, inline: false }
                        );

                        // Mostrar detalhes de todos os servidores configurados
                        let serversInfo = '';
                        for (const [id, config] of Object.entries(status.guilds)) {
                            const hasWebhook = config.webhookUrl && !config.webhookUrl.includes('SEU_WEBHOOK_URL');
                            serversInfo += `${config.name}: ${hasWebhook ? '✅' : '❌'}\n`;
                        }
                        
                        if (serversInfo) {
                            statusEmbed.addFields({ name: '🌐 Servidores', value: serversInfo, inline: true });
                        }
                    }

                    if (!currentUrl) {
                        statusEmbed.setDescription(
                            '⚠️ **Webhook não configurado para este servidor**\n\n' +
                            '**Para configurar:**\n' +
                            '1. Crie um webhook no canal de logs desejado\n' +
                            '2. Copie a URL do webhook\n' +
                            '3. Use: `/configurar-webhook webhook-url:SUA_URL acao:set`'
                        );
                    } else {
                        statusEmbed.setDescription(
                            '✅ **Sistema funcionando!**\n\n' +
                            'Os logs de tickets serão enviados automaticamente quando:\n' +
                            '• Um ticket for criado\n' +
                            '• Um ticket for assumido\n' +
                            '• Um ticket for fechado (com transcript)'
                        );
                    }

                    statusEmbed.setTimestamp();
                    await interaction.editReply({ embeds: [statusEmbed] });
                    break;
            }

        } catch (error) {
            logger.error('Erro no comando configurar-webhook:', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erro')
                .setDescription('Ocorreu um erro ao processar o comando.')
                .setColor(0xF44336)
                .addFields({ name: '📝 Detalhes', value: error.message || 'Erro desconhecido' })
                .setTimestamp();

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            } else {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }
    },
};