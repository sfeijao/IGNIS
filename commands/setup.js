const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { scanGuildAndSave } = require('../website/tools/auto_config');
const { showConfig, setConfig } = require('../website/tools/manage_guild_ids');
const Database = require('../website/database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup and configure guild mappings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub.setName('scan').setDescription('Force a re-scan and save mapping'))
        .addSubcommand(sub => sub.setName('show').setDescription('Show saved mapping'))
        .addSubcommand(sub => sub.setName('set').setDescription('Set a value manually')
            .addStringOption(o => o.setName('type').setDescription('role|channel|webhook').setRequired(true))
            .addStringOption(o => o.setName('key').setDescription('config key name').setRequired(true))
            .addStringOption(o => o.setName('value').setDescription('ID or webhook token/value').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const sub = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;
            if (sub === 'scan') {
                await scanGuildAndSave(interaction.guild, interaction.client);
                return interaction.editReply({ content: '🔍 Scan completo e configuração atualizada.' });
            }
            if (sub === 'show') {
                const cfg = await showConfig(guildId);
                return interaction.editReply({ content: `

**Config for ${guildId}:**
` + '```json\n' + JSON.stringify(cfg, null, 2) + '\n```' });
            }
            if (sub === 'set') {
                const type = interaction.options.getString('type');
                const key = interaction.options.getString('key');
                const value = interaction.options.getString('value');
                // basic sanitization
                if (!/^[0-9_\-a-zA-Z]+$/.test(value)) return interaction.editReply({ content: 'Valor inválido.' });
                    await setConfig(guildId, key, value);
                    return interaction.editReply({ content: `✅ Config \`${key}\` definida para \`${value}\`.` });
            }
        } catch (err) {
            return interaction.editReply({ content: `Erro: ${err && err.message ? err.message : err}` });
        }
    }
};
