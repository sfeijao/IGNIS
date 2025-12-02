const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, OverwriteType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('abrir-ticket-ts')
    .setDescription('Abre um ticket (TS) criando um canal privado com o painel unificado')
    .addUserOption(o=>o.setName('usuario').setDescription('Utilizador para o ticket').setRequired(true))
    .addStringOption(o=>o.setName('categoria').setDescription('Nome da categoria a exibir').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const user = interaction.options.getUser('usuario');
    const categoryName = interaction.options.getString('categoria') || 'Suporte';
    if (!interaction.guild) return interaction.reply({ content: 'Somente num servidor.', flags: MessageFlags.Ephemeral });
    try {
      // Criar canal privado
      const name = `ticket-${user.username.toLowerCase()}`.replace(/[^a-z0-9-]/g, '').slice(0, 80);
      const overwrites = [
        { id: interaction.guild.roles.everyone, deny: ['ViewChannel'], type: OverwriteType.Role },
        { id: user.id, allow: ['ViewChannel','SendMessages'], type: OverwriteType.Member },
        { id: interaction.client.user.id, allow: ['ViewChannel','SendMessages','ManageChannels','ManageRoles'], type: OverwriteType.Member }
      ];
      const channel = await interaction.guild.channels.create({
        name,
        type: ChannelType.GuildText,
        permissionOverwrites: overwrites,
        topic: `Ticket TS • ${categoryName} • ${user.tag}`
      });
      // Abrir painel TS unificado
      const svc = require('../dist/services/ticketService.js');
      const member = await interaction.guild.members.fetch(user.id);
      await svc.openTicketTS(channel, member, categoryName);
      await interaction.reply({ content: `✅ Ticket criado: ${channel}`, flags: MessageFlags.Ephemeral });
    } catch (e) {
      logger.error('abrir-ticket-ts error:', e);
      await interaction.reply({ content: '❌ Falha ao criar ticket.', flags: MessageFlags.Ephemeral });
    }
  }
};
