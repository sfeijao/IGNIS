const { GiveawayModel } = require('../db/giveawayModels');
const { endGiveaway } = require('./service');
const { isReady } = require('../db/mongoose');

function initGiveawayWorker(){
  const enabled = (process.env.GIVEAWAYS_WORKER_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return () => {};

  async function tickPromoteScheduled(){
    try {
      if (!isReady()) return; // wait for mongo
      const now = new Date();
      // Promote scheduled -> active when scheduled_at <= now
      const res = await GiveawayModel.updateMany(
        { status: 'scheduled', scheduled_at: { $lte: now } },
        { $set: { status: 'active', starts_at: now } }
      );
    } catch (e) {
      try { console.warn('[GiveawayWorker] promote error:', e && e.message || e); } catch {}
    }
  }

  async function tickEndDue(){
    try {
      if (!isReady()) return;
      const now = new Date();
      const due = await GiveawayModel.find({ status: 'active', ends_at: { $lte: now } }).limit(10).lean();
      for (const g of due){
        try {
          const result = await endGiveaway(g._id, g.guild_id, { actorId: null });
          if (result && result.ok) {
            // Auto announce winners (idempotent): only if not announced yet
            try {
              const fresh = await GiveawayModel.findById(g._id).lean();
              if (fresh && fresh.status === 'ended' && !fresh.winners_announced) {
                try {
                  const { announceWinners } = require('./discord');
                  await announceWinners(fresh, result.winners || []);
                  await GiveawayModel.updateOne({ _id: fresh._id }, { $set: { winners_announced: true } });
                } catch {}
              }
            } catch {}
          }
        } catch {}
      }
    } catch (e) {
      try { console.warn('[GiveawayWorker] end error:', e && e.message || e); } catch {}
    }
  }

  async function tickLiveUpdates(){
    try {
      if (!isReady()) return;
      const now = new Date();
      const list = await GiveawayModel.find({ status: 'active', 'options.live_update_interval_minutes': { $gt: 0 } }).limit(20).lean();
      for (const g of list){
        const intervalMs = (g.options?.live_update_interval_minutes || 0) * 60_000;
        if (!intervalMs) continue;
        const last = g.last_live_update_at ? new Date(g.last_live_update_at).getTime() : 0;
        if (Date.now() - last < intervalMs) continue;
        // Perform a lightweight message edit with remaining time & entrants count
        try {
          const remainingSec = g.ends_at ? Math.max(0, Math.floor((new Date(g.ends_at).getTime() - Date.now()) / 1000)) : 0;
          const entrants = g.entries_count || 0;
          const { getClient } = require('../discordClient');
          const client = getClient();
          if (client && g.channel_id && g.message_id){
            const channel = await client.channels.fetch(g.channel_id).catch(()=>null);
            if (channel && channel.messages){
              const msg = await channel.messages.fetch(g.message_id).catch(()=>null);
              if (msg){
                const contentBase = '🎉 Giveaway';
                const suffix = ` | Entradas: ${entrants} | Termina ${g.ends_at ? `<t:${Math.floor(new Date(g.ends_at).getTime()/1000)}:R>` : ''}`;
                if (!msg.content.includes('Giveaway (ended)')){
                  await msg.edit({ content: contentBase + suffix });
                  await GiveawayModel.updateOne({ _id: g._id }, { $set: { last_live_update_at: new Date() } });
                }
              }
            }
          }
        } catch {}
      }
    } catch (e) {
      try { console.warn('[GiveawayWorker] live update error:', e && e.message || e); } catch {}
    }
  }

  const i1 = setInterval(tickPromoteScheduled, 10_000);
  const i2 = setInterval(tickEndDue, 8_000);
  const i3 = setInterval(tickLiveUpdates, 30_000);
  // run soon after start
  setTimeout(()=>{ tickPromoteScheduled(); tickEndDue(); tickLiveUpdates(); }, 2000);
  return () => { clearInterval(i1); clearInterval(i2); clearInterval(i3); };
}

module.exports = { initGiveawayWorker };
