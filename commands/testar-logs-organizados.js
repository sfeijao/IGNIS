const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testar-logs-organizados')
        .setDescription('Testa o sistema de logs organizados')
        .setDefaultMemberPermissions('0')
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de log para testar')
                .setRequired(true)
                .addChoices(
                    { name: 'Criar Ticket', value: 'create' },
                    { name: 'Atualizar Ticket', value: 'update' },
                    { name: 'Fechar Ticket', value: 'close' }
                )),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const tipo = interaction.options.getString('tipo');
            const guildId = interaction.guildId;
            
            // Obter o TicketManager do client
            const ticketManager = interaction.client.ticketManager;
            
            // Dados de teste baseados no tipo
            let dadosTeste;
            
            switch (tipo) {
                case 'create':
                    dadosTeste = {
                        ticketId: 'TEST-001',
                        author: interaction.user,
                        category: 'Suporte Geral',
                        guild: interaction.guild
                    };
                    break;
                    
                case 'update':
                    dadosTeste = {
                        ticketId: 'TEST-001',
                        updatedBy: interaction.user,
                        status: 'Em Atendimento',
                        guild: interaction.guild
                    };
                    break;
                    
                case 'close':
                    dadosTeste = {
                        ticketId: 'TEST-001',
                        closedBy: interaction.user,
                        duration: '2h 30m',
                        reason: 'Problema resolvido',
                        guild: interaction.guild,
                        files: [{
                            name: 'ticket-TEST-001-transcript.txt',
                            content: `TRANSCRIÇÃO DO TICKET TEST-001
========================================
Data: ${new Date().toLocaleString('pt-BR')}
Usuário: ${interaction.user.tag}
Canal: #${interaction.channel.name}
========================================

[${new Date().toLocaleTimeString('pt-BR')}] ${interaction.user.tag}: Olá, preciso de ajuda!
[${new Date().toLocaleTimeString('pt-BR')}] Staff: Como posso ajudá-lo?
[${new Date().toLocaleTimeString('pt-BR')}] ${interaction.user.tag}: Problema foi resolvido, obrigado!
[${new Date().toLocaleTimeString('pt-BR')}] Staff: Ticket será fechado.

========================================
Ticket fechado por: ${interaction.user.tag}
Duração total: 2h 30m
========================================`
                        }]
                    };
                    break;
            }

            // Tentar enviar o log organizado
            await ticketManager.enviarLogOrganizado(guildId, tipo, dadosTeste);

            // Resposta de sucesso
            const embed = new EmbedBuilder()
                .setTitle('✅ Teste de Log Organizado')
                .setDescription('Log de teste enviado com sucesso!')
                .setColor(0x4CAF50)
                .addFields(
                    { name: '📊 Tipo', value: tipo, inline: true },
                    { name: '🆔 ID Teste', value: dadosTeste.ticketId, inline: true },
                    { name: '🏷️ Servidor', value: interaction.guild.name, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Sistema de Logs Organizados' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Erro ao testar logs organizados:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erro no Teste')
                .setDescription('Ocorreu um erro ao testar o sistema de logs organizados.')
                .setColor(0xF44336)
                .addFields(
                    { name: '📝 Erro', value: error.message || 'Erro desconhecido' }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
