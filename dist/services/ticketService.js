"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPanelEmbed = buildPanelEmbed;
exports.buildPanelComponents = buildPanelComponents;
exports.handleCancel = handleCancel;
exports.handleHowDM = handleHowDM;
exports.handleClaim = handleClaim;
exports.handleClose = handleClose;
exports.handleRename = handleRename;
exports.handleMove = handleMove;
exports.handleAddMember = handleAddMember;
exports.handleRemoveMember = handleRemoveMember;
exports.handleCallMember = handleCallMember;
exports.handleGreet = handleGreet;
exports.handleNote = handleNote;
exports.resolveTicket = resolveTicket;
const discord_js_1 = require("discord.js");
const ticket_1 = require("../models/ticket");
const ticketLog_1 = require("../models/ticketLog");
const lockManager_1 = require("../utils/lockManager");
async function log(ticketId, guildId, byUserId, action, payload = {}) {
    await ticketLog_1.TicketLogModel.create({ ticketId, guildId, byUserId, action, payload });
}
function isStaff(member, guildConfig) {
    const staffRoles = guildConfig?.staffRoles || [];
    return member.roles.cache.some(r => staffRoles.includes(r.id));
}
async function buildPanelEmbed(author, categoryName, thumbnailUrl) {
    return new discord_js_1.EmbedBuilder()
        .setTitle('Ticket Criado com Sucesso! 📌')
        .setDescription('Todos os responsáveis pelo ticket já estão cientes da abertura.\n' +
        'Evite chamar alguém via DM, basta aguardar alguém já irá lhe atender...')
        .addFields({ name: 'Categoria Escolhida:', value: `🧾 \`Ticket ${categoryName || 'Suporte'}\``, inline: false }, { name: '\u200B', value: '**DESCREVA O MOTIVO DO CONTACTO COM O MÁXIMO DE DETALHES POSSÍVEIS...**', inline: false })
        .setThumbnail(thumbnailUrl || author.displayAvatarURL())
        .setColor(0x2F3136)
        .setFooter({ text: 'OBS: Procure manter sua DM aberta para receber uma cópia deste ticket e a opção de avaliar seu atendimento.' });
}
function buildPanelComponents() {
    const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('ticket:cancel').setLabel('Desejo sair ou cancelar este ticket').setStyle(discord_js_1.ButtonStyle.Danger).setEmoji('🧯'), new discord_js_1.ButtonBuilder().setCustomId('ticket:how_dm').setLabel('Como libero minha DM?').setStyle(discord_js_1.ButtonStyle.Secondary).setEmoji('❓'));
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('ticket:call_member').setLabel('Chamar Membro').setStyle(discord_js_1.ButtonStyle.Primary).setEmoji('🔔'), new discord_js_1.ButtonBuilder().setCustomId('ticket:add_member').setLabel('Adicionar Membro').setStyle(discord_js_1.ButtonStyle.Success).setEmoji('➕'), new discord_js_1.ButtonBuilder().setCustomId('ticket:remove_member').setLabel('Remover Membro').setStyle(discord_js_1.ButtonStyle.Danger).setEmoji('❌'), new discord_js_1.ButtonBuilder().setCustomId('ticket:move').setLabel('Mover Ticket').setStyle(discord_js_1.ButtonStyle.Secondary).setEmoji('🔁'), new discord_js_1.ButtonBuilder().setCustomId('ticket:rename').setLabel('Trocar Nome do Canal').setStyle(discord_js_1.ButtonStyle.Secondary).setEmoji('📝'));
    const row3 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('ticket:claim').setLabel('Assumir Atendimento').setStyle(discord_js_1.ButtonStyle.Primary).setEmoji('🟦'), new discord_js_1.ButtonBuilder().setCustomId('ticket:greet').setLabel('Saudar Atendimento').setStyle(discord_js_1.ButtonStyle.Primary).setEmoji('👋'), new discord_js_1.ButtonBuilder().setCustomId('ticket:note').setLabel('Adicionar Observação Interna').setStyle(discord_js_1.ButtonStyle.Secondary).setEmoji('🗒️'), new discord_js_1.ButtonBuilder().setCustomId('ticket:close').setLabel('Finalizar Ticket').setStyle(discord_js_1.ButtonStyle.Success).setEmoji('✅'));
    return [row1, row2, row3];
}
const rateMap = new Map();
function isRateLimited(key, ms) {
    const now = Date.now();
    const last = rateMap.get(key) || 0;
    if (now - last < ms)
        return true;
    rateMap.set(key, now);
    return false;
}
// Individual handlers (minimal logic for now)
async function handleCancel(ctx) {
    return (0, lockManager_1.withTicketLock)(ctx.ticket.id, async () => {
        if (ctx.ticket.status !== 'open')
            return 'Ticket já não está aberto.';
        ctx.ticket.status = 'cancelled';
        await ctx.ticket.save();
        await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'cancel');
        return '✅ Ticket cancelado.';
    });
}
async function handleHowDM() { return 'Para abrir as DMs: Vá a Definições > Privacidade & Segurança > Permitir mensagens de membros do servidor.'; }
async function handleClaim(ctx) {
    return (0, lockManager_1.withTicketLock)(ctx.ticket.id, async () => {
        if (ctx.ticket.staffAssigned)
            return 'Já está atribuído.';
        ctx.ticket.staffAssigned = ctx.userId;
        await ctx.ticket.save();
        await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'claim');
        return '📌 Atendimento assumido.';
    });
}
async function handleClose(ctx) {
    return (0, lockManager_1.withTicketLock)(ctx.ticket.id, async () => {
        if (ctx.ticket.status !== 'open')
            return 'Ticket já fechado.';
        ctx.ticket.status = 'closed';
        await ctx.ticket.save();
        await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'close');
        return '✅ Ticket fechado.';
    });
}
// Placeholder minimal handlers
async function handleRename(ctx) {
    const modal = new discord_js_1.ModalBuilder().setCustomId('ticket:rename:modal').setTitle('Renomear Canal');
    const input = new discord_js_1.TextInputBuilder().setCustomId('ticket:rename:name').setLabel('Novo nome do canal').setStyle(discord_js_1.TextInputStyle.Short).setMinLength(2).setMaxLength(90).setRequired(true);
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(input));
    await ctx.channel.client.api; // noop to keep TS calm
    await ctx.interaction?.showModal?.(modal); // if called from dispatcher with interaction
    return '📝 Introduza o novo nome (modal).';
}
async function handleMove(ctx) {
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder().setCustomId('ticket:move:select').setPlaceholder('Escolhe uma categoria…').addChannelTypes(discord_js_1.ChannelType.GuildCategory));
    return { content: '🔁 Seleciona a categoria para mover o ticket.', components: [row] };
}
async function handleAddMember(ctx) {
    const key = `${ctx.channel.id}:add:${ctx.userId}`;
    if (isRateLimited(key, 5000))
        return '⏱️ Aguarde alguns segundos antes de repetir.';
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.UserSelectMenuBuilder().setCustomId('ticket:add_member:select').setPlaceholder('Seleciona membros para adicionar…').setMinValues(1).setMaxValues(5));
    return { content: '➕ Escolhe quem adicionar ao ticket.', components: [row] };
}
async function handleRemoveMember(ctx) {
    const key = `${ctx.channel.id}:remove:${ctx.userId}`;
    if (isRateLimited(key, 5000))
        return '⏱️ Aguarde alguns segundos antes de repetir.';
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.UserSelectMenuBuilder().setCustomId('ticket:remove_member:select').setPlaceholder('Seleciona membros para remover…').setMinValues(1).setMaxValues(5));
    return { content: '❌ Escolhe quem remover do ticket.', components: [row] };
}
async function handleCallMember(ctx) {
    const key = `${ctx.channel.id}:call:${ctx.userId}`;
    if (isRateLimited(key, 10000))
        return '⏱️ Evite spam — aguarde 10 segundos.';
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId('ticket:call_member:role').setPlaceholder('Escolhe um cargo para chamar…'));
    return { content: '🔔 Escolhe o cargo a mencionar.', components: [row] };
}
async function handleGreet(ctx) { return `👋 Olá! Sou <@${ctx.userId}>. Em que posso ajudar?`; }
async function handleNote(ctx) {
    const modal = new discord_js_1.ModalBuilder().setCustomId('ticket:note:modal').setTitle('Nota interna');
    const input = new discord_js_1.TextInputBuilder().setCustomId('ticket:note:text').setLabel('Conteúdo da nota').setStyle(discord_js_1.TextInputStyle.Paragraph).setMinLength(2).setMaxLength(1000).setRequired(true);
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(input));
    await ctx.interaction?.showModal?.(modal);
    return '🗒️ Introduza a nota (modal).';
}
async function resolveTicket(channel) {
    return ticket_1.TicketModel.findOne({ channelId: channel.id });
}
