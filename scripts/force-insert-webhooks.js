const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'website', 'database', 'ignis_dashboard.db');
const webhooksToInsert = [
  { guild_id: '1283603691538088027', url: 'https://discord.com/api/webhooks/1411464971388321792/_0BSDYEfcKCNrrhJ67YseUOd1NZwIKZGble5SUCNJOxXC3KlPhcBqVCrnpKx6cCBoNMw', name: 'Beanny tickets' },
  { guild_id: '1333820000791691284', url: 'https://discord.com/api/webhooks/1409372170743972091/MZ6aCMlvH4iCFP_9DiUloLYkY_TPXPwiWP1XUu5_IOcq8HLk3OHhYizE4eBxMxrIEtjq', name: 'IGNIS tickets' }
];

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) { console.error('Failed to open DB:', err.message); process.exit(2); }
  console.log('Opened DB:', dbPath);
});

function run() {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const selectStmt = db.prepare('SELECT id FROM guild_webhooks WHERE guild_id = ? AND url = ?');
    const insertStmt = db.prepare('INSERT INTO guild_webhooks (guild_id, url, name, channel_id, channel_name, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');

    webhooksToInsert.forEach(w => {
      selectStmt.get([w.guild_id, w.url], (err, row) => {
        if (err) { console.error('Select err', err); return; }
        if (row) {
          console.log(`Already exists for guild ${w.guild_id}: id=${row.id}`);
        } else {
          insertStmt.run([w.guild_id, w.url, w.name || null], function(err) {
            if (err) console.error('Insert err', err.message);
            else console.log(`Inserted webhook id=${this.lastID} guild=${w.guild_id}`);
          });
        }
      });
    });

    // finalize after small delay to allow callbacks
    setTimeout(() => {
      selectStmt.finalize();
      insertStmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) console.error('Commit err', err.message);
        // print current rows
        db.all('SELECT id,guild_id,url,name,created_at FROM guild_webhooks ORDER BY created_at DESC LIMIT 50', (err2, rows) => {
          if (err2) { console.error('Final select err', err2.message); } else {
            console.log('Current guild_webhooks rows (sample):', rows);
          }
          db.close();
        });
      });
    }, 400);
  });
}

run();
