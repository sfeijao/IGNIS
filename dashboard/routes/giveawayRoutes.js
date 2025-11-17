const express = require('express');
const { Router } = express;
const router = Router();

// Auth middleware (reuse same as tickets)
let checkAuth = (req, res, next) => next();
let checkGuildAdmin = (req, res, next) => next();
try {
  ({ checkAuth, checkGuildAdmin } = require('../middleware/auth'));
} catch {
  // Fallback: require login only if available elsewhere. In production this should exist.
}

// Controller
const giveawayController = require('../controllers/giveawayController');
// Permission & rate limit middleware
let { requireGiveawayManage, rateLimitCreate } = (()=>{ try { return require('../middleware/giveawayGuards'); } catch { return { requireGiveawayManage:(req,res,next)=>next(), rateLimitCreate:(req,res,next)=>next() }; } })();

// Routes base: /api/guilds/:guildId/giveaways
router.get('/guilds/:guildId/giveaways', checkAuth, giveawayController.listGiveaways);
router.post('/guilds/:guildId/giveaways', checkAuth, rateLimitCreate, giveawayController.createGiveaway);
router.get('/guilds/:guildId/giveaways/:giveawayId', checkAuth, giveawayController.getGiveaway);
router.patch('/guilds/:guildId/giveaways/:giveawayId', checkAuth, checkGuildAdmin, requireGiveawayManage, giveawayController.updateGiveaway);
router.delete('/guilds/:guildId/giveaways/:giveawayId', checkAuth, checkGuildAdmin, requireGiveawayManage, giveawayController.deleteGiveaway);
router.post('/guilds/:guildId/giveaways/:giveawayId/end', checkAuth, checkGuildAdmin, requireGiveawayManage, giveawayController.endNow);
router.post('/guilds/:guildId/giveaways/:giveawayId/reroll', checkAuth, checkGuildAdmin, requireGiveawayManage, giveawayController.reroll);
router.post('/guilds/:guildId/giveaways/:giveawayId/enter', checkAuth, giveawayController.enter);
router.get('/guilds/:guildId/giveaways/:giveawayId/entries', checkAuth, giveawayController.getEntries);
router.get('/guilds/:guildId/giveaways/:giveawayId/entries/export', checkAuth, checkGuildAdmin, requireGiveawayManage, giveawayController.exportEntriesCsv);
router.post('/guilds/:guildId/giveaways/:giveawayId/publish', checkAuth, checkGuildAdmin, requireGiveawayManage, async (req, res) => {
  try {
    const { GiveawayModel } = require('../../utils/db/giveawayModels');
    const { publishGiveaway } = require('../../utils/giveaways/discord');
    const g = await GiveawayModel.findOne({ _id: req.params.giveawayId, guild_id: req.params.guildId }).lean();
    if (!g) return res.status(404).json({ error: 'not_found' });
    const r = await publishGiveaway(g);
    if (!r.ok) return res.status(400).json(r);
    res.json({ ok: true, messageId: r.messageId });
  } catch (e) {
    res.status(500).json({ error: 'internal_error' });
  }
});

// (Keep routes grouped under /api)

module.exports = router;
