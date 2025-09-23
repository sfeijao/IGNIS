const { 
    Client, 
    Collection, 
    GatewayIntentBits, 
    Partials,
    REST,
    Routes
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./utils/config');
const logger = require('./utils/logger');
const storage = require('./utils/storage');
const WebhookManager = require('./utils/webhooks/webhookManager');
// Mongo (opcional)
let mongoReady = false;
try {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
    // Debug seguro: mostrar se a variável existe e a URI mascarada
    (function(){
        try {
            const uri = MONGO_URI;
            const protoIndex = uri ? uri.indexOf('://') : -1;
            const atIndex = uri ? uri.indexOf('@') : -1;
            let masked = 'N/A';
            if (uri) {
                if (protoIndex !== -1 && atIndex !== -1 && atIndex > protoIndex) {
                    const scheme = uri.substring(0, protoIndex + 3);
                    const afterAt = uri.substring(atIndex + 1);
                    masked = `${scheme}***@${afterAt}`;
                } else {
                    masked = `${uri.split('://')[0] || 'mongodb'}://***`;
                }
            }
            const key = process.env.MONGO_URI ? 'MONGO_URI' : (process.env.MONGODB_URI ? 'MONGODB_URI' : 'none');
            logger.info(`🧩 Mongo env: present=${!!uri} key=${key} uri=${masked}`);
        } catch {}
    })();
    if (MONGO_URI) {
        const { connect } = require('./utils/db/mongoose');
        connect(MONGO_URI).then(() => {
            logger.info('✅ MongoDB conectado');
            mongoReady = true;
        }).catch(err => {
            const msg = err && err.message ? err.message : String(err);
            const code = err && (err.code || err.name);
            if (err && err.code === 'MONGO_URI_MALFORMED') {
                logger.warn('❌ MongoDB URI inválida. A executar em modo fallback JSON. Dica: se a password tiver caracteres especiais, codifique com encodeURIComponent.');
                logger.debug(msg);
            } else if (err && err.code === 'MONGO_AUTH_FAILED') {
                logger.warn('❌ Autenticação MongoDB falhou. A executar em modo fallback JSON. Verifique credenciais/permissões.');
                logger.debug({ code, msg });
            } else if (err && err.code === 'MONGO_NET_FAILED') {
                logger.warn('⚠️  MongoDB não acessível (rede/DNS). A executar em modo fallback JSON.');
                logger.debug({ code, msg });
            } else {
                logger.warn('⚠️  MongoDB indisponível, seguindo com fallback JSON:', { code, msg });
            }
        });
    }
} catch (e) {
    logger.warn('⚠️  Erro ao inicializar MongoDB:', e && e.message ? e.message : e);
}

// Iniciar dashboard se CLIENT_SECRET estiver disponível e não for placeholder
if (config.DISCORD.CLIENT_SECRET && config.DISCORD.CLIENT_SECRET !== 'bot_only') {
    logger.info('✅ CLIENT_SECRET disponível - iniciando dashboard');
    require('./dashboard/server');
} else {
    logger.warn('⚠️  CLIENT_SECRET não disponível - dashboard desabilitado');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
    ]
});

client.commands = new Collection();

// Setup storage and ticket manager
client.storage = storage;
client.webhooks = new WebhookManager(client);

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    logger.info(`✅ Comando carregado: ${command.data.name}`);
    } else {
        logger.warn(`⚠️ Comando em ${filePath} está faltando propriedades necessárias.`);
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
    logger.info(`✅ Evento carregado: ${event.name} (${file})`);
}

// Tratamento de erros
process.on('unhandledRejection', error => {
    logger.error('❌ Unhandled promise rejection', { error: error && error.message ? error.message : error, stack: error && error.stack });
});

process.on('uncaughtException', error => {
    logger.error('❌ Uncaught exception', { error: error && error.message ? error.message : error, stack: error && error.stack });
    process.exit(1);
});

// Função para registrar comandos automaticamente
async function registerCommands() {
    try {
        logger.info('🔄 Registrando comandos slash...');
        
        const commands = [];
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                const commandData = command.data.toJSON();
                commands.push(commandData);
                logger.info(`📝 Preparando comando: ${commandData.name} (global: ${!commandData.dm_permission})`);
            }
        }

        const rest = new REST({ version: '10' }).setToken(config.DISCORD.TOKEN);
        
        // Registrar comandos globalmente (disponíveis em todos os servidores)
        logger.info(`🌐 Registrando ${commands.length} comandos globalmente...`);
        const result = await rest.put(
            Routes.applicationCommands(config.DISCORD.CLIENT_ID),
            { body: commands }
        );
        
        logger.info(`✅ ${result.length} comandos registrados com sucesso!`);
        logger.info('⏰ Nota: Comandos podem demorar até 1 hora para aparecer em todos os servidores devido ao cache do Discord');
        
        // Log dos comandos registrados
        result.forEach(cmd => {
            logger.info(`   ✓ ${cmd.name}: ${cmd.description}`);
        });
        
    } catch (error) {
        logger.error('❌ Erro ao registrar comandos', { error: error && error.message ? error.message : error, stack: error && error.stack });
    }
}

// Registrar comandos e fazer login
(async () => {
    await registerCommands();
    
    client.login(config.DISCORD.TOKEN).catch(error => {
        logger.error('❌ Erro ao fazer login:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        process.exit(1);
    });
})();

// Enhanced ready event
client.once('ready', () => {
    logger.info(`✅ Bot logado como ${client.user.tag}`);
    logger.info(`🏠 Servidores: ${client.guilds.cache.size}`);
    logger.info(`👥 Usuários: ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`);
    
    // Update bot status
    client.user.setActivity('🤖 Bot ativo | /ajuda', { type: 'WATCHING' });
    
    // Tornar cliente disponível globalmente para o dashboard
    global.discordClient = client;
    // Disponibilizar client no manager e hidratar webhooks do DB
    try {
        if (client.webhooks?.setClient) client.webhooks.setClient(client);
        if (client.webhooks?.hydrateFromStorage) client.webhooks.hydrateFromStorage();
    } catch {}
    // Restaurar painéis de tickets do storage (Mongo/SQLite)
    (async () => {
        try {
            const isSqlite = (process.env.STORAGE_BACKEND || '').toLowerCase() === 'sqlite';
            let panels = [];
            if (isSqlite) {
                const storage = require('./utils/storage');
                // Não temos guild_id aqui, então restauramos por fetch por guilds mais tarde; como fallback, não fazer scan global pesado.
                // Estratégia: iterar guilds e tentar recriar por canal conhecido
                for (const guild of client.guilds.cache.values()) {
                    try {
                        const list = await storage.getPanels(guild.id);
                        panels.push(...list);
                    } catch {}
                }
            } else {
                if (!mongoReady) return;
                const { PanelModel } = require('./utils/db/models');
                panels = await PanelModel.find({ type: 'tickets' }).lean();
            }
            for (const p of panels) {
                try {
                    const guild = client.guilds.cache.get(p.guild_id) || await client.guilds.fetch(p.guild_id);
                    const channel = guild.channels.cache.get(p.channel_id) || await client.channels.fetch(p.channel_id);
                    // Se a mensagem existir, não fazer nada; se não, recriar painel simples
                    let existing = null;
                    if (channel && channel.messages?.fetch) {
                        existing = await channel.messages.fetch(p.message_id).catch(() => null);
                    }
                    if (!existing && channel?.send) {
                        let msg;
                        if (p.payload) {
                            try {
                                msg = await channel.send(p.payload);
                            } catch (e) {
                                // fallback se payload estiver inválido
                            }
                        }
                        if (!msg) {
                            const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
                            const embed = new EmbedBuilder().setTitle('🎫 Centro de Suporte').setDescription('Escolhe um departamento para abrir um ticket.').setColor(0x7C3AED);
                            const row1 = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('ticket:create:technical').setLabel('Suporte Técnico').setEmoji('🔧').setStyle(ButtonStyle.Primary),
                                new ButtonBuilder().setCustomId('ticket:create:incident').setLabel('Reportar Problema').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
                                new ButtonBuilder().setCustomId('ticket:create:moderation').setLabel('Moderação & Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Secondary)
                            );
                            const row2 = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('ticket:create:general').setLabel('Dúvidas Gerais').setEmoji('💬').setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder().setCustomId('ticket:create:account').setLabel('Suporte de Conta').setEmoji('🧾').setStyle(ButtonStyle.Secondary)
                            );
                            msg = await channel.send({ embeds: [embed], components: [row1, row2] });
                        }
                        // Atualizar/guardar painel
                        if (isSqlite) {
                            const storage = require('./utils/storage');
                            await storage.upsertPanel({ guild_id: p.guild_id, channel_id: p.channel_id, message_id: msg.id, theme: p.theme || 'dark', payload: p.payload || null, type: 'tickets' });
                        } else {
                            const { PanelModel } = require('./utils/db/models');
                            await PanelModel.findOneAndUpdate(
                                { guild_id: p.guild_id, channel_id: p.channel_id, type: 'tickets' },
                                { $set: { message_id: msg.id, theme: p.theme || 'dark', payload: p.payload || null } },
                                { upsert: true }
                            );
                        }
                    }
                } catch (e) {
                    logger.warn('Falha a restaurar painel:', e.message);
                }
            }
        } catch (e) {
            logger.warn('Falha ao restaurar paineis:', e.message);
        }
    })();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('🛑 SIGTERM received, shutting down bot gracefully');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('🛑 SIGINT received, shutting down bot gracefully');
    client.destroy();
    process.exit(0);
});

module.exports = client;
