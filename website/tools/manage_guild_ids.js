#!/usr/bin/env node
const Database = require('../database/database');
const config = require('../../utils/config');
const argv = require('minimist')(process.argv.slice(2));

async function showConfig(guildId) {
    const db = new Database();
    await db.initialize();
    const keys = ['ticket_category_id','verify_role_id','staff_role_id'];
    const out = {};
    for (const k of keys) {
        const v = await db.getGuildConfig(guildId, k);
        out[k] = v?.value || null;
    }
    return out;
}

async function setConfig(guildId, key, value) {
    const db = new Database();
    await db.initialize();
    await db.setGuildConfig(guildId, key, value);
}

if (require.main === module) {
    (async () => {
        try {
            const guildId = argv.guild || argv.g || config.GUILD_ID || process.env.DISCORD_GUILD_ID;
            if (!guildId) throw new Error('guild id required via --guild or DISCORD_GUILD_ID');

            // Set operations
            if (argv['set-ticket-category-id']) await setConfig(guildId, 'ticket_category_id', argv['set-ticket-category-id']);
            if (argv['set-verify-role-id']) await setConfig(guildId, 'verify_role_id', argv['set-verify-role-id']);
            if (argv['set-staff-role-id']) await setConfig(guildId, 'staff_role_id', argv['set-staff-role-id']);

            const result = await showConfig(guildId);
            console.log('Guild IDs for', guildId);
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        } catch (err) {
            console.error('Error:', err && err.message ? err.message : err);
            process.exit(2);
        }
    })();
}

module.exports = { showConfig, setConfig };
