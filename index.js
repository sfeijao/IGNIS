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
const fetch = require('node-fetch');
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

// Bridge Discord events to dashboard sockets (if available)
client.socketManager = {
    onDiscordEvent: (eventName, guildId, data) => {
        try {
            if (global.socketManager && typeof global.socketManager.broadcastModeration === 'function') {
                global.socketManager.broadcastModeration(guildId, { event: eventName, data });
            }
        } catch {}
    }
};

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
// Carregar também comandos compilados de TypeScript (dist/commands)
try {
    const distCommandsPath = path.join(__dirname, 'dist', 'commands');
    if (fs.existsSync(distCommandsPath)) {
        const tsBuilt = fs.readdirSync(distCommandsPath).filter(f => f.endsWith('.js'));
        for (const f of tsBuilt) {
            commandFiles.push(path.join('dist','commands', f));
        }
    }
} catch {}

for (const file of commandFiles) {
    const filePath = file.includes('dist') ? path.join(__dirname, file) : path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    logger.info(`✅ Comando carregado: ${command.data.name}`);
    } else {
        logger.warn(`⚠️ Comando em ${filePath} está faltando propriedades necessárias.`);
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
// Incluir eventos compilados (dist/events)
try {
    const distEventsPath = path.join(__dirname, 'dist', 'events');
    if (fs.existsSync(distEventsPath)) {
        const tsEvents = fs.readdirSync(distEventsPath).filter(f => f.endsWith('.js'));
        for (const f of tsEvents) {
            eventFiles.push(path.join('dist','events', f));
        }
    }
} catch {}

for (const file of eventFiles) {
    const filePath = file.includes('dist') ? path.join(__dirname, file) : path.join(eventsPath, file);
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
            // Suporta comandos JS locais e também comandos compilados (dist/commands)
            const filePath = file.includes('dist')
                ? path.join(__dirname, file)
                : path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            }
        }

        const rest = new REST({ version: '10' }).setToken(config.DISCORD.TOKEN);
        logger.info(`🌐 Registrando ${commands.length} comandos globalmente...`);
        const result = await rest.put(
            Routes.applicationCommands(config.DISCORD.CLIENT_ID),
            { body: commands }
        );

        logger.info(`✅ ${result.length} comandos registrados com sucesso!`);
        logger.info('⏰ Nota: Comandos podem demorar até 1 hora para aparecer em todos os servidores devido ao cache do Discord');

        result.forEach(cmd => {
            logger.info(`   ✓ ${cmd.name}: ${cmd.description}`);
        });
    } catch (error) {
        logger.error('❌ Erro ao registrar comandos', { error: error && error.message ? error.message : error, stack: error && error.stack });
    }
}

// Registrar comandos e fazer login
(async () => {
    // Em Railway (produção), o deploy de comandos já é feito pelo starter (scripts/deploy-commands.js).
    // Para evitar duplicação e ruído de logs/erros, pulamos o registro em runtime por padrão
    // quando a variável RAILWAY_ENVIRONMENT_NAME existir. Use FORCE_RUNTIME_COMMAND_REGISTER=true
    // para forçar registro em runtime mesmo em Railway.
    const inRailway = !!process.env.RAILWAY_ENVIRONMENT_NAME;
    const forceRuntime = String(process.env.FORCE_RUNTIME_COMMAND_REGISTER || '').toLowerCase() === 'true';
    if (inRailway && !forceRuntime) {
        logger.info('⚙️  Ignorando registro de comandos em runtime (Railway detectado). Use FORCE_RUNTIME_COMMAND_REGISTER=true para forçar.');
    } else {
        await registerCommands();
    }
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

    // 🆕 Iniciar Server Stats Worker
    try {
        const { initStatsWorker } = require('./utils/serverStats');
        initStatsWorker(client);
        logger.info('✅ Server Stats Worker initialized');
    } catch (statsErr) {
        logger.warn('⚠️ Server Stats Worker not started:', statsErr.message);
    }

    // 🆕 Iniciar Giveaway Claim Job Processor
    try {
        const { GiveawayClaimJobProcessor } = require('./utils/jobs/giveawayClaimProcessor');
        const giveawayClaimJob = new GiveawayClaimJobProcessor(client);
        giveawayClaimJob.start();
        client.giveawayClaimJob = giveawayClaimJob; // Store reference for graceful shutdown
        logger.info('✅ Giveaway Claim Job Processor initialized');
    } catch (jobErr) {
        logger.warn('⚠️ Giveaway Claim Job Processor not started:', jobErr.message);
    }

    // Atualizar avatar/banner do bot no arranque se variáveis estiverem definidas
    (async () => {
        try {
            // Formas suportadas:
            //  - BOT_AVATAR_URL / BOT_BANNER_URL: URLs diretas (http/https)
            //  - BOT_AVATAR_FILE / BOT_BANNER_FILE: caminhos locais para ficheiros (ex: assets/avatar.png)
            //  - Se ambos (URL e FILE) estiverem definidos para o mesmo recurso, FILE tem prioridade.
            let newAvatar = null;
            if (process.env.BOT_AVATAR_FILE) {
                try { newAvatar = fs.readFileSync(path.resolve(process.env.BOT_AVATAR_FILE)); } catch {}
            } else if (process.env.BOT_AVATAR_URL) {
                const url = process.env.BOT_AVATAR_URL.trim();
                try {
                    if (/^https?:\/\//i.test(url)) {
                        const res = await fetch(url);
                        if (res.ok) newAvatar = Buffer.from(await res.arrayBuffer());
                        else logger.warn(`⚠️ Download do avatar falhou: HTTP ${res.status}`);
                    } else {
                        newAvatar = url; // fallback (caso seja data URI)
                    }
                } catch (e) { logger.warn('⚠️ Download do avatar falhou:', e?.message || e); }
            }
            let newBanner = null;
            if (process.env.BOT_BANNER_FILE) {
                try { newBanner = fs.readFileSync(path.resolve(process.env.BOT_BANNER_FILE)); } catch {}
            } else if (process.env.BOT_BANNER_URL) {
                const urlb = process.env.BOT_BANNER_URL.trim();
                try {
                    if (/^https?:\/\//i.test(urlb)) {
                        const res = await fetch(urlb);
                        if (res.ok) newBanner = Buffer.from(await res.arrayBuffer());
                        else logger.warn(`⚠️ Download do banner falhou: HTTP ${res.status}`);
                    } else {
                        newBanner = urlb; // fallback data URI
                    }
                } catch (e) { logger.warn('⚠️ Download do banner falhou:', e?.message || e); }
            }
            if (newAvatar) {
                try {
                    await client.user.setAvatar(newAvatar);
                    logger.info('🖼️ Avatar do bot atualizado com sucesso.');
                } catch (e) {
                    logger.warn('⚠️ Falha ao atualizar avatar do bot:', e?.message || e);
                }
            } else {
                logger.info('🖼️ BOT_AVATAR_URL/BOT_AVATAR_FILE não definidos - mantendo avatar atual.');
            }
            if (newBanner) {
                try {
                    // Nem todas as apps têm permissão de banner; ignorar erro silenciosamente
                    if (client.user.setBanner) {
                        await client.user.setBanner(newBanner);
                        logger.info('🎏 Banner do bot atualizado com sucesso.');
                    } else {
                        logger.info('🎏 setBanner não disponível nesta versão/permissão - ignorando.');
                    }
                } catch (e) {
                    logger.warn('⚠️ Falha ao atualizar banner do bot (possível falta de permissão/recurso):', e?.message || e);
                }
            } else {
                logger.info('🎏 BOT_BANNER_URL/BOT_BANNER_FILE não definidos - mantendo banner atual.');
            }
        } catch (e) {
            logger.warn('⚠️ Erro inesperado ao tentar atualizar avatar/banner:', e?.message || e);
        }
    })();

    // Tornar cliente disponível globalmente para o dashboard
    global.discordClient = client;
    // Disponibilizar client no manager e hidratar webhooks do DB
    try {
        if (client.webhooks?.setClient) client.webhooks.setClient(client);
        if (client.webhooks?.hydrateFromStorage) client.webhooks.hydrateFromStorage();
    } catch {}

    // Cleanup job: liberar giveaways presos em 'processing' a cada 10 minutos
    try {
        const { cleanupStaleLocks } = require('./utils/giveaways/service');
        setInterval(async () => {
            try {
                await cleanupStaleLocks();
            } catch (e) {
                logger.warn('[GiveawayCleanup] Erro no cleanup:', e?.message || e);
            }
        }, 10 * 60 * 1000); // 10 minutos
        logger.info('🧹 Job de cleanup de giveaways iniciado (10 min)');
    } catch {}

    // Restaurar painéis de tickets e verificação do storage (Mongo/SQLite)
    // Agora DESATIVADO por padrão. Só ativa se:
    //  - process.env.AUTO_RESTORE_PANELS === 'true' (global)
    //  - OU config do servidor tiver autoRestorePanels === true
    (async () => {
        try {
            const globalRestoreEnabled = String(process.env.AUTO_RESTORE_PANELS || '').toLowerCase() === 'true';
            if (!globalRestoreEnabled) {
                // Verificação por-guild será feita dentro do loop; aqui apenas informação inicial
                logger.info('🧩 Restauração automática de painéis no arranque: DESATIVADA por padrão (use AUTO_RESTORE_PANELS=true para forçar globalmente)');
            } else {
                logger.info('🧩 Restauração automática de painéis no arranque: ATIVADA globalmente via AUTO_RESTORE_PANELS=true');
            }
            const isSqlite = (process.env.STORAGE_BACKEND || '').toLowerCase() === 'sqlite';
            let panels = [];
            if (isSqlite) {
                const storage = require('./utils/storage');
                for (const guild of client.guilds.cache.values()) {
                    try {
                        const tickets = await storage.getPanels(guild.id);
                        const verifs = (storage.getPanelsByType ? await storage.getPanelsByType(guild.id, 'verification') : []);
                        panels.push(...tickets, ...verifs);
                    } catch {}
                }
            } else {
                if (!mongoReady) return;
                const { PanelModel } = require('./utils/db/models');
                panels = await PanelModel.find({ type: { $in: ['tickets','verification'] } }).lean();
            }
            // Cache de configurações por guild para evitar acessos repetidos
            const guildCfgCache = new Map();

            for (const p of panels) {
                try {
                    const guild = client.guilds.cache.get(p.guild_id) || await client.guilds.fetch(p.guild_id);
                    const channel = guild.channels.cache.get(p.channel_id) || await client.channels.fetch(p.channel_id);
                    // Gate por guild: só restaurar se ativado explicitamente no servidor OU se o global estiver ligado
                    let guildRestore = false;
                    try {
                        if (globalRestoreEnabled) {
                            guildRestore = true;
                        } else {
                            const cacheHit = guildCfgCache.get(p.guild_id);
                            const cfg = cacheHit || await (async () => {
                                try {
                                    const s = require('./utils/storage');
                                    const c = await s.getGuildConfig(p.guild_id).catch(() => ({}));
                                    guildCfgCache.set(p.guild_id, c || {});
                                    return c || {};
                                } catch { return {}; }
                            })();
                            // Novo sinal canónico: apenas esta chave ativa a restauração por-guild
                            if (cfg && cfg.autoRestorePanels === true) guildRestore = true;
                        }
                    } catch {}

                    if (!guildRestore) {
                        // Skip silencioso por padrão; log leve por guild uma vez
                        if (!guildCfgCache.get(`__logged_${p.guild_id}`)) {
                            logger.info(`⏭️  [${guild.name}] Restauração de painéis no arranque DESATIVADA para este servidor.`);
                            guildCfgCache.set(`__logged_${p.guild_id}`, true);
                        }
                        continue;
                    }
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
                            if (p.type === 'verification') {
                                const embed = new EmbedBuilder()
                                    .setTitle('🔒 Verificação do Servidor')
                                    .setDescription('Clica em Verificar para concluir e ganhar acesso aos canais.')
                                    .setColor(0x7C3AED);
                                const row = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('verify_user').setLabel('Verificar').setEmoji('✅').setStyle(ButtonStyle.Primary)
                                );
                                msg = await channel.send({ embeds: [embed], components: [row] });
                                // Optional enhancement: if verification method is reaction and this is a fallback render,
                                // add the ✅ reaction to guide users immediately.
                                try {
                                    const cfg = await storage.getGuildConfig(p.guild_id).catch(() => ({}));
                                    const method = cfg?.verification?.method || 'button';
                                    if (method === 'reaction') {
                                        await msg.react('✅').catch(() => {});
                                    }
                                } catch {}
                            } else {
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
                        }
                        // Atualizar/guardar painel
                        if (isSqlite) {
                            const storage = require('./utils/storage');
                            await storage.upsertPanel({ guild_id: p.guild_id, channel_id: p.channel_id, message_id: msg.id, theme: p.theme || 'dark', payload: p.payload || null, type: p.type || 'tickets' });
                        } else {
                            const { PanelModel } = require('./utils/db/models');
                            await PanelModel.findOneAndUpdate(
                                { guild_id: p.guild_id, channel_id: p.channel_id, type: p.type || 'tickets' },
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
    if (client.giveawayClaimJob) {
        client.giveawayClaimJob.stop();
    }
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('🛑 SIGINT received, shutting down bot gracefully');
    if (client.giveawayClaimJob) {
        client.giveawayClaimJob.stop();
    }
    client.destroy();
    process.exit(0);
});

module.exports = client;
