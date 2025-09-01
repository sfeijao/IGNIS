const Database = require('../database/database');
const { startMockWebhookServer } = require('./mock-webhook-server');
const { sendArchivedTicketWebhook } = require('../utils/webhookSender');
const logger = require('../../utils/logger');

async function runE2E() {
    const mock = startMockWebhookServer(4006);
    const db = new Database();
    await db.initialize();

    const guildId = 'test-guild-e2e';

    // Ensure webhook is set for guild (migrated multi-webhook)
    await db.addGuildWebhook(guildId, mock.url, { name: 'E2E mock' });

    // Create ticket
    const createRes = await db.createTicket({
        guild_id: guildId,
        channel_id: 'chan-' + Date.now(),
        user_id: '381762006329589760',
        category: 'bug',
        title: 'E2E Test Ticket',
        subject: 'E2E subject',
        description: 'E2E description',
        severity: 'high'
    });

    const ticketId = createRes.id;
    logger.info('Created ticket id', { ticketId });

    // Close ticket: update status, mark archived, reload ticket, send webhook (like API flow)
    await db.updateTicketStatus(ticketId, 'closed', null, 'E2E resolution');
    await db.updateTicket(ticketId, { archived: 1 });
    const updatedTicket = await db.getTicketById(ticketId);

    // Send webhook if configured and not already sent
    const webhooks = await db.getGuildWebhooks(guildId);
    let sent = false;
    if (webhooks && webhooks.length > 0 && !updatedTicket?.bug_webhook_sent) {
        for (const wh of webhooks) {
            sent = await sendArchivedTicketWebhook(wh.url, updatedTicket, 'E2E resolution');
            if (sent) break;
        }
        if (sent) await db.markTicketWebhookSent(ticketId);
    }

    // Wait for mock server
    await new Promise(res => setTimeout(res, 500));
    const received = mock.getReceived();

    // Read DB flags
    const final = await db.getTicketById(ticketId);

    logger.info('Webhook sent', { sent });
    logger.info('Mock received count', { count: received.length });
    logger.info('DB final row archived', { archived: final.archived, bug_webhook_sent: final.bug_webhook_sent });

    await mock.stop();
    db.close();

    if (!sent || received.length === 0 || final.archived != 1 || final.bug_webhook_sent != 1) {
    logger.error('E2E test failed');
        process.exit(1);
    }

    logger.info('E2E test passed');
}

runE2E().catch(err => {
    logger.error('E2E failed', { error: err && err.message ? err.message : err, stack: err && err.stack });
    process.exit(1);
});
