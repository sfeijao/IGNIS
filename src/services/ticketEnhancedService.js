const { TicketCategory, TicketEnhanced } = require('../models/ticketEnhanced');
const { EmbedBuilder, PermissionFlagsBits, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

class TicketEnhancedService {
    // ==================== CATEGORIAS ====================

    async createCategory(guildId, categoryData) {
        return await TicketCategory.create({
            guildId,
            ...categoryData
        });
    }

    async getCategories(guildId, onlyEnabled = true) {
        const query = { guildId };
        if (onlyEnabled) query.enabled = true;

        return await TicketCategory.find(query).sort({ name: 1 });
    }

    async updateCategory(categoryId, updates) {
        return await TicketCategory.findByIdAndUpdate(categoryId, updates, { new: true });
    }

    async deleteCategory(categoryId) {
        return await TicketCategory.findByIdAndDelete(categoryId);
    }

    /**
     * Criar um novo ticket enhanced
     * @param {Client} client - Cliente do Discord
     * @param {string} guildId - ID do servidor
     * @param {string} userId - ID do usuário
     * @param {string} categoryId - ID da categoria (opcional)
     * @param {Object} options - Opções adicionais (subject, reason, priority, initialAnswers)
     * @returns {Promise<{success: boolean, ticket?: TicketEnhanced, channel?: Channel, error?: string}>}
     */
    async createTicket(client, guildId, userId, categoryId, options = {}) {
        const guild = await client.guilds.fetch(guildId);
        const category = categoryId ? await TicketCategory.findById(categoryId) : null;

        // Verificar limite de tickets abertos
        if (category && category.maxOpenPerUser > 0) {
            const openTickets = await TicketEnhanced.countDocuments({
                guildId,
                ownerId: userId,
                status: { $in: ['open', 'pending', 'answered'] }
            });

            if (openTickets >= category.maxOpenPerUser) {
                return { success: false, error: `Você já tem ${openTickets} ticket(s) aberto(s). Limite: ${category.maxOpenPerUser}` };
            }
        }

        // Gerar número do ticket
        const lastTicket = await TicketEnhanced.findOne({ guildId }).sort({ ticketNumber: -1 });
        const ticketNumber = (lastTicket?.ticketNumber || 0) + 1;

        // Nome do canal
        const namingPattern = category?.channelSettings?.namingPattern || 'ticket-{number}';
        const channelName = namingPattern.replace('{number}', String(ticketNumber).padStart(4, '0'));

        // Criar canal
        const categoryChannelId = category?.channelSettings?.categoryChannelId;
        const member = await guild.members.fetch(userId);

        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryChannelId || null,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: userId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                },
                ...(category?.staffSettings?.roleIds || []).map(roleId => ({
                    id: roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
                }))
            ]
        });

        // Criar ticket no banco
        const ticket = await TicketEnhanced.create({
            guildId,
            ticketNumber,
            channelId: channel.id,
            ownerId: userId,
            categoryId: category?._id,
            categoryName: category?.name || 'Geral',
            subject: options.subject || 'Sem assunto',
            reason: options.reason || '',
            initialAnswers: options.initialAnswers || [],
            priority: options.priority || 'normal'
        });

        // Mensagem de boas-vindas
        const embed = new EmbedBuilder()
            .setTitle(`🎫 Ticket #${String(ticketNumber).padStart(4, '0')}`)
            .setDescription(`Olá ${member}, bem-vindo ao seu ticket!\n\nCategoria: **${ticket.categoryName}**\nPrioridade: **${ticket.priority}**`)
            .setColor('#5865F2')
            .addFields([
                { name: '📋 Assunto', value: ticket.subject },
                { name: '💬 Motivo', value: ticket.reason || 'Não especificado' }
            ])
            .setFooter({ text: 'Um membro da equipe responderá em breve.' })
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents([
            new ButtonBuilder()
                .setCustomId(`ticket_claim_${ticket._id}`)
                .setLabel('Reclamar')
                .setEmoji('✋')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`ticket_close_${ticket._id}`)
                .setLabel('Fechar')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        ]);

        await channel.send({ content: `${member}`, embeds: [embed], components: [buttons] });

        // Notificar staff
        if (category?.staffSettings?.notifyOnCreate && category.staffSettings.notificationChannelId) {
            const notifChannel = await guild.channels.fetch(category.staffSettings.notificationChannelId);
            if (notifChannel) {
                const notifEmbed = new EmbedBuilder()
                    .setTitle('🎫 Novo Ticket')
                    .setDescription(`Ticket #${String(ticketNumber).padStart(4, '0')} foi criado`)
                    .addFields([
                        { name: 'Usuário', value: `${member}`, inline: true },
                        { name: 'Categoria', value: ticket.categoryName, inline: true },
                        { name: 'Canal', value: `${channel}`, inline: true }
                    ])
                    .setColor('#00FF00')
                    .setTimestamp();

                await notifChannel.send({ embeds: [notifEmbed] });
            }
        }

        // Atualizar estatísticas
        if (category) {
            category.stats.totalTickets++;
            await category.save();
        }

        return { success: true, ticket, channel };
    }

    async claimTicket(ticketId, staffId) {
        const ticket = await TicketEnhanced.findById(ticketId);
        if (!ticket) return null;

        if (!ticket.claimedBy) {
            ticket.claimedBy = staffId;
            ticket.claimedAt = new Date();
            ticket.status = 'answered';
        }

        if (!ticket.staffAssigned.includes(staffId)) {
            ticket.staffAssigned.push(staffId);
        }

        // Registrar primeiro tempo de resposta
        if (!ticket.responseTimes.firstResponse) {
            ticket.responseTimes.firstResponse = new Date();
            ticket.responseTimes.firstResponseTime = Math.floor((Date.now() - ticket.createdAt.getTime()) / 1000 / 60);
        }
        ticket.responseTimes.lastResponse = new Date();

        await ticket.save();
        return ticket;
    }

    async closeTicket(client, ticketId, closedBy, reason = 'Resolvido') {
        const ticket = await TicketEnhanced.findById(ticketId);
        if (!ticket) return null;

        ticket.status = 'closed';
        ticket.closedBy = closedBy;
        ticket.closedAt = new Date();
        ticket.closeReason = reason;

        await ticket.save();

        // Atualizar estatísticas da categoria
        const category = await TicketCategory.findById(ticket.categoryId);
        if (category) {
            const resolutionTime = Math.floor((ticket.closedAt - ticket.createdAt) / 1000 / 60);
            const totalTickets = category.stats.totalTickets;
            category.stats.averageResolutionTime = Math.floor(
                (category.stats.averageResolutionTime * (totalTickets - 1) + resolutionTime) / totalTickets
            );
            await category.save();
        }

        // Gerar transcrição
        if (ticket.transcript.enabled) {
            try {
                const guild = await client.guilds.fetch(ticket.guildId);
                const channel = await guild.channels.fetch(ticket.channelId);

                if (channel) {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    ticket.transcript.messageCount = messages.size;
                    // TODO: Salvar transcrição em arquivo ou serviço externo
                    // ticket.transcript.url = await uploadTranscript(messages);
                }
            } catch (e) {
                console.error('Erro ao gerar transcrição:', e);
            }
        }

        await ticket.save();

        // Pedir avaliação
        try {
            const guild = await client.guilds.fetch(ticket.guildId);
            const channel = await guild.channels.fetch(ticket.channelId);

            const ratingEmbed = new EmbedBuilder()
                .setTitle('⭐ Avalie nosso atendimento')
                .setDescription('Como foi sua experiência com este ticket?')
                .setColor('#FFD700');

            const ratingButtons = new ActionRowBuilder().addComponents([
                new ButtonBuilder().setCustomId(`rating_${ticket._id}_1`).setLabel('1⭐').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`rating_${ticket._id}_2`).setLabel('2⭐').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`rating_${ticket._id}_3`).setLabel('3⭐').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`rating_${ticket._id}_4`).setLabel('4⭐').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`rating_${ticket._id}_5`).setLabel('5⭐').setStyle(ButtonStyle.Success)
            ]);

            await channel.send({ embeds: [ratingEmbed], components: [ratingButtons] });
        } catch (e) {
            console.error('Erro ao enviar pedido de avaliação:', e);
        }

        return ticket;
    }

    async rateTicket(ticketId, score, feedback = null) {
        const ticket = await TicketEnhanced.findById(ticketId);
        if (!ticket) return null;

        ticket.rating = {
            score,
            feedback,
            ratedAt: new Date()
        };

        await ticket.save();
        return ticket;
    }

    async addNote(ticketId, authorId, content) {
        const ticket = await TicketEnhanced.findById(ticketId);
        if (!ticket) return null;

        ticket.notes.push({
            authorId,
            content,
            createdAt: new Date()
        });

        await ticket.save();
        return ticket;
    }

    async getTicketStats(guildId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const tickets = await TicketEnhanced.find({
            guildId,
            createdAt: { $gte: startDate }
        });

        const stats = {
            total: tickets.length,
            byStatus: {},
            byCategory: {},
            byPriority: {},
            averageRating: 0,
            averageResolutionTime: 0,
            totalClosed: 0
        };

        let totalRating = 0;
        let ratedCount = 0;
        let totalResolutionTime = 0;
        let closedCount = 0;

        tickets.forEach(ticket => {
            // Por status
            stats.byStatus[ticket.status] = (stats.byStatus[ticket.status] || 0) + 1;

            // Por categoria
            stats.byCategory[ticket.categoryName] = (stats.byCategory[ticket.categoryName] || 0) + 1;

            // Por prioridade
            stats.byPriority[ticket.priority] = (stats.byPriority[ticket.priority] || 0) + 1;

            // Rating
            if (ticket.rating?.score) {
                totalRating += ticket.rating.score;
                ratedCount++;
            }

            // Tempo de resolução
            if (ticket.status === 'closed' && ticket.closedAt) {
                const resTime = (ticket.closedAt - ticket.createdAt) / 1000 / 60;
                totalResolutionTime += resTime;
                closedCount++;
            }
        });

        stats.averageRating = ratedCount > 0 ? (totalRating / ratedCount).toFixed(2) : 0;
        stats.averageResolutionTime = closedCount > 0 ? Math.floor(totalResolutionTime / closedCount) : 0;
        stats.totalClosed = closedCount;

        return stats;
    }

    async getGuildTickets(guildId, filters = {}) {
        const query = { guildId };

        if (filters.status) query.status = filters.status;
        if (filters.categoryId) query.categoryId = filters.categoryId;
        if (filters.priority) query.priority = filters.priority;
        if (filters.ownerId) query.ownerId = filters.ownerId;

        return await TicketEnhanced.find(query)
            .sort({ createdAt: -1 })
            .limit(filters.limit || 50);
    }
}

module.exports = new TicketEnhancedService();
