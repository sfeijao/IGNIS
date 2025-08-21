const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, 'ysnm_dashboard.db');
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Erro ao conectar com a base de dados:', err);
                    reject(err);
                } else {
                    console.log('✅ Conectado à base de dados SQLite');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            this.db.exec(schema, (err) => {
                if (err) {
                    console.error('❌ Erro ao criar tabelas:', err);
                    reject(err);
                } else {
                    console.log('✅ Tabelas criadas/verificadas com sucesso');
                    resolve();
                }
            });
        });
    }

    // User management
    async createUser(userData) {
        const { discord_id, username, discriminator, avatar, email, global_name } = userData;
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO users 
                (discord_id, username, discriminator, avatar, email, global_name, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run([discord_id, username, discriminator, avatar, email, global_name], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, discord_id });
                }
            });
            stmt.finalize();
        });
    }

    async getUserByDiscordId(discordId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Guild management
    async createGuild(guildData) {
        const { discord_id, name, icon, owner_id, member_count } = guildData;
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO guilds 
                (discord_id, name, icon, owner_id, member_count, updated_at) 
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run([discord_id, name, icon, owner_id, member_count], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, discord_id });
                }
            });
            stmt.finalize();
        });
    }

    // Moderation actions
    async createModerationAction(actionData) {
        const { guild_id, user_id, moderator_id, action_type, reason, duration, expires_at, metadata } = actionData;
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO moderation_actions 
                (guild_id, user_id, moderator_id, action_type, reason, duration, expires_at, metadata) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([guild_id, user_id, moderator_id, action_type, reason, duration, expires_at, JSON.stringify(metadata || {})], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
            stmt.finalize();
        });
    }

    async getModerationHistory(guildId, userId = null, limit = 50) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT ma.*, u.username, u.avatar, m.username as moderator_name 
                FROM moderation_actions ma
                LEFT JOIN users u ON ma.user_id = u.discord_id
                LEFT JOIN users m ON ma.moderator_id = m.discord_id
                WHERE ma.guild_id = ?
            `;
            const params = [guildId];

            if (userId) {
                query += ' AND ma.user_id = ?';
                params.push(userId);
            }

            query += ' ORDER BY ma.created_at DESC LIMIT ?';
            params.push(limit);

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Tickets
    async createTicket(ticketData) {
        const { guild_id, channel_id, user_id, category, subject, description } = ticketData;
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO tickets 
                (guild_id, channel_id, user_id, category, subject, description) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([guild_id, channel_id, user_id, category, subject, description], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
            stmt.finalize();
        });
    }

    async getTickets(guildId, status = null) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT t.*, u.username, u.avatar, a.username as assigned_name 
                FROM tickets t
                LEFT JOIN users u ON t.user_id = u.discord_id
                LEFT JOIN users a ON t.assigned_to = a.discord_id
                WHERE t.guild_id = ?
            `;
            const params = [guildId];

            if (status) {
                query += ' AND t.status = ?';
                params.push(status);
            }

            query += ' ORDER BY t.created_at DESC';

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async updateTicketStatus(ticketId, status, closedBy = null, closedReason = null) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE tickets 
                SET status = ?, closed_by = ?, closed_reason = ?, closed_at = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            
            const closedAt = status === 'closed' ? new Date().toISOString() : null;
            stmt.run([status, closedBy, closedReason, closedAt, ticketId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
            stmt.finalize();
        });
    }

    async updateTicket(ticketId, updates) {
        return new Promise((resolve, reject) => {
            const fields = Object.keys(updates);
            const values = Object.values(updates);
            const setClause = fields.map(field => `${field} = ?`).join(', ');
            
            const stmt = this.db.prepare(`
                UPDATE tickets 
                SET ${setClause}
                WHERE id = ?
            `);
            
            stmt.run([...values, ticketId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
            stmt.finalize();
        });
    }

    async getTicketStats(guildId) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                SELECT 
                    COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
                    COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned,
                    COUNT(CASE WHEN status = 'closed' AND DATE(created_at) = DATE('now') THEN 1 END) as closedToday,
                    COUNT(CASE WHEN priority = 'urgent' AND status IN ('open', 'assigned') THEN 1 END) as urgent
                FROM tickets 
                WHERE guild_id = ?
            `);
            
            stmt.get([guildId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || { open: 0, assigned: 0, closedToday: 0, urgent: 0 });
                }
            });
            stmt.finalize();
        });
    }

    // Analytics
    async recordAnalytics(guildId, type, value = 1, metadata = {}) {
        const date = new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO analytics 
                (guild_id, type, date, hour, value, metadata) 
                VALUES (?, ?, ?, ?, COALESCE((SELECT value FROM analytics WHERE guild_id = ? AND type = ? AND date = ? AND hour = ?), 0) + ?, ?)
            `);
            
            stmt.run([guildId, type, date, hour, guildId, type, date, hour, value, JSON.stringify(metadata)], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
            stmt.finalize();
        });
    }

    async getAnalytics(guildId, type, days = 7) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT date, SUM(value) as total_value
                FROM analytics 
                WHERE guild_id = ? AND type = ? AND date >= date('now', '-${days} days')
                GROUP BY date
                ORDER BY date ASC
            `;

            this.db.all(query, [guildId, type], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Warnings
    async createWarning(warningData) {
        const { guild_id, user_id, moderator_id, reason, severity, expires_at } = warningData;
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO warnings 
                (guild_id, user_id, moderator_id, reason, severity, expires_at) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([guild_id, user_id, moderator_id, reason, severity, expires_at], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
            stmt.finalize();
        });
    }

    async getUserWarnings(guildId, userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT w.*, m.username as moderator_name 
                FROM warnings w
                LEFT JOIN users m ON w.moderator_id = m.discord_id
                WHERE w.guild_id = ? AND w.user_id = ? AND w.is_active = 1
                ORDER BY w.created_at DESC
            `;

            this.db.all(query, [guildId, userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Settings
    async setSetting(guildId, category, key, value, type = 'string') {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO guild_settings 
                (guild_id, category, key, value, type, updated_at) 
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run([guildId, category, key, value, type], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
            stmt.finalize();
        });
    }

    async getSetting(guildId, category, key) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM guild_settings WHERE guild_id = ? AND category = ? AND key = ?',
                [guildId, category, key],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    async getSettingsByCategory(guildId, category) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM guild_settings WHERE guild_id = ? AND category = ?',
                [guildId, category],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    // Logs
    async createLog(logData) {
        const { guild_id, type, user_id, channel_id, target_id, data } = logData;
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO logs 
                (guild_id, type, user_id, channel_id, target_id, data) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([guild_id, type, user_id, channel_id, target_id, JSON.stringify(data || {})], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
            stmt.finalize();
        });
    }

    async getLogs(guildId, type = null, limit = 100) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT l.*, u.username, u.avatar 
                FROM logs l
                LEFT JOIN users u ON l.user_id = u.discord_id
                WHERE l.guild_id = ?
            `;
            const params = [guildId];

            if (type) {
                query += ' AND l.type = ?';
                params.push(type);
            }

            query += ' ORDER BY l.created_at DESC LIMIT ?';
            params.push(limit);

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Erro ao fechar base de dados:', err);
                } else {
                    console.log('✅ Base de dados fechada');
                }
            });
        }
    }
}

module.exports = Database;
