const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { EmbedBuilder, WebhookClient } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração da sessão
app.use(session({
    secret: process.env.SESSION_SECRET || 'ysnm-updates-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // true apenas em HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Password de acesso (configurável via env)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'YSNM2024!';

// Middleware de autenticação
function requireAuth(req, res, next) {
    if (req.session.authenticated) {
        return next();
    }
    
    // Se for uma requisição AJAX, retorna erro JSON
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({ error: 'Não autenticado' });
    }
    
    // Caso contrário, redireciona para login
    res.redirect('/login');
}

// Servir ficheiros estáticos apenas para recursos públicos
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Carregar configuração
let config;
try {
    config = require('../config.json');
} catch (error) {
    console.log('⚠️ Usando configuração padrão para o website');
    config = {
        channels: {
            updates: process.env.UPDATES_CHANNEL_ID || '1404310493468041228'
        }
    };
}

// Página de login
app.get('/login', (req, res) => {
    if (req.session.authenticated) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// API de login
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    
    if (password === ADMIN_PASSWORD) {
        req.session.authenticated = true;
        res.json({ success: true, message: 'Login realizado com sucesso' });
    } else {
        res.status(401).json({ success: false, message: 'Palavra-passe incorreta' });
    }
});

// API de logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Erro ao fazer logout' });
        }
        res.json({ success: true, message: 'Logout realizado com sucesso' });
    });
});

// Página principal (protegida)
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API para obter canais do servidor (protegida)
app.get('/api/channels', requireAuth, (req, res) => {
    try {
        if (!global.discordClient || !global.discordClient.isReady()) {
            return res.status(503).json({ error: 'Bot não está conectado' });
        }

        const guild = global.discordClient.guilds.cache.first();
        if (!guild) {
            return res.status(404).json({ error: 'Servidor não encontrado' });
        }

        // Filtrar apenas canais de texto onde o bot pode enviar mensagens
        const textChannels = guild.channels.cache
            .filter(channel => 
                channel.type === 0 && // TEXT CHANNEL
                channel.permissionsFor(guild.members.me).has('SendMessages')
            )
            .map(channel => ({
                id: channel.id,
                name: channel.name,
                parent: channel.parent ? channel.parent.name : null
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json(textChannels);
    } catch (error) {
        console.error('Erro ao obter canais:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// API para enviar update (protegida)
app.post('/api/send-update', requireAuth, async (req, res) => {
    try {
        const { title, description, icon, banner, color, fields, channelId } = req.body;

        // Validar dados
        if (!title || !description) {
            return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
        }

        if (!channelId) {
            return res.status(400).json({ error: 'Canal de destino é obrigatório' });
        }

        // Criar embed
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color || '#9932CC')
            .setTimestamp();

        // Adicionar ícone se fornecido
        if (icon) {
            embed.setThumbnail(icon);
        }

        // Adicionar banner se fornecido
        if (banner) {
            embed.setImage(banner);
        }

        // Adicionar campos personalizados
        if (fields && fields.length > 0) {
            fields.forEach(field => {
                if (field.name && field.value) {
                    embed.addFields({
                        name: field.name,
                        value: field.value,
                        inline: field.inline || false
                    });
                }
            });
        }

        // Adicionar footer
        embed.setFooter({
            text: 'YSNM Community • Sistema de Updates',
            iconURL: 'https://cdn.discordapp.com/icons/1333825066928214053/a_8c5e2b5b5f4d3c2a1e0f9b8d7c6e5a4b.gif'
        });

        // Enviar para Discord usando o bot (se estiver online)
        if (global.discordClient && global.discordClient.isReady()) {
            const guild = global.discordClient.guilds.cache.first();
            if (guild) {
                const targetChannel = guild.channels.cache.get(channelId);
                if (targetChannel) {
                    await targetChannel.send({ embeds: [embed] });
                } else {
                    return res.status(404).json({ error: 'Canal não encontrado' });
                }
            } else {
                return res.status(404).json({ error: 'Servidor não encontrado' });
            }
        } else {
            return res.status(503).json({ error: 'Bot não está conectado' });
        }

        // Salvar histórico de updates
        const updatesHistory = path.join(__dirname, '..', 'updates-history.json');
        let history = [];
        
        try {
            history = JSON.parse(fs.readFileSync(updatesHistory, 'utf8'));
        } catch (error) {
            history = [];
        }

        history.push({
            id: Date.now(),
            timestamp: new Date().toISOString(),
            title,
            description,
            icon,
            banner,
            color,
            fields,
            channelId,
            channelName: global.discordClient ? 
                global.discordClient.guilds.cache.first()?.channels.cache.get(channelId)?.name : 
                'Canal desconhecido',
            author: 'Website Admin'
        });

        // Manter apenas os últimos 50 updates
        if (history.length > 50) {
            history = history.slice(-50);
        }

        fs.writeFileSync(updatesHistory, JSON.stringify(history, null, 2));

        res.json({ success: true, message: 'Update enviado com sucesso!' });

    } catch (error) {
        console.error('Erro ao enviar update:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// API para obter histórico de updates
app.get('/api/updates-history', (req, res) => {
    try {
        const updatesHistory = path.join(__dirname, '..', 'updates-history.json');
        let history = [];
        
        try {
            history = JSON.parse(fs.readFileSync(updatesHistory, 'utf8'));
        } catch (error) {
            history = [];
        }

        res.json(history.reverse()); // Mais recentes primeiro
    } catch (error) {
        console.error('Erro ao obter histórico:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// API para preview do embed
// API para preview do embed (protegida)
app.post('/api/preview-embed', requireAuth, (req, res) => {
    try {
        const { title, description, icon, banner, color, fields } = req.body;

        const embedData = {
            title: title || 'Título do Update',
            description: description || 'Descrição do update...',
            color: parseInt((color || '#9932CC').replace('#', ''), 16),
            timestamp: new Date().toISOString(),
            thumbnail: icon ? { url: icon } : null,
            image: banner ? { url: banner } : null,
            fields: fields || [],
            footer: {
                text: 'YSNM Community • Sistema de Updates',
                icon_url: 'https://cdn.discordapp.com/icons/1333825066928214053/a_8c5e2b5b5f4d3c2a1e0f9b8d7c6e5a4b.gif'
            }
        };

        res.json(embedData);
    } catch (error) {
        console.error('Erro ao gerar preview:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🌐 Website de Updates rodando em http://localhost:${PORT}`);
});

module.exports = app;
