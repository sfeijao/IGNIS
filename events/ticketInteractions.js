const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton() && !interaction.isModalSubmit()) return;

        // Processar botões de tickets
        if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
            const [action, type, id] = interaction.customId.split('_');
            
            // Sistema de tickets
            const TicketSystem = require('../utils/ticketSystem');
            const ticketSystem = new TicketSystem(client);

            try {
                switch(action) {
                    case 'create':
                        // Verificar se usuário já tem ticket aberto
                        const userTickets = await client.storage.getTickets(interaction.guild.id);
                        const openTicket = userTickets.find(t => 
                            t.user_id === interaction.user.id && 
                            (t.status === 'open' || t.status === 'assigned')
                        );

                        if (openTicket) {
                            return await interaction.reply({
                                content: \`❌ Você já tem um ticket aberto: <#\${openTicket.channel_id}>\`,
                                ephemeral: true
                            });
                        }

                        // Criar modal para novo ticket
                        const modal = require('../commands/ticket').createTicketModal(type);
                        await interaction.showModal(modal);
                        break;

                    case 'close':
                        // Modal de confirmação para fechar ticket
                        if (!id) return;
                        await interaction.showModal({
                            customId: \`ticket_close_modal_\${id}\`,
                            title: '🔒 Fechar Ticket',
                            components: [{
                                type: 1,
                                components: [{
                                    type: 4,
                                    custom_id: 'close_reason',
                                    label: 'Motivo do Fechamento',
                                    style: 2,
                                    min_length: 1,
                                    max_length: 1000,
                                    placeholder: 'Digite o motivo para fechar este ticket...',
                                    required: true
                                }]
                            }]
                        });
                        break;

                    case 'assign':
                        if (!id) return;
                        const ticket = await client.storage.getTicket(id);
                        
                        if (!ticket) {
                            return await interaction.reply({
                                content: '❌ Ticket não encontrado.',
                                ephemeral: true
                            });
                        }

                        // Verificar permissões
                        const staffRoleId = (await client.storage.getGuildConfig(interaction.guild.id)).ticketStaffRoleId;
                        if (!interaction.member.roles.cache.has(staffRoleId)) {
                            return await interaction.reply({
                                content: '❌ Você não tem permissão para atribuir tickets.',
                                ephemeral: true
                            });
                        }

                        // Atribuir ticket
                        await client.storage.updateTicket(id, {
                            status: 'assigned',
                            assigned_to: interaction.user.id
                        });

                        // Enviar log
                        await ticketSystem.sendLogWebhook(interaction.guild, {
                            ...ticket,
                            assigned_to: interaction.user
                        }, 'assign');

                        await interaction.reply({
                            content: \`✅ Ticket atribuído para \${interaction.user}\`
                        });
                        break;
                }

            } catch (error) {
                console.error('Erro ao processar interação de ticket:', error);
                await interaction.reply({
                    content: '❌ Ocorreu um erro ao processar sua solicitação.',
                    ephemeral: true
                });
            }
        }

        // Processar modal de fechamento de ticket
        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_close_modal_')) {
            const ticketId = interaction.customId.split('_')[3];
            const reason = interaction.fields.getTextInputValue('close_reason');
            
            const TicketSystem = require('../utils/ticketSystem');
            const ticketSystem = new TicketSystem(client);
            
            await ticketSystem.closeTicket(interaction, ticketId, reason);
        }
    }
};
