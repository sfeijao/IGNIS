const Database = require('../website/database/database');

(async function(){
  const db = new Database();
  await db.initialize();

  db.db.all("SELECT id,guild_id,config_key,value,updated_at FROM guild_config WHERE config_key = 'archive_webhook_url'", (err, rows) => {
    if (err) {
      console.error('DB error:', err);
      process.exit(1);
    }
    console.log('Legacy rows count:', rows ? rows.length : 0);
    console.dir(rows, {depth:3});
    process.exit(0);
  });
})();
