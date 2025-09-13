const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class TicketDatabase {
    constructor() {
        this.ticketsPath = path.join(__dirname, '../data/tickets-advanced.json');
        this.tickets = new Map();
        this.init();
    }

    async init() {
        try {
            await this.loadTickets();
        } catch (error) {
            logger.error('Erro ao inicializar TicketDatabase:', error);
            this.tickets = new Map();
        }
    }

    async loadTickets() {
        try {
            const data = await fs.readFile(this.ticketsPath, 'utf8');
            const ticketsObj = JSON.parse(data);
            this.tickets = new Map(Object.entries(ticketsObj));
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error('Erro ao carregar tickets:', error);
            }
            this.tickets = new Map();
        }
    }

    async saveTickets() {
        try {
            const ticketsObj = Object.fromEntries(this.tickets);
            await fs.writeFile(this.ticketsPath, JSON.stringify(ticketsObj, null, 2));
        } catch (error) {
            logger.error('Erro ao salvar tickets:', error);
        }
    }

    // Criar novo ticket
    async createTicket(ticketData) {
        const ticket = {
            ticketId: ticketData.ticketId,
            channelId: ticketData.channelId,
            guildId: ticketData.guildId,
            ownerId: ticketData.ownerId,
            category: ticketData.category || 'Geral',
            status: 'aberto',
            claimedBy: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            closedAt: null,
            priority: ticketData.priority || 'normal',
            language: ticketData.language || 'pt',
            notes: [],
            logs: [{
                type: 'created',
                by: ticketData.ownerId,
                at: new Date().toISOString(),
                extra: { category: ticketData.category }
            }],
            transcripts: [],
            escalated: false,
            locked: false,
            closeReason: null,
            closedBy: null
        };

        this.tickets.set(ticketData.ticketId, ticket);
        await this.saveTickets();
        return ticket;
    }

    // Obter ticket
    getTicket(ticketId) {
        return this.tickets.get(ticketId);
    }

    // Atualizar ticket
    async updateTicket(ticketId, updates) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;

        Object.assign(ticket, updates);
        ticket.updatedAt = new Date().toISOString();
        
        this.tickets.set(ticketId, ticket);
        await this.saveTickets();
        return ticket;
    }

    // Claim ticket
    async claimTicket(ticketId, staffId) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;

        ticket.claimedBy = staffId;
        ticket.status = 'em_atendimento';
        ticket.updatedAt = new Date().toISOString();
        ticket.logs.push({
            type: 'claimed',
            by: staffId,
            at: new Date().toISOString()
        });

        this.tickets.set(ticketId, ticket);
        await this.saveTickets();
        return ticket;
    }

    // Fechar ticket
    async closeTicket(ticketId, closedBy, reason = null) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;

        ticket.status = 'fechado';
        ticket.closedAt = new Date().toISOString();
        ticket.closedBy = closedBy;
        ticket.closeReason = reason;
        ticket.updatedAt = new Date().toISOString();
        ticket.logs.push({
            type: 'closed',
            by: closedBy,
            at: new Date().toISOString(),
            extra: { reason }
        });

        this.tickets.set(ticketId, ticket);
        await this.saveTickets();
        return ticket;
    }

    // Adicionar nota interna
    async addNote(ticketId, staffId, text) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;

        const note = {
            by: staffId,
            text: text,
            at: new Date().toISOString()
        };

        ticket.notes.push(note);
        ticket.updatedAt = new Date().toISOString();
        ticket.logs.push({
            type: 'note_added',
            by: staffId,
            at: new Date().toISOString(),
            extra: { noteIndex: ticket.notes.length - 1 }
        });

        this.tickets.set(ticketId, ticket);
        await this.saveTickets();
        return ticket;
    }

    // Transferir categoria
    async transferCategory(ticketId, staffId, newCategory) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;

        const oldCategory = ticket.category;
        ticket.category = newCategory;
        ticket.updatedAt = new Date().toISOString();
        ticket.logs.push({
            type: 'transferred',
            by: staffId,
            at: new Date().toISOString(),
            extra: { from: oldCategory, to: newCategory }
        });

        this.tickets.set(ticketId, ticket);
        await this.saveTickets();
        return ticket;
    }

    // Escalar ticket
    async escalateTicket(ticketId, staffId) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;

        ticket.escalated = true;
        ticket.priority = 'alta';
        ticket.updatedAt = new Date().toISOString();
        ticket.logs.push({
            type: 'escalated',
            by: staffId,
            at: new Date().toISOString()
        });

        this.tickets.set(ticketId, ticket);
        await this.saveTickets();
        return ticket;
    }

    // Lock/Unlock ticket
    async toggleLock(ticketId, staffId) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;

        ticket.locked = !ticket.locked;
        ticket.updatedAt = new Date().toISOString();
        ticket.logs.push({
            type: ticket.locked ? 'locked' : 'unlocked',
            by: staffId,
            at: new Date().toISOString()
        });

        this.tickets.set(ticketId, ticket);
        await this.saveTickets();
        return ticket;
    }

    // Adicionar transcript
    async addTranscript(ticketId, transcriptData) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;

        ticket.transcripts.push({
            generatedAt: new Date().toISOString(),
            ...transcriptData
        });

        ticket.updatedAt = new Date().toISOString();
        this.tickets.set(ticketId, ticket);
        await this.saveTickets();
        return ticket;
    }

    // Obter tickets por estado
    getTicketsByStatus(status) {
        return Array.from(this.tickets.values()).filter(ticket => ticket.status === status);
    }

    // Obter tickets por utilizador
    getTicketsByUser(userId) {
        return Array.from(this.tickets.values()).filter(ticket => ticket.ownerId === userId);
    }

    // Obter estatísticas
    getStats() {
        const allTickets = Array.from(this.tickets.values());
        return {
            total: allTickets.length,
            abertos: allTickets.filter(t => t.status === 'aberto').length,
            emAtendimento: allTickets.filter(t => t.status === 'em_atendimento').length,
            fechados: allTickets.filter(t => t.status === 'fechado').length,
            escalados: allTickets.filter(t => t.escalated).length
        };
    }

    // Calcular tempo desde criação
    getTimeSinceCreation(ticketId) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return null;

        const now = new Date();
        const created = new Date(ticket.createdAt);
        const diff = now - created;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
}

module.exports = TicketDatabase;