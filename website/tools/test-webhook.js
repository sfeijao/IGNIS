const { startMockWebhookServer } = require('./mock-webhook-server');
const { sendArchivedTicketWebhook } = require('../utils/webhookSender');

async function runTest() {
    const mock = startMockWebhookServer(4005);

    const ticket = {
        id: 12345,
        title: 'Teste E2E',
        description: 'Descrição de teste',
        user_id: '381762006329589760',
        severity: 'high',
        category: 'teste',
        created_at: new Date().toISOString()
    };

    const logger = require('../../utils/logger');
    logger.info('Sending test webhook to', { url: mock.url });
    const ok = await sendArchivedTicketWebhook(mock.url, ticket, 'Teste E2E');
    logger.info('sendArchivedTicketWebhook returned', { success: ok });

    // Wait briefly to ensure server processed
    await new Promise(res => setTimeout(res, 500));

    const received = mock.getReceived();
    logger.info('Mock server received count', { count: received.length });
    if (received.length > 0) logger.debug('Sample payload keys', { keys: Object.keys(received[0].body) });

    await mock.stop();

    if (!ok || received.length === 0) {
    logger.error('Webhook test failed');
        process.exit(1);
    }

    logger.info('Webhook test passed');
}

runTest().catch(err => {
    logger.error('Test failed with error', { error: err && err.message ? err.message : err, stack: err && err.stack });
    process.exit(1);
});
