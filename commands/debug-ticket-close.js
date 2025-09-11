const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug-ticket-close')
        .setDescription('Debug específico para fechamento de tickets com logs organizados')
        .setDefaultMemberPermissions('0'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const guildId = interaction.guildId;
            const ticketManager = interaction.client.ticketManager;
            
            // Dados de teste para fechamento de ticket
            const dadosTeste = {
                author: interaction.user,
                ticketId: `DEBUG-${Date.now()}`,
                files: [{
                    name: `ticket-DEBUG-${Date.now()}-transcript.txt`,
                    content: `TRANSCRIÇÃO DE DEBUG
========================================
Data: ${new Date().toLocaleString('pt-BR')}
Usuário: ${interaction.user.tag}
Canal: #${interaction.channel.name}
Servidor: ${interaction.guild.name}
========================================

[${new Date().toLocaleTimeString('pt-BR')}] ${interaction.user.tag}: Teste de fechamento de ticket
[${new Date().toLocaleTimeString('pt-BR')}] Sistema: Ticket fechado automaticamente
[${new Date().toLocaleTimeString('pt-BR')}] Debug: Verificando envio de logs organizados

========================================
Ticket fechado por: ${interaction.user.tag}
Duração total: 5 minutos (debug)
Resultado: Teste de sistema de logs
========================================`
                }],
                guild: interaction.guild,
                closedBy: interaction.user,
                reason: 'Debug do sistema de logs organizados'
            };

            logger.info(`🔧 [DEBUG TICKET CLOSE] Iniciando teste de fechamento`);
            logger.info(`🔧 [DEBUG TICKET CLOSE] Guild ID: ${guildId}`);
            logger.info(`🔧 [DEBUG TICKET CLOSE] Dados: ${JSON.stringify({
                ticketId: dadosTeste.ticketId,
                closedBy: dadosTeste.closedBy.tag,
                guild: dadosTeste.guild.name
            })}`);

            // Tentar enviar o log organizado diretamente
            await ticketManager.enviarLogOrganizado(guildId, 'close', dadosTeste);

            // Resposta de sucesso
            const embed = new EmbedBuilder()
                .setTitle('🔧 Debug - Fechamento de Ticket')
                .setDescription('Teste de fechamento de ticket executado!')
                .setColor(0xF44336)
                .addFields(
                    { name: '🆔 ID Debug', value: dadosTeste.ticketId, inline: true },
                    { name: '🔒 Fechado por', value: dadosTeste.closedBy.tag, inline: true },
                    { name: '🏷️ Servidor', value: interaction.guild.name, inline: true },
                    { name: '📋 Status', value: 'Log enviado para sistema organizado', inline: false },
                    { name: '📄 Transcript', value: 'Arquivo de teste incluído', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Debug - Sistema de Logs Organizados' });

            await interaction.editReply({ embeds: [embed] });

            logger.info(`🔧 [DEBUG TICKET CLOSE] Teste concluído com sucesso`);

        } catch (error) {
            logger.error('🔧 [DEBUG TICKET CLOSE] Erro no teste:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erro no Debug')
                .setDescription('Ocorreu um erro ao testar o fechamento de ticket.')
                .setColor(0xF44336)
                .addFields(
                    { name: '📝 Erro', value: error.message || 'Erro desconhecido' },
                    { name: '🔍 Stack', value: `\`\`\`${error.stack?.substring(0, 1000) || 'Não disponível'}\`\`\`` }
                )
                .setTimestamp();

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }
    },
};