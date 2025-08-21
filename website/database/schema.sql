-- YSNM Bot Dashboard Database Schema
-- Complete moderation and management system

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    discord_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    discriminator TEXT,
    avatar TEXT,
    email TEXT,
    global_name TEXT,
    locale TEXT DEFAULT 'pt-BR',
    flags INTEGER DEFAULT 0,
    premium_type INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Guilds table
CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY,
    discord_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    owner_id TEXT NOT NULL,
    member_count INTEGER DEFAULT 0,
    premium_tier INTEGER DEFAULT 0,
    settings TEXT DEFAULT '{}',
    features TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(discord_id)
);

-- Guild members table
CREATE TABLE IF NOT EXISTS guild_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    nickname TEXT,
    joined_at DATETIME,
    roles TEXT DEFAULT '[]',
    permissions TEXT DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(discord_id),
    FOREIGN KEY (user_id) REFERENCES users(discord_id),
    UNIQUE(guild_id, user_id)
);

-- Moderation actions table
CREATE TABLE IF NOT EXISTS moderation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'warn', 'timeout', 'kick', 'ban', 'unban'
    reason TEXT,
    duration INTEGER, -- in minutes
    expires_at DATETIME,
    metadata TEXT DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(discord_id),
    FOREIGN KEY (user_id) REFERENCES users(discord_id),
    FOREIGN KEY (moderator_id) REFERENCES users(discord_id)
);

-- AutoMod rules table
CREATE TABLE IF NOT EXISTS automod_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'spam', 'profanity', 'links', 'caps', 'mentions'
    enabled BOOLEAN DEFAULT TRUE,
    triggers TEXT DEFAULT '[]',
    actions TEXT DEFAULT '[]',
    exempt_roles TEXT DEFAULT '[]',
    exempt_channels TEXT DEFAULT '[]',
    settings TEXT DEFAULT '{}',
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(discord_id),
    FOREIGN KEY (created_by) REFERENCES users(discord_id)
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    assigned_to TEXT,
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'open', -- 'open', 'assigned', 'closed', 'archived'
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    subject TEXT,
    description TEXT,
    tags TEXT DEFAULT '[]',
    closed_by TEXT,
    closed_reason TEXT,
    closed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(discord_id),
    FOREIGN KEY (user_id) REFERENCES users(discord_id),
    FOREIGN KEY (assigned_to) REFERENCES users(discord_id),
    FOREIGN KEY (closed_by) REFERENCES users(discord_id)
);

-- Ticket messages table
CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT,
    attachments TEXT DEFAULT '[]',
    is_internal BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (user_id) REFERENCES users(discord_id)
);

-- Guild settings table
CREATE TABLE IF NOT EXISTS guild_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    category TEXT NOT NULL, -- 'moderation', 'automod', 'tickets', 'logging', 'general'
    key TEXT NOT NULL,
    value TEXT,
    type TEXT DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(discord_id),
    UNIQUE(guild_id, category, key)
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'message_delete', 'message_edit', 'member_join', 'member_leave', 'role_update', etc.
    user_id TEXT,
    channel_id TEXT,
    target_id TEXT,
    data TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(discord_id),
    FOREIGN KEY (user_id) REFERENCES users(discord_id)
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'message_count', 'member_count', 'voice_time', 'moderation_action'
    date DATE NOT NULL,
    hour INTEGER, -- 0-23 for hourly stats
    value INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(discord_id),
    UNIQUE(guild_id, type, date, hour)
);

-- Warnings table
CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    severity INTEGER DEFAULT 1, -- 1-5
    is_active BOOLEAN DEFAULT TRUE,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(discord_id),
    FOREIGN KEY (user_id) REFERENCES users(discord_id),
    FOREIGN KEY (moderator_id) REFERENCES users(discord_id)
);

-- Commands usage table
CREATE TABLE IF NOT EXISTS command_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    command_name TEXT NOT NULL,
    success BOOLEAN DEFAULT TRUE,
    execution_time INTEGER, -- in milliseconds
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(discord_id),
    FOREIGN KEY (user_id) REFERENCES users(discord_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_guilds_discord_id ON guilds(discord_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_guild_user ON guild_members(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_guild ON moderation_actions(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_guild_status ON tickets(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_logs_guild_type ON logs(guild_id, type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_guild_type_date ON analytics(guild_id, type, date);
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id, is_active);
