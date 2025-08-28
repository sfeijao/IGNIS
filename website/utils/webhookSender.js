const fetch = global.fetch || require('node-fetch');
const logger = require('../../utils/logger');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send an archived ticket payload to a webhook URL with retries and timeout.
 * Returns true on success, false on final failure.
 */
async function sendArchivedTicketWebhook(webhookUrl, ticketData, reason = 'Ticket arquivado', opts = {}) {
    if (!webhookUrl) return false;
    const maxAttempts = opts.maxAttempts || 3;
    const timeoutMs = opts.timeoutMs || 8000;

    const embed = {
        title: `🗃️ Ticket Arquivado #${ticketData.id}`,
        description: ticketData.description || 'Sem descrição',
        color: 0x95a5a6,
        fields: [
            { name: '📝 Título', value: ticketData.title || 'Sem título', inline: true },
            { name: '👤 Usuário', value: `<@${ticketData.user_id}>`, inline: true },
            { name: '📊 Severidade', value: (ticketData.severity || 'medium').toUpperCase(), inline: true },
            { name: '📂 Categoria', value: ticketData.category || 'Geral', inline: true },
            { name: '📅 Criado em', value: new Date(ticketData.created_at).toLocaleString('pt-PT'), inline: true },
            { name: '🗃️ Arquivado em', value: new Date().toLocaleString('pt-PT'), inline: true },
            { name: '📝 Motivo', value: reason, inline: false }
        ],
        footer: { text: 'Sistema de Tickets YSNM - Arquivo' },
        timestamp: new Date().toISOString()
    };

    const payload = { embeds: [embed], username: 'YSNM Tickets Archive' };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const signal = controller ? controller.signal : undefined;
            if (controller) setTimeout(() => controller.abort(), timeoutMs);

            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal
            });

            if (res.ok) return true;

            // Non-2xx response — treat as transient for retries
            logger.warn(`Webhook send attempt ${attempt} failed: ${res.status} ${res.statusText}`);
        } catch (err) {
            logger.warn(`Webhook send attempt ${attempt} error: ${err.message}`);
        }

        // Backoff before retrying
        if (attempt < maxAttempts) await sleep(500 * attempt);
    }

    return false;
}

module.exports = { sendArchivedTicketWebhook };
