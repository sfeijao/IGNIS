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
exports.buildPostCloseRow = buildPostCloseRow;
exports.handleExport = handleExport;
exports.handleFeedbackButton = handleFeedbackButton;
exports.handleFeedbackSubmit = handleFeedbackSubmit;
const discord_js_1 = require("discord.js");
const ticket_1 = require("../models/ticket");
const ticketLog_1 = require("../models/ticketLog");
const lockManager_1 = require("../utils/lockManager");
async function log(ticketId, guildId, byUserId, action, payload = {}) {
    await ticketLog_1.TicketLogModel.create({ ticketId, guildId, byUserId, action, payload });
}
// legacy helper removed; using async isStaff below
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
        // Adicionar botões de export/feedback após cancelamento
        try {
            await ctx.channel.send({ content: 'Ticket cancelado. Ações pós-fecho:', components: buildPostCloseRow() });
        }
        catch { }
        return '✅ Ticket cancelado.';
    });
}
async function handleHowDM() { return 'Para abrir as DMs: Vá a Definições > Privacidade & Segurança > Permitir mensagens de membros do servidor.'; }
async function handleClaim(ctx) {
    return (0, lockManager_1.withTicketLock)(ctx.ticket.id, async () => {
        if (ctx.ticket.staffAssigned)
            return 'Já está atribuído.';
        if (!(await isStaff(ctx.member, ctx.guildId)))
            return '⛔ Apenas staff pode assumir.';
        ctx.ticket.staffAssigned = ctx.userId;
        await ctx.ticket.save();
        await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'claim');
        // Tentar atualizar embed original com responsável
        if (ctx.ticket.messageId) {
            try {
                const msg = await ctx.channel.messages.fetch(ctx.ticket.messageId).catch(() => null);
                if (msg && msg.editable && msg.embeds?.[0]) {
                    const original = discord_js_1.EmbedBuilder.from(msg.embeds[0]);
                    // Remover field antigo "Responsável" se existir
                    const fields = original.data.fields || [];
                    const filtered = fields.filter(f => !/Responsável/i.test(f.name));
                    filtered.push({ name: 'Responsável', value: `<@${ctx.userId}>`, inline: false });
                    original.setFields(filtered);
                    await msg.edit({ embeds: [original] });
                }
            }
            catch { }
        }
        return '📌 Atendimento assumido.';
    });
}
async function handleClose(ctx) {
    return (0, lockManager_1.withTicketLock)(ctx.ticket.id, async () => {
        if (ctx.ticket.status !== 'open')
            return 'Ticket já fechado.';
        if (!(await isStaff(ctx.member, ctx.guildId)))
            return '⛔ Apenas staff pode fechar.';
        ctx.ticket.status = 'closed';
        await ctx.ticket.save();
        await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'close');
        try {
            await ctx.channel.send({ content: 'Ticket fechado. Ações pós-fecho:', components: buildPostCloseRow() });
        }
        catch { }
        return '✅ Ticket fechado.';
    });
}
// Placeholder minimal handlers
async function handleRename(ctx) {
    if (!(await isStaff(ctx.member, ctx.guildId)))
        return '⛔ Apenas staff pode renomear.';
    const modal = new discord_js_1.ModalBuilder().setCustomId('ticket:rename:modal').setTitle('Renomear Canal');
    const input = new discord_js_1.TextInputBuilder().setCustomId('ticket:rename:name').setLabel('Novo nome do canal').setStyle(discord_js_1.TextInputStyle.Short).setMinLength(2).setMaxLength(90).setRequired(true);
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(input));
    await ctx.channel.client.api; // noop to keep TS calm
    await ctx.interaction?.showModal?.(modal); // if called from dispatcher with interaction
    return '📝 Introduza o novo nome (modal).';
}
async function handleMove(ctx) {
    if (!(await isStaff(ctx.member, ctx.guildId)))
        return '⛔ Apenas staff pode mover.';
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder().setCustomId('ticket:move:select').setPlaceholder('Escolhe uma categoria…').addChannelTypes(discord_js_1.ChannelType.GuildCategory));
    return { content: '🔁 Seleciona a categoria para mover o ticket.', components: [row] };
}
async function handleAddMember(ctx) {
    if (!(await isStaff(ctx.member, ctx.guildId)))
        return '⛔ Apenas staff pode adicionar membros.';
    const key = `${ctx.channel.id}:add:${ctx.userId}`;
    if (isRateLimited(key, 5000))
        return '⏱️ Aguarde alguns segundos antes de repetir.';
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.UserSelectMenuBuilder().setCustomId('ticket:add_member:select').setPlaceholder('Seleciona membros para adicionar…').setMinValues(1).setMaxValues(5));
    return { content: '➕ Escolhe quem adicionar ao ticket.', components: [row] };
}
async function handleRemoveMember(ctx) {
    if (!(await isStaff(ctx.member, ctx.guildId)))
        return '⛔ Apenas staff pode remover membros.';
    const key = `${ctx.channel.id}:remove:${ctx.userId}`;
    if (isRateLimited(key, 5000))
        return '⏱️ Aguarde alguns segundos antes de repetir.';
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.UserSelectMenuBuilder().setCustomId('ticket:remove_member:select').setPlaceholder('Seleciona membros para remover…').setMinValues(1).setMaxValues(5));
    return { content: '❌ Escolhe quem remover do ticket.', components: [row] };
}
async function handleCallMember(ctx) {
    if (!(await isStaff(ctx.member, ctx.guildId)))
        return '⛔ Apenas staff pode chamar cargos.';
    const key = `${ctx.channel.id}:call:${ctx.userId}`;
    if (isRateLimited(key, 10000))
        return '⏱️ Evite spam — aguarde 10 segundos.';
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId('ticket:call_member:role').setPlaceholder('Escolhe um cargo para chamar…'));
    return { content: '🔔 Escolhe o cargo a mencionar.', components: [row] };
}
async function handleGreet(ctx) { return `👋 Olá! Sou <@${ctx.userId}>. Em que posso ajudar?`; }
async function handleNote(ctx) {
    if (!(await isStaff(ctx.member, ctx.guildId)))
        return '⛔ Apenas staff pode adicionar notas.';
    const modal = new discord_js_1.ModalBuilder().setCustomId('ticket:note:modal').setTitle('Nota interna');
    const input = new discord_js_1.TextInputBuilder().setCustomId('ticket:note:text').setLabel('Conteúdo da nota').setStyle(discord_js_1.TextInputStyle.Paragraph).setMinLength(2).setMaxLength(1000).setRequired(true);
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(input));
    await ctx.interaction?.showModal?.(modal);
    return '🗒️ Introduza a nota (modal).';
}
async function resolveTicket(channel) {
    return ticket_1.TicketModel.findOne({ channelId: channel.id });
}
// Staff gating
const staffCache = new Map();
async function getStaffRoles(guildId) {
    const cached = staffCache.get(guildId);
    const now = Date.now();
    if (cached && (now - cached.ts < 60000))
        return cached.roles;
    let roles = [];
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const storage = require('../../utils/storage');
        const cfg = await storage.getGuildConfig(guildId, 'staffRoles');
        if (Array.isArray(cfg))
            roles = cfg.filter(r => typeof r === 'string');
    }
    catch { }
    staffCache.set(guildId, { roles, ts: now });
    return roles;
}
async function isStaff(member, guildId) {
    try {
        const staffRoles = await getStaffRoles(guildId);
        if (!staffRoles.length)
            return false;
        return member.roles.cache.some(r => staffRoles.includes(r.id));
    }
    catch {
        return false;
    }
}
// Post-close action row
function buildPostCloseRow() {
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('ticket:export').setLabel('Exportar Logs').setStyle(discord_js_1.ButtonStyle.Secondary).setEmoji('📄'), new discord_js_1.ButtonBuilder().setCustomId('ticket:feedback').setLabel('Avaliar Atendimento').setStyle(discord_js_1.ButtonStyle.Primary).setEmoji('⭐'));
    return [row];
}
async function handleExport(ctx) {
    const isStaffMember = await isStaff(ctx.member, ctx.guildId);
    if (!(isStaffMember || ctx.userId === ctx.ticket.ownerId))
        return '⛔ Apenas staff ou autor pode exportar.';
    try {
        const entries = await ticketLog_1.TicketLogModel.find({ ticketId: ctx.ticket.id }).sort({ createdAt: 1 }).limit(500).lean();
        const lines = entries.map(e => `${new Date(e.createdAt || Date.now()).toISOString()} | ${e.byUserId || 'n/a'} | ${e.action} | ${JSON.stringify(e.payload || {})}`);
        const text = lines.join('\n');
        if (text.length < 1800) {
            await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'export', { count: entries.length });
            return '```\n' + text + '\n```';
        }
        // Send as attachment via calling channel send then ephemeral note
        const buf = Buffer.from(text, 'utf8');
        try {
            await ctx.channel.send({ files: [{ attachment: buf, name: `ticket_${ctx.ticket.id}_logs.txt` }] });
        }
        catch { }
        await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'export', { count: entries.length, mode: 'file' });
        return '📄 Logs exportados (ficheiro enviado no canal).';
    }
    catch {
        return '❌ Falha ao exportar logs.';
    }
}
async function handleFeedbackButton(ctx) {
    if (ctx.userId !== ctx.ticket.ownerId)
        return '⛔ Apenas o autor pode avaliar.';
    const modal = new discord_js_1.ModalBuilder().setCustomId('ticket:feedback:modal').setTitle('Avaliar Atendimento');
    const rating = new discord_js_1.TextInputBuilder().setCustomId('ticket:feedback:rating').setLabel('Nota (1-5)').setStyle(discord_js_1.TextInputStyle.Short).setMinLength(1).setMaxLength(1).setRequired(true);
    const comment = new discord_js_1.TextInputBuilder().setCustomId('ticket:feedback:comment').setLabel('Comentário (opcional)').setStyle(discord_js_1.TextInputStyle.Paragraph).setRequired(false).setMaxLength(500);
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(rating), new discord_js_1.ActionRowBuilder().addComponents(comment));
    await ctx.interaction?.showModal?.(modal);
    return '⭐ Introduza feedback (modal).';
}
async function handleFeedbackSubmit(ctx) {
    try {
        const r = ctx.interaction.fields.getTextInputValue('ticket:feedback:rating');
        const c = ctx.interaction.fields.getTextInputValue('ticket:feedback:comment');
        const ratingNum = Number(r);
        if (!(ratingNum >= 1 && ratingNum <= 5))
            return '❌ Nota inválida (use 1-5).';
        ctx.ticket.meta = ctx.ticket.meta || {};
        ctx.ticket.meta.feedback = { rating: ratingNum, comment: c || '', by: ctx.userId, at: new Date() };
        await ctx.ticket.save();
        await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'feedback', { rating: ratingNum });
        return '✅ Feedback registado. Obrigado!';
    }
    catch {
        return '❌ Falha ao registar feedback.';
    }
}
