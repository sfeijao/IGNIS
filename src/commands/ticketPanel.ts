import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { buildPanelEmbed, buildPanelComponents } from '../services/ticketService';
import { TicketModel } from '../models/ticket';

export const data = new SlashCommandBuilder()
  .setName('ticket-panel')
  .setDescription('Criar painel de ticket neste canal')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(opt => opt.setName('categoria').setDescription('Nome da categoria para exibir').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    return interaction.reply({ content: 'Canal inválido para painel.', ephemeral: true });
  }
  const categoria = interaction.options.getString('categoria') || 'Suporte';
  const embed = await buildPanelEmbed(interaction.member as any, categoria);
  const components = buildPanelComponents();
  const sent = await interaction.channel.send({ embeds: [embed], components });
  await TicketModel.create({ guildId: interaction.guildId!, channelId: interaction.channelId, messageId: sent.id, ownerId: interaction.user.id, category: categoria, status: 'open' });
  return interaction.reply({ content: 'Painel criado ✅', ephemeral: true });
}

module.exports = { data, execute };
