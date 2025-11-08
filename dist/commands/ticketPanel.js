"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const ticketService_1 = require("../services/ticketService");
const ticket_1 = require("../models/ticket");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Criar painel de ticket neste canal')
    .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels)
    .addStringOption(opt => opt.setName('categoria').setDescription('Nome da categoria para exibir').setRequired(false));
async function execute(interaction) {
    if (!interaction.channel || interaction.channel.type !== discord_js_1.ChannelType.GuildText) {
        return interaction.reply({ content: 'Canal inválido para painel.', ephemeral: true });
    }
    const categoria = interaction.options.getString('categoria') || 'Suporte';
    // Verificar permissões do bot no canal
    const me = interaction.guild?.members.me;
    const needed = [discord_js_1.PermissionsBitField.Flags.ViewChannel, discord_js_1.PermissionsBitField.Flags.SendMessages, discord_js_1.PermissionsBitField.Flags.ManageChannels, discord_js_1.PermissionsBitField.Flags.ManageRoles];
    const missing = needed.filter(p => !me?.permissionsIn(interaction.channel.id).has(p));
    const embed = await (0, ticketService_1.buildPanelEmbed)(interaction.member, categoria);
    if (missing.length) {
        embed.setColor(0xFF3333).addFields({ name: '⚠ Permissões em falta', value: missing.map(m => discord_js_1.PermissionsBitField.resolve(m)).length ? missing.map(m => `\`${Object.keys(discord_js_1.PermissionsBitField.Flags).find(k => discord_js_1.PermissionsBitField.Flags[k] === m)}\``).join(', ') : 'Desconhecido' });
    }
    const components = (0, ticketService_1.buildPanelComponents)();
    const sent = await interaction.channel.send({ embeds: [embed], components });
    await ticket_1.TicketModel.create({ guildId: interaction.guildId, channelId: interaction.channelId, messageId: sent.id, ownerId: interaction.user.id, category: categoria, status: 'open' });
    return interaction.reply({ content: 'Painel criado ✅', ephemeral: true });
}
module.exports = { data: exports.data, execute };
