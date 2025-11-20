const { GiveawayModel, GiveawayEntryModel, GiveawayWinnerModel, GiveawayLogModel } = require('../db/giveawayModels');
const { recordAnalytics } = (()=>{ try { return require('../analytics'); } catch { return { recordAnalytics: ()=>{} }; } })();
const { pickWinners, generateSeed } = require('./rng');

async function endGiveaway(giveawayId, guildId, opts={}){
  // Acquire lock by setting processing=true atomically if active and not already processing
  const lockDoc = await GiveawayModel.findOneAndUpdate(
    { _id: giveawayId, guild_id: guildId, status: 'active', $or: [ { processing: { $exists: false } }, { processing: false } ] },
    { $set: { processing: true, processing_started_at: new Date(), ended_at: new Date() } },
    { new: true }
  );
  if (!lockDoc) {
    // Already ended or locked by another worker
    const current = await GiveawayModel.findOne({ _id: giveawayId, guild_id: guildId }).lean();
    return { ok: false, reason: 'not_active_or_locked', current };
  }
  try {
    const entries = await GiveawayEntryModel.find({ giveaway_id: giveawayId }).lean();
    const { winners_count } = lockDoc;
    const { winners, seedUsed, totalEligible, shortfall } = pickWinners(entries, winners_count, { seed: opts.seed || lockDoc.fair_rng_seed || null });
    const winnersSaved = [];
    for (const w of winners) {
      const doc = await GiveawayWinnerModel.create({
        giveaway_id: giveawayId,
        guild_id: guildId,
        user_id: w.user_id,
        method: 'initial'
      });
      winnersSaved.push(doc.toObject());
    }
    await GiveawayModel.updateOne({ _id: giveawayId }, { $set: { status: 'ended', processing: false, winners_announced: false, fair_rng_seed: seedUsed } });
    await GiveawayLogModel.create({ giveaway_id: giveawayId, guild_id: guildId, actor_id: opts.actorId || null, action: 'end', payload: { seedUsed, totalEligible, shortfall, winners: winnersSaved.map(x => x.user_id) } });
    try { recordAnalytics('giveaway_end', { guild_id: guildId, giveaway_id: giveawayId, winners: winnersSaved.length }); } catch {}
    return { ok: true, winners: winnersSaved, seedUsed, totalEligible, shortfall };
  } catch (e) {
    await GiveawayModel.updateOne({ _id: giveawayId }, { $set: { processing: false } });
    return { ok: false, error: e && e.message || String(e) };
  }
}

async function rerollGiveaway(giveawayId, guildId, count, opts={}){
  const base = await GiveawayModel.findOne({ _id: giveawayId, guild_id: guildId }).lean();
  if (!base) return { ok: false, reason: 'not_found' };
  if (base.status !== 'ended') return { ok: false, reason: 'not_ended' };

  const prevWinners = await GiveawayWinnerModel.find({ giveaway_id: giveawayId }).lean();
  const excludeIds = new Set(prevWinners.map(w => w.user_id));
  const entries = await GiveawayEntryModel.find({ giveaway_id: giveawayId }).lean();
  const filtered = entries.filter(e => !excludeIds.has(e.user_id));
  if (!filtered.length) return { ok: true, winners: [], seedUsed: base.fair_rng_seed, totalEligible: 0, shortfall: count };

  const { winners, seedUsed, totalEligible, shortfall } = pickWinners(filtered, count || base.winners_count, { seed: opts.seed || base.fair_rng_seed || null });
  const winnersSaved = [];
  for (const w of winners) {
    const doc = await GiveawayWinnerModel.create({
      giveaway_id: giveawayId,
      guild_id: guildId,
      user_id: w.user_id,
      method: 'reroll'
    });
    winnersSaved.push(doc.toObject());
  }
  await GiveawayLogModel.create({ giveaway_id: giveawayId, guild_id: guildId, actor_id: opts.actorId || null, action: 'reroll', payload: { count, winners: winnersSaved.map(x => x.user_id) } });
  try { recordAnalytics('giveaway_reroll', { guild_id: guildId, giveaway_id: giveawayId, count: winnersSaved.length }); } catch {}
  return { ok: true, winners: winnersSaved, seedUsed, totalEligible, shortfall };
}

async function enterGiveaway(giveawayId, guildId, entry){
  const g = await GiveawayModel.findOne({ _id: giveawayId, guild_id: guildId }).lean();
  if (!g) return { ok: false, reason: 'not_found' };
  if (g.status !== 'active') return { ok: false, reason: 'not_active' };
  if (g.rules && g.rules.entrants_cap && g.rules.entrants_cap > 0) {
    const count = await GiveawayEntryModel.countDocuments({ giveaway_id: giveawayId });
    if (count >= g.rules.entrants_cap) return { ok: false, reason: 'cap_reached' };
  }
  try {
    const doc = await GiveawayEntryModel.create({
      giveaway_id: giveawayId,
      guild_id: guildId,
      user_id: entry.user_id,
      username: entry.username || '',
      method: entry.method || 'reaction',
      weight: Math.max(1, entry.weight || 1),
      flags: { is_bot: !!entry.is_bot, suspicious_alt: !!entry.suspicious_alt }
    });
    await GiveawayModel.updateOne({ _id: giveawayId }, { $inc: { entries_count: 1 } });
    await GiveawayLogModel.create({ giveaway_id: giveawayId, guild_id: guildId, actor_id: entry.user_id, action: 'enter', payload: { method: entry.method || 'reaction' } });
  try { recordAnalytics('giveaway_enter', { guild_id: guildId, giveaway_id: giveawayId }); } catch {}
    return { ok: true, entry: doc.toObject() };
  } catch (e) {
    if (e && e.code === 11000) {
      // Duplicate entrant; ignore
      return { ok: true, duplicate: true };
    }
    return { ok: false, error: e && e.message || String(e) };
  }
}

/**
 * Cleanup giveaways stuck in 'processing' for more than 5 minutes.
 * Returns count of locks released.
 */
async function cleanupStaleLocks() {
  const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const cutoff = new Date(Date.now() - TIMEOUT_MS);

  const result = await GiveawayModel.updateMany(
    { processing: true, processing_started_at: { $lt: cutoff } },
    { $set: { processing: false }, $unset: { processing_started_at: '' } }
  );

  if (result.modifiedCount > 0) {
    console.log(`[GiveawayService] Released ${result.modifiedCount} stale processing locks`);
  }

  return result.modifiedCount;
}

module.exports = { endGiveaway, rerollGiveaway, enterGiveaway, cleanupStaleLocks };
