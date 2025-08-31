#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('../website/database/database');

(async () => {
    const filePath = path.join(__dirname, '..', 'website', 'data', 'guild_configs_export.json');
    if (!fs.existsSync(filePath)) {
        console.error('Export file not found:', filePath);
        process.exit(1);
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    const db = new Database();
    await db.initialize();

    for (const [guildId, cfg] of Object.entries(data)) {
        for (const [key, value] of Object.entries(cfg)) {
            try {
                await db.setGuildConfig(guildId, key, value === null ? null : String(value));
                console.log(`Set ${guildId} ${key} = ${value}`);
            } catch (e) {
                console.error('Failed to set', guildId, key, e && e.message ? e.message : e);
            }
        }
    }

    db.close();
    console.log('Import complete');
})();
