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

  const i1 = setInterval(tickPromoteScheduled, 10_000);
  const i2 = setInterval(tickEndDue, 8_000);
  // run soon after start
  setTimeout(()=>{ tickPromoteScheduled(); tickEndDue(); }, 2000);
  return () => { clearInterval(i1); clearInterval(i2); };
}

module.exports = { initGiveawayWorker };
