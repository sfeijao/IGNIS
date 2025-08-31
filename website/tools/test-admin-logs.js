const http = require('http');
const opts = { host: 'localhost', port: 4000, path: '/api/admin/logs?limit=5', headers: { 'Authorization': 'Bearer dev-token' } };
http.get(opts, res => {
  console.log('STATUS', res.statusCode);
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => { console.log(b); process.exit(0); });
}).on('error', e => { console.error('ERR', e); process.exit(2); });
