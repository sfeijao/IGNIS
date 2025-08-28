const Database = require('../database/database');
const { startMockWebhookServer } = require('./mock-webhook-server');
const { sendArchivedTicketWebhook } = require('../utils/webhookSender');

async function testMigrations() {
    const db = new Database();
    await db.initialize();
    // Check that migrated columns exist by reading PRAGMA
    const cols = await new Promise((res, rej) => db.db.all("PRAGMA table_info(tickets)", (err, rows) => err ? rej(err) : res(rows.map(r => r.name))));
    if (!cols.includes('archived') || !cols.includes('bug_webhook_sent')) throw new Error('Missing migrated columns');
    db.close();
}

async function testWebhookSender() {
    const mock = startMockWebhookServer(4010);
    const ticket = { id: 1, title: 'unit', description: 'unit', user_id: 'u1', created_at: new Date().toISOString() };
    const ok = await sendArchivedTicketWebhook(mock.url, ticket, 'unit test');
    await mock.stop();
    if (!ok) throw new Error('Webhook sender failed');
}

async function run() {
    const logger = require('../../utils/logger');
    logger.info('Running unit tests...');
    await testMigrations();
    logger.info('Migrations test passed');
    await testWebhookSender();
    logger.info('Webhook sender test passed');
    logger.info('All unit tests passed');
}

run().catch(err => {
    logger.error('Unit tests failed', { error: err && err.message ? err.message : err, stack: err && err.stack });
    process.exit(1);
});
