const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const fs = require('fs');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { EmbedBuilder, WebhookClient, REST, Routes } = require('discord.js');
const Database = require('./database/database');
const SocketManager = require('./socket');
const csrfProtection = require('../utils/csrf');
const logger = require('../utils/logger');
const config = require('../utils/config');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || config.WEBSITE?.PORT || 4000;

// Trust proxy settings (needed for rate limiting behind proxies)
app.set('trust proxy', 1);

// CORS Configuration for production
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const isProduction = process.env.NODE_ENV === 'production' || 
                            !!process.env.RAILWAY_ENVIRONMENT_NAME;
                            
        if (isProduction) {
            // Production allowed origins
                const allowedOrigins = [
                    'https://ysnmbot-alberto.up.railway.app',
                    'https://*.railway.app',
                    'https://discord.com',
                    'https://discordapp.com'
                ];
                // Allow explicit APP_ORIGIN or the detected appOrigin
                if (process.env.APP_ORIGIN) allowedOrigins.push(process.env.APP_ORIGIN);
                if (appOrigin) allowedOrigins.push(appOrigin);
            
            // Check if origin matches any allowed pattern
            const isAllowed = allowedOrigins.some(pattern => {
                if (pattern.includes('*')) {
                    const regex = new RegExp(pattern.replace('*', '.*'));
                    return regex.test(origin);
                }
                return pattern === origin;
            });
            
            if (isAllowed) {
                callback(null, true);
            } else {
                logger.warn('❌ CORS blocked origin: %s', origin);
                callback(new Error('Not allowed by CORS'));
            }
        } else {
            // Development - allow localhost
            const allowedDev = [
                'http://localhost:3000',
                'http://localhost:4000',
                'http://localhost:5000',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:4000',
                'http://127.0.0.1:5000'
            ];
            
            if (allowedDev.includes(origin)) {
                callback(null, true);
            } else {
                logger.debug('⚠️ Dev CORS allowing origin: %s', origin);
                callback(null, true); // Allow all in development
            }
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));

// Initialize database
const db = new Database();
db.initialize().then(() => {
    logger.info('✅ Database initialized successfully');
}).catch(error => {
    logger.error('❌ Database initialization failed:', { error: error && error.message ? error.message : error });
});

// Initialize Socket.IO
const socketManager = new SocketManager(server);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"]
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: { error: 'Muitas requisições, tente novamente em 15 minutos' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    trustProxy: true // Trust proxy headers
});
app.use(limiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Outgoing HTML sanitizer: small defensive middleware that strips unresolved
// template placeholders from server-rendered HTML responses to avoid leaking
// strings like `${...}` or encoded `%24%7B` into the UI. This is a safety
// net and intentionally conservative — it only touches string bodies that
// look like HTML.
app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        try {
            if (typeof body === 'string') {
                const contentType = (res.get && res.get('Content-Type')) || '';
                const looksLikeHtml = /<\s*html|<!doctype|<\s*head|<\s*body/i.test(body);
                if ((contentType && contentType.toLowerCase().includes('text/html')) || looksLikeHtml) {
                    // Strip unresolved template placeholders and their common encoded form
                    const cleaned = body.replace(/\$\{[^}]*\}/g, '').replace(/%24%7B/gi, '');
                    return originalSend.call(this, cleaned);
                }
            }
        } catch (e) {
            // If anything goes wrong, fall back to original send to avoid
            // breaking responses.
            console.warn('Outgoing HTML sanitizer failed:', e && e.message ? e.message : e);
        }
        return originalSend.call(this, body);
    };
    next();
});

// Carregar configuração segura (moved to top)

// Configuração de sessão segura
const isProd = process.env.NODE_ENV === 'production' || 
              !!process.env.RAILWAY_ENVIRONMENT_NAME || 
              !!process.env.RAILWAY_PROJECT_NAME;

// Determine application origin from environment (prefer explicit config)
const envAppOrigin = process.env.APP_ORIGIN || process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_ENVIRONMENT_URL || process.env.RAILWAY_SERVICE_URL || (config.WEBSITE && config.WEBSITE.production && config.WEBSITE.production.origin);
let appOrigin = null;
if (envAppOrigin) {
    try { appOrigin = (new URL(envAppOrigin)).origin; } catch (e) { if (/^https?:\/\//i.test(envAppOrigin)) appOrigin = envAppOrigin; }
}

// Cookie domain: allow explicit override via COOKIE_DOMAIN, otherwise derive from appOrigin when available.
let cookieDomain = undefined;
if (process.env.COOKIE_DOMAIN) {
    cookieDomain = process.env.COOKIE_DOMAIN;
} else if (appOrigin) {
    try { cookieDomain = '.' + (new URL(appOrigin)).hostname; } catch (e) { /* ignore */ }
}

app.use(session({
    secret: config.WEBSITE.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Nome customizado para o cookie
    cookie: {
        secure: isProd, // HTTPS obrigatório em produção
        httpOnly: true, // Proteção contra XSS
        // Use 'none' in production to allow OAuth providers to redirect back and set cookies
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 2 * 60 * 60 * 1000, // 2 horas (mais seguro que 24h)
        domain: cookieDomain || undefined
    }
}));

// Configurar Passport
app.use(passport.initialize());
app.use(passport.session());

// Detectar ambiente e configurar URL de callback
const isProduction = process.env.NODE_ENV === 'production' || 
                    !!process.env.RAILWAY_ENVIRONMENT_NAME || 
                    !!process.env.RAILWAY_PROJECT_NAME ||
                    !!process.env.RAILWAY_SERVICE_NAME;

// Build callback URL: allow CALLBACK_URL env to be either a full URL or a path
let callbackURL = null;
if (process.env.CALLBACK_URL) {
    // If CALLBACK_URL is a full URL, use it. If it's a path, prepend appOrigin when available.
    try {
        const parsed = new URL(process.env.CALLBACK_URL);
        callbackURL = parsed.href;
    } catch (e) {
        // Not a full URL, treat as path
        if (appOrigin) {
            callbackURL = new URL(process.env.CALLBACK_URL, appOrigin).href;
        } else {
            callbackURL = process.env.CALLBACK_URL; // fallback; may be a path
        }
    }
} else if (config.WEBSITE && config.WEBSITE.production && config.WEBSITE.production.redirectUri) {
    try { callbackURL = new URL(config.WEBSITE.production.redirectUri).href; } catch (e) { callbackURL = config.WEBSITE.production.redirectUri; }
} else if (!isProduction) {
    callbackURL = `http://localhost:${PORT}/auth/discord/callback`;
} else if (appOrigin) {
    callbackURL = new URL('/auth/discord/callback', appOrigin).href;
} else {
    callbackURL = 'https://ysnmbot-alberto.up.railway.app/auth/discord/callback';
}

logger.info('🔍 Debug OAuth2:', { NODE_ENV: process.env.NODE_ENV, RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME, RAILWAY_PROJECT_NAME: process.env.RAILWAY_PROJECT_NAME, isProduction, callbackURL, hasWebsite: !!config.WEBSITE });

// Verificar se CLIENT_SECRET está disponível para OAuth2
const hasClientSecret = !!config.DISCORD.CLIENT_SECRET;
logger.info('🔧 Configuração OAuth2 Discord', { clientId: config.DISCORD.CLIENT_ID ? `${config.DISCORD.CLIENT_ID.substring(0, 8)}...` : 'AUSENTE', hasClientSecret, callbackURL });

// Configurar OAuth2 apenas se CLIENT_SECRET estiver disponível
if (hasClientSecret) {
    // Estratégia do Discord
    passport.use(new DiscordStrategy({
        clientID: config.DISCORD.CLIENT_ID,
        clientSecret: config.DISCORD.CLIENT_SECRET,
        callbackURL: callbackURL,
        scope: ['identify', 'guilds']
    }, (accessToken, refreshToken, profile, done) => {
        logger.info('✅ OAuth2 estratégia executada com sucesso', { profileId: profile.id, profileUsername: profile.username });
        return done(null, profile);
    }));
    
    logger.info('✅ OAuth2 Discord configurado com sucesso');
} else {
    logger.warn('⚠️  OAuth2 desabilitado - CLIENT_SECRET não encontrado. Dashboard funcionando em modo somente leitura');
}

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Middleware de autenticação
function requireAuth(req, res, next) {
    // Require an explicit local bypass flag to enable development simulation.
    // This prevents accidental bypass in environments where NODE_ENV may be unset.
    const allowLocalBypass = process.env.ALLOW_LOCAL_AUTH_BYPASS === 'true';
    if (allowLocalBypass) {
        logger.info('🔧 ALLOW_LOCAL_AUTH_BYPASS enabled: simulating authenticated user');
        req.user = {
            id: '381762006329589760', // ID de teste válido (snowflake)
            username: 'Developer',
            discriminator: '0001',
            avatar: null,
            guilds: ['1333820000791691284'] // Guild ID real
        };
        return next();
    }

    // Fall back to Passport session authentication
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }

    // Not authenticated - redirect to Discord login
    res.redirect('/login');
}

// Middleware para verificar acesso ao servidor
function requireServerAccess(req, res, next) {
    try {
        // Allow explicit local bypass when developing locally
        const allowLocalBypass = process.env.ALLOW_LOCAL_AUTH_BYPASS === 'true';
        if (allowLocalBypass) {
            logger.info('🔧 ALLOW_LOCAL_AUTH_BYPASS enabled: bypassing server access check');
            return next();
        }

        logger.debug('🔐 Verificando acesso ao servidor para: %s', req.user?.username || 'Usuário desconhecido');

        if (!req.user) {
            logger.warn('❌ Usuário não encontrado, redirecionando para login');
            return res.redirect('/login');
        }

        // Para desenvolvimento, permitir todos os usuários autenticados
        // TODO: Implementar verificação real dos servidores onde o bot está presente
        logger.info('✅ Usuário autenticado, permitindo acesso');
        next();
    } catch (error) {
        logger.error('❌ Erro no middleware requireServerAccess:', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro de autenticação', details: error.message });
    }
}

// Servir ficheiros estáticos apenas para recursos públicos
// Defensive middleware: block accidental serving of backup or temporary
// public files (e.g. files containing "backup" or ending with ".bak").
// This prevents stale or debug pages from being served in production or
// by accident while we audit and clean the public folder.
app.use((req, res, next) => {
    try {
        const p = (req.path || '').toLowerCase();
        if (!p) return next();
        const isBackup = p.includes('backup') || p.endsWith('.bak') || p.includes('_backup') || p.includes('original-backup') || /\bbackup\b/.test(p);
        if (isBackup) {
            logger.warn('🚫 Blocked request to public backup/temporary file', { path: req.path });
            return res.status(404).send('Not Found');
        }
    } catch (e) {
        // If anything weird happens, don't block the request; fail open.
        logger.warn('Backup-block middleware error, continuing', { error: e && e.message ? e.message : e });
    }
    next();
});

app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Rotas de autenticação Discord
app.get('/auth/discord', (req, res) => {
    if (!config.DISCORD.CLIENT_SECRET) {
    logger.warn('⚠️  OAuth2 não disponível - redirecionando para login alternativo');
        return res.redirect('/login?error=oauth_disabled');
    }
    passport.authenticate('discord')(req, res);
});

app.get('/auth/discord/callback',
    (req, res, next) => {
        if (!config.DISCORD.CLIENT_SECRET) {
            logger.warn('⚠️  OAuth2 callback solicitado mas CLIENT_SECRET não disponível');
            return res.redirect('/login?error=oauth_disabled');
        }
        
        passport.authenticate('discord', { failureRedirect: '/login' }, (err, user, info) => {
            // Extra debug information to help diagnose why auth may return to login
            try {
                logger.debug('\u2139 OAuth2 callback invoked', { query: req.query, body: req.body, info });
            } catch (logErr) {
                logger.warn('Failed to log OAuth2 callback debug info', { error: logErr && logErr.message ? logErr.message : logErr });
            }

            if (err) {
                logger.error('\u274c Erro OAuth2 detalhado', { error: err && err.message ? err.message : err, name: err && err.name, info });
                return res.redirect('/login?error=oauth_error');
            }
            if (!user) {
                logger.warn('\u274c Usu\u00e1rio n\u00e3o encontrado ap\u00f3s OAuth2', { info });
                return res.redirect('/login?error=user_not_found');
            }
            req.logIn(user, (loginErr) => {
                if (loginErr) {
                    logger.error('\u274c Erro ao fazer login', { error: loginErr && loginErr.message ? loginErr.message : loginErr, info });
                    return res.redirect('/login?error=login_error');
                }

                // Save session and ensure cookie headers are set before redirecting
                try {
                    logger.debug('Saving session and dumping request cookies/headers for debug', { cookies: req.headers.cookie, headers: req.headers });
                } catch (e) { /* noop */ }

                req.session.save((saveErr) => {
                    if (saveErr) {
                        logger.warn('Session save returned error before redirect', { error: saveErr && saveErr.message ? saveErr.message : saveErr });
                        // Fall back to redirect anyway
                        return res.redirect('/dashboard');
                    }
                    logger.info('\u2705 OAuth2 callback bem-sucedido para: %s (session saved)', user.username);
                    return res.redirect('/dashboard');
                });
            });
        })(req, res, next);
    }
);

// Rota de logout
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            logger.error('Erro no logout', { error: err && err.message ? err.message : err });
        }
        req.session.destroy((err) => {
            if (err) {
                logger.error('Erro ao destruir sessão', { error: err && err.message ? err.message : err });
            }
            res.redirect('/login');
        });
    });
});

// Página de login
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Dashboard (protegido)
app.get('/dashboard', requireAuth, requireServerAccess, (req, res) => {
    try {
        logger.info('📊 Usuário acessando dashboard: %s', req.user?.username || 'Desconhecido');
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    } catch (error) {
        logger.error('❌ Erro no dashboard', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// Páginas de teste (desenvolvimento)
app.get('/debug.html', requireAuth, (req, res) => {
    try {
        logger.info('🔧 Usuário acessando debug: %s', req.user?.username || 'Developer');
        res.sendFile(path.join(__dirname, 'public', 'debug.html'));
    } catch (error) {
        logger.error('❌ Erro no debug', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

app.get('/test-api.html', requireAuth, (req, res) => {
    try {
        logger.info('🧪 Usuário acessando test-api: %s', req.user?.username || 'Developer');
        res.sendFile(path.join(__dirname, 'public', 'test-api.html'));
    } catch (error) {
        logger.error('❌ Erro no test-api', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

app.get('/simple-test.html', requireAuth, (req, res) => {
    try {
        logger.info('🔧 Usuário acessando simple-test: %s', req.user?.username || 'Developer');
        res.sendFile(path.join(__dirname, 'public', 'simple-test.html'));
    } catch (error) {
        logger.error('❌ Erro no simple-test', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

app.get('/dashboard-fixed.html', requireAuth, requireServerAccess, (req, res) => {
    try {
        logger.info('🔧 Usuário acessando dashboard-fixed: %s', req.user?.username || 'Developer');
        res.sendFile(path.join(__dirname, 'public', 'dashboard-fixed.html'));
    } catch (error) {
        logger.error('❌ Erro no dashboard-fixed', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// Admin guild config page (protected)
app.get('/admin-guild-config.html', requireAuth, requireServerAccess, (req, res) => {
    try {
        logger.info('Usuário acessando admin-guild-config: %s', req.user?.username || 'Developer');
        res.sendFile(path.join(__dirname, 'public', 'admin-guild-config.html'));
    } catch (error) {
        logger.error('Erro ao servir admin-guild-config', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno ao servir página' });
    }
});

// Admin: list of guilds
app.get('/admin-guilds.html', requireAuth, requireServerAccess, (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'admin-guilds.html'));
    } catch (e) {
        logger.error('Erro ao servir admin-guilds', { error: e && e.message ? e.message : e });
        res.status(500).send('Erro');
    }
});

// Admin: moderation UI
app.get('/admin-moderation.html', requireAuth, requireServerAccess, (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'admin-moderation.html'));
    } catch (e) {
        logger.error('Erro ao servir admin-moderation', { error: e && e.message ? e.message : e });
        res.status(500).send('Erro');
    }
});

// Admin: channels UI
app.get('/admin-channels.html', requireAuth, requireServerAccess, (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'admin-channels.html'));
    } catch (e) {
        logger.error('Erro ao servir admin-channels', { error: e && e.message ? e.message : e });
        res.status(500).send('Erro');
    }
});

// Admin: roles UI
app.get('/admin-roles.html', requireAuth, requireServerAccess, (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'admin-roles.html'));
    } catch (e) {
        logger.error('Erro ao servir admin-roles', { error: e && e.message ? e.message : e });
        res.status(500).send('Erro');
    }
});

// Admin: webhooks UI
app.get('/admin-webhooks.html', requireAuth, requireServerAccess, (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'admin-webhooks.html'));
    } catch (e) {
        logger.error('Erro ao servir admin-webhooks', { error: e && e.message ? e.message : e });
        res.status(500).send('Erro');
    }
});

// Tickets page (protected)
app.get('/tickets.html', requireAuth, requireServerAccess, (req, res) => {
    try {
        logger.info('\ud83d\udcc3 Usu\u00e1rio acessando tickets: %s', req.user?.username || 'Developer');
        res.sendFile(path.join(__dirname, 'public', 'tickets.html'));
    } catch (error) {
        logger.error('\u274c Erro ao servir tickets.html', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// Simple debug endpoint to verify server routing
app.get('/tickets-debug', (req, res) => {
    logger.info('tickets-debug accessed, headers: %o', { host: req.get('host'), referer: req.get('referer') });
    res.status(200).send('tickets-debug-ok');
});

// Development-only unauthenticated route to quickly test the tickets page
if (process.env.NODE_ENV !== 'production') {
    app.get('/dev/tickets.html', (req, res) => {
        try {
            logger.info('Serving /dev/tickets.html (dev-only)');
            res.sendFile(path.join(__dirname, 'public', 'tickets.html'));
        } catch (err) {
            logger.error('Error serving /dev/tickets.html', { error: err && err.message ? err.message : err });
            res.status(500).send('dev route error');
        }
    });
}

// Middleware CSRF para rotas autenticadas que modificam dados
const csrfMiddleware = csrfProtection.middleware();

// Importar e usar rotas de API
// We wrap route mounting in a promise so we can delay server.listen until routes are mounted.
let routesReady = Promise.resolve();
try {
    // Prefer CommonJS require when possible
    const apiFactory = require('./routes/api');
    const apiRoutes = typeof apiFactory === 'function' ? apiFactory(db) : apiFactory;
    app.use('/api', apiRoutes);
    logger.info('✅ API routes mounted via require');
} catch (err) {
    // If the routes module is an ESM graph with top-level await, fall back to dynamic import
    if (err && err.code === 'ERR_REQUIRE_ASYNC_MODULE') {
        logger.warn('Require failed for API routes due to ESM top-level await, falling back to dynamic import');
        routesReady = (async () => {
            try {
                const imported = await import('./routes/api.js');
                const factory = imported.default || imported;
                const routes = typeof factory === 'function' ? factory(db) : factory;
                app.use('/api', routes);
                logger.info('✅ API routes imported via dynamic import');
            } catch (impErr) {
                logger.error('❌ Failed to import API routes dynamically', { error: impErr && impErr.message ? impErr.message : impErr, stack: impErr && impErr.stack });
                throw impErr;
            }
        })();
    } else {
        // Unexpected error - rethrow
        throw err;
    }
}

// API para obter token CSRF
app.get('/api/csrf-token', requireAuth, (req, res) => {
    try {
        const token = req.csrfToken();
        res.json({ csrfToken: token });
    } catch (error) {
        logger.error('Erro ao gerar token CSRF', { error: error && error.message ? error.message : error });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// API para obter dados do usuário
app.get('/api/user', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            discriminator: req.user.discriminator,
            avatar: req.user.avatar ? 
                `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` :
                'https://cdn.discordapp.com/embed/avatars/0.png'
        }
    });
});

// API para obter servidores do usuário
app.get('/api/guilds', requireAuth, async (req, res) => {
    try {
        logger.info('📡 API /api/guilds chamada por: %s', req.user?.username);
        
        // Verificar se o bot está conectado
        if (!global.discordClient || !global.discordClient.isReady()) {
            logger.warn('⚠️ Bot Discord não está conectado');
            return res.json({
                success: true,
                guilds: [{
                    id: config.guildId,
                    name: config.serverName,
                    icon: null,
                    permissions: ['ADMINISTRATOR'],
                    botPresent: false,
                    memberCount: '?'
                }]
            });
        }

        // Obter dados reais do servidor
        const guild = global.discordClient.guilds.cache.get(config.guildId);
        if (!guild) {
            logger.warn('⚠️ Servidor não encontrado no cache do bot');
            return res.json({
                success: true,
                guilds: [{
                    id: config.guildId,
                    name: config.serverName,
                    icon: null,
                    permissions: ['ADMINISTRATOR'],
                    botPresent: false,
                    memberCount: '?'
                }]
            });
        }

        // Obter contagem real de membros (excluindo bots)
        const members = guild.members.cache;
        const humanMembers = members.filter(member => !member.user.bot);
        const botMembers = members.filter(member => member.user.bot);
        
        const guilds = [{
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            permissions: ['ADMINISTRATOR'],
            botPresent: true,
            memberCount: humanMembers.size,
            botCount: botMembers.size,
            totalMembers: members.size,
            channelCount: guild.channels.cache.size,
            roleCount: guild.roles.cache.size
        }];
        
    logger.info(`✅ Dados reais do servidor: ${humanMembers.size} membros humanos, ${botMembers.size} bots`);
        res.json({
            success: true,
            guilds: guilds
        });
    } catch (error) {
    logger.error('❌ Erro ao obter guilds:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para obter canais do servidor
app.get('/api/server/:serverId/channels', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
    logger.info(`📺 API channels para servidor ${serverId} por: ${req.user?.username}`);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            // Fallback: usar Discord REST API
            logger.warn('⚠️ Bot offline, usando Discord REST API');
            return await getChannelsViaREST(serverId, req, res);
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            logger.warn('⚠️ Servidor não encontrado no cache, tentando REST API');
            return await getChannelsViaREST(serverId, req, res);
        }

        // Obter todos os canais do servidor
        const channels = guild.channels.cache
            .filter(channel => channel.type === 0 || channel.type === 2) // Text e Voice channels
            .map(channel => ({
                id: channel.id,
                name: channel.name,
                type: channel.type === 0 ? 'text' : 'voice',
                category: channel.parent ? channel.parent.name : 'Sem categoria',
                position: channel.position,
                permissionsFor: channel.permissionsFor(guild.members.me)?.has('ManageMessages') || false
            }))
            .sort((a, b) => a.position - b.position);

    logger.info(`✅ ${channels.length} canais encontrados`);
        res.json({
            success: true,
            channels: channels
        });
    } catch (error) {
    logger.error('❌ Erro ao obter canais:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// Função para buscar canais via Discord REST API
async function getChannelsViaREST(serverId, req, res) {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || config.token);
        
        // Buscar canais via REST API
        const channels = await rest.get(Routes.guildChannels(serverId));
        
        const filteredChannels = channels
            .filter(channel => channel.type === 0 || channel.type === 2)
            .map(channel => ({
                id: channel.id,
                name: channel.name,
                type: channel.type === 0 ? 'text' : 'voice',
                category: channel.parent_id ? 'Categoria' : 'Sem categoria',
                position: channel.position || 0,
                permissionsFor: true // Assumir permissões para REST API
            }))
            .sort((a, b) => a.position - b.position);

    logger.info(`✅ REST API: ${filteredChannels.length} canais encontrados`);
        res.json({
            success: true,
            channels: filteredChannels
        });
    } catch (error) {
    logger.error('❌ Erro REST API para canais:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ 
            error: 'Erro ao buscar canais', 
            details: 'Bot offline e REST API falhou',
            fallback: true
        });
    }
}

// API para obter roles do servidor
app.get('/api/server/:serverId/roles', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
    logger.info(`👑 API roles para servidor ${serverId} por: ${req.user?.username}`);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            // Fallback: usar Discord REST API
            logger.warn('⚠️ Bot offline, usando Discord REST API para roles');
            return await getRolesViaREST(serverId, req, res);
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            logger.warn('⚠️ Servidor não encontrado, tentando REST API para roles');
            return await getRolesViaREST(serverId, req, res);
        }

        // Obter todos os roles do servidor (excluindo @everyone)
        const roles = guild.roles.cache
            .filter(role => role.id !== guild.id) // Excluir @everyone
            .map(role => ({
                id: role.id,
                name: role.name,
                color: role.color,
                position: role.position,
                permissions: role.permissions.toArray(),
                mentionable: role.mentionable,
                hoist: role.hoist,
                managed: role.managed,
                memberCount: role.members.size
            }))
            .sort((a, b) => b.position - a.position);

    logger.info(`✅ ${roles.length} roles encontrados`);
        res.json({
            success: true,
            roles: roles
        });
    } catch (error) {
    logger.error('❌ Erro ao obter roles:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// Função para buscar roles via Discord REST API
async function getRolesViaREST(serverId, req, res) {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || config.token);
        
        // Buscar roles via REST API
        const roles = await rest.get(Routes.guildRoles(serverId));
        
        const filteredRoles = roles
            .filter(role => role.id !== serverId) // Excluir @everyone
            .map(role => ({
                id: role.id,
                name: role.name,
                color: role.color || 0,
                position: role.position || 0,
                permissions: [], // Simplificado para REST API
                mentionable: role.mentionable || false,
                hoist: role.hoist || false,
                managed: role.managed || false,
                memberCount: 0 // Não disponível via REST API básica
            }))
            .sort((a, b) => b.position - a.position);

    logger.info(`✅ REST API: ${filteredRoles.length} roles encontrados`);
        res.json({
            success: true,
            roles: filteredRoles
        });
    } catch (error) {
    logger.error('❌ Erro REST API para roles:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ 
            error: 'Erro ao buscar roles', 
            details: 'Bot offline e REST API falhou',
            fallback: true
        });
    }
}

// =======================
// APIs DE CONFIGURAÇÃO
// =======================

// Salvar configuração de canal de boas-vindas
app.post('/api/config/welcome', requireAuth, async (req, res) => {
    try {
        const { guildId, channelId } = req.body;
    logger.info(`💫 Configurando canal de boas-vindas: ${channelId} para servidor: ${guildId}`);
        
        if (!guildId || !channelId) {
            return res.status(400).json({ 
                success: false, 
                error: 'GuildId e channelId são obrigatórios' 
            });
        }
        
        res.json({
            success: true,
            message: 'Canal de boas-vindas configurado com sucesso'
        });
    } catch (error) {
    logger.error('Erro ao configurar canal de boas-vindas:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});

// Salvar configuração de canal de logs
app.post('/api/config/logs', requireAuth, async (req, res) => {
    try {
        const { guildId, channelId } = req.body;
    logger.info(`📋 Configurando canal de logs: ${channelId} para servidor: ${guildId}`);
        
        if (!guildId || !channelId) {
            return res.status(400).json({ 
                success: false, 
                error: 'GuildId e channelId são obrigatórios' 
            });
        }
        
        res.json({
            success: true,
            message: 'Canal de logs configurado com sucesso'
        });
    } catch (error) {
    logger.error('Erro ao configurar canal de logs:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});

// Salvar configuração de cargo automático
app.post('/api/config/autorole', requireAuth, async (req, res) => {
    try {
        const { guildId, roleId } = req.body;
    logger.info(`👑 Configurando cargo automático: ${roleId} para servidor: ${guildId}`);
        
        if (!guildId || !roleId) {
            return res.status(400).json({ 
                success: false, 
                error: 'GuildId e roleId são obrigatórios' 
            });
        }
        
        res.json({
            success: true,
            message: 'Cargo automático configurado com sucesso'
        });
    } catch (error) {
    logger.error('Erro ao configurar cargo automático:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});

// Configurar filtros automáticos
app.post('/api/moderation/settings', requireAuth, async (req, res) => {
    try {
        const { guildId, settings } = req.body;
    logger.info(`🛡️ Configurando filtros automáticos para servidor: ${guildId}`, settings);
        
        if (!guildId || !settings) {
            return res.status(400).json({ 
                success: false, 
                error: 'GuildId e settings são obrigatórios' 
            });
        }
        
        res.json({
            success: true,
            message: 'Filtros automáticos configurados com sucesso',
            settings: settings
        });
    } catch (error) {
    logger.error('Erro ao configurar filtros:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
});

// API para limpar mensagens de um canal
app.post('/api/server/:serverId/channels/:channelId/clear', requireAuth, async (req, res) => {
    try {
        const { serverId, channelId } = req.params;
        const { amount = 10, filterType = 'all' } = req.body;
        
    logger.info(`🧹 Limpeza de canal ${channelId} no servidor ${serverId} por: ${req.user?.username}`);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            return res.status(503).json({ error: 'Bot Discord não está conectado' });
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }

        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            return res.status(404).json({ error: 'Canal não encontrado' });
        }

        if (channel.type !== 0) {
            return res.status(400).json({ error: 'Só é possível limpar canais de texto' });
        }

        // Verificar permissões
        const botPermissions = channel.permissionsFor(guild.members.me);
        if (!botPermissions?.has('ManageMessages')) {
            return res.status(403).json({ error: 'Bot não tem permissão para gerenciar mensagens neste canal' });
        }

        // Limitar quantidade
        const maxAmount = Math.min(amount, 100);
        
        // Buscar mensagens
        const messages = await channel.messages.fetch({ limit: maxAmount });
        
        // Filtrar mensagens se necessário
        let messagesToDelete = messages;
        if (filterType === 'bots') {
            messagesToDelete = messages.filter(msg => msg.author.bot);
        } else if (filterType === 'users') {
            messagesToDelete = messages.filter(msg => !msg.author.bot);
        }

        // Deletar mensagens (Discord permite bulk delete apenas para mensagens com menos de 14 dias)
        const deletedCount = await channel.bulkDelete(messagesToDelete, true);

    logger.info(`✅ ${deletedCount.size} mensagens deletadas do canal ${channel.name}`);
        res.json({
            success: true,
            deletedCount: deletedCount.size,
            channelName: channel.name,
            filterType: filterType
        });

    } catch (error) {
    logger.error('❌ Erro ao limpar canal:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para desbanir todos os usuários
app.post('/api/server/:serverId/unban-all', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
    logger.info(`🔓 Desbanir todos no servidor ${serverId} por: ${req.user?.username}`);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            return res.status(503).json({ error: 'Bot Discord não está conectado' });
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }

        // Verificar permissões
        const botPermissions = guild.members.me.permissions;
        if (!botPermissions.has('BanMembers')) {
            return res.status(403).json({ error: 'Bot não tem permissão para gerenciar banimentos' });
        }

        // Obter lista de banimentos
        const bans = await guild.bans.fetch();
        
        if (bans.size === 0) {
            return res.json({
                success: true,
                message: 'Não há usuários banidos para desbanir',
                unbannedCount: 0
            });
        }

        let unbannedCount = 0;
        const errors = [];

        // Desbanir todos os usuários
        for (const ban of bans.values()) {
            try {
                await guild.members.unban(ban.user.id, `Desbanimento em massa via dashboard por ${req.user?.username}`);
                unbannedCount++;
            } catch (error) {
                errors.push(`Erro ao desbanir ${ban.user.tag}: ${error.message}`);
            }
        }

    logger.info(`✅ ${unbannedCount} usuários desbanidos`);
        res.json({
            success: true,
            unbannedCount: unbannedCount,
            totalBans: bans.size,
            errors: errors
        });

    } catch (error) {
    logger.error('❌ Erro ao desbanir todos:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para bloquear/desbloquear servidor
app.post('/api/server/:serverId/lock', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        const { lock = true, reason = 'Bloqueio via dashboard' } = req.body;
        
    logger.info(`🔒 ${lock ? 'Bloquear' : 'Desbloquear'} servidor ${serverId} por: ${req.user?.username}`);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            return res.status(503).json({ error: 'Bot Discord não está conectado' });
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }

        // Verificar permissões
        const botPermissions = guild.members.me.permissions;
        if (!botPermissions.has('ManageRoles') || !botPermissions.has('ManageChannels')) {
            return res.status(403).json({ error: 'Bot não tem permissões suficientes para bloquear o servidor' });
        }

        const everyoneRole = guild.roles.everyone;
        let modifiedChannels = 0;
        const errors = [];

        // Modificar permissões de todos os canais de texto
        const textChannels = guild.channels.cache.filter(channel => channel.type === 0);
        
        for (const channel of textChannels.values()) {
            try {
                if (lock) {
                    // Remover permissão de enviar mensagens do @everyone
                    await channel.permissionOverwrites.edit(everyoneRole, {
                        SendMessages: false,
                        AddReactions: false
                    }, { reason: `${reason} - por ${req.user?.username}` });
                } else {
                    // Restaurar permissões (remover override)
                    await channel.permissionOverwrites.delete(everyoneRole, { reason: `Desbloqueio via dashboard - por ${req.user?.username}` });
                }
                modifiedChannels++;
            } catch (error) {
                errors.push(`Erro no canal ${channel.name}: ${error.message}`);
            }
        }

    logger.info(`✅ Servidor ${lock ? 'bloqueado' : 'desbloqueado'}: ${modifiedChannels} canais modificados`);
        res.json({
            success: true,
            action: lock ? 'locked' : 'unlocked',
            modifiedChannels: modifiedChannels,
            totalChannels: textChannels.size,
            errors: errors
        });

    } catch (error) {
    logger.error('❌ Erro ao bloquear/desbloquear servidor:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para dar timeout em usuário
app.post('/api/server/:serverId/timeout', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        const { userId, duration = 60, reason = 'Timeout via dashboard' } = req.body;
        
    logger.info(`⏰ Timeout usuário ${userId} no servidor ${serverId} por: ${req.user?.username}`);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            return res.status(503).json({ error: 'Bot Discord não está conectado' });
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }

        // Verificar permissões
        const botPermissions = guild.members.me.permissions;
        if (!botPermissions.has('ModerateMembers')) {
            return res.status(403).json({ error: 'Bot não tem permissão para dar timeout em membros' });
        }

        // Buscar membro
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return res.status(404).json({ error: 'Usuário não encontrado no servidor' });
        }

        // Verificar se o bot pode dar timeout neste membro
        if (!member.moderatable) {
            return res.status(403).json({ error: 'Não é possível dar timeout neste usuário (cargo superior ao bot)' });
        }

        // Calcular duração em milissegundos
        const durationMs = duration * 60 * 1000; // converter minutos para ms
        const timeoutUntil = new Date(Date.now() + durationMs);

        // Aplicar timeout
        await member.timeout(durationMs, `${reason} - por ${req.user?.username}`);

    logger.info(`✅ Timeout aplicado em ${member.user.tag} por ${duration} minutos`);
        res.json({
            success: true,
            user: {
                id: member.user.id,
                tag: member.user.tag,
                avatar: member.user.displayAvatarURL()
            },
            duration: duration,
            timeoutUntil: timeoutUntil,
            reason: reason
        });

    } catch (error) {
    logger.error('❌ Erro ao dar timeout:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para expulsar usuário
app.post('/api/server/:serverId/kick', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        const { userId, reason = 'Expulsão via dashboard' } = req.body;
        
    logger.info(`👢 Expulsar usuário ${userId} do servidor ${serverId} por: ${req.user?.username}`);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            return res.status(503).json({ error: 'Bot Discord não está conectado' });
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }

        // Verificar permissões
        const botPermissions = guild.members.me.permissions;
        if (!botPermissions.has('KickMembers')) {
            return res.status(403).json({ error: 'Bot não tem permissão para expulsar membros' });
        }

        // Buscar membro
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return res.status(404).json({ error: 'Usuário não encontrado no servidor' });
        }

        // Verificar se o bot pode expulsar este membro
        if (!member.kickable) {
            return res.status(403).json({ error: 'Não é possível expulsar este usuário (cargo superior ao bot)' });
        }

        // Salvar informações antes da expulsão
        const userInfo = {
            id: member.user.id,
            tag: member.user.tag,
            avatar: member.user.displayAvatarURL(),
            joinedAt: member.joinedAt
        };

        // Expulsar membro
        await member.kick(`${reason} - por ${req.user?.username}`);

    logger.info(`✅ ${userInfo.tag} foi expulso do servidor`);
        res.json({
            success: true,
            user: userInfo,
            reason: reason
        });

    } catch (error) {
    logger.error('❌ Erro ao expulsar usuário:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para banir usuário
app.post('/api/server/:serverId/ban', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        const { userId, reason = 'Banimento via dashboard', deleteMessageDays = 0, duration = 0 } = req.body;
        
    logger.info(`🔨 Banir usuário ${userId} do servidor ${serverId} por: ${req.user?.username}`);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            return res.status(503).json({ error: 'Bot Discord não está conectado' });
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }

        // Verificar permissões
        const botPermissions = guild.members.me.permissions;
        if (!botPermissions.has('BanMembers')) {
            return res.status(403).json({ error: 'Bot não tem permissão para banir membros' });
        }

        // Buscar membro (pode não estar no servidor)
        const member = await guild.members.fetch(userId).catch(() => null);
        let userInfo;

        if (member) {
            // Verificar se o bot pode banir este membro
            if (!member.bannable) {
                return res.status(403).json({ error: 'Não é possível banir este usuário (cargo superior ao bot)' });
            }
            
            userInfo = {
                id: member.user.id,
                tag: member.user.tag,
                avatar: member.user.displayAvatarURL(),
                joinedAt: member.joinedAt
            };
        } else {
            // Tentar buscar usuário pelo ID (pode não estar no servidor)
            try {
                const user = await global.discordClient.users.fetch(userId);
                userInfo = {
                    id: user.id,
                    tag: user.tag,
                    avatar: user.displayAvatarURL(),
                    joinedAt: null
                };
            } catch {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
        }

        // Banir usuário
        await guild.members.ban(userId, {
            reason: `${reason} - por ${req.user?.username}`,
            deleteMessageDays: Math.min(deleteMessageDays, 7) // Max 7 days
        });

        // Se for banimento temporário, agendar desbanimento (seria melhor usar um sistema de jobs)
        let unbanAt = null;
        if (duration > 0) {
            unbanAt = new Date(Date.now() + duration * 60 * 1000);
            // TODO: Implementar sistema de agendamento para desbanimento automático
        }

    logger.info(`✅ ${userInfo.tag} foi banido do servidor`);
        res.json({
            success: true,
            user: userInfo,
            reason: reason,
            deleteMessageDays: deleteMessageDays,
            duration: duration,
            unbanAt: unbanAt
        });

    } catch (error) {
    logger.error('❌ Erro ao banir usuário:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para buscar membros do servidor
app.get('/api/server/:serverId/members', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        const { search = '', limit = 50 } = req.query;
        
    logger.info(`👥 Buscar membros no servidor ${serverId} por: ${req.user?.username}`);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            return res.status(503).json({ error: 'Bot Discord não está conectado' });
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }

        // Buscar todos os membros se o cache não estiver completo
        if (guild.members.cache.size < guild.memberCount) {
            await guild.members.fetch();
        }

        let members = guild.members.cache
            .filter(member => !member.user.bot) // Filtrar bots
            .map(member => ({
                id: member.user.id,
                tag: member.user.tag,
                displayName: member.displayName,
                avatar: member.user.displayAvatarURL({ size: 64 }),
                joinedAt: member.joinedAt,
                roles: member.roles.cache
                    .filter(role => role.id !== guild.id) // Remover @everyone
                    .map(role => ({ id: role.id, name: role.name, color: role.hexColor }))
                    .slice(0, 3), // Limitar a 3 cargos principais
                isOwner: member.id === guild.ownerId,
                kickable: member.kickable,
                bannable: member.bannable,
                moderatable: member.moderatable
            }));

        // Filtrar por busca se especificado
        if (search) {
            const searchLower = search.toLowerCase();
            members = members.filter(member => 
                member.tag.toLowerCase().includes(searchLower) ||
                member.displayName.toLowerCase().includes(searchLower)
            );
        }

        // Limitar resultados
        members = members.slice(0, parseInt(limit));

    logger.info(`✅ Enviados ${members.length} membros`);
        res.json({
            success: true,
            members: members,
            total: guild.memberCount
        });

    } catch (error) {
    logger.error('❌ Erro ao buscar membros:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para obter estatísticas detalhadas do servidor
app.get('/api/server/:serverId/stats', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
    logger.info(`📊 API stats para servidor ${serverId} por: ${req.user?.username}`);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            return res.status(503).json({ error: 'Bot Discord não está conectado' });
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }

        // Obter estatísticas reais
        const members = guild.members.cache;
        const channels = guild.channels.cache;
        const roles = guild.roles.cache;

        // Filtrar membros humanos (não bots)
        const humanMembers = members.filter(member => !member.user.bot);
        const botMembers = members.filter(member => member.user.bot);

        // Estatísticas de canais por tipo
        const textChannels = channels.filter(channel => channel.type === 0);
        const voiceChannels = channels.filter(channel => channel.type === 2);
        const categoryChannels = channels.filter(channel => channel.type === 4);

        // Simular contagem de mensagens (seria necessário uma base de dados para valores reais)
        const estimatedMessages = Math.floor(humanMembers.size * Math.random() * 100) + 100;

        const stats = {
            members: {
                total: members.size,
                humans: humanMembers.size,
                bots: botMembers.size,
                online: members.filter(member => member.presence?.status === 'online').size
            },
            channels: {
                total: channels.size,
                text: textChannels.size,
                voice: voiceChannels.size,
                categories: categoryChannels.size
            },
            roles: {
                total: roles.size - 1, // -1 para excluir @everyone
                colored: roles.filter(role => role.color !== 0).size
            },
            messages: {
                estimated: estimatedMessages
            },
            server: {
                name: guild.name,
                icon: guild.icon,
                createdAt: guild.createdAt,
                memberCount: guild.memberCount,
                premiumTier: guild.premiumTier,
                premiumSubscriptionCount: guild.premiumSubscriptionCount
            }
        };

    logger.info(`✅ Estatísticas enviadas: ${stats.members.humans} membros humanos`);
        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
    logger.error('❌ Erro ao obter estatísticas:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para configurações do bot (legacy - manter para compatibilidade)
app.get('/api/config', requireAuth, requireServerAccess, (req, res) => {
    try {
        const safeConfig = {
            channels: {
                updates: config.channels.updates
            }
        };
        res.json({ success: true, config: safeConfig });
    } catch (error) {
    logger.error('Erro ao carregar configuração:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro ao carregar configuração' });
    }
});

// API para atualizar configurações (legacy - manter para compatibilidade)
app.post('/api/config', requireAuth, requireServerAccess, (req, res) => {
    try {
        const { channels } = req.body;
        
        if (channels && channels.updates) {
            config.channels.updates = channels.updates;
        }
        
        fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(config, null, 2));
        
        res.json({ success: true, message: 'Configuração atualizada com sucesso!' });
    } catch (error) {
    logger.error('Erro ao atualizar configuração:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro ao atualizar configuração' });
    }
});

// === SISTEMA DE LOGS EM TEMPO REAL ===

// Array para armazenar clientes SSE conectados
const sseClients = new Map();

// API para logs via Server-Sent Events (SSE) - Versão sem auth para compatibilidade com EventSource
app.get('/api/logs/stream', (req, res) => {
    logger.debug('EventSource endpoint /api/logs/stream acessado');
    logger.info('Cliente SSE conectado para logs');
    
    // Configurar headers SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': req.get('origin') || '*',
        'Access-Control-Allow-Credentials': 'true'
    });

    logger.debug('Headers SSE configurados');

    // Identificador único para o cliente
    const clientId = Date.now() + Math.random();
    
    // Adicionar cliente à lista
    sseClients.set(clientId, {
        response: res,
        userId: req.user?.id || 'anonymous',
        username: req.user?.username || 'Anonymous',
        connectedAt: new Date()
    });

    logger.debug(`Cliente ${clientId} adicionado. Total de clientes: ${sseClients.size}`);

    // Enviar evento de conexão
    res.write(`data: ${JSON.stringify({
        type: 'connected',
        message: 'Conectado ao stream de logs',
        timestamp: new Date().toISOString()
    })}\n\n`);

    logger.debug('Mensagem de conexão enviada');

    // Enviar logs recentes (últimos 50)
    sendRecentLogs(res);

    // Cleanup quando cliente desconecta
    req.on('close', () => {
    logger.info('Cliente SSE desconectado');
        sseClients.delete(clientId);
    });

    req.on('error', () => {
        logger.error('Erro SSE cliente');
        sseClients.delete(clientId);
    });
});

// Função para enviar logs recentes
async function sendRecentLogs(res) {
    try {
        const recentLogs = await db.getRecentLogs(50);
        if (recentLogs && recentLogs.length > 0) {
            recentLogs.forEach(log => {
                res.write(`data: ${JSON.stringify({
                    type: 'log',
                    ...log,
                    timestamp: log.timestamp || new Date().toISOString()
                })}\n\n`);
            });
        } else {
            // Enviar mensagem indicando que não há logs
            res.write(`data: ${JSON.stringify({
                type: 'info',
                message: 'Nenhum log encontrado',
                level: 'info',
                timestamp: new Date().toISOString()
            })}\n\n`);
        }
    } catch (error) {
    logger.error('❌ Erro ao enviar logs recentes:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        // Enviar erro como log
        res.write(`data: ${JSON.stringify({
            type: 'error',
            message: 'Erro ao carregar logs: ' + error.message,
            level: 'error',
            timestamp: new Date().toISOString()
        })}\n\n`);
    }
}

// Função para broadcast de logs para todos os clientes SSE
function broadcastLog(logData) {
    const message = JSON.stringify({
        type: 'log',
        ...logData,
        timestamp: new Date().toISOString()
    });

    sseClients.forEach((client, clientId) => {
        try {
            client.response.write(`data: ${message}\n\n`);
        } catch (error) {
            logger.error('❌ Erro ao enviar log para cliente SSE:', { error: error && error.message ? error.message : error, stack: error && error.stack });
            sseClients.delete(clientId);
        }
    });
}

// ========================================
// ENDPOINT DE TESTE PARA GERAR LOGS
// ========================================

// Endpoint GET para gerar log de teste via browser
app.get('/api/test/generate-log', async (req, res) => {
    try {
        const testLog = {
            guild_id: '123456789',
            type: 'test',
            level: 'info',
            message: `🧪 Log de teste gerado em ${new Date().toLocaleString()}`,
            user_id: 'test-user',
            username: 'TestUser',
            channel_id: 'test-channel',
            channel_name: 'test-channel-name',
            details: { test: true, timestamp: new Date().toISOString() }
        };

        await db.addLog(testLog);
        
        // Broadcast para todos os clientes SSE
        broadcastLog(testLog);

        res.json({ success: true, message: 'Log de teste gerado', log: testLog });
    } catch (error) {
    logger.error('❌ Erro ao gerar log de teste:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro ao gerar log de teste' });
    }
});

// ========================================
// OUTRAS APIS DE LOGS
// ========================================

// API alternativa para logs via polling (fallback)
app.get('/api/logs', requireAuth, async (req, res) => {
    try {
        const { limit = 50, offset = 0, type, level } = req.query;
        
        const logs = await db.getLogs({
            limit: parseInt(limit),
            offset: parseInt(offset),
            type,
            level
        });

        res.json({
            success: true,
            logs,
            hasMore: logs.length === parseInt(limit)
        });
    } catch (error) {
    logger.error('❌ Erro ao buscar logs:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// API para limpar logs
app.delete('/api/logs', requireAuth, async (req, res) => {
    try {
        const { olderThan = 7 } = req.query; // Dias
        const deleted = await db.clearOldLogs(parseInt(olderThan));
        
        res.json({
            success: true,
            message: `${deleted} logs removidos`,
            deletedCount: deleted
        });
    } catch (error) {
    logger.error('❌ Erro ao limpar logs:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Função global para registrar logs (chamada pelo bot)
global.logToDatabase = async (logData) => {
    try {
        await db.addLog(logData);
        broadcastLog(logData);
    } catch (error) {
    logger.error('❌ Erro ao registrar log:', { error: error && error.message ? error.message : error, stack: error && error.stack });
    }
};

// API para enviar updates (legacy - manter para compatibilidade)
app.post('/api/send-update', requireAuth, requireServerAccess, async (req, res) => {
    try {
        const { title, description, color, imageUrl } = req.body;
        
        if (!title || !description) {
            return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
        }
        
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color || '#00ff00')
            .setTimestamp();
            
        if (imageUrl) {
            embed.setImage(imageUrl);
        }
        
        // Enviar via webhook se configurado
        if (config.webhook && config.webhook.url) {
            const webhook = new WebhookClient({ url: config.webhook.url });
            await webhook.send({ embeds: [embed] });
        }
        
        res.json({ success: true, message: 'Update enviado com sucesso!' });
    } catch (error) {
    logger.error('Erro ao enviar update:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        res.status(500).json({ error: 'Erro ao enviar update' });
    }
});

// Health check endpoints para monitoramento do bot
app.get('/health', (req, res) => {
    const isDiscordReady = global.discordClient && global.discordClient.isReady();
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    const healthStatus = {
        status: isDiscordReady ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: uptime,
        discord: {
            connected: isDiscordReady,
            ping: isDiscordReady ? global.discordClient.ws.ping : null,
            guilds: isDiscordReady ? global.discordClient.guilds.cache.size : 0
        },
        server: {
            port: PORT,
            environment: isProduction ? 'production' : 'development'
        },
        memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024)
        }
    };
    
    const statusCode = isDiscordReady ? 200 : 503;
    res.status(statusCode).json(healthStatus);
});

// Health check simples para o script de monitoramento
app.get('/ping', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        discord: global.discordClient && global.discordClient.isReady()
    });
});

// Status detalhado do bot para admin
app.get('/api/bot-status', requireAuth, (req, res) => {
    const isDiscordReady = global.discordClient && global.discordClient.isReady();
    
    if (!isDiscordReady) {
        return res.status(503).json({ 
            error: 'Bot Discord não está conectado',
            connected: false 
        });
    }
    
    const client = global.discordClient;
    const status = {
        connected: true,
        user: {
            id: client.user.id,
            tag: client.user.tag,
            avatar: client.user.displayAvatarURL()
        },
        stats: {
            ping: client.ws.ping,
            uptime: client.uptime,
            guilds: client.guilds.cache.size,
            users: client.users.cache.size,
            channels: client.channels.cache.size
        },
        memory: process.memoryUsage(),
        lastReady: client.readyAt
    };
    
    res.json(status);
});

// 404 handler
// 404 handler - improved logging for debugging
app.use((req, res) => {
    logger.warn('404 Not Found for path', { path: req.path, url: req.originalUrl, method: req.method });
    res.status(404).json({ error: 'Página não encontrada', path: req.path });
});

// Error handler
app.use((error, req, res, next) => {
    logger.error('Server error', { error: error && error.stack ? error.stack : error });
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// Routes - API routes are mounted earlier (dynamic import fallback handled above)
// (no-op here to avoid double-requiring the module which may use async initialization)

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        db.close();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        db.close();
        process.exit(0);
    });
});

// Iniciar servidor only after routes are mounted (routesReady may be a resolved promise)
(async () => {
    try {
        await routesReady;
        server.listen(PORT, () => {
            // Startup messages configurable via environment variables for deployments
            const defaultUrlMsg = `YSNM Dashboard rodando em http://localhost:${PORT}`;
            const urlMessage = process.env.STARTUP_URL_MESSAGE || defaultUrlMsg;
            const featuresDefault = ['Socket.IO habilitado', 'Sistema completo: Dashboard, Tickets, Analytics, Admin', 'Sistema de segurança ativo'];
            const featuresMessage = process.env.STARTUP_FEATURES_MESSAGE ? process.env.STARTUP_FEATURES_MESSAGE.split(';').map(s => s.trim()).filter(Boolean) : featuresDefault;

            logger.info(urlMessage, { callbackURL, environment: isProduction ? 'Produção' : 'Desenvolvimento' });
            featuresMessage.forEach(msg => logger.info(msg));
        });
    } catch (e) {
        logger.error('❌ Failed to mount routes - aborting startup', { error: e && e.message ? e.message : e, stack: e && e.stack });
        process.exit(1);
    }
})();

module.exports = { app, server, socketManager };
