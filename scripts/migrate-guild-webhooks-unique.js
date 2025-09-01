const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'website', 'database', 'ysnm_dashboard.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) { console.error('Failed to open DB:', err.message); process.exit(2); }
  console.log('Opened DB:', dbPath);
});

async function run() {
  db.serialize(() => {
    try {
      db.run('PRAGMA foreign_keys = OFF');
      db.run('BEGIN TRANSACTION');

      // Create new table with UNIQUE constraint
      db.run(`
        CREATE TABLE IF NOT EXISTS guild_webhooks_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          url TEXT NOT NULL,
          name TEXT,
          channel_id TEXT,
          channel_name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (guild_id) REFERENCES guilds(discord_id),
          UNIQUE(guild_id, url)
        )
      `);

      // Copy newest row per guild_id+url into new table
      const insertSql = `INSERT INTO guild_webhooks_new (id,guild_id,url,name,channel_id,channel_name,created_at,updated_at)
        SELECT id,guild_id,url,name,channel_id,channel_name,created_at,updated_at FROM guild_webhooks
        WHERE id IN (SELECT MAX(id) FROM guild_webhooks GROUP BY guild_id, url)`;

      db.run(insertSql, function(err) {
        if (err) {
          console.error('Error inserting into new table:', err.message);
          db.run('ROLLBACK');
          db.run('PRAGMA foreign_keys = ON');
          db.close();
          process.exit(3);
        }
        console.log('Copied rows into guild_webhooks_new');

        // Drop old table and rename new one
        db.run('DROP TABLE IF EXISTS guild_webhooks', function(err2) {
          if (err2) console.error('Drop old table error:', err2.message);
          db.run('ALTER TABLE guild_webhooks_new RENAME TO guild_webhooks', function(err3) {
            if (err3) {
              console.error('Rename error:', err3.message);
              db.run('ROLLBACK');
              db.run('PRAGMA foreign_keys = ON');
              db.close();
              process.exit(4);
            }

            // Commit and re-enable foreign keys
            db.run('COMMIT', (err4) => {
              if (err4) console.error('Commit error:', err4.message);
              db.run('PRAGMA foreign_keys = ON');

              // Show resulting count
              db.get('SELECT COUNT(*) as c FROM guild_webhooks', (err5, row) => {
                if (err5) console.error('Count err', err5.message);
                else console.log('Final guild_webhooks rows:', row.c);
                db.close();
              });
            });
          });
        });
      });
    } catch (e) {
      console.error('Unexpected error', e);
      try { db.run('ROLLBACK'); } catch(_){}
      db.close();
      process.exit(99);
    }
  });
}

run();
