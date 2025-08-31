const Database = require('../website/database/database');

(async () => {
  try {
    const db = new Database();
    await db.initialize();
    const guildId = process.argv[2] || '1333820000791691284';
    const tickets = await db.getTickets(guildId);
    console.log('Found', tickets.length, 'tickets for guild', guildId);
    tickets.slice(0, 10).forEach(t => {
      console.log('---');
      console.log('id:', t.id, 'channel_id:', t.channel_id, 'title:', t.title, 'status:', t.status, 'archived:', t.archived, 'bug_webhook_sent:', t.bug_webhook_sent);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error reading tickets:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
