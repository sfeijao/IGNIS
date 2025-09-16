const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup and configure guild settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('init')
                .setDescription('Initialize guild configuration'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show current guild configuration')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'init') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Initialize guild configuration with defaults
            const config = await storage.getGuildConfig(interaction.guild.id);
            
            // Set some default values if not present
            if (!config.serverName) config.serverName = interaction.guild.name;
            if (!config.roles) config.roles = {};
            if (!config.channels) config.channels = {};
            if (!config.ticketSystem) config.ticketSystem = {};
            
            await storage.setGuildConfig(interaction.guild.id, config);

            const embed = new EmbedBuilder()
                .setColor(0x4CAF50)
                .setTitle('✅ Guild Configuration Initialized')
                .setDescription('Default configuration has been created for this guild.')
                .addFields(
                    { name: 'Guild Name', value: interaction.guild.name, inline: true },
                    { name: 'Guild ID', value: interaction.guild.id, inline: true },
                    { name: 'Members', value: interaction.guild.memberCount.toString(), inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'IGNIS Bot Configuration' });

            await interaction.editReply({ embeds: [embed] });
        } 
        else if (subcommand === 'status') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const config = await storage.getGuildConfig(interaction.guild.id);

            const embed = new EmbedBuilder()
                .setColor(0x2196F3)
                .setTitle('⚙️ Guild Configuration Status')
                .setDescription('Current configuration for this guild:')
                .addFields(
                    { name: 'Server Name', value: config.serverName || 'Not set', inline: true },
                    { name: 'Admin Role', value: config.roles?.admin ? `<@&${config.roles.admin}>` : 'Not set', inline: true },
                    { name: 'Staff Role', value: config.roles?.staff ? `<@&${config.roles.staff}>` : 'Not set', inline: true },
                    { name: 'Log Channel', value: config.channels?.logs ? `<#${config.channels.logs}>` : 'Not set', inline: true },
                    { name: 'Ticket System', value: config.ticketSystem?.logServerId ? 'Configured' : 'Not configured', inline: true },
                    { name: 'Config File', value: 'JSON Storage', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'IGNIS Bot Configuration' });

            await interaction.editReply({ embeds: [embed] });
        }
    },
};
