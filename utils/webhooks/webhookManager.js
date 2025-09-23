const { WebhookClient, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

// Helper env flags
const preferSqlite = (process.env.STORAGE_BACKEND || '').toLowerCase() === 'sqlite';
const hasMongoEnv = !!(process.env.MONGO_URI || process.env.MONGODB_URI);

class WebhookManager {
    constructor(client = null) {
        // Optional discord client so we can hydrate using guilds list for SQLite
        this.client = client;
    this.configPath = path.join(__dirname, '..', '..', 'config', 'webhooks.json');
    // Map<guildId, Map<type, { name, webhook }>>
    this.webhooks = new Map();
        this.init();
    }

    async init() {
        try {
            // Ensure config directory exists
            const configDir = path.dirname(this.configPath);
            await fs.mkdir(configDir, { recursive: true });

            // Try to read existing config
            let config;
            try {
                const data = await fs.readFile(this.configPath, 'utf8');
                config = JSON.parse(data);
            } catch (err) {
                // Create default config if doesn't exist
                config = { webhooks: {} };
                await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
            }

            // Initialize webhooks (support old single-entry and new multi-type format)
            for (const [guildId, info] of Object.entries(config.webhooks)) {
                // Old format: { enabled, webhook_url, name }
                if (info && typeof info === 'object' && 'webhook_url' in info) {
                    if (info.enabled && info.webhook_url) {
                        const typeMap = new Map();
                        typeMap.set('logs', { name: info.name, webhook: new WebhookClient({ url: info.webhook_url }) });
                        this.webhooks.set(guildId, typeMap);
                    }
                    continue;
                }
                // New format: { logs: {...}, updates: {...}, tickets: {...} }
                const typeMap = new Map();
                for (const [type, w] of Object.entries(info || {})) {
                    if (w && w.enabled && w.webhook_url) {
                        typeMap.set(type, { name: w.name, webhook: new WebhookClient({ url: w.webhook_url }) });
                    }
                }
                if (typeMap.size > 0) {
                    this.webhooks.set(guildId, typeMap);
                }
            }

            // Best-effort hydration from DB if available
            try {
                await this.hydrateFromStorage();
            } catch (e) {
                logger.warn('Hydration from DB failed, using file fallback only:', e && e.message ? e.message : e);
            }
        } catch (error) {
            logger.error('Error initializing webhook manager:', error);
        }
    }

    setClient(client) {
        this.client = client;
    }

    async hydrateFromStorage() {
        // Load and register webhooks from active storage backend so redeploys keep settings
        // Strategy:
        // - SQLite: iterate current guilds and list webhooks for each
        // - Mongo: read all enabled records
        try {
            // Prefer SQLite when explicitly selected or when Mongo isn't configured
            if (preferSqlite) {
                const storageSqlite = require('../storage-sqlite');
                let count = 0;
                const guilds = (this.client && this.client.guilds && this.client.guilds.cache) ? Array.from(this.client.guilds.cache.values()) : [];
                for (const guild of guilds) {
                    try {
                        const list = await storageSqlite.listWebhooks(guild.id);
                        const typeMap = this.webhooks.get(guild.id) || new Map();
                        for (const w of list) {
                            if (w.enabled && w.url && (w.type || 'logs')) {
                                typeMap.set((w.type || 'logs'), { name: w.name || guild.name, webhook: new WebhookClient({ url: w.url }) });
                                count++;
                            }
                        }
                        if (typeMap.size > 0) this.webhooks.set(guild.id, typeMap);
                    } catch {}
                }
                if (count > 0) logger.info(`🔁 WebhookManager: hidratado ${count} webhook(s) do SQLite`);
                return;
            }

            if (hasMongoEnv) {
                const { isReady } = require('../db/mongoose');
                if (!isReady()) {
                    logger.debug && logger.debug('WebhookManager: Mongo não está pronto para hidratação');
                    return;
                }
                const { WebhookModel } = require('../db/models');
                const list = await WebhookModel.find({ enabled: true }).lean();
                let count = 0;
                for (const w of list) {
                    if (w && w.guild_id && w.url) {
                        const typeMap = this.webhooks.get(w.guild_id) || new Map();
                        typeMap.set((w.type || 'logs'), { name: w.name || (this.client?.guilds?.cache.get(w.guild_id)?.name) || 'Logs', webhook: new WebhookClient({ url: w.url }) });
                        this.webhooks.set(w.guild_id, typeMap);
                        count++;
                    }
                }
                if (count > 0) logger.info(`🔁 WebhookManager: hidratado ${count} webhook(s) do MongoDB`);
            }
        } catch (e) {
            logger.warn('WebhookManager hydrateFromStorage error:', e && e.message ? e.message : e);
        }
    }

    async saveConfig() {
        const config = { webhooks: {} };
        for (const [guildId, typeMap] of this.webhooks) {
            const guildEntry = {};
            for (const [type, info] of typeMap) {
                if (info?.webhook?.url) {
                    guildEntry[type] = {
                        name: info.name,
                        webhook_url: info.webhook.url,
                        enabled: true
                    };
                }
            }
            if (Object.keys(guildEntry).length > 0) {
                config.webhooks[guildId] = guildEntry;
            }
        }
        await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    }

    async persistToDB(guildId, { type = 'logs', name, url, channel_id = null, channel_name = null, enabled = true } = {}) {
        try {
            if (preferSqlite) {
                const storageSqlite = require('../storage-sqlite');
                if (enabled) {
                    await storageSqlite.upsertWebhook({ guild_id: guildId, type, name, url, channel_id, channel_name, enabled: true });
                } else {
                    // Try delete specific logs webhook if present
                    const list = await storageSqlite.listWebhooks(guildId).catch(() => []);
                    const toDelete = list.find(w => (w.type || 'logs') === type);
                    if (toDelete && toDelete._id) {
                        await storageSqlite.deleteWebhookById(toDelete._id, guildId);
                    } else if (list.length) {
                        // Fallback: disable if cannot delete
                        await storageSqlite.upsertWebhook({ guild_id: guildId, type, name: name || list[0].name, url: list[0].url, channel_id: list[0].channel_id, channel_name: list[0].channel_name, enabled: false });
                    }
                }
            } else if (hasMongoEnv) {
                const { isReady } = require('../db/mongoose');
                if (isReady()) {
                    const { WebhookModel } = require('../db/models');
                    if (enabled) {
                        await WebhookModel.findOneAndUpdate(
                            { guild_id: guildId, type },
                            { $set: { name, url, channel_id, channel_name, enabled: true } },
                            { upsert: true }
                        );
                    } else {
                        await WebhookModel.deleteOne({ guild_id: guildId, type });
                    }
                }
            }
        } catch (e) {
            logger.warn('persistToDB webhook error:', e && e.message ? e.message : e);
        }
    }

    async verifyAndSetupWebhook(guild, channel) {
        try {
            // Verifica se já existe um webhook válido (tipo 'logs')
            const existingTypeMap = this.webhooks.get(guild.id);
            const existingInfo = existingTypeMap?.get?.('logs');
            if (existingInfo?.webhook?.url) {
                try {
                    // Tenta enviar uma mensagem de teste
                    await existingInfo.webhook.send({
                        content: '🔄 Verificando conexão do webhook...'
                    });
                    logger.info(`Webhook existente verificado para ${guild.name}`);
                    return true;
                } catch (error) {
                    logger.warn(`Webhook existente inválido para ${guild.name}, recriando...`);
                }
            }

            // Se não tem canal específico, usa o sistema
            if (!channel) {
                channel = guild.systemChannel;
            }

            if (!channel) {
                logger.error(`Não foi possível encontrar um canal válido em ${guild.name}`);
                return false;
            }

            // Cria um novo webhook
            const webhook = await channel.createWebhook({
                name: 'IGNIS Logs',
                avatar: 'https://cdn.discordapp.com/avatars/1404584949285388339/3c28165b10ffdde42c3f76692513ca25.webp',
                reason: 'Configuração automática do sistema de logs'
            });

            // Registra o webhook (tipo 'logs')
            const typeMap = this.webhooks.get(guild.id) || new Map();
            typeMap.set('logs', { name: guild.name, webhook: new WebhookClient({ url: webhook.url }) });
            this.webhooks.set(guild.id, typeMap);

            await this.saveConfig();
            // Persistir em DB para durabilidade entre deploys
            try {
                await this.persistToDB(guild.id, { type: 'logs', name: guild.name, url: webhook.url, channel_id: channel?.id || null, channel_name: channel?.name || null, enabled: true });
            } catch {}
            logger.info(`Webhook configurado com sucesso para ${guild.name}`);
            return true;
        } catch (error) {
            logger.error(`Erro ao configurar webhook para ${guild.name}:`, error);
            return false;
        }
    }

    async sendTicketLog(guildId, event, data) {
        // Choose target webhook type using guild-configured routing if available, else defaults
        let preferredType = null;
        try {
            const storage = require('../storage');
            const cfg = await storage.getGuildConfig(guildId);
            const routing = cfg && cfg.webhookRouting ? cfg.webhookRouting : null;
            if (routing && typeof routing === 'object' && routing[event]) preferredType = String(routing[event]);
        } catch {}
        if (!preferredType) {
            preferredType = (event === 'update') ? 'updates' : (event === 'create' || event === 'close') ? 'tickets' : 'logs';
        }
        const typeMap = this.webhooks.get(guildId);
        const webhookInfo = typeMap?.get?.(preferredType) || typeMap?.get?.('logs');
        if (!webhookInfo || !webhookInfo.webhook?.url) {
            logger.debug(`Webhook não configurado para o servidor ${guildId}. Ticket log não enviado.`);
            return;
        }

        try {
            const embed = new EmbedBuilder()
                .setColor(this.getColorForType(event));

            switch (event) {
                case 'create':
                    embed
                        .setTitle('📩 Ticket Aberto')
                        .setDescription(`Ticket criado por ${data.author?.tag || 'Usuário desconhecido'}`)
                        .addFields(
                            { name: '🆔 ID do Ticket', value: data.ticketId || 'N/A', inline: true },
                            { name: '📁 Categoria', value: data.category || 'N/A', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: `ID do Usuário: ${data.author?.id || 'N/A'}` });
                    
                    if (data.author?.avatarURL) {
                        try {
                            embed.setThumbnail(data.author.avatarURL());
                        } catch (error) {
                            logger.warn('Erro ao definir thumbnail:', error.message);
                        }
                    }
                    break;

                case 'close':
                    embed
                        .setTitle('🔒 Ticket Encerrado')
                        .setDescription(`Ticket encerrado por ${data.closedBy?.tag || 'Usuário desconhecido'}`)
                        .addFields(
                            { name: '🆔 ID do Ticket', value: data.ticketId || 'N/A', inline: true },
                            { name: '⏱️ Duração', value: data.duration || 'N/A', inline: true },
                            { name: '📝 Motivo', value: data.reason || 'Não especificado' }
                        )
                        .setTimestamp();
                    break;

                case 'update':
                    embed
                        .setTitle('📝 Ticket Atualizado')
                        .setDescription(`Ticket atualizado por ${data.updatedBy?.tag || 'Usuário desconhecido'}`)
                        .addFields(
                            { name: '🆔 ID do Ticket', value: data.ticketId || 'N/A', inline: true },
                            { name: '📊 Status', value: data.status || 'N/A', inline: true }
                        )
                        .setTimestamp();
                    break;
            }

            // Send webhook message
            const payload = {
                embeds: [embed],
                username: `${webhookInfo.name} Tickets`,
                avatarURL: data.guild?.iconURL?.() || undefined
            };

            // Add transcript file if available
            if (data.files && data.files.length > 0) {
                payload.files = data.files;
            }

            await webhookInfo.webhook.send(payload);
        } catch (error) {
            logger.error(`Error sending webhook for guild ${guildId}:`, error);
        }
    }

    getColorForType(type) {
        switch (type) {
            case 'create': return 0x00FF00;  // Verde
            case 'close': return 0xFF0000;   // Vermelho
            case 'update': return 0xFFFF00;  // Amarelo
            default: return 0x7289DA;        // Discord Blurple
        }
    }

    async addWebhook(guildId, typeOrName, nameOrUrl, urlMaybe) {
        try {
            // Overloads supported:
            // (guildId, type, name, url) or (guildId, name, url) -> defaults to type 'logs'
            let type = 'logs';
            let name;
            let webhookUrl;
            if (urlMaybe) {
                type = String(typeOrName || 'logs');
                name = nameOrUrl;
                webhookUrl = urlMaybe;
            } else {
                name = typeOrName;
                webhookUrl = nameOrUrl;
            }

            // Validate webhook URL
            if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                throw new Error('Invalid webhook URL');
            }

            // Create webhook client
            const webhook = new WebhookClient({ url: webhookUrl });
            const typeMap = this.webhooks.get(guildId) || new Map();
            typeMap.set(type, { name, webhook });
            this.webhooks.set(guildId, typeMap);

            // Save configuration
            await this.saveConfig();
            // Persist to DB
            await this.persistToDB(guildId, { type, name, url: webhookUrl, enabled: true });
            return true;
        } catch (error) {
            logger.error('Error adding webhook:', error);
            return false;
        }
    }

    async removeWebhook(guildId, type = null) {
        try {
            const typeMap = this.webhooks.get(guildId);
            if (!typeMap) return true;
            if (type) {
                typeMap.delete(type);
                if (typeMap.size === 0) this.webhooks.delete(guildId);
                await this.saveConfig();
                await this.persistToDB(guildId, { type, enabled: false });
            } else {
                // Remove all types for this guild
                const types = Array.from(typeMap.keys());
                this.webhooks.delete(guildId);
                await this.saveConfig();
                for (const t of types) {
                    try { await this.persistToDB(guildId, { type: t, enabled: false }); } catch {}
                }
            }
            return true;
        } catch (error) {
            logger.error('Error removing webhook:', error);
            return false;
        }
    }

    // Método para configurar webhook automaticamente para um servidor
    async setupForGuild(guild) {
        try {
            logger.info(`Configurando webhook para o servidor ${guild.name} (${guild.id})`);
            
            // Verificar se já existe um webhook válido (logs)
            const existingTypeMap = this.webhooks.get(guild.id);
            const existingInfo = existingTypeMap?.get?.('logs');
            if (existingInfo?.webhook?.url) {
                try {
                    // Tentar usar o webhook existente
                    await existingInfo.webhook.send({
                        embeds: [{
                            title: '✅ Webhook Verificado',
                            description: 'Sistema de logs cross-server está ativo!',
                            color: 0x4CAF50,
                            timestamp: new Date()
                        }]
                    });
                    logger.info(`Webhook existente verificado para ${guild.name}`);
                    return true;
                } catch (error) {
                    logger.warn(`Webhook existente inválido para ${guild.name}, recriando...`);
                }
            }

            // Procurar um canal apropriado
            let channel = null;
            
            // 1. Procurar por um canal de logs específico
            channel = guild.channels.cache.find(c => 
                c.name.includes('log') && c.type === 0 && 
                c.permissionsFor(guild.members.me)?.has(['SendMessages', 'ManageWebhooks'])
            );

            // 2. Se não encontrou, procurar canal de tickets
            if (!channel) {
                channel = guild.channels.cache.find(c => 
                    (c.name.includes('ticket') || c.name.includes('arquivo')) && c.type === 0 && 
                    c.permissionsFor(guild.members.me)?.has(['SendMessages', 'ManageWebhooks'])
                );
            }

            // 3. Se não encontrou, usar canal sistema
            if (!channel) {
                channel = guild.systemChannel;
            }

            // 4. Se ainda não tem canal, criar um
            if (!channel) {
                try {
                    channel = await guild.channels.create({
                        name: '📋-tickets-logs',
                        type: 0,
                        topic: 'Canal automático para logs de tickets cross-server',
                        reason: 'Configuração automática do sistema de webhooks'
                    });
                    logger.info(`Canal de logs criado: ${channel.name} no servidor ${guild.name}`);
                } catch (createError) {
                    logger.error(`Erro ao criar canal de logs no servidor ${guild.name}:`, createError);
                    return false;
                }
            }

            if (!channel) {
                logger.error(`Não foi possível encontrar ou criar um canal válido em ${guild.name}`);
                return false;
            }

            // Criar o webhook
            const webhook = await channel.createWebhook({
                name: 'IGNIS Cross-Server Logs',
                avatar: 'https://cdn.discordapp.com/avatars/1404584949285388339/3c28165b10ffdde42c3f76692513ca25.webp',
                reason: 'Configuração automática do sistema de logs cross-server'
            });

            // Registrar o webhook (logs)
            const typeMap = this.webhooks.get(guild.id) || new Map();
            typeMap.set('logs', { name: guild.name, webhook: new WebhookClient({ url: webhook.url }) });
            this.webhooks.set(guild.id, typeMap);

            await this.saveConfig();
            // Persistir em DB para durabilidade
            try {
                await this.persistToDB(guild.id, { type: 'logs', name: guild.name, url: webhook.url, channel_id: channel?.id || null, channel_name: channel?.name || null, enabled: true });
            } catch {}

            // Enviar mensagem de confirmação
            await webhook.send({
                embeds: [{
                    title: '🎉 Webhook Configurado!',
                    description: `Sistema de logs cross-server ativo no canal ${channel.name}`,
                    color: 0x4CAF50,
                    fields: [
                        { name: '📋 Canal', value: `<#${channel.id}>`, inline: true },
                        { name: '🖥️ Servidor', value: guild.name, inline: true }
                    ],
                    timestamp: new Date(),
                    footer: { text: 'IGNIS Cross-Server Logging System' }
                }]
            });

            logger.info(`✅ Webhook configurado com sucesso para ${guild.name} no canal ${channel.name}`);
            return true;
        } catch (error) {
            logger.error(`❌ Erro ao configurar webhook para ${guild.name}:`, error);
            return false;
        }
    }

    // Helper getters
    getWebhookInfo(guildId, type = 'logs') {
        const typeMap = this.webhooks.get(guildId);
        return typeMap?.get?.(type) || null;
    }

    getLoadedTypes(guildId) {
        const typeMap = this.webhooks.get(guildId);
        return typeMap ? Array.from(typeMap.keys()) : [];
    }

    getAllLoaded() {
        const out = {};
        for (const [gid, typeMap] of this.webhooks) {
            out[gid] = Array.from(typeMap.keys());
        }
        return out;
    }
}

module.exports = WebhookManager;
