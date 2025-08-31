const Database = require('../website/database/database');
const http = require('http');

(async () => {
  try {
    const db = new Database();
    await db.initialize();

    const guildId = process.argv[2] || '1333820000791691284';

    // Ensure an archive webhook exists (fallback to httpbin for safe testing)
    const existing = await db.getGuildConfig(guildId, 'archive_webhook_url');
    if (!existing || !existing.value) {
      await db.setGuildConfig(guildId, 'archive_webhook_url', 'https://httpbin.org/post');
      console.log('⚠️  No archive_webhook_url found for', guildId, '- set fallback to https://httpbin.org/post');
    } else {
      console.log('✅ archive_webhook_url already present for', guildId);
    }

    // Create a ticket directly in the DB
    const ticketData = {
      guild_id: guildId,
      channel_id: `e2e-${Date.now()}`,
      user_id: 'e2e-user-123',
      category: 'general',
      title: 'E2E Test Ticket',
      subject: 'E2E Test Ticket',
      description: 'This ticket was created by e2e-create-and-close-ticket script',
      severity: 'low'
    };

    const created = await db.createTicket(ticketData);
    console.log('🎫 Created ticket in DB:', created);

    const ticketId = created.id;

    // Call the close endpoint to trigger webhook sending
    const payload = JSON.stringify({ reason: 'E2E automated close' });
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: `/api/tickets/${ticketId}/close`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': 'Bearer dev-token'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('🔁 Close endpoint response:', res.statusCode, body);
        process.exit(0);
      });
    });

    req.on('error', (err) => {
      console.error('❌ Error calling close endpoint', err);
      process.exit(2);
    });

    req.write(payload);
    req.end();

  } catch (err) {
    console.error('❌ E2E script failed', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
