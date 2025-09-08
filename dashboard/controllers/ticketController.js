const { EmbedBuilder } = require('discord.js');
const ticketManager = require('../../utils/ticketManager');
const webhookManager = require('../../utils/webhookManager');

class TicketController {
    // Get ticket details
    async getTicket(req, res) {
        const { ticketId } = req.params;
        const ticket = await ticketManager.getTicket(ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Verificar permissões
        if (!await ticketManager.canViewTicket(req.user.id, ticket)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        res.json(ticket);
    }

    // Get all tickets for a guild
    async getGuildTickets(req, res) {
        const { guildId } = req.params;
        const { status, userId, page = 1, limit = 50 } = req.query;

        const tickets = await ticketManager.getGuildTickets(guildId, {
            status,
            userId,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json(tickets);
    }

    // Update ticket status/priority/category
    async updateTicket(req, res) {
        const { ticketId } = req.params;
        const updates = req.body;

        try {
            const ticket = await ticketManager.getTicket(ticketId);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            if (!await ticketManager.canManageTicket(req.user.id, ticket)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            const updatedTicket = await ticketManager.updateTicket(ticketId, updates);
            
            // Enviar webhook de atualização
            const embed = new EmbedBuilder()
                .setTitle('Ticket Atualizado')
                .addFields(
                    { name: 'Ticket ID', value: ticketId, inline: true },
                    { name: 'Atualizado por', value: req.user.tag, inline: true }
                )
                .setColor(0x0099ff)
                .setTimestamp();

            if (updates.status) {
                embed.addFields({ name: 'Novo Status', value: updates.status, inline: true });
            }
            if (updates.priority) {
                embed.addFields({ name: 'Nova Prioridade', value: updates.priority, inline: true });
            }

            await webhookManager.sendWebhook(ticket.guildId, 'ticket_updated', { embeds: [embed] });

            res.json(updatedTicket);
        } catch (error) {
            console.error('Error updating ticket:', error);
            res.status(500).json({ error: 'Failed to update ticket' });
        }
    }

    // Add message to ticket
    async addMessage(req, res) {
        const { ticketId } = req.params;
        const { content, attachments } = req.body;

        try {
            const ticket = await ticketManager.getTicket(ticketId);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            if (!await ticketManager.canMessage(req.user.id, ticket)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            const message = await ticketManager.addMessage(ticketId, {
                authorId: req.user.id,
                content,
                attachments
            });

            // Log via webhook
            await webhookManager.sendWebhook(ticket.guildId, 'ticket_message', {
                embeds: [{
                    title: 'Nova Mensagem em Ticket',
                    description: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
                    fields: [
                        { name: 'Ticket', value: ticket.id, inline: true },
                        { name: 'Autor', value: req.user.tag, inline: true }
                    ],
                    color: 0x00ff00,
                    timestamp: new Date()
                }]
            });

            res.json(message);
        } catch (error) {
            console.error('Error adding message:', error);
            res.status(500).json({ error: 'Failed to add message' });
        }
    }

    // Get ticket messages
    async getMessages(req, res) {
        const { ticketId } = req.params;
        const { before, limit = 50 } = req.query;

        try {
            const ticket = await ticketManager.getTicket(ticketId);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            if (!await ticketManager.canViewTicket(req.user.id, ticket)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            const messages = await ticketManager.getMessages(ticketId, {
                before,
                limit: parseInt(limit)
            });

            res.json(messages);
        } catch (error) {
            console.error('Error getting messages:', error);
            res.status(500).json({ error: 'Failed to get messages' });
        }
    }

    // Add participant to ticket
    async addParticipant(req, res) {
        const { ticketId } = req.params;
        const { userId, role } = req.body;

        try {
            const ticket = await ticketManager.getTicket(ticketId);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            if (!await ticketManager.canManageTicket(req.user.id, ticket)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            await ticketManager.addParticipant(ticketId, userId, role);
            
            // Log via webhook
            await webhookManager.sendWebhook(ticket.guildId, 'ticket_participant_added', {
                embeds: [{
                    title: 'Participante Adicionado ao Ticket',
                    fields: [
                        { name: 'Ticket', value: ticket.id, inline: true },
                        { name: 'Usuário', value: `<@${userId}>`, inline: true },
                        { name: 'Função', value: role, inline: true },
                        { name: 'Adicionado por', value: req.user.tag, inline: true }
                    ],
                    color: 0x00ff00,
                    timestamp: new Date()
                }]
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Error adding participant:', error);
            res.status(500).json({ error: 'Failed to add participant' });
        }
    }

    // Remove participant from ticket
    async removeParticipant(req, res) {
        const { ticketId, userId } = req.params;

        try {
            const ticket = await ticketManager.getTicket(ticketId);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            if (!await ticketManager.canManageTicket(req.user.id, ticket)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            await ticketManager.removeParticipant(ticketId, userId);
            
            // Log via webhook
            await webhookManager.sendWebhook(ticket.guildId, 'ticket_participant_removed', {
                embeds: [{
                    title: 'Participante Removido do Ticket',
                    fields: [
                        { name: 'Ticket', value: ticket.id, inline: true },
                        { name: 'Usuário', value: `<@${userId}>`, inline: true },
                        { name: 'Removido por', value: req.user.tag, inline: true }
                    ],
                    color: 0xff0000,
                    timestamp: new Date()
                }]
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Error removing participant:', error);
            res.status(500).json({ error: 'Failed to remove participant' });
        }
    }

    // Generate ticket transcript
    async generateTranscript(req, res) {
        const { ticketId } = req.params;
        const { format = 'html' } = req.query;

        try {
            const ticket = await ticketManager.getTicket(ticketId);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            if (!await ticketManager.canViewTicket(req.user.id, ticket)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            const transcript = await ticketManager.generateTranscript(ticketId, format);
            
            // Log via webhook
            await webhookManager.sendWebhook(ticket.guildId, 'ticket_transcript', {
                embeds: [{
                    title: 'Transcrição Gerada',
                    fields: [
                        { name: 'Ticket', value: ticket.id, inline: true },
                        { name: 'Gerado por', value: req.user.tag, inline: true },
                        { name: 'Formato', value: format.toUpperCase(), inline: true }
                    ],
                    color: 0x0099ff,
                    timestamp: new Date()
                }],
                files: [{
                    attachment: transcript.buffer,
                    name: `ticket-${ticketId}.${format}`
                }]
            });

            res.json({
                url: transcript.url,
                format
            });
        } catch (error) {
            console.error('Error generating transcript:', error);
            res.status(500).json({ error: 'Failed to generate transcript' });
        }
    }

    // Export ticket data
    async exportTicket(req, res) {
        const { ticketId } = req.params;
        const { format = 'json' } = req.query;

        try {
            const ticket = await ticketManager.getTicket(ticketId);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            if (!await ticketManager.canManageTicket(req.user.id, ticket)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            const exportData = await ticketManager.exportTicket(ticketId, format);
            
            // Log via webhook
            await webhookManager.sendWebhook(ticket.guildId, 'ticket_exported', {
                embeds: [{
                    title: 'Ticket Exportado',
                    fields: [
                        { name: 'Ticket', value: ticket.id, inline: true },
                        { name: 'Exportado por', value: req.user.tag, inline: true },
                        { name: 'Formato', value: format.toUpperCase(), inline: true }
                    ],
                    color: 0x0099ff,
                    timestamp: new Date()
                }]
            });

            if (format === 'json') {
                res.json(exportData);
            } else {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=ticket-${ticketId}.${format}`);
                res.send(exportData);
            }
        } catch (error) {
            console.error('Error exporting ticket:', error);
            res.status(500).json({ error: 'Failed to export ticket' });
        }
    }
}

module.exports = new TicketController();
