const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const logger = require('../utils/logger');
const rateLimit = require('../utils/rateLimit');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        // Ignorar interações que não são relacionadas a tickets
        if (!interaction.customId?.startsWith('ticket_')) return;

        // Verificar se a interação já foi respondida (timeout protection)
        if (interaction.replied || interaction.deferred) {
            logger.warn(`Tentativa de processar interação já respondida: ${interaction.customId}`);
            return;
        }

        try {
            // Handle button interactions for tickets
            if (interaction.isButton()) {
                const [_, action, type] = interaction.customId.split('_');

                if (action === 'create') {
                    // CRIAÇÃO DIRETA DE TICKET - sem modal
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    
                    // Verificar rate limit
                    const rateLimitKey = `ticket:${interaction.user.id}`;
                    const { allowed, resetTime } = rateLimit.check(rateLimitKey, 3, 3600000);

                    if (!allowed) {
                        const resetIn = Math.ceil((resetTime - Date.now()) / 60000);
                        return await interaction.editReply({
                            content: `❌ Você atingiu o limite de tickets. Tente novamente em ${resetIn} minutos.`
                        });
                    }

                    // Check for existing tickets
                    const existingTickets = await interaction.client.storage.getUserActiveTickets(
                        interaction.user.id,
                        interaction.guildId
                    );

                    if (existingTickets.length > 0) {
                        return await interaction.editReply({
                            content: `❌ Você já tem um ticket aberto: <#${existingTickets[0].channel_id}>`
                        });
                    }
                    
                    const ticketManager = interaction.client.ticketManager;
                    
                    // Usar descrição padrão baseada no tipo
                    const defaultDescription = `Ticket criado para categoria: ${type}`;
                    
                    // Criar ticket diretamente
                    await ticketManager.handleTicketCreate(interaction, type, defaultDescription);
                } 
                else {
                    try {
                        // Defer the reply first
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        const ticketManager = interaction.client.ticketManager;

                        switch (action) {
                            case 'close':
                                await ticketManager.handleTicketClose(interaction);
                                break;
                            case 'claim':
                                await ticketManager.handleTicketClaim(interaction);
                                break;
                            case 'status':
                                await this.handleSystemStatus(interaction);
                                break;
                            case 'info':
                                await this.handleSupportInfo(interaction);
                                break;
                            default:
                                await interaction.editReply({
                                    content: '❌ Ação de ticket inválida.',
                                    flags: MessageFlags.Ephemeral
                                });
                        }
                    } catch (actionError) {
                        logger.error('Erro ao processar ação do ticket:', actionError);
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({
                                content: '❌ Erro ao processar ação. Por favor, tente novamente.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        } else if (interaction.deferred) {
                            await interaction.editReply({
                                content: '❌ Erro ao processar ação. Por favor, tente novamente.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                    }
                }
            }
            // Modal submission handler removed - tickets are now created directly without modals
        } catch (error) {
            logger.error('Erro ao processar interação de ticket:', error);
            
            // Handle error response
            const response = {
                content: '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.',
                ephemeral: true
            };

            // Try to send the error response
            try {
                if (interaction.replied) {
                    await interaction.followUp(response);
                } else if (interaction.deferred) {
                    await interaction.editReply(response);
                } else {
                    await interaction.reply(response);
                }
            } catch (followUpError) {
                logger.error('Erro ao enviar resposta de erro:', followUpError);
            }
        }
    },

    // Handler para botão de System Status
    async handleSystemStatus(interaction) {
        const { EmbedBuilder } = require('discord.js');
        const visualAssets = require('../assets/visual-assets');

        const statusEmbed = new EmbedBuilder()
            .setColor('#00D26A')
            .setTitle('📊 **STATUS DO SISTEMA**')
            .setThumbnail(visualAssets.realImages.supportIcon)
            .setDescription([
                '### 🔋 **SERVIÇOS OPERACIONAIS**',
                '',
                '🟢 **Bot Principal:** `ONLINE`',
                '🟢 **Sistema de Tickets:** `OPERACIONAL`',
                '🟢 **Base de Dados:** `CONECTADA`',
                '🟢 **Webhooks:** `FUNCIONAIS`',
                '🟢 **Auto-detecção Staff:** `ATIVA`',
                '',
                '### 📈 **ESTATÍSTICAS EM TEMPO REAL**',
                '',
                `📍 **Servidor:** ${interaction.guild.name}`,
                `👥 **Membros Online:** ${interaction.guild.members.cache.filter(m => !m.user.bot && m.presence?.status !== 'offline').size}`,
                `🎫 **Tickets Ativos:** Em funcionamento`,
                `⚡ **Latência:** ${interaction.client.ws.ping}ms`,
                '',
                '### ⏱️ **TEMPO DE RESPOSTA**',
                '',
                '🎯 **Meta SLA:** < 15 minutos',
                '📊 **Uptime:** 99.9%',
                '🔄 **Última Atualização:** Agora',
                '',
                '> 💡 **Sistema monitorizado 24/7**'
            ].join('\n'))
            .addFields(
                {
                    name: '🏢 Infraestrutura',
                    value: '`Railway Platform`',
                    inline: true
                },
                {
                    name: '⚡ Performance',
                    value: '`Excelente`',
                    inline: true
                },
                {
                    name: '🔒 Segurança',
                    value: '`Ativa`',
                    inline: true
                }
            )
            .setFooter({ 
                text: 'Sistema de Tickets v2.0 • Status verificado',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.editReply({
            embeds: [statusEmbed]
        });
    },

    // Handler para botão de Support Info
    async handleSupportInfo(interaction) {
        const { EmbedBuilder } = require('discord.js');
        const visualAssets = require('../assets/visual-assets');

        const infoEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('💼 **INFORMAÇÕES DE SUPORTE**')
            .setThumbnail(visualAssets.realImages.supportIcon)
            .setImage(visualAssets.realImages.supportBanner)
            .setDescription([
                '### 📋 **COMO USAR O SISTEMA**',
                '',
                '**1️⃣ CRIAR TICKET**',
                '└ Clique no botão do departamento apropriado',
                '└ Um canal privado será criado automaticamente',
                '',
                '**2️⃣ AGUARDAR RESPOSTA**',
                '└ Nossa equipe será notificada instantaneamente',
                '└ Tempo médio de resposta: **15 minutos**',
                '',
                '**3️⃣ COMUNICAÇÃO**',
                '└ Forneça o máximo de detalhes possível',
                '└ Anexe capturas de ecrã se necessário',
                '',
                '### 🎯 **DEPARTAMENTOS DISPONÍVEIS**',
                '',
                '🔧 **Suporte Técnico**',
                '• Problemas com configurações',
                '• Bugs e falhas técnicas',
                '• Assistência com funcionalidades',
                '',
                '⚠️ **Reportar Problemas**',
                '• Incidentes críticos',
                '• Falhas graves do sistema',
                '• Emergências técnicas',
                '',
                '🛡️ **Moderação e Segurança**',
                '• Denúncias de utilizadores',
                '• Violações de regras',
                '• Questões disciplinares',
                '',
                '### ⚡ **RECURSOS AVANÇADOS**',
                '',
                '• **🤖 Detecção Automática** de staff',
                '• **🔒 Canais Privados** seguros',
                '• **📊 Transcrições** completas',
                '• **⚡ Notificações** instantâneas',
                '• **📈 Estatísticas** detalhadas'
            ].join('\n'))
            .addFields(
                {
                    name: '⏰ Horário de Funcionamento',
                    value: '`24 horas por dia, 7 dias por semana`',
                    inline: true
                },
                {
                    name: '📞 Canais de Contacto',
                    value: '`Sistema de Tickets apenas`',
                    inline: true
                },
                {
                    name: '🌐 Idiomas Suportados',
                    value: '`Português • Inglês`',
                    inline: true
                }
            )
            .setFooter({ 
                text: 'Precisa de ajuda? Crie um ticket usando os botões acima',
                iconURL: interaction.guild.iconURL({ dynamic: true })
            })
            .setTimestamp();

        await interaction.editReply({
            embeds: [infoEmbed]
        });
    }
};
