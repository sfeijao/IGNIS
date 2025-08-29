#!/usr/bin/env node
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');
const Database = require('../database/database');
const config = require('../../utils/config');

async function detectAndSaveIds({ guildId, token }) {
    if (!guildId) throw new Error('guildId is required');
    if (!token) throw new Error('DISCORD token is required');

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    return new Promise((resolve, reject) => {
        client.once('ready', async () => {
            try {
                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (!guild) throw new Error(`Guild not found: ${guildId}`);

                // fetch collections
                await guild.roles.fetch();
                await guild.channels.fetch();

                // find or create ticket category
                let ticketCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '📁 TICKETS');
                if (!ticketCategory) {
                    try {
                        ticketCategory = await guild.channels.create({ name: '📁 TICKETS', type: ChannelType.GuildCategory, reason: 'Auto-create ticket category' });
                    } catch (e) {
                        // ignore create failures, we'll proceed without it
                    }
                }

                // find verify role
                let verifyRole = guild.roles.cache.find(r => r.name === 'Verificado');
                // find staff role candidate
                let staffRole = guild.roles.cache.find(r => r.name === 'Staff') || guild.roles.cache.find(r => r.permissions && r.permissions.has(PermissionsBitField.Flags.ManageMessages));

                const db = new Database();
                await db.initialize();

                const results = {};
                if (ticketCategory) {
                    await db.setGuildConfig(guildId, 'ticket_category_id', ticketCategory.id);
                    results.ticket_category_id = ticketCategory.id;
                }
                if (verifyRole) {
                    await db.setGuildConfig(guildId, 'verify_role_id', verifyRole.id);
                    results.verify_role_id = verifyRole.id;
                }
                if (staffRole) {
                    await db.setGuildConfig(guildId, 'staff_role_id', staffRole.id);
                    results.staff_role_id = staffRole.id;
                }

                await client.destroy();
                resolve(results);
            } catch (err) {
                await client.destroy();
                reject(err);
            }
        });

        client.once('error', (err) => reject(err));

        client.login(token).catch(reject);
    });
}

if (require.main === module) {
    // CLI invocation
    const argv = require('minimist')(process.argv.slice(2));
    const guildId = argv.guild || argv.g || config.GUILD_ID || process.env.DISCORD_GUILD_ID;
    const token = process.env.DISCORD_TOKEN || config.DISCORD_TOKEN || argv.token || argv.t;

    (async () => {
        try {
            console.log('Auto-detecting IDs for guild:', guildId);
            const res = await detectAndSaveIds({ guildId, token });
            console.log('Saved config keys:', res);
            process.exit(0);
        } catch (err) {
            console.error('Failed to auto-detect IDs:', err && err.message ? err.message : err);
            process.exit(2);
        }
    })();
}

module.exports = { detectAndSaveIds };
