const express = require('express');
const router = express.Router();
const { setupStatsChannels, updateStatsChannels, removeStatsChannels, getStatsConfig } = require('../../utils/serverStats');

// GET config
router.get('/guild/:gid/server-stats', async (req, res) => {
  try {
    const { gid } = req.params;
    const config = await getStatsConfig(gid);
    return res.json({ ok: true, config });
  } catch (e) {
    console.error('[ServerStatsRoutes] GET error:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// SETUP canais
router.post('/guild/:gid/server-stats/setup', async (req, res) => {
  try {
    const { gid } = req.params;
    const guild = req.app.get('discordClient')?.guilds.cache.get(gid);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const result = await setupStatsChannels(guild);
    return res.json(result);
  } catch (e) {
    console.error('[ServerStatsRoutes] SETUP error:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// UPDATE manualmente
router.post('/guild/:gid/server-stats/update', async (req, res) => {
  try {
    const { gid } = req.params;
    const guild = req.app.get('discordClient')?.guilds.cache.get(gid);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const result = await updateStatsChannels(guild);
    return res.json(result);
  } catch (e) {
    console.error('[ServerStatsRoutes] UPDATE error:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// REMOVE canais
router.post('/guild/:gid/server-stats/remove', async (req, res) => {
  try {
    const { gid } = req.params;
    const guild = req.app.get('discordClient')?.guilds.cache.get(gid);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const result = await removeStatsChannels(guild);
    return res.json(result);
  } catch (e) {
    console.error('[ServerStatsRoutes] REMOVE error:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
