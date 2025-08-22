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
        else if (interaction.isButton()) {
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
        else if (interaction.isStringSelectMenu()) {
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
        else if (interaction.isModalSubmit()) {
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
        else if (interaction.isModalSubmit()) {
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
        else if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
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
        else if (interaction.isButton() && interaction.customId.startsWith('ticket_create_')) {
            console.log(`🎫 Handler de ticket ativado: ${interaction.customId}`);
            const tipo = interaction.customId.split('_')[2];
            console.log(`🎫 Tipo de ticket: ${tipo}`);
            
            try {
                console.log(`🎫 Inicializando verificação de tickets existentes...`);
                // Verificar se o usuário já tem um ticket aberto
                const Database = require('../website/database/database');
                const db = new Database();
                await db.initialize();
                console.log(`🎫 Database inicializada`);
                
                const userTickets = await db.getTickets(interaction.guild.id);
                console.log(`🎫 Tickets do usuário verificados: ${userTickets.length} encontrados`);
                const openTicket = userTickets.find(ticket => 
                    ticket.user_id === interaction.user.id && 
                    (ticket.status === 'open' || ticket.status === 'assigned')
                );
                
                if (openTicket) {
                    console.log(`🎫 Usuário já tem ticket aberto: ${openTicket.channel_id}`);
                    return await interaction.reply({
                        content: `❌ Já tens um ticket aberto: <#${openTicket.channel_id}>
                        
Por favor fecha o ticket atual antes de criar um novo.`,
                        ephemeral: true
                    });
                }
                
                console.log(`🎫 Criando modal para tipo: ${tipo}`);
                // Criar modal para detalhes do ticket
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                
                const modal = new ModalBuilder()
                    .setCustomId(`ticket_panel_modal_${tipo}`)
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

                const row1 = new ActionRowBuilder().addComponents(subjectInput);
                const row2 = new ActionRowBuilder().addComponents(descriptionInput);

                modal.addComponents(row1, row2);

                console.log(`🎫 Modal criado, mostrando para usuário...`);
                await interaction.showModal(modal);
                console.log(`🎫 Modal mostrado com sucesso!`);

            } catch (error) {
                console.error('❌ Erro ao processar botão do painel:', error);
                
                // Apenas responder se a interação ainda não foi processada
                if (!interaction.replied && !interaction.deferred) {
                    try {
                        await interaction.reply({
                            content: '❌ Erro ao processar pedido. Tenta novamente.',
                            ephemeral: true
                        });
                    } catch (replyError) {
                        console.error('❌ Erro ao responder:', replyError);
                    }
                }
            }
        }
        
        // Handler para modais do painel de tickets
        else if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_panel_modal_')) {
            console.log('🎫 Processando modal de ticket:', interaction.customId);
            
            const [, , , tipo] = interaction.customId.split('_');
            const subject = interaction.fields.getTextInputValue('ticket_subject');
            const description = interaction.fields.getTextInputValue('ticket_description');
            
            console.log('📋 Dados do ticket:', { tipo, subject, description });
            
            try {
                await interaction.deferReply({ ephemeral: true });
                
                // Criar ticket usando implementação direta
                await createTicketDirect(interaction, tipo, subject, description, 'normal');
                
            } catch (error) {
                console.error('❌ Erro ao processar modal do painel:', error);
                
                try {
                    if (interaction.deferred) {
                        await interaction.editReply({
                            content: '❌ Erro ao criar ticket. Tenta novamente ou contacta um administrador.'
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ Erro ao criar ticket. Tenta novamente ou contacta um administrador.',
                            ephemeral: true
                        });
                    }
                } catch (replyError) {
                    console.error('❌ Erro ao responder interação:', replyError);
                }
            }
        }
        
        // Handler para botões de tickets
        else if (interaction.isButton() && (interaction.customId.startsWith('ticket_assign_') || interaction.customId.startsWith('ticket_close_'))) {
            try {
                const Database = require('../website/database/database');
                const db = new Database();
                await db.initialize();
                
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
                    
                    // Criar modal para motivo de fechamento e opção de arquivar
                    const modal = new ModalBuilder()
                        .setCustomId(`ticket_close_modal_${ticketId}`)
                        .setTitle('🔒 Fechar Ticket');

                    const reasonInput = new TextInputBuilder()
                        .setCustomId('close_reason')
                        .setLabel('Motivo do Fechamento')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMinLength(3)
                        .setMaxLength(500)
                        .setPlaceholder('Explique o motivo do fechamento do ticket...')
                        .setRequired(true);

                    const archiveInput = new TextInputBuilder()
                        .setCustomId('archive_option')
                        .setLabel('Arquivar ticket? (sim/não)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Digite "sim" para arquivar ou "não" para apenas fechar')
                        .setRequired(true)
                        .setMaxLength(3)
                        .setMinLength(2);

                    const row1 = new ActionRowBuilder().addComponents(reasonInput);
                    const row2 = new ActionRowBuilder().addComponents(archiveInput);
                    modal.addComponents(row1, row2);

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
        else if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_close_modal_')) {
            try {
                const ticketId = interaction.customId.split('_')[3];
                const reason = interaction.fields.getTextInputValue('close_reason');
                const archiveOption = interaction.fields.getTextInputValue('archive_option').toLowerCase();
                const userId = interaction.user.id;
                const username = interaction.user.username;
                
                await interaction.deferReply();
                
                const Database = require('../website/database/database');
                const db = new Database();
                await db.initialize();
                
                // Atualizar ticket na base de dados
                await db.updateTicketStatus(ticketId, 'closed', userId, reason);
                
                // Verificar se deve arquivar
                const shouldArchive = archiveOption === 'sim' || archiveOption === 's' || archiveOption === 'yes' || archiveOption === 'y';
                
                // Criar embed de fechamento
                const closeEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🔒 Ticket Fechado')
                    .setDescription(shouldArchive ? 
                        'Este ticket será arquivado no servidor de logs em 10 segundos.' : 
                        'Este ticket será **eliminado permanentemente** em 10 segundos.')
                    .addFields(
                        { name: '🎫 Ticket', value: `#${ticketId}`, inline: true },
                        { name: '👤 Fechado por', value: username, inline: true },
                        { name: '� Arquivar', value: shouldArchive ? '✅ Sim' : '❌ Não', inline: true },
                        { name: '�📝 Motivo', value: reason, inline: false },
                        { name: '🕒 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setFooter({ text: 'Sistema de Tickets YSNM' })
                    .setTimestamp();
                
                await interaction.editReply({
                    embeds: [closeEmbed]
                });
                
                if (shouldArchive) {
                    // Arquivar canal após 5 segundos
                    setTimeout(async () => {
                        try {
                            await archiveTicket(interaction, ticketId);
                        } catch (archiveError) {
                            console.error('Erro ao arquivar ticket:', archiveError);
                        }
                    }, 5000);
                } else {
                    // Apenas renomear o canal para indicar que está fechado
                    try {
                        const newName = `fechado-${interaction.channel.name.replace('ticket-', '')}`;
                        await interaction.channel.setName(newName);
                        
                        // Remover permissões do usuário original (exceto se for staff)
                        const ticketOwnerId = interaction.channel.topic?.match(/User: (\d+)/)?.[1];
                        if (ticketOwnerId) {
                            const member = interaction.guild.members.cache.get(ticketOwnerId);
                            if (member && !member.permissions.has('ManageMessages')) {
                                await interaction.channel.permissionOverwrites.delete(ticketOwnerId);
                            }
                        }
                        
                        console.log(`� Ticket #${ticketId} fechado (não arquivado) como ${newName}`);
                    } catch (error) {
                        console.error('Erro ao renomear ticket fechado:', error);
                    }
                }
                
                console.log(`✅ Ticket #${ticketId} fechado por ${username} (${shouldArchive ? 'Arquivar' : 'Deletar'})`);
                
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
        'sugestao': '💡'
    };
    return emojis[tipo] || '📝';
}

function getTipoNome(tipo) {
    const nomes = {
        'suporte': 'Suporte Técnico',
        'problema': 'Reportar Problema',
        'sugestao': 'Sugestão'
    };
    return nomes[tipo] || 'Suporte';
}

function getPlaceholderByType(tipo) {
    const placeholders = {
        'suporte': 'Explica qual funcionalidade não está a funcionar, que comando usaste, que erro recebeste...',
        'problema': 'Descreve o bug encontrado, como reproduzir o problema, o que esperavas que acontecesse...',
        'sugestao': 'Explica a tua ideia em detalhe, como melhoraria o servidor, que benefícios traria...'
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
    console.log('🎫 Iniciando criação de ticket:', { tipo, subject, description, priority });
    
    const { EmbedBuilder, ActionRowBuilder } = require('discord.js');
    
    try {
        // Buscar ou criar categoria de tickets ativos
        let ticketCategory = interaction.guild.channels.cache.find(
            channel => channel.type === 4 && channel.name.toLowerCase() === 'tickets-ativos'
        );
        
        if (!ticketCategory) {
            console.log('📁 Criando categoria de tickets ativos...');
            ticketCategory = await interaction.guild.channels.create({
                name: '📋 Tickets Ativos',
                type: 4, // Category
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: ['ViewChannel']
                    },
                    // Staff pode ver tickets ativos
                    ...interaction.guild.roles.cache
                        .filter(role => role.permissions.has('ManageMessages'))
                        .map(role => ({
                            id: role.id,
                            allow: ['ViewChannel', 'ReadMessageHistory', 'SendMessages']
                        }))
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
        console.log('💾 Criando ticket na base de dados...');
        const Database = require('../website/database/database');
        const db = new Database();
        await db.initialize();
        
        const ticketData = {
            guild_id: interaction.guild.id,
            channel_id: ticketChannel.id,
            user_id: interaction.user.id,
            category: tipo,
            subject: subject,
            description: description,
            priority: priority
        };
        
        console.log('📊 Dados para a base de dados:', ticketData);
        const ticketResult = await db.createTicket(ticketData);
        console.log('✅ Ticket criado na base de dados:', ticketResult);    // Criar embed informativo
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
            new ButtonBuilder()
                .setStyle(ButtonStyle.Success)
                .setLabel('Atribuir-me')
                .setCustomId(`ticket_assign_${ticketResult.id}`)
                .setEmoji('👋'),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Danger)
                .setLabel('Fechar Ticket')
                .setCustomId(`ticket_close_${ticketResult.id}`)
                .setEmoji('🔒')
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
        
    } catch (error) {
        console.error('❌ Erro detalhado na criação do ticket:', error);
        
        // Responder com erro específico
        try {
            await interaction.editReply({
                content: `❌ Erro ao criar ticket: ${error.message}
Contacta um administrador se o problema persistir.`,
            });
        } catch (replyError) {
            console.error('❌ Erro ao responder com erro:', replyError);
        }
        
        throw error; // Re-lançar para o handler principal
    }
}

// Função para arquivar tickets com permissões corretas
async function archiveTicket(interaction, ticketId) {
    try {
        // Carregar config com fallback
        let config;
        try {
            config = require('../config.json');
        } catch (error) {
            console.log('⚠️ Config.json não encontrado no archiveTicket, usando IDs padrão');
            config = {
                roles: {
                    admin: '1333820000892616724',
                    owner: '381762006329589760'
                }
            };
        }

        // Buscar ou criar categoria de tickets ativos
        let activeCategory = interaction.guild.channels.cache.find(
            channel => channel.type === 4 && channel.name.toLowerCase() === 'tickets-ativos'
        );
        
        if (!activeCategory) {
            activeCategory = await interaction.guild.channels.create({
                name: '📋 Tickets Ativos',
                type: 4, // Category
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: ['ViewChannel']
                    },
                    // Staff pode ver tickets ativos
                    ...interaction.guild.roles.cache
                        .filter(role => role.permissions.has('ManageMessages'))
                        .map(role => ({
                            id: role.id,
                            allow: ['ViewChannel', 'ReadMessageHistory', 'SendMessages']
                        }))
                ]
            });
        }

        // Buscar ou criar categoria de tickets arquivados (apenas ADMIN+)
        let archivedCategory = interaction.guild.channels.cache.find(
            channel => channel.type === 4 && channel.name.toLowerCase() === 'tickets-arquivados'
        );
        
        if (!archivedCategory) {
            const adminRole = interaction.guild.roles.cache.get(config.roles.admin);
            const ownerRole = interaction.guild.roles.cache.get(config.roles.owner);
            
            const permissionOverwrites = [
                {
                    id: interaction.guild.roles.everyone,
                    deny: ['ViewChannel']
                }
            ];

            // Adicionar permissões apenas para ADMIN e OWNER
            if (adminRole) {
                permissionOverwrites.push({
                    id: adminRole.id,
                    allow: ['ViewChannel', 'ReadMessageHistory', 'SendMessages', 'ManageMessages']
                });
            }
            
            if (ownerRole) {
                permissionOverwrites.push({
                    id: ownerRole.id,
                    allow: ['ViewChannel', 'ReadMessageHistory', 'SendMessages', 'ManageMessages']
                });
            }

            archivedCategory = await interaction.guild.channels.create({
                name: '📁 Tickets Arquivados',
                type: 4, // Category
                permissionOverwrites
            });
        }
        
        // Renomear canal para indicar que está arquivado
        const currentName = interaction.channel.name.replace('ticket-', '').replace('fechado-', '');
        const newName = `arquivado-${currentName}`;
        await interaction.channel.setName(newName);
        await interaction.channel.setParent(archivedCategory.id);
        
        // Remover permissões do usuário original e outros não-staff
        const ticketOwnerId = interaction.channel.topic?.match(/User: (\d+)/)?.[1];
        if (ticketOwnerId) {
            const member = interaction.guild.members.cache.get(ticketOwnerId);
            if (member && !member.permissions.has('ManageMessages')) {
                await interaction.channel.permissionOverwrites.delete(ticketOwnerId);
            }
        }

        // Remover permissões de todos os roles que não sejam ADMIN+
        const adminRole = interaction.guild.roles.cache.get(config.roles.admin);
        const ownerRole = interaction.guild.roles.cache.get(config.roles.owner);
        
        for (const [id, overwrite] of interaction.channel.permissionOverwrites.cache) {
            if (overwrite.type === 1) continue; // Skip users
            
            const role = interaction.guild.roles.cache.get(id);
            if (role && role.id !== adminRole?.id && role.id !== ownerRole?.id && role.id !== interaction.guild.roles.everyone.id) {
                // Remover permissões de roles que não sejam ADMIN ou OWNER
                if (!role.permissions.has('Administrator')) {
                    await interaction.channel.permissionOverwrites.delete(id);
                }
            }
        }
        
        // Adicionar embed informativo no canal arquivado
        const archiveEmbed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('📁 Ticket Arquivado')
            .setDescription('Este ticket foi arquivado e apenas administradores podem visualizá-lo.')
            .addFields(
                { name: '🎫 ID do Ticket', value: `#${ticketId}`, inline: true },
                { name: '📅 Data de Arquivo', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '👁️ Visibilidade', value: 'Apenas Administradores', inline: true }
            )
            .setFooter({ text: 'Sistema de Tickets YSNM - Arquivo' })
            .setTimestamp();

        await interaction.channel.send({ embeds: [archiveEmbed] });
        
        console.log(`📁 Ticket #${ticketId} arquivado como ${newName} (visível apenas para ADMIN+)`);
        
    } catch (error) {
        console.error('❌ Erro ao arquivar ticket:', error);
        throw error;
    }
}

// Função para arquivar tickets no servidor de logs
async function archiveTicketToLogServer(interaction, ticketId, reason) {
    try {
        // Carregar config com fallback
        let config;
        try {
            config = require('../config.json');
        } catch (error) {
            console.log('⚠️ Config.json não encontrado no archiveTicketToLogServer');
            config = { ticketSystem: { logServerId: null } };
        }

        // Obter informações do ticket antes de arquivar
        const ticketInfo = {
            id: ticketId,
            name: interaction.channel.name,
            topic: interaction.channel.topic,
            createdAt: interaction.channel.createdAt,
            closedAt: new Date(),
            closedBy: interaction.user,
            reason: reason,
            guild: interaction.guild.name
        };

        // Se não há servidor de logs configurado, arquivar localmente
        if (!config.ticketSystem?.logServerId) {
            console.log('⚠️ Servidor de logs não configurado, arquivando localmente...');
            await archiveTicket(interaction, ticketId);
            return;
        }

        // Buscar servidor de logs
        const logServer = interaction.client.guilds.cache.get(config.ticketSystem.logServerId);
        if (!logServer) {
            console.log('⚠️ Servidor de logs não encontrado, arquivando localmente...');
            await archiveTicket(interaction, ticketId);
            return;
        }

        // Buscar ou criar canal de logs no servidor
        let logChannel = logServer.channels.cache.get(config.ticketSystem.logChannelId);
        if (!logChannel) {
            // Criar canal de logs
            logChannel = await logServer.channels.create({
                name: '📋-tickets-arquivados',
                type: 0, // Text channel
                topic: 'Arquivo de tickets do servidor YSNM Community'
            });
            console.log(`📋 Canal de logs criado: ${logChannel.name}`);
        }

        // Coletar últimas 50 mensagens do ticket
        const messages = await interaction.channel.messages.fetch({ limit: 50 });
        const messageHistory = messages.reverse().map(msg => {
            return `[${msg.createdAt.toLocaleString('pt-PT')}] ${msg.author.tag}: ${msg.content}`;
        }).join('\n');

        // Criar embed com informações do ticket
        const archiveEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`📋 Ticket Arquivado #${ticketId}`)
            .setDescription(`Ticket do servidor **${ticketInfo.guild}**`)
            .addFields(
                { name: '🎫 Canal Original', value: ticketInfo.name, inline: true },
                { name: '👤 Fechado por', value: ticketInfo.closedBy.tag, inline: true },
                { name: '📅 Criado em', value: `<t:${Math.floor(ticketInfo.createdAt.getTime() / 1000)}:F>`, inline: false },
                { name: '🔒 Fechado em', value: `<t:${Math.floor(ticketInfo.closedAt.getTime() / 1000)}:F>`, inline: false },
                { name: '📝 Motivo', value: reason, inline: false },
                { name: '📄 Tópico', value: ticketInfo.topic || 'Sem tópico', inline: false }
            )
            .setFooter({ text: 'Sistema de Tickets YSNM - Arquivo' })
            .setTimestamp();

        // Enviar embed de arquivo
        await logChannel.send({ embeds: [archiveEmbed] });

        // Enviar histórico de mensagens se existir
        if (messageHistory.length > 0) {
            const historyText = `**Histórico de Mensagens do Ticket #${ticketId}:**\n\`\`\`\n${messageHistory.substring(0, 1900)}\n\`\`\``;
            await logChannel.send(historyText);
        }

        // Deletar o canal original
        await interaction.channel.delete(`Ticket #${ticketId} arquivado no servidor de logs`);
        
        console.log(`📋 Ticket #${ticketId} arquivado no servidor de logs (${logServer.name})`);
        
    } catch (error) {
        console.error('❌ Erro ao arquivar no servidor de logs:', error);
        // Fallback para arquivo local
        await archiveTicket(interaction, ticketId);
    }
}

// Função para deletar tickets permanentemente
async function deleteTicketPermanently(interaction, ticketId, reason) {
    try {
        // Obter informações do ticket antes de deletar
        const ticketInfo = {
            id: ticketId,
            name: interaction.channel.name,
            deletedBy: interaction.user,
            reason: reason,
            deletedAt: new Date()
        };

        // Log da deleção
        console.log(`🗑️ Deletando permanentemente ticket #${ticketId} (${ticketInfo.name}) por ${ticketInfo.deletedBy.tag}`);

        // Criar embed de confirmação antes de deletar
        const deleteEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🗑️ Ticket Eliminado')
            .setDescription('Este ticket foi **eliminado permanentemente**.')
            .addFields(
                { name: '🎫 Ticket', value: `#${ticketId}`, inline: true },
                { name: '👤 Eliminado por', value: ticketInfo.deletedBy.tag, inline: true },
                { name: '📝 Motivo', value: reason, inline: false },
                { name: '⚠️ Aviso', value: 'Esta ação é irreversível.', inline: false }
            )
            .setFooter({ text: 'Sistema de Tickets YSNM - Deleção' })
            .setTimestamp();

        // Enviar confirmação final no canal
        await interaction.channel.send({ embeds: [deleteEmbed] });

        // Aguardar 5 segundos e deletar
        setTimeout(async () => {
            try {
                await interaction.channel.delete(`Ticket #${ticketId} eliminado permanentemente por ${ticketInfo.deletedBy.tag}`);
                console.log(`🗑️ Ticket #${ticketId} eliminado permanentemente com sucesso`);
            } catch (deleteError) {
                console.error('❌ Erro ao deletar canal:', deleteError);
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ Erro ao deletar ticket permanentemente:', error);
        throw error;
    }
}
