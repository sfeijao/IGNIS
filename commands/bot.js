const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Bot management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub.setName('setnick').setDescription('Set bot nickname in this guild').addStringOption(o => o.setName('nickname').setDescription('Nickname para o bot neste servidor').setRequired(true)))
    .addSubcommand(sub => sub.setName('setusername').setDescription('Set global bot username').addStringOption(o => o.setName('username').setDescription('Novo username global para o bot').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        try {
            if (sub === 'setnick') {
                const nickname = interaction.options.getString('nickname');
                if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                    return interaction.reply({ content: 'Falta permissão Manage Nicknames no servidor.', ephemeral: true });
                }
                await interaction.guild.members.me.setNickname(nickname);
                return interaction.reply({ content: `Nickname alterado para: ${nickname}`, ephemeral: true });
            }
            if (sub === 'setusername') {
                const username = interaction.options.getString('username');
                try {
                    await interaction.client.user.setUsername(username);
                    return interaction.reply({ content: `Username do bot alterado para: ${username}`, ephemeral: true });
                } catch (err) {
                    return interaction.reply({ content: `Erro ao alterar username: ${err && err.message ? err.message : err}`, ephemeral: true });
                }
            }
        } catch (err) {
            return interaction.reply({ content: `Erro: ${err && err.message ? err.message : err}`, ephemeral: true });
        }
    }
};
