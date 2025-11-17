// Dashboard authentication middleware
// Provides reusable auth checks for API routes

/**
 * Middleware to check if user is authenticated via Passport.js session
 * Returns 401 if not authenticated
 */
function checkAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ 
      success: false, 
      error: 'Not authenticated',
      message: 'You must be logged in to access this resource'
    });
  }
  next();
}

/**
 * Middleware to check if user has admin/manage permissions for a guild
 * Requires checkAuth to run first
 * Checks if user has MANAGE_GUILD permission or is bot owner
 */
function checkGuildAdmin(req, res, next) {
  const guildId = req.params.guildId;
  
  if (!guildId) {
    return res.status(400).json({ 
      success: false, 
      error: 'missing_guild_id',
      message: 'Guild ID is required'
    });
  }

  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'unauthorized',
      message: 'User session not found'
    });
  }

  // Check if user is bot owner/admin
  if (req.user.admin === true) {
    return next();
  }

  // Check if user has MANAGE_GUILD permission for this guild
  if (Array.isArray(req.user.manageGuilds) && req.user.manageGuilds.includes(guildId)) {
    return next();
  }

  // Additional check: verify user is member of the guild via Discord client
  try {
    const client = global.discordClient;
    if (client) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        const member = guild.members.cache.get(req.user.id);
        if (member && member.permissions.has('ManageGuild')) {
          return next();
        }
      }
    }
  } catch (e) {
    console.warn('Guild admin check error:', e);
  }

  return res.status(403).json({ 
    success: false, 
    error: 'forbidden',
    message: 'You do not have permission to manage this guild'
  });
}

/**
 * Optional: Middleware to check specific permission
 * @param {string} permission - Discord permission name (e.g., 'ManageGuild', 'Administrator')
 */
function checkPermission(permission) {
  return function(req, res, next) {
    const guildId = req.params.guildId;
    
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    if (req.user.admin === true) {
      return next();
    }

    try {
      const client = global.discordClient;
      if (client) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          const member = guild.members.cache.get(req.user.id);
          if (member && member.permissions.has(permission)) {
            return next();
          }
        }
      }
    } catch (e) {
      console.warn(`Permission check (${permission}) error:`, e);
    }

    return res.status(403).json({ 
      success: false, 
      error: 'forbidden',
      message: `Missing required permission: ${permission}`
    });
  };
}

module.exports = {
  checkAuth,
  checkGuildAdmin,
  checkPermission
};
