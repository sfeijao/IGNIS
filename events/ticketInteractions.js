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
            // Handle modal submissions for tickets
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'ticket_add_user_modal') {
                    await handleAddUserModal(interaction);
                    return;
                } else if (interaction.customId === 'ticket_remove_user_modal') {
                    await handleRemoveUserModal(interaction);
                    return;
                }
            }

            // Handle select menu interactions for tickets
            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'ticket_priority_select') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    await handlePrioritySelection(interaction);
                    return;
                }
            }

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
                else {
                    try {
                        const ticketManager = interaction.client.ticketManager;
                        
                        // Ações que precisam de modal (não fazer defer)
                        if ((action === 'add' && type === 'user') || (action === 'remove' && type === 'user')) {
                            switch (action) {
                                case 'add':
                                    if (type === 'user') await handleAddUser(interaction);
                                    break;
                                case 'remove':
                                    if (type === 'user') await handleRemoveUser(interaction);
                                    break;
                            }
                        } else {
                            // Defer the reply first para outras ações
                            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
                                case 'rename':
                                    await handleTicketRename(interaction);
                                    break;
                                default:
                                    await interaction.editReply({
                                        content: '❌ Ação de ticket inválida.',
                                        flags: MessageFlags.Ephemeral
                                    });
                            }
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
        .setDescription('⏳ Coletando mensagens do ticket...\n\nProcesso iniciado, aguarde...')
        .setTimestamp();

    await interaction.editReply({
        embeds: [embed]
    });

    try {
        const channel = interaction.channel;
        const messages = await channel.messages.fetch({ limit: 100 });
        const messageArray = Array.from(messages.values()).reverse();
        
        // Criar transcrição em texto
        let transcript = `=== TRANSCRIÇÃO DO TICKET ===\n`;
        transcript += `Canal: ${channel.name}\n`;
        transcript += `ID do Canal: ${channel.id}\n`;
        transcript += `Gerado em: ${new Date().toLocaleString('pt-PT')}\n`;
        transcript += `Gerado por: ${interaction.user.tag}\n`;
        transcript += `Total de Mensagens: ${messageArray.length}\n`;
        transcript += `\n${'='.repeat(50)}\n\n`;
        
        const participants = new Set();
        
        for (const message of messageArray) {
            const timestamp = message.createdAt.toLocaleString('pt-PT');
            const author = message.author.tag;
            participants.add(author);
            
            transcript += `[${timestamp}] ${author}: `;
            
            if (message.content) {
                transcript += message.content;
            }
            
            if (message.embeds.length > 0) {
                transcript += ' [EMBED]';
                for (const embed of message.embeds) {
                    if (embed.title) transcript += ` Título: ${embed.title}`;
                    if (embed.description) transcript += ` Descrição: ${embed.description}`;
                }
            }
            
            if (message.attachments.size > 0) {
                transcript += ' [ANEXOS: ';
                transcript += Array.from(message.attachments.values()).map(att => att.name).join(', ');
                transcript += ']';
            }
            
            transcript += '\n';
        }
        
        transcript += `\n${'='.repeat(50)}\n`;
        transcript += `Participantes (${participants.size}): ${Array.from(participants).join(', ')}\n`;
        transcript += `Fim da transcrição`;
        
        // Criar arquivo
        const fs = require('fs');
        const path = require('path');
        
        const fileName = `transcript-${channel.name}-${Date.now()}.txt`;
        const filePath = path.join(__dirname, '..', 'logs', fileName);
        
        // Garantir que o diretório existe
        const logDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, transcript, 'utf8');
        
        // Calcular estatísticas
        const startTime = messageArray[0]?.createdAt || new Date();
        const endTime = messageArray[messageArray.length - 1]?.createdAt || new Date();
        const duration = Math.abs(endTime - startTime);
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        
        const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Transcrição Gerada')
            .setDescription('A transcrição do ticket foi gerada com sucesso!')
            .addFields(
                { 
                    name: '📊 Estatísticas', 
                    value: `**Mensagens:** ${messageArray.length}\n**Participantes:** ${participants.size}\n**Duração:** ${hours}h ${minutes}m`, 
                    inline: true 
                },
                { 
                    name: '📅 Período', 
                    value: `**Início:** <t:${Math.floor(startTime.getTime() / 1000)}:f>\n**Fim:** <t:${Math.floor(endTime.getTime() / 1000)}:f>`, 
                    inline: true 
                },
                {
                    name: '📄 Arquivo',
                    value: `**Nome:** \`${fileName}\`\n**Tamanho:** ${(transcript.length / 1024).toFixed(2)} KB`,
                    inline: false
                }
            )
            .setTimestamp();

        await interaction.followUp({
            embeds: [successEmbed],
            files: [{
                attachment: filePath,
                name: fileName
            }],
            flags: MessageFlags.Ephemeral
        });
        
        // Log da operação
        logger.info(`📄 Transcrição gerada para ticket ${channel.id} por ${interaction.user.tag} - ${messageArray.length} mensagens`);
        
        // Limpar arquivo após 10 segundos (opcional)
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.info(`🗑️ Arquivo de transcrição temporário removido: ${fileName}`);
            }
        }, 10000);
        
    } catch (error) {
        logger.error('Erro ao gerar transcrição:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Erro na Transcrição')
            .setDescription('Ocorreu um erro ao gerar a transcrição do ticket.')
            .addFields(
                { name: '🐛 Erro', value: error.message || 'Erro desconhecido', inline: false }
            )
            .setTimestamp();

        await interaction.followUp({
            embeds: [errorEmbed],
            flags: MessageFlags.Ephemeral
        });
    }
}

// Handler para adicionar utilizador ao ticket
async function handleAddUser(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('ticket_add_user_modal')
        .setTitle('➕ Adicionar Utilizador ao Ticket');

    const userInput = new TextInputBuilder()
        .setCustomId('user_id_input')
        .setLabel('ID ou Menção do Utilizador')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('@utilizador ou 123456789012345678')
        .setRequired(true)
        .setMaxLength(100);

    const reasonInput = new TextInputBuilder()
        .setCustomId('reason_input')
        .setLabel('Motivo (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Motivo para adicionar o utilizador...')
        .setRequired(false)
        .setMaxLength(200);

    const firstRow = new ActionRowBuilder().addComponents(userInput);
    const secondRow = new ActionRowBuilder().addComponents(reasonInput);
    
    modal.addComponents(firstRow, secondRow);
    
    await interaction.showModal(modal);
}

// Handler para remover utilizador do ticket
async function handleRemoveUser(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('ticket_remove_user_modal')
        .setTitle('➖ Remover Utilizador do Ticket');

    const userInput = new TextInputBuilder()
        .setCustomId('user_id_input')
        .setLabel('ID ou Menção do Utilizador')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('@utilizador ou 123456789012345678')
        .setRequired(true)
        .setMaxLength(100);

    const reasonInput = new TextInputBuilder()
        .setCustomId('reason_input')
        .setLabel('Motivo (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Motivo para remover o utilizador...')
        .setRequired(false)
        .setMaxLength(200);

    const firstRow = new ActionRowBuilder().addComponents(userInput);
    const secondRow = new ActionRowBuilder().addComponents(reasonInput);
    
    modal.addComponents(firstRow, secondRow);
    
    await interaction.showModal(modal);
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

// Handler para seleção de prioridade
async function handlePrioritySelection(interaction) {
    const selectedPriority = interaction.values[0];
    
    const priorityMap = {
        'high': { emoji: '🔴', name: 'Alta Prioridade', color: 0xFF0000 },
        'normal': { emoji: '🟡', name: 'Prioridade Normal', color: 0xFFD700 },
        'low': { emoji: '🟢', name: 'Baixa Prioridade', color: 0x00FF00 }
    };

    const priority = priorityMap[selectedPriority];
    
    if (!priority) {
        return await interaction.editReply({
            content: '❌ Prioridade inválida selecionada.',
            flags: MessageFlags.Ephemeral
        });
    }

    // Atualizar o nome do canal se possível
    try {
        const channel = interaction.channel;
        const currentName = channel.name;
        
        // Remover indicadores de prioridade antigos
        let newName = currentName.replace(/^(🔴|🟡|🟢)/, '');
        
        // Adicionar novo indicador de prioridade
        newName = `${priority.emoji}${newName}`;
        
        await channel.setName(newName);
        
        const successEmbed = new EmbedBuilder()
            .setColor(priority.color)
            .setTitle('⚡ Prioridade Atualizada')
            .setDescription(`A prioridade do ticket foi alterada para **${priority.name}**`)
            .addFields(
                { name: '🎯 Nova Prioridade', value: `${priority.emoji} ${priority.name}`, inline: true },
                { name: '🏷️ Canal Atualizado', value: `${priority.emoji} Nome do canal atualizado`, inline: true },
                { name: '⏰ Alterado em', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({
            embeds: [successEmbed]
        });

        // Log da alteração de prioridade
        logger.info(`🎯 Prioridade do ticket ${channel.id} alterada para ${priority.name} por ${interaction.user.tag}`);
        
    } catch (error) {
        logger.error('Erro ao alterar prioridade:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Erro ao Alterar Prioridade')
            .setDescription('Não foi possível alterar o nome do canal, mas a prioridade foi registrada.')
            .addFields(
                { name: '🎯 Prioridade Selecionada', value: `${priority.emoji} ${priority.name}`, inline: true }
            );

        await interaction.editReply({
            embeds: [errorEmbed]
        });
    }
}

// Handler para modal de adicionar utilizador
async function handleAddUserModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const userInput = interaction.fields.getTextInputValue('user_id_input');
    const reason = interaction.fields.getTextInputValue('reason_input') || 'Sem motivo especificado';
    
    try {
        // Extrair ID do utilizador (remover <@> se for menção)
        const userId = userInput.replace(/[<@!>]/g, '');
        
        // Validar se é um ID válido
        if (!/^\d{17,19}$/.test(userId)) {
            return await interaction.editReply({
                content: '❌ ID de utilizador inválido. Use um ID válido ou mencione o utilizador.',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Buscar o membro
        const guild = interaction.guild;
        const member = await guild.members.fetch(userId).catch(() => null);
        
        if (!member) {
            return await interaction.editReply({
                content: '❌ Utilizador não encontrado neste servidor.',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Verificar se já tem acesso
        const channel = interaction.channel;
        const permissions = channel.permissionsFor(member);
        
        if (permissions && permissions.has('ViewChannel')) {
            return await interaction.editReply({
                content: `❌ ${member.user.tag} já tem acesso a este ticket.`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Adicionar permissões
        await channel.permissionOverwrites.edit(member, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true
        });
        
        // Enviar mensagem de confirmação
        const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('➕ Utilizador Adicionado')
            .setDescription(`${member.user.tag} foi adicionado ao ticket com sucesso!`)
            .addFields(
                { name: '👤 Utilizador', value: `${member.user.tag} (${member.user.id})`, inline: true },
                { name: '🎯 Motivo', value: reason, inline: true },
                { name: '⏰ Adicionado em', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        
        await interaction.editReply({
            embeds: [successEmbed]
        });
        
        // Mensagem no canal do ticket
        await channel.send({
            content: `🎯 ${member} foi adicionado ao ticket por ${interaction.user}`,
            embeds: [new EmbedBuilder()
                .setColor(0x00FF00)
                .setDescription(`**Motivo:** ${reason}`)
                .setTimestamp()
            ]
        });
        
        logger.info(`➕ Utilizador ${member.user.tag} adicionado ao ticket ${channel.id} por ${interaction.user.tag}`);
        
    } catch (error) {
        logger.error('Erro ao adicionar utilizador ao ticket:', error);
        await interaction.editReply({
            content: '❌ Erro ao adicionar utilizador. Verifique as permissões do bot.',
            flags: MessageFlags.Ephemeral
        });
    }
}

// Handler para modal de remover utilizador
async function handleRemoveUserModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const userInput = interaction.fields.getTextInputValue('user_id_input');
    const reason = interaction.fields.getTextInputValue('reason_input') || 'Sem motivo especificado';
    
    try {
        // Extrair ID do utilizador
        const userId = userInput.replace(/[<@!>]/g, '');
        
        // Validar ID
        if (!/^\d{17,19}$/.test(userId)) {
            return await interaction.editReply({
                content: '❌ ID de utilizador inválido. Use um ID válido ou mencione o utilizador.',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Buscar o membro
        const guild = interaction.guild;
        const member = await guild.members.fetch(userId).catch(() => null);
        
        if (!member) {
            return await interaction.editReply({
                content: '❌ Utilizador não encontrado neste servidor.',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Verificar se tem acesso
        const channel = interaction.channel;
        const permissions = channel.permissionsFor(member);
        
        if (!permissions || !permissions.has('ViewChannel')) {
            return await interaction.editReply({
                content: `❌ ${member.user.tag} não tem acesso a este ticket.`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Remover permissões
        await channel.permissionOverwrites.delete(member);
        
        // Enviar mensagem de confirmação
        const successEmbed = new EmbedBuilder()
            .setColor(0xFF6B6B)
            .setTitle('➖ Utilizador Removido')
            .setDescription(`${member.user.tag} foi removido do ticket com sucesso!`)
            .addFields(
                { name: '👤 Utilizador', value: `${member.user.tag} (${member.user.id})`, inline: true },
                { name: '🎯 Motivo', value: reason, inline: true },
                { name: '⏰ Removido em', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
        
        await interaction.editReply({
            embeds: [successEmbed]
        });
        
        // Mensagem no canal do ticket
        const removalEmbed = new EmbedBuilder()
            .setColor(0xFF6B6B)
            .setTitle('🚫 Utilizador Removido do Ticket')
            .setDescription([
                `### � **${member.user.tag}** foi removido do sistema de suporte`,
                '',
                `**🔒 Acesso revogado:** O utilizador já não pode ver nem participar neste ticket`,
                `**👮 Removido por:** ${interaction.user.tag}`,
                `**📝 Motivo:** ${reason}`,
                `**⏰ Data/Hora:** <t:${Math.floor(Date.now() / 1000)}:f>`,
                '',
                '> *Esta ação foi registrada no sistema de logs para auditoria*'
            ].join('\n'))
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: '🛡️ Sistema de Gestão de Tickets | Ação de Moderação',
                iconURL: interaction.guild.iconURL({ dynamic: true })
            })
            .setTimestamp();

        await channel.send({
            embeds: [removalEmbed]
        });
        
        logger.info(`➖ Utilizador ${member.user.tag} removido do ticket ${channel.id} por ${interaction.user.tag}`);
        
    } catch (error) {
        logger.error('Erro ao remover utilizador do ticket:', error);
        await interaction.editReply({
            content: '❌ Erro ao remover utilizador. Verifique as permissões do bot.',
            flags: MessageFlags.Ephemeral
        });
    }
}
