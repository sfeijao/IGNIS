const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('diagnostico-logs-organizados')
        .setDescription('Diagnostica a configuração dos logs organizados')
        .setDefaultMemberPermissions('0'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const guildId = interaction.guildId;
            const storage = interaction.client.storage;
            
            // Obter configuração
            const config = await storage.getGuildConfig(guildId);
            const logsOrganizados = config?.logsOrganizados;

            // Determinar servidor
            let servidorOrigem = null;
            if (guildId === '1333820000791691284') {
                servidorOrigem = 'ysnm';
            } else if (guildId === '1283603691538088027') {
                servidorOrigem = 'beanny';
            }

            const embed = new EmbedBuilder()
                .setTitle('🔍 Diagnóstico de Logs Organizados')
                .setColor(0x4CAF50)
                .addFields(
                    { name: '🆔 Guild ID', value: guildId, inline: true },
                    { name: '🏷️ Servidor Detectado', value: servidorOrigem || 'Não detectado', inline: true },
                    { name: '⚙️ Config Existe', value: config ? '✅ Sim' : '❌ Não', inline: true },
                    { name: '📋 Logs Organizados', value: logsOrganizados ? '✅ Configurado' : '❌ Não configurado', inline: true }
                )
                .setTimestamp();

            if (logsOrganizados) {
                embed.addFields({
                    name: '📊 Configuração Completa',
                    value: `\`\`\`json\n${JSON.stringify(logsOrganizados, null, 2)}\`\`\``
                });

                if (servidorOrigem && logsOrganizados[servidorOrigem]) {
                    const serverConfig = logsOrganizados[servidorOrigem];
                    embed.addFields(
                        { name: '📡 Canal Configurado', value: `<#${serverConfig.channelId}>`, inline: true },
                        { name: '🔗 Webhook URL', value: serverConfig.webhookUrl ? '✅ Configurado' : '❌ Ausente', inline: true }
                    );
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Erro ao diagnosticar logs organizados:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erro no Diagnóstico')
                .setDescription('Ocorreu um erro ao diagnosticar os logs organizados.')
                .setColor(0xF44336)
                .addFields(
                    { name: '📝 Erro', value: error.message || 'Erro desconhecido' }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};