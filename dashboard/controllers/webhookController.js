const { webhookSystem, EventTypes, testarWebhook, configurarWebhook, removerWebhook, toggleWebhook, getConfiguracao } = require('../../utils/webhooks');

class WebhookController {
    // Get webhook configurations for guild
    async getWebhooks(req, res) {
        try {
            const { guildId } = req.params;
            const config = getConfiguracao(guildId);

            // Retornar configuração formatada
            const formattedConfig = {
                guildId,
                webhooks: Object.entries(config).map(([eventType, data]) => ({
                    eventType,
                    url: data.url,
                    enabled: data.enabled,
                    updateMode: data.updateMode,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt
                })),
                availableEventTypes: Object.values(EventTypes)
            };

            res.json(formattedConfig);
        } catch (error) {
            console.error('Error getting webhooks:', error);
            res.status(500).json({ error: 'Failed to get webhooks' });
        }
    }

    // Set webhook for event type
    async setWebhook(req, res) {
        const { guildId } = req.params;
        const { eventType, webhookUrl, enabled = true, updateMode = 'new' } = req.body;

        if (!eventType || !webhookUrl) {
            return res.status(400).json({ error: 'Missing required fields: eventType and webhookUrl' });
        }

        // Validar event type
        if (!Object.values(EventTypes).includes(eventType)) {
            return res.status(400).json({
                error: 'Invalid event type',
                availableTypes: Object.values(EventTypes)
            });
        }

        try {
            // Configurar webhook
            const success = await configurarWebhook(guildId, eventType, webhookUrl, {
                enabled,
                updateMode
            });

            if (!success) {
                return res.status(400).json({ error: 'Invalid webhook URL or configuration' });
            }

            // Enviar webhook de confirmação
            await testarWebhook(guildId, eventType, req.user?.tag || 'Dashboard User');

            res.json({
                success: true,
                message: 'Webhook configured successfully',
                eventType,
                enabled,
                updateMode
            });
        } catch (error) {
            console.error('Error setting webhook:', error);
            res.status(500).json({ error: 'Failed to set webhook' });
        }
    }

    // Toggle webhook on/off
    async toggleWebhook(req, res) {
        const { guildId, eventType } = req.params;
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'Missing or invalid "enabled" field' });
        }

        try {
            const success = await toggleWebhook(guildId, eventType, enabled);

            if (!success) {
                return res.status(404).json({ error: 'Webhook not found for this event type' });
            }

            res.json({
                success: true,
                message: `Webhook ${enabled ? 'enabled' : 'disabled'}`,
                eventType,
                enabled
            });
        } catch (error) {
            console.error('Error toggling webhook:', error);
            res.status(500).json({ error: 'Failed to toggle webhook' });
        }
    }

    // Remove webhook configuration
    async removeWebhook(req, res) {
        const { guildId, eventType } = req.params;

        try {
            const removed = await removerWebhook(guildId, eventType);

            if (!removed) {
                return res.status(404).json({ error: 'Webhook not found' });
            }

            res.json({
                success: true,
                message: 'Webhook removed successfully',
                eventType
            });
        } catch (error) {
            console.error('Error removing webhook:', error);
            res.status(500).json({ error: 'Failed to remove webhook' });
        }
    }

    // Test webhook configuration
    async testWebhook(req, res) {
        const { guildId } = req.params;
        const { eventType } = req.body;

        if (!eventType) {
            return res.status(400).json({ error: 'Missing event type' });
        }

        if (!Object.values(EventTypes).includes(eventType)) {
            return res.status(400).json({
                error: 'Invalid event type',
                availableTypes: Object.values(EventTypes)
            });
        }

        try {
            const success = await testarWebhook(
                guildId,
                eventType,
                req.user?.tag || 'Dashboard User'
            );

            if (!success) {
                return res.status(404).json({
                    error: 'Webhook not found or disabled for this event type'
                });
            }

            res.json({
                success: true,
                message: 'Test message sent successfully',
                eventType
            });
        } catch (error) {
            console.error('Error testing webhook:', error);
            res.status(500).json({ error: 'Failed to test webhook' });
        }
    }

    // Get webhook statistics
    async getStats(req, res) {
        try {
            const { webhookSystem } = require('../../utils/webhooks');
            const stats = webhookSystem.getStats();

            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('Error getting webhook stats:', error);
            res.status(500).json({ error: 'Failed to get statistics' });
        }
    }
}

module.exports = new WebhookController();
