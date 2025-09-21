const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'ignis.db');

// Ensure data directory exists
try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}

const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  // Tickets table
  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    category TEXT,
    subject TEXT,
    description TEXT,
    priority TEXT,
    status TEXT,
    created_at TEXT,
    assigned_to TEXT,
    claimed_by TEXT,
    claimed_at TEXT,
    closed_at TEXT,
    close_reason TEXT,
    reopened_by TEXT,
    reopened_at TEXT,
    notes TEXT
  )`);

  // Guild config (JSON blob)
  db.run(`CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    data TEXT
  )`);

  // Tags per user (JSON array)
  db.run(`CREATE TABLE IF NOT EXISTS user_tags (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    tags TEXT,
    PRIMARY KEY (guild_id, user_id)
  )`);

  // Logs (optional)
  db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    type TEXT,
    message TEXT,
    timestamp TEXT,
    data TEXT
  )`);
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function parseJSON(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

class SqliteStorage {
  async createTicket(ticketData) {
    const id = Date.now();
    const created_at = new Date().toISOString();
    await run(
      `INSERT INTO tickets (id, guild_id, channel_id, user_id, category, subject, description, priority, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ticketData.guild_id,
        ticketData.channel_id,
        ticketData.user_id,
        ticketData.category || ticketData.type || 'geral',
        ticketData.subject || null,
        ticketData.description || null,
        ticketData.priority || 'normal',
        'open',
        created_at
      ]
    );
    return {
      id,
      guild_id: ticketData.guild_id,
      channel_id: ticketData.channel_id,
      user_id: ticketData.user_id,
      category: ticketData.category || ticketData.type || 'geral',
      subject: ticketData.subject || null,
      description: ticketData.description || null,
      priority: ticketData.priority || 'normal',
      status: 'open',
      created_at
    };
  }

  async getTickets(guildId) {
    const rows = await all(`SELECT * FROM tickets WHERE guild_id = ?`, [guildId]);
    return rows.map(r => ({ ...r, notes: parseJSON(r.notes, []) }));
  }

  async getUserActiveTickets(userId, guildId) {
    const rows = await all(`SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'`, [guildId, userId]);
    return rows.map(r => ({ ...r, notes: parseJSON(r.notes, []) }));
  }

  async getTicketByChannel(channelId) {
    const row = await get(`SELECT * FROM tickets WHERE channel_id = ?`, [channelId]);
    return row ? { ...row, notes: parseJSON(row.notes, []) } : null;
  }

  async updateTicket(ticketId, updates) {
    if (!updates || typeof updates !== 'object') return null;

    // Read current
    const current = await get(`SELECT * FROM tickets WHERE id = ?`, [ticketId]);
    if (!current) return null;

    const merged = { ...current, ...updates };
    // Serialize notes if array/object
    const notesStr = merged.notes ? JSON.stringify(merged.notes) : current.notes;

    await run(
      `UPDATE tickets SET guild_id = ?, channel_id = ?, user_id = ?, category = ?, subject = ?, description = ?,
        priority = ?, status = ?, created_at = ?, assigned_to = ?, claimed_by = ?, claimed_at = ?, closed_at = ?, close_reason = ?, reopened_by = ?, reopened_at = ?, notes = ?
       WHERE id = ?`,
      [
        merged.guild_id,
        merged.channel_id,
        merged.user_id,
        merged.category,
        merged.subject,
        merged.description,
        merged.priority,
        merged.status,
        merged.created_at,
        merged.assigned_to || null,
        merged.claimed_by || null,
        merged.claimed_at || null,
        merged.closed_at || null,
        merged.close_reason || null,
        merged.reopened_by || null,
        merged.reopened_at || null,
        notesStr || null,
        ticketId
      ]
    );
    return { ...merged, notes: parseJSON(notesStr, []) };
  }

  async closeTicket(ticketId) {
    const closed_at = new Date().toISOString();
    return this.updateTicket(ticketId, { status: 'closed', closed_at });
  }

  async getGuildConfig(guildId, key) {
    const row = await get(`SELECT data FROM guild_config WHERE guild_id = ?`, [guildId]);
    const data = parseJSON(row?.data, {});
    return key ? data[key] : data;
  }

  async setGuildConfig(guildId, key, value) {
    const current = await this.getGuildConfig(guildId);
    const merged = { ...current, [key]: value };
    await run(`INSERT INTO guild_config (guild_id, data) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET data = excluded.data`, [guildId, JSON.stringify(merged)]);
    return true;
  }

  async updateGuildConfig(guildId, updates) {
    const current = await this.getGuildConfig(guildId);
    const merged = { ...current, ...updates };
    await run(`INSERT INTO guild_config (guild_id, data) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET data = excluded.data`, [guildId, JSON.stringify(merged)]);
    return merged;
  }

  async getUserTags(guildId, userId) {
    const row = await get(`SELECT tags FROM user_tags WHERE guild_id = ? AND user_id = ?`, [guildId, userId]);
    const arr = parseJSON(row?.tags, []);
    return Array.isArray(arr) ? arr : [];
  }

  async addUserTag(guildId, userId, tag) {
    const tags = await this.getUserTags(guildId, userId);
    if (!tags.includes(tag)) tags.push(tag);
    await run(`INSERT INTO user_tags (guild_id, user_id, tags) VALUES (?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET tags = excluded.tags`, [guildId, userId, JSON.stringify(tags)]);
    return true;
  }

  async removeUserTag(guildId, userId, tag) {
    const tags = await this.getUserTags(guildId, userId);
    const next = tags.filter(t => t !== tag);
    await run(`INSERT INTO user_tags (guild_id, user_id, tags) VALUES (?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET tags = excluded.tags`, [guildId, userId, JSON.stringify(next)]);
    return true;
  }

  async addLog(logData) {
    const log = {
      id: undefined,
      ...logData,
      timestamp: new Date().toISOString()
    };
    await run(`INSERT INTO logs (guild_id, type, message, timestamp, data) VALUES (?, ?, ?, ?, ?)` , [
      log.guild_id || null,
      log.type || null,
      log.message || null,
      log.timestamp,
      log.data ? JSON.stringify(log.data) : null
    ]);
    return log;
  }

  async getLogs(guildId, limit = 50) {
    const rows = await all(`SELECT * FROM logs WHERE guild_id = ? ORDER BY datetime(timestamp) DESC LIMIT ?`, [guildId, Math.max(1, Math.min(1000, limit))]);
    return rows.map(r => ({
      id: r.id,
      guild_id: r.guild_id,
      type: r.type,
      message: r.message,
      timestamp: r.timestamp,
      data: parseJSON(r.data, null)
    }));
  }
}

module.exports = new SqliteStorage();
