const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const fs = require('fs');
const Joi = require('joi');
require('dotenv').config();

const config = require('../utils/config');
const logger = require('../utils/logger');
const { PermissionFlagsBits, ActivityType } = require('discord.js');

const app = express();
let io = null;
const PORT = process.env.PORT || 4000;
// When running behind a reverse proxy (Railway/Heroku), trust the proxy so secure cookies work
try { app.set('trust proxy', 1); } catch {}
const isSqlite = (process.env.STORAGE_BACKEND || '').toLowerCase() === 'sqlite';
const BYPASS_AUTH = (process.env.DASHBOARD_BYPASS_AUTH || '').toLowerCase() === 'true';
const IS_LOCAL = (process.env.NODE_ENV || 'development') !== 'production';
const OAUTH_VERBOSE = (process.env.OAUTH_VERBOSE_LOGS || '').toLowerCase() === 'true';
// Suppress common noisy warnings in production
if ((process.env.NODE_ENV || 'production') === 'production') {
    process.removeAllListeners('warning');
    process.on('warning', (w) => {
        // Keep a single-line summary for visibility in logs
        if (/punycode/i.test(String(w && w.name))) return; // ignore punycode deprecation
        try { console.warn('Warning:', w.name || 'Warning', '-', w.message || String(w)); } catch {}
    });
}
// Prefer SQLite if explicitly selected or when Mongo isn't configured
const hasMongoEnv = !!(process.env.MONGO_URI || process.env.MONGODB_URI);
const preferSqlite = isSqlite || !hasMongoEnv;

// ===== Moderation Export Presets (File persistence) =====
const PRESETS_FILE = path.join(__dirname, '..', 'data', 'mod-presets.json');
function loadModPresetsSafe(){
    try {
        if(!fs.existsSync(PRESETS_FILE)) return {};
        const raw = fs.readFileSync(PRESETS_FILE,'utf8');
        const obj = JSON.parse(raw);
        return (obj && typeof obj === 'object') ? obj : {};
    } catch { return {}; }
}
function saveModPresetsSafe(presets){
    try {
        fs.mkdirSync(path.dirname(PRESETS_FILE), { recursive:true });
        fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets,null,2),'utf8');
        return true;
    } catch(e){ logger.error('Failed to save mod presets', e); return false; }
}

// In-memory performance history (lightweight)
const perfHistory = {
    // guildId: [{ t: epochMs, cpu, memMB, ticketsOpen, activeUsers }, ...]
};

function pushPerfSample(guildId, sample){
    const maxLen = 200; // keep last 200 samples
    if(!perfHistory[guildId]) perfHistory[guildId] = [];
    const row = { t: Date.now(), ...sample };
    perfHistory[guildId].push(row);
    if(perfHistory[guildId].length > maxLen) perfHistory[guildId].splice(0, perfHistory[guildId].length - maxLen);
}

// Helper function for OAuth callback URL
const getCallbackURL = () => {
    if (process.env.CALLBACK_URL) {
        return process.env.CALLBACK_URL;
    }
    
    // Auto-detect based on environment  
    const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'ignisbot-alberto.up.railway.app'}`
        : `http://localhost:${PORT}`;
    
    return `${baseUrl}/auth/discord/callback`;
};

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
// Paths for classic dashboard (rich features) and the revamped website UI
const WEBSITE_PUBLIC_DIR = path.join(__dirname, '..', 'website', 'public');
const CLASSIC_PUBLIC_DIR = path.join(__dirname, 'public');
function requireAuth(req, res, next){
    // Development-only bypasses to allow visual checks without OAuth locally
    // 1) Env flag DASHBOARD_BYPASS_AUTH=true
    // 2) Local query/header toggle: ?dev=1 or x-dev-bypass: 1 (only when not in production)
    if (BYPASS_AUTH || (IS_LOCAL && (req.query?.dev === '1' || req.headers['x-dev-bypass'] === '1'))) {
        if (!req.user) {
            // Inject a minimal fake user for pages that expect it
            req.user = { id: '0', username: 'dev', discriminator: '0000', avatar: null, accessToken: null };
        }
        return next();
    }
    try { if (req.isAuthenticated && req.isAuthenticated()) return next(); } catch {}
    return res.redirect('/login');
}
// Serve classic dashboard assets under /dashboard (no index to avoid bypassing auth on HTML routes)
app.use('/dashboard', express.static(CLASSIC_PUBLIC_DIR, { index: false, redirect: false }));
// Serve the revamped website dashboard assets under /dashboard-new (separate entry point)
app.use('/dashboard-new', express.static(WEBSITE_PUBLIC_DIR, { index: false, redirect: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'ignis-dashboard-development-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        // Use secure cookies in production; requires trust proxy for TLS-terminating proxies
        secure: (process.env.NODE_ENV || 'production') === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        httpOnly: true
    }
});
app.use(sessionMiddleware);

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Development auth bypass for API routes as well (local only or env flag)
app.use((req, res, next) => {
    try {
        const devHeader = req.headers['x-dev-bypass'] === '1';
        const devQuery = req.query && req.query.dev === '1';
        if (BYPASS_AUTH || (IS_LOCAL && (devHeader || devQuery))) {
            if (!req.user) req.user = { id: '0', username: 'dev', discriminator: '0000', avatar: null, accessToken: null };
            // Monkey-patch isAuthenticated so API guards succeed
            req.isAuthenticated = () => true;
        }
    } catch {}
    next();
});

// Discord OAuth Strategy
passport.use(new DiscordStrategy({
    clientID: config.DISCORD.CLIENT_ID,
    clientSecret: config.DISCORD.CLIENT_SECRET,
    callbackURL: getCallbackURL(),
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    profile.accessToken = accessToken;
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    if (OAUTH_VERBOSE) logger.info(`Serializing user: ${user.username} (${user.id})`);
    else logger.debug && logger.debug(`Serializing user: ${user.username} (${user.id})`);
    done(null, user);
});

passport.deserializeUser((user, done) => {
    if (OAUTH_VERBOSE) logger.info(`Deserializing user: ${user.username} (${user.id})`);
    else logger.debug && logger.debug(`Deserializing user: ${user.username} (${user.id})`);
    done(null, user);
});

// Routes
app.get('/', (req, res) => {
    if (OAUTH_VERBOSE) logger.info(`Route / - isAuthenticated: ${req.isAuthenticated()}, sessionID: ${req.sessionID}`);
    if (req.isAuthenticated()) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.get('/login', (req, res) => {
    if (OAUTH_VERBOSE) logger.info(`Route /login - isAuthenticated: ${req.isAuthenticated()}, sessionID: ${req.sessionID}`);
    if (req.isAuthenticated()) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

// Classic dashboard as default under /dashboard
app.get('/dashboard', requireAuth, (req, res) => {
    if (OAUTH_VERBOSE) logger.info(`Route /dashboard - isAuthenticated: ${req.isAuthenticated()}, user: ${req.user ? req.user.username : 'none'}, sessionID: ${req.sessionID}`);
    try {
        const indexPath = path.join(CLASSIC_PUBLIC_DIR, 'dashboard.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        if (!/\<base\s+href=/i.test(html)) {
            html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n  <base href="/dashboard/">`);
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
    } catch (e) {
        try { return res.sendFile(path.join(CLASSIC_PUBLIC_DIR, 'dashboard.html')); } catch {}
        return res.status(500).send('Dashboard unavailable');
    }
});

// Also handle trailing slash explicitly (no redirect) with auth
app.get('/dashboard/', requireAuth, (req, res) => {
    try {
        const indexPath = path.join(CLASSIC_PUBLIC_DIR, 'dashboard.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        if (!/\<base\s+href=/i.test(html)) {
            html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n  <base href="/dashboard/">`);
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
    } catch (e) {
        try { return res.sendFile(path.join(CLASSIC_PUBLIC_DIR, 'dashboard.html')); } catch {}
        return res.status(500).send('Dashboard unavailable');
    }
});

// New UI entry under /dashboard-new
app.get(['/dashboard-new','/dashboard-new/'], requireAuth, (req, res) => {
    try {
        const indexPath = path.join(WEBSITE_PUBLIC_DIR, 'dashboard.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        if (!/\<base\s+href=/i.test(html)) {
            html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n  <base href="/dashboard-new/">`);
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
    } catch (e) {
        try { return res.sendFile(path.join(WEBSITE_PUBLIC_DIR, 'dashboard.html')); } catch {}
        return res.status(500).send('Dashboard (new UI) unavailable');
    }
});

// Secure direct ticket page access under dashboard path
app.get(['/dashboard/ticket.html','/dashboard/ticket'], requireAuth, (req, res) => {
    try {
        const indexPath = path.join(__dirname, 'public', 'ticket.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        // keep base for dashboard assets context
        if (!/\<base\s+href=/i.test(html)) {
            html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n  <base href="/dashboard/">`);
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
    } catch (e) {
        try { return res.sendFile(path.join(__dirname, 'public', 'ticket.html')); } catch {}
        return res.status(500).send('Ticket page unavailable');
    }
});

// Auth routes
app.get('/auth/discord', passport.authenticate('discord'));

// Debug endpoint para verificar configuração OAuth
app.get('/auth/debug', (req, res) => {
    res.json({
        clientID: config.DISCORD.CLIENT_ID,
        callbackURL: getCallbackURL(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        railwayDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
        hasClientSecret: !!config.DISCORD.CLIENT_SECRET
    });
});

// Debug endpoint para verificar sessão
app.get('/debug/session', (req, res) => {
    res.json({
        isAuthenticated: req.isAuthenticated(),
        sessionID: req.sessionID,
        user: req.user || null,
        session: req.session,
        cookies: req.headers.cookie
    });
});

app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/login' }),
    (req, res) => {
        logger.info(`OAuth callback success - user: ${req.user ? req.user.username : 'none'}`);
        if (OAUTH_VERBOSE) logger.info(`Session data:`, req.session);
        res.redirect('/dashboard');
    }
);

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) logger.error('Logout error:', err);
        res.redirect('/');
    });
});

// Health endpoint for dashboard and services
app.get('/api/health', (req, res) => {
    try {
        const client = global.discordClient;
        let discord = false;
        try { discord = !!(client && typeof client.isReady === 'function' ? client.isReady() : client?.readyAt); } catch {}
        let mongoState = 'disabled';
        let mongoLastError = null;
        try {
            const hasMongoEnv = (process.env.MONGO_URI || process.env.MONGODB_URI);
            if (hasMongoEnv) {
                const { isReady, getStatus } = require('../utils/db/mongoose');
                mongoState = isReady() ? 'connected' : 'disconnected';
                const st = getStatus && getStatus();
                mongoLastError = st && st.lastError || null;
            }
        } catch { mongoState = 'unknown'; }
        // Determine active storage backend from storage module state
        let storageBackend = 'json';
        try {
            const storage = require('../utils/storage');
            // cheap heuristic: useMongo flag set by storage
            storageBackend = storage && storage.__backend ? storage.__backend : (mongoState === 'connected' ? 'mongo' : ((process.env.STORAGE_BACKEND||'').toLowerCase()==='sqlite' ? 'sqlite' : 'json'));
        } catch {}
        return res.json({
            success: true,
            dashboard: true,
            discord,
            mongo: mongoState,
            mongoError: mongoLastError,
            storage: storageBackend,
            time: new Date().toISOString()
        });
    } catch (e) {
        logger.error('Error in health endpoint:', e);
        return res.status(500).json({ success: false, error: 'health_failed' });
    }
});

// API Routes
app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    res.json({
        success: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            discriminator: req.user.discriminator,
            avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : null
        }
    });
});

app.get('/api/guilds', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    try {
        // Ensure we have an access token
        const accessToken = req.user && req.user.accessToken;
        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'missing_oauth_token' });
        }

        // Get user guilds from Discord API using access token
        const fetch = require('node-fetch');
        const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const txt = await response.text().catch(() => '');
            logger.warn(`Discord /users/@me/guilds failed: ${response.status} ${response.statusText} ${txt}`);
            // Likely expired/invalid OAuth token: ask client to re-auth
            return res.status(401).json({ success: false, error: 'discord_oauth_failed', status: response.status });
        }

        let userGuilds = await response.json();
        if (!Array.isArray(userGuilds)) {
            logger.warn('Unexpected /users/@me/guilds payload (not array).');
            userGuilds = [];
        }

        // Get bot's guilds
        const client = global.discordClient;
        if (!client) {
            return res.json({ success: true, guilds: [] });
        }

        const botGuilds = client.guilds.cache;

        // Filter guilds where user has admin permissions and bot is present
        const managedGuilds = userGuilds.filter(guild => {
            const permStr = guild.permissions_new || guild.permissions; // both are strings in v10
            let hasAdmin = false;
            try {
                if (permStr != null) hasAdmin = (BigInt(permStr) & 8n) === 8n;
            } catch { // fallback to number coercion
                try { hasAdmin = ((Number(permStr) | 0) & 0x8) === 0x8; } catch {}
            }
            const botPresent = botGuilds.has(guild.id);
            return hasAdmin && botPresent;
        }).map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            memberCount: botGuilds.get(guild.id)?.memberCount || 0,
            botPresent: true
        }));

        return res.json({ success: true, guilds: managedGuilds });

    } catch (error) {
        logger.error('Error fetching guilds:', error);
        return res.status(500).json({ success: false, error: 'guilds_fetch_failed' });
    }
});

app.get('/api/guild/:guildId/stats', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    try {
        const guildId = req.params.guildId;
        const client = global.discordClient;
        
        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not available' });
        }
        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }
        
        const stats = {
            memberCount: guild.memberCount,
            channelCount: guild.channels.cache.size,
            roleCount: guild.roles.cache.size,
            boosterCount: guild.premiumSubscriptionCount || 0,
            onlineCount: guild.members.cache.filter(member => 
                member.presence?.status === 'online' || 
                member.presence?.status === 'idle' || 
                member.presence?.status === 'dnd'
            ).size
        };

        // Push a perf sample
        try {
            const cpu = 0; // Placeholder (no OS read); could integrate os.loadavg()[0]
            const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
            pushPerfSample(guildId, { cpu, memMB, ticketsOpen: 0, activeUsers: stats.onlineCount });
        } catch {}
        
        res.json({ success: true, stats });
        
    } catch (error) {
        logger.error('Error fetching guild stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// Roles and Members management
app.get('/api/guild/:guildId/roles', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
        const guildId = req.params.guildId;
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });
        // Fetch roles
        const me = guild.members.me || guild.members.cache.get(client.user.id);
        const myHighest = me?.roles?.highest?.position ?? 0;
        const roles = guild.roles.cache
            .sort((a,b)=> a.position === b.position ? 0 : a.position > b.position ? -1 : 1)
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position, managed: r.managed, hoist: r.hoist, mentionable: r.mentionable, manageable: !r.managed && r.position < myHighest }));
        return res.json({ success: true, roles, botMax: myHighest });
    } catch (e) {
        logger.error('roles list error', e);
        return res.status(500).json({ success: false, error: 'roles_failed' });
    }
});

// Create role
app.post('/api/guild/:guildId/roles', async (req,res)=>{
    if(!req.isAuthenticated()) return res.status(401).json({ success:false, error:'Not authenticated' });
    try {
        const guildId = req.params.guildId;
        const client = global.discordClient; if(!client) return res.status(500).json({ success:false, error:'Bot not available' });
        const guild = client.guilds.cache.get(guildId); if(!guild) return res.status(404).json({ success:false, error:'Guild not found' });
        const me = guild.members.me || guild.members.cache.get(client.user.id);
        const myHighest = me?.roles?.highest?.position ?? 0;
        const name = (req.body && req.body.name) ? String(req.body.name).trim() : 'novo-cargo';
        const color = (req.body && req.body.color) ? String(req.body.color) : undefined;
        const hoist = !!(req.body && req.body.hoist);
        const mentionable = !!(req.body && req.body.mentionable);
        const role = await guild.roles.create({ name, color, hoist, mentionable, reason:'Dashboard create role' });
        if(role.position >= myHighest){
            // Immediately lower it if above bot (rare, but safety)
            try { await role.setPosition(Math.max(0, myHighest-1)); } catch {}
        }
        return res.json({ success:true, role:{ id:role.id, name:role.name, color:role.hexColor, position:role.position, managed:role.managed, hoist:role.hoist, mentionable:role.mentionable } });
    } catch(e){ logger.error('role create error', e); return res.status(500).json({ success:false, error:'role_create_failed' }); }
});

// Delete role
app.delete('/api/guild/:guildId/roles/:roleId', async (req,res)=>{
    if(!req.isAuthenticated()) return res.status(401).json({ success:false, error:'Not authenticated' });
    try {
        const guildId = req.params.guildId; const roleId = req.params.roleId;
        const client = global.discordClient; if(!client) return res.status(500).json({ success:false, error:'Bot not available' });
        const guild = client.guilds.cache.get(guildId); if(!guild) return res.status(404).json({ success:false, error:'Guild not found' });
        const role = guild.roles.cache.get(roleId); if(!role) return res.status(404).json({ success:false, error:'Role not found' });
        if(role.managed) return res.status(400).json({ success:false, error:'role_managed' });
        const me = guild.members.me || guild.members.cache.get(client.user.id);
        const myHighest = me?.roles?.highest?.position ?? 0;
        if(role.position >= myHighest) return res.status(403).json({ success:false, error:'insufficient_role_hierarchy' });
        await role.delete('Dashboard delete role');
        return res.json({ success:true });
    } catch(e){ logger.error('role delete error', e); return res.status(500).json({ success:false, error:'role_delete_failed' }); }
});

// Reorder / move role (set new position or relative move)
app.post('/api/guild/:guildId/roles/:roleId/move', async (req,res)=>{
    if(!req.isAuthenticated()) return res.status(401).json({ success:false, error:'Not authenticated' });
    try {
        const guildId = req.params.guildId; const roleId = req.params.roleId;
        const { position, direction, delta } = req.body || {};
        const client = global.discordClient; if(!client) return res.status(500).json({ success:false, error:'Bot not available' });
        const guild = client.guilds.cache.get(guildId); if(!guild) return res.status(404).json({ success:false, error:'Guild not found' });
        const role = guild.roles.cache.get(roleId); if(!role) return res.status(404).json({ success:false, error:'Role not found' });
        if(role.managed) return res.status(400).json({ success:false, error:'role_managed' });
        const me = guild.members.me || guild.members.cache.get(client.user.id);
        const myHighest = me?.roles?.highest?.position ?? 0;
        if(role.position >= myHighest) return res.status(403).json({ success:false, error:'insufficient_role_hierarchy' });
        let newPos;
        if(typeof position === 'number' && Number.isFinite(position)) newPos = position;
        else if(direction){
            const d = (direction === 'up') ? 1 : -1;
            const step = (typeof delta === 'number' && Number.isFinite(delta)) ? delta : 1;
            newPos = role.position + d*step;
        } else { return res.status(400).json({ success:false, error:'invalid_move_params' }); }
        newPos = Math.max(0, Math.min(newPos, myHighest-1));
        await role.setPosition(newPos, { reason:'Dashboard move role' });
        return res.json({ success:true, position: role.position });
    } catch(e){ logger.error('role move error', e); return res.status(500).json({ success:false, error:'role_move_failed' }); }
});

// ===== Mod Export Presets Sync Endpoints =====
app.get('/api/guild/:guildId/mod-presets', (req,res)=>{
    if(!req.isAuthenticated()) return res.status(401).json({ success:false, error:'Not authenticated' });
    try {
        const guildId = req.params.guildId;
        // Basic membership check (bot in guild) – deeper permission could be added later
        const client = global.discordClient; if(!client) return res.status(500).json({ success:false, error:'Bot not available' });
        if(!client.guilds.cache.get(guildId)) return res.status(404).json({ success:false, error:'Guild not found' });
        return res.json({ success:true, presets: loadModPresetsSafe() });
    } catch(e){ logger.error('mod-presets get error', e); return res.status(500).json({ success:false, error:'mod_presets_failed' }); }
});

// Upsert multiple or single
app.post('/api/guild/:guildId/mod-presets', (req,res)=>{
    if(!req.isAuthenticated()) return res.status(401).json({ success:false, error:'Not authenticated' });
    try {
        const guildId = req.params.guildId;
        const client = global.discordClient; if(!client) return res.status(500).json({ success:false, error:'Bot not available' });
        if(!client.guilds.cache.get(guildId)) return res.status(404).json({ success:false, error:'Guild not found' });
        const body = req.body || {};
        let presets = loadModPresetsSafe();
        if(body && body.presets && typeof body.presets === 'object'){
            presets = body.presets; // replace all
        } else if(body && body.name && body.preset){
            presets[body.name] = body.preset;
        } else {
            return res.status(400).json({ success:false, error:'invalid_body' });
        }
        if(!saveModPresetsSafe(presets)) return res.status(500).json({ success:false, error:'save_failed' });
        return res.json({ success:true, presets });
    } catch(e){ logger.error('mod-presets post error', e); return res.status(500).json({ success:false, error:'mod_presets_failed' }); }
});

app.delete('/api/guild/:guildId/mod-presets/:name', (req,res)=>{
    if(!req.isAuthenticated()) return res.status(401).json({ success:false, error:'Not authenticated' });
    try {
        const guildId = req.params.guildId; const name = req.params.name;
        const client = global.discordClient; if(!client) return res.status(500).json({ success:false, error:'Bot not available' });
        if(!client.guilds.cache.get(guildId)) return res.status(404).json({ success:false, error:'Guild not found' });
        const presets = loadModPresetsSafe();
        if(!(name in presets)) return res.status(404).json({ success:false, error:'preset_not_found' });
        delete presets[name];
        if(!saveModPresetsSafe(presets)) return res.status(500).json({ success:false, error:'save_failed' });
        return res.json({ success:true, presets });
    } catch(e){ logger.error('mod-presets delete error', e); return res.status(500).json({ success:false, error:'mod_presets_failed' }); }
});

app.get('/api/guild/:guildId/members', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
        const guildId = req.params.guildId;
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
    const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });
    const me = guild.members.me || guild.members.cache.get(client.user.id);
    const myHighest = me?.roles?.highest?.position ?? 0;
        const q = String(req.query.q || '').toLowerCase();
        const roleId = String(req.query.role || '');
        let limit = parseInt(String(req.query.limit || '50'), 10); if (!Number.isFinite(limit) || limit < 1) limit = 50; limit = Math.min(200, limit);
        const refresh = String(req.query.refresh || '').toLowerCase() === 'true';
        if (refresh) { try { await guild.members.fetch(); } catch {}
        }
        let members = guild.members.cache;
        if (roleId) {
            const role = guild.roles.cache.get(roleId);
            if (role) members = role.members;
            else members = guild.members.cache.filter(() => false);
        }
        const out = [];
        for (const m of members.values()) {
            if (out.length >= limit) break;
            const name = `${m.user.username}#${m.user.discriminator}`.toLowerCase();
            if (q && !name.includes(q) && !(m.nickname || '').toLowerCase().includes(q)) continue;
            const memberHighest = m?.roles?.highest?.position ?? 0;
            const manageable = memberHighest < myHighest;
            out.push({ id: m.id, username: m.user.username, discriminator: m.user.discriminator, avatar: m.user.avatar, nick: m.nickname || null, roles: [...m.roles.cache.keys()], manageable });
        }
        return res.json({ success: true, members: out, count: out.length });
    } catch (e) {
        logger.error('members list error', e);
        return res.status(500).json({ success: false, error: 'members_failed' });
    }
});

app.post('/api/guild/:guildId/members/:userId/roles', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
        const guildId = req.params.guildId; const userId = req.params.userId;
        const { add, remove } = req.body || {};
        const toAdd = Array.isArray(add) ? add.map(String) : [];
        const toRemove = Array.isArray(remove) ? remove.map(String) : [];
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });
        let member = guild.members.cache.get(userId);
        if (!member) { try { member = await guild.members.fetch(userId); } catch {}
        }
        if (!member) return res.status(404).json({ success: false, error: 'Member not found' });
        // Permission checks: the bot must be higher than target roles AND member's highest
        const me = guild.members.me || guild.members.cache.get(client.user.id);
        const myHighest = me?.roles?.highest?.position ?? 0;
        // 1) Cannot edit member whose highest role is >= bot's highest
        const memberHighest = member?.roles?.highest?.position ?? 0;
        if (memberHighest >= myHighest) {
            return res.status(403).json({ success: false, error: 'insufficient_member_hierarchy' });
        }
        // 2) Split roles into manageable and blocked by hierarchy
        const details = { added: [], removed: [], skipped: [], errors: [] };
        const manageableAdd = [];
        for (const rid of toAdd) {
            const r = guild.roles.cache.get(rid);
            if (!r) { details.skipped.push({ roleId: rid, reason: 'role_not_found' }); continue; }
            if (r.position >= myHighest || r.managed) { details.skipped.push({ roleId: rid, reason: 'insufficient_role_hierarchy' }); continue; }
            manageableAdd.push(rid);
        }
        const manageableRemove = [];
        for (const rid of toRemove) {
            const r = guild.roles.cache.get(rid);
            if (!r) { details.skipped.push({ roleId: rid, reason: 'role_not_found' }); continue; }
            if (r.position >= myHighest || r.managed) { details.skipped.push({ roleId: rid, reason: 'insufficient_role_hierarchy' }); continue; }
            manageableRemove.push(rid);
        }
        // 3) Apply manageable changes, capture partial errors without failing entire request
        if (manageableAdd.length) {
            try { await member.roles.add(manageableAdd, 'Dashboard roles update'); details.added.push(...manageableAdd); }
            catch (e) { logger.warn('roles add failed', e); details.errors.push({ op: 'add', roles: manageableAdd, error: 'add_failed' }); }
        }
        if (manageableRemove.length) {
            try { await member.roles.remove(manageableRemove, 'Dashboard roles update'); details.removed.push(...manageableRemove); }
            catch (e) { logger.warn('roles remove failed', e); details.errors.push({ op: 'remove', roles: manageableRemove, error: 'remove_failed' }); }
        }
        const partial = (details.added.length || details.removed.length) && (details.skipped.length || details.errors.length);
        return res.json({ success: true, partial, details });
    } catch (e) {
        logger.error('member roles update error', e);
        return res.status(500).json({ success: false, error: 'roles_update_failed' });
    }
});

app.get('/api/guild/:guildId/tickets', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    try {
        const guildId = req.params.guildId;
        const client = global.discordClient;
        
        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not available' });
        }

        // Verificar se o usuário tem permissões no servidor
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        // Usar storage para obter tickets e aplicar filtros/paginação
        const storage = require('../utils/storage');
        const allTickets = await storage.getTickets(guildId);

        // Inputs
    const status = (req.query.status || '').toString().trim().toLowerCase(); // '', 'open', 'claimed', 'closed', 'pending'
    const priority = (req.query.priority || '').toString().trim().toLowerCase(); // '', 'low','normal','high','urgent'
        const q = (req.query.q || '').toString().trim().toLowerCase();
        const from = req.query.from ? new Date(req.query.from) : null; // ISO or date string
        const to = req.query.to ? new Date(req.query.to) : null;
    const category = (req.query.category || '').toString().trim().toLowerCase();
    let assigned = (req.query.assigned || '').toString().trim(); // user id or 'me' or ''
    if (assigned.toLowerCase() === 'me') assigned = (req.user && req.user.id) ? req.user.id : '';
    const roleId = (req.query.role || '').toString().trim();
    const staffOnly = String(req.query.staffOnly || '').toLowerCase() === 'true' || String(req.query.staffOnly || '') === '1';
    const deepRoleFetch = String(req.query.deepRoleFetch || '').toLowerCase() === 'true' || String(req.query.deepRoleFetch || '') === '1';
        let page = parseInt(String(req.query.page || '1'), 10); if (!Number.isFinite(page) || page < 1) page = 1;
        let pageSize = parseInt(String(req.query.pageSize || '20'), 10); if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 20; pageSize = Math.min(100, pageSize);

        // Filter
        let filtered = allTickets.slice();
        if (status) filtered = filtered.filter(t => (t.status || '').toLowerCase() === status);
        if (priority) filtered = filtered.filter(t => (t.priority || '').toLowerCase() === priority);
    if (from && !Number.isNaN(from.getTime())) filtered = filtered.filter(t => new Date(t.created_at) >= from);
    if (to && !Number.isNaN(to.getTime())) filtered = filtered.filter(t => new Date(t.created_at) <= to);
    if (category) filtered = filtered.filter(t => (t.category || '').toLowerCase() === category);
    if (assigned) filtered = filtered.filter(t => `${t.assigned_to || ''}` === `${assigned}`);
        // staffOnly: status must be claimed and assigned_to must be a member of given role
        if (staffOnly && roleId) {
            try {
                if (deepRoleFetch) {
                    try { await guild.members.fetch(); } catch {}
                }
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    const roleMemberIds = new Set(role.members.map(m => `${m.id}`));
                    filtered = filtered.filter(t => (t.status || '').toLowerCase() === 'claimed' && roleMemberIds.has(`${t.assigned_to || ''}`));
                } else {
                    // If role not found, result should be empty when staffOnly requested
                    filtered = [];
                }
            } catch {}
        }
        if (q) {
            filtered = filtered.filter(t => {
                const hay = [
                    t.id,
                    t.channel_id,
                    t.user_id,
                    t.category,
                    t.subject,
                    t.description,
                    t.status,
                    t.priority
                ].map(x => (x == null ? '' : String(x).toLowerCase())).join(' ');
                return hay.includes(q);
            });
        }

        // Sort by created_at desc
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Stats for filtered set
        const stats = {
            total: filtered.length,
            open: filtered.filter(t => t.status === 'open').length,
            claimed: filtered.filter(t => t.status === 'claimed').length,
            closed: filtered.filter(t => t.status === 'closed').length,
            pending: filtered.filter(t => t.status === 'pending').length
        };

        // Pagination calculations
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (page > totalPages) page = totalPages;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pageItems = filtered.slice(start, end);

        // Enrich only the current page
        const enrichedTickets = await Promise.all(pageItems.map(async (ticket) => {
            try {
                const channel = guild.channels.cache.get(ticket.channel_id);
                const owner = await client.users.fetch(ticket.user_id).catch(() => null);
                const claimedBy = ticket.assigned_to ? await client.users.fetch(ticket.assigned_to).catch(() => null) : null;
                return {
                    ...ticket,
                    channelExists: !!channel,
                    channelName: channel?.name || 'Canal deletado',
                    ownerTag: owner ? `${owner.username}#${owner.discriminator}` : 'Usuário desconhecido',
                    ownerAvatar: owner?.displayAvatarURL({ size: 32 }) || null,
                    claimedByTag: claimedBy ? `${claimedBy.username}#${claimedBy.discriminator}` : null,
                    claimedByAvatar: claimedBy?.displayAvatarURL({ size: 32 }) || null,
                    timeAgo: formatTimeAgo(new Date(ticket.created_at))
                };
            } catch (error) {
                logger.error(`Erro ao enriquecer ticket ${ticket.id}:`, error);
                return {
                    ...ticket,
                    channelExists: false,
                    channelName: 'Erro ao carregar',
                    ownerTag: 'Erro ao carregar',
                    ownerAvatar: null,
                    claimedByTag: null,
                    claimedByAvatar: null,
                    timeAgo: formatTimeAgo(new Date(ticket.created_at))
                };
            }
        }));

        res.json({
            success: true,
            tickets: enrichedTickets,
            stats,
            pagination: { page, pageSize, total, totalPages }
        });
        
    } catch (error) {
        logger.error('Error fetching tickets:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
    }
});

// Export filtered tickets server-side with a safe cap
app.get('/api/guild/:guildId/tickets/export', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
        const guildId = req.params.guildId;
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });

        const storage = require('../utils/storage');
        const allTickets = await storage.getTickets(guildId);
        // Apply same filters
        const status = (req.query.status || '').toString().trim().toLowerCase();
        const priority = (req.query.priority || '').toString().trim().toLowerCase();
        const q = (req.query.q || '').toString().trim().toLowerCase();
        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
        const category = (req.query.category || '').toString().trim().toLowerCase();
        let assigned = (req.query.assigned || '').toString().trim();
        if (assigned.toLowerCase() === 'me') assigned = (req.user && req.user.id) ? req.user.id : '';
    const roleId = (req.query.role || '').toString().trim();
    const staffOnly = String(req.query.staffOnly || '').toLowerCase() === 'true' || String(req.query.staffOnly || '') === '1';
    const deepRoleFetch = String(req.query.deepRoleFetch || '').toLowerCase() === 'true' || String(req.query.deepRoleFetch || '') === '1';
        let filtered = allTickets.slice();
        if (status) filtered = filtered.filter(t => (t.status || '').toLowerCase() === status);
        if (priority) filtered = filtered.filter(t => (t.priority || '').toLowerCase() === priority);
        if (from && !Number.isNaN(from.getTime())) filtered = filtered.filter(t => new Date(t.created_at) >= from);
        if (to && !Number.isNaN(to.getTime())) filtered = filtered.filter(t => new Date(t.created_at) <= to);
        if (category) filtered = filtered.filter(t => (t.category || '').toLowerCase() === category);
        if (assigned) filtered = filtered.filter(t => `${t.assigned_to || ''}` === `${assigned}`);
        if (staffOnly && roleId) {
            try {
                if (deepRoleFetch) {
                    try { await guild.members.fetch(); } catch {}
                }
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    const roleMemberIds = new Set(role.members.map(m => `${m.id}`));
                    filtered = filtered.filter(t => (t.status || '').toLowerCase() === 'claimed' && roleMemberIds.has(`${t.assigned_to || ''}`));
                } else {
                    filtered = [];
                }
            } catch {}
        }
        if (q) {
            filtered = filtered.filter(t => {
                const hay = [t.id, t.channel_id, t.user_id, t.category, t.subject, t.description, t.status, t.priority]
                    .map(x => (x == null ? '' : String(x).toLowerCase())).join(' ');
                return hay.includes(q);
            });
        }
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        // Safe cap
        const cap = Math.max(10, Math.min(5000, parseInt(String(req.query.cap || '1000'), 10) || 1000));
        const items = filtered.slice(0, cap);

        const format = (req.query.format || 'json').toString().toLowerCase();
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=tickets-${guildId}.csv`);
            const headers = ['id','status','priority','user_id','assigned_to','channel_id','category','subject','created_at'];
            const escape = (s='') => '"' + String(s).replace(/"/g,'""') + '"';
            const lines = [headers.join(',')];
            for (const t of items) {
                lines.push([
                    t.id, t.status||'', t.priority||'', t.user_id||'', t.assigned_to||'', t.channel_id||'', t.category||'', t.subject||'', t.created_at||''
                ].map(escape).join(','));
            }
            return res.send(lines.join('\n'));
        }
        // JSON
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=tickets-${guildId}.json`);
        return res.send(JSON.stringify({ success: true, tickets: items }, null, 2));
    } catch (e) {
        logger.error('Error exporting tickets:', e);
        return res.status(500).json({ success: false, error: 'Failed to export tickets' });
    }
});

// Painéis de Tickets - Listar e gerir
app.get('/api/guild/:guildId/panels', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    try {
        const guildId = req.params.guildId;
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });

        // Garantir membro no servidor
        const member = await guild.members.fetch(req.user.id).catch(() => null);
        if (!member) return res.status(403).json({ success: false, error: 'You are not a member of this server' });

        // Buscar painéis do storage ativo
        let panels = [];
        try {
            if (preferSqlite) {
                const storage = require('../utils/storage-sqlite');
                panels = await storage.getPanels(guildId);
            } else if (process.env.MONGO_URI || process.env.MONGODB_URI) {
                const { PanelModel } = require('../utils/db/models');
                panels = await PanelModel.find({ guild_id: guildId, type: 'tickets' }).lean();
            } else {
                panels = [];
            }
        } catch (e) {
            panels = [];
        }

        // Enriquecer com dados de canal/mensagem
        const enriched = await Promise.all((panels || []).map(async p => {
            let channelName = 'Desconhecido';
            let channelExists = false;
            let messageExists = false;
            try {
                const channel = guild.channels.cache.get(p.channel_id) || await client.channels.fetch(p.channel_id).catch(() => null);
                if (channel) {
                    channelExists = true;
                    channelName = channel.name || channel.id;
                    if (channel.messages?.fetch && p.message_id) {
                        const msg = await channel.messages.fetch(p.message_id).catch(() => null);
                        messageExists = !!msg;
                    }
                }
            } catch {}
            return { ...p, channelName, channelExists, messageExists };
        }));

        // Deteção leve de painéis criados dentro do Discord (sem registo no Mongo)
        // Estratégia: escanear todos os canais de texto, com limites de canais e mensagens por canal
        const detected = [];
        const textChannels = guild.channels.cache.filter(c => c.type === 0);
        const channelCap = 40; // número máximo de canais a escanear nesta chamada
        const msgsPerChannel = 20; // mensagens por canal (raso, mais profundo via "scan now")
        let scannedChannels = 0;
        for (const channel of textChannels.values()) {
            if (scannedChannels >= channelCap) break;
            scannedChannels++;
            try {
                const batch = await channel.messages.fetch({ limit: Math.min(100, msgsPerChannel) }).catch(() => null);
                if (!batch) continue;
                for (const msg of batch.values()) {
                    const hasCreate = Array.isArray(msg.components) && msg.components.some(row => Array.isArray(row.components) && row.components.some(btn => typeof btn.customId === 'string' && btn.customId.startsWith('ticket:create:')));
                    const looksLikePanel = hasCreate || (msg.embeds?.[0]?.title && /centro de suporte|tickets?/i.test(msg.embeds[0].title || ''));
                    if (!looksLikePanel) continue;
                    const already = enriched.find(p => p.message_id === msg.id || p.channel_id === channel.id);
                    if (already) {
                        already.messageExists = true;
                        continue;
                    }
                    detected.push({
                        _id: `detected:${guildId}:${channel.id}:${msg.id}`,
                        guild_id: guildId,
                        channel_id: channel.id,
                        message_id: msg.id,
                        type: 'tickets',
                        theme: 'dark',
                        template: 'classic',
                        channelName: channel.name,
                        channelExists: true,
                        messageExists: true,
                        detected: true
                    });
                    if (detected.length >= 50) break; // limitar deteções
                }
            } catch {}
            if (detected.length >= 50) break;
        }

        // Tentar persistir deteções no backend ativo e refletir imediatamente como "guardado" na resposta
        let enrichedCombined = [...enriched];
        let remainingDetected = [...detected];
        try {
            if (preferSqlite && detected.length) {
                const storage = require('../utils/storage-sqlite');
                const savedKeys = new Set();
                const newlySaved = [];
                for (const d of detected) {
                        const doc = await storage.upsertPanel({ guild_id: d.guild_id, channel_id: d.channel_id, message_id: d.message_id, theme: d.theme, template: d.template || 'classic', type: 'tickets' });
                    if (doc) {
                        const key = `${doc.channel_id}`;
                        savedKeys.add(key);
                        newlySaved.push(doc);
                    }
                }
                for (const p of newlySaved) {
                    const exists = enrichedCombined.find(e => `${e.channel_id}` === `${p.channel_id}`);
                    if (!exists) {
                        enrichedCombined.push({
                            ...p,
                            channelName: guild.channels.cache.get(p.channel_id)?.name || p.channel_id,
                            channelExists: !!guild.channels.cache.get(p.channel_id),
                            messageExists: !!p.message_id,
                        });
                    }
                }
                remainingDetected = detected.filter(d => !savedKeys.has(`${d.channel_id}`));
            } else {
                const hasMongoEnv = (process.env.MONGO_URI || process.env.MONGODB_URI);
                const { isReady } = require('../utils/db/mongoose');
                if (hasMongoEnv && isReady() && detected.length) {
                    const { PanelModel } = require('../utils/db/models');
                    const savedKeys = new Set();
                    const newlySaved = [];
                    for (const d of detected) {
                        const doc = await PanelModel.findOneAndUpdate(
                            { guild_id: d.guild_id, channel_id: d.channel_id, type: 'tickets' },
                            { $setOnInsert: { message_id: d.message_id, theme: d.theme, template: d.template || 'classic' }, $set: { message_id: d.message_id } },
                            { upsert: true, new: true }
                        ).lean();
                        if (doc) {
                            const key = `${doc.channel_id}`;
                            savedKeys.add(key);
                            newlySaved.push(doc);
                        }
                    }
                    for (const p of newlySaved) {
                        const exists = enrichedCombined.find(e => `${e.channel_id}` === `${p.channel_id}`);
                        if (!exists) {
                            enrichedCombined.push({
                                ...p,
                                channelName: guild.channels.cache.get(p.channel_id)?.name || p.channel_id,
                                channelExists: !!guild.channels.cache.get(p.channel_id),
                                messageExists: !!p.message_id,
                            });
                        }
                    }
                    remainingDetected = detected.filter(d => !savedKeys.has(`${d.channel_id}`));
                }
            }
        } catch {}

        const finalList = [...enrichedCombined, ...remainingDetected];
        res.json({ success: true, panels: finalList });
    } catch (error) {
        logger.error('Error fetching panels:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch panels' });
    }
});

// Painéis - "Scan now": varredura mais profunda com paginação e limites configuráveis
app.post('/api/guild/:guildId/panels/scan', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
        const guildId = req.params.guildId;
        const { channelsLimit = 100, messagesPerChannel = 100, persist = true } = req.body || {};
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });

        // Requer administrador para varreduras profundas
        const check = await ensureGuildAdmin(client, guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });

        const textChannels = guild.channels.cache.filter(c => c.type === 0);
        const detected = [];

        async function fetchMessagesPaged(channel, cap) {
            const all = [];
            let before = undefined;
            while (all.length < cap) {
                const limit = Math.min(100, cap - all.length);
                const batch = await channel.messages.fetch(before ? { limit, before } : { limit }).catch(() => null);
                if (!batch || batch.size === 0) break;
                const arr = Array.from(batch.values());
                all.push(...arr);
                before = arr[arr.length - 1].id;
                if (batch.size < limit) break;
            }
            return all;
        }

        let scanned = 0;
        for (const channel of textChannels.values()) {
            if (scanned >= channelsLimit) break;
            scanned++;
            try {
                const msgs = await fetchMessagesPaged(channel, Math.max(1, Math.min(1000, messagesPerChannel)));
                for (const msg of msgs) {
                    const hasCreate = Array.isArray(msg.components) && msg.components.some(row => Array.isArray(row.components) && row.components.some(btn => typeof btn.customId === 'string' && btn.customId.startsWith('ticket:create:')));
                    const looksLikePanel = hasCreate || (msg.embeds?.[0]?.title && /centro de suporte|tickets?/i.test(msg.embeds[0].title || ''));
                    if (!looksLikePanel) continue;
                    detected.push({
                        _id: `detected:${guildId}:${channel.id}:${msg.id}`,
                        guild_id: guildId,
                        channel_id: channel.id,
                        message_id: msg.id,
                        type: 'tickets',
                        theme: 'dark',
                        template: 'classic',
                        channelName: channel.name,
                        channelExists: true,
                        messageExists: true,
                        detected: true
                    });
                    if (detected.length >= 200) break; // limite global
                }
            } catch {}
            if (detected.length >= 200) break;
        }

        // Persistir deteções (opcional) no backend ativo
        let persisted = 0;
        if (persist && detected.length) {
            try {
                if (preferSqlite) {
                    const storage = require('../utils/storage-sqlite');
                    for (const d of detected) {
                        const r = await storage.upsertPanel({
                            guild_id: d.guild_id,
                            channel_id: d.channel_id,
                            message_id: d.message_id,
                            theme: d.theme,
                            template: d.template || 'classic',
                            type: 'tickets'
                        });
                        if (r && r._id) persisted++;
                    }
                } else {
                    const hasMongoEnv = (process.env.MONGO_URI || process.env.MONGODB_URI);
                    const { isReady } = require('../utils/db/mongoose');
                    if (hasMongoEnv && isReady()) {
                        const { PanelModel } = require('../utils/db/models');
                        for (const d of detected) {
                            const r = await PanelModel.findOneAndUpdate(
                                { guild_id: d.guild_id, channel_id: d.channel_id, type: 'tickets' },
                                { $setOnInsert: { message_id: d.message_id, theme: d.theme, template: d.template || 'classic' }, $set: { message_id: d.message_id } },
                                { upsert: true, new: true }
                            );
                            if (r) persisted++;
                        }
                    }
                }
            } catch {}
        }

        return res.json({ success: true, detected: detected.length, persisted });
    } catch (error) {
        logger.error('Error scanning panels:', error);
        res.status(500).json({ success: false, error: 'Failed to scan panels' });
    }
});

// Endpoint simples para verificar se o utilizador é admin no guild (para gating de UI)
app.get('/api/guild/:guildId/is-admin', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });
        const member = await guild.members.fetch(req.user.id).catch(() => null);
        if (!member) return res.status(403).json({ success: false, error: 'You are not a member of this server' });
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
        return res.json({ success: true, isAdmin });
    } catch (e) {
        logger.error('Error checking admin:', e);
        return res.status(500).json({ success: false, error: 'Failed to check admin' });
    }
});

app.post('/api/guild/:guildId/panels/:panelId/action', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
        const { guildId, panelId } = req.params;
        const { action, data } = req.body || {};
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });

        const member = await guild.members.fetch(req.user.id).catch(() => null);
        if (!member) return res.status(403).json({ success: false, error: 'You are not a member of this server' });

        let useMongoPanels = false;
        let PanelModel;
        if (!preferSqlite) {
            try {
                const hasMongoEnv = (process.env.MONGO_URI || process.env.MONGODB_URI);
                const { isReady } = require('../utils/db/mongoose');
                if (!hasMongoEnv) {
                    return res.status(503).json({ success: false, error: 'Mongo not configured' });
                }
                if (!isReady()) {
                    return res.status(503).json({ success: false, error: 'Mongo not connected' });
                }
                PanelModel = require('../utils/db/models').PanelModel;
                useMongoPanels = true;
            } catch (e) {
                logger.error('Panels storage load error:', e);
                return res.status(500).json({ success: false, error: 'Panels storage not available' });
            }
        }
        
        // Suportar guardar painéis detetados (IDs sintéticos começados por 'detected:')
        if (action === 'save' && panelId.startsWith('detected:')) {
            try {
                const parts = panelId.split(':');
                // detected:guildId:channelId:messageId
                const chId = parts[2];
                const msgId = parts[3];
                if (!chId || !msgId) return res.status(400).json({ success: false, error: 'Invalid detected panel id' });
                if (preferSqlite) {
                    const storage = require('../utils/storage-sqlite');
                    const doc = await storage.upsertPanel({ guild_id: guildId, channel_id: chId, message_id: msgId, theme: (data?.theme || 'dark'), template: (data?.template || 'classic') });
                    return res.json({ success: true, message: 'Panel saved', panel: doc });
                } else {
                    const doc = await PanelModel.findOneAndUpdate(
                        { guild_id: guildId, channel_id: chId, type: 'tickets' },
                        { $setOnInsert: { message_id: msgId, theme: (data?.theme || 'dark'), template: (data?.template || 'classic') }, $set: { message_id: msgId } },
                        { upsert: true, new: true }
                    ).lean();
                    return res.json({ success: true, message: 'Panel saved', panel: doc });
                }
            } catch (e) {
                logger.error('Error saving detected panel:', e);
                return res.status(500).json({ success: false, error: 'Failed to save detected panel' });
            }
        }

        const panel = useMongoPanels
            ? await PanelModel.findById(panelId).lean()
            : await (async () => {
                const storage = require('../utils/storage-sqlite');
                return await storage.findPanelById(panelId);
            })();
        if (!panel || `${panel.guild_id}` !== `${guildId}`) {
            return res.status(404).json({ success: false, error: 'Panel not found' });
        }

        const channel = guild.channels.cache.get(panel.channel_id) || await client.channels.fetch(panel.channel_id).catch(() => null);
        if (!channel || !channel.send) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }

        let message;
        let updated = null;
        switch (action) {
            case 'resend': {
                // Reenviar usando payload guardado, sem apagar o anterior
                const payload = panel.payload || { content: '🎫 Painel de tickets' };
                message = await channel.send(payload);
                if (useMongoPanels) {
                    updated = await PanelModel.findByIdAndUpdate(panelId, { $set: { message_id: message.id } }, { new: true }).lean();
                } else {
                    const storage = require('../utils/storage');
                    updated = await storage.updatePanel(panelId, { message_id: message.id });
                }
                return res.json({ success: true, message: 'Panel resent', panel: updated });
            }
            case 'recreate': {
                // Tenta eliminar mensagem antiga e enviar de novo
                if (panel.message_id && channel.messages?.fetch) {
                    const old = await channel.messages.fetch(panel.message_id).catch(() => null);
                    if (old) await old.delete().catch(() => {});
                }
                const payload = panel.payload || { content: '🎫 Painel de tickets' };
                message = await channel.send(payload);
                if (useMongoPanels) {
                    updated = await PanelModel.findByIdAndUpdate(panelId, { $set: { message_id: message.id } }, { new: true }).lean();
                } else {
                    const storage = require('../utils/storage');
                    updated = await storage.updatePanel(panelId, { message_id: message.id });
                }
                return res.json({ success: true, message: 'Panel recreated', panel: updated });
            }
            case 'save': {
                // Se já é um painel guardado, nada a fazer
                return res.json({ success: true, message: 'Panel already saved', panel });
            }
            case 'delete': {
                // Remover registo e tentar apagar mensagem
                if (panel.message_id && channel.messages?.fetch) {
                    const old = await channel.messages.fetch(panel.message_id).catch(() => null);
                    if (old) await old.delete().catch(() => {});
                }
                if (useMongoPanels) {
                    await PanelModel.findByIdAndDelete(panelId);
                } else {
                    const storage = require('../utils/storage');
                    await storage.deletePanel(panelId);
                }
                return res.json({ success: true, message: 'Panel deleted' });
            }
            case 'theme': {
                const newTheme = (data?.theme === 'light') ? 'light' : 'dark';
                const updatedTheme = useMongoPanels
                    ? await PanelModel.findByIdAndUpdate(panelId, { $set: { theme: newTheme } }, { new: true }).lean()
                    : await (async () => { const storage = require('../utils/storage'); return await storage.updatePanel(panelId, { theme: newTheme }); })();
                return res.json({ success: true, message: 'Theme updated', theme: newTheme, panel: updatedTheme });
            }
            case 'template': {
                const newTemplate = typeof data?.template === 'string' ? String(data.template) : 'classic';
                const allowed = new Set(['classic','compact','premium','minimal']);
                const tpl = allowed.has(newTemplate) ? newTemplate : 'classic';
                // Rebuild payload using existing theme for consistency
                const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
                const visualAssets = require('../assets/visual-assets');
                const embed = new EmbedBuilder()
                    .setColor((panel.theme || 'dark') === 'light' ? 0x60A5FA : 0x7C3AED)
                    .setThumbnail(visualAssets.realImages.supportIcon)
                    .setImage(visualAssets.realImages.supportBanner);
                let rows = [];
                if (tpl === 'compact') {
                    embed.setTitle('🎫 Tickets • Compacto').setDescription('Escolhe abaixo e abre um ticket privado.');
                    rows = [ new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket:create:support').setLabel('Suporte').setEmoji('🎫').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger)
                    ) ];
                } else if (tpl === 'minimal') {
                    embed.setTitle('🎫 Abrir ticket').setDescription('Carrega num botão para abrir um ticket.');
                    rows = [ new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Abrir Ticket').setEmoji('🎟️').setStyle(ButtonStyle.Primary)
                    ) ];
                } else if (tpl === 'premium') {
                    embed.setTitle('🎫 Centro de Suporte • Premium')
                        .setDescription('Serviço prioritário, acompanhamento dedicado e histórico guardado.')
                        .addFields(
                            { name: '• Resposta express', value: 'Prioridade máxima', inline: true },
                            { name: '• Privado & seguro', value: 'Só tu e equipa', inline: true },
                            { name: '• Transcript', value: 'Disponível a pedido', inline: true },
                        );
                    const r1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket:create:vip').setLabel('VIP / Premium').setEmoji('👑').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('ticket:create:technical').setLabel('Suporte Técnico').setEmoji('🔧').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Reportar Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger)
                    );
                    const r2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket:create:moderation').setLabel('Moderação & Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Dúvidas Gerais').setEmoji('💬').setStyle(ButtonStyle.Secondary)
                    );
                    rows = [r1, r2];
                } else {
                    embed.setTitle('🎫 Centro de Suporte')
                        .setDescription('Escolhe o departamento abaixo para abrir um ticket privado com a equipa.')
                        .addFields(
                            { name: '• Resposta rápida', value: 'Tempo médio: minutos', inline: true },
                            { name: '• Canal privado', value: 'Visível só para ti e staff', inline: true },
                            { name: '• Histórico guardado', value: 'Transcript disponível', inline: true },
                        );
                    const r1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket:create:technical').setLabel('Suporte Técnico').setEmoji('🔧').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Reportar Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('ticket:create:moderation').setLabel('Moderação & Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Secondary)
                    );
                    const r2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Dúvidas Gerais').setEmoji('💬').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('ticket:create:account').setLabel('Suporte de Conta').setEmoji('🧾').setStyle(ButtonStyle.Secondary)
                    );
                    rows = [r1, r2];
                }
                const newPayload = { embeds: [embed], components: rows };
                // Try to edit existing message for seamless change
                if (panel.message_id && channel.messages?.fetch) {
                    const old = await channel.messages.fetch(panel.message_id).catch(() => null);
                    if (old) {
                        await old.edit(newPayload).catch(() => {});
                    }
                }
                // Persist template and payload
                const updatedPanel = useMongoPanels
                    ? await PanelModel.findByIdAndUpdate(panelId, { $set: { template: tpl, payload: newPayload } }, { new: true }).lean()
                    : await (async () => { const storage = require('../utils/storage'); return await storage.updatePanel(panelId, { template: tpl, payload: newPayload }); })();
                return res.json({ success: true, message: 'Template updated', template: tpl, panel: updatedPanel });
            }
            default:
                return res.status(400).json({ success: false, error: 'Invalid action' });
        }
    } catch (error) {
        logger.error('Error performing panel action:', error);
        res.status(500).json({ success: false, error: 'Failed to perform panel action' });
    }
});

// Helper to ensure admin in guild
async function ensureGuildAdmin(client, guildId, userId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { ok: false, code: 404, error: 'Guild not found' };
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return { ok: false, code: 403, error: 'You are not a member of this server' };
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin) return { ok: false, code: 403, error: 'Administrator permission required' };
    return { ok: true, guild, member };
}

// Channels list (for UIs)
app.get('/api/guild/:guildId/channels', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const channels = check.guild.channels.cache
            .filter(c => c.type === 0) // text
            .map(c => ({ id: c.id, name: c.name }))
            .sort((a,b) => a.name.localeCompare(b.name));
        res.json({ success: true, channels });
    } catch (e) {
        logger.error('Error listing channels:', e);
        res.status(500).json({ success: false, error: 'Failed to list channels' });
    }
});

// Categories list (for UIs)
app.get('/api/guild/:guildId/categories', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const categories = check.guild.channels.cache
            .filter(c => c.type === 4) // category
            .map(c => ({ id: c.id, name: c.name }))
            .sort((a,b) => a.name.localeCompare(b.name));
        res.json({ success: true, categories });
    } catch (e) {
        logger.error('Error listing categories:', e);
        res.status(500).json({ success: false, error: 'Failed to list categories' });
    }
});

// Roles list (for UIs)
app.get('/api/guild/:guildId/roles', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const roles = check.guild.roles.cache
            .filter(r => r.editable || r.managed || r.permissions.bitfield)
            .map(r => ({ id: r.id, name: r.name }))
            .sort((a,b) => a.name.localeCompare(b.name));
        res.json({ success: true, roles });
    } catch (e) {
        logger.error('Error listing roles:', e);
        res.status(500).json({ success: false, error: 'Failed to list roles' });
    }
});

// Members search (for pickers) - admin gated
app.get('/api/guild/:guildId/members/search', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const guild = check.guild;
        const q = (req.query.q || '').toString().trim();
        let limit = parseInt(String(req.query.limit || '10'), 10);
        if (!Number.isFinite(limit) || limit <= 0) limit = 10;
        limit = Math.min(25, Math.max(1, limit));
        const roleId = (req.query.roleId || '').toString().trim();
        let members = [];
        try {
            if (q && guild.members?.search) {
                const resSearch = await guild.members.search({ query: q, limit }).catch(() => null);
                if (resSearch) members = Array.from(resSearch.values());
            }
            if (!members.length) {
                // fallback: filter from cache
                members = guild.members.cache.filter(m => {
                    if (roleId && !m.roles.cache.has(roleId)) return false;
                    const tag = `${m.user.username}#${m.user.discriminator}`.toLowerCase();
                    return !q || tag.includes(q.toLowerCase()) || m.id === q;
                }).first(limit);
            } else if (roleId) {
                members = members.filter(m => m.roles.cache.has(roleId));
            }
        } catch {}
        const list = (members || []).slice(0, limit).map(m => ({
            id: m.id,
            username: m.user.username,
            discriminator: m.user.discriminator,
            tag: `${m.user.username}#${m.user.discriminator}`,
            avatar: m.user.displayAvatarURL({ size: 32 })
        }));
        return res.json({ success: true, members: list });
    } catch (e) {
        logger.error('Error searching members:', e);
        res.status(500).json({ success: false, error: 'Failed to search members' });
    }
});

// Guild Config API (advanced configs)
app.get('/api/guild/:guildId/config', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const cfg = await storage.getGuildConfig(req.params.guildId);
        res.json({ success: true, config: cfg || {} });
    } catch (e) {
        logger.error('Error fetching guild config:', e);
        res.status(500).json({ success: false, error: 'Failed to fetch config' });
    }
});

// Tickets Config API (subset of guild config)
app.get('/api/guild/:guildId/tickets/config', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const cfg = await storage.getGuildConfig(req.params.guildId);
        res.json({ success: true, config: cfg || {} });
    } catch (e) {
        logger.error('Error fetching tickets config:', e);
        res.status(500).json({ success: false, error: 'Failed to fetch tickets config' });
    }
});

app.post('/api/guild/:guildId/tickets/config', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const updates = req.body || {};
        // Merge into guild config under `tickets`
        const storage = require('../utils/storage');
        const current = await storage.getGuildConfig(req.params.guildId) || {};
        const next = { ...current, tickets: { ...(current.tickets || {}), ...(updates.tickets || {}) } };
        await storage.updateGuildConfig(req.params.guildId, next);
        res.json({ success: true, message: 'Tickets config updated' });
    } catch (e) {
        logger.error('Error updating tickets config:', e);
        res.status(500).json({ success: false, error: 'Failed to update tickets config' });
    }
});

app.post('/api/guild/:guildId/config', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const updates = req.body || {};
        const storage = require('../utils/storage');
        await storage.updateGuildConfig(req.params.guildId, updates);
        res.json({ success: true, message: 'Config updated' });
    } catch (e) {
        logger.error('Error updating guild config:', e);
        res.status(500).json({ success: false, error: 'Failed to update config' });
    }
});

// Bot Settings API (simple guild-level preferences with optional live-apply)
app.get('/api/guild/:guildId/bot-settings', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const cfg = await storage.getGuildConfig(req.params.guildId);
        return res.json({ success: true, settings: (cfg && cfg.botSettings) || {} });
    } catch (e) {
        logger.error('Error fetching bot settings:', e);
        return res.status(500).json({ success: false, error: 'Failed to fetch bot settings' });
    }
});

app.post('/api/guild/:guildId/bot-settings', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });

        // Validate with Joi (best-effort; accept unknowns for forward compat)
        const schema = Joi.object({
            nickname: Joi.string().trim().max(32).allow(''),
            statusText: Joi.string().trim().max(128).allow(''),
            statusType: Joi.string().valid('PLAYING','LISTENING','WATCHING','COMPETING','CUSTOM').default('CUSTOM'),
            presenceStatus: Joi.string().valid('online','idle','dnd','invisible').default('online'),
            defaultLanguage: Joi.string().trim().max(16).allow(''),
            timezone: Joi.string().trim().max(64).allow(''),
            prefix: Joi.string().trim().max(5).allow(''),
            ephemeralByDefault: Joi.boolean().default(false),
            enableModerationLogs: Joi.boolean().default(true),
            // allow arbitrary extra keys for future
        }).unknown(true);
        const { error, value } = schema.validate(req.body || {}, { abortEarly: false, stripUnknown: false });
        if (error) return res.status(400).json({ success: false, error: 'validation_failed', details: error.details.map(d => d.message) });

        const storage = require('../utils/storage');
        const current = await storage.getGuildConfig(req.params.guildId) || {};
        const next = { ...current, botSettings: { ...(current.botSettings || {}), ...value } };
        await storage.updateGuildConfig(req.params.guildId, next);

        // Best-effort live apply: nickname and presence
        try {
            const guild = check.guild;
            const me = guild.members.me || guild.members.cache.get(client.user.id) || await guild.members.fetch(client.user.id).catch(()=>null);
            if (me && typeof value.nickname === 'string') {
                const nick = value.nickname.trim();
                if (nick || nick === '') {
                    await me.setNickname(nick || null).catch(() => {});
                }
            }
            if (client?.user && (typeof value.statusText === 'string' || typeof value.presenceStatus === 'string' || typeof value.statusType === 'string')) {
                const name = (value.statusText || '').slice(0, 128);
                const typeMap = { PLAYING: ActivityType.Playing, LISTENING: ActivityType.Listening, WATCHING: ActivityType.Watching, COMPETING: ActivityType.Competing, CUSTOM: ActivityType.Custom };
                const type = typeMap[value.statusType] ?? ActivityType.Custom;
                const status = value.presenceStatus || 'online';
                try {
                    client.user.setPresence({ activities: name ? [{ name, type }] : [], status });
                } catch {}
            }
        } catch (e) { logger.warn('Live apply bot settings failed:', e?.message || e); }

        return res.json({ success: true, settings: next.botSettings });
    } catch (e) {
        logger.error('Error updating bot settings:', e);
        return res.status(500).json({ success: false, error: 'Failed to update bot settings' });
    }
});

// Logs API (general bot logs, lightweight)
app.get('/api/guild/:guildId/logs', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const q = (req.query.q || '').toString().toLowerCase().trim();
        const type = (req.query.type || '').toString().toLowerCase().trim();
        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
        const limit = Math.max(1, Math.min(1000, parseInt(String(req.query.limit || '200'), 10) || 200));
    const all = await storage.getLogs(req.params.guildId, 1000);
        let filtered = Array.isArray(all) ? all.slice() : [];
        if (type) {
            const t = type.toLowerCase();
            if (t.endsWith('*')) {
                const prefix = t.slice(0, -1);
                filtered = filtered.filter(l => (l.type || '').toLowerCase().startsWith(prefix));
            } else {
                filtered = filtered.filter(l => (l.type || '').toLowerCase() === t);
            }
        }
        if (from && !Number.isNaN(from.getTime())) filtered = filtered.filter(l => new Date(l.timestamp) >= from);
        if (to && !Number.isNaN(to.getTime())) filtered = filtered.filter(l => new Date(l.timestamp) <= to);
        // Advanced filters: userId, moderatorId (executorId), channelId (from l.data)
        const userId = (req.query.userId || '').toString().trim();
        const moderatorId = (req.query.moderatorId || '').toString().trim();
        const channelId = (req.query.channelId || '').toString().trim();
        if (userId) filtered = filtered.filter(l => {
            const d = l.data || {};
            return (`${d.userId||''}` === userId) || (`${l.actor_id||''}` === userId) || (`${d.authorId||''}` === userId);
        });
        if (moderatorId) filtered = filtered.filter(l => {
            const d = l.data || {};
            return (`${d.executorId||''}` === moderatorId) || (`${l.actor_id||''}` === moderatorId);
        });
        if (channelId) filtered = filtered.filter(l => {
            const d = l.data || {};
            return (`${d.channelId||''}` === channelId);
        });
        if (q) filtered = filtered.filter(l => {
            const hay = [l.message, l.type, l.actor_id, l.ticket_id].map(x => (x ? String(x).toLowerCase() : '')).join(' ');
            return hay.includes(q);
        });
        filtered.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        const limited = filtered.slice(0, limit);
        // Enrich with resolved names; prefer cache, fall back to one-off fetches (bounded by 'limit')
        try {
            const guild = check.guild;
            const withResolved = await Promise.all(limited.map(async (l) => {
                const d = l.data || {};
                const out = { ...l, resolved: {} };
                // Resolve user: prefer data.userId, fall back to authorId (message logs)
                const userId = d.userId || d.authorId || null;
                if (userId) {
                    try {
                        let m = guild.members.cache.get(userId);
                        if (!m) m = await guild.members.fetch(userId).catch(()=>null);
                        if (m && m.user) out.resolved.user = { id: m.id, username: m.user.username, nick: m.nickname||null, avatar: m.user.avatar };
                    } catch {}
                }
                // Resolve executor: prefer data.executorId, else actor_id from log
                const execId = d.executorId || l.actor_id || null;
                if (execId) {
                    try {
                        let m = guild.members.cache.get(execId);
                        if (!m) m = await guild.members.fetch(execId).catch(()=>null);
                        if (m && m.user) out.resolved.executor = { id: m.id, username: m.user.username, nick: m.nickname||null, avatar: m.user.avatar };
                    } catch {}
                }
                // Resolve channel
                if (d.channelId) {
                    try {
                        let c = guild.channels.cache.get(d.channelId);
                        if (!c) c = await guild.channels.fetch(d.channelId).catch(()=>null);
                        if (c) out.resolved.channel = { id: c.id, name: c.name };
                    } catch {}
                }
                // Voice move: from/to channels
                if (d.fromChannelId) {
                    try {
                        let fc = guild.channels.cache.get(d.fromChannelId);
                        if (!fc) fc = await guild.channels.fetch(d.fromChannelId).catch(()=>null);
                        if (fc) out.resolved.fromChannel = { id: fc.id, name: fc.name };
                    } catch {}
                }
                if (d.toChannelId) {
                    try {
                        let tc = guild.channels.cache.get(d.toChannelId);
                        if (!tc) tc = await guild.channels.fetch(d.toChannelId).catch(()=>null);
                        if (tc) out.resolved.toChannel = { id: tc.id, name: tc.name };
                    } catch {}
                }
                // Member role updates: resolve role names for added/removed
                try {
                    const roles = { added: [], removed: [] };
                    const idsAdded = Array.isArray(d.rolesAdded) ? d.rolesAdded : (Array.isArray(d.roles?.added) ? d.roles.added : []);
                    const idsRemoved = Array.isArray(d.rolesRemoved) ? d.rolesRemoved : (Array.isArray(d.roles?.removed) ? d.roles.removed : []);
                    if (idsAdded.length) roles.added = idsAdded.map(id => ({ id, name: guild.roles.cache.get(id)?.name || id }));
                    if (idsRemoved.length) roles.removed = idsRemoved.map(id => ({ id, name: guild.roles.cache.get(id)?.name || id }));
                    if (roles.added.length || roles.removed.length) out.resolved.roles = roles;
                } catch {}
                return out;
            }));
            return res.json({ success: true, logs: withResolved });
        } catch (e) {
            logger.warn('logs enrichment failed', e?.message||e);
            return res.json({ success: true, logs: limited });
        }
    } catch (e) {
        logger.error('Error fetching logs:', e);
        return res.status(500).json({ success: false, error: 'Failed to fetch logs' });
    }
});

app.get('/api/guild/:guildId/logs/export', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        // Reuse list logic
        const storage = require('../utils/storage');
        const q = (req.query.q || '').toString().toLowerCase().trim();
        const type = (req.query.type || '').toString().toLowerCase().trim();
        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
    const format = (req.query.format || 'csv').toString().toLowerCase();
        const all = await storage.getLogs(req.params.guildId, 1000);
        let filtered = Array.isArray(all) ? all.slice() : [];
        if (type) {
            const t = type.toLowerCase();
            if (t.endsWith('*')) {
                const prefix = t.slice(0, -1);
                filtered = filtered.filter(l => (l.type || '').toLowerCase().startsWith(prefix));
            } else {
                filtered = filtered.filter(l => (l.type || '').toLowerCase() === t);
            }
        }
        if (from && !Number.isNaN(from.getTime())) filtered = filtered.filter(l => new Date(l.timestamp) >= from);
        if (to && !Number.isNaN(to.getTime())) filtered = filtered.filter(l => new Date(l.timestamp) <= to);
        if (q) filtered = filtered.filter(l => {
            const hay = [l.message, l.type, l.actor_id, l.ticket_id].map(x => (x ? String(x).toLowerCase() : '')).join(' ');
            return hay.includes(q);
        });
        // Advanced filters (mirror list API)
        const userId = (req.query.userId || '').toString().trim();
        const moderatorId = (req.query.moderatorId || '').toString().trim();
        const channelId = (req.query.channelId || '').toString().trim();
        if (userId) filtered = filtered.filter(l => {
            const d = l.data || {};
            return (`${d.userId||''}` === userId) || (`${l.actor_id||''}` === userId) || (`${d.authorId||''}` === userId);
        });
        if (moderatorId) filtered = filtered.filter(l => {
            const d = l.data || {};
            return (`${d.executorId||''}` === moderatorId) || (`${l.actor_id||''}` === moderatorId);
        });
        if (channelId) filtered = filtered.filter(l => {
            const d = l.data || {};
            return (`${d.channelId||''}` === channelId);
        });
        filtered.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        if (format === 'txt') {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=logs-${req.params.guildId}.txt`);
            const lines = filtered.map(l => `[${l.timestamp}] [${l.type||'log'}] ${l.message || ''}`);
            return res.send(lines.join('\n'));
        }
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=logs-${req.params.guildId}.json`);
            return res.send(JSON.stringify(filtered, null, 2));
        }
        // CSV default
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=logs-${req.params.guildId}.csv`);
        const headers = ['timestamp','type','message','actor_id','ticket_id'];
        const escape = (s='') => '"' + String(s).replace(/"/g,'""') + '"';
        const lines = [headers.join(',')];
        for (const l of filtered) {
            lines.push([l.timestamp||'', l.type||'', l.message||'', l.actor_id||'', l.ticket_id||''].map(escape).join(','));
        }
        return res.send(lines.join('\n'));
    } catch (e) {
        logger.error('Error exporting logs:', e);
        return res.status(500).json({ success: false, error: 'Failed to export logs' });
    }
});

// Moderation event details by log id
app.get('/api/guild/:guildId/moderation/event/:logId', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        let log = null;
        try { log = await storage.getLogById(req.params.guildId, req.params.logId); } catch (e) {
            logger.warn('getLogById failed', e?.message || e);
            return res.status(404).json({ success:false, error:'log_not_found' });
        }
        if (!log || !(log.type||'').startsWith('mod_')) return res.status(404).json({ success:false, error:'log_not_found' });
        const guild = check.guild;
        const data = log.data || {};
        const out = { ...log, resolved: {} };
        // Best-effort resolve names
        try { if (data.userId) { const m = await guild.members.fetch(data.userId).catch(()=>null); out.resolved.user = m ? { id: m.id, username: m.user.username, nick: m.nickname||null, avatar: m.user.avatar } : { id: data.userId }; } } catch {}
        try { if (data.executorId) { const m = await guild.members.fetch(data.executorId).catch(()=>null); out.resolved.executor = m ? { id: m.id, username: m.user.username, nick: m.nickname||null, avatar: m.user.avatar } : { id: data.executorId }; } } catch {}
        try { if (data.channelId) { const c = guild.channels.cache.get(data.channelId) || await guild.channels.fetch(data.channelId).catch(()=>null); if (c) out.resolved.channel = { id:c.id, name:c.name }; } } catch {}
        // Voice move: from/to channels
        try { if (data.fromChannelId) { const fc = guild.channels.cache.get(data.fromChannelId) || await guild.channels.fetch(data.fromChannelId).catch(()=>null); if (fc) out.resolved.fromChannel = { id: fc.id, name: fc.name }; } } catch {}
        try { if (data.toChannelId) { const tc = guild.channels.cache.get(data.toChannelId) || await guild.channels.fetch(data.toChannelId).catch(()=>null); if (tc) out.resolved.toChannel = { id: tc.id, name: tc.name }; } } catch {}
        // Member role updates
        try {
            const roles = { added: [], removed: [] };
            const idsAdded = Array.isArray(data.rolesAdded) ? data.rolesAdded : (Array.isArray(data.roles?.added) ? data.roles.added : []);
            const idsRemoved = Array.isArray(data.rolesRemoved) ? data.rolesRemoved : (Array.isArray(data.roles?.removed) ? data.roles.removed : []);
            if (idsAdded.length) roles.added = idsAdded.map(id => ({ id, name: guild.roles.cache.get(id)?.name || id }));
            if (idsRemoved.length) roles.removed = idsRemoved.map(id => ({ id, name: guild.roles.cache.get(id)?.name || id }));
            if (roles.added.length || roles.removed.length) out.resolved.roles = roles;
        } catch {}
        return res.json({ success:true, event: out });
    } catch (e) { logger.error('Error moderation event detail:', e); return res.status(500).json({ success:false, error:'Failed to fetch event' }); }
});

// Autocomplete endpoints
app.get('/api/guild/:guildId/search/members', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success:false, error:'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success:false, error:'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success:false, error: check.error });
        const q = (req.query.q || '').toString().toLowerCase();
        const guild = check.guild;
        await guild.members.fetch({ withPresences: false }).catch(()=>{});
        const results = guild.members.cache
            .filter(m => m && m.user && (m.user.username?.toLowerCase().includes(q) || (m.nickname||'').toLowerCase().includes(q) || m.id === q))
            .first(20)
            .map(m => ({ id: m.id, username: m.user.username, nick: m.nickname||null, avatar: m.user.displayAvatarURL() }));
        return res.json({ success:true, results });
    } catch (e) { logger.warn('search members failed', e); return res.status(500).json({ success:false, error:'search_failed' }); }
});

app.get('/api/guild/:guildId/search/channels', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success:false, error:'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success:false, error:'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success:false, error: check.error });
        const q = (req.query.q || '').toString().toLowerCase();
        const guild = check.guild;
        const results = guild.channels.cache
            .filter(c => c && (c.name?.toLowerCase().includes(q) || c.id === q))
            .first(20)
            .map(c => ({ id: c.id, name: c.name, type: c.type }));
        return res.json({ success:true, results });
    } catch (e) { logger.warn('search channels failed', e); return res.status(500).json({ success:false, error:'search_failed' }); }
});

// Moderation actions via dashboard
// POST /api/guild/:guildId/moderation/action { action, userId, reason, durationSeconds, logId }
app.post('/api/guild/:guildId/moderation/action', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success:false, error:'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success:false, error:'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success:false, error: check.error });
        const guild = check.guild;
    const { action, userId, reason, durationSeconds, logId, dryRun } = req.body || {};
        if (!action) return res.status(400).json({ success:false, error:'missing_action' });
        const storage = require('../utils/storage');
        const me = guild.members.me || guild.members.cache.get(client.user.id);
        const myHighest = me?.roles?.highest?.position ?? 0;
        const log = logId ? await storage.getLogById(req.params.guildId, logId).catch(()=>null) : null;
        // Helper to log dashboard actions
        const logAction = async (type, message, extra) => {
            try { await storage.addLog({ guild_id: guild.id, type, message, actor_id: req.user.id, data: { via:'dashboard', ...(extra||{}) } }); } catch {}
        };
        // Helpers
        const briefUser = (m) => (m && m.user) ? { id:m.id, username:m.user.username, nick:m.nickname||null } : (m ? { id:m.id } : null);
        const roleName = (rid) => guild.roles.cache.get(rid)?.name || rid;
        // Resolve member when needed
        const getMember = async (id) => {
            try { return await guild.members.fetch(id); } catch { return null; }
        };
        // Execute supported actions
    switch(String(action)){
            case 'unban': {
                if (!userId) return res.status(400).json({ success:false, error:'missing_userId' });
                if (dryRun) {
                    return res.json({ success:true, dryRun:true, plan: { action:'unban', userId, reason: reason||null }, risks: [] });
                }
                try { await guild.bans.remove(userId, reason||'Dashboard unban'); await logAction('mod_dashboard_unban', `Unbanned ${userId}`, { userId, reason, logId: log?.id||null }); return res.json({ success:true, details:{ userId } }); } catch (e) { logger.warn('unban failed', e); return res.status(500).json({ success:false, error:'unban_failed' }); }
            }
            case 'ban': {
                if (!userId) return res.status(400).json({ success:false, error:'missing_userId' });
                // Cannot ban members with higher/equal role
                const m = await getMember(userId).catch(()=>null);
                if (m) {
                    const memberHighest = m?.roles?.highest?.position ?? 0; if (memberHighest >= myHighest) return res.status(403).json({ success:false, error:'insufficient_member_hierarchy' });
                }
                if (dryRun) {
                    const risks = []; if (!m) risks.push('User not in guild; ban will be by ID.');
                    return res.json({ success:true, dryRun:true, plan:{ action:'ban', userId, reason: reason||null }, risks });
                }
                try { await guild.bans.create(userId, { reason: reason||'Dashboard ban', deleteMessageSeconds: 0 }); await logAction('mod_dashboard_ban', `Banned ${userId}`, { userId, reason, logId: log?.id||null }); return res.json({ success:true, details:{ userId } }); } catch(e){ logger.warn('ban failed', e); return res.status(500).json({ success:false, error:'ban_failed' }); }
            }
            case 'kick': {
                if (!userId) return res.status(400).json({ success:false, error:'missing_userId' });
                const m = await getMember(userId); if (!m) return res.status(404).json({ success:false, error:'member_not_found' });
                const memberHighest = m?.roles?.highest?.position ?? 0; if (memberHighest >= myHighest) return res.status(403).json({ success:false, error:'insufficient_member_hierarchy' });
                if (dryRun) {
                    return res.json({ success:true, dryRun:true, plan:{ action:'kick', user: briefUser(m) }, risks:[] });
                }
                try { await m.kick(reason||'Dashboard kick'); await logAction('mod_dashboard_kick', `Kicked ${m.id}`, { userId:m.id, reason, logId: log?.id||null }); return res.json({ success:true, details:{ user: briefUser(m) } }); } catch(e){ logger.warn('kick failed', e); return res.status(500).json({ success:false, error:'kick_failed' }); }
            }
            case 'timeout': {
                if (!userId) return res.status(400).json({ success:false, error:'missing_userId' });
                const seconds = Math.max(60, Math.min(28*24*60*60, parseInt(String(durationSeconds||'0'),10)||0));
                if (!seconds) return res.status(400).json({ success:false, error:'missing_duration' });
                const m = await getMember(userId); if (!m) return res.status(404).json({ success:false, error:'member_not_found' });
                const memberHighest = m?.roles?.highest?.position ?? 0; if (memberHighest >= myHighest) return res.status(403).json({ success:false, error:'insufficient_member_hierarchy' });
                const until = new Date(Date.now() + seconds*1000);
                if (dryRun) {
                    return res.json({ success:true, dryRun:true, plan:{ action:'timeout', user: briefUser(m), seconds }, risks:[] });
                }
                try { await m.timeout(until, reason||'Dashboard timeout'); await logAction('mod_dashboard_timeout', `Timeout ${m.id} for ${seconds}s`, { userId:m.id, reason, seconds, logId: log?.id||null }); return res.json({ success:true, details:{ user: briefUser(m), seconds } }); } catch(e){ logger.warn('timeout failed', e); return res.status(500).json({ success:false, error:'timeout_failed' }); }
            }
            case 'remove_timeout': {
                if (!userId) return res.status(400).json({ success:false, error:'missing_userId' });
                const m = await getMember(userId); if (!m) return res.status(404).json({ success:false, error:'member_not_found' });
                const memberHighest = m?.roles?.highest?.position ?? 0; if (memberHighest >= myHighest) return res.status(403).json({ success:false, error:'insufficient_member_hierarchy' });
                if (dryRun) {
                    return res.json({ success:true, dryRun:true, plan:{ action:'remove_timeout', user: briefUser(m) }, risks:[] });
                }
                try { await m.timeout(null, reason||'Dashboard remove timeout'); await logAction('mod_dashboard_remove_timeout', `Removed timeout for ${m.id}`, { userId:m.id, reason, logId: log?.id||null }); return res.json({ success:true, details:{ user: briefUser(m) } }); } catch(e){ logger.warn('remove timeout failed', e); return res.status(500).json({ success:false, error:'remove_timeout_failed' }); }
            }
            case 'revert_nickname': {
                // Requires log with data.nickname.before
                if (!log || !log.data || !('nickname' in log.data) || !('before' in (log.data.nickname||{}))) return res.status(400).json({ success:false, error:'no_previous_nickname' });
                const uid = userId || log.data.userId; if (!uid) return res.status(400).json({ success:false, error:'missing_userId' });
                const m = await getMember(uid); if (!m) return res.status(404).json({ success:false, error:'member_not_found' });
                const memberHighest = m?.roles?.highest?.position ?? 0; if (memberHighest >= myHighest) return res.status(403).json({ success:false, error:'insufficient_member_hierarchy' });
                if (dryRun) {
                    return res.json({ success:true, dryRun:true, plan:{ action:'revert_nickname', user: briefUser(m), to: log.data.nickname.before||null }, risks:[] });
                }
                try { await m.setNickname(log.data.nickname.before || null, reason||'Dashboard revert nickname'); await logAction('mod_dashboard_revert_nick', `Reverted nick of ${m.id}`, { userId:m.id, before: log.data.nickname.before||null, after: log.data.nickname.after||null, logId: log?.id||null }); return res.json({ success:true, details:{ user: briefUser(m), to: log.data.nickname.before||null } }); } catch(e){ logger.warn('revert nickname failed', e); return res.status(500).json({ success:false, error:'revert_nickname_failed' }); }
            }
            case 'revert_roles': {
                if (!log || !log.data || !('roles' in log.data)) return res.status(400).json({ success:false, error:'no_roles_change' });
                const uid = userId || log.data.userId; if (!uid) return res.status(400).json({ success:false, error:'missing_userId' });
                const m = await getMember(uid); if (!m) return res.status(404).json({ success:false, error:'member_not_found' });
                const memberHighest = m?.roles?.highest?.position ?? 0; if (memberHighest >= myHighest) return res.status(403).json({ success:false, error:'insufficient_member_hierarchy' });
                const roles = log.data.roles || {}; const added = Array.isArray(roles.added)? roles.added: []; const removed = Array.isArray(roles.removed)? roles.removed: [];
                const currentIds = new Set(m.roles.cache.map(r=>r.id));
                const filterRole = (rid) => { const r = guild.roles.cache.get(rid); return r && !r.managed && r.id !== guild.id && r.position < myHighest; };
                // Only add roles that were removed (no longer present on the member)
                const toAdd = removed.filter(rid => filterRole(rid) && !currentIds.has(rid));
                // Only remove roles that were added (and are currently present)
                const toRemove = added.filter(rid => filterRole(rid) && currentIds.has(rid));
                const addObjs = toAdd.map(id => ({ id, name: roleName(id) }));
                const removeObjs = toRemove.map(id => ({ id, name: roleName(id) }));
                if (dryRun) {
                    const risks = [];
                    const skippedHigher = [...added, ...removed].filter(rid => { const r=guild.roles.cache.get(rid); return r && r.position >= myHighest; }).length;
                    if (skippedHigher) risks.push(`${skippedHigher} roles skipped due to hierarchy limits.`);
                    return res.json({ success:true, dryRun:true, plan:{ action:'revert_roles', user: briefUser(m), add: addObjs, remove: removeObjs }, risks });
                }
                try {
                    if (toAdd.length) await m.roles.add(toAdd, 'Dashboard revert roles (add removed)');
                    if (toRemove.length) await m.roles.remove(toRemove, 'Dashboard revert roles (remove added)');
                    await logAction('mod_dashboard_revert_roles', `Reverted roles of ${m.id}`, { userId:m.id, add: toAdd, remove: toRemove, logId: log?.id||null });
                    return res.json({ success:true, details:{ user: briefUser(m), add: addObjs, remove: removeObjs } });
                } catch(e){ logger.warn('revert roles failed', e); return res.status(500).json({ success:false, error:'revert_roles_failed' }); }
            }
            case 'mute':
            case 'unmute':
            case 'deafen':
            case 'undeafen': {
                if (!userId) return res.status(400).json({ success:false, error:'missing_userId' });
                const m = await getMember(userId); if (!m) return res.status(404).json({ success:false, error:'member_not_found' });
                const memberHighest = m?.roles?.highest?.position ?? 0; if (memberHighest >= myHighest) return res.status(403).json({ success:false, error:'insufficient_member_hierarchy' });
                try {
                    const vs = m.voice;
                    if (!vs) return res.status(400).json({ success:false, error:'no_voice_state' });
                    if (dryRun) {
                        return res.json({ success:true, dryRun:true, plan:{ action, user: briefUser(m) }, risks:[] });
                    }
                    if (action === 'mute') await vs.setMute(true, reason||'Dashboard mute');
                    if (action === 'unmute') await vs.setMute(false, reason||'Dashboard unmute');
                    if (action === 'deafen') await vs.setDeaf(true, reason||'Dashboard deafen');
                    if (action === 'undeafen') await vs.setDeaf(false, reason||'Dashboard undeafen');
                    await logAction(`mod_dashboard_${action}`, `${action} ${m.id}`, { userId:m.id, reason, logId: log?.id||null });
                    return res.json({ success:true, details:{ user: briefUser(m), action } });
                } catch(e){ logger.warn('voice action failed', e); return res.status(500).json({ success:false, error:'voice_action_failed' }); }
            }
            case 'restore_message': {
                // Restore a deleted message content to its original channel (best-effort)
                if (!log || log.type !== 'mod_message_delete') return res.status(400).json({ success:false, error:'not_a_message_delete_log' });
                const data = log.data || {};
                const channelId = data.channelId; const content = data.content;
                if (!channelId || !content) return res.status(400).json({ success:false, error:'missing_message_content_or_channel' });
                try {
                    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(()=>null);
                    if (!channel || !channel.send) return res.status(404).json({ success:false, error:'channel_not_found' });
                    // Truncate to fit Discord message length
                    const maxLen = 1800;
                    const snippet = String(content).length > maxLen ? (String(content).slice(0,maxLen) + '…') : String(content);
                    const header = `🧩 Mensagem recuperada pelo dashboard\n— Autor: <@${data.authorId||'desconhecido'}>\n— ID original: ${log.message || data.messageId || 'N/A'}\n`;
                    const body = `${header}\n${'```'}\n${snippet}\n${'```'}`;
                    await channel.send({ content: body, allowedMentions: { parse: [] } });
                    await logAction('mod_dashboard_restore_message', `Restored message ${log.message||''}`, { channelId, logId: log.id });
                    return res.json({ success:true });
                } catch (e) {
                    logger.warn('restore_message failed', e);
                    return res.status(500).json({ success:false, error:'restore_failed' });
                }
            }
            case 'recreate_channel': {
                if (!log || !(log.type==='mod_channel_delete' || (log.type==='mod_channel_update' && log.data?.before))) return res.status(400).json({ success:false, error:'no_channel_snapshot' });
                const snap = log.type==='mod_channel_delete' ? log.data : (log.data.before || null);
                if (!snap || !snap.name || snap.type == null) return res.status(400).json({ success:false, error:'invalid_channel_snapshot' });
                try {
                    const me = guild.members.me || guild.members.cache.get(client.user.id);
                    const risks = [];
                    if (!me?.permissions?.has?.(PermissionFlagsBits.ManageChannels)) risks.push('Bot may lack Manage Channels permission.');
                    const parent = snap.parentId ? (guild.channels.cache.get(snap.parentId) || await guild.channels.fetch(snap.parentId).catch(()=>null)) : null;
                    if (snap.parentId && !parent) risks.push('Parent category missing; channel will be created at the top level.');
                    // Validate overwrite targets
                    const rawOverwrites = Array.isArray(snap.permissionOverwrites) ? snap.permissionOverwrites : [];
                    const validOverwrites = [];
                    let missingTargets = 0;
                    for (const po of rawOverwrites) {
                        const targetRole = guild.roles.cache.get(po.id);
                        const targetMember = guild.members.cache.get(po.id);
                        if (!targetRole && !targetMember) { missingTargets++; continue; }
                        validOverwrites.push({ id: po.id, type: po.type, allow: BigInt(po.allow||'0'), deny: BigInt(po.deny||'0') });
                    }
                    if (missingTargets) risks.push(`${missingTargets} permission overwrite targets are missing and will be skipped.`);
                    // Type-aware options (ignore unsupported props)
                    const isTextLike = [0, 5, 15].includes(snap.type); // Text, Announcement, Forum
                    const isVoiceLike = [2, 13].includes(snap.type); // Voice, Stage
                    const opts = { name: snap.name, type: snap.type };
                    if (parent) opts.parent = parent;
                    if (isTextLike) {
                        if (snap.topic != null) opts.topic = snap.topic;
                        if (snap.rateLimitPerUser != null) opts.rateLimitPerUser = snap.rateLimitPerUser;
                        if (snap.nsfw != null) opts.nsfw = !!snap.nsfw;
                    }
                    if (isVoiceLike) {
                        if (snap.bitrate != null) opts.bitrate = snap.bitrate;
                        if (snap.userLimit != null) opts.userLimit = snap.userLimit;
                        if (snap.rtcRegion != null) opts.rtcRegion = snap.rtcRegion;
                        if (snap.videoQualityMode != null) opts.videoQualityMode = snap.videoQualityMode;
                    }
                    if (snap.type === 15) { // Forum
                        if (snap.defaultAutoArchiveDuration != null) opts.defaultAutoArchiveDuration = snap.defaultAutoArchiveDuration;
                        if (snap.defaultThreadRateLimitPerUser != null) opts.defaultThreadRateLimitPerUser = snap.defaultThreadRateLimitPerUser;
                        if (snap.defaultSortOrder != null) opts.defaultSortOrder = snap.defaultSortOrder;
                        if (snap.defaultForumLayout != null) opts.defaultForumLayout = snap.defaultForumLayout;
                        if (snap.defaultReactionEmoji) opts.defaultReactionEmoji = snap.defaultReactionEmoji;
                        if (Array.isArray(snap.availableTags)) opts.availableTags = snap.availableTags;
                    }
                    if (dryRun) {
                        return res.json({ success:true, dryRun:true, plan: { create: opts, overwrites: validOverwrites.length }, risks });
                    }
                    const created = await guild.channels.create(opts);
                    if (validOverwrites.length) {
                        try { await created.permissionOverwrites.set(validOverwrites); } catch { risks.push('Failed to set some permission overwrites.'); }
                    }
                    await logAction('mod_dashboard_recreate_channel', `Recreated channel ${created.id}`, { fromLog: log.id, channelId: created.id });
                    return res.json({ success:true, channelId: created.id });
                } catch (e) { logger.warn('recreate_channel failed', e); return res.status(500).json({ success:false, error:'recreate_channel_failed' }); }
            }
            case 'rename_channel': {
                if (!log || !(log.data?.before || log.data?.after)) return res.status(400).json({ success:false, error:'no_channel_update_log' });
                const targetId = (log.data.after?.id || log.data.before?.id);
                const newName = (log.data.before?.name); // revert to previous name
                if (!targetId || !newName) return res.status(400).json({ success:false, error:'missing_target_or_name' });
                try {
                    if (dryRun) { return res.json({ success:true, dryRun:true, plan: { edit: { channelId: targetId, name: newName } } }); }
                    const ch = guild.channels.cache.get(targetId) || await guild.channels.fetch(targetId).catch(()=>null);
                    if (!ch || !ch.edit) return res.status(404).json({ success:false, error:'channel_not_found' });
                    await ch.edit({ name: newName, reason: reason||'Dashboard revert channel name' });
                    await logAction('mod_dashboard_rename_channel', `Renamed channel ${ch.id} -> ${newName}`, { fromLog: log.id, channelId: ch.id });
                    return res.json({ success:true });
                } catch (e) { logger.warn('rename_channel failed', e); return res.status(500).json({ success:false, error:'rename_channel_failed' }); }
            }
            case 'restore_role': {
                if (!log || !(log.type==='mod_role_delete' || (log.type==='mod_role_update' && log.data?.before))) return res.status(400).json({ success:false, error:'no_role_snapshot' });
                const snap = log.type==='mod_role_delete' ? log.data : (log.data.before || null);
                if (!snap || !snap.name) return res.status(400).json({ success:false, error:'invalid_role_snapshot' });
                try {
                    if (dryRun) { return res.json({ success:true, dryRun:true, plan: { create: { name: snap.name, permissions: snap.permissions||'0' }, restoreMembers: Array.isArray(snap.members) ? snap.members.length : 0 } }); }
                    const created = await guild.roles.create({
                        name: snap.name,
                        color: snap.color || undefined,
                        hoist: !!snap.hoist,
                        mentionable: !!snap.mentionable,
                        permissions: snap.permissions ? BigInt(snap.permissions) : undefined,
                        reason: reason||'Dashboard restore role'
                    });
                    // Best-effort restore membership captured in delete snapshot
                    if (Array.isArray(snap.members) && snap.members.length) {
                        const me = guild.members.me || guild.members.cache.get(client.user.id);
                        const myHighest = me?.roles?.highest?.position ?? 0;
                        const roleHighest = created.position;
                        if (roleHighest < myHighest) {
                            for (const uid of snap.members.slice(0, 2000)) { // safety cap
                                try {
                                    const m = await guild.members.fetch(uid).catch(()=>null);
                                    if (m) await m.roles.add(created, 'Dashboard restore role membership');
                                } catch {}
                            }
                        }
                    }
                    await logAction('mod_dashboard_restore_role', `Restored role ${created.id}`, { fromLog: log.id, roleId: created.id });
                    return res.json({ success:true, roleId: created.id });
                } catch (e) { logger.warn('restore_role failed', e); return res.status(500).json({ success:false, error:'restore_role_failed' }); }
            }
            case 'revert_role_props': {
                if (!log || !(log.type==='mod_role_update' && log.data?.before && log.data?.after)) return res.status(400).json({ success:false, error:'no_role_update_log' });
                const roleId = log.data.after.id; const before = log.data.before;
                try {
                    if (dryRun) { return res.json({ success:true, dryRun:true, plan: { edit: { roleId, name: before.name, permissions: before.permissions||'0' } }, risks: [] }); }
                    const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(()=>null);
                    if (!role) return res.status(404).json({ success:false, error:'role_not_found' });
                    await role.edit({
                        name: before.name,
                        color: before.color,
                        hoist: !!before.hoist,
                        mentionable: !!before.mentionable,
                        permissions: before.permissions ? BigInt(before.permissions) : undefined,
                        reason: reason||'Dashboard revert role props'
                    });
                    await logAction('mod_dashboard_revert_role_props', `Reverted role ${role.id}`, { fromLog: log.id, roleId });
                    return res.json({ success:true });
                } catch (e) { logger.warn('revert_role_props failed', e); return res.status(500).json({ success:false, error:'revert_role_props_failed' }); }
            }
            case 'move_role_up':
            case 'move_role_down': {
                const { roleId, steps } = req.body || {};
                if (!roleId) return res.status(400).json({ success:false, error:'missing_roleId' });
                const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(()=>null);
                if (!role) return res.status(404).json({ success:false, error:'role_not_found' });
                const me = guild.members.me || guild.members.cache.get(client.user.id);
                const myHighest = me?.roles?.highest?.position ?? 0;
                const risks = [];
                if (!me?.permissions?.has?.(PermissionFlagsBits.ManageRoles)) risks.push('Bot may lack Manage Roles permission.');
                if (role.position >= myHighest) return res.status(403).json({ success:false, error:'insufficient_role_hierarchy' });
                const delta = Math.max(1, parseInt(String(steps||'1'),10)||1) * (action==='move_role_up'? +1 : -1);
                const target = Math.min(myHighest-1, Math.max(1, role.position + delta));
                if (dryRun) return res.json({ success:true, dryRun:true, plan: { roleId, from: role.position, to: target }, risks });
                try {
                    await role.setPosition(target, { reason: reason||'Dashboard move role' });
                    await logAction(`mod_dashboard_${action}`, `Moved role ${role.id} to ${target}`, { roleId: role.id, from: role.position, to: target });
                    return res.json({ success:true, roleId: role.id, position: target });
                } catch(e){ logger.warn('move role failed', e); return res.status(500).json({ success:false, error:'move_role_failed' }); }
            }
            case 'move_channel_up':
            case 'move_channel_down': {
                const { channelId, steps } = req.body || {};
                if (!channelId) return res.status(400).json({ success:false, error:'missing_channelId' });
                const ch = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(()=>null);
                if (!ch) return res.status(404).json({ success:false, error:'channel_not_found' });
                const me = guild.members.me || guild.members.cache.get(client.user.id);
                const risks = [];
                if (!me?.permissions?.has?.(PermissionFlagsBits.ManageChannels)) risks.push('Bot may lack Manage Channels permission.');
                const siblings = guild.channels.cache.filter(c => (c.parentId||null) === (ch.parentId||null) && c.type === ch.type);
                const sorted = [...siblings.values()].sort((a,b)=> a.rawPosition - b.rawPosition);
                const idx = sorted.findIndex(c => c.id === ch.id);
                const delta = Math.max(1, parseInt(String(steps||'1'),10)||1) * (action==='move_channel_up'? -1 : +1);
                const newIndex = Math.min(sorted.length-1, Math.max(0, idx + delta));
                const targetPos = sorted[newIndex]?.rawPosition ?? ch.rawPosition;
                if (dryRun) return res.json({ success:true, dryRun:true, plan: { channelId, fromIndex: idx, toIndex: newIndex }, risks });
                try {
                    await ch.setPosition(targetPos, { reason: reason||'Dashboard move channel' });
                    await logAction(`mod_dashboard_${action}`, `Moved channel ${ch.id} to index ${newIndex}`, { channelId: ch.id, fromIndex: idx, toIndex: newIndex });
                    return res.json({ success:true, channelId: ch.id, index: newIndex });
                } catch(e){ logger.warn('move channel failed', e); return res.status(500).json({ success:false, error:'move_channel_failed' }); }
            }
            case 'move_channel_to_category': {
                const { channelId, parentId } = req.body || {};
                if (!channelId) return res.status(400).json({ success:false, error:'missing_channelId' });
                const ch = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(()=>null);
                if (!ch) return res.status(404).json({ success:false, error:'channel_not_found' });
                const me = guild.members.me || guild.members.cache.get(client.user.id);
                const risks = [];
                if (!me?.permissions?.has?.(PermissionFlagsBits.ManageChannels)) risks.push('Bot may lack Manage Channels permission.');
                let parent = null;
                if (parentId) {
                    parent = guild.channels.cache.get(parentId) || await guild.channels.fetch(parentId).catch(()=>null);
                    if (!parent) risks.push('Target category not found; channel will remain in place.');
                    if (parent && parent.type !== 4) risks.push('Target is not a category; operation will fail.');
                }
                if (dryRun) return res.json({ success:true, dryRun:true, plan: { channelId, toCategory: parent?.id || null }, risks });
                try {
                    const updated = await ch.setParent(parent || null, { lockPermissions: false });
                    await logAction('mod_dashboard_move_channel_to_category', `Moved channel ${ch.id} to category ${parent ? parent.id : 'none'}`, { channelId: ch.id, parentId: parent?.id||null });
                    return res.json({ success:true, channelId: updated.id, parentId: parent?.id||null });
                } catch(e){ logger.warn('move channel to category failed', e); return res.status(500).json({ success:false, error:'move_channel_to_category_failed' }); }
            }
            default:
                return res.status(400).json({ success:false, error:'unsupported_action' });
        }
    } catch (e) {
        logger.error('Error moderation action:', e);
        return res.status(500).json({ success:false, error:'Failed to perform moderation action' });
    }
});

// Webhooks API
app.get('/api/guild/:guildId/webhooks', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
    if (preferSqlite) {
            const storage = require('../utils/storage-sqlite');
            const list = await storage.listWebhooks(req.params.guildId);
            // Mark loaded types using runtime manager
            try {
                const loadedTypes = (global.discordClient?.webhooks?.getLoadedTypes?.(req.params.guildId)) || [];
                for (const w of list) w.loaded = loadedTypes.includes(w.type || 'logs');
            } catch {}
            return res.json({ success: true, webhooks: list });
        } else {
            if (!hasMongoEnv) return res.json({ success: true, webhooks: [] });
            const { isReady } = require('../utils/db/mongoose');
            if (!isReady()) {
                // Evitar timeout de buffering quando a DB não está pronta
                return res.json({ success: true, webhooks: [] });
            }
            const { WebhookModel } = require('../utils/db/models');
            const list = await WebhookModel.find({ guild_id: req.params.guildId }).lean();
            try {
                const loadedTypes = (global.discordClient?.webhooks?.getLoadedTypes?.(req.params.guildId)) || [];
                for (const w of list) w.loaded = loadedTypes.includes(w.type || 'logs');
            } catch {}
            return res.json({ success: true, webhooks: list });
        }
    } catch (e) {
        logger.error('Error listing webhooks:', e);
        res.status(500).json({ success: false, error: 'Failed to list webhooks' });
    }
});

// Verification Config (stub)
app.get('/api/guild/:guildId/verification/config', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
    const cfg = await storage.getGuildConfig(req.params.guildId);
    const v = cfg?.verification || {};
    res.json({ success: true, config: v });
    } catch (e) { logger.error('Error get verification config:', e); res.status(500).json({ success: false, error: 'Failed to fetch verification config' }); }
});

app.post('/api/guild/:guildId/verification/config', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');

        // If only panelDefaults are being updated, handle as a patch-only update to avoid overwriting other fields with defaults
        const body = req.body || {};
        if (body && typeof body.panelDefaults === 'object' && body.panelDefaults !== null && Object.keys(body).every(k => k === 'panelDefaults')) {
            // Support clearing saved panel defaults
            if (body.panelDefaults && body.panelDefaults.clear === true) {
                const current = await storage.getGuildConfig(req.params.guildId) || {};
                const nextVerification = { ...(current.verification || {}) };
                if (nextVerification.panelDefaults) delete nextVerification.panelDefaults;
                const next = { ...current, verification: nextVerification };
                await storage.updateGuildConfig(req.params.guildId, next);
                return res.json({ success: true, message: 'Verification panel defaults cleared', config: next.verification });
            }
            // Validate panelDefaults structure separately
            const pdSchema = Joi.object({
                template: Joi.string().valid('minimal','rich').optional(),
                title: Joi.string().trim().max(100).allow('', null).optional(),
                description: Joi.string().trim().max(2000).allow('', null).optional(),
                buttonLabel: Joi.string().trim().max(80).allow('', null).optional(),
                color: Joi.string().trim().pattern(/^#?[0-9a-fA-F]{6}$/).optional()
            }).unknown(false);
            const { error: pdError, value: pdValue } = pdSchema.validate(body.panelDefaults, { abortEarly: false, stripUnknown: true });
            if (pdError) {
                return res.status(400).json({ success: false, error: 'validation_failed', details: pdError.details.map(d => d.message) });
            }
            const current = await storage.getGuildConfig(req.params.guildId) || {};
            const existingPd = (current?.verification?.panelDefaults) || {};
            const nextPd = { ...existingPd, ...pdValue };
            const next = { ...current, verification: { ...(current.verification || {}), panelDefaults: nextPd } };
            await storage.updateGuildConfig(req.params.guildId, next);
            return res.json({ success: true, message: 'Verification panel defaults updated', config: next.verification });
        }

        // Validate payload using Joi
        const questionSchema = Joi.object({
            id: Joi.string().max(64).optional(),
            label: Joi.string().trim().min(1).max(200).required(),
            type: Joi.string().valid('short_text','long_text','yes_no','multiple_choice','dropdown').required(),
            required: Joi.boolean().default(false),
            // For choice-based questions, at least 2 options of non-empty strings
            options: Joi.alternatives().conditional('type', {
                is: Joi.valid('multiple_choice','dropdown'),
                then: Joi.array().items(Joi.string().trim().min(1).max(100)).min(2).max(25),
                otherwise: Joi.forbidden()
            })
        });
        const schema = Joi.object({
            mode: Joi.string().valid('easy','medium','hard').default('easy'),
            method: Joi.string().valid('button','image','reaction','form').default('button'),
            cooldownSeconds: Joi.number().integer().min(0).max(3600).default(0),
            logFails: Joi.boolean().default(false),
            logFailRetention: Joi.number().integer().min(1).max(90)
                .when('logFails', { is: true, then: Joi.number().integer().min(1).max(90).default(7), otherwise: Joi.forbidden() }),
            verifiedRoleId: Joi.string().trim().pattern(/^\d+$/).optional(),
            unverifiedRoleId: Joi.string().trim().pattern(/^\d+$/).optional(),
            form: Joi.object({
                questions: Joi.array().items(questionSchema).max(20)
            }).when('method', {
                is: 'form',
                then: Joi.object({ questions: Joi.array().min(1).items(questionSchema).max(20) }).required(),
                otherwise: Joi.forbidden()
            }),
            // Allow full update to also carry panelDefaults inline
            panelDefaults: Joi.object({
                template: Joi.string().valid('minimal','rich').optional(),
                title: Joi.string().trim().max(100).allow('', null).optional(),
                description: Joi.string().trim().max(2000).allow('', null).optional(),
                buttonLabel: Joi.string().trim().max(80).allow('', null).optional(),
                color: Joi.string().trim().pattern(/^#?[0-9a-fA-F]{6}$/).optional()
            }).optional()
        });
        const { error, value } = schema.validate(req.body || {}, { abortEarly: false, stripUnknown: true });
        if (error) {
            return res.status(400).json({ success: false, error: 'validation_failed', details: error.details.map(d => d.message) });
        }

        // Sanitize options (dedupe, trim) best-effort
        if (value.form && Array.isArray(value.form.questions)) {
            for (const q of value.form.questions) {
                if (Array.isArray(q.options)) {
                    const uniq = [];
                    const seen = new Set();
                    for (const opt of q.options) {
                        const s = String(opt).trim();
                        if (!s) continue;
                        const k = s.toLowerCase();
                        if (seen.has(k)) continue;
                        seen.add(k);
                        uniq.push(s);
                    }
                    q.options = uniq.slice(0, 25);
                }
                // Assign an id if missing
                if (!q.id) q.id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            }
        }

    const current = await storage.getGuildConfig(req.params.guildId) || {};
    // Merge panelDefaults separately to preserve existing subfields when omitted
    const nextVerification = { ...(current.verification || {}), ...value };
    if (value && typeof value.panelDefaults === 'object') {
        nextVerification.panelDefaults = { ...(current?.verification?.panelDefaults || {}), ...(value.panelDefaults || {}) };
    }
    const next = { ...current, verification: nextVerification };
        await storage.updateGuildConfig(req.params.guildId, next);
    res.json({ success: true, message: 'Verification config updated', config: next.verification });
    } catch (e) { logger.error('Error set verification config:', e); res.status(500).json({ success: false, error: 'Failed to update verification config' }); }
});

// Verification metrics API
app.get('/api/guild/:guildId/verification/metrics', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const window = String(req.query.window || '24h');
        let sinceMs = 24*60*60*1000;
        if (window === '1h') sinceMs = 60*60*1000;
        else if (window === '7d') sinceMs = 7*24*60*60*1000;
        const sinceIso = new Date(Date.now() - sinceMs).toISOString();
        const metrics = await storage.countVerificationMetrics(req.params.guildId, sinceIso);
        return res.json({ success: true, since: sinceIso, window, metrics });
    } catch (e) { logger.error('Error verification metrics:', e); return res.status(500).json({ success: false, error: 'Failed to fetch verification metrics' }); }
});

// Verification logs export and clean
app.get('/api/guild/:guildId/verification/logs', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit || '200'), 10) || 200));
        const all = await storage.getLogs(req.params.guildId, limit);
        const filtered = all.filter(l => l.type === 'verification_success' || l.type === 'verification_fail');
        return res.json({ success: true, logs: filtered });
    } catch (e) { logger.error('Error verification logs:', e); return res.status(500).json({ success: false, error: 'Failed to fetch verification logs' }); }
});

app.delete('/api/guild/:guildId/verification/logs', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const olderThanDays = Math.max(1, Math.min(365, parseInt(String(req.query.olderThanDays || '30'), 10) || 30));
        const r = await storage.pruneLogsByTypeOlderThan(req.params.guildId, 'verification_fail', olderThanDays * 24 * 60 * 60 * 1000);
        return res.json({ success: true, pruned: r?.pruned !== false });
    } catch (e) { logger.error('Error prune verification logs:', e); return res.status(500).json({ success: false, error: 'Failed to prune verification logs' }); }
});

// Moderation summary API (counts by family within a time window)
app.get('/api/guild/:guildId/moderation/summary', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const window = String(req.query.window || '24h');
        let sinceMs = 24*60*60*1000;
        if (window === '1h') sinceMs = 60*60*1000; else if (window === '7d') sinceMs = 7*24*60*60*1000;
        const since = Date.now() - sinceMs;
        const all = await storage.getLogs(req.params.guildId, 1000);
        const relevant = (Array.isArray(all) ? all : []).filter(l => l && l.type && l.type.startsWith('mod_') && new Date(l.timestamp).getTime() >= since);
        // Counters
        const metrics = {
            messageDeletes: 0,
            messageBulkDeletes: 0,
            messageUpdates: 0,
            banAdds: 0,
            banRemoves: 0,
            memberJoins: 0,
            memberLeaves: 0,
            memberUpdates: 0,
            voiceJoins: 0,
            voiceLeaves: 0,
            voiceMoves: 0
        };
        for (const l of relevant) {
            const t = l.type;
            if (t === 'mod_message_delete') metrics.messageDeletes++;
            else if (t === 'mod_message_bulk_delete') metrics.messageBulkDeletes++;
            else if (t === 'mod_message_update') metrics.messageUpdates++;
            else if (t === 'mod_ban_add') metrics.banAdds++;
            else if (t === 'mod_ban_remove') metrics.banRemoves++;
            else if (t === 'mod_member_join') metrics.memberJoins++;
            else if (t === 'mod_member_leave') metrics.memberLeaves++;
            else if (t === 'mod_member_update') metrics.memberUpdates++;
            else if (t === 'mod_voice_join') metrics.voiceJoins++;
            else if (t === 'mod_voice_leave') metrics.voiceLeaves++;
            else if (t === 'mod_voice_move') metrics.voiceMoves++;
        }
        return res.json({ success: true, window, metrics });
    } catch (e) { logger.error('Error moderation summary:', e); return res.status(500).json({ success: false, error: 'Failed to fetch moderation summary' }); }
});

// Quick Tags (guild-level quick replies)
app.get('/api/guild/:guildId/quick-tags', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const cfg = await storage.getGuildConfig(req.params.guildId);
        const list = Array.isArray(cfg?.quickTags) ? cfg.quickTags : [];
        res.json({ success: true, tags: list });
    } catch (e) { logger.error('Error get quick-tags:', e); res.status(500).json({ success: false, error: 'Failed to fetch quick tags' }); }
});

app.post('/api/guild/:guildId/quick-tags', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const current = await storage.getGuildConfig(req.params.guildId) || {};
        const existing = Array.isArray(current.quickTags) ? current.quickTags : [];
        const body = req.body || {};
        const nextList = Array.isArray(body.tags) ? body.tags : existing;
        const next = { ...current, quickTags: nextList }; await storage.updateGuildConfig(req.params.guildId, next);
        res.json({ success: true, tags: nextList });
    } catch (e) { logger.error('Error set quick-tags:', e); res.status(500).json({ success: false, error: 'Failed to update quick tags' }); }
});

// Commands API (custom slash-like commands rendered by bot)
const commandSchema = Joi.object({
    name: Joi.string().trim().min(1).max(32).regex(/^[a-z0-9_\-]+$/i).required(),
    description: Joi.string().trim().allow('').max(100).default(''),
    type: Joi.string().valid('text','embed').required(),
    content: Joi.alternatives().conditional('type', {
        is: 'embed',
        then: Joi.object().unknown(true),
        otherwise: Joi.string().trim().max(2000)
    }),
    enabled: Joi.boolean().default(true)
});

const commandsPayloadSchema = Joi.object({
    commands: Joi.array().items(commandSchema).max(200).default([])
});

app.get('/api/guild/:guildId/commands', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const storage = require('../utils/storage');
        const existing = await storage.getGuildConfig(req.params.guildId, 'customCommands');
        return res.json({ success: true, commands: Array.isArray(existing) ? existing : [] });
    } catch (e) {
        logger.error('Error get commands:', e);
        return res.status(500).json({ success: false, error: 'Failed to fetch commands' });
    }
});

app.post('/api/guild/:guildId/commands', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const { error, value } = commandsPayloadSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) return res.status(400).json({ success: false, error: 'validation_error', details: error.details.map(d=>d.message) });

        // Sanitize names (remove leading '/') and enforce uniqueness (case-insensitive)
        const dedup = [];
        const seen = new Set();
        for (const raw of value.commands) {
            const name = String(raw.name || '').replace(/^\//,'');
            const key = name.toLowerCase();
            if (seen.has(key)) continue; // skip duplicates
            seen.add(key);
            dedup.push({ ...raw, name });
        }

        const storage = require('../utils/storage');
        await storage.setGuildConfig(req.params.guildId, 'customCommands', dedup);
        return res.json({ success: true, count: dedup.length });
    } catch (e) {
        logger.error('Error set commands:', e);
        return res.status(500).json({ success: false, error: 'Failed to update commands' });
    }
});

// Diagnostics (basic heuristics)
app.get('/api/guild/:guildId/diagnostics', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const guild = client.guilds.cache.get(req.params.guildId); if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });
        const roles = Array.from(guild.roles.cache.values());
        const channels = Array.from(guild.channels.cache.values());
        const suggestions = [];
        // Duplicate role names
        const byName = new Map();
        for (const r of roles) { const k = (r.name||'').toLowerCase(); byName.set(k, (byName.get(k)||0)+1); }
        for (const [name,count] of byName) { if (count>1) suggestions.push({ type:'roles', message:`Há ${count} cargos com o nome "${name}"` }); }
        // Inactive text channels heuristic: no topic and low message limit on cache (shallow)
        const inactive = channels.filter(c => c.type === 0 && !c.topic);
        if (inactive.length >= 10) suggestions.push({ type:'channels', message: `${inactive.length} canais de texto sem tópico (pode indicar desorganização)` });
        // Bots without manage roles/admin (best-effort)
        const bots = guild.members.cache.filter(m => m.user.bot);
        const weakBots = [];
        for (const m of bots.values()) {
            const perms = m.permissions || m.roles?.botRole?.permissions;
            if (perms && !perms.has) continue;
            weakBots.push(m.user.username);
        }
        if (weakBots.length) suggestions.push({ type:'bots', message:`Bots com permissões possivelmente insuficientes: ${weakBots.slice(0,5).join(', ')}` });
        res.json({ success: true, stats: { memberCount: guild.memberCount, roleCount: roles.length, channelCount: channels.length }, suggestions });
    } catch (e) { logger.error('Error diagnostics:', e); res.status(500).json({ success: false, error: 'Failed to run diagnostics' }); }
});

// Backup export (JSON bundle)
app.get('/api/guild/:guildId/backup/export', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient; if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id); if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const storage = require('../utils/storage');
        const [tickets, config, logs] = await Promise.all([
            storage.getTickets(req.params.guildId),
            storage.getGuildConfig(req.params.guildId),
            storage.getLogs(req.params.guildId, 1000)
        ]);
        const bundle = { guild_id: req.params.guildId, exported_at: new Date().toISOString(), tickets, config, logs };
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=backup-${req.params.guildId}.json`);
        return res.send(JSON.stringify(bundle, null, 2));
    } catch (e) { logger.error('Error backup export:', e); res.status(500).json({ success: false, error: 'Failed to export backup' }); }
});

// Performance metrics
app.get('/api/guild/:guildId/performance', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const guildId = req.params.guildId;
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });

        // Current metrics
        const processMem = process.memoryUsage();
        const uptime = process.uptime();
        const apiPing = client.ws?.ping || null;

        // Optional active users (online) snapshot
        let activeUsers = 0;
        try {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                activeUsers = guild.members.cache.filter(m => {
                    const s = m.presence?.status; return s==='online'||s==='idle'||s==='dnd';
                }).size;
            }
        } catch {}

        const memMB = Math.round((processMem.rss || 0)/1024/1024);
        // Sample into history
        try { pushPerfSample(guildId, { cpu: 0, memMB, activeUsers, ticketsOpen: 0 }); } catch {}

        // Build history + trend
        const history = perfHistory[guildId] || [];
        let trend = null;
        if(history.length >= 5){
            const last = history[history.length-1];
            const prev = history.slice(0, -1);
            const avg = (arr, k)=> arr.reduce((s,x)=>s+(x[k]||0),0)/arr.length;
            trend = {
                memMB: last.memMB - avg(prev, 'memMB'),
                activeUsers: last.activeUsers - avg(prev, 'activeUsers')
            };
        }

        return res.json({ success: true, metrics: {
            uptimeSeconds: Math.round(uptime),
            memoryMB: memMB,
            heapUsedMB: Math.round((processMem.heapUsed || 0)/1024/1024),
            apiPing
        }, history, trend });
    } catch (e) {
        logger.error('Error perf endpoint:', e);
        return res.status(500).json({ success: false, error: 'Failed to fetch performance history' });
    }
});


app.post('/api/guild/:guildId/webhooks', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        if (!preferSqlite) {
            if (!hasMongoEnv) return res.status(503).json({ success: false, error: 'Mongo not available' });
            const { isReady } = require('../utils/db/mongoose');
            if (!isReady()) return res.status(503).json({ success: false, error: 'Mongo not connected' });
        }
        const { type = 'logs', name = 'Logs', url, channel_id, channel_name } = req.body || {};
        if (!url || !url.startsWith('https://discord.com/api/webhooks/')) return res.status(400).json({ success: false, error: 'Invalid webhook URL' });
        if (preferSqlite) {
            const storage = require('../utils/storage-sqlite');
            const saved = await storage.upsertWebhook({ guild_id: req.params.guildId, type, name, url, channel_id, channel_name, enabled: true });
            // Atualizar gestor em memória para refletir imediatamente no runtime
            try {
                const client = global.discordClient;
                if (client?.webhooks?.addWebhook) {
                    await client.webhooks.addWebhook(req.params.guildId, type || 'logs', name || 'Logs', url);
                }
            } catch {}
            return res.json({ success: true, webhook: saved });
        } else {
            const { WebhookModel } = require('../utils/db/models');
            const saved = await WebhookModel.findOneAndUpdate(
                { guild_id: req.params.guildId, type },
                { $set: { name, url, channel_id, channel_name, enabled: true } },
                { upsert: true, new: true }
            ).lean();
            // Atualizar gestor em memória para refletir imediatamente no runtime
            try {
                const client = global.discordClient;
                if (client?.webhooks?.addWebhook) {
                    await client.webhooks.addWebhook(req.params.guildId, type || 'logs', name || 'Logs', url);
                }
            } catch {}
            return res.json({ success: true, webhook: saved });
        }
    } catch (e) {
        logger.error('Error upserting webhook:', e);
        res.status(500).json({ success: false, error: 'Failed to upsert webhook' });
    }
});

app.delete('/api/guild/:guildId/webhooks/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
    if (preferSqlite) {
        const storage = require('../utils/storage-sqlite');
        await storage.deleteWebhookById(req.params.id, req.params.guildId);
        // Remover do gestor em memória
        try {
            const client = global.discordClient;
            if (client?.webhooks?.removeWebhook) {
                const t = (req.query && req.query.type) ? String(req.query.type) : 'logs';
                await client.webhooks.removeWebhook(req.params.guildId, t);
            }
        } catch {}
        return res.json({ success: true, deleted: 1 });
    } else {
        if (!hasMongoEnv) return res.status(503).json({ success: false, error: 'Mongo not available' });
        const { isReady } = require('../utils/db/mongoose');
        if (!isReady()) return res.status(503).json({ success: false, error: 'Mongo not connected' });
        const { WebhookModel } = require('../utils/db/models');
        const result = await WebhookModel.deleteOne({ _id: req.params.id, guild_id: req.params.guildId });
        // Remover do gestor em memória
        try {
            const client = global.discordClient;
            if (client?.webhooks?.removeWebhook) {
                const t = (req.query && req.query.type) ? String(req.query.type) : 'logs';
                await client.webhooks.removeWebhook(req.params.guildId, t);
            }
        } catch {}
        return res.json({ success: true, deleted: result.deletedCount });
    }
    } catch (e) {
        logger.error('Error deleting webhook:', e);
        res.status(500).json({ success: false, error: 'Failed to delete webhook' });
    }
});

// Auto-setup a logs webhook using bot capabilities
app.post('/api/guild/:guildId/webhooks/auto-setup', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const guild = check.guild;
        const wm = client.webhooks;
        const ok = await wm.setupForGuild(guild);
        if (!ok) return res.status(500).json({ success: false, error: 'Failed to setup webhook' });
        // Persist to storage (best effort)
        try {
            const info = wm.webhooks.get(req.params.guildId);
            const url = info?.webhook?.url;
            const name = info?.name || guild.name;
            let channel_id = null, channel_name = null;
            try {
                const candidate = guild.channels.cache.find(c => c.type === 0 && /log|ticket|arquivo/i.test(c.name) && c.permissionsFor(guild.members.me)?.has(['ManageWebhooks','SendMessages']))
                    || guild.systemChannel
                    || guild.channels.cache.find(c => c.type === 0);
                if (candidate) { channel_id = candidate.id; channel_name = candidate.name || null; }
            } catch {}
            if (url) {
                if (preferSqlite) {
                    const storage = require('../utils/storage-sqlite');
                    await storage.upsertWebhook({ guild_id: req.params.guildId, type: 'logs', name, url, channel_id, channel_name, enabled: true });
                } else if ((process.env.MONGO_URI || process.env.MONGODB_URI)) {
                    const { isReady } = require('../utils/db/mongoose');
                    if (isReady()) {
                        const { WebhookModel } = require('../utils/db/models');
                        await WebhookModel.findOneAndUpdate(
                            { guild_id: req.params.guildId, type: 'logs' },
                            { $set: { name, url, channel_id, channel_name, enabled: true } },
                            { upsert: true }
                        );
                    }
                }
            }
        } catch (e) {
            logger.warn('Failed to persist auto-setup webhook to Mongo:', e.message);
        }
        res.json({ success: true, message: 'Webhook configured' });
    } catch (e) {
        logger.error('Error auto-setup webhook:', e);
        res.status(500).json({ success: false, error: 'Failed to auto-setup webhook' });
    }
});

// Create a webhook of a given type in a specific channel (server-side creation)
app.post('/api/guild/:guildId/webhooks/create-in-channel', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const guild = check.guild;
        const { type = 'logs', channel_id, name } = req.body || {};
        if (!channel_id) return res.status(400).json({ success: false, error: 'Missing channel_id' });
        const channel = guild.channels.cache.get(channel_id) || await client.channels.fetch(channel_id).catch(() => null);
        if (!channel || !channel.createWebhook) return res.status(404).json({ success: false, error: 'Channel not found or unsupported' });
        const wh = await channel.createWebhook({ name: name || `IGNIS ${type}` }).catch(() => null);
        if (!wh || !wh.url) return res.status(500).json({ success: false, error: 'Failed to create webhook' });
        // Persist and update runtime
        try {
            if (preferSqlite) {
                const storage = require('../utils/storage-sqlite');
                await storage.upsertWebhook({ guild_id: req.params.guildId, type, name: name || `IGNIS ${type}`, url: wh.url, channel_id, channel_name: channel.name, enabled: true });
            } else if (hasMongoEnv) {
                const { isReady } = require('../utils/db/mongoose');
                if (isReady()) {
                    const { WebhookModel } = require('../utils/db/models');
                    await WebhookModel.findOneAndUpdate(
                        { guild_id: req.params.guildId, type },
                        { $set: { name: name || `IGNIS ${type}`, url: wh.url, channel_id, channel_name: channel.name, enabled: true } },
                        { upsert: true }
                    );
                }
            }
            if (client?.webhooks?.addWebhook) {
                await client.webhooks.addWebhook(req.params.guildId, type, name || `IGNIS ${type}`, wh.url);
            }
        } catch {}
        return res.json({ success: true, webhook: { type, name: name || `IGNIS ${type}`, url: wh.url, channel_id, channel_name: channel.name } });
    } catch (e) {
        logger.error('Error creating webhook in channel:', e);
        res.status(500).json({ success: false, error: 'Failed to create webhook in channel' });
    }
});

// Test a specific webhook type by sending a sample embed
app.post('/api/guild/:guildId/webhooks/test', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
        const { type = 'logs' } = req.body || {};
        const wm = client.webhooks;
        if (!wm) return res.status(500).json({ success: false, error: 'Webhook manager not available' });
        const info = wm.getWebhookInfo(req.params.guildId, type);
        if (!info || !info.webhook?.url) return res.status(404).json({ success: false, error: `Webhook type '${type}' not configured` });
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle('🔔 Teste de Webhook')
            .setDescription(`Mensagem de teste enviada pelo dashboard (${type}).`)
            .setColor(type === 'tickets' ? 0x60A5FA : type === 'updates' ? 0xF59E0B : 0x7C3AED)
            .setTimestamp();
        await info.webhook.send({ embeds: [embed], username: `IGNIS • ${type}` });
        return res.json({ success: true, message: 'Test sent' });
    } catch (e) {
        logger.error('Error testing webhook:', e);
        res.status(500).json({ success: false, error: 'Failed to test webhook' });
    }
});

// Create a panel directly from dashboard
// Simple in-memory guard to prevent double panel creation within short window
const __panelCreateLocks = new Map(); // key -> expiresAt (ms)
function __makePanelKey(guildId, channelId, type, idem) {
    return `${guildId}:${channelId}:${type}:${idem||''}`;
}
function __isLocked(key) {
    const now = Date.now();
    const exp = __panelCreateLocks.get(key);
    if (typeof exp === 'number' && exp > now) return true;
    if (typeof exp === 'number' && exp <= now) __panelCreateLocks.delete(key);
    return false;
}
function __lock(key, ttlMs = 5000) {
    __panelCreateLocks.set(key, Date.now() + Math.max(1000, ttlMs));
}

app.post('/api/guild/:guildId/panels/create', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, error: 'Not authenticated' });
    try {
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const check = await ensureGuildAdmin(client, req.params.guildId, req.user.id);
        if (!check.ok) return res.status(check.code).json({ success: false, error: check.error });
    const storage = require('../utils/storage');
    const cfg = await storage.getGuildConfig(req.params.guildId).catch(() => ({}));
    // panel type: 'tickets' | 'verification'
    const type = (req.body?.type === 'verification') ? 'verification' : 'tickets';
    let { channel_id, theme = 'dark' } = req.body || {};
    const options = (req.body && typeof req.body.options === 'object') ? req.body.options : {};
    // Fallback: if no channel_id provided and type is tickets, use configured panelChannelId
    if (!channel_id && type === 'tickets') {
        const fallback = cfg?.tickets?.panelChannelId;
        if (fallback) channel_id = String(fallback);
    }
    // Template handling for tickets and verification (use saved defaults when available)
    const cfgTemplate = type === 'tickets' ? (cfg?.tickets?.defaultTemplate) : (cfg?.verification?.panelDefaults?.template || 'minimal');
    let template = (req.body && req.body.template) ? String(req.body.template) : (typeof cfgTemplate === 'string' ? cfgTemplate : (type === 'verification' ? 'minimal' : 'classic'));
    if (type === 'verification') {
        if (!['minimal','rich'].includes(template)) template = 'minimal';
    } else {
        if (!['classic','compact','premium','minimal'].includes(template)) template = 'classic';
    }
    if (!channel_id) return res.status(400).json({ success: false, error: 'Missing channel_id' });
        // Idempotency/lock: avoid duplicate sends for same (guild, channel, type) within a short window
        const idemHeader = (req.get && req.get('X-Idempotency-Key')) || (req.headers && (req.headers['x-idempotency-key'] || req.headers['X-Idempotency-Key'])) || '';
        const guardKey = __makePanelKey(req.params.guildId, channel_id, type, idemHeader ? String(idemHeader) : '');
        const altGuardKey = __makePanelKey(req.params.guildId, channel_id, type, '');
        if (__isLocked(guardKey) || __isLocked(altGuardKey)) {
            return res.status(202).json({ success: true, message: 'Panel creation in progress (deduplicated)' });
        }
        __lock(guardKey, 7000); // hold ~7s
        __lock(altGuardKey, 7000);
        const guild = check.guild;
        const channel = guild.channels.cache.get(channel_id) || await client.channels.fetch(channel_id).catch(() => null);
        if (!channel || !channel.send) return res.status(404).json({ success: false, error: 'Channel not found' });
        // Build payload like slash command
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
        const visualAssets = require('../assets/visual-assets');
        // Resolve color: from options.color (#hex or int), else theme-based default
        const parseColor = (c) => {
            if (typeof c === 'number') return c;
            if (typeof c === 'string') {
                const s = c.trim();
                if (/^#?[0-9a-fA-F]{6}$/.test(s)) {
                    return parseInt(s.replace('#',''), 16);
                }
            }
            return null;
        };
    // Pull in verification panelDefaults as baseline for options
    const vPanelDefaults = (type === 'verification') ? (cfg?.verification?.panelDefaults || {}) : {};
    const effOptions = { ...vPanelDefaults, ...(options || {}) };
    const resolvedColor = parseColor(effOptions.color) ?? (theme === 'light' ? 0x60A5FA : 0x7C3AED);
        let embed = new EmbedBuilder().setColor(resolvedColor);
        let rows = [];
        if (type === 'verification') {
            // Unified minimal verification panel
            const vcfg = cfg?.verification || {};
            const method = (vcfg.method || 'button');
            const isReaction = method === 'reaction';
                        const isImage = method === 'image';
                        const defaultTitle = '🔒 Verificação do Servidor';
                        const defaultDesc = isReaction
                  ? (template === 'rich'
                      ? `Bem-vindo(a) a **${cfg.serverName || guild.name}**.\n\nPara aceder a todos os canais, reage com ✅ nesta mensagem para concluir a verificação.`
                      : 'Reage com ✅ nesta mensagem para te verificares.'
                    )
                                    : isImage
                                        ? (template === 'rich'
                                                ? `Bem-vindo(a) a **${cfg.serverName || guild.name}**.\n\nCarrega em Verificar para receberes um captcha por imagem e concluir a verificação.`
                                                : 'Carrega em Verificar para resolveres o captcha por imagem.'
                                            )
                                        : (template === 'rich'
                      ? `Bem-vindo(a) a **${cfg.serverName || guild.name}**.\n\nPara aceder a todos os canais, conclui a verificação clicando no botão abaixo.`
                      : 'Clica em Verificar para concluir e ganhar acesso aos canais.'
                    );
                        const title = (typeof effOptions.title === 'string' && effOptions.title.trim()) ? effOptions.title.trim().slice(0, 100) : defaultTitle;
                        const description = (typeof effOptions.description === 'string' && effOptions.description.trim()) ? effOptions.description.trim().slice(0, 2000) : defaultDesc;
                        embed
                                .setTitle(title)
                                .setDescription(description)
                .setThumbnail(guild.iconURL({ size: 256 }))
                .setFooter({ text: 'IGNIS COMMUNITY™ • Sistema de verificação' })
                .setTimestamp();
            if (template === 'rich') {
                embed.addFields({ name: '⚠️ Importante', value: 'Segue as regras do servidor e mantém um perfil adequado.' });
            }
            if (!isReaction) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('verify_user').setLabel((typeof effOptions.buttonLabel === 'string' && effOptions.buttonLabel.trim()) ? effOptions.buttonLabel.trim().slice(0, 80) : 'Verificar').setEmoji('✅').setStyle(ButtonStyle.Primary)
                );
                rows = [row];
            } else {
                rows = [];
            }
        } else if (template === 'compact') {
            embed
                .setTitle('🎫 Tickets • Compacto')
                .setDescription('Escolhe abaixo e abre um ticket privado.');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket:create:support').setLabel('Suporte').setEmoji('🎫').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger)
            );
            rows = [row];
        } else if (template === 'minimal') {
            embed
                .setTitle('🎫 Abrir ticket')
                .setDescription('Carrega num botão para abrir um ticket.');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Abrir Ticket').setEmoji('🎟️').setStyle(ButtonStyle.Primary)
            );
            rows = [row];
        } else if (template === 'premium') {
            embed
                .setTitle('🎫 Centro de Suporte • Premium')
                .setDescription('Serviço prioritário, acompanhamento dedicado e histórico guardado.')
                .addFields(
                    { name: '• Resposta express', value: 'Prioridade máxima', inline: true },
                    { name: '• Privado & seguro', value: 'Só tu e equipa', inline: true },
                    { name: '• Transcript', value: 'Disponível a pedido', inline: true },
                );
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket:create:vip').setLabel('VIP / Premium').setEmoji('👑').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('ticket:create:technical').setLabel('Suporte Técnico').setEmoji('🔧').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Reportar Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket:create:moderation').setLabel('Moderação & Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Dúvidas Gerais').setEmoji('💬').setStyle(ButtonStyle.Secondary)
            );
            rows = [row1, row2];
        } else {
            // classic (default)
            embed
                .setTitle('🎫 Centro de Suporte')
                .setDescription('Escolhe o departamento abaixo para abrir um ticket privado com a equipa.')
                .addFields(
                    { name: '• Resposta rápida', value: 'Tempo médio: minutos', inline: true },
                    { name: '• Canal privado', value: 'Visível só para ti e staff', inline: true },
                    { name: '• Histórico guardado', value: 'Transcript disponível', inline: true },
                );
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket:create:technical').setLabel('Suporte Técnico').setEmoji('🔧').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Reportar Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('ticket:create:moderation').setLabel('Moderação & Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Secondary)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Dúvidas Gerais').setEmoji('💬').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('ticket:create:account').setLabel('Suporte de Conta').setEmoji('🧾').setStyle(ButtonStyle.Secondary)
            );
            rows = [row1, row2];
        }
        const payload = { embeds: [embed], components: rows };
        const msg = await channel.send(payload);
        // If method=reaction, add the ✅ reaction to guide users
        try {
            if (type === 'verification') {
                const vcfg = cfg?.verification || {};
                if ((vcfg.method || 'button') === 'reaction') {
                    await msg.react('✅').catch(() => {});
                }
            }
        } catch {}
        // Persist panel to active storage backend
        try {
            if (preferSqlite) {
                const storage = require('../utils/storage-sqlite');
                await storage.upsertPanel({ guild_id: req.params.guildId, channel_id, message_id: msg.id, theme, template, payload, type });
            } else if (process.env.MONGO_URI || process.env.MONGODB_URI) {
                const { PanelModel } = require('../utils/db/models');
                await PanelModel.findOneAndUpdate(
                    { guild_id: req.params.guildId, channel_id, type },
                    { $set: { message_id: msg.id, theme, template, payload } },
                    { upsert: true }
                );
            }
        } catch {}
    res.json({ success: true, message: 'Panel created', panel: { channel_id, message_id: msg.id, theme, template, type } });
    } catch (e) {
        logger.error('Error creating panel:', e);
        res.status(500).json({ success: false, error: 'Failed to create panel' });
    }
});

// Nova rota para detalhes de um ticket específico
app.get('/api/guild/:guildId/tickets/:ticketId', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    try {
        const { guildId, ticketId } = req.params;
        const client = global.discordClient;
        
        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not available' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        const storage = require('../utils/storage');
        const tickets = await storage.getTickets(guildId);
        const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        // Buscar mensagens do canal do ticket
        let messages = [];
    const channel = guild.channels.cache.get(ticket.channel_id);
        if (channel) {
            try {
                const fetchedMessages = await channel.messages.fetch({ limit: 100 });
                messages = fetchedMessages.map(msg => ({
                    id: msg.id,
                    content: msg.content,
                    author: {
                        id: msg.author.id,
                        username: msg.author.username,
                        discriminator: msg.author.discriminator,
                        avatar: msg.author.displayAvatarURL({ size: 32 })
                    },
                    timestamp: msg.createdAt,
                    embeds: msg.embeds.map(embed => ({
                        title: embed.title,
                        description: embed.description,
                        color: embed.color
                    }))
                })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            } catch (error) {
                logger.error('Erro ao buscar mensagens do ticket:', error);
            }
        }

        // Enriquecer dados do ticket
    const owner = await client.users.fetch(ticket.user_id).catch(() => null);
    const claimedBy = ticket.assigned_to ? await client.users.fetch(ticket.assigned_to).catch(() => null) : null;

        const enrichedTicket = {
            ...ticket,
            channelExists: !!channel,
            channelName: channel?.name || 'Canal deletado',
            ownerTag: owner ? `${owner.username}#${owner.discriminator}` : 'Usuário desconhecido',
            ownerAvatar: owner?.displayAvatarURL({ size: 64 }) || null,
            claimedByTag: claimedBy ? `${claimedBy.username}#${claimedBy.discriminator}` : null,
            claimedByAvatar: claimedBy?.displayAvatarURL({ size: 64 }) || null,
            timeAgo: formatTimeAgo(new Date(ticket.created_at)),
            messages
        };

        // If request asks for transcript download, return a simple text transcript
        if ((req.query.download || '').toString().toLowerCase() === 'transcript') {
            const lines = [];
            lines.push(`Ticket #${enrichedTicket.id} - ${enrichedTicket.category || 'Geral'}`);
            lines.push(`Canal: ${enrichedTicket.channelName} (${enrichedTicket.channel_id})`);
            lines.push(`Aberto por: ${enrichedTicket.ownerTag} (${enrichedTicket.user_id})`);
            lines.push(`Criado em: ${new Date(enrichedTicket.created_at).toLocaleString('pt-PT')}`);
            lines.push(`Status: ${enrichedTicket.status}`);
            lines.push('');
            lines.push('Mensagens:');
            for (const m of messages) {
                const when = new Date(m.timestamp).toLocaleString('pt-PT');
                lines.push(`[${when}] ${m.author?.username || 'Desconhecido'}#${m.author?.discriminator || '0000'}: ${m.content || ''}`);
            }
            const content = lines.join('\n');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=ticket-${enrichedTicket.id}-transcript.txt`);
            return res.send(content);
        }

        res.json({ success: true, ticket: enrichedTicket });
        
    } catch (error) {
        logger.error('Error fetching ticket details:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch ticket details' });
    }
});

// Rota para histórico de ações (ticket_logs)
app.get('/api/guild/:guildId/tickets/:ticketId/logs', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
        const { guildId, ticketId } = req.params;
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });
        const member = await guild.members.fetch(req.user.id).catch(() => null);
        if (!member) return res.status(403).json({ success: false, error: 'You are not a member of this server' });

    const storage = require('../utils/storage');
    let limit = parseInt(String(req.query.limit||'200'), 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 200;
    limit = Math.max(10, Math.min(1000, limit));
    let offset = parseInt(String(req.query.offset||'0'), 10);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;
    const logs = await storage.getTicketLogs(ticketId, limit, offset);
        // Enriquecer com informações do ator
        const enriched = await Promise.all((logs || []).map(async (l) => {
            let actorTag = null, actorAvatar = null;
            try {
                if (l.actor_id) {
                    const u = await client.users.fetch(l.actor_id).catch(() => null);
                    if (u) {
                        actorTag = `${u.username}#${u.discriminator}`;
                        actorAvatar = u.displayAvatarURL({ size: 32 });
                    }
                }
            } catch {}
            return { ...l, actorTag, actorAvatar };
        }));
        return res.json({ success: true, logs: enriched });
    } catch (e) {
        logger.error('Error fetching ticket logs:', e);
        return res.status(500).json({ success: false, error: 'Failed to fetch ticket logs' });
    }
});

// Export logs (CSV/JSON) with pagination support
app.get('/api/guild/:guildId/tickets/:ticketId/logs/export', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    try {
        const { guildId, ticketId } = req.params;
        const client = global.discordClient;
        if (!client) return res.status(500).json({ success: false, error: 'Bot not available' });
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ success: false, error: 'Guild not found' });
        const member = await guild.members.fetch(req.user.id).catch(() => null);
        if (!member) return res.status(403).json({ success: false, error: 'You are not a member of this server' });

        const storage = require('../utils/storage');
        const format = (req.query.format || 'json').toString().toLowerCase();
        const all = String(req.query.all || 'false').toLowerCase() === 'true';
        let limit = parseInt(String(req.query.limit|| (all ? '1000' : '500')), 10);
        if (!Number.isFinite(limit) || limit <= 0) limit = all ? 1000 : 500;
        limit = Math.max(10, Math.min(5000, limit));
        let offset = parseInt(String(req.query.offset||'0'), 10);
        if (!Number.isFinite(offset) || offset < 0) offset = 0;

        // For JSON/SQLite backends we don't want to load too much into memory; cap to 5000
        const logs = await storage.getTicketLogs(ticketId, limit, offset);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=ticket-${ticketId}-logs.csv`);
            const headers = ['timestamp','action','actor_id','message'];
            const escape = (s='') => '"' + String(s).replace(/"/g,'""') + '"';
            const lines = [headers.join(',')];
            for (const l of logs) {
                lines.push([
                    escape(new Date(l.timestamp).toISOString()),
                    escape(l.action||''),
                    escape(l.actor_id||''),
                    escape(l.message||'')
                ].join(','));
            }
            return res.send(lines.join('\n'));
        }

        // default JSON
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=ticket-${ticketId}-logs.json`);
        return res.send(JSON.stringify({ success: true, logs }, null, 2));
    } catch (e) {
        logger.error('Error exporting ticket logs:', e);
        return res.status(500).json({ success: false, error: 'Failed to export ticket logs' });
    }
});

// Rota para ações em tickets (claim, close, etc.)
app.post('/api/guild/:guildId/tickets/:ticketId/action', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    try {
        const { guildId, ticketId } = req.params;
        const { action, data } = req.body;
        const client = global.discordClient;
        
        if (!client) {
            return res.status(500).json({ success: false, error: 'Bot not available' });
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ success: false, error: 'Guild not found' });
        }

        // Verificar se o usuário é membro do servidor
        const member = await guild.members.fetch(req.user.id).catch(() => null);
        if (!member) {
            return res.status(403).json({ success: false, error: 'You are not a member of this server' });
        }

        const storage = require('../utils/storage');
        const tickets = await storage.getTickets(guildId);
        const ticket = tickets.find(t => `${t.id}` === `${ticketId}`);
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        let success = false;
        let message = '';

        switch (action) {
            case 'claim':
                if (ticket.status === 'open') {
                    await storage.updateTicket(ticketId, {
                        status: 'claimed',
                        claimed_by: req.user.id,
                        assigned_to: req.user.id,
                        claimed_at: new Date().toISOString()
                    });
                    success = true;
                    message = 'Ticket claimed successfully';
                } else {
                    message = 'Ticket cannot be claimed';
                }
                break;

            case 'release':
                if (ticket.status === 'claimed' && (ticket.assigned_to === req.user.id || ticket.claimed_by === req.user.id)) {
                    await storage.updateTicket(ticketId, {
                        status: 'open',
                        assigned_to: null
                    });
                    success = true;
                    message = 'Ticket released';
                } else {
                    message = 'Ticket cannot be released';
                }
                break;

            case 'close':
                if (['open', 'claimed'].includes(ticket.status)) {
                    await storage.updateTicket(ticketId, {
                        status: 'closed',
                        closed_by: req.user.id,
                        closed_at: new Date().toISOString(),
                        close_reason: data?.reason || 'Closed via dashboard'
                    });
                    success = true;
                    message = 'Ticket closed successfully';
                } else {
                    message = 'Ticket cannot be closed';
                }
                break;

            case 'reopen':
                if (ticket.status === 'closed') {
                    await storage.updateTicket(ticketId, {
                        status: 'open',
                        reopened_by: req.user.id,
                        reopened_at: new Date().toISOString()
                    });
                    success = true;
                    message = 'Ticket reopened successfully';
                } else {
                    message = 'Ticket cannot be reopened';
                }
                break;

            case 'assign':
                if (data?.userId) {
                    await storage.updateTicket(ticketId, { assigned_to: data.userId, status: 'claimed' });
                    success = true;
                    message = 'Ticket assigned';
                } else {
                    message = 'Missing userId';
                }
                break;

            case 'reply': {
                const content = data?.content?.trim();
                if (!content) {
                    message = 'Missing content';
                    break;
                }
                const channel = guild.channels.cache.get(ticket.channel_id);
                if (!channel) {
                    message = 'Channel not found';
                    break;
                }
                await channel.send({ content });
                success = true;
                message = 'Reply sent';
                break;
            }

            case 'addNote':
                const notes = Array.isArray(ticket.notes) ? ticket.notes.slice() : [];
                notes.push({ id: Date.now().toString(), content: data.content, author: req.user.id, timestamp: new Date().toISOString() });
                await storage.updateTicket(ticketId, { notes });
                success = true;
                message = 'Note added successfully';
                break;

            default:
                message = 'Invalid action';
        }

        res.json({ success, message });
        
    } catch (error) {
        logger.error('Error performing ticket action:', error);
        res.status(500).json({ success: false, error: 'Failed to perform action' });
    }
});

// Função helper para formatar tempo
function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days}d atrás`;
    if (hours > 0) return `${hours}h atrás`;
    if (minutes > 0) return `${minutes}m atrás`;
    return 'Agora mesmo';
}

// Start server only if not in bot-only mode
if (config.DISCORD.CLIENT_SECRET && config.DISCORD.CLIENT_SECRET !== 'bot_only') {
    // Attach socket.io on an HTTP server to support live updates
    const http = require('http');
    const server = http.createServer(app);
    try {
        const { Server } = require('socket.io');
        io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });
        // Share session & passport with Socket.io and require authenticated session
        io.use((socket, next) => sessionMiddleware(socket.request, {}, next));
        io.use((socket, next) => passport.initialize()(socket.request, {}, next));
        io.use((socket, next) => passport.session()(socket.request, {}, next));
        io.use((socket, next) => {
            try {
                const req = socket.request;
                if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) return next();
            } catch {}
            next(new Error('unauthorized'));
        });
        io.on('connection', (socket) => {
            socket.on('joinGuild', (guildId) => {
                try {
                    const req = socket.request;
                    if (!(typeof req.isAuthenticated === 'function' && req.isAuthenticated())) return;
                    if (guildId) socket.join(`g:${guildId}`);
                } catch {}
            });
        });
        // Expose a simple broadcaster for bot events
        global.socketManager = {
            // Legacy moderation feed
            broadcastModeration: (guildId, payload) => {
                try { io && io.to(`g:${guildId}`).emit('moderation_event', payload); } catch {}
            },
            // Generic event broadcast used by interaction handlers
            // Usage: broadcast(eventName, payload[, guildId])
            broadcast: (eventName, payload, guildId) => {
                try {
                    const data = { type: String(eventName||'event'), ...(payload||{}) };
                    if (guildId) {
                        io && io.to(`g:${guildId}`).emit('dashboard_event', data);
                    } else {
                        // If no guild provided, emit globally
                        io && io.emit('dashboard_event', data);
                    }
                } catch {}
            }
        };
    } catch (e) { logger.warn('socket.io init failed:', e?.message||e); }

    server.listen(PORT, () => {
        const callbackURL = getCallbackURL();
        logger.info(`🌐 Dashboard servidor iniciado em http://localhost:${PORT}`);
        logger.info(`🔑 OAuth Callback URL: ${callbackURL}`);
        logger.info(`🆔 Client ID: ${config.DISCORD.CLIENT_ID}`);
        logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
} else {
    logger.warn('⚠️ Dashboard não iniciado - CLIENT_SECRET não configurado');
}

module.exports = app;
