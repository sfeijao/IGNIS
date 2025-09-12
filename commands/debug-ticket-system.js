const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug-ticket-system')
        .setDescription('Debug completo do sistema de tickets e logs')
        .setDefaultMemberPermissions('0')
        .addStringOption(option =>
            option.setName('acao')
                .setDescription('Tipo de debug a executar')
                .setRequired(true)
                .addChoices(
                    { name: 'Verificar Sistema', value: 'check' },
                    { name: 'Simular Criação', value: 'create' },
                    { name: 'Simular Fechamento', value: 'close' },
                    { name: 'Status dos Managers', value: 'managers' }
                )
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const acao = interaction.options.getString('acao');
            const guildId = interaction.guildId;

            switch (acao) {
                case 'check':
                    await this.verificarSistema(interaction, guildId);
                    break;
                case 'create':
                    await this.simularCriacao(interaction, guildId);
                    break;
                case 'close':
                    await this.simularFechamento(interaction, guildId);
                    break;
                case 'managers':
                    await this.verificarManagers(interaction);
                    break;
            }

        } catch (error) {
            logger.error('Erro no debug do sistema de tickets:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erro no Debug')
                .setDescription('Ocorreu um erro durante o debug.')
                .setColor(0xF44336)
                .addFields({ name: '📝 Erro', value: error.message || 'Erro desconhecido' })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async verificarSistema(interaction, guildId) {
        const ticketManager = interaction.client.ticketManager;
        const webhookManager = ticketManager?.webhooks;

        const embed = new EmbedBuilder()
            .setTitle('🔍 Verificação do Sistema de Tickets')
            .setColor(0x3498DB)
            .addFields(
                { 
                    name: '🎫 TicketManager', 
                    value: ticketManager ? '✅ Disponível' : '❌ Não encontrado', 
                    inline: true 
                },
                { 
                    name: '🔗 WebhookManager', 
                    value: webhookManager ? `✅ Tipo: ${webhookManager.constructor.name}` : '❌ Não encontrado', 
                    inline: true 
                },
                { 
                    name: '🆔 Guild ID', 
                    value: guildId, 
                    inline: true 
                }
            );

        if (webhookManager) {
            try {
                const webhookUrl = await webhookManager.getWebhookUrl(guildId);
                embed.addFields({
                    name: '🌐 Webhook Status',
                    value: webhookUrl ? '✅ Configurado' : '❌ Não configurado',
                    inline: true
                });

                if (webhookUrl) {
                    embed.addFields({
                        name: '🔗 URL (primeiros 50 chars)',
                        value: `\`${webhookUrl.substring(0, 50)}...\``,
                        inline: false
                    });
                }
            } catch (error) {
                embed.addFields({
                    name: '⚠️ Erro ao verificar webhook',
                    value: error.message,
                    inline: false
                });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async simularCriacao(interaction, guildId) {
        const ticketManager = interaction.client.ticketManager;

        if (!ticketManager) {
            return await interaction.editReply({
                content: '❌ TicketManager não está disponível!'
            });
        }

        const dadosSimulados = {
            author: interaction.user,
            ticketId: `SIM-${Date.now()}`,
            category: 'Debug',
            guild: interaction.guild
        };

        logger.info(`🔧 [DEBUG] Simulando criação de ticket: ${JSON.stringify(dadosSimulados.ticketId)}`);

        try {
            await ticketManager.enviarLog(guildId, 'create', dadosSimulados);

            const embed = new EmbedBuilder()
                .setTitle('✅ Simulação de Criação')
                .setDescription('Log de criação de ticket enviado!')
                .setColor(0x4CAF50)
                .addFields(
                    { name: '🆔 ID Simulado', value: dadosSimulados.ticketId, inline: true },
                    { name: '👤 Autor', value: dadosSimulados.author.tag, inline: true },
                    { name: '📝 Categoria', value: dadosSimulados.category, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Erro na simulação de criação:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Falha na Simulação')
                .setDescription('Erro ao enviar log de criação.')
                .setColor(0xF44336)
                .addFields({ name: '📝 Erro', value: error.message })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async simularFechamento(interaction, guildId) {
        const ticketManager = interaction.client.ticketManager;

        if (!ticketManager) {
            return await interaction.editReply({
                content: '❌ TicketManager não está disponível!'
            });
        }

        const dadosSimulados = {
            ticketId: `SIM-CLOSE-${Date.now()}`,
            author: interaction.user,
            closedBy: interaction.user,
            transcript: `TRANSCRIÇÃO SIMULADA
========================================
Data: ${new Date().toLocaleString('pt-BR')}
Usuário: ${interaction.user.tag}
========================================

[DEBUG] Este é um transcript simulado para teste
[DEBUG] Log de fechamento sendo testado
[DEBUG] Sistema de webhooks funcionando

========================================
Ticket fechado por: ${interaction.user.tag}
Duração: Simulação
========================================`,
            guild: interaction.guild,
            duration: '5m (simulado)',
            reason: 'Teste do sistema de logs'
        };

        logger.info(`🔧 [DEBUG] Simulando fechamento de ticket: ${dadosSimulados.ticketId}`);

        try {
            await ticketManager.enviarLog(guildId, 'close', dadosSimulados);

            const embed = new EmbedBuilder()
                .setTitle('✅ Simulação de Fechamento')
                .setDescription('Log de fechamento de ticket enviado!')
                .setColor(0xF44336)
                .addFields(
                    { name: '🆔 ID Simulado', value: dadosSimulados.ticketId, inline: true },
                    { name: '🔒 Fechado por', value: dadosSimulados.closedBy.tag, inline: true },
                    { name: '⏱️ Duração', value: dadosSimulados.duration, inline: true },
                    { name: '📄 Transcript', value: 'Incluído na simulação', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Erro na simulação de fechamento:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Falha na Simulação')
                .setDescription('Erro ao enviar log de fechamento.')
                .setColor(0xF44336)
                .addFields({ name: '📝 Erro', value: error.message })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async verificarManagers(interaction) {
        const client = interaction.client;
        
        const embed = new EmbedBuilder()
            .setTitle('🔧 Status dos Managers')
            .setColor(0x9C27B0);

        // TicketManager
        const ticketManager = client.ticketManager;
        if (ticketManager) {
            embed.addFields({
                name: '🎫 TicketManager',
                value: `✅ Ativo\nTipo: ${ticketManager.constructor.name}\nWebhooks: ${ticketManager.webhooks?.constructor.name || 'N/A'}`,
                inline: true
            });
        } else {
            embed.addFields({
                name: '🎫 TicketManager',
                value: '❌ Não inicializado',
                inline: true
            });
        }

        // Storage
        const storage = client.storage;
        embed.addFields({
            name: '💾 Storage',
            value: storage ? '✅ Disponível' : '❌ Não encontrado',
            inline: true
        });

        // Client info
        embed.addFields({
            name: '🤖 Client',
            value: `Guilds: ${client.guilds.cache.size}\nUsuário: ${client.user?.tag || 'N/A'}`,
            inline: true
        });

        await interaction.editReply({ embeds: [embed] });
    },
};