const fs = require('fs').promises;
const path = require('path');
let useMongo = false;
let TicketModel, GuildConfigModel, TagModel;
try {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (MONGO_URI) {
        const { connect } = require('./db/mongoose');
        ({ TicketModel, GuildConfigModel, TagModel } = require('./db/models'));
        connect(MONGO_URI).then(() => {
            console.log('✅ Conectado ao MongoDB (storage)');
            useMongo = true;
        }).catch(err => {
            const msg = err && err.message ? err.message : String(err);
            if (err && err.code === 'MONGO_URI_MALFORMED') {
                console.error('❌ MongoDB URI inválida. A usar fallback JSON. Dica: se a password tiver caracteres especiais (por ex. @ : / ? # [ ]), codifique-a com encodeURIComponent.');
                console.debug(msg);
            } else {
                console.error('❌ Falha ao conectar MongoDB, usando JSON fallback:', msg);
            }
            useMongo = false;
        });
    }
} catch (e) {
    console.warn('MongoDB não disponível, usando JSON storage. Motivo:', e.message);
}

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
            // Ensure directory exists
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            
            // Convert data to JSON string with proper formatting
            const jsonString = JSON.stringify(data, null, 2);
            
            // Write to file
            await fs.writeFile(filePath, jsonString, 'utf8');
            return true;
        } catch (error) {
            console.error('Error writing to file:', error);
            throw new Error(`Failed to write to file: ${error.message}`);
        }
    }
    
    // Ticket methods
    async createTicket(ticketData) {
        if (useMongo && TicketModel) {
            const id = Date.now();
            const doc = await TicketModel.create({
                id,
                guild_id: ticketData.guild_id,
                channel_id: ticketData.channel_id,
                user_id: ticketData.user_id,
                category: ticketData.category || ticketData.type || 'geral',
                subject: ticketData.subject || null,
                description: ticketData.description || null,
                priority: ticketData.priority || 'normal',
                status: 'open',
                created_at: new Date()
            });
            return doc.toObject();
        } else {
            const tickets = await this.readFile(this.ticketsFile) || [];
            const id = Date.now(); // Simple ID generation
            const ticket = {
                id,
                guild_id: ticketData.guild_id,
                channel_id: ticketData.channel_id,
                user_id: ticketData.user_id,
                category: ticketData.category || ticketData.type || 'geral',
                subject: ticketData.subject || null,
                description: ticketData.description || null,
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
    }
    
    async getTickets(guildId) {
        if (useMongo && TicketModel) {
            const docs = await TicketModel.find({ guild_id: guildId }).lean();
            return docs;
        }
        const tickets = await this.readFile(this.ticketsFile) || [];
        return tickets.filter(ticket => ticket.guild_id === guildId);
    }
    
    async getUserActiveTickets(userId, guildId) {
        if (useMongo && TicketModel) {
            return await TicketModel.find({ guild_id: guildId, user_id: userId, status: 'open' }).lean();
        }
        const tickets = await this.readFile(this.ticketsFile) || [];
        return tickets.filter(ticket => ticket.guild_id === guildId && ticket.user_id === userId && ticket.status === 'open');
    }
    
    async getTicketByChannel(channelId) {
        if (useMongo && TicketModel) {
            return await TicketModel.findOne({ channel_id: channelId }).lean();
        }
        const tickets = await this.readFile(this.ticketsFile) || [];
        return tickets.find(ticket => ticket.channel_id === channelId);
    }
    
    async updateTicket(ticketId, updates) {
        if (useMongo && TicketModel) {
            const updated = await TicketModel.findOneAndUpdate({ id: ticketId }, { $set: updates }, { new: true }).lean();
            return updated;
        }
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
        if (useMongo && GuildConfigModel) {
            const doc = await GuildConfigModel.findOne({ guild_id: guildId }).lean();
            const data = doc?.data || {};
            return key ? data[key] : data;
        }
        const config = await this.readFile(this.configFile) || {};
        const guildConfig = config[guildId] || {};
        return key ? guildConfig[key] : guildConfig;
    }
    
    async setGuildConfig(guildId, key, value) {
        if (useMongo && GuildConfigModel) {
            const doc = await GuildConfigModel.findOneAndUpdate(
                { guild_id: guildId },
                { $set: { [`data.${key}`]: value } },
                { upsert: true, new: true }
            );
            return !!doc;
        }
        const config = await this.readFile(this.configFile) || {};
        if (!config[guildId]) config[guildId] = {};
        config[guildId][key] = value;
        await this.writeFile(this.configFile, config);
        return true;
    }

    async updateGuildConfig(guildId, updates) {
        if (useMongo && GuildConfigModel) {
            const doc = await GuildConfigModel.findOne({ guild_id: guildId });
            const current = doc?.data || {};
            const merged = { ...current, ...updates };
            const saved = await GuildConfigModel.findOneAndUpdate(
                { guild_id: guildId },
                { $set: { data: merged } },
                { upsert: true, new: true }
            ).lean();
            return saved.data;
        }
        const config = await this.readFile(this.configFile) || {};
        if (!config[guildId]) config[guildId] = {};
        config[guildId] = { ...config[guildId], ...updates };
        await this.writeFile(this.configFile, config);
        return config[guildId];
    }
    
    // Tags methods
    async getUserTags(guildId, userId) {
        if (useMongo && TagModel) {
            const doc = await TagModel.findOne({ guild_id: guildId, user_id: userId }).lean();
            return doc?.tags || [];
        }
        const tags = await this.readFile(this.tagsFile) || {};
        const guildTags = tags[guildId] || {};
        return guildTags[userId] || [];
    }
    
    async addUserTag(guildId, userId, tag) {
        if (useMongo && TagModel) {
            await TagModel.findOneAndUpdate(
                { guild_id: guildId, user_id: userId },
                { $addToSet: { tags: tag } },
                { upsert: true }
            );
            return true;
        }
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
        if (useMongo && TagModel) {
            await TagModel.findOneAndUpdate(
                { guild_id: guildId, user_id: userId },
                { $pull: { tags: tag } },
                { upsert: true }
            );
            return true;
        }
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
