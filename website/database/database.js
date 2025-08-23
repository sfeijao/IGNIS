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
                    
                    // Verificar e corrigir estrutura da tabela logs se necessário
                    this.fixLogsTable()
                        .then(() => resolve())
                        .catch(reject);
                }
            });
        });
    }

    async fixLogsTable() {
        return new Promise((resolve, reject) => {
            // Verificar se a coluna timestamp existe na tabela logs
            this.db.all("PRAGMA table_info(logs)", (err, rows) => {
                if (err) {
                    console.error('❌ Erro ao verificar estrutura da tabela logs:', err);
                    reject(err);
                    return;
                }

                const hasTimestamp = rows.some(row => row.name === 'timestamp');
                
                if (!hasTimestamp) {
                    console.log('🔧 Adicionando coluna timestamp à tabela logs...');
                    
                    // Adicionar coluna timestamp se não existir
                    this.db.run(
                        "ALTER TABLE logs ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP",
                        (err) => {
                            if (err) {
                                console.error('❌ Erro ao adicionar coluna timestamp:', err);
                                reject(err);
                            } else {
                                console.log('✅ Coluna timestamp adicionada com sucesso');
                                
                                // Atualizar registos existentes sem timestamp
                                this.db.run(
                                    "UPDATE logs SET timestamp = CURRENT_TIMESTAMP WHERE timestamp IS NULL",
                                    (err) => {
                                        if (err) {
                                            console.error('⚠️ Aviso ao atualizar timestamps:', err);
                                        } else {
                                            console.log('✅ Timestamps atualizados');
                                        }
                                        // Continuar com a migração dos tickets
                                        this.migrateTicketsTable()
                                            .then(() => resolve())
                                            .catch(reject);
                                    }
                                );
                            }
                        }
                    );
                } else {
                    console.log('✅ Estrutura da tabela logs está correta');
                    // Verificar tickets mesmo se logs estiver correto
                    this.migrateTicketsTable()
                        .then(() => resolve())
                        .catch(reject);
                }
            });
        });
    }

    async migrateTicketsTable() {
        return new Promise((resolve, reject) => {
            // Verificar estrutura da tabela tickets
            this.db.all("PRAGMA table_info(tickets)", (err, rows) => {
                if (err) {
                    console.error('❌ Erro ao verificar estrutura da tabela tickets:', err);
                    reject(err);
                    return;
                }

                const hasTitle = rows.some(row => row.name === 'title');
                const hasSeverity = rows.some(row => row.name === 'severity');
                
                let promises = [];
                
                // Adicionar coluna title se não existir
                if (!hasTitle) {
                    console.log('🔧 Adicionando coluna title à tabela tickets...');
                    promises.push(new Promise((res, rej) => {
                        this.db.run(
                            "ALTER TABLE tickets ADD COLUMN title TEXT",
                            (err) => {
                                if (err) {
                                    console.error('❌ Erro ao adicionar coluna title:', err);
                                    rej(err);
                                } else {
                                    console.log('✅ Coluna title adicionada com sucesso');
                                    res();
                                }
                            }
                        );
                    }));
                }
                
                // Adicionar coluna severity se não existir
                if (!hasSeverity) {
                    console.log('🔧 Adicionando coluna severity à tabela tickets...');
                    promises.push(new Promise((res, rej) => {
                        this.db.run(
                            "ALTER TABLE tickets ADD COLUMN severity TEXT DEFAULT 'medium'",
                            (err) => {
                                if (err) {
                                    console.error('❌ Erro ao adicionar coluna severity:', err);
                                    rej(err);
                                } else {
                                    console.log('✅ Coluna severity adicionada com sucesso');
                                    res();
                                }
                            }
                        );
                    }));
                }
                
                // Criar tabela ticket_users se não existir
                promises.push(new Promise((res, rej) => {
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS ticket_users (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            ticket_id INTEGER NOT NULL,
                            user_id TEXT NOT NULL,
                            added_by TEXT,
                            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
                            FOREIGN KEY (user_id) REFERENCES users(discord_id),
                            FOREIGN KEY (added_by) REFERENCES users(discord_id),
                            UNIQUE(ticket_id, user_id)
                        )
                    `, (err) => {
                        if (err) {
                            console.error('❌ Erro ao criar tabela ticket_users:', err);
                            rej(err);
                        } else {
                            console.log('✅ Tabela ticket_users criada/verificada com sucesso');
                            res();
                        }
                    });
                }));
                
                // Executar todas as migrações
                Promise.all(promises)
                    .then(() => {
                        console.log('✅ Migração da tabela tickets concluída');
                        resolve();
                    })
                    .catch(reject);
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
        const { guild_id, channel_id, user_id, category, title, subject, description, severity = 'medium' } = ticketData;
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO tickets 
                (guild_id, channel_id, user_id, category, title, subject, description, severity) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([guild_id, channel_id, user_id, category, title, subject, description, severity], function(err) {
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

            this.db.all(query, params, async (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Para cada ticket, buscar os usuários associados
                    const ticketsWithUsers = await Promise.all(rows.map(async (ticket) => {
                        const users = await this.getTicketUsers(ticket.id);
                        return {
                            ...ticket,
                            users: users
                        };
                    }));
                    resolve(ticketsWithUsers);
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

    // Atualizar severidade do ticket
    async updateTicketSeverity(ticketId, severity) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE tickets 
                SET severity = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `);
            
            stmt.run([severity, ticketId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
            stmt.finalize();
        });
    }

    // Adicionar usuário ao ticket
    async addUserToTicket(ticketId, userId) {
        return new Promise((resolve, reject) => {
            // Primeiro verificar se já existe
            const checkStmt = this.db.prepare(`
                SELECT id FROM ticket_users 
                WHERE ticket_id = ? AND user_id = ?
            `);
            
            checkStmt.get([ticketId, userId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (row) {
                    // Usuário já está no ticket
                    resolve({ changes: 0, message: 'Usuário já está no ticket' });
                    return;
                }
                
                // Adicionar usuário
                const insertStmt = this.db.prepare(`
                    INSERT INTO ticket_users (ticket_id, user_id, added_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                `);
                
                insertStmt.run([ticketId, userId], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes, id: this.lastID });
                    }
                });
                insertStmt.finalize();
            });
            checkStmt.finalize();
        });
    }

    // Remover usuário do ticket
    async removeUserFromTicket(ticketId, userId) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                DELETE FROM ticket_users 
                WHERE ticket_id = ? AND user_id = ?
            `);
            
            stmt.run([ticketId, userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
            stmt.finalize();
        });
    }

    // Deletar ticket
    async deleteTicket(ticketId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                // Deletar usuários associados ao ticket
                const deleteUsersStmt = this.db.prepare('DELETE FROM ticket_users WHERE ticket_id = ?');
                deleteUsersStmt.run([ticketId]);
                deleteUsersStmt.finalize();
                
                // Deletar mensagens do ticket
                const deleteMessagesStmt = this.db.prepare('DELETE FROM ticket_messages WHERE ticket_id = ?');
                deleteMessagesStmt.run([ticketId]);
                deleteMessagesStmt.finalize();
                
                // Deletar o ticket
                const deleteTicketStmt = this.db.prepare('DELETE FROM tickets WHERE id = ?');
                deleteTicketStmt.run([ticketId], function(err) {
                    if (err) {
                        console.error('Erro ao deletar ticket:', err);
                        this.db.run('ROLLBACK');
                        reject(err);
                    } else {
                        this.db.run('COMMIT');
                        resolve({ changes: this.changes });
                    }
                });
                deleteTicketStmt.finalize();
            });
        });
    }

    // Obter usuários de um ticket
    async getTicketUsers(ticketId) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                SELECT tu.user_id, tu.added_at, u.username, u.discriminator, u.avatar
                FROM ticket_users tu
                LEFT JOIN users u ON tu.user_id = u.discord_id
                WHERE tu.ticket_id = ?
                ORDER BY tu.added_at ASC
            `);
            
            stmt.all([ticketId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
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

    // === SISTEMA DE LOGS ===

    async addLog(logData) {
        const { 
            guild_id, 
            type, 
            level = 'info', 
            message, 
            user_id, 
            username, 
            channel_id, 
            channel_name, 
            details 
        } = logData;
        
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO logs 
                (guild_id, type, level, message, user_id, username, channel_id, channel_name, details, timestamp) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run(
                guild_id, 
                type, 
                level, 
                message, 
                user_id, 
                username, 
                channel_id, 
                channel_name, 
                typeof details === 'object' ? JSON.stringify(details) : details,
                (err) => {
                    if (err) {
                        console.error('❌ Erro ao adicionar log:', err);
                        reject(err);
                    } else {
                        resolve(stmt.lastID);
                    }
                }
            );
            stmt.finalize();
        });
    }

    async getRecentLogs(limit = 50) {
        return new Promise((resolve, reject) => {
            // Primeiro verificar se a coluna timestamp existe
            this.db.all("PRAGMA table_info(logs)", (err, columns) => {
                if (err) {
                    reject(err);
                    return;
                }

                const hasTimestamp = columns.some(col => col.name === 'timestamp');
                const orderBy = hasTimestamp ? 'timestamp' : 'id';
                
                this.db.all(`
                    SELECT * FROM logs 
                    ORDER BY ${orderBy} DESC 
                    LIMIT ?
                `, [limit], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        // Parse details JSON
                        const logs = rows.map(row => ({
                            ...row,
                            details: row.details ? JSON.parse(row.details) : null
                        }));
                        resolve(logs);
                    }
                });
            });
        });
    }

    async getLogs(options = {}) {
        const { limit = 50, offset = 0, type, level, guild_id } = options;
        
        return new Promise((resolve, reject) => {
            // Primeiro verificar se a coluna timestamp existe
            this.db.all("PRAGMA table_info(logs)", (err, columns) => {
                if (err) {
                    reject(err);
                    return;
                }

                const hasTimestamp = columns.some(col => col.name === 'timestamp');
                const orderBy = hasTimestamp ? 'timestamp' : 'id';
                
                let query = 'SELECT * FROM logs WHERE 1=1';
                const params = [];
                
                if (guild_id) {
                    query += ' AND guild_id = ?';
                    params.push(guild_id);
                }
                
                if (type) {
                    query += ' AND type = ?';
                    params.push(type);
                }
                
                if (level) {
                    query += ' AND level = ?';
                    params.push(level);
                }
                
                query += ` ORDER BY ${orderBy} DESC LIMIT ? OFFSET ?`;
                params.push(limit, offset);
                
                this.db.all(query, params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        // Parse details JSON
                        const logs = rows.map(row => ({
                            ...row,
                            details: row.details ? JSON.parse(row.details) : null
                        }));
                        resolve(logs);
                    }
                });
            });
        });
    }

    async clearOldLogs(olderThanDays = 7) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                DELETE FROM logs 
                WHERE timestamp < datetime('now', '-' || ? || ' days')
            `);
            
            stmt.run(olderThanDays, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
            stmt.finalize();
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
