// Permitir escolher o backend de storage facilmente via variável de ambiente
if ((process.env.STORAGE_BACKEND || '').toLowerCase() === 'sqlite') {
    module.exports = require('./storage-sqlite');
    return;
}

const fs = require('fs').promises;
const path = require('path');
// Usar a ligação global do mongoose, sem criar uma ligação própria aqui
let useMongo = false;
let TicketModel, GuildConfigModel, TagModel, TicketLogModel;
try {
    const { mongoose, isReady } = require('./db/mongoose');
    ({ TicketModel, GuildConfigModel, TagModel, TicketLogModel } = require('./db/models'));
    // Estado inicial com base na ligação atual
    useMongo = !!isReady();
    if (useMongo) {
        console.log('✅ Mongo pronto (storage)');
    }
    // Acompanhar eventos de ligação para alternar entre Mongo e JSON
    try {
        mongoose.connection.on('connected', () => {
            useMongo = true;
            console.log('✅ Mongo conectado (storage)');
        });
        mongoose.connection.on('disconnected', () => {
            useMongo = false;
            console.warn('⚠️ Mongo desconectado, a usar JSON fallback (storage)');
        });
    } catch {}
} catch (e) {
    console.warn('MongoDB não disponível, a usar JSON storage. Motivo:', e && e.message ? e.message : e);
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

    // Prune generic logs by type older than N milliseconds
    async pruneLogsByTypeOlderThan(guildId, type, olderThanMs) {
        try {
            const logs = await this.readFile(this.logsFile) || [];
            const cutoff = Date.now() - Math.max(0, Number(olderThanMs) || 0);
            const filtered = logs.filter(l => {
                if (guildId && l.guild_id !== guildId) return true; // keep other guilds
                if (type && l.type !== type) return true; // keep other types
                const t = new Date(l.timestamp).getTime();
                return isNaN(t) || t >= cutoff; // keep if recent or invalid date
            });
            // Only write if changed to reduce IO
            if (filtered.length !== logs.length) {
                await this.writeFile(this.logsFile, filtered);
            }
            return { pruned: logs.length - filtered.length };
        } catch (e) {
            console.warn('pruneLogsByTypeOlderThan failed:', e?.message || e);
            return { pruned: 0, error: e?.message || String(e) };
        }
    }

    // Verification metrics since a cutoff ISO string
    async countVerificationMetrics(guildId, sinceIso) {
        const logs = await this.readFile(this.logsFile) || [];
        const cutoff = sinceIso ? new Date(sinceIso).getTime() : (Date.now() - 24*60*60*1000);
        const out = { success: 0, fail: 0, byMethod: {}, failReasons: {} };
        for (const l of logs) {
            if (l.guild_id !== guildId) continue;
            const t = new Date(l.timestamp).getTime();
            if (!(t >= cutoff)) continue;
            if (l.type === 'verification_success') {
                out.success += 1;
                const method = l.message || 'unknown';
                out.byMethod[method] = (out.byMethod[method] || 0) + 1;
            } else if (l.type === 'verification_fail') {
                out.fail += 1;
                const reason = l.message || 'unknown';
                out.failReasons[reason] = (out.failReasons[reason] || 0) + 1;
            }
        }
        return out;
    }

    // Ticket logs (lightweight action history)
    async addTicketLog({ ticket_id, guild_id, actor_id, action, message, data }) {
        if (useMongo && TicketLogModel) {
            const doc = await TicketLogModel.create({ ticket_id: String(ticket_id), guild_id, actor_id, action, message, data, timestamp: new Date() });
            return doc.toObject();
        }
        // JSON fallback: append to logs.json with a namespaced type
        const entry = { id: Date.now(), ticket_id: String(ticket_id), guild_id, actor_id, action, message, data, timestamp: new Date().toISOString(), type: 'ticket_log' };
        const logs = await this.readFile(this.logsFile) || [];
        logs.push(entry);
        if (logs.length > 2000) logs.splice(0, logs.length - 2000);
        await this.writeFile(this.logsFile, logs);
        return entry;
    }

    async getTicketLogs(ticketId, limit = 100, offset = 0) {
        const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 100));
        const safeOffset = Math.max(0, Number(offset) || 0);
        if (useMongo && TicketLogModel) {
            const list = await TicketLogModel
                .find({ ticket_id: String(ticketId) })
                .sort({ timestamp: -1 })
                .skip(safeOffset)
                .limit(safeLimit)
                .lean();
            return list;
        }
        const logs = await this.readFile(this.logsFile) || [];
        const filtered = logs
            .filter(l => (l.type === 'ticket_log') && `${l.ticket_id}` === `${ticketId}`)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return filtered.slice(safeOffset, safeOffset + safeLimit);
    }
}

module.exports = new SimpleStorage();
