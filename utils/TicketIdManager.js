const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class TicketIdManager {
    constructor() {
        this.configPath = path.join(__dirname, '../config/ticket-ids.json');
        this.cache = null;
    }

    // Carregar configuração de IDs
    async loadConfig() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.cache = JSON.parse(data);
            return this.cache;
        } catch (error) {
            // Se arquivo não existe, criar estrutura inicial
            this.cache = {
                lastId: 0,
                tickets: {},
                lastUpdated: new Date().toISOString()
            };
            await this.saveConfig();
            return this.cache;
        }
    }

    // Salvar configuração
    async saveConfig() {
        try {
            this.cache.lastUpdated = new Date().toISOString();
            await fs.writeFile(this.configPath, JSON.stringify(this.cache, null, 2), 'utf8');
            logger.info(`✅ IDs de tickets salvos - último ID: ${this.cache.lastId}`);
        } catch (error) {
            logger.error('❌ Erro ao salvar IDs de tickets:', error);
        }
    }

    // Obter próximo ID sequencial
    async getNextId() {
        await this.loadConfig();
        
        this.cache.lastId += 1;
        await this.saveConfig();
        
        logger.info(`🎫 Próximo ID de ticket: ${this.cache.lastId}`);
        return this.cache.lastId;
    }

    // Registrar um ticket com ID sequencial
    async registerTicket(guildId, channelId, userId, sequentialId = null) {
        await this.loadConfig();
        
        // Se não foi fornecido ID sequencial, obter próximo
        const ticketId = sequentialId || await this.getNextId();
        
        // Registrar ticket
        this.cache.tickets[channelId] = {
            sequentialId: ticketId,
            guildId: guildId,
            channelId: channelId,
            userId: userId,
            createdAt: new Date().toISOString()
        };
        
        await this.saveConfig();
        
        logger.info(`📝 Ticket registrado: ID sequencial ${ticketId} para canal ${channelId}`);
        return ticketId;
    }

    // Obter informações do ticket por canal
    async getTicketByChannel(channelId) {
        await this.loadConfig();
        return this.cache.tickets[channelId] || null;
    }

    // Obter informações do ticket por ID sequencial
    async getTicketById(sequentialId) {
        await this.loadConfig();
        
        for (const channelId in this.cache.tickets) {
            const ticket = this.cache.tickets[channelId];
            if (ticket.sequentialId === sequentialId) {
                return ticket;
            }
        }
        
        return null;
    }

    // Remover ticket quando fechado (opcional - pode manter histórico)
    async removeTicket(channelId) {
        await this.loadConfig();
        
        if (this.cache.tickets[channelId]) {
            delete this.cache.tickets[channelId];
            await this.saveConfig();
            logger.info(`🗑️ Ticket removido do registro: canal ${channelId}`);
        }
    }

    // Obter estatísticas
    async getStats() {
        await this.loadConfig();
        
        const totalTickets = this.cache.lastId;
        const activeTickets = Object.keys(this.cache.tickets).length;
        
        return {
            totalTickets,
            activeTickets,
            lastUpdated: this.cache.lastUpdated
        };
    }
}

module.exports = TicketIdManager;