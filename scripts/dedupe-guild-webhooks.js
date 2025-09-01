const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'website', 'database', 'ysnm_dashboard.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => { if (err) { console.error(err); process.exit(2); } });

// For each guild_id+url, keep the newest row (largest created_at or id), delete older duplicates
console.log('Starting dedupe of guild_webhooks...');

const dedupeSql = `DELETE FROM guild_webhooks WHERE id NOT IN (
  SELECT MAX(id) FROM guild_webhooks GROUP BY guild_id, url
)`;

db.run(dedupeSql, function(err) {
  if (err) {
    console.error('Dedupe failed:', err.message);
    db.close();
    process.exit(3);
  }
  console.log('Dedupe completed. Rows affected:', this.changes);
  // show remaining rows count
  db.get('SELECT COUNT(*) as c FROM guild_webhooks', (err2, row) => {
    if (err2) console.error('Count err', err2.message);
    else console.log('Remaining guild_webhooks rows:', row.c);
    db.close();
  });
});
