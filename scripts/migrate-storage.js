#!/usr/bin/env node
const path = require('path');

async function migrateSqliteToMongo() {
  const { connect } = require('../utils/db/mongoose');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI não definido');
  await connect(uri);
  const { TicketModel, GuildConfigModel, PanelModel, TagModel, WebhookModel } = require('../utils/db/models');
  const storage = require('../utils/storage-sqlite');

  // Tickets
  const guildIds = new Set();
  const sqliteAllTickets = [];
  // We don't have a direct list method for all tickets; iterate from panels/configs to infer guilds
  // Simpler: query distinct guilds from tables
  const sqlite3 = require('sqlite3').verbose();
  const dbFile = process.env.SQLITE_DB_FILE || path.join(__dirname, '..', 'data', 'ignis.db');
  const db = new sqlite3.Database(dbFile);
  function all(sql, params=[]) { return new Promise((resolve, reject)=> db.all(sql, params, (e, rows)=> e?reject(e):resolve(rows||[]))); }
  const guildsRows = await all("SELECT DISTINCT guild_id FROM (SELECT guild_id FROM tickets UNION SELECT guild_id FROM guild_config UNION SELECT guild_id FROM panels UNION SELECT guild_id FROM webhooks)");
  guildsRows.forEach(r => r.guild_id && guildIds.add(r.guild_id));
  // Tickets
  const tickets = await all('SELECT * FROM tickets');
  if (tickets.length) {
    await TicketModel.deleteMany({});
    await TicketModel.insertMany(tickets.map(t => ({
      id: t.id,
      guild_id: t.guild_id,
      channel_id: t.channel_id,
      user_id: t.user_id,
      category: t.category,
      subject: t.subject,
      description: t.description,
      priority: t.priority || 'normal',
      status: t.status || 'open',
      created_at: t.created_at ? new Date(t.created_at) : new Date(),
      assigned_to: t.assigned_to || null,
      closed_at: t.closed_at ? new Date(t.closed_at) : null,
      notes: t.notes ? JSON.parse(t.notes) : []
    })));
  }
  // Guild config
  const configs = await all('SELECT * FROM guild_config');
  if (configs.length) {
    await GuildConfigModel.deleteMany({});
    await GuildConfigModel.insertMany(configs.map(c => ({ guild_id: c.guild_id, data: c.data ? JSON.parse(c.data) : {} })));
  }
  // Panels
  const panels = await all('SELECT * FROM panels');
  if (panels.length) {
    await PanelModel.deleteMany({});
    await PanelModel.insertMany(panels.map(p => ({ guild_id: p.guild_id, channel_id: p.channel_id, message_id: p.message_id, type: p.type || 'tickets', theme: p.theme || 'dark', payload: p.payload ? JSON.parse(p.payload) : null })));
  }
  // Tags
  const tags = await all('SELECT * FROM user_tags');
  if (tags.length) {
    await TagModel.deleteMany({});
    await TagModel.insertMany(tags.map(t => ({ guild_id: t.guild_id, user_id: t.user_id, tags: t.tags ? JSON.parse(t.tags) : [] })));
  }
  // Webhooks
  const webhooks = await all('SELECT * FROM webhooks');
  if (webhooks.length) {
    await WebhookModel.deleteMany({});
    await WebhookModel.insertMany(webhooks.map(w => ({ guild_id: w.guild_id, type: w.type || 'logs', name: w.name || null, url: w.url, channel_id: w.channel_id || null, channel_name: w.channel_name || null, enabled: !!w.enabled })));
  }
  db.close();
  console.log('✅ Migração SQLite -> Mongo concluída');
}

async function migrateMongoToSqlite() {
  const { connect, isReady } = require('../utils/db/mongoose');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI não definido');
  await connect(uri);
  const { TicketModel, GuildConfigModel, PanelModel, TagModel, WebhookModel } = require('../utils/db/models');
  const storage = require('../utils/storage-sqlite');
  const sqlite3 = require('sqlite3').verbose();
  const dbFile = process.env.SQLITE_DB_FILE || path.join(__dirname, '..', 'data', 'ignis.db');
  const db = new sqlite3.Database(dbFile);
  function run(sql, params=[]) { return new Promise((resolve, reject) => db.run(sql, params, function(e){ e?reject(e):resolve(this) })); }

  // Clean tables
  await run('DELETE FROM tickets');
  await run('DELETE FROM guild_config');
  await run('DELETE FROM panels');
  await run('DELETE FROM user_tags');
  await run('DELETE FROM webhooks');

  // Fetch from mongo
  const [tickets, configs, panels, tags, webhooks] = await Promise.all([
    TicketModel.find({}).lean(),
    GuildConfigModel.find({}).lean(),
    PanelModel.find({}).lean(),
    TagModel.find({}).lean(),
    WebhookModel.find({}).lean(),
  ]);

  // Insert into sqlite
  for (const t of tickets) {
    await run(`INSERT INTO tickets (id, guild_id, channel_id, user_id, category, subject, description, priority, status, created_at, assigned_to, closed_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      t.id || Date.now(), t.guild_id, t.channel_id, t.user_id || null, t.category || null, t.subject || null, t.description || null, t.priority || 'normal', t.status || 'open', t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(), t.assigned_to || null, t.closed_at ? new Date(t.closed_at).toISOString() : null, JSON.stringify(t.notes || [])
    ]);
  }
  for (const c of configs) {
    await run(`INSERT INTO guild_config (guild_id, data) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET data = excluded.data`, [c.guild_id, JSON.stringify(c.data || {})]);
  }
  for (const p of panels) {
    await run(`INSERT INTO panels (guild_id, channel_id, message_id, type, theme, payload) VALUES (?, ?, ?, ?, ?, ?)`, [p.guild_id, p.channel_id, p.message_id || null, p.type || 'tickets', p.theme || 'dark', p.payload ? JSON.stringify(p.payload) : null]);
  }
  for (const tg of tags) {
    await run(`INSERT INTO user_tags (guild_id, user_id, tags) VALUES (?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET tags = excluded.tags`, [tg.guild_id, tg.user_id, JSON.stringify(tg.tags || [])]);
  }
  for (const w of webhooks) {
    await run(`INSERT INTO webhooks (guild_id, type, name, url, channel_id, channel_name, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)`, [w.guild_id, w.type || 'logs', w.name || null, w.url, w.channel_id || null, w.channel_name || null, w.enabled ? 1 : 0]);
  }
  db.close();
  console.log('✅ Migração Mongo -> SQLite concluída');
}

async function main() {
  const dir = (process.argv[2] || '').toLowerCase();
  if (dir === 'sqlite-to-mongo') return migrateSqliteToMongo();
  if (dir === 'mongo-to-sqlite') return migrateMongoToSqlite();
  console.log('Uso: node scripts/migrate-storage.js <sqlite-to-mongo|mongo-to-sqlite>');
}

main().catch(e => { console.error(e); process.exit(1); });
