const fs = require('fs').promises;
const path = require('path');
const { WebhookClient } = require('discord.js');

class WebhookManager {
    constructor() {
        this.webhooksPath = path.join(__dirname, '../data/webhooks.json');
        this.webhooks = {};
        this.loadWebhooks();
    }

    async loadWebhooks() {
        try {
            const data = await fs.readFile(this.webhooksPath, 'utf8');
            this.webhooks = JSON.parse(data);
        } catch (error) {
            logger.error('Error loading webhooks:', error);
            this.webhooks = {};
            await this.saveWebhooks();
        }
    }

    async saveWebhooks() {
        try {
            await fs.writeFile(this.webhooksPath, JSON.stringify(this.webhooks, null, 2));
        } catch (error) {
            logger.error('Error saving webhooks:', error);
        }
    }

    async setWebhook(guildId, eventType, webhookUrl) {
        if (!this.webhooks[guildId]) {
            this.webhooks[guildId] = {};
        }
        this.webhooks[guildId][eventType] = webhookUrl;
        await this.saveWebhooks();
    }

    async removeWebhook(guildId, eventType) {
        if (this.webhooks[guildId] && this.webhooks[guildId][eventType]) {
            delete this.webhooks[guildId][eventType];
            await this.saveWebhooks();
            return true;
        }
        return false;
    }

    async sendWebhook(guildId, eventType, payload) {
        try {
            if (!this.webhooks[guildId]?.[eventType]) {
                return false;
            }

            const webhook = new WebhookClient({ url: this.webhooks[guildId][eventType] });
            await this.retryWebhook(webhook, payload);
            return true;
        } catch (error) {
            logger.error(`Error sending webhook for guild ${guildId}, event ${eventType}:`, error);
            return false;
        }
    }

    async retryWebhook(webhook, payload, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                await webhook.send(payload);
                return;
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
            }
        }
    }

    getGuildWebhooks(guildId) {
        return this.webhooks[guildId] || {};
    }

    async validateWebhook(url) {
        try {
            const webhook = new WebhookClient({ url });
            await webhook.send({
                content: 'Webhook test successful',
                username: 'Webhook Validator'
            });
            return true;
        } catch (error) {
            logger.error('Webhook validation failed:', error);
            return false;
        }
    }
}

module.exports = new WebhookManager();
