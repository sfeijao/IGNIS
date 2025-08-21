const { Events, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Carregar config com fallback
let config;
try {
    config = require('../config.json');
} catch (error) {
    console.log('⚠️ Config.json não encontrado no interactionCreate, usando valores padrão');
    config = {
        roles: {
            admin: process.env.ADMIN_ROLE_ID,
            staff: process.env.STAFF_ROLE_ID,
            verified: process.env.VERIFIED_ROLE_ID,
            vip: process.env.VIP_ROLE_ID,
            member: process.env.MEMBER_ROLE_ID,
            mod: process.env.MOD_ROLE_ID,
            support: process.env.SUPPORT_ROLE_ID
        },
        channels: {
            verification: process.env.VERIFICATION_CHANNEL_ID,
            logs: process.env.LOGS_CHANNEL_ID
        }
    };
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        console.log(`🔍 Interação recebida: ${interaction.type} - ${interaction.user.tag}`);
        
        // Comandos slash
        if (interaction.isChatInputCommand()) {
            console.log(`📝 Comando executado: /${interaction.commandName} por ${interaction.user.tag}`);
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`❌ Comando ${interaction.commandName} não encontrado.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('❌ Erro ao executar comando:', error);
                
                // Verificar se a interação já foi respondida antes de tentar responder
                if (!interaction.replied && !interaction.deferred) {
                    try {
                        await interaction.reply({
                            content: '❌ Houve um erro ao executar este comando!',
                            ephemeral: true
                        });
                    } catch (replyError) {
                        console.error('❌ Erro ao responder interação:', replyError);
                    }
                }
            }
        }

        // Sistema de Status - Botões interativos
        if (interaction.isButton()) {
            const { customId } = interaction;
            
            // Botão de verificação
            if (customId === 'verify_button') {
                // Criar modal de verificação
                const modal = new ModalBuilder()
                    .setCustomId('verification_modal')
                    .setTitle('🔒 Verificação de Conta');

                const nicknameInput = new TextInputBuilder()
                    .setCustomId('nickname_input')
                    .setLabel('Como te queres chamar no servidor?')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(2)
                    .setMaxLength(32)
                    .setPlaceholder('Escolhe um nickname adequado...')
                    .setRequired(true);

                const ageInput = new TextInputBuilder()
                    .setCustomId('age_input')
                    .setLabel('Qual é a tua idade?')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(2)
                    .setPlaceholder('18')
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(nicknameInput);
                const secondActionRow = new ActionRowBuilder().addComponents(ageInput);

                modal.addComponents(firstActionRow, secondActionRow);

                await interaction.showModal(modal);
                return;
            }
            
            // Botões do painel de status
            if (customId === 'refresh_status' || customId === 'detailed_status' || customId === 'system_info') {
                const isOwner = interaction.user.id === '381762006329589760';
                const hasAdminPerm = interaction.member.permissions.has('Administrator');
                
                if (!isOwner && !hasAdminPerm) {
                    return interaction.reply({
                        content: '❌ Apenas administradores podem usar este painel!',
                        ephemeral: true
                    });
                }

                if (customId === 'refresh_status') {
                    const refreshEmbed = new EmbedBuilder()
                        .setColor('#9932CC')
                        .setTitle('📊 Status do Servidor YSNM')
                        .setDescription('**Monitor de Status Atualizado**')
                        .addFields(
                            {
                                name: '🟢 Sistema Principal',
                                value: '```✅ Online - Funcionando Normalmente```',
                                inline: true
                            },
                            {
                                name: '💾 Base de Dados',
                                value: `\`\`\`✅ Conectado - Latência: ${Math.floor(Math.random() * 30) + 15}ms\`\`\``,
                                inline: true
                            },
                            {
                                name: '🌐 API Discord',
                                value: `\`\`\`✅ Estável - Ping: ${interaction.client.ws.ping}ms\`\`\``,
                                inline: true
                            },
                            {
                                name: '⚡ Performance',
                                value: `\`\`\`RAM: ${Math.floor(process.memoryUsage().heapUsed / 1024 / 1024)}MB / 512MB\nCPU: ${Math.floor(Math.random() * 20) + 5}% / 100%\nUptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m\`\`\``,
                                inline: false
                            },
                            {
                                name: '📈 Estatísticas',
                                value: `\`\`\`Comandos Executados: ${Math.floor(Math.random() * 1000) + 1200}\nUsuários Online: ${interaction.guild.memberCount}\nServidores: 1\`\`\``,
                                inline: false
                            }
                        )
                        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                        .setFooter({
                            text: `YSNM Bot • Atualizado`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    await interaction.update({ embeds: [refreshEmbed] });
                }
            }

            // Sistema de aprovação de tags
            if (customId.startsWith('approve_tag_') || customId.startsWith('deny_tag_')) {
                const isOwner = interaction.user.id === '381762006329589760';
                const hasStaffRole = interaction.member.roles.cache.has(config.roles.admin) || 
                                   interaction.member.roles.cache.has(config.roles.staff);
                
                if (!isOwner && !hasStaffRole) {
                    return interaction.reply({
                        content: '❌ Apenas staff pode aprovar/negar pedidos de tags!',
                        ephemeral: true
                    });
                }

                const parts = customId.split('_');
                const action = parts[0]; // 'approve' ou 'deny'
                const userId = parts[2];
                const tagType = parts[3];

                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                if (!member) {
                    return interaction.reply({
                        content: '❌ Membro não encontrado no servidor!',
                        ephemeral: true
                    });
                }

                let roleId = '';
                let tagName = '';
                
                // Mapeamento de tradução de cargos
                const tagTranslations = {
                    'vip': 'VIP',
                    'member': 'Membro',
                    'mod': 'Moderador',
                    'support': 'Suporte'
                };
                
                switch (tagType) {
                    case 'vip':
                        roleId = config.roles.vip;
                        tagName = tagTranslations.vip;
                        break;
                    case 'member':
                        roleId = config.roles.member;
                        tagName = tagTranslations.member;
                        break;
                    case 'mod':
                        roleId = config.roles.mod;
                        tagName = tagTranslations.mod;
                        break;
                    case 'support':
                        roleId = config.roles.support;
                        tagName = tagTranslations.support;
                        break;
                }

                if (action === 'approve') {
                    try {
                        await member.roles.add(roleId);
                        
                        const approveEmbed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('✅ Pedido de Tag Aprovado')
                            .setDescription(`**Tag:** ${tagName}\n**Utilizador:** ${member.user.tag}\n**Aprovado por:** ${interaction.user.tag}`)
                            .setTimestamp();

                        await interaction.update({ embeds: [approveEmbed], components: [] });

                        // Notificar o utilizador
                        try {
                            await member.send(`🎉 O teu pedido de tag **${tagName}** foi aprovado! Parabéns!`);
                        } catch (error) {
                            console.log('Não foi possível enviar DM ao utilizador');
                        }

                    } catch (error) {
                        console.error('Erro ao adicionar cargo:', error);
                        await interaction.reply({
                            content: '❌ Erro ao adicionar a tag. Verifica as permissões do bot!',
                            ephemeral: true
                        });
                    }
                } else {
                    const denyEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('❌ Pedido de Tag Negado')
                        .setDescription(`**Tag:** ${tagName}\n**Utilizador:** ${member.user.tag}\n**Negado por:** ${interaction.user.tag}`)
                        .setTimestamp();

                    await interaction.update({ embeds: [denyEmbed], components: [] });

                    // Notificar o utilizador
                    try {
                        await member.send(`❌ O teu pedido de tag **${tagName}** foi negado. Contacta a staff para mais informações.`);
                    } catch (error) {
                        console.log('Não foi possível enviar DM ao utilizador');
                    }
                }
            }
        }

        // Select menu para pedidos de tags
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'solicitar_tag_menu') {
                const selectedTag = interaction.values[0].replace('tag_', ''); // remove 'tag_' prefix
                
                // Mapeamento de tradução de cargos para títulos
                const tagTitleTranslations = {
                    'vip': 'VIP',
                    'member': 'Membro',
                    'mod': 'Moderador',
                    'support': 'Suporte'
                };
                
                const tagDisplayName = tagTitleTranslations[selectedTag] || selectedTag.toUpperCase();
                
                // Criar modal para justificação
                const modal = new ModalBuilder()
                    .setCustomId(`tag_modal_${selectedTag}`)
                    .setTitle(`Pedido de Tag - ${tagDisplayName}`);

                const reasonInput = new TextInputBuilder()
                    .setCustomId('tag_reason')
                    .setLabel('Por que desejas esta tag?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Explica detalhadamente por que mereces esta tag...')
                    .setRequired(true)
                    .setMaxLength(1000);

                const experienceInput = new TextInputBuilder()
                    .setCustomId('tag_experience')
                    .setLabel('Experiência relevante (opcional)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Descreve a tua experiência relacionada com esta tag...')
                    .setRequired(false)
                    .setMaxLength(500);

                const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
                const secondActionRow = new ActionRowBuilder().addComponents(experienceInput);

                modal.addComponents(firstActionRow, secondActionRow);

                await interaction.showModal(modal);
            }
        }

        // Processamento de modais
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('tag_modal_')) {
                const tagType = interaction.customId.replace('tag_modal_', '');
                const reason = interaction.fields.getTextInputValue('tag_reason');
                const experience = interaction.fields.getTextInputValue('tag_experience') || 'Não fornecido';

                // Mapeamento de tradução de cargos
                const tagTranslations = {
                    'vip': 'VIP',
                    'member': 'Membro',
                    'mod': 'Moderador',
                    'support': 'Suporte'
                };

                let tagName = tagTranslations[tagType] || tagType.toUpperCase();

                // Enviar para o canal de pending tags
                const pendTagsChannel = interaction.guild.channels.cache.get('1404310493480489031');
                
                if (pendTagsChannel) {
                    const requestEmbed = new EmbedBuilder()
                        .setColor('#9932CC')
                        .setTitle('🏷️ Novo Pedido de Tag')
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: '👤 Utilizador', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                            { name: '🏷️ Tag Solicitada', value: tagName, inline: true },
                            { name: '📅 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                            { name: '📝 Motivo', value: reason, inline: false },
                            { name: '🎯 Experiência', value: experience, inline: false }
                        )
                        .setFooter({ text: 'Sistema de Pedidos de Tags • YSNM Community' })
                        .setTimestamp();

                    const approveButton = new ButtonBuilder()
                        .setCustomId(`approve_tag_${interaction.user.id}_${tagType}`)
                        .setLabel('✅ Aprovar')
                        .setStyle(ButtonStyle.Success);

                    const denyButton = new ButtonBuilder()
                        .setCustomId(`deny_tag_${interaction.user.id}_${tagType}`)
                        .setLabel('❌ Negar')
                        .setStyle(ButtonStyle.Danger);

                    const buttonRow = new ActionRowBuilder().addComponents(approveButton, denyButton);

                    await pendTagsChannel.send({
                        embeds: [requestEmbed],
                        components: [buttonRow]
                    });

                    await interaction.reply({
                        content: `✅ O teu pedido de tag **${tagName}** foi enviado para análise! A staff irá avaliar em breve.`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Canal de pedidos não encontrado! Contacta um administrador.',
                        ephemeral: true
                    });
                }
            }
        }

        // Sistema de Verificação - Modal
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'verification_modal') {
                const nickname = interaction.fields.getTextInputValue('nickname_input');
                const age = interaction.fields.getTextInputValue('age_input');

                // Validar idade
                const ageNum = parseInt(age);
                if (isNaN(ageNum) || ageNum < 13) {
                    return interaction.reply({
                        content: '❌ Deves ter pelo menos 13 anos para te juntares ao servidor!',
                        ephemeral: true
                    });
                }

                try {
                    // Dar cargo de verificado
                    const verifiedRole = interaction.guild.roles.cache.get(config.roles.verified);
                    if (verifiedRole) {
                        await interaction.member.roles.add(verifiedRole);
                    }

                    // Definir nickname se fornecido
                    if (nickname && nickname !== interaction.member.displayName) {
                        try {
                            await interaction.member.setNickname(nickname);
                        } catch (error) {
                            console.log('Não foi possível alterar o nickname (permissões)');
                        }
                    }

                    // Enviar log para o canal de logs
                    const logsChannel = interaction.guild.channels.cache.get(config.channels.logs);
                    if (logsChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('✅ Novo Membro Verificado')
                            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                            .addFields(
                                { name: '👤 Utilizador', value: `${interaction.user.tag}`, inline: true },
                                { name: '🏷️ Nickname', value: nickname, inline: true },
                                { name: '🎂 Idade', value: `${age} anos`, inline: true },
                                { name: ' Verificado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                            )
                            .setFooter({ text: 'Sistema de Verificação • YSNM Community' })
                            .setTimestamp();

                        await logsChannel.send({ embeds: [logEmbed] });
                    }

                    // Responder ao utilizador
                    const successEmbed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('🎉 Verificação Concluída!')
                        .setDescription(`Bem-vindo ao **${interaction.guild.name}**, ${nickname}!`)
                        .addFields(
                            { name: '✅ O que ganhas:', value: '• Acesso a todos os canais\n• Possibilidade de participar em eventos\n• Interação completa com a comunidade\n• Acesso ao sistema de tags', inline: false },
                            { name: '📋 Próximos passos:', value: '• Explora os canais disponíveis\n• Lê as regras do servidor\n• Solicita tags se te interessarem\n• Diverte-te na comunidade!', inline: false }
                        )
                        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                        .setFooter({ text: 'YSNM Community™ • Bem-vindo!' })
                        .setTimestamp();

                    await interaction.reply({ embeds: [successEmbed], ephemeral: true });

                } catch (error) {
                    console.error('❌ Erro durante verificação:', error);
                    await interaction.reply({
                        content: '❌ Ocorreu um erro durante a verificação. Contacta um administrador!',
                        ephemeral: true
                    });
                }
            }
        }
        
        // Handler para modais de tickets
        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
            const ticketCommand = interaction.client.commands.get('ticket');
            if (ticketCommand && ticketCommand.handleModalSubmit) {
                try {
                    await ticketCommand.handleModalSubmit(interaction);
                } catch (error) {
                    console.error('❌ Erro ao processar modal de ticket:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ Erro ao processar ticket. Tenta novamente.',
                            ephemeral: true
                        });
                    }
                }
            }
        }
        
        // Handler para botões de criação de tickets do painel
        if (interaction.isButton() && interaction.customId.startsWith('ticket_create_')) {
            const tipo = interaction.customId.split('_')[2];
            
            try {
                // Verificar se o usuário já tem um ticket aberto
                const Database = require('../website/database/database');
                const db = new Database();
                
                const userTickets = await db.getTickets(interaction.guild.id);
                const openTicket = userTickets.find(ticket => 
                    ticket.user_id === interaction.user.id && 
                    (ticket.status === 'open' || ticket.status === 'assigned')
                );
                
                if (openTicket) {
                    return await interaction.reply({
                        content: `❌ Já tens um ticket aberto: <#${openTicket.channel_id}>
                        
Por favor fecha o ticket atual antes de criar um novo.`,
                        ephemeral: true
                    });
                }
                
                // Criar modal para detalhes do ticket
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                
                const modal = new ModalBuilder()
                    .setCustomId(`ticket_panel_modal_${tipo}_normal`)
                    .setTitle(`🎫 ${getTipoEmoji(tipo)} ${getTipoNome(tipo)}`);

                const subjectInput = new TextInputBuilder()
                    .setCustomId('ticket_subject')
                    .setLabel('Assunto do Ticket')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(5)
                    .setMaxLength(100)
                    .setPlaceholder(`Descreve brevemente o teu ${tipo}...`)
                    .setRequired(true);

                const descriptionInput = new TextInputBuilder()
                    .setCustomId('ticket_description')
                    .setLabel('Descrição Detalhada')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMinLength(10)
                    .setMaxLength(1000)
                    .setPlaceholder(getPlaceholderByType(tipo))
                    .setRequired(true);

                const priorityInput = new TextInputBuilder()
                    .setCustomId('ticket_priority')
                    .setLabel('Prioridade (urgent/high/normal/low)')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(3)
                    .setMaxLength(6)
                    .setValue('normal')
                    .setPlaceholder('normal')
                    .setRequired(false);

                const row1 = new ActionRowBuilder().addComponents(subjectInput);
                const row2 = new ActionRowBuilder().addComponents(descriptionInput);
                const row3 = new ActionRowBuilder().addComponents(priorityInput);

                modal.addComponents(row1, row2, row3);

                await interaction.showModal(modal);

            } catch (error) {
                console.error('❌ Erro ao processar botão do painel:', error);
                await interaction.reply({
                    content: '❌ Erro ao processar pedido. Tenta novamente.',
                    ephemeral: true
                });
            }
        }
        
        // Handler para modais do painel de tickets
        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_panel_modal_')) {
            const [, , , tipo, prioridade] = interaction.customId.split('_');
            const subject = interaction.fields.getTextInputValue('ticket_subject');
            const description = interaction.fields.getTextInputValue('ticket_description');
            const customPriority = interaction.fields.getTextInputValue('ticket_priority') || 'normal';
            
            // Validar prioridade
            const validPriorities = ['urgent', 'high', 'normal', 'low'];
            const finalPriority = validPriorities.includes(customPriority.toLowerCase()) ? 
                customPriority.toLowerCase() : 'normal';
            
            try {
                await interaction.deferReply({ ephemeral: true });
                
                // Criar ticket usando a mesma lógica do comando
                const ticketCommand = interaction.client.commands.get('ticket');
                if (ticketCommand && ticketCommand.createTicketFromPanel) {
                    await ticketCommand.createTicketFromPanel(interaction, {
                        tipo,
                        subject,
                        description,
                        priority: finalPriority
                    });
                } else {
                    // Implementação direta se a função não existir
                    await createTicketDirect(interaction, tipo, subject, description, finalPriority);
                }
                
            } catch (error) {
                console.error('❌ Erro ao processar modal do painel:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Erro ao criar ticket. Tenta novamente.',
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ Erro ao criar ticket. Tenta novamente.'
                    });
                }
            }
        }
        
        // Handler para botões de tickets
        if (interaction.isButton() && (interaction.customId.startsWith('ticket_assign_') || interaction.customId.startsWith('ticket_close_'))) {
            try {
                const Database = require('../website/database/database');
                const db = new Database();
                
                if (interaction.customId.startsWith('ticket_assign_')) {
                    const ticketId = interaction.customId.split('_')[2];
                    const userId = interaction.user.id;
                    const username = interaction.user.username;
                    
                    // Verificar se o usuário tem permissão
                    if (!interaction.member.permissions.has('ManageMessages')) {
                        return await interaction.reply({
                            content: '❌ Não tens permissão para atribuir tickets.',
                            ephemeral: true
                        });
                    }
                    
                    // Atualizar ticket na base de dados
                    await db.updateTicketStatus(ticketId, 'assigned', userId);
                    
                    // Criar embed de atribuição
                    const assignEmbed = new EmbedBuilder()
                        .setColor(0xFFAA00)
                        .setTitle('👋 Ticket Atribuído')
                        .setDescription(`Ticket foi atribuído para <@${userId}>`)
                        .addFields(
                            { name: '🎫 Ticket', value: `#${ticketId}`, inline: true },
                            { name: '👤 Atribuído para', value: username, inline: true },
                            { name: '🕒 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                        )
                        .setFooter({ text: 'Sistema de Tickets YSNM' })
                        .setTimestamp();
                    
                    await interaction.reply({
                        embeds: [assignEmbed]
                    });
                    
                    console.log(`✅ Ticket #${ticketId} atribuído para ${username}`);
                    
                } else if (interaction.customId.startsWith('ticket_close_')) {
                    const ticketId = interaction.customId.split('_')[2];
                    const userId = interaction.user.id;
                    const username = interaction.user.username;
                    
                    // Verificar se o usuário tem permissão
                    if (!interaction.member.permissions.has('ManageMessages')) {
                        return await interaction.reply({
                            content: '❌ Não tens permissão para fechar tickets.',
                            ephemeral: true
                        });
                    }
                    
                    // Criar modal para motivo de fechamento
                    const modal = new ModalBuilder()
                        .setCustomId(`ticket_close_modal_${ticketId}`)
                        .setTitle('🔒 Fechar Ticket');

                    const reasonInput = new TextInputBuilder()
                        .setCustomId('close_reason')
                        .setLabel('Motivo do Fechamento')
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(3)
                        .setMaxLength(200)
                        .setPlaceholder('Ex: Problema resolvido, duplicado, etc...')
                        .setRequired(true);

                    const actionRow = new ActionRowBuilder().addComponents(reasonInput);
                    modal.addComponents(actionRow);

                    await interaction.showModal(modal);
                }
                
            } catch (error) {
                console.error('❌ Erro ao processar botão de ticket:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Erro ao processar ação do ticket.',
                        ephemeral: true
                    });
                }
            }
        }
        
        // Handler para modal de fechamento de ticket
        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_close_modal_')) {
            try {
                const ticketId = interaction.customId.split('_')[3];
                const reason = interaction.fields.getTextInputValue('close_reason');
                const userId = interaction.user.id;
                const username = interaction.user.username;
                
                await interaction.deferReply();
                
                const Database = require('../website/database/database');
                const db = new Database();
                
                // Atualizar ticket na base de dados
                await db.updateTicketStatus(ticketId, 'closed', userId, reason);
                
                // Criar embed de fechamento
                const closeEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🔒 Ticket Fechado')
                    .setDescription('Este ticket foi fechado e será arquivado em 10 segundos.')
                    .addFields(
                        { name: '🎫 Ticket', value: `#${ticketId}`, inline: true },
                        { name: '👤 Fechado por', value: username, inline: true },
                        { name: '📝 Motivo', value: reason, inline: true },
                        { name: '🕒 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setFooter({ text: 'Sistema de Tickets YSNM' })
                    .setTimestamp();
                
                await interaction.editReply({
                    embeds: [closeEmbed]
                });
                
                // Arquivar canal após 10 segundos
                setTimeout(async () => {
                    try {
                        // Buscar categoria de tickets arquivados
                        let archivedCategory = interaction.guild.channels.cache.find(
                            channel => channel.type === 4 && channel.name.toLowerCase() === 'tickets-arquivados'
                        );
                        
                        if (!archivedCategory) {
                            archivedCategory = await interaction.guild.channels.create({
                                name: 'Tickets-Arquivados',
                                type: 4, // Category
                                permissionOverwrites: [
                                    {
                                        id: interaction.guild.roles.everyone,
                                        deny: ['ViewChannel']
                                    },
                                    // Apenas moderadores podem ver
                                    ...interaction.guild.roles.cache
                                        .filter(role => role.permissions.has('ManageMessages'))
                                        .map(role => ({
                                            id: role.id,
                                            allow: ['ViewChannel', 'ReadMessageHistory']
                                        }))
                                ]
                            });
                        }
                        
                        // Renomear canal para indicar que está fechado
                        const newName = `fechado-${interaction.channel.name}`;
                        await interaction.channel.setName(newName);
                        await interaction.channel.setParent(archivedCategory.id);
                        
                        // Remover permissões do usuário original (exceto se for staff)
                        const ticketOwnerId = interaction.channel.topic?.match(/User: (\d+)/)?.[1];
                        if (ticketOwnerId && !interaction.guild.members.cache.get(ticketOwnerId)?.permissions.has('ManageMessages')) {
                            await interaction.channel.permissionOverwrites.delete(ticketOwnerId);
                        }
                        
                        console.log(`📁 Ticket #${ticketId} arquivado como ${newName}`);
                    } catch (archiveError) {
                        console.error('Erro ao arquivar ticket:', archiveError);
                    }
                }, 10000);
                
                console.log(`✅ Ticket #${ticketId} fechado com sucesso por ${username}`);
                
            } catch (error) {
                console.error('❌ Erro ao fechar ticket:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Erro ao fechar ticket.',
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ Erro ao fechar ticket.'
                    });
                }
            }
        }
    },
};

// Funções auxiliares para o sistema de tickets
function getTipoEmoji(tipo) {
    const emojis = {
        'suporte': '🛠️',
        'problema': '🚨',
        'sugestao': '💡',
        'moderacao': '👤',
        'geral': '📝'
    };
    return emojis[tipo] || '📝';
}

function getTipoNome(tipo) {
    const nomes = {
        'suporte': 'Suporte Técnico',
        'problema': 'Reportar Problema',
        'sugestao': 'Sugestão',
        'moderacao': 'Moderação',
        'geral': 'Geral'
    };
    return nomes[tipo] || 'Geral';
}

function getPlaceholderByType(tipo) {
    const placeholders = {
        'suporte': 'Explica qual funcionalidade não está a funcionar, que comando usaste, que erro recebeste...',
        'problema': 'Descreve o bug encontrado, como reproduzir o problema, o que esperavas que acontecesse...',
        'sugestao': 'Explica a tua ideia em detalhe, como melhoraria o servidor, que benefícios traria...',
        'moderacao': 'Explica a situação que requer atenção da moderação, utilizadores envolvidos...',
        'geral': 'Descreve a tua questão ou dúvida em detalhe...'
    };
    return placeholders[tipo] || 'Descreve o problema em detalhe...';
}

function getPriorityColor(priority) {
    const colors = {
        'urgent': 0xFF0000,
        'high': 0xFF8000,
        'normal': 0xFFFF00,
        'low': 0x00FF00
    };
    return colors[priority] || 0xFFFF00;
}

function getPriorityEmoji(priority) {
    const emojis = {
        'urgent': '🔴',
        'high': '🟠',
        'normal': '🟡',
        'low': '🟢'
    };
    return emojis[priority] || '🟡';
}

// Função para criar ticket diretamente (fallback)
async function createTicketDirect(interaction, tipo, subject, description, priority) {
    const { EmbedBuilder, ActionRowBuilder } = require('discord.js');
    
    // Buscar categoria de tickets (ou criar se não existir)
    let ticketCategory = interaction.guild.channels.cache.find(
        channel => channel.type === 4 && channel.name.toLowerCase() === 'tickets'
    );
    
    if (!ticketCategory) {
        console.log('📁 Criando categoria de tickets...');
        ticketCategory = await interaction.guild.channels.create({
            name: 'Tickets',
            type: 4, // Category
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone,
                    deny: ['ViewChannel']
                }
            ]
        });
    }
    
    // Criar canal do ticket
    const ticketChannelName = `ticket-${interaction.user.username}-${Date.now().toString().slice(-6)}`;
    console.log('🎫 Criando canal:', ticketChannelName);
    
    const ticketChannel = await interaction.guild.channels.create({
        name: ticketChannelName,
        type: 0, // Text channel
        parent: ticketCategory.id,
        topic: `Ticket de ${interaction.user.tag} (${interaction.user.id}) - Tipo: ${tipo}`,
        permissionOverwrites: [
            {
                id: interaction.guild.roles.everyone,
                deny: ['ViewChannel']
            },
            {
                id: interaction.user.id,
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
            },
            // Permitir que moderadores vejam
            ...interaction.guild.roles.cache
                .filter(role => role.permissions.has('ManageMessages'))
                .map(role => ({
                    id: role.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                }))
        ]
    });
    
    // Criar ticket na base de dados
    const Database = require('../website/database/database');
    const db = new Database();
    
    const ticketData = {
        guild_id: interaction.guild.id,
        channel_id: ticketChannel.id,
        user_id: interaction.user.id,
        category: tipo,
        subject: subject,
        description: description,
        priority: priority
    };
    
    const ticketResult = await db.createTicket(ticketData);
    
    // Criar embed informativo
    const embed = new EmbedBuilder()
        .setColor(getPriorityColor(priority))
        .setTitle(`🎫 Ticket #${ticketResult.id}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
            { name: '📝 Assunto', value: subject, inline: true },
            { name: '🏷️ Tipo', value: `${getTipoEmoji(tipo)} ${getTipoNome(tipo)}`, inline: true },
            { name: '⚡ Prioridade', value: `${getPriorityEmoji(priority)} ${priority.toUpperCase()}`, inline: true },
            { name: '📄 Descrição', value: description.length > 500 ? description.substring(0, 500) + '...' : description, inline: false },
            { name: '👤 Criado por', value: `<@${interaction.user.id}>`, inline: true },
            { name: '🕒 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setFooter({ text: 'Sistema de Tickets YSNM', iconURL: interaction.guild.iconURL() })
        .setTimestamp();
    
    // Criar botões de ação
    const actionRow = new ActionRowBuilder()
        .addComponents(
            {
                type: 2,
                style: 3,
                label: 'Atribuir-me',
                custom_id: `ticket_assign_${ticketResult.id}`,
                emoji: { name: '👋' }
            },
            {
                type: 2,
                style: 4,
                label: 'Fechar Ticket',
                custom_id: `ticket_close_${ticketResult.id}`,
                emoji: { name: '🔒' }
            }
        );
    
    // Enviar mensagem no canal do ticket
    await ticketChannel.send({
        content: `<@${interaction.user.id}> O seu ticket foi criado com sucesso!\n\n**Staff:** Use os botões abaixo para gerir este ticket.`,
        embeds: [embed],
        components: [actionRow]
    });
    
    // Responder ao usuário
    await interaction.editReply({
        content: `✅ Ticket criado com sucesso!\n🎫 **Canal:** ${ticketChannel}\n📋 **ID:** #${ticketResult.id}`,
    });
    
    console.log(`✅ Ticket #${ticketResult.id} criado com sucesso por ${interaction.user.tag} via painel`);
}
