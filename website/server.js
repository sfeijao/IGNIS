const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const fs = require('fs');
const { EmbedBuilder, WebhookClient } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Estratégia do Discord
passport.use(new DiscordStrategy({
    clientID: config.clientId,
    clientSecret: config.clientSecret,
    callbackURL: config.website.redirectUri,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Middleware de autenticação
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Middleware para verificar acesso ao servidor
function requireServerAccess(req, res, next) {
    if (!req.user) {
        return res.redirect('/login');
    }

    // Verificar se o usuário tem acesso a pelo menos um servidor onde o bot está presente
    // Por agora, permitir todos os usuários autenticados
    next();
}

// Servir ficheiros estáticos apenas para recursos públicos
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Rotas de autenticação Discord
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect('/dashboard');
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
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
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
        // Por agora, retornar lista vazia - seria necessário implementar
        // verificação dos servidores onde o usuário tem permissão e o bot está presente
        res.json({
            success: true,
            guilds: []
        });
    } catch (error) {
        console.error('Erro ao obter guilds:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
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

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🌐 Website de Updates rodando em http://localhost:${PORT}`);
    console.log(`🔑 OAuth2 Discord configurado para: ${config.website.redirectUri}`);
});

module.exports = app;
