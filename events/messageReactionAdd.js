const { Events } = require('discord.js');

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user, client) {
    try {
      // Resolve partials
      if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
      }
      const message = reaction.message;
      if (!message || !message.guild) return;
      if (user.bot) return;

      // Load verification config
      const storage = require('../utils/storage');
      const cfg = await storage.getGuildConfig(message.guild.id).catch(() => ({}));
      const vcfg = cfg?.verification || {};
      if ((vcfg.method || 'button') !== 'reaction') return; // only react-mode

      // Emoji to accept (default ✅)
      const accept = '✅';
      const emojiName = reaction.emoji?.name || '';
      if (emojiName !== accept) return;

      // Identify if the reacted message is a verification panel
      let isVerificationPanel = false;
      let panel = null;
      try {
        // Prefer Mongo if available
        const preferSqlite = (process.env.STORAGE_BACKEND || '').toLowerCase() === 'sqlite';
        if (!preferSqlite && (process.env.MONGO_URI || process.env.MONGODB_URI)) {
          const { PanelModel } = require('../utils/db/models');
          panel = await PanelModel.findOne({ guild_id: message.guild.id, message_id: message.id, type: 'verification' }).lean();
        } else {
          const s = require('../utils/storage-sqlite');
          panel = await s.findPanelByMessage(message.guild.id, message.id);
          if (panel && panel.type !== 'verification') panel = null;
        }
      } catch {}
      if (panel) isVerificationPanel = true;
      // Fallback heuristic: title check when panel not in DB (rare)
      if (!isVerificationPanel && message.embeds?.length) {
        const title = message.embeds[0]?.title || '';
        if (title.includes('Verificação do Servidor')) isVerificationPanel = true;
      }
      if (!isVerificationPanel) return;

      // Resolve member
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      // Roles
      const verifiedRoleId = vcfg.verifiedRoleId || cfg?.roles?.verify || cfg?.verify_role_id || null;
      const unverifiedRoleId = vcfg.unverifiedRoleId || null;
      const verifyRole = verifiedRoleId ? message.guild.roles.cache.get(verifiedRoleId) : null;
      if (!verifyRole) {
        try { await storage.addLog({ guild_id: message.guild.id, user_id: user.id, type: 'verification_fail', message: 'role_not_found' }); } catch {}
        return;
      }

      if (member.roles.cache.has(verifyRole.id)) return; // already verified

      // Grant role
      let addOk = true;
      await member.roles.add(verifyRole).catch(() => { addOk = false; });
      if (!addOk) {
        try { await storage.addLog({ guild_id: message.guild.id, user_id: user.id, type: 'verification_fail', message: 'role_add_failed', role_id: verifyRole.id }); } catch {}
        return;
      }
      if (unverifiedRoleId && member.roles.cache.has(unverifiedRoleId)) {
        await member.roles.remove(unverifiedRoleId).catch(() => {});
      }

      // Optional: clean up user reaction to reduce clutter (ignore errors)
      try {
        const userReactions = message.reactions.cache.get(accept);
        if (userReactions) await userReactions.users.remove(user.id).catch(() => {});
      } catch {}

      // Retention pruning for failure logs if configured
      try {
        const keepDays = Number(vcfg?.logFailRetention);
        const logFails = Boolean(vcfg?.logFails);
        if (logFails && keepDays && keepDays > 0) {
          await storage.pruneLogsByTypeOlderThan(message.guild.id, 'verification_fail', keepDays * 24 * 60 * 60 * 1000);
        }
      } catch {}

      // Success log with method for metrics
      try { await storage.addLog({ guild_id: message.guild.id, user_id: user.id, type: 'verification_success', message: 'reaction' }); } catch {}

      // No direct reply in reaction flow; optional dashboard event
      if (global.socketManager) {
        global.socketManager.broadcast('verification', {
          userId: user.id,
          username: user.username,
          method: 'reaction',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      const logger = require('../utils/logger');
      logger.warn('messageReactionAdd verification handler error:', err?.message || err);
    }
  }
};
