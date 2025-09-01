const http = require('http');

const payload = {
  event: 'ticket_closed',
  ticket: {
    id: 'T_TEST_' + Date.now(),
    guild: 'G_TEST',
    messages: [
      { author: 'user1', content: 'hello' },
      { author: 'mod1', content: 'hi' }
    ]
  }
};

const data = JSON.stringify(payload);

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/hooks/tickets',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    try {
      console.log('BODY', JSON.parse(body));
    } catch (e) {
      console.log('BODY_RAW', body);
    }
  });
});

req.on('error', (err) => {
  console.error('REQUEST_ERROR', err && err.message ? err.message : err);
});

req.write(data);
req.end();
