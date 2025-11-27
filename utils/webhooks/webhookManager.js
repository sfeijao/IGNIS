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
    // Throttle map for missing-log warnings: Map<guildId, timestamp>
    this.missingLogWarnAt = new Map();
    // Cache para webhooks externos configurados via logsOrganizados (URL -> WebhookClient)
    this.externalCache = new Map();
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
                    } catch (e) { logger.debug('Caught error:', e?.message || e); }
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
                        let externalFlag = false;
                        try {
                            // Best-effort: fetch webhook metadata to detect origin guild; ignore failures
                            const probe = new WebhookClient({ url: w.url });
                            const meta = await probe.fetch().catch(() => null);
                            if (meta && meta.guildId && meta.guildId !== w.guild_id) externalFlag = true;
                            typeMap.set((w.type || 'logs'), { name: w.name || (this.client?.guilds?.cache.get(w.guild_id)?.name) || 'Logs', webhook: probe, external: externalFlag });
                        } catch {
                            typeMap.set((w.type || 'logs'), { name: w.name || (this.client?.guilds?.cache.get(w.guild_id)?.name) || 'Logs', webhook: new WebhookClient({ url: w.url }), external: externalFlag });
                        }
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
                        enabled: true,
                        external: !!info.external
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

            // Update in-memory runtime map immediately so logs start flowing without restart
            const typeMap = this.webhooks.get(guildId) || new Map();
            if (enabled) {
                try {
                    typeMap.set(type, { name: name || type, webhook: new WebhookClient({ url }) });
                    this.webhooks.set(guildId, typeMap);
                } catch (e) {
                    logger.warn('Runtime webhook client init failed:', e?.message || e);
                }
            } else {
                if (typeMap.has(type)) {
                    typeMap.delete(type);
                    if (typeMap.size === 0) this.webhooks.delete(guildId);
                }
            }
        } catch (e) {
            logger.warn('persistToDB webhook error:', e && e.message ? e.message : e);
        }
    }

    async verifyAndSetupWebhook(guild, channel) {
        try {
            // Se existir configuração externa para este guild, não criar webhook local
            try {
                const storage = require('../storage');
                const cfg = await storage.getGuildConfig(guild.id);
                let ext = cfg?.logsOrganizados || null;
                if (!ext || (typeof ext === 'object' && Object.keys(ext).length === 0)) {
                    const centralGuildId = String(process.env.LOGS_SERVER_ID || '1408278468822565075');
                    if (centralGuildId && centralGuildId !== guild.id) {
                        const centralCfg = await storage.getGuildConfig(centralGuildId);
                        const all = centralCfg?.logsOrganizados || null;
                        if (all && typeof all === 'object') {
                            const candidates = new Set([String(guild.id)]);
                            const s = this._slug(guild.name);
                            if (s) candidates.add(s);
                            for (const [k,v] of Object.entries(all)) {
                                if (!v) continue;
                                const key = this._slug(String(k));
                                if (candidates.has(key)) { ext = { [k]: v }; break; }
                            }
                        }
                    }
                }
                if (ext && Object.keys(ext).length > 0) {
                    logger.info(`WebhookManager: configuração externa detetada para ${guild.name}; ignorando criação local de webhook`);
                    return true;
                }
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
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
            let externalFlag = false;
            try {
                const meta = await (new WebhookClient({ url: webhook.url })).fetch().catch(()=>null);
                if (meta && meta.guildId && meta.guildId !== guild.id) externalFlag = true;
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
            typeMap.set('logs', { name: guild.name, webhook: new WebhookClient({ url: webhook.url }), external: externalFlag });
            this.webhooks.set(guild.id, typeMap);

            await this.saveConfig();
            // Persistir em DB para durabilidade entre deploys
            try {
                await this.persistToDB(guild.id, { type: 'logs', name: guild.name, url: webhook.url, channel_id: channel?.id || null, channel_name: channel?.name || null, enabled: true });
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
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
            // Se existir configuração de logsOrganizados, podemos ter webhooks externos
            // Formato esperado: cfg.logsOrganizados = { origemKey: { webhookUrl, ... } }
            let ext = cfg && cfg.logsOrganizados ? cfg.logsOrganizados : null;
            // Fallback inteligente: se a configuração não estiver no guild de origem, procurar no guild de LOGS central
            if (!ext || (typeof ext === 'object' && Object.keys(ext).length === 0)) {
                try {
                    const centralGuildId = String(process.env.LOGS_SERVER_ID || '1408278468822565075');
                    if (centralGuildId && centralGuildId !== guildId) {
                        const centralCfg = await storage.getGuildConfig(centralGuildId);
                        const all = centralCfg && centralCfg.logsOrganizados ? centralCfg.logsOrganizados : null;
                        if (all && typeof all === 'object') {
                            // Selecionar entradas cujo key combine com o guild de origem (por id ou slug do nome)
                            const candidates = new Set();
                            try { candidates.add(String(guildId)); } catch (e) { logger.debug('Caught error:', e?.message || e); }
                            try {
                                const name = data?.guild?.name || '';
                                const s = this._slug(String(name)); if (s) candidates.add(s);
                            } catch (e) { logger.debug('Caught error:', e?.message || e); }
                            const subset = {};
                            for (const [k,v] of Object.entries(all)) {
                                if (!v) continue;
                                const key = this._slug(String(k));
                                if (candidates.has(key)) subset[k] = v;
                            }
                            if (Object.keys(subset).length > 0) ext = subset;
                        }
                    }
                } catch (e) { logger.debug('Caught error:', e?.message || e); }
            }
            // Se ainda não houver externos, usar webhooks externos adicionados manualmente em runtime
            if (!ext || (typeof ext === 'object' && Object.keys(ext).length === 0)) {
                try {
                    const typeMap = this.webhooks.get(guildId);
                    if (typeMap && typeMap.size > 0) {
                        const manual = {};
                        for (const [t, info] of typeMap.entries()) {
                            if (info && info.external && info.webhook?.url) {
                                manual[t] = { webhookUrl: info.webhook.url };
                            }
                        }
                        if (Object.keys(manual).length > 0) {
                            ext = manual;
                        }
                    }
                } catch (e) { logger.debug('Caught error:', e?.message || e); }
            }
            data.__externalLogs = ext;
            // Preferir externos automaticamente quando existirem (pode forçar local com PREFER_EXTERNAL_LOGS=false)
            const envPref = String(process.env.PREFER_EXTERNAL_LOGS || '').toLowerCase();
            const haveExternal = !!(ext && Object.keys(ext).length > 0);
            data.__preferExternal = haveExternal && envPref !== 'false';
            if (process.env.WEBHOOK_DEBUG_EXTERNAL === 'true') {
                try {
                    logger.debug(`WebhookManager: extCandidates=${Object.keys(ext||{}).join(',')||'none'} preferExternal=${data.__preferExternal}`);
                } catch (e) { logger.debug('Caught error:', e?.message || e); }
            }
        } catch (e) { logger.debug('Caught error:', e?.message || e); }
        if (!preferredType) {
            // Defaults: claim/release/update -> 'updates', create/close -> 'tickets', otherwise 'logs'
            preferredType = (event === 'update' || event === 'claim' || event === 'release')
                ? 'updates'
                : (event === 'create' || event === 'close')
                ? 'tickets'
                : 'logs';
        }
        const typeMap = this.webhooks.get(guildId);
        const webhookInfo = typeMap?.get?.(preferredType) || typeMap?.get?.('logs');
        if (!webhookInfo || !webhookInfo.webhook?.url) {
            // Attempt one on-demand hydration (in case runtime started before DB ready)
            try { await this.hydrateFromStorage(); } catch (e) { logger.debug('Caught error:', e?.message || e); }
            const refreshed = this.webhooks.get(guildId);
            const w2 = refreshed?.get?.(preferredType) || refreshed?.get?.('logs');
            if (!w2 || !w2.webhook?.url) {
                const now = Date.now();
                const lastWarn = this.missingLogWarnAt.get(guildId) || 0;
                if (now - lastWarn > 60000) { // throttle 60s
                    logger.info(`ℹ️  Nenhum webhook carregado para guild ${guildId} (evento ${event}); logs serão ignorados até configurar/criar um webhook.`);
                    this.missingLogWarnAt.set(guildId, now);
                }
                // Mesmo que não haja webhook interno, ainda tentamos externos se existirem
                return await this.sendToExternalWebhooks(guildId, event, data);
            }
            return this.sendTicketLog(guildId, event, data); // Retry once with hydrated map
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

                case 'claim':
                    embed
                        .setTitle('✋ Ticket Reclamado')
                        .setDescription(`Ticket reclamado por ${data.claimedBy?.tag || 'Usuário desconhecido'}`)
                        .addFields(
                            { name: '🆔 ID do Ticket', value: data.ticketId || 'N/A', inline: true },
                            { name: '📣 Canal', value: data.channelId ? `<#${data.channelId}>` : 'N/A', inline: true },
                            { name: '👤 Responsável', value: data.claimedBy?.id ? `<@${data.claimedBy.id}>` : 'N/A', inline: true },
                            { name: '📊 Status', value: `${data.previousStatus || 'N/A'} → ${data.newStatus || 'claimed'}` }
                        )
                        .setTimestamp();
                    break;

                case 'release':
                    embed
                        .setTitle('👐 Ticket Libertado')
                        .setDescription(`Ticket libertado por ${data.releasedBy?.tag || 'Usuário desconhecido'}`)
                        .addFields(
                            { name: '🆔 ID do Ticket', value: data.ticketId || 'N/A', inline: true },
                            { name: '📣 Canal', value: data.channelId ? `<#${data.channelId}>` : 'N/A', inline: true },
                            { name: '👤 Antigo responsável', value: data.previousAssigneeId ? `<@${data.previousAssigneeId}>` : 'N/A', inline: true },
                            { name: '📊 Status', value: `${data.previousStatus || 'claimed'} → ${data.newStatus || 'open'}` }
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

            // Add transcript file if available (with size validation)
            if (data.files && Array.isArray(data.files) && data.files.length > 0) {
                const validFiles = data.files.filter(f => {
                    if (!f || !f.attachment) return false;
                    // Discord webhook file limit is 25MB, be conservative with 20MB
                    const size = Buffer.isBuffer(f.attachment) ? f.attachment.length : 0;
                    if (size > 20 * 1024 * 1024) {
                        logger.warn(`Skipping oversized file attachment (${(size / 1024 / 1024).toFixed(2)}MB) for ticket ${data.ticketId}`);
                        return false;
                    }
                    return true;
                });
                if (validFiles.length > 0) {
                    payload.files = validFiles;
                }
            }

            // Se preferir externos e houver pelo menos um, não enviar local para evitar duplicações
            const externalSent = await this.sendToExternalWebhooks(guildId, event, data, payload);
            if (process.env.WEBHOOK_DEBUG_EXTERNAL === 'true') {
                try {
                    logger.debug(`WebhookManager: envio externo=${externalSent} preferExternal=${data.__preferExternal} guild=${guildId} tiposCarregados=${Array.from(this.webhooks.get(guildId)?.keys()||[]).join(',')}`);
                } catch (e) { logger.debug('Caught error:', e?.message || e); }
            }
            if (!data.__preferExternal || !externalSent) {
                await webhookInfo.webhook.send(payload);
            } else if (process.env.WEBHOOK_DEBUG_EXTERNAL === 'true') {
                try { logger.debug(`WebhookManager: skip envio local para evitar duplicação (guild ${guildId})`); } catch (e) { logger.debug('Caught error:', e?.message || e); }
            }
        } catch (error) {
            // Se for webhook desconhecido (apagado no Discord), limpar e persistir remoção para evitar erros repetidos
            const errMsg = error && (error.message || String(error));
            const isUnknownWebhook = errMsg && /Unknown Webhook/i.test(errMsg);
            logger.error(`Error sending webhook for guild ${guildId}:`, error);
            if (isUnknownWebhook && webhookInfo?.webhook?.url) {
                try {
                    const typeMap = this.webhooks.get(guildId);
                    if (typeMap) {
                        // encontrar a entry que falhou
                        for (const [t, info] of typeMap.entries()) {
                            if (info === webhookInfo) {
                                typeMap.delete(t);
                                logger.warn(`WebhookManager: removendo webhook inválido (${t}) para guild ${guildId}`);
                                if (typeMap.size === 0) this.webhooks.delete(guildId);
                                await this.saveConfig().catch(()=>{});
                                try { await this.persistToDB(guildId, { type: t, enabled: false }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
                                break;
                            }
                        }
                    }
                } catch (cleanupErr) {
                    logger.warn('WebhookManager: falha ao limpar webhook inválido:', cleanupErr?.message || cleanupErr);
                }
            }
        }
    }

    // Utilitário simples para comparar chaves de servidores (remove acentos/espacos/emojis e põe minúsculas)
    _slug(s) {
        try {
            return String(s || '')
                .normalize('NFKD')
                .replace(/[\u0300-\u036f]/g, '') // diacríticos
                .replace(/<a?:[^>]+>/g, '') // emojis custom
                .replace(/[^a-zA-Z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .toLowerCase();
        } catch { return String(s||'').toLowerCase(); }
    }

    getColorForType(type) {
        switch (type) {
            case 'create': return 0x00FF00;  // Verde
            case 'close': return 0xFF0000;   // Vermelho
            case 'update': return 0xFFFF00;  // Amarelo
            case 'claim': return 0x10B981;   // Verde teal
            case 'release': return 0xF59E0B; // Laranja
            default: return 0x7289DA;        // Discord Blurple
        }
    }

    async addWebhook(guildId, typeOrName, nameOrUrl, urlMaybe, opts = {}) {
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

            // Validate webhook URL (accept discord.com/ptb/canary and discordapp.com)
            const discordWebhookRe = /^(https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/|https:\/\/discordapp\.com\/api\/webhooks\/)/;
            if (!webhookUrl || !discordWebhookRe.test(webhookUrl)) {
                throw new Error('Invalid webhook URL');
            }

            // Create webhook client
            const webhook = new WebhookClient({ url: webhookUrl });
            // Try to determine if this webhook is cross-guild
            let externalFlag = !!opts.external;
            try {
                const fetched = await webhook.fetch().catch(() => null);
                if (fetched && fetched.guildId && fetched.guildId !== guildId) externalFlag = true;
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
            const typeMap = this.webhooks.get(guildId) || new Map();
            typeMap.set(type, { name, webhook, external: externalFlag });
            this.webhooks.set(guildId, typeMap);

            // Save configuration
            await this.saveConfig();
            // Persist to DB
            await this.persistToDB(guildId, { type, name, url: webhookUrl, enabled: true, external: externalFlag });
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
                    try { await this.persistToDB(guildId, { type: t, enabled: false }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
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
            // Se houver configuração externa, NÃO criar webhook local
            try {
                const storage = require('../storage');
                const cfg = await storage.getGuildConfig(guild.id);
                let ext = cfg?.logsOrganizados || null;
                if (!ext || (typeof ext === 'object' && Object.keys(ext).length === 0)) {
                    const centralGuildId = String(process.env.LOGS_SERVER_ID || '1408278468822565075');
                    if (centralGuildId && centralGuildId !== guild.id) {
                        const centralCfg = await storage.getGuildConfig(centralGuildId);
                        const all = centralCfg?.logsOrganizados || null;
                        if (all && typeof all === 'object') {
                            const candidates = new Set([String(guild.id)]);
                            const s = this._slug(guild.name);
                            if (s) candidates.add(s);
                            for (const [k,v] of Object.entries(all)) {
                                if (!v) continue;
                                const key = this._slug(String(k));
                                if (candidates.has(key)) { ext = { [k]: v }; break; }
                            }
                        }
                    }
                }
                if (ext && Object.keys(ext).length > 0) {
                    logger.info(`WebhookManager: configuração externa detetada para ${guild.name}; saltando criação local`);
                    return true;
                }
            } catch (e) { logger.debug('Caught error:', e?.message || e); }

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
            let externalFlag = false;
            try {
                const meta = await (new WebhookClient({ url: webhook.url })).fetch().catch(()=>null);
                if (meta && meta.guildId && meta.guildId !== guild.id) externalFlag = true;
            } catch (e) { logger.debug('Caught error:', e?.message || e); }
            typeMap.set('logs', { name: guild.name, webhook: new WebhookClient({ url: webhook.url }), external: externalFlag });
            this.webhooks.set(guild.id, typeMap);

            await this.saveConfig();
            // Persistir em DB para durabilidade
            try {
                await this.persistToDB(guild.id, { type: 'logs', name: guild.name, url: webhook.url, channel_id: channel?.id || null, channel_name: channel?.name || null, enabled: true });
            } catch (e) { logger.debug('Caught error:', e?.message || e); }

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

    // Helper for dashboard to introspect loaded types
    getLoadedTypes(guildId) {
        const map = this.webhooks.get(guildId);
        if (!map) return [];
        return Array.from(map.keys());
    }

    /**
     * Resolve preferred target for ticket/event logs without performing a send.
     * Returns a diagnostic object describing whether local or external will be used.
     * @param {string} guildId
     * @param {string|null} event Hint for routing type selection (create/close/update/claim/release)
     */
    getPreferredTarget(guildId, event = null) {
        const steps = [];
        let preferredType = null;
        let cfg = null;
        let routing = null;
        const out = {
            guildId,
            mode: 'none',              // 'external' | 'local' | 'none'
            preferExternal: false,
            eventHint: event,
            eventTypeUsed: null,
            localWebhook: null,
            externalCandidates: { source: 'none', count: 0, keys: [], urls: [] },
            reason: 'no webhook configured',
            steps
        };
        try {
            const storage = require('../storage');
            cfg = storage.getGuildConfig ? storage.getGuildConfig(guildId) : null;
            if (cfg && typeof cfg.then === 'function') {
                // handle promise
                steps.push('awaiting guild config promise');
            }
        } catch (e) {
            steps.push('failed load origin config: ' + (e?.message || e));
        }
        // If async promise returned, this function can't await (kept sync for quick dashboard); attempt sync value only
        if (cfg && typeof cfg.then === 'function') cfg = null;
        try {
            routing = cfg && cfg.webhookRouting ? cfg.webhookRouting : null;
            if (routing && event && routing[event]) {
                preferredType = String(routing[event]);
                steps.push(`routing override for event ${event} => type ${preferredType}`);
            }
        } catch (e) { logger.debug('Caught error:', e?.message || e); }
        if (!preferredType) {
            preferredType = (event === 'update' || event === 'claim' || event === 'release')
                ? 'updates'
                : (event === 'create' || event === 'close')
                ? 'tickets'
                : 'logs';
            steps.push('default type computed: ' + preferredType);
        }
        out.eventTypeUsed = preferredType;

        // External resolution (mirror logic of sendTicketLog but sync & simplified)
        let ext = cfg && cfg.logsOrganizados ? cfg.logsOrganizados : null;
        let source = 'origin';
        if (!ext || (typeof ext === 'object' && Object.keys(ext).length === 0)) {
            try {
                const centralGuildId = String(process.env.LOGS_SERVER_ID || '1408278468822565075');
                if (centralGuildId && centralGuildId !== guildId) {
                    const storage = require('../storage');
                    let centralCfg = storage.getGuildConfig ? storage.getGuildConfig(centralGuildId) : null;
                    if (centralCfg && typeof centralCfg.then === 'function') centralCfg = null; // keep sync
                    const all = centralCfg && centralCfg.logsOrganizados ? centralCfg.logsOrganizados : null;
                    if (all && typeof all === 'object') {
                        const candidates = new Set([String(guildId)]);
                        const guildName = this.client?.guilds?.cache?.get(guildId)?.name || '';
                        const s = this._slug(guildName); if (s) candidates.add(s);
                        const subset = {};
                        for (const [k,v] of Object.entries(all)) {
                            if (!v) continue;
                            const key = this._slug(String(k));
                            if (candidates.has(key)) subset[k] = v;
                        }
                        if (Object.keys(subset).length > 0) {
                            ext = subset; source = 'central'; steps.push('matched external via central config');
                        } else {
                            steps.push('no external match in central config');
                        }
                    } else steps.push('central config missing logsOrganizados');
                } else steps.push('central fallback skipped (same guild or LOGS_SERVER_ID empty)');
            } catch (e) {
                steps.push('error central fallback: ' + (e?.message || e));
            }
        } else steps.push('found external in origin config');

        // Runtime externos (webhooks registados manualmente) se ainda não houver
        if (!ext || (typeof ext === 'object' && Object.keys(ext).length === 0)) {
            try {
                const typeMap = this.webhooks.get(guildId);
                if (typeMap && typeMap.size > 0) {
                    const manual = {};
                    for (const [t, info] of typeMap.entries()) {
                        if (info && info.external && info.webhook?.url) manual[t] = { webhookUrl: info.webhook.url };
                    }
                    if (Object.keys(manual).length > 0) {
                        ext = manual; source = 'runtime'; steps.push('using runtime external webhooks');
                    } else steps.push('no runtime external webhooks');
                } else steps.push('no typeMap for runtime externals');
            } catch { steps.push('error probing runtime externals'); }
        }

        const haveExternal = !!(ext && Object.keys(ext).length > 0);
        const envPref = String(process.env.PREFER_EXTERNAL_LOGS || '').toLowerCase();
        out.preferExternal = haveExternal && envPref !== 'false';
        if (haveExternal) {
            const entries = Object.entries(ext).filter(([k,v]) => v && v.webhookUrl);
            out.externalCandidates = { source, count: entries.length, keys: entries.map(([k])=>k), urls: entries.map(([_,v])=>v.webhookUrl) };
            steps.push(`external candidates=${entries.length}`);
        } else steps.push('no external candidates');

        // Local webhook presence
        const typeMap = this.webhooks.get(guildId);
        const webhookInfo = typeMap?.get?.(preferredType) || typeMap?.get?.('logs');
        if (webhookInfo?.webhook?.url) {
            out.localWebhook = { type: preferredType, url: webhookInfo.webhook.url, external: !!webhookInfo.external };
            steps.push(`local webhook present type=${preferredType}`);
        } else steps.push('no local webhook loaded');

        if (out.preferExternal && out.externalCandidates.count > 0) {
            out.mode = 'external';
            out.reason = 'external configuration present and preference enabled';
        } else if (out.localWebhook) {
            out.mode = 'local';
            out.reason = out.preferExternal ? 'external preference disabled via env flag' : 'no external config found';
        } else {
            out.mode = 'none';
            out.reason = haveExternal ? 'external present but no valid URLs' : 'no webhook (local or external)';
        }

        return out;
    }

    /**
     * Async version that actually awaits storage and central fallback.
     * Mirrors sendTicketLog routing without sending anything.
     */
    async getPreferredTargetAsync(guildId, event = null) {
        const steps = [];
        let preferredType = null;
        const out = {
            guildId,
            mode: 'none',
            preferExternal: false,
            eventHint: event,
            eventTypeUsed: null,
            localWebhook: null,
            externalCandidates: { source: 'none', count: 0, keys: [], urls: [] },
            reason: 'no webhook configured',
            steps
        };
        let routing = null;
        try {
            const storage = require('../storage');
            const cfg = await storage.getGuildConfig(guildId).catch(()=>null);
            routing = cfg && cfg.webhookRouting ? cfg.webhookRouting : null;
            if (routing && event && routing[event]) {
                preferredType = String(routing[event]);
                steps.push(`routing override for event ${event} => type ${preferredType}`);
            }
            // External resolution
            let ext = cfg && cfg.logsOrganizados ? cfg.logsOrganizados : null;
            let source = 'origin';
            if (!ext || (typeof ext === 'object' && Object.keys(ext).length === 0)) {
                const centralGuildId = String(process.env.LOGS_SERVER_ID || '1408278468822565075');
                if (centralGuildId && centralGuildId !== guildId) {
                    const centralCfg = await storage.getGuildConfig(centralGuildId).catch(()=>null);
                    const all = centralCfg && centralCfg.logsOrganizados ? centralCfg.logsOrganizados : null;
                    if (all && typeof all === 'object') {
                        const candidates = new Set([String(guildId)]);
                        const guildName = this.client?.guilds?.cache?.get(guildId)?.name || '';
                        const s = this._slug(guildName); if (s) candidates.add(s);
                        const subset = {};
                        for (const [k,v] of Object.entries(all)) {
                            if (!v) continue; const key = this._slug(String(k));
                            if (candidates.has(key)) subset[k] = v;
                        }
                        if (Object.keys(subset).length > 0) { ext = subset; source = 'central'; steps.push('matched external via central config'); }
                        else steps.push('no external match in central config');
                    } else steps.push('central config missing logsOrganizados');
                } else steps.push('central fallback skipped (same guild or LOGS_SERVER_ID empty)');
            } else steps.push('found external in origin config');

            // Runtime externos como fallback
            if (!ext || (typeof ext === 'object' && Object.keys(ext).length === 0)) {
                try {
                    const typeMap = this.webhooks.get(guildId);
                    if (typeMap && typeMap.size > 0) {
                        const manual = {};
                        for (const [t, info] of typeMap.entries()) {
                            if (info && info.external && info.webhook?.url) manual[t] = { webhookUrl: info.webhook.url };
                        }
                        if (Object.keys(manual).length > 0) { ext = manual; source = 'runtime'; steps.push('using runtime external webhooks'); }
                        else steps.push('no runtime external webhooks');
                    } else steps.push('no typeMap for runtime externals');
                } catch { steps.push('error probing runtime externals'); }
            }

            const haveExternal = !!(ext && Object.keys(ext).length > 0);
            const envPref = String(process.env.PREFER_EXTERNAL_LOGS || '').toLowerCase();
            out.preferExternal = haveExternal && envPref !== 'false';
            if (haveExternal) {
                const entries = Object.entries(ext).filter(([k,v]) => v && v.webhookUrl);
                out.externalCandidates = { source, count: entries.length, keys: entries.map(([k])=>k), urls: entries.map(([_,v])=>v.webhookUrl) };
                steps.push(`external candidates=${entries.length}`);
            } else steps.push('no external candidates');
        } catch (e) { steps.push('error loading configs: ' + (e?.message || e)); }

        if (!preferredType) {
            preferredType = (event === 'update' || event === 'claim' || event === 'release')
                ? 'updates'
                : (event === 'create' || event === 'close')
                ? 'tickets'
                : 'logs';
            steps.push('default type computed: ' + preferredType);
        }
        out.eventTypeUsed = preferredType;

        const typeMap = this.webhooks.get(guildId);
        const webhookInfo = typeMap?.get?.(preferredType) || typeMap?.get?.('logs');
        if (webhookInfo?.webhook?.url) {
            out.localWebhook = { type: preferredType, url: webhookInfo.webhook.url, external: !!webhookInfo.external };
            steps.push(`local webhook present type=${preferredType}`);
        } else steps.push('no local webhook loaded');

        if (out.preferExternal && out.externalCandidates.count > 0) {
            out.mode = 'external'; out.reason = 'external configuration present and preference enabled';
        } else if (out.localWebhook) {
            out.mode = 'local'; out.reason = out.preferExternal ? 'external preference disabled via env flag' : 'no external config found';
        } else { out.mode = 'none'; out.reason = 'no webhook (local or external)'; }

        return out;
    }

    /**
     * Async resolver mirroring sendTicketLog decision path but without sending.
     * Safe to use in HTTP routes for accurate diagnostics.
     */
    async resolveRouting(guildId, event = null, data = {}) {
        const steps = [];
        let preferredType = null;
        const out = {
            guildId,
            mode: 'none',
            preferExternal: false,
            eventHint: event,
            eventTypeUsed: null,
            localWebhook: null,
            externalCandidates: { source: 'none', count: 0, keys: [], urls: [] },
            reason: 'no webhook configured',
            steps
        };

        // Routing override by config
        try {
            const storage = require('../storage');
            const cfg = await storage.getGuildConfig(guildId).catch(() => null);
            const routing = cfg && cfg.webhookRouting ? cfg.webhookRouting : null;
            if (routing && event && routing[event]) {
                preferredType = String(routing[event]);
                steps.push(`routing override for event ${event} => type ${preferredType}`);
            }
            // External resolution from origin first
            let ext = cfg && cfg.logsOrganizados ? cfg.logsOrganizados : null;
            let source = 'origin';
            if (!ext || (typeof ext === 'object' && Object.keys(ext).length === 0)) {
                const centralGuildId = String(process.env.LOGS_SERVER_ID || '1408278468822565075');
                if (centralGuildId && centralGuildId !== guildId) {
                    try {
                        const centralCfg = await storage.getGuildConfig(centralGuildId).catch(() => null);
                        const all = centralCfg && centralCfg.logsOrganizados ? centralCfg.logsOrganizados : null;
                        if (all && typeof all === 'object') {
                            const candidates = new Set([String(guildId)]);
                            const guildName = this.client?.guilds?.cache?.get(guildId)?.name || (data?.guild?.name || '');
                            const s = this._slug(guildName); if (s) candidates.add(s);
                            const subset = {};
                            for (const [k,v] of Object.entries(all)) {
                                if (!v) continue;
                                const key = this._slug(String(k));
                                if (candidates.has(key)) subset[k] = v;
                            }
                            if (Object.keys(subset).length > 0) {
                                ext = subset; source = 'central'; steps.push('matched external via central config');
                            } else {
                                steps.push('no external match in central config');
                            }
                        } else {
                            steps.push('central config missing logsOrganizados');
                        }
                    } catch (e) { steps.push('error central fallback: ' + (e?.message || e)); }
                } else steps.push('central fallback skipped (same guild or LOGS_SERVER_ID empty)');
            } else steps.push('found external in origin config');

            // Runtime externos como fallback
            if (!ext || (typeof ext === 'object' && Object.keys(ext).length === 0)) {
                try {
                    const typeMap = this.webhooks.get(guildId);
                    if (typeMap && typeMap.size > 0) {
                        const manual = {};
                        for (const [t, info] of typeMap.entries()) {
                            if (info && info.external && info.webhook?.url) manual[t] = { webhookUrl: info.webhook.url };
                        }
                        if (Object.keys(manual).length > 0) { ext = manual; source = 'runtime'; steps.push('using runtime external webhooks'); }
                        else steps.push('no runtime external webhooks');
                    } else steps.push('no typeMap for runtime externals');
                } catch { steps.push('error probing runtime externals'); }
            }

            const haveExternal = !!(ext && Object.keys(ext).length > 0);
            const envPref = String(process.env.PREFER_EXTERNAL_LOGS || '').toLowerCase();
            out.preferExternal = haveExternal && envPref !== 'false';
            if (haveExternal) {
                const entries = Object.entries(ext).filter(([k,v]) => v && v.webhookUrl);
                out.externalCandidates = { source, count: entries.length, keys: entries.map(([k])=>k), urls: entries.map(([_,v])=>v.webhookUrl) };
                steps.push(`external candidates=${entries.length}`);
            } else steps.push('no external candidates');
        } catch (e) {
            steps.push('error reading config: ' + (e?.message || e));
        }

        if (!preferredType) {
            preferredType = (event === 'update' || event === 'claim' || event === 'release')
                ? 'updates'
                : (event === 'create' || event === 'close')
                ? 'tickets'
                : 'logs';
            steps.push('default type computed: ' + preferredType);
        }
        out.eventTypeUsed = preferredType;

        // Local presence
        const typeMap = this.webhooks.get(guildId);
        const webhookInfo = typeMap?.get?.(preferredType) || typeMap?.get?.('logs');
        if (webhookInfo?.webhook?.url) {
            out.localWebhook = { type: preferredType, url: webhookInfo.webhook.url, external: !!webhookInfo.external };
            steps.push(`local webhook present type=${preferredType}`);
        } else steps.push('no local webhook loaded');

        if (out.preferExternal && out.externalCandidates.count > 0) {
            out.mode = 'external';
            out.reason = 'external configuration present and preference enabled';
        } else if (out.localWebhook) {
            out.mode = 'local';
            out.reason = out.preferExternal ? 'external preference disabled via env flag' : 'no external config found';
        } else {
            out.mode = 'none';
            out.reason = 'no webhook (local or external)';
        }

        return out;
    }
}

// ===== Extensões para suportar webhooks externos (cross-server) =====
WebhookManager.prototype.sendToExternalWebhooks = async function(guildId, event, data, basePayload) {
    const ext = data.__externalLogs;
    if (!ext || typeof ext !== 'object') return false;
    const entries = Object.entries(ext).filter(([k,v]) => v && v.webhookUrl);
    if (!entries.length) return false;
    let anySuccess = false;
    for (const [key, info] of entries) {
        const url = info.webhookUrl;
        try {
            let client = this.externalCache.get(url);
            if (!client) {
                client = new WebhookClient({ url });
                this.externalCache.set(url, client);
            }
            const embedPayload = basePayload ? { ...basePayload } : undefined;
            const payload = embedPayload || this._buildExternalPayload(key, event, data);
            await client.send(payload);
            anySuccess = true;
        } catch (e) {
            logger.warn(`Falha ao enviar log externo (${key}) para guild ${guildId}: ${e?.message || e}`);
        }
    }
    return anySuccess;
};

WebhookManager.prototype._buildExternalPayload = function(originKey, event, data) {
    try {
        const embed = new EmbedBuilder()
            .setTitle(`🔁 [${originKey.toUpperCase()}] Evento de Ticket: ${event}`)
            .setColor(this.getColorForType(event))
            .setTimestamp();
        if (data && typeof data === 'object') {
            if (data.ticketId) embed.addFields({ name: '🆔 Ticket', value: String(data.ticketId), inline: true });
            if (data.channelId) embed.addFields({ name: '📣 Canal', value: `<#${data.channelId}>`, inline: true });
            if (data.author?.id) embed.addFields({ name: '👤 Autor', value: `<@${data.author.id}>`, inline: true });
            if (data.claimedBy?.id) embed.addFields({ name: '✋ Responsável', value: `<@${data.claimedBy.id}>`, inline: true });
            if (data.releasedBy?.id) embed.addFields({ name: '👐 Libertado por', value: `<@${data.releasedBy.id}>`, inline: true });
            if (data.updatedBy?.id) embed.addFields({ name: '📝 Atualizado por', value: `<@${data.updatedBy.id}>`, inline: true });
            if (data.status) embed.addFields({ name: '📊 Status', value: String(data.status), inline: true });
            if (data.reason) embed.addFields({ name: '📝 Motivo', value: String(data.reason).slice(0, 256) });
        }
        return { embeds: [embed], username: `IGNIS Logs Externos`, avatarURL: data.guild?.iconURL?.() || undefined };
    } catch {
        return { content: `[${originKey}] Ticket ${event}` };
    }
};

module.exports = WebhookManager;
