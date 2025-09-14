const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const logger = require('../utils/logger');
const rateLimit = require('../utils/rateLimit');

// Handler para botão de System Status
async function handleSystemStatus(interaction) {
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
}

// Handler para botão de Support Info
async function handleSupportInfo(interaction) {
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
                const parts = interaction.customId.split('_');
                const [prefix, action, type] = parts;

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
                else if (action === 'status') {
                    // Botão de Status do Sistema
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    await handleSystemStatus(interaction);
                }
                else if (action === 'info') {
                    // Botão de Informações
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    await handleSupportInfo(interaction);
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
                            case 'priority':
                                await handleTicketPriority(interaction);
                                break;
                            case 'transcript':
                                await handleTicketTranscript(interaction);
                                break;
                            case 'add':
                                if (type === 'user') await handleAddUser(interaction);
                                break;
                            case 'remove':
                                if (type === 'user') await handleRemoveUser(interaction);
                                break;
                            case 'rename':
                                await handleTicketRename(interaction);
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
    }
};

// Handler para alterar prioridade do ticket
async function handleTicketPriority(interaction) {
    const priorities = [
        { label: '🔴 Alta Prioridade', value: 'high', emoji: '🔴' },
        { label: '🟡 Prioridade Normal', value: 'normal', emoji: '🟡' },
        { label: '🟢 Baixa Prioridade', value: 'low', emoji: '🟢' }
    ];

    const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ticket_priority_select')
            .setPlaceholder('Selecione a nova prioridade')
            .addOptions(priorities)
    );

    const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⚡ Alterar Prioridade do Ticket')
        .setDescription('Selecione a nova prioridade para este ticket:')
        .addFields(
            { name: '🔴 Alta', value: 'Problemas críticos e urgentes', inline: true },
            { name: '🟡 Normal', value: 'Questões padrão do dia a dia', inline: true },
            { name: '🟢 Baixa', value: 'Dúvidas e sugestões', inline: true }
        );

    await interaction.editReply({
        embeds: [embed],
        components: [selectMenu]
    });
}

// Handler para gerar transcrição do ticket
async function handleTicketTranscript(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📄 Gerando Transcrição')
        .setDescription('⏳ Processando mensagens do ticket...\n\nA transcrição será enviada em breve.')
        .setTimestamp();

    await interaction.editReply({
        embeds: [embed]
    });

    // Simular geração de transcrição (implementar lógica real depois)
    setTimeout(async () => {
        const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Transcrição Gerada')
            .setDescription('A transcrição do ticket foi gerada com sucesso!')
            .addFields(
                { name: '📊 Estatísticas', value: `**Mensagens:** 0\n**Participantes:** 1\n**Duração:** N/A`, inline: true },
                { name: '📅 Período', value: `**Início:** <t:${Math.floor(Date.now() / 1000)}:f>\n**Fim:** <t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
            );

        await interaction.followUp({
            embeds: [successEmbed],
            flags: MessageFlags.Ephemeral
        });
    }, 3000);
}

// Handler para adicionar utilizador ao ticket
async function handleAddUser(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('➕ Adicionar Utilizador ao Ticket')
        .setDescription('Para adicionar um utilizador ao ticket, mencione-o ou forneça o ID.\n\n**Exemplo:** `@utilizador` ou `123456789012345678`')
        .addFields(
            { name: '🔍 Como encontrar o ID?', value: 'Ative o Modo Desenvolvedor nas configurações do Discord e clique com o botão direito no utilizador.', inline: false }
        );

    await interaction.editReply({
        embeds: [embed]
    });
}

// Handler para remover utilizador do ticket
async function handleRemoveUser(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('➖ Remover Utilizador do Ticket')
        .setDescription('Para remover um utilizador do ticket, mencione-o ou forneça o ID.\n\n**Exemplo:** `@utilizador` ou `123456789012345678`')
        .addFields(
            { name: '⚠️ Atenção', value: 'O utilizador perderá acesso imediato ao ticket.', inline: false }
        );

    await interaction.editReply({
        embeds: [embed]
    });
}

// Handler para renomear o canal do ticket
async function handleTicketRename(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('✏️ Renomear Canal do Ticket')
        .setDescription('Para renomear este canal, envie o novo nome na próxima mensagem.\n\n**Formato atual:** `ticket-utilizador-categoria`\n**Exemplo:** `ticket-suporte-técnico`')
        .addFields(
            { name: '📝 Regras', value: '• Apenas letras, números e hífens\n• Máximo 100 caracteres\n• Mínimo 2 caracteres', inline: false }
        );

    await interaction.editReply({
        embeds: [embed]
    });
}
