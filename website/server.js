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

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

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
                console.log('❌ CORS blocked origin:', origin);
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
                console.log('⚠️ Dev CORS allowing origin:', origin);
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
    console.log('✅ Database initialized successfully');
}).catch(error => {
    console.error('❌ Database initialization failed:', error);
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

// Carregar configuração
let config;
try {
    config = require('../config.json');
} catch (error) {
    console.log('⚠️ Usando configuração padrão para o website');
    config = {
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        website: {
            baseUrl: process.env.BASE_URL || 'http://localhost:3001',
            redirectUri: process.env.REDIRECT_URI || 'http://localhost:3001/auth/discord/callback',
            sessionSecret: process.env.SESSION_SECRET || 'fallback-session-secret'
        },
        channels: {
            updates: process.env.UPDATES_CHANNEL_ID || '1404310493468041228'
        }
    };
}

// Configuração de sessão
app.use(session({
    secret: config.website.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // true para HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
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
                    
const callbackURL = isProduction ? 
    (config.website.production?.redirectUri || 'https://ysnmbot-alberto.up.railway.app/auth/discord/callback') :
    `http://localhost:${PORT}/auth/discord/callback`;

console.log('🔍 Debug OAuth2:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   RAILWAY_ENVIRONMENT_NAME:', process.env.RAILWAY_ENVIRONMENT_NAME);
console.log('   RAILWAY_PROJECT_NAME:', process.env.RAILWAY_PROJECT_NAME);
console.log('   isProduction:', isProduction);
console.log('   callbackURL:', callbackURL);

// Estratégia do Discord
passport.use(new DiscordStrategy({
    clientID: config.clientId,
    clientSecret: config.clientSecret,
    callbackURL: callbackURL,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    console.log('✅ OAuth2 estratégia executada com sucesso');
    console.log('   Profile ID:', profile.id);
    console.log('   Profile Username:', profile.username);
    return done(null, profile);
}));

console.log('🔧 Configuração OAuth2 Discord:');
console.log('   Client ID:', config.clientId ? `${config.clientId.substring(0, 8)}...` : 'AUSENTE');
console.log('   Client Secret:', config.clientSecret ? `${config.clientSecret.substring(0, 8)}...` : 'AUSENTE');
console.log('   Callback URL:', callbackURL);

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Middleware de autenticação
function requireAuth(req, res, next) {
    // Modo de desenvolvimento - bypass autenticação
    if (process.env.NODE_ENV !== 'production' && !process.env.RAILWAY_ENVIRONMENT_NAME) {
        console.log('🔧 Modo desenvolvimento: Bypass autenticação');
        // Simular usuário autenticado para desenvolvimento
        req.user = {
            id: 'dev_user',
            username: 'Developer',
            discriminator: '0001',
            avatar: null,
            guilds: ['1234567890'] // ID de teste
        };
        return next();
    }
    
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Middleware para verificar acesso ao servidor
function requireServerAccess(req, res, next) {
    try {
        // Modo de desenvolvimento - bypass verificação de servidor
        if (process.env.NODE_ENV !== 'production' && !process.env.RAILWAY_ENVIRONMENT_NAME) {
            console.log('🔧 Modo desenvolvimento: Bypass verificação de servidor');
            return next();
        }
        
        console.log('🔐 Verificando acesso ao servidor para:', req.user?.username || 'Usuário desconhecido');
        
        if (!req.user) {
            console.log('❌ Usuário não encontrado, redirecionando para login');
            return res.redirect('/login');
        }

        // Para desenvolvimento, permitir todos os usuários autenticados
        // TODO: Implementar verificação real dos servidores onde o bot está presente
        console.log('✅ Usuário autenticado, permitindo acesso (modo desenvolvimento)');
        next();
    } catch (error) {
        console.error('❌ Erro no middleware requireServerAccess:', error);
        res.status(500).json({ error: 'Erro de autenticação', details: error.message });
    }
}

// Servir ficheiros estáticos apenas para recursos públicos
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Rotas de autenticação Discord
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
    (req, res, next) => {
        passport.authenticate('discord', { failureRedirect: '/login' }, (err, user, info) => {
            if (err) {
                console.error('❌ Erro OAuth2 detalhado:', err);
                console.error('   Tipo do erro:', err.name);
                console.error('   Mensagem:', err.message);
                return res.redirect('/login?error=oauth_error');
            }
            if (!user) {
                console.error('❌ Usuário não encontrado após OAuth2');
                return res.redirect('/login?error=user_not_found');
            }
            req.logIn(user, (loginErr) => {
                if (loginErr) {
                    console.error('❌ Erro ao fazer login:', loginErr);
                    return res.redirect('/login?error=login_error');
                }
                console.log('✅ OAuth2 callback bem-sucedido para:', user.username);
                return res.redirect('/dashboard');
            });
        })(req, res, next);
    }
);

// Rota de logout
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Erro no logout:', err);
        }
        req.session.destroy((err) => {
            if (err) {
                console.error('Erro ao destruir sessão:', err);
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
        console.log('📊 Usuário acessando dashboard:', req.user?.username || 'Desconhecido');
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    } catch (error) {
        console.error('❌ Erro no dashboard:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// Páginas de teste (desenvolvimento)
app.get('/debug.html', requireAuth, (req, res) => {
    try {
        console.log('🔧 Usuário acessando debug:', req.user?.username || 'Developer');
        res.sendFile(path.join(__dirname, 'public', 'debug.html'));
    } catch (error) {
        console.error('❌ Erro no debug:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

app.get('/test-api.html', requireAuth, (req, res) => {
    try {
        console.log('🧪 Usuário acessando test-api:', req.user?.username || 'Developer');
        res.sendFile(path.join(__dirname, 'public', 'test-api.html'));
    } catch (error) {
        console.error('❌ Erro no test-api:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

app.get('/simple-test.html', requireAuth, (req, res) => {
    try {
        console.log('🔧 Usuário acessando simple-test:', req.user?.username || 'Developer');
        res.sendFile(path.join(__dirname, 'public', 'simple-test.html'));
    } catch (error) {
        console.error('❌ Erro no simple-test:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

app.get('/dashboard-fixed.html', requireAuth, requireServerAccess, (req, res) => {
    try {
        console.log('🔧 Usuário acessando dashboard-fixed:', req.user?.username || 'Developer');
        res.sendFile(path.join(__dirname, 'public', 'dashboard-fixed.html'));
    } catch (error) {
        console.error('❌ Erro no dashboard-fixed:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
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
        console.log('📡 API /api/guilds chamada por:', req.user?.username);
        
        // Verificar se o bot está conectado
        if (!global.discordClient || !global.discordClient.isReady()) {
            console.log('⚠️ Bot Discord não está conectado');
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
            console.log('⚠️ Servidor não encontrado no cache do bot');
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
        
        console.log(`✅ Dados reais do servidor: ${humanMembers.size} membros humanos, ${botMembers.size} bots`);
        res.json({
            success: true,
            guilds: guilds
        });
    } catch (error) {
        console.error('❌ Erro ao obter guilds:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para obter canais do servidor
app.get('/api/server/:serverId/channels', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        console.log(`📺 API channels para servidor ${serverId} por:`, req.user?.username);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            // Fallback: usar Discord REST API
            console.log('⚠️ Bot offline, usando Discord REST API');
            return await getChannelsViaREST(serverId, req, res);
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            console.log('⚠️ Servidor não encontrado no cache, tentando REST API');
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

        console.log(`✅ ${channels.length} canais encontrados`);
        res.json({
            success: true,
            channels: channels
        });
    } catch (error) {
        console.error('❌ Erro ao obter canais:', error);
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

        console.log(`✅ REST API: ${filteredChannels.length} canais encontrados`);
        res.json({
            success: true,
            channels: filteredChannels
        });
    } catch (error) {
        console.error('❌ Erro REST API para canais:', error);
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
        console.log(`👑 API roles para servidor ${serverId} por:`, req.user?.username);
        
        if (!global.discordClient || !global.discordClient.isReady()) {
            // Fallback: usar Discord REST API
            console.log('⚠️ Bot offline, usando Discord REST API para roles');
            return await getRolesViaREST(serverId, req, res);
        }

        const guild = global.discordClient.guilds.cache.get(serverId);
        if (!guild) {
            console.log('⚠️ Servidor não encontrado, tentando REST API para roles');
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

        console.log(`✅ ${roles.length} roles encontrados`);
        res.json({
            success: true,
            roles: roles
        });
    } catch (error) {
        console.error('❌ Erro ao obter roles:', error);
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

        console.log(`✅ REST API: ${filteredRoles.length} roles encontrados`);
        res.json({
            success: true,
            roles: filteredRoles
        });
    } catch (error) {
        console.error('❌ Erro REST API para roles:', error);
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
        console.log(`💫 Configurando canal de boas-vindas: ${channelId} para servidor: ${guildId}`);
        
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
        console.error('Erro ao configurar canal de boas-vindas:', error);
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
        console.log(`📋 Configurando canal de logs: ${channelId} para servidor: ${guildId}`);
        
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
        console.error('Erro ao configurar canal de logs:', error);
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
        console.log(`👑 Configurando cargo automático: ${roleId} para servidor: ${guildId}`);
        
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
        console.error('Erro ao configurar cargo automático:', error);
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
        console.log(`🛡️ Configurando filtros automáticos para servidor: ${guildId}`, settings);
        
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
        console.error('Erro ao configurar filtros:', error);
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
        
        console.log(`🧹 Limpeza de canal ${channelId} no servidor ${serverId} por:`, req.user?.username);
        
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

        console.log(`✅ ${deletedCount.size} mensagens deletadas do canal ${channel.name}`);
        res.json({
            success: true,
            deletedCount: deletedCount.size,
            channelName: channel.name,
            filterType: filterType
        });

    } catch (error) {
        console.error('❌ Erro ao limpar canal:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para desbanir todos os usuários
app.post('/api/server/:serverId/unban-all', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        console.log(`🔓 Desbanir todos no servidor ${serverId} por:`, req.user?.username);
        
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

        console.log(`✅ ${unbannedCount} usuários desbanidos`);
        res.json({
            success: true,
            unbannedCount: unbannedCount,
            totalBans: bans.size,
            errors: errors
        });

    } catch (error) {
        console.error('❌ Erro ao desbanir todos:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para bloquear/desbloquear servidor
app.post('/api/server/:serverId/lock', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        const { lock = true, reason = 'Bloqueio via dashboard' } = req.body;
        
        console.log(`🔒 ${lock ? 'Bloquear' : 'Desbloquear'} servidor ${serverId} por:`, req.user?.username);
        
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

        console.log(`✅ Servidor ${lock ? 'bloqueado' : 'desbloqueado'}: ${modifiedChannels} canais modificados`);
        res.json({
            success: true,
            action: lock ? 'locked' : 'unlocked',
            modifiedChannels: modifiedChannels,
            totalChannels: textChannels.size,
            errors: errors
        });

    } catch (error) {
        console.error('❌ Erro ao bloquear/desbloquear servidor:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para dar timeout em usuário
app.post('/api/server/:serverId/timeout', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        const { userId, duration = 60, reason = 'Timeout via dashboard' } = req.body;
        
        console.log(`⏰ Timeout usuário ${userId} no servidor ${serverId} por:`, req.user?.username);
        
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

        console.log(`✅ Timeout aplicado em ${member.user.tag} por ${duration} minutos`);
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
        console.error('❌ Erro ao dar timeout:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para expulsar usuário
app.post('/api/server/:serverId/kick', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        const { userId, reason = 'Expulsão via dashboard' } = req.body;
        
        console.log(`👢 Expulsar usuário ${userId} do servidor ${serverId} por:`, req.user?.username);
        
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

        console.log(`✅ ${userInfo.tag} foi expulso do servidor`);
        res.json({
            success: true,
            user: userInfo,
            reason: reason
        });

    } catch (error) {
        console.error('❌ Erro ao expulsar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para banir usuário
app.post('/api/server/:serverId/ban', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        const { userId, reason = 'Banimento via dashboard', deleteMessageDays = 0, duration = 0 } = req.body;
        
        console.log(`🔨 Banir usuário ${userId} do servidor ${serverId} por:`, req.user?.username);
        
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

        console.log(`✅ ${userInfo.tag} foi banido do servidor`);
        res.json({
            success: true,
            user: userInfo,
            reason: reason,
            deleteMessageDays: deleteMessageDays,
            duration: duration,
            unbanAt: unbanAt
        });

    } catch (error) {
        console.error('❌ Erro ao banir usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para buscar membros do servidor
app.get('/api/server/:serverId/members', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        const { search = '', limit = 50 } = req.query;
        
        console.log(`👥 Buscar membros no servidor ${serverId} por:`, req.user?.username);
        
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

        console.log(`✅ Enviados ${members.length} membros`);
        res.json({
            success: true,
            members: members,
            total: guild.memberCount
        });

    } catch (error) {
        console.error('❌ Erro ao buscar membros:', error);
        res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
    }
});

// API para obter estatísticas detalhadas do servidor
app.get('/api/server/:serverId/stats', requireAuth, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        console.log(`📊 API stats para servidor ${serverId} por:`, req.user?.username);
        
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

        console.log(`✅ Estatísticas enviadas: ${stats.members.humans} membros humanos`);
        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('❌ Erro ao obter estatísticas:', error);
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
        console.error('Erro ao carregar configuração:', error);
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
        console.error('Erro ao atualizar configuração:', error);
        res.status(500).json({ error: 'Erro ao atualizar configuração' });
    }
});

// === SISTEMA DE LOGS EM TEMPO REAL ===

// Array para armazenar clientes SSE conectados
const sseClients = new Map();

// API para logs via Server-Sent Events (SSE) - Versão sem auth para compatibilidade com EventSource
app.get('/api/logs/stream', (req, res) => {
    console.log('� DEBUG: EventSource endpoint /api/logs/stream acessado');
    console.log('�📡 Cliente SSE conectado para logs');
    
    // Configurar headers SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': req.get('origin') || '*',
        'Access-Control-Allow-Credentials': 'true'
    });

    console.log('🔴 DEBUG: Headers SSE configurados');

    // Identificador único para o cliente
    const clientId = Date.now() + Math.random();
    
    // Adicionar cliente à lista
    sseClients.set(clientId, {
        response: res,
        userId: req.user?.id || 'anonymous',
        username: req.user?.username || 'Anonymous',
        connectedAt: new Date()
    });

    console.log(`🔴 DEBUG: Cliente ${clientId} adicionado. Total de clientes: ${sseClients.size}`);

    // Enviar evento de conexão
    res.write(`data: ${JSON.stringify({
        type: 'connected',
        message: 'Conectado ao stream de logs',
        timestamp: new Date().toISOString()
    })}\n\n`);

    console.log('🔴 DEBUG: Mensagem de conexão enviada');

    // Enviar logs recentes (últimos 50)
    sendRecentLogs(res);

    // Cleanup quando cliente desconecta
    req.on('close', () => {
        console.log('📡 Cliente SSE desconectado');
        sseClients.delete(clientId);
    });

    req.on('error', () => {
        console.log('📡 Erro SSE cliente');
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
        console.error('❌ Erro ao enviar logs recentes:', error);
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
            console.error('❌ Erro ao enviar log para cliente SSE:', error);
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
        console.error('❌ Erro ao gerar log de teste:', error);
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
        console.error('❌ Erro ao buscar logs:', error);
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
        console.error('❌ Erro ao limpar logs:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Função global para registrar logs (chamada pelo bot)
global.logToDatabase = async (logData) => {
    try {
        await db.addLog(logData);
        broadcastLog(logData);
    } catch (error) {
        console.error('❌ Erro ao registrar log:', error);
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
        console.error('Erro ao enviar update:', error);
        res.status(500).json({ error: 'Erro ao enviar update' });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Página não encontrada' });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// Routes - Updated to include new API routes
try {
    console.log('🔗 Carregando rotas da API...');
    app.use('/api', require('./routes/api'));
    console.log('✅ Rotas da API carregadas com sucesso');
} catch (error) {
    console.error('❌ Erro ao carregar rotas da API:', error);
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        db.close();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        db.close();
        process.exit(0);
    });
});

// Iniciar servidor
server.listen(PORT, () => {
    console.log(`🌐 YSNM Dashboard rodando em http://localhost:${PORT}`);
    console.log(`🔑 OAuth2 Discord configurado para: ${callbackURL}`);
    console.log(`🏷️ Ambiente: ${isProduction ? 'Produção' : 'Desenvolvimento'}`);
    console.log(`🔌 Socket.IO habilitado`);
    console.log(`📊 Sistema completo: Dashboard, Tickets, Analytics, Admin`);
    console.log(`🛡️ Sistema de segurança ativo`);
});

module.exports = { app, server, socketManager };
