const fs = require('fs').promises;
const path = require('path');

class SimpleStorage {
    constructor() {
        this.storageDir = path.join(__dirname, '..', 'data');
        this.ticketsFile = path.join(this.storageDir, 'tickets.json');
        this.configFile = path.join(this.storageDir, 'config.json');
        this.tagsFile = path.join(this.storageDir, 'tags.json');
        this.logsFile = path.join(this.storageDir, 'logs.json');
        
        this.init();
    }
    
    async init() {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
            
            // Initialize files if they don't exist
            await this.ensureFileExists(this.ticketsFile, []);
            await this.ensureFileExists(this.configFile, {});
            await this.ensureFileExists(this.tagsFile, {});
            await this.ensureFileExists(this.logsFile, []);
        } catch (error) {
            console.error('Storage initialization error:', error);
        }
    }
    
    async ensureFileExists(filePath, defaultData) {
        try {
            await fs.access(filePath);
        } catch {
            await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
        }
    }
    
    async readFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch {
            return null;
        }
    }
    
    async writeFile(filePath, data) {
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Write error:', error);
            return false;
        }
    }
    
    // Ticket methods
    async createTicket(ticketData) {
        const tickets = await this.readFile(this.ticketsFile) || [];
        const id = Date.now(); // Simple ID generation
        
        const ticket = {
            id,
            guild_id: ticketData.guild_id,
            channel_id: ticketData.channel_id,
            user_id: ticketData.user_id,
            category: ticketData.category || 'geral',
            subject: ticketData.subject,
            description: ticketData.description,
            priority: ticketData.priority || 'normal',
            status: 'open',
            created_at: new Date().toISOString(),
            assigned_to: null,
            closed_at: null
        };
        
        tickets.push(ticket);
        await this.writeFile(this.ticketsFile, tickets);
        
        return ticket;
    }
    
    async getTickets(guildId) {
        const tickets = await this.readFile(this.ticketsFile) || [];
        return tickets.filter(ticket => ticket.guild_id === guildId);
    }
    
    async getUserActiveTickets(userId, guildId) {
        const tickets = await this.readFile(this.ticketsFile) || [];
        return tickets.filter(ticket => 
            ticket.guild_id === guildId && 
            ticket.user_id === userId && 
            ticket.status === 'open'
        );
    }
    
    async getTicketByChannel(channelId) {
        const tickets = await this.readFile(this.ticketsFile) || [];
        return tickets.find(ticket => ticket.channel_id === channelId);
    }
    
    async updateTicket(ticketId, updates) {
        const tickets = await this.readFile(this.ticketsFile) || [];
        const ticketIndex = tickets.findIndex(ticket => ticket.id === ticketId);
        
        if (ticketIndex === -1) return null;
        
        tickets[ticketIndex] = { ...tickets[ticketIndex], ...updates };
        await this.writeFile(this.ticketsFile, tickets);
        
        return tickets[ticketIndex];
    }
    
    async closeTicket(ticketId) {
        return this.updateTicket(ticketId, {
            status: 'closed',
            closed_at: new Date().toISOString()
        });
    }
    
    // Config methods
    async getGuildConfig(guildId, key) {
        const config = await this.readFile(this.configFile) || {};
        const guildConfig = config[guildId] || {};
        return guildConfig[key] || null;
    }
    
    async setGuildConfig(guildId, key, value) {
        const config = await this.readFile(this.configFile) || {};
        if (!config[guildId]) config[guildId] = {};
        config[guildId][key] = value;
        await this.writeFile(this.configFile, config);
        return true;
    }

    async updateGuildConfig(guildId, updates) {
        const config = await this.readFile(this.configFile) || {};
        if (!config[guildId]) config[guildId] = {};
        
        // Atualizar as configurações
        config[guildId] = {
            ...config[guildId],
            ...updates
        };
        
        await this.writeFile(this.configFile, config);
        return config[guildId];
    }
    
    // Tags methods
    async getUserTags(guildId, userId) {
        const tags = await this.readFile(this.tagsFile) || {};
        const guildTags = tags[guildId] || {};
        return guildTags[userId] || [];
    }
    
    async addUserTag(guildId, userId, tag) {
        const tags = await this.readFile(this.tagsFile) || {};
        if (!tags[guildId]) tags[guildId] = {};
        if (!tags[guildId][userId]) tags[guildId][userId] = [];
        
        if (!tags[guildId][userId].includes(tag)) {
            tags[guildId][userId].push(tag);
            await this.writeFile(this.tagsFile, tags);
        }
        return true;
    }
    
    async removeUserTag(guildId, userId, tag) {
        const tags = await this.readFile(this.tagsFile) || {};
        if (!tags[guildId] || !tags[guildId][userId]) return false;
        
        tags[guildId][userId] = tags[guildId][userId].filter(t => t !== tag);
        await this.writeFile(this.tagsFile, tags);
        return true;
    }
    
    // Log methods
    async addLog(logData) {
        const logs = await this.readFile(this.logsFile) || [];
        const log = {
            id: Date.now(),
            ...logData,
            timestamp: new Date().toISOString()
        };
        
        logs.push(log);
        
        // Keep only last 1000 logs
        if (logs.length > 1000) {
            logs.splice(0, logs.length - 1000);
        }
        
        await this.writeFile(this.logsFile, logs);
        return log;
    }
    
    async getLogs(guildId, limit = 50) {
        const logs = await this.readFile(this.logsFile) || [];
        return logs
            .filter(log => log.guild_id === guildId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }
}

module.exports = new SimpleStorage();
