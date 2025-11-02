const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Bot management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
        sub
            .setName('setnick')
            .setDescription('Set bot nickname in this guild')
            .addStringOption(o =>
                o
                    .setName('nickname')
                    .setDescription('Nickname para o bot neste servidor')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('setusername')
            .setDescription('Set global bot username')
            .addStringOption(o =>
                o
                    .setName('username')
                    .setDescription('Novo username global para o bot')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('setavatar')
            .setDescription('Set global bot avatar (icon)')
            .addAttachmentOption(o =>
                o
                    .setName('imagem')
                    .setDescription('Imagem para o avatar do bot (PNG/JPG <= 10MB)')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('setbanner')
            .setDescription('Set global bot profile banner (se suportado pela API)')
            .addAttachmentOption(o =>
                o
                    .setName('imagem')
                    .setDescription('Imagem para o banner do bot (PNG/JPG <= 10MB)')
                    .setRequired(true)
            )
    ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        try {
            if (sub === 'setnick') {
                const nickname = interaction.options.getString('nickname');
                if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                    return interaction.reply({ content: 'Falta permissão Manage Nicknames no servidor.', flags: MessageFlags.Ephemeral });
                }
                await interaction.guild.members.me.setNickname(nickname);
                return interaction.reply({ content: `Nickname alterado para: ${nickname}`, flags: MessageFlags.Ephemeral });
            }
            if (sub === 'setusername') {
                const username = interaction.options.getString('username');
                try {
                    await interaction.client.user.setUsername(username);
                    return interaction.reply({ content: `Username do bot alterado para: ${username}`, flags: MessageFlags.Ephemeral });
                } catch (err) {
                    return interaction.reply({ content: `Erro ao alterar username: ${err && err.message ? err.message : err}`, flags: MessageFlags.Ephemeral });
                }
            }
            if (sub === 'setavatar') {
                const attachment = interaction.options.getAttachment('imagem');
                if (!attachment || !attachment.url) {
                    return interaction.reply({ content: 'Imagem inválida.', flags: MessageFlags.Ephemeral });
                }
                // Pequena validação de tipo/tamanho
                const contentType = (attachment.contentType || '').toLowerCase();
                const isImage = contentType.includes('png') || contentType.includes('jpg') || contentType.includes('jpeg') || contentType.includes('webp');
                if (!isImage) {
                    return interaction.reply({ content: 'Por favor envie PNG/JPG/WEBP.', flags: MessageFlags.Ephemeral });
                }
                if (attachment.size && attachment.size > 10 * 1024 * 1024) {
                    return interaction.reply({ content: 'Imagem acima de 10MB.', flags: MessageFlags.Ephemeral });
                }
                try {
                    await interaction.client.user.setAvatar(attachment.url);
                    return interaction.reply({ content: 'Avatar do bot atualizado com sucesso.', flags: MessageFlags.Ephemeral });
                } catch (err) {
                    return interaction.reply({ content: `Erro ao alterar avatar: ${err && err.message ? err.message : err}`, flags: MessageFlags.Ephemeral });
                }
            }
            if (sub === 'setbanner') {
                const attachment = interaction.options.getAttachment('imagem');
                if (!attachment || !attachment.url) {
                    return interaction.reply({ content: 'Imagem inválida.', flags: MessageFlags.Ephemeral });
                }
                const contentType = (attachment.contentType || '').toLowerCase();
                const isImage = contentType.includes('png') || contentType.includes('jpg') || contentType.includes('jpeg') || contentType.includes('webp');
                if (!isImage) {
                    return interaction.reply({ content: 'Por favor envie PNG/JPG/WEBP.', flags: MessageFlags.Ephemeral });
                }
                if (attachment.size && attachment.size > 10 * 1024 * 1024) {
                    return interaction.reply({ content: 'Imagem acima de 10MB.', flags: MessageFlags.Ephemeral });
                }
                try {
                    if (typeof interaction.client.user.setBanner === 'function') {
                        await interaction.client.user.setBanner(attachment.url);
                        return interaction.reply({ content: 'Banner do bot atualizado com sucesso.', flags: MessageFlags.Ephemeral });
                    }
                    return interaction.reply({ content: 'A API do Discord não permite alterar banner de bots nesta versão.', flags: MessageFlags.Ephemeral });
                } catch (err) {
                    return interaction.reply({ content: `Erro ao alterar banner: ${err && err.message ? err.message : err}`, flags: MessageFlags.Ephemeral });
                }
            }
        } catch (err) {
            return interaction.reply({ content: `Erro: ${err && err.message ? err.message : err}`, flags: MessageFlags.Ephemeral });
        }
    }
};
