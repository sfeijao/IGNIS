const webhookManager = require('../../utils/webhookManager');

class WebhookController {
    // Get webhook configurations for guild
    async getWebhooks(req, res) {
        const { guildId } = req.params;
        const webhooks = webhookManager.getGuildWebhooks(guildId);
        res.json(webhooks);
    }

    // Set webhook for event type
    async setWebhook(req, res) {
        const { guildId } = req.params;
        const { eventType, webhookUrl } = req.body;

        if (!eventType || !webhookUrl) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            // Validate webhook URL
            const isValid = await webhookManager.validateWebhook(webhookUrl);
            if (!isValid) {
                return res.status(400).json({ error: 'Invalid webhook URL' });
            }

            await webhookManager.setWebhook(guildId, eventType, webhookUrl);
            
            // Enviar webhook de teste com confirmação
            await webhookManager.sendWebhook(guildId, eventType, {
                embeds: [{
                    title: 'Webhook Configurado',
                    description: 'Esta mensagem confirma que o webhook foi configurado com sucesso.',
                    fields: [
                        { name: 'Evento', value: eventType, inline: true },
                        { name: 'Configurado por', value: req.user.tag, inline: true }
                    ],
                    color: 0x00ff00,
                    timestamp: new Date()
                }]
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Error setting webhook:', error);
            res.status(500).json({ error: 'Failed to set webhook' });
        }
    }

    // Remove webhook configuration
    async removeWebhook(req, res) {
        const { guildId, eventType } = req.params;

        try {
            const removed = await webhookManager.removeWebhook(guildId, eventType);
            if (!removed) {
                return res.status(404).json({ error: 'Webhook not found' });
            }
            res.json({ success: true });
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

        try {
            const success = await webhookManager.sendWebhook(guildId, eventType, {
                embeds: [{
                    title: 'Teste de Webhook',
                    description: 'Esta é uma mensagem de teste do webhook.',
                    fields: [
                        { name: 'Evento', value: eventType, inline: true },
                        { name: 'Testado por', value: req.user.tag, inline: true }
                    ],
                    color: 0x0099ff,
                    timestamp: new Date()
                }]
            });

            if (!success) {
                return res.status(404).json({ error: 'Webhook not found or failed to send' });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error testing webhook:', error);
            res.status(500).json({ error: 'Failed to test webhook' });
        }
    }
}

module.exports = new WebhookController();
