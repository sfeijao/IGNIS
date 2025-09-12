const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status-logs')
        .setDescription('Mostra status REAL do sistema de logs (sem mentiras)')
        .setDefaultMemberPermissions('0'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const guildId = interaction.guildId;
            const guildName = interaction.guild.name;

            // Ler configuração diretamente do arquivo
            const configPath = path.join(__dirname, '../config/webhooks.json');
            let config = null;
            let configExists = false;

            try {
                const data = await fs.readFile(configPath, 'utf8');
                config = JSON.parse(data);
                configExists = true;
            } catch (error) {
                configExists = false;
            }

            // Verificar se este servidor está configurado
            const guildConfig = config?.webhooks?.[guildId];
            const isConfigured = !!(guildConfig && guildConfig.webhookUrl && !guildConfig.webhookUrl.includes('SEU_WEBHOOK_URL'));

            // Testar webhook se configurado
            let webhookWorking = false;
            if (isConfigured) {
                try {
                    const { WebhookClient } = require('discord.js');
                    const webhook = new WebhookClient({ url: guildConfig.webhookUrl });
                    
                    await webhook.send({
                        embeds: [{
                            title: '🧪 Teste de Status',
                            description: 'Este é um teste automático do sistema de logs.',
                            color: 0x3498DB,
                            timestamp: new Date()
                        }]
                    });
                    
                    webhookWorking = true;
                } catch (error) {
                    logger.error('Webhook test failed:', error);
                    webhookWorking = false;
                }
            }

            // Verificar TicketManager
            const ticketManager = interaction.client.ticketManager;
            const ticketManagerOk = !!ticketManager;

            // Criar embed de status
            const embed = new EmbedBuilder()
                .setTitle('📊 Status REAL do Sistema de Logs')
                .setColor(isConfigured && webhookWorking ? 0x4CAF50 : 0xF44336)
                .addFields(
                    { name: '🏷️ Servidor', value: guildName, inline: true },
                    { name: '🆔 Guild ID', value: guildId, inline: true },
                    { name: '📁 Arquivo Config', value: configExists ? '✅ Existe' : '❌ Não existe', inline: true }
                );

            if (configExists && config) {
                embed.addFields(
                    { name: '🔗 Webhook Configurado', value: isConfigured ? '✅ Sim' : '❌ Não', inline: true },
                    { name: '🧪 Webhook Funcionando', value: webhookWorking ? '✅ Sim' : '❌ Não testado/falhou', inline: true },
                    { name: '🎫 TicketManager', value: ticketManagerOk ? '✅ Ativo' : '❌ Inativo', inline: true }
                );

                if (isConfigured) {
                    const configDate = guildConfig.configuredAt ? new Date(guildConfig.configuredAt).toLocaleString('pt-BR') : 'Desconhecido';
                    embed.addFields(
                        { name: '⏰ Configurado em', value: configDate, inline: true },
                        { name: '🔗 URL (primeiros 50)', value: `\`${guildConfig.webhookUrl.substring(0, 50)}...\``, inline: false }
                    );
                }

                // Status geral
                if (isConfigured && webhookWorking && ticketManagerOk) {
                    embed.setDescription('🎉 **SISTEMA 100% FUNCIONAL!**\n\nCrie e feche um ticket para testar.');
                } else if (isConfigured && !webhookWorking) {
                    embed.setDescription('⚠️ **Webhook configurado mas não funciona**\n\nVerifique se a URL está correta.');
                } else if (!isConfigured) {
                    embed.setDescription('❌ **Sistema NÃO configurado**\n\nUse `/webhook-direto url:SUA_URL` para configurar.');
                } else {
                    embed.setDescription('⚠️ **Sistema parcialmente funcional**\n\nVerifique os itens marcados com ❌.');
                }

                // Mostrar outros servidores configurados
                const allServers = Object.keys(config.webhooks || {});
                const configuredServers = allServers.filter(id => {
                    const cfg = config.webhooks[id];
                    return cfg && cfg.webhookUrl && !cfg.webhookUrl.includes('SEU_WEBHOOK_URL');
                });

                if (configuredServers.length > 0) {
                    let serversList = '';
                    for (const serverId of configuredServers) {
                        const serverConfig = config.webhooks[serverId];
                        serversList += `${serverConfig.name}: ${serverId === guildId ? '✅' : '⚪'}\n`;
                    }
                    embed.addFields({ name: '🌐 Todos os Servidores', value: serversList, inline: false });
                }

            } else {
                embed.setDescription('❌ **Arquivo de configuração não existe**\n\nUse `/webhook-direto url:SUA_URL` para criar e configurar.');
            }

            embed.setTimestamp();
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Erro no comando status-logs:', error);

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erro ao Verificar Status')
                .setDescription('Ocorreu um erro ao verificar o status do sistema.')
                .setColor(0xF44336)
                .addFields({ name: '📝 Erro', value: error.message || 'Erro desconhecido' })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};