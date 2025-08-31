const { sendArchivedTicketWebhook } = require('../website/utils/webhookSender');

(async () => {
  const tests = [
    {
      guild: 'YSNM',
      url: 'https://discord.com/api/webhooks/1409372170743972091/MZ6aCMlvH4iCFP_9DiUloLYkY_TPXPwiWP1XUu5_IOcq8HLk3OHhYizE4eBxMxrIEtjq'
    },
    {
      guild: 'Beanny',
      url: 'https://discord.com/api/webhooks/1411464971388321792/_0BSDYEfcKCNrrhJ67YseUOd1NZwIKZGble5SUCNJOxXC3KlPhcBqVCrnpKx6cCBoNMw'
    }
  ];

  const ticket = {
    id: 999999,
    title: 'Teste webhook manual',
    description: 'Payload de teste enviado pelo script send-test-webhooks.js',
    user_id: '381762006329589760',
    severity: 'low',
    category: 'teste',
    created_at: new Date().toISOString()
  };

  for (const t of tests) {
    console.log(`Sending test to ${t.guild} -> ${t.url}`);
    try {
      const ok = await sendArchivedTicketWebhook(t.url, ticket, 'Teste manual');
      console.log(`Result for ${t.guild}:`, ok ? 'OK' : 'FAILED');
    } catch (err) {
      console.error(`Error sending to ${t.guild}:`, err && err.message ? err.message : err);
    }
    // short delay
    await new Promise(r => setTimeout(r, 300));
  }
})();
