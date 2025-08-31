#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('../website/database/database');

(async () => {
    const db = new Database();
    await db.initialize();

    // IDs conhecidos (YSNM e Beanny) — podes adicionar outros aqui
    const guildIds = ['1333820000791691284', '1283603691538088027'];
    const keys = ['archive_webhook_url', 'log_channel_id', 'ticket_category_id', 'staff_role_id', 'verify_role_id'];

    const out = {};
    for (const guildId of guildIds) {
        out[guildId] = {};
        for (const key of keys) {
            try {
                const cfg = await db.getGuildConfig(guildId, key);
                out[guildId][key] = cfg ? cfg.value : null;
            } catch (e) {
                out[guildId][key] = null;
            }
        }
    }

    const dataDir = path.join(__dirname, '..', 'website', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const outPath = path.join(dataDir, 'guild_configs_export.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
    console.log('Exported known guild configs to', outPath);
    db.close();
})();
