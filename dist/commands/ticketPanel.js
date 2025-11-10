"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const ticketService_1 = require("../services/ticketService");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Criar painel de ticket neste canal')
    .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels)
    .addStringOption(opt => opt.setName('categoria').setDescription('Nome da categoria para exibir').setRequired(false));
async function execute(interaction) {
    if (!interaction.channel || interaction.channel.type !== discord_js_1.ChannelType.GuildText) {
        // Use flags instead of deprecated ephemeral property
        return interaction.reply({ content: 'Canal inválido para painel.', flags: discord_js_1.MessageFlags.Ephemeral });
    }
    const categoria = interaction.options.getString('categoria') || 'Suporte';
    // Verificar permissões do bot no canal
    const me = interaction.guild?.members.me;
    const needed = [discord_js_1.PermissionsBitField.Flags.ViewChannel, discord_js_1.PermissionsBitField.Flags.SendMessages, discord_js_1.PermissionsBitField.Flags.ManageChannels, discord_js_1.PermissionsBitField.Flags.ManageRoles];
    const missing = needed.filter(p => !me?.permissionsIn(interaction.channel.id).has(p));
    const embed = await (0, ticketService_1.buildPanelEmbed)(interaction.member, categoria);
    // Embed de aviso (OBS) destacado
    const { EmbedBuilder } = require('discord.js');
    const noticeEmbed = new EmbedBuilder()
        .setDescription('OBS: Procure manter sua DM aberta para receber uma cópia deste ticket e a opção de avaliar seu atendimento.')
        .setColor(0xED4245);
    if (missing.length) {
        embed.setColor(0xFF3333).addFields({ name: '⚠ Permissões em falta', value: missing.map(m => discord_js_1.PermissionsBitField.resolve(m)).length ? missing.map(m => `\`${Object.keys(discord_js_1.PermissionsBitField.Flags).find(k => discord_js_1.PermissionsBitField.Flags[k] === m)}\``).join(', ') : 'Desconhecido' });
    }
    const components = (0, ticketService_1.buildPanelComponents)();
    // Painel público (não é um ticket em si) – não criar TicketModel aqui
    const sent = await interaction.channel.send({ embeds: [embed, noticeEmbed], components });
    // Guard: if already replied (edge race) use followUp instead
    if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: 'Painel criado ✅', flags: discord_js_1.MessageFlags.Ephemeral });
    }
    return interaction.reply({ content: 'Painel criado ✅', flags: discord_js_1.MessageFlags.Ephemeral });
}
module.exports = { data: exports.data, execute };
