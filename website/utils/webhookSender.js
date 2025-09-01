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

    // Build embed including ticket summary and optionally a transcript link or excerpt
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

    // If ticketData.transcriptUrl is provided, add a field with the link
    if (ticketData.transcriptUrl) {
        embed.fields.push({ name: '📜 Transcript', value: `[Ver transcript](${ticketData.transcriptUrl})`, inline: false });
    }

    // If messages array is provided and short, include an excerpt
    if (Array.isArray(ticketData.messages) && ticketData.messages.length > 0) {
        const excerpt = ticketData.messages.slice(-10).map(m => `**${m.username || m.user_id}**: ${m.message}`).join('\n');
        // Discord embed field max length ~1024
        embed.fields.push({ name: '📎 Últimas mensagens', value: excerpt.substring(0, 1000), inline: false });
    }

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
