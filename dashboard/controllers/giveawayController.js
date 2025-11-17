const { GiveawayModel, GiveawayEntryModel, GiveawayWinnerModel, GiveawayLogModel } = require('../../utils/db/giveawayModels');
const { pickWinners, generateSeed } = require('../../utils/giveaways/rng');
const Joi = require('joi');

// Basic validation schemas
const createSchema = Joi.object({
  title: Joi.string().min(2).max(150).required(),
  description: Joi.string().allow('').max(2000).default(''),
  banner_url: Joi.string().uri().allow(''),
  icon_emoji: Joi.string().max(15).allow('').default('🎉'),
  method: Joi.string().valid('reaction','button','command').default('button'),
  winners_count: Joi.number().integer().min(1).max(100).default(1),
  channel_id: Joi.string().pattern(/^\d+$/).required(),
  scheduled_at: Joi.date().optional(),
  starts_at: Joi.date().optional(),
  ends_at: Joi.date().required(),
  announcement_markdown: Joi.string().allow('').max(5000).default(''),
  rules: Joi.object({
    roles_required: Joi.array().items(Joi.string()).default([]),
    min_join_duration_ms: Joi.number().integer().min(0).default(0),
    locale_allow: Joi.array().items(Joi.string()).default([]),
    entrants_cap: Joi.number().integer().min(0).default(0),
    weight_roles: Joi.object().pattern(/^[0-9A-Za-z]+$/, Joi.number().integer().min(1).max(100)).default({})
  }).default(),
  options: Joi.object({
    allow_reroll: Joi.boolean().default(true),
    auto_pin: Joi.boolean().default(false),
    allow_manual_pick: Joi.boolean().default(true),
    multi_prizes: Joi.array().items(Joi.string().max(120)).default([]),
    dm_winners: Joi.boolean().default(false)
  }).default()
});

async function createGiveaway(req, res){
  try {
    const guildId = req.params.guildId;
    if (!guildId) return res.status(400).json({ error: 'missing_guild_id' });
    const { value, error } = createSchema.validate(req.body || {}, { abortEarly: false });
    if (error) return res.status(400).json({ error: 'validation_error', details: error.details.map(d=>d.message) });

    // Basic permission placeholder (to be replaced with actual staff role checks)
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });

    // Verify channel exists and is accessible
    try {
      const client = global.discordClient;
      if (client) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          const channel = guild.channels.cache.get(value.channel_id);
          if (!channel) {
            return res.status(404).json({ error: 'channel_not_found', message: 'Selected channel not found in this server' });
          }
          // Check if it's a text channel (type 0) or announcement channel (type 5)
          if (channel.type !== 0 && channel.type !== 5) {
            return res.status(400).json({ error: 'invalid_channel_type', message: 'Channel must be a text or announcement channel' });
          }
        }
      }
    } catch (e) {
      console.warn('Channel validation error:', e);
    }

    // Ensure ends_at > now and > starts_at if provided
    const now = Date.now();
    const endsAtMs = new Date(value.ends_at).getTime();
    if (isNaN(endsAtMs) || endsAtMs <= now + 60 * 1000) { // minimum 1 minute duration
      return res.status(400).json({ error: 'duration_too_short', message: 'Giveaway must last at least 1 minute' });
    }
    if (value.starts_at) {
      const startsMs = new Date(value.starts_at).getTime();
      if (startsMs >= endsAtMs) return res.status(400).json({ error: 'start_after_end', message: 'Start time must be before end time' });
    }

    const doc = await GiveawayModel.create({
      guild_id: guildId,
      channel_id: value.channel_id,
      title: value.title,
      description: value.description || '',
      banner_url: value.banner_url || '',
      icon_emoji: value.icon_emoji || '🎉',
      method: value.method || 'button',
      winners_count: value.winners_count,
      scheduled_at: value.scheduled_at || null,
      starts_at: value.starts_at || new Date(),
      ends_at: value.ends_at,
      created_by: req.user.id,
      announcement_markdown: value.announcement_markdown || '',
      rules: value.rules || {},
      options: value.options || {},
      status: value.scheduled_at ? 'scheduled' : 'active'
    });

    await GiveawayLogModel.create({
      giveaway_id: doc._id,
      guild_id: guildId,
      actor_id: req.user.id,
      action: 'create',
      payload: { title: doc.title }
    });

  // Analytics (non-blocking)
  try { const { recordAnalytics } = require('../../utils/analytics'); recordAnalytics('giveaway_create', { guild_id: guildId, giveaway_id: doc._id }); } catch {}

  // Attempt Discord publish if active immediately and channel provided
    try {
      if (doc.status === 'active' && doc.channel_id) {
        const { publishGiveaway } = require('../../utils/giveaways/discord');
        publishGiveaway(doc).then(r => {
          if (!r.ok) console.warn('Discord publish failed:', r.error);
        }).catch(e=>console.warn('Discord publish error', e && e.message || e));
      }
    } catch {}

    return res.json({ ok: true, giveaway: doc });
  } catch (e) {
    console.error('createGiveaway error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

async function listGiveaways(req, res){
  try {
    const guildId = req.params.guildId;
    if (!guildId) return res.status(400).json({ error: 'missing_guild_id' });
    const { status, channel_id, creator, search, limit=25, cursor } = req.query;
    const q = { guild_id: guildId };
    if (status) {
      const raw = String(status).trim().toLowerCase();
      if (raw.includes(',')) {
        const parts = raw.split(',').map(s=>s.trim()).filter(Boolean);
        if (parts.length) q.status = { $in: parts };
      } else if (raw === 'open') {
        q.status = { $in: ['active','scheduled'] };
      } else {
        q.status = raw;
      }
    }
    if (channel_id) q.channel_id = channel_id;
    if (creator) q.created_by = creator;
    if (search) q.title = { $regex: String(search).replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&'), $options: 'i' };

    const lim = Math.min(100, Math.max(1, parseInt(limit)));
    if (cursor) { q._id = { $lt: cursor }; }

    const items = await GiveawayModel.find(q).sort({ _id: -1 }).limit(lim + 1).lean();
    const nextCursor = items.length > lim ? items[lim - 1]._id : null;
    const pageItems = items.slice(0, lim);

    return res.json({ ok: true, giveaways: pageItems, nextCursor });
  } catch (e) {
    console.error('listGiveaways error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

async function getGiveaway(req, res){
  try {
    const guildId = req.params.guildId;
    const gid = req.params.giveawayId;
    if (!guildId || !gid) return res.status(400).json({ error: 'missing_params' });
    const doc = await GiveawayModel.findOne({ _id: gid, guild_id: guildId }).lean();
    if (!doc) return res.status(404).json({ error: 'not_found' });

    // Basic entrants stats
    const entriesCount = await GiveawayEntryModel.countDocuments({ giveaway_id: gid });
    const winners = await GiveawayWinnerModel.find({ giveaway_id: gid }).lean();

    return res.json({ ok: true, giveaway: doc, entriesCount, winners });
  } catch (e) {
    console.error('getGiveaway error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

const { endGiveaway, rerollGiveaway, enterGiveaway } = require('../../utils/giveaways/service');

async function updateGiveaway(req, res){
  try {
    const guildId = req.params.guildId;
    const gid = req.params.giveawayId;
    if (!guildId || !gid) return res.status(400).json({ error: 'missing_params' });
    // Only allow safe fields to change before start or when still scheduled
    const allowed = ['title','description','banner_url','icon_emoji','ends_at','announcement_markdown','rules','options','channel_id'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    const g = await GiveawayModel.findOne({ _id: gid, guild_id: guildId });
    if (!g) return res.status(404).json({ error: 'not_found' });
    if (g.status !== 'scheduled' && g.status !== 'active') return res.status(400).json({ error: 'cannot_edit' });
    if (g.status === 'active' && (updates.ends_at || updates.rules || updates.options || updates.channel_id)) {
      // restrict risky fields when already started
      delete updates.rules; delete updates.options; delete updates.channel_id;
    }
    Object.assign(g, updates);
    await g.save();
    await GiveawayLogModel.create({ giveaway_id: gid, guild_id: guildId, actor_id: req.user?.id || null, action: 'update', payload: updates });
    return res.json({ ok: true, giveaway: g.toObject() });
  } catch (e) {
    console.error('updateGiveaway error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

async function endNow(req, res){
  try {
    const guildId = req.params.guildId;
    const gid = req.params.giveawayId;
    const result = await endGiveaway(gid, guildId, { actorId: req.user?.id || null });
    if (!result.ok && result.reason === 'not_active_or_locked') return res.status(409).json(result);
    if (!result.ok) return res.status(500).json(result);
    // Broadcast real-time end event
    try {
      if (global.socketManager) {
        global.socketManager.broadcast('giveaway_end', { giveawayId: gid, winners: (result.winners||[]).map(w=>w.user_id), seed: result.seedUsed }, guildId);
      }
    } catch {}
    // Discord announce
    try {
      const giveaway = await GiveawayModel.findById(gid).lean();
      if (giveaway) {
        const { announceWinners } = require('../../utils/giveaways/discord');
        announceWinners(giveaway, result.winners).catch(()=>{});
      }
    } catch {}
    return res.json(result);
  } catch (e) {
    console.error('endNow error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

async function reroll(req, res){
  try {
    const guildId = req.params.guildId; const gid = req.params.giveawayId;
    const count = Math.max(1, parseInt(req.body?.count || '0') || 0);
    const result = await rerollGiveaway(gid, guildId, count || undefined, { actorId: req.user?.id || null });
    if (!result.ok && result.reason) return res.status(400).json(result);
    if (!result.ok) return res.status(500).json(result);
    // Broadcast reroll
    try {
      if (global.socketManager) {
        global.socketManager.broadcast('giveaway_reroll', { giveawayId: gid, winners: (result.winners||[]).map(w=>w.user_id) }, guildId);
      }
    } catch {}
    return res.json(result);
  } catch (e) {
    console.error('reroll error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

async function enter(req, res){
  try {
    const guildId = req.params.guildId; const gid = req.params.giveawayId;
    const user_id = req.body?.user_id || req.user?.id;
    if (!user_id) return res.status(400).json({ error: 'missing_user' });
    const result = await enterGiveaway(gid, guildId, {
      user_id,
      username: req.body?.username || '',
      method: req.body?.method || 'reaction',
      weight: req.body?.weight || 1,
      is_bot: !!req.body?.is_bot,
      suspicious_alt: !!req.body?.suspicious_alt
    });
    if (!result.ok && result.reason) return res.status(400).json(result);
    if (!result.ok) return res.status(500).json(result);
    // Broadcast entrant (ignore duplicates)
    try {
      if (global.socketManager && result.entry && !result.duplicate) {
        global.socketManager.broadcast('giveaway_enter', { giveawayId: gid, userId: user_id }, guildId);
      }
    } catch {}
    return res.json(result);
  } catch (e) {
    console.error('enter error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

async function exportEntriesCsv(req, res){
  try {
    const guildId = req.params.guildId; const gid = req.params.giveawayId;
    const entries = await GiveawayEntryModel.find({ giveaway_id: gid, guild_id: guildId }).lean();
    const header = ['user_id','username','joined_at','method','weight'];
    const rows = [header.join(',')];
    for (const e of entries){
      const row = [e.user_id, safeCsv(e.username||''), (e.joined_at||'').toISOString ? e.joined_at.toISOString() : '', e.method||'', String(e.weight||1)];
      rows.push(row.join(','));
    }
    const csv = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="giveaway_${gid}_entries.csv"`);
    return res.send(csv);
  } catch (e) {
    console.error('exportEntriesCsv error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}

function safeCsv(value){
  const s = String(value).replace(/"/g,'""');
  if (/[",\n]/.test(s)) return `"${s}"`;
  return s;
}

module.exports = { createGiveaway, listGiveaways, getGiveaway, updateGiveaway, endNow, reroll, enter, exportEntriesCsv };
