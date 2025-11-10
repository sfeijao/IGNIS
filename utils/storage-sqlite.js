const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dbPath = process.env.SQLITE_DB_FILE || path.join(dataDir, 'ignis.db');

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
  // Idempotent migrations for new columns using schema introspection
  const ensureColumn = (table, column, alterSql) => {
    db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
      if (err) return; // silent fail to avoid crashing
      const exists = Array.isArray(rows) && rows.some(r => String(r.name).toLowerCase() === String(column).toLowerCase());
      if (!exists) {
        db.run(alterSql, [], () => {});
      }
    });
  };
  ensureColumn('tickets', 'panel_message_id', 'ALTER TABLE tickets ADD COLUMN panel_message_id TEXT');
  ensureColumn('tickets', 'locked', 'ALTER TABLE tickets ADD COLUMN locked INTEGER DEFAULT 0');

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

  // Panels (tickets)
  db.run(`CREATE TABLE IF NOT EXISTS panels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    type TEXT,
    theme TEXT,
    template TEXT,
    payload TEXT
  )`);
  // Ensure template column exists for legacy DBs
  ensureColumn('panels', 'template', 'ALTER TABLE panels ADD COLUMN template TEXT');

  // Webhooks config
  db.run(`CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    type TEXT,
    name TEXT,
    url TEXT,
    channel_id TEXT,
    channel_name TEXT,
    enabled INTEGER
  )`);
  // Status / health columns for webhooks (idempotent migrations)
  ensureColumn('webhooks', 'last_ok', 'ALTER TABLE webhooks ADD COLUMN last_ok INTEGER');
  ensureColumn('webhooks', 'last_status', 'ALTER TABLE webhooks ADD COLUMN last_status INTEGER');
  ensureColumn('webhooks', 'last_error', 'ALTER TABLE webhooks ADD COLUMN last_error TEXT');
  ensureColumn('webhooks', 'last_at', 'ALTER TABLE webhooks ADD COLUMN last_at TEXT');

  // Ticket action logs (lightweight)
  db.run(`CREATE TABLE IF NOT EXISTS ticket_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT,
    guild_id TEXT,
    actor_id TEXT,
    action TEXT,
    message TEXT,
    data TEXT,
    timestamp TEXT
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
        priority = ?, status = ?, created_at = ?, assigned_to = ?, claimed_by = ?, claimed_at = ?, closed_at = ?, close_reason = ?, reopened_by = ?, reopened_at = ?, notes = ?, panel_message_id = ?, locked = ?
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
        merged.panel_message_id || null,
        merged.locked ? 1 : 0,
        ticketId
      ]
    );
    return { ...merged, notes: parseJSON(notesStr, []), locked: !!merged.locked };
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
    const result = await run(`INSERT INTO logs (guild_id, type, message, timestamp, data) VALUES (?, ?, ?, ?, ?)` , [
      log.guild_id || null,
      log.type || null,
      log.message || null,
      log.timestamp,
      log.data ? JSON.stringify(log.data) : null
    ]);
    // Capture generated id (AUTOINCREMENT)
    if (result && typeof result.lastID !== 'undefined') log.id = result.lastID;
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

  // Fetch a single log by id (number or string) for a given guild
  async getLogById(guildId, id) {
    const row = await get(`SELECT * FROM logs WHERE guild_id = ? AND id = ?`, [guildId, Number(id)]);
    if (!row) return null;
    return {
      id: row.id,
      guild_id: row.guild_id,
      type: row.type,
      message: row.message,
      timestamp: row.timestamp,
      data: parseJSON(row.data, null)
    };
  }

  // Prune logs by type older than N milliseconds
  async pruneLogsByTypeOlderThan(guildId, type, olderThanMs) {
    try {
      const cutoff = new Date(Date.now() - Math.max(0, Number(olderThanMs) || 0)).toISOString();
      if (guildId && type) {
        await run(`DELETE FROM logs WHERE guild_id = ? AND type = ? AND datetime(timestamp) < datetime(?)`, [guildId, type, cutoff]);
      } else if (guildId) {
        await run(`DELETE FROM logs WHERE guild_id = ? AND datetime(timestamp) < datetime(?)`, [guildId, cutoff]);
      } else if (type) {
        await run(`DELETE FROM logs WHERE type = ? AND datetime(timestamp) < datetime(?)`, [type, cutoff]);
      } else {
        await run(`DELETE FROM logs WHERE datetime(timestamp) < datetime(?)`, [cutoff]);
      }
      return { pruned: true };
    } catch (e) {
      return { pruned: false, error: e?.message || String(e) };
    }
  }

  // Count verification metrics grouped by type/message since cutoff
  async countVerificationMetrics(guildId, sinceIso) {
    const cutoff = sinceIso || new Date(Date.now() - 24*60*60*1000).toISOString();
    const rows = await all(
      `SELECT type, COALESCE(message, '') as message, COUNT(*) as count
       FROM logs
       WHERE guild_id = ? AND datetime(timestamp) >= datetime(?) AND (type = 'verification_success' OR type = 'verification_fail')
       GROUP BY type, message`,
      [guildId, cutoff]
    );
    const out = { success: 0, fail: 0, byMethod: {}, failReasons: {} };
    for (const r of rows) {
      const n = Number(r.count) || 0;
      if (r.type === 'verification_success') {
        out.success += n;
        const method = r.message || 'unknown';
        out.byMethod[method] = (out.byMethod[method] || 0) + n;
      } else if (r.type === 'verification_fail') {
        out.fail += n;
        const reason = r.message || 'unknown';
        out.failReasons[reason] = (out.failReasons[reason] || 0) + n;
      }
    }
    return out;
  }

  // Panels API
  async getPanels(guildId) {
    const rows = await all(`SELECT * FROM panels WHERE guild_id = ? AND (type IS NULL OR type = 'tickets')`, [guildId]);
    return rows.map(p => ({
      _id: String(p.id),
      guild_id: p.guild_id,
      channel_id: p.channel_id,
      message_id: p.message_id,
      type: p.type || 'tickets',
      theme: p.theme || 'dark',
      template: p.template || 'classic',
      payload: parseJSON(p.payload, null)
    }));
  }

  async getPanelsByType(guildId, type = 'tickets') {
    const rows = await all(`SELECT * FROM panels WHERE guild_id = ? AND (type ${type ? '= ?' : 'IS NULL'})`, type ? [guildId, type] : [guildId]);
    return rows.map(p => ({
      _id: String(p.id),
      guild_id: p.guild_id,
      channel_id: p.channel_id,
      message_id: p.message_id,
      type: p.type || 'tickets',
      theme: p.theme || 'dark',
      template: p.template || 'classic',
      payload: parseJSON(p.payload, null)
    }));
  }

  async upsertPanel({ guild_id, channel_id, message_id, theme = 'dark', template = 'classic', payload = null, type = 'tickets' }) {
    // Try update existing by guild/channel/type
    const existing = await get(`SELECT * FROM panels WHERE guild_id = ? AND channel_id = ? AND (type IS NULL OR type = ?)`, [guild_id, channel_id, type]);
    if (existing) {
      await run(`UPDATE panels SET message_id = ?, theme = ?, template = ?, payload = ? WHERE id = ?`, [message_id || existing.message_id, theme, template, payload ? JSON.stringify(payload) : existing.payload, existing.id]);
      return { _id: String(existing.id), guild_id, channel_id, message_id: message_id || existing.message_id, theme, template, payload, type };
    }
    const r = await run(`INSERT INTO panels (guild_id, channel_id, message_id, type, theme, template, payload) VALUES (?, ?, ?, ?, ?, ?, ?)`, [guild_id, channel_id, message_id || null, type, theme, template, payload ? JSON.stringify(payload) : null]);
    return { _id: String(r.lastID), guild_id, channel_id, message_id: message_id || null, theme, template, payload, type };
  }

  async findPanelById(id) {
    const row = await get(`SELECT * FROM panels WHERE id = ?`, [id]);
    if (!row) return null;
    return {
      _id: String(row.id),
      guild_id: row.guild_id,
      channel_id: row.channel_id,
      message_id: row.message_id,
      type: row.type || 'tickets',
      theme: row.theme || 'dark',
      template: row.template || 'classic',
      payload: parseJSON(row.payload, null)
    };
  }

  async findPanelByMessage(guildId, messageId) {
    const row = await get(`SELECT * FROM panels WHERE guild_id = ? AND message_id = ?`, [guildId, messageId]);
    if (!row) return null;
    return {
      _id: String(row.id),
      guild_id: row.guild_id,
      channel_id: row.channel_id,
      message_id: row.message_id,
      type: row.type || 'tickets',
      theme: row.theme || 'dark',
      template: row.template || 'classic',
      payload: parseJSON(row.payload, null)
    };
  }

  async updatePanel(id, updates) {
    const cur = await get(`SELECT * FROM panels WHERE id = ?`, [id]);
    if (!cur) return null;
    const next = { ...cur, ...updates };
    await run(`UPDATE panels SET guild_id = ?, channel_id = ?, message_id = ?, type = ?, theme = ?, template = ?, payload = ? WHERE id = ?`, [
      next.guild_id,
      next.channel_id,
      next.message_id || null,
      next.type || 'tickets',
      next.theme || 'dark',
      next.template || 'classic',
      next.payload ? JSON.stringify(next.payload) : null,
      id
    ]);
    return {
      _id: String(id),
      guild_id: next.guild_id,
      channel_id: next.channel_id,
      message_id: next.message_id || null,
      type: next.type || 'tickets',
      theme: next.theme || 'dark',
      template: next.template || 'classic',
      payload: next.payload || null
    };
  }

  async deletePanel(id) {
    await run(`DELETE FROM panels WHERE id = ?`, [id]);
    return true;
  }

  // Webhooks API
  async listWebhooks(guildId) {
    const rows = await all(`SELECT * FROM webhooks WHERE guild_id = ?`, [guildId]);
    return rows.map(w => ({
      _id: String(w.id),
      guild_id: w.guild_id,
      type: w.type || 'logs',
      name: w.name || null,
      url: w.url,
      channel_id: w.channel_id || null,
      channel_name: w.channel_name || null,
      enabled: !!w.enabled,
      last_ok: w.last_ok == null ? null : !!w.last_ok,
      last_status: w.last_status == null ? null : Number(w.last_status),
      last_error: w.last_error || null,
      last_at: w.last_at || null
    }));
  }

  async upsertWebhook({ guild_id, type = 'logs', name, url, channel_id, channel_name, enabled = true, last_ok, last_status, last_error, last_at }) {
    const current = await get(`SELECT * FROM webhooks WHERE guild_id = ? AND type = ?`, [guild_id, type]);
    if (current) {
      await run(`UPDATE webhooks SET name = ?, url = ?, channel_id = ?, channel_name = ?, enabled = ?, last_ok = ?, last_status = ?, last_error = ?, last_at = ? WHERE id = ?`, [
        name || current.name,
        url,
        channel_id || null,
        channel_name || null,
        enabled ? 1 : 0,
        last_ok == null ? current.last_ok : (last_ok ? 1 : 0),
        last_status == null ? current.last_status : last_status,
        last_error == null ? current.last_error : last_error,
        last_at == null ? current.last_at : last_at,
        current.id
      ]);
      return { _id: String(current.id), guild_id, type, name: name || current.name, url, channel_id, channel_name, enabled, last_ok: last_ok == null ? (current.last_ok == null ? null : !!current.last_ok) : !!last_ok, last_status: last_status == null ? (current.last_status == null ? null : Number(current.last_status)) : last_status, last_error: last_error == null ? current.last_error || null : last_error, last_at: last_at == null ? current.last_at || null : last_at };
    }
    const r = await run(`INSERT INTO webhooks (guild_id, type, name, url, channel_id, channel_name, enabled, last_ok, last_status, last_error, last_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      guild_id,
      type,
      name || null,
      url,
      channel_id || null,
      channel_name || null,
      enabled ? 1 : 0,
      last_ok == null ? null : (last_ok ? 1 : 0),
      last_status == null ? null : last_status,
      last_error == null ? null : last_error,
      last_at == null ? null : last_at
    ]);
    return { _id: String(r.lastID), guild_id, type, name, url, channel_id, channel_name, enabled, last_ok: last_ok == null ? null : !!last_ok, last_status: last_status == null ? null : last_status, last_error: last_error == null ? null : last_error, last_at: last_at == null ? null : last_at };
  }

  async deleteWebhookById(id, guildId) {
    await run(`DELETE FROM webhooks WHERE id = ? AND guild_id = ?`, [id, guildId]);
    return true;
  }

  // Ticket logs API
  async addTicketLog({ ticket_id, guild_id, actor_id, action, message, data }) {
    const timestamp = new Date().toISOString();
    await run(`INSERT INTO ticket_logs (ticket_id, guild_id, actor_id, action, message, data, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)` , [
      ticket_id?.toString() || null,
      guild_id || null,
      actor_id || null,
      action || null,
      message || null,
      data ? JSON.stringify(data) : null,
      timestamp
    ]);
    return { ticket_id, guild_id, actor_id, action, message, data, timestamp };
  }

  async getTicketLogs(ticketId, limit = 100, offset = 0) {
    const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 100));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const rows = await all(
      `SELECT * FROM ticket_logs WHERE ticket_id = ? ORDER BY datetime(timestamp) DESC LIMIT ? OFFSET ?`,
      [ticketId?.toString(), safeLimit, safeOffset]
    );
    return rows.map(r => ({
      id: r.id,
      ticket_id: r.ticket_id,
      guild_id: r.guild_id,
      actor_id: r.actor_id,
      action: r.action,
      message: r.message,
      data: parseJSON(r.data, null),
      timestamp: r.timestamp
    }));
  }
}

module.exports = new SqliteStorage();
