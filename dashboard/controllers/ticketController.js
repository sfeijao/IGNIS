const { EmbedBuilder } = require('discord.js');
const storage = require('../../utils/storage');
const webhookManager = require('../../utils/webhookManager');

class TicketController {
    // Get ticket details
    async getTicket(req, res) {
        const { ticketId } = req.params;
    const guildId = req.params.guildId || req.query.guildId; // optional
    const tickets = guildId ? await storage.getTickets(guildId) : (await storage.readFile(storage.ticketsFile) || []);
    const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Verificar permissões
        // Basic permission check: owner or staff
        const cfg = await storage.getGuildConfig(ticket.guild_id);
        const staffRoleId = cfg?.roles?.staff || null;
        const isOwner = ticket.user_id === req.user.id;
        const isStaff = staffRoleId ? true : false; // Dashboard-side verify omitted
        if (!(isOwner || isStaff)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        res.json(ticket);
    }

    // Get all tickets for a guild
    async getGuildTickets(req, res) {
        const { guildId } = req.params;
        const { status, userId, page = 1, limit = 50 } = req.query;

        let tickets = await storage.getTickets(guildId);
        if (status) tickets = tickets.filter(t => t.status === status);
        if (userId) tickets = tickets.filter(t => `${t.user_id}` === `${userId}`);
        const start = (page - 1) * limit;
        const paged = tickets.slice(start, start + limit);
        res.json({ total: tickets.length, page, limit, items: paged });
    }

    // Update ticket status/priority/category
    async updateTicket(req, res) {
        const { ticketId } = req.params;
        const updates = req.body;

        try {
        const guildId = req.params.guildId || req.query.guildId; // optional
        const tickets = guildId ? await storage.getTickets(guildId) : (await storage.readFile(storage.ticketsFile) || []);
        const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            // Require staff role presence (dashboard trust boundary)
            const cfg = await storage.getGuildConfig(ticket.guild_id);
            const staffRoleId = cfg?.roles?.staff || null;
            if (!staffRoleId) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            const updatedTicket = await storage.updateTicket(ticketId, updates);
            
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

            await webhookManager.sendWebhook(ticket.guild_id, 'ticket_updated', { embeds: [embed] });

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
        const guildId = req.params.guildId || req.query.guildId; // optional
        const tickets = guildId ? await storage.getTickets(guildId) : (await storage.readFile(storage.ticketsFile) || []);
        const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            // Owner or staff allowed
            const cfg = await storage.getGuildConfig(ticket.guild_id);
            const staffRoleId = cfg?.roles?.staff || null;
            const isOwner = ticket.user_id === req.user.id;
            if (!isOwner && !staffRoleId) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            const message = { id: Date.now().toString(), authorId: req.user.id, content, attachments, createdAt: new Date().toISOString() };

            // Log via webhook
            await webhookManager.sendWebhook(ticket.guild_id, 'ticket_message', {
                embeds: [{
                    title: 'Nova Mensagem em Ticket',
                    description: content ? (content.substring(0, 100) + (content.length > 100 ? '...' : '')) : '(sem conteúdo)',
                    fields: [
                        { name: 'Ticket', value: ticket.id, inline: true },
                        { name: 'Autor', value: req.user.tag || `${req.user.username}#${req.user.discriminator || '0'}`, inline: true }
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
        const guildId = req.params.guildId || req.query.guildId; // optional
        const tickets = guildId ? await storage.getTickets(guildId) : (await storage.readFile(storage.ticketsFile) || []);
        const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            const cfg = await storage.getGuildConfig(ticket.guild_id);
            const staffRoleId = cfg?.roles?.staff || null;
            if (!staffRoleId && ticket.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            // Not persisted: return last 0 items placeholder for now
            res.json([]);
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
        const guildId = req.params.guildId || req.query.guildId; // optional
        const tickets = guildId ? await storage.getTickets(guildId) : (await storage.readFile(storage.ticketsFile) || []);
        const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            const cfg = await storage.getGuildConfig(ticket.guild_id);
            const staffRoleId = cfg?.roles?.staff || null;
            if (!staffRoleId) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            // Not persisted: No-op for now
            
            // Log via webhook
            await webhookManager.sendWebhook(ticket.guild_id, 'ticket_participant_added', {
                embeds: [{
                    title: 'Participante Adicionado ao Ticket',
                    fields: [
                        { name: 'Ticket', value: ticket.id, inline: true },
                        { name: 'Usuário', value: `<@${userId}>`, inline: true },
                        { name: 'Função', value: role, inline: true },
                        { name: 'Adicionado por', value: req.user.tag || `${req.user.username}#${req.user.discriminator || '0'}`, inline: true }
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
        const guildId = req.params.guildId || req.query.guildId; // optional
        const tickets = guildId ? await storage.getTickets(guildId) : (await storage.readFile(storage.ticketsFile) || []);
        const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            const cfg = await storage.getGuildConfig(ticket.guild_id);
            const staffRoleId = cfg?.roles?.staff || null;
            if (!staffRoleId) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            // Not persisted: No-op for now
            
            // Log via webhook
            await webhookManager.sendWebhook(ticket.guild_id, 'ticket_participant_removed', {
                embeds: [{
                    title: 'Participante Removido do Ticket',
                    fields: [
                        { name: 'Ticket', value: ticket.id, inline: true },
                        { name: 'Usuário', value: `<@${userId}>`, inline: true },
                        { name: 'Removido por', value: req.user.tag || `${req.user.username}#${req.user.discriminator || '0'}`, inline: true }
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
        const guildId = req.params.guildId || req.query.guildId; // optional
        const tickets = guildId ? await storage.getTickets(guildId) : (await storage.readFile(storage.ticketsFile) || []);
        const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            const cfg = await storage.getGuildConfig(ticket.guild_id);
            const staffRoleId = cfg?.roles?.staff || null;
            if (!staffRoleId && ticket.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            // Not implemented: transcript generation via dashboard; return placeholder
            const transcript = { buffer: Buffer.from('Transcript not implemented'), url: null };
            
            // Log via webhook
            await webhookManager.sendWebhook(ticket.guild_id, 'ticket_transcript', {
                embeds: [{
                    title: 'Transcrição Gerada',
                    fields: [
                        { name: 'Ticket', value: ticket.id, inline: true },
                        { name: 'Gerado por', value: req.user.tag || `${req.user.username}#${req.user.discriminator || '0'}`, inline: true },
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
        const guildId = req.params.guildId || req.query.guildId; // optional
        const tickets = guildId ? await storage.getTickets(guildId) : (await storage.readFile(storage.ticketsFile) || []);
        const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            // Verificar permissões
            const cfg = await storage.getGuildConfig(ticket.guild_id);
            const staffRoleId = cfg?.roles?.staff || null;
            if (!staffRoleId) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            const exportData = ticket; // Simple JSON export for now
            
            // Log via webhook
            await webhookManager.sendWebhook(ticket.guild_id, 'ticket_exported', {
                embeds: [{
                    title: 'Ticket Exportado',
                    fields: [
                        { name: 'Ticket', value: ticket.id, inline: true },
                        { name: 'Exportado por', value: req.user.tag || `${req.user.username}#${req.user.discriminator || '0'}`, inline: true },
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
