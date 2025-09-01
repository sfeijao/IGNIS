const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'website', 'database', 'ysnm_dashboard.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => { if (err) { console.error('open err', err); process.exit(2);} });

console.log('Removing test webhooks (guild_id LIKE "test-%") from', dbPath);

db.serialize(() => {
  db.run("DELETE FROM guild_webhooks WHERE guild_id LIKE 'test-%' OR guild_id = 'test-guild-e2e'", function(err) {
    if (err) { console.error('delete err', err.message); db.close(); process.exit(3); }
    console.log('Deleted rows:', this.changes);

    db.get('SELECT COUNT(*) as c FROM guild_webhooks', (err2, row) => {
      if (err2) console.error('count err', err2.message);
      else console.log('Remaining guild_webhooks rows:', row.c);

      db.all('SELECT id,guild_id,url,name,created_at FROM guild_webhooks ORDER BY created_at DESC', (err3, rows) => {
        if (err3) console.error('select err', err3.message);
        else console.log('rows sample:', rows);
        db.close();
      });
    });
  });
});
