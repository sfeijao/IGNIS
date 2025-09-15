const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'website', 'database', 'ignis_dashboard.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => { if (err) { console.error('open err', err); process.exit(2);} });

db.serialize(() => {
  db.all('SELECT COUNT(*) as c FROM guild_webhooks', (err, rows) => {
    if (err) { console.error('count err', err); return; }
    console.log('total guild_webhooks rows:', rows[0].c);
  });
  db.all('SELECT id,guild_id,url,channel_id,name,created_at FROM guild_webhooks ORDER BY created_at DESC LIMIT 50', (err, rows) => {
    if (err) { console.error('select err', err); return; }
    console.log('rows sample:', rows);
  });
});

setTimeout(() => db.close(), 500);
