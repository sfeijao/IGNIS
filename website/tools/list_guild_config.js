const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'database', 'ysnm_dashboard.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT * FROM guild_config', (err, rows) => {
  if (err) return console.error('DB ERROR', err.message);
  console.log('guild_config rows:', rows);
  db.close();
});
