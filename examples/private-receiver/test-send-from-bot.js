const { sendToPrivateEndpoint } = require('../../website/utils/privateLogger');

(async () => {
  const url = process.env.PRIVATE_LOG_ENDPOINT || 'http://127.0.0.1:3001/hooks/tickets';
  const token = process.env.PRIVATE_LOG_TOKEN || 'testtoken';
  const secret = process.env.PRIVATE_LOG_HMAC_SECRET || 'testsecret';

  const payload = { event: 'ticket_archived', ticket: { id: 2001, guild_id: '555', subject: 'BotTest' }, messages: [{ content: 'from bot', author: 'bot', ts: new Date().toISOString() }] };
  const ok = await sendToPrivateEndpoint(url, token, payload, { hmacSecret: secret, timeoutMs: 5000, maxAttempts: 2, hmacTtl: 300, timestampHeader: 'X-Timestamp' });
  console.log('sent ok?', ok);
})();
