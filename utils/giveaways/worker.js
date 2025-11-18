const { GiveawayModel } = require('../db/giveawayModels');
const { endGiveaway } = require('./service');
const { isReady } = require('../db/mongoose');
const { createGiveawayWinnerTicket, checkExpiredGiveawayTickets } = require('./autoWinner');

function initGiveawayWorker(){
  const enabled = (process.env.GIVEAWAYS_WORKER_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return () => {};

  let disabledByAuth = false;
  let errorStrikes = 0;
  const MAX_STRIKES = 5;
  function checkDisable(e){
    try {
      const msg = (e && e.message) ? e.message : String(e || '');
      if (/Authentication failed|bad auth|not allowed to do action|unauthorized/i.test(msg)) {
        errorStrikes++;
        if (errorStrikes >= MAX_STRIKES && !disabledByAuth) {
          disabledByAuth = true;
          try { console.warn('[GiveawayWorker] disabling due to repeated Mongo auth/permission errors'); } catch {}
          try { global.giveawayWorkerDisabledByAuth = true; } catch {}
        }
      }
    } catch {}
  }

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
      checkDisable(e);
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
                const { announceWinners } = require('./discord');
                const announceResult = await announceWinners(fresh, result.winners || []);
                if (announceResult.ok) {
                  await GiveawayModel.updateOne({ _id: fresh._id }, { $set: { winners_announced: true } });
                  
                  // 🆕 CRIAR TICKETS AUTOMÁTICOS PARA VENCEDORES
                  if (result.winners && result.winners.length > 0) {
                    const { getClient } = require('../discordClient');
                    const client = getClient();
                    if (client) {
                      for (const winner of result.winners) {
                        try {
                          await createGiveawayWinnerTicket({
                            guildId: fresh.guild_id,
                            userId: winner.user_id,
                            giveaway: fresh,
                            client
                          });
                          console.log(`[GiveawayWorker] Created ticket for winner ${winner.user_id} in giveaway ${fresh._id}`);
                        } catch (ticketErr) {
                          console.warn(`[GiveawayWorker] Failed to create ticket for ${winner.user_id}:`, ticketErr.message);
                        }
                      }
                    }
                  }
                  
                } else {
                  console.warn(`[GiveawayWorker] Failed to announce winners for ${g._id}: ${announceResult.error || 'unknown'}`);
                  // Retry announcement on next tick (don't mark as announced)
                }
              }
            } catch (announceErr) {
              console.warn('[GiveawayWorker] announcement error:', announceErr && announceErr.message || announceErr);
            }
          }
        } catch (endErr) {
          console.warn('[GiveawayWorker] end giveaway error:', endErr && endErr.message || endErr);
        }
      }
    } catch (e) {
      try { console.warn('[GiveawayWorker] tick error:', e && e.message || e); } catch {}
      checkDisable(e);
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
      checkDisable(e);
    }
  }

  function guarded(fn){
    if (disabledByAuth) return;
    fn();
  }

  // 🆕 Worker para verificar tickets expirados
  async function tickCheckExpiredTickets() {
    try {
      const { getClient } = require('../discordClient');
      const client = getClient();
      if (client) {
        await checkExpiredGiveawayTickets(client);
      }
    } catch (e) {
      try { console.warn('[GiveawayWorker] expired tickets check error:', e && e.message || e); } catch {}
    }
  }

  const i1 = setInterval(() => guarded(tickPromoteScheduled), 10_000);
  const i2 = setInterval(() => guarded(tickEndDue), 8_000);
  const i3 = setInterval(() => guarded(tickLiveUpdates), 30_000);
  const i4 = setInterval(() => guarded(tickCheckExpiredTickets), 60_000); // A cada 1 minuto
  
  // run soon after start
  setTimeout(()=>{ 
    guarded(tickPromoteScheduled); 
    guarded(tickEndDue); 
    guarded(tickLiveUpdates);
    guarded(tickCheckExpiredTickets);
  }, 2000);
  
  return () => { 
    clearInterval(i1); 
    clearInterval(i2); 
    clearInterval(i3); 
    clearInterval(i4);
  };
}

module.exports = { initGiveawayWorker };
