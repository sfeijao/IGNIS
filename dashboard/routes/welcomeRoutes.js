const express = require('express');
const router = express.Router();
const { WelcomeConfigModel } = require('../../utils/db/models');

// GET config
router.get('/guild/:gid/welcome-config', async (req, res) => {
  try {
    const { gid } = req.params;
    let config = await WelcomeConfigModel.findOne({ guild_id: gid }).lean();
    if (!config) {
      // Retornar config padrão
      config = {
        guild_id: gid,
        welcome: { enabled: false, message: 'Bem-vindo {user} ao **{server}**!' },
        goodbye: { enabled: false, message: '👋 **{user.tag}** saiu do servidor.' }
      };
    }
    return res.json({ ok: true, config });
  } catch (e) {
    console.error('[WelcomeRoutes] GET error:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// UPDATE/CREATE config
router.post('/guild/:gid/welcome-config', async (req, res) => {
  try {
    const { gid } = req.params;
    const { welcome, goodbye } = req.body;
    
    const update = { updated_at: new Date() };
    if (welcome) update.welcome = welcome;
    if (goodbye) update.goodbye = goodbye;
    
    const config = await WelcomeConfigModel.findOneAndUpdate(
      { guild_id: gid },
      { $set: update },
      { upsert: true, new: true }
    );
    
    return res.json({ ok: true, config });
  } catch (e) {
    console.error('[WelcomeRoutes] POST error:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
