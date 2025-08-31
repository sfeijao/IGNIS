const { ChannelType, PermissionsBitField } = require('discord.js');
const Database = require('../database/database');
const logger = require('../../utils/logger');

async function buildWebhookUrl(webhook) {
    if (!webhook) return null;
    // webhook has id and token
    if (webhook.id && webhook.token) return `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;
    return null;
}

async function scanGuildAndSave(guild, client) {
    try {
        logger.info(`Auto-scan started for guild ${guild.id} (${guild.name})`);
        // Ensure caches
        await guild.roles.fetch().catch(() => null);
        await guild.channels.fetch().catch(() => null);

        const db = new Database();
        await db.initialize();

        // Detect category
        let ticketCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && /tickets?/i.test(c.name));
        if (ticketCategory) await db.setGuildConfig(guild.id, 'ticket_category_id', ticketCategory.id);

        // Detect verify role (pt/en variants)
        const verifyCandidates = ['Verificado','Verificada','Membro','Membros','Member','Verified','Verificado(a)','Não Verificado','Nao Verificado','Unverified','Unverified'];
        let verifyRole = guild.roles.cache.find(r => verifyCandidates.includes(r.name));
        if (verifyRole) await db.setGuildConfig(guild.id, 'verify_role_id', verifyRole.id);

        // Detect staff role
        const staffCandidates = ['Staff','Equipa','Equipe','Mod','Moderador','Moderadores','Admin','Administrador','Administradores','Suporte'];
        let staffRole = guild.roles.cache.find(r => staffCandidates.includes(r.name)) || guild.roles.cache.find(r => r.permissions && r.permissions.has(PermissionsBitField.Flags.ManageMessages));
        if (staffRole) await db.setGuildConfig(guild.id, 'staff_role_id', staffRole.id);

        // Detect or create ticket logs channel + webhook
        const logChannelNames = ['tickets-log','ticket-logs','ticket-vlog','tickets_log','logs-tickets'];
        // Only detect existing log channel/webhook; do NOT create channels or webhooks automatically.
        const logChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && logChannelNames.includes(c.name.toLowerCase()));
        if (logChannel) {
            await db.setGuildConfig(guild.id, 'log_channel_id', logChannel.id);
            // If there is a webhook in that channel, save it but do not create one.
            if (guild.members.me.permissions.has(PermissionsBitField.Flags.ManageWebhooks)) {
                const webhooks = await logChannel.fetchWebhooks().catch(() => null);
                const webhook = webhooks ? webhooks.first() : null;
                if (webhook) {
                    const webhookUrl = await buildWebhookUrl(webhook);
                    if (webhookUrl) await db.setGuildConfig(guild.id, 'archive_webhook_url', webhookUrl);
                }
            }
        }

        // mark scanned
        await db.setGuildConfig(guild.id, 'auto_scanned_at', String(Date.now()));
        logger.info(`Auto-scan completed for guild ${guild.id}`);
        return true;
    } catch (err) {
        logger.warn('Auto-scan failed', { error: err && err.message ? err.message : err });
        return false;
    }
}

module.exports = { scanGuildAndSave };
