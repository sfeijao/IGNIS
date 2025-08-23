const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const Database = require('../website/database/database');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        try {
            // Comando Slash
            if (interaction.isChatInputCommand()) {
                // Verificar se client.commands existe
                if (!client.commands) {
                    console.error('❌ client.commands não inicializado');
                    return interaction.reply({
                        content: '❌ Sistema de comandos ainda não foi inicializado. Tente novamente em alguns segundos.',
                        ephemeral: true
                    });
                }

                const command = client.commands.get(interaction.commandName);
                if (!command) return;

                try {
                    await command.execute(interaction, client);
                } catch (error) {
                    console.error(`Erro ao executar comando ${interaction.commandName}:`, error);
                    const reply = {
                        content: '❌ Ocorreu um erro ao executar este comando.',
                        ephemeral: true
                    };
                    
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(reply);
                    } else {
                        await interaction.reply(reply);
                    }
                }
                return;
            }

            // Botões
            if (interaction.isButton()) {
                const customId = interaction.customId;

                // Sistema de Verificação
                if (customId === 'verify_user') {
                    try {
                        const verifyRole = interaction.guild.roles.cache.find(role => role.name === 'Verificado');
                        if (!verifyRole) {
                            return await interaction.reply({
                                content: '❌ Cargo de verificação não encontrado. Contacte um administrador.',
                                ephemeral: true
                            });
                        }

                        if (interaction.member.roles.cache.has(verifyRole.id)) {
                            return await interaction.reply({
                                content: '✅ Já estás verificado!',
                                ephemeral: true
                            });
                        }

                        await interaction.member.roles.add(verifyRole);
                        await interaction.reply({
                            content: '✅ Verificação completa! Bem-vindo(a) ao servidor!',
                            ephemeral: true
                        });

                        // Log da verificação
                        const database = new Database();
                        database.run('INSERT INTO logs (type, user_id, action, timestamp) VALUES (?, ?, ?, ?)', 
                            ['verification', interaction.user.id, 'User verified', new Date().toISOString()]);

                    } catch (error) {
                        console.error('Erro na verificação:', error);
                        await interaction.reply({
                            content: '❌ Erro ao verificar. Tenta novamente.',
                            ephemeral: true
                        });
                    }
                    return;
                }

                // Sistema de Tickets
                if (customId === 'create_ticket') {
                    try {
                        const ticketCategory = interaction.guild.channels.cache.find(c => c.name === '📁 TICKETS' && c.type === ChannelType.GuildCategory);
                        if (!ticketCategory) {
                            return await interaction.reply({
                                content: '❌ Categoria de tickets não encontrada.',
                                ephemeral: true
                            });
                        }

                        // Verificar se já tem ticket aberto
                        const existingTicket = interaction.guild.channels.cache.find(
                            c => c.name === `ticket-${interaction.user.username.toLowerCase()}` && c.parentId === ticketCategory.id
                        );

                        if (existingTicket) {
                            return await interaction.reply({
                                content: `❌ Já tens um ticket aberto: ${existingTicket}`,
                                ephemeral: true
                            });
                        }

                        // Criar canal de ticket
                        const ticketChannel = await interaction.guild.channels.create({
                            name: `ticket-${interaction.user.username.toLowerCase()}`,
                            type: ChannelType.GuildText,
                            parent: ticketCategory.id,
                            permissionOverwrites: [
                                {
                                    id: interaction.guild.id,
                                    deny: [PermissionFlagsBits.ViewChannel],
                                },
                                {
                                    id: interaction.user.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                                },
                            ],
                        });

                        // Embed do ticket
                        const ticketEmbed = new EmbedBuilder()
                            .setTitle('🎫 Ticket Criado')
                            .setDescription(`Olá ${interaction.user}, o teu ticket foi criado com sucesso!`)
                            .addFields(
                                { name: '👤 Utilizador', value: `${interaction.user}`, inline: true },
                                { name: '🕐 Criado', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                                { name: '📋 Status', value: '🟢 Aberto', inline: true }
                            )
                            .setColor('#00ff00')
                            .setTimestamp();

                        const closeButton = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('close_ticket')
                                    .setLabel('🔒 Fechar Ticket')
                                    .setStyle(ButtonStyle.Danger)
                            );

                        await ticketChannel.send({
                            content: `${interaction.user}`,
                            embeds: [ticketEmbed],
                            components: [closeButton]
                        });

                        await interaction.reply({
                            content: `✅ Ticket criado: ${ticketChannel}`,
                            ephemeral: true
                        });

                        // Guardar na database
                        const database = new Database();
                        database.run('INSERT INTO tickets (user_id, channel_id, status, created_at) VALUES (?, ?, ?, ?)',
                            [interaction.user.id, ticketChannel.id, 'open', new Date().toISOString()]);

                    } catch (error) {
                        console.error('Erro ao criar ticket:', error);
                        await interaction.reply({
                            content: '❌ Erro ao criar ticket. Tenta novamente.',
                            ephemeral: true
                        });
                    }
                    return;
                }

                // Fechar Ticket
                if (customId === 'close_ticket') {
                    try {
                        const confirmEmbed = new EmbedBuilder()
                            .setTitle('⚠️ Confirmar Encerramento')
                            .setDescription('Tens a certeza que queres fechar este ticket?')
                            .setColor('#ff9900');

                        const confirmButtons = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('confirm_close')
                                    .setLabel('✅ Sim, Fechar')
                                    .setStyle(ButtonStyle.Danger),
                                new ButtonBuilder()
                                    .setCustomId('cancel_close')
                                    .setLabel('❌ Cancelar')
                                    .setStyle(ButtonStyle.Secondary)
                            );

                        await interaction.reply({
                            embeds: [confirmEmbed],
                            components: [confirmButtons],
                            ephemeral: true
                        });

                    } catch (error) {
                        console.error('Erro ao confirmar fecho de ticket:', error);
                    }
                    return;
                }

                // Confirmar fecho do ticket
                if (customId === 'confirm_close') {
                    try {
                        const closedEmbed = new EmbedBuilder()
                            .setTitle('🔒 Ticket Fechado')
                            .setDescription(`Ticket fechado por ${interaction.user}`)
                            .addFields(
                                { name: '🕐 Fechado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                            )
                            .setColor('#ff0000')
                            .setTimestamp();

                        await interaction.channel.send({ embeds: [closedEmbed] });
                        
                        // Atualizar na database
                        const database = new Database();
                        database.run('UPDATE tickets SET status = ?, closed_at = ? WHERE channel_id = ?',
                            ['closed', new Date().toISOString(), interaction.channel.id]);

                        await interaction.reply({
                            content: '🔒 Ticket será fechado em 5 segundos...',
                            ephemeral: true
                        });

                        setTimeout(async () => {
                            try {
                                await interaction.channel.delete();
                            } catch (error) {
                                console.error('Erro ao deletar canal:', error);
                            }
                        }, 5000);

                    } catch (error) {
                        console.error('Erro ao fechar ticket:', error);
                    }
                    return;
                }

                // Cancelar fecho
                if (customId === 'cancel_close') {
                    await interaction.reply({
                        content: '✅ Fecho cancelado.',
                        ephemeral: true
                    });
                    return;
                }

                // Sistema de Tags
                if (customId.startsWith('request_tag_')) {
                    const tagName = customId.replace('request_tag_', '');
                    
                    const modal = new ModalBuilder()
                        .setCustomId(`tag_modal_${tagName}`)
                        .setTitle(`Solicitar Tag: ${tagName}`);

                    const reasonInput = new TextInputBuilder()
                        .setCustomId('tag_reason')
                        .setLabel('Motivo da solicitação')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Explica porque queres esta tag...')
                        .setRequired(true)
                        .setMaxLength(500);

                    const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
                    modal.addComponents(firstActionRow);

                    await interaction.showModal(modal);
                    return;
                }
            }

            // Modals
            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('tag_modal_')) {
                    const tagName = interaction.customId.replace('tag_modal_', '');
                    const reason = interaction.fields.getTextInputValue('tag_reason');

                    // Guardar solicitação na database
                    const database = new Database();
                    database.run('INSERT INTO tag_requests (user_id, tag_name, reason, status, created_at) VALUES (?, ?, ?, ?, ?)',
                        [interaction.user.id, tagName, reason, 'pending', new Date().toISOString()]);

                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('✅ Solicitação Enviada')
                        .setDescription(`A tua solicitação para a tag **${tagName}** foi enviada!`)
                        .addFields(
                            { name: '📝 Motivo', value: reason },
                            { name: '⏰ Status', value: '🟡 Pendente' }
                        )
                        .setColor('#ffff00')
                        .setTimestamp();

                    await interaction.reply({
                        embeds: [confirmEmbed],
                        ephemeral: true
                    });
                    return;
                }
            }

        } catch (error) {
            console.error('Erro geral no interactionCreate:', error);
        }
    }
};
