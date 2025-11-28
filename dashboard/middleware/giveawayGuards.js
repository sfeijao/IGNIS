// Middleware for giveaways: permission + rate limiting
// Lightweight, in-memory cooldowns combined with DB queries for active count.
// Assumptions:
//  - req.user exists after auth (fallback bypass in dev).
//  - req.user.guildRoles?.[guildId] is an array of role IDs (if available) OR req.user.admin === true.
//  - Managing giveaways requires either MANAGE_GUILD permission flag exposed as req.user.manageGuilds?.includes(guildId)
//    or a role in ALLOWED_MANAGER_ROLE_IDS env (comma separated) or admin override.

const { GiveawayModel } = require('../../utils/db/giveawayModels');
const logger = require('../utils/logger');

const MAX_ACTIVE_DEFAULT = parseInt(process.env.GIVEAWAYS_MAX_ACTIVE || '5');
const CREATE_COOLDOWN_MS = parseInt(process.env.GIVEAWAYS_CREATE_COOLDOWN_MS || (60_000).toString());

// In-memory structures (reset on process restart – acceptable for rate limiting UI actions)
const lastCreatePerGuild = new Map(); // guildId -> timestamp

async function hasManagerPermission(req, guildId){
  try {
    if (!req.user) return false;

    // Bot owner/admin bypass
    if (req.user.admin) return true;

    // Guild admin/MANAGE_GUILD permission
    if (Array.isArray(req.user.manageGuilds) && req.user.manageGuilds.includes(guildId)) return true;

    // Check via Discord client (additional verification)
    try {
      const client = global.discordClient;
      if (client && client.guilds && client.guilds.cache) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          const member = guild.members.cache.get(req.user.id);
          if (member && member.permissions.has('ManageGuild')) {
            return true;
          }
        }
      }
    } catch (e) { logger.debug('Caught error:', e?.message || e); }

    // Check for giveaway manager role from guild config
    try {
      const storage = require('../../utils/storage');
      const config = await storage.getGuildConfig(guildId);
      const giveawayRoleId = config?.giveaway_manager_role_id;
      const userRoles = req.user.guildRoles && req.user.guildRoles[guildId];
      if (giveawayRoleId && userRoles && userRoles.includes(giveawayRoleId)) {
        return true;
      }
    } catch (e) { logger.debug('Caught error:', e?.message || e); }

    // Fallback to env-based role check
    const allowedEnv = (process.env.GIVEAWAYS_MANAGER_ROLES || '').split(',').map(s=>s.trim()).filter(Boolean);
    const roles = req.user.guildRoles && req.user.guildRoles[guildId];
    if (roles && allowedEnv.length && roles.some(r => allowedEnv.includes(r))) return true;
  } catch (e) { logger.debug('Caught error:', e?.message || e); }
  return false;
}

async function requireGiveawayManage(req, res, next){
  const guildId = req.params.guildId;
  if (!guildId) return res.status(400).json({ error: 'missing_guild_id' });
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const hasPermission = await hasManagerPermission(req, guildId);
  if (!hasPermission) return res.status(403).json({ error: 'forbidden' });
  next();
}

async function rateLimitCreate(req, res, next){
  const guildId = req.params.guildId;
  if (!guildId) return res.status(400).json({ error: 'missing_guild_id' });
  try {
    // Active count check
    const activeCount = await GiveawayModel.countDocuments({ guild_id: guildId, status: { $in: ['active','scheduled'] } });
    if (activeCount >= MAX_ACTIVE_DEFAULT) {
      return res.status(429).json({ error: 'too_many_active', limit: MAX_ACTIVE_DEFAULT });
    }
    // Cooldown
    const now = Date.now();
    const last = lastCreatePerGuild.get(guildId) || 0;
    const remaining = (last + CREATE_COOLDOWN_MS) - now;
    if (remaining > 0) {
      return res.status(429).json({ error: 'cooldown', retry_after_ms: remaining });
    }
    lastCreatePerGuild.set(guildId, now);
  } catch (e) {
    return res.status(500).json({ error: 'rate_limit_internal' });
  }
  next();
}

module.exports = { requireGiveawayManage, rateLimitCreate };
