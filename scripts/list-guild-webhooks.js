const Database = require('../website/database/database');

(async function(){
  const db = new Database();
  await db.initialize();

  db.db.all('SELECT id,guild_id,url,name,channel_id,channel_name,created_at,updated_at FROM guild_webhooks', (err, rows) => {
    if (err) { console.error('DB error', err); process.exit(1); }
    console.log('guild_webhooks rows count:', rows ? rows.length : 0);
    console.dir(rows, {depth:3});
    process.exit(0);
  });
})();
