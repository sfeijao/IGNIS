#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('../website/database/database');

(async () => {
    const db = new Database();
    await db.initialize();

    // Chaves que nos interessam exportar
    const keys = ['archive_webhook_url', 'log_channel_id', 'ticket_category_id', 'staff_role_id', 'verify_role_id'];

    // Obter todos os guild_ids da tabela guild_config
    db.db.all('SELECT DISTINCT guild_id FROM guild_config', async (err, rows) => {
        if (err) {
            console.error('Erro ao listar guilds:', err && err.message ? err.message : err);
            process.exit(1);
        }

        const guilds = rows.map(r => r.guild_id);
        const out = {};

        for (const guildId of guilds) {
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
        console.log('Exported guild configs to', outPath);
        db.close();
    });
})();
