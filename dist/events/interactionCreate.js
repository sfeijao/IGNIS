"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ticketService_1 = require("../services/ticketService");
const pendingClose = new Set();
module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isButton()) {
            const btn = interaction;
            const channel = btn.channel;
            const ticket = await (0, ticketService_1.resolveTicket)(channel);
            // If this channel isn't managed by the TS TicketModel (legacy system handles it), do not interfere
            if (!ticket)
                return; // let communityTickets/ticketHandler.js process
            const ctx = { guildId: btn.guildId, channel, userId: btn.user.id, member: btn.member, ticket, interaction: btn };
            let response = 'Ação não reconhecida.';
            switch (btn.customId) {
                case 'ticket:cancel':
                    response = await (0, ticketService_1.handleCancel)(ctx);
                    break;
                case 'ticket:how_dm':
                    response = await (0, ticketService_1.handleHowDM)();
                    break;
                case 'ticket:claim':
                    response = await (0, ticketService_1.handleClaim)(ctx);
                    break;
                case 'ticket:close': {
                    // Fluxo de confirmação
                    response = await (0, ticketService_1.handleCloseRequest)(ctx);
                    break;
                }
                case 'ticket:close:confirm': {
                    response = await (0, ticketService_1.handleClose)(ctx);
                    break;
                }
                case 'ticket:close:cancel': {
                    response = '❎ Fecho cancelado.';
                    break;
                }
                case 'ticket:rename':
                    response = await (0, ticketService_1.handleRename)(ctx);
                    break;
                case 'ticket:move':
                    response = await (0, ticketService_1.handleMove)(ctx);
                    break;
                default: {
                    // Botões dinâmicos de mover categoria
                    if (btn.customId.startsWith('ticket:move:cat:')) {
                        const categoryId = btn.customId.split(':').pop();
                        response = await (0, ticketService_1.handleMoveToCategory)(ctx, categoryId);
                    } else if (btn.customId === 'ticket:move:other') {
                        // Abrir modal para ID manual
                        const modal = new discord_js_1.ModalBuilder().setCustomId('ticket:move:other:modal').setTitle('Mover Ticket - Categoria Manual');
                        const input = new discord_js_1.TextInputBuilder().setCustomId('ticket:move:other:category_id').setLabel('ID da categoria destino').setStyle(discord_js_1.TextInputStyle.Short).setRequired(true).setMaxLength(30);
                        modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(input));
                        try { await btn.showModal(modal); response = '📁 Introduza o ID no modal.'; } catch { response = '❌ Falha ao abrir modal.'; }
                    }
                    break;
                }
                case 'ticket:add_member':
                    response = await (0, ticketService_1.handleAddMember)(ctx);
                    break;
                case 'ticket:remove_member':
                    response = await (0, ticketService_1.handleRemoveMember)(ctx);
                    break;
                case 'ticket:call_member':
                    response = await (0, ticketService_1.handleCallMember)(ctx);
                    break;
                case 'ticket:greet':
                    response = await (0, ticketService_1.handleGreet)(ctx);
                    break;
                case 'ticket:note':
                    response = await (0, ticketService_1.handleNote)(ctx);
                    break;
                case 'ticket:export':
                    response = await (0, ticketService_1.handleExport)(ctx);
                    break;
                case 'ticket:feedback':
                    response = await (0, ticketService_1.handleFeedbackButton)(ctx);
                    break;
                case 'ticket:release':
                    response = await (0, ticketService_1.handleRelease)(ctx);
                    break;
                case 'ticket:lock-toggle':
                    response = await (0, ticketService_1.handleLockToggle)(ctx);
                    break;
                case 'ticket:transcript':
                    response = await (0, ticketService_1.handleTranscript)(ctx);
                    break;
                case 'ticket:priority': {
                    // Build select menu inline
                    const current = (ctx.ticket.meta?.priority || 'normal').toLowerCase();
                    const menu = new discord_js_1.StringSelectMenuBuilder()
                        .setCustomId('ticket:priority:select')
                        .setPlaceholder('Seleciona a prioridade')
                        .addOptions({ label: 'Baixa', value: 'low', description: 'Menos urgente', default: current === 'low' }, { label: 'Normal', value: 'normal', description: 'Prioridade padrão', default: current === 'normal' }, { label: 'Alta', value: 'high', description: 'Requer atenção', default: current === 'high' }, { label: 'URGENTE', value: 'urgent', description: 'Criticidade máxima', default: current === 'urgent' });
                    const row = new discord_js_1.ActionRowBuilder().addComponents(menu);
                    response = { content: '⚡ Escolhe a nova prioridade para este ticket:', components: [row] };
                    break;
                }
            }
            try {
                if (typeof response === 'string') {
                    if (!btn.replied && !btn.deferred)
                        await btn.reply({ content: response, flags: discord_js_1.MessageFlags.Ephemeral });
                }
                else {
                    const r = response;
                    if (!btn.replied && !btn.deferred)
                        await btn.reply({ content: r.content || 'Ok', components: r.components, flags: discord_js_1.MessageFlags.Ephemeral });
                }
            }
            catch { }
            return;
        }
        if (interaction.isModalSubmit()) {
            const m = interaction;
            if (m.customId === 'ticket:rename:modal') {
                const name = m.fields.getTextInputValue('ticket:rename:name');
                try {
                    if (m.channel && 'setName' in m.channel)
                        await m.channel.setName(name);
                    await m.reply({ content: '📝 Canal renomeado com sucesso.', flags: discord_js_1.MessageFlags.Ephemeral });
                }
                catch (e) {
                    await m.reply({ content: '❌ Não foi possível renomear o canal (permissões?).', flags: discord_js_1.MessageFlags.Ephemeral });
                }
                return;
            }
            if (m.customId === 'ticket:note:modal') {
                const text = m.fields.getTextInputValue('ticket:note:text');
                try {
                    const channel = m.channel;
                    const ticket = await (0, ticketService_1.resolveTicket)(channel);
                    if (!ticket)
                        return; // legacy system will handle
                    ticket.notes = ticket.notes || [];
                    ticket.notes.push({ by: m.user.id, text, createdAt: new Date() });
                    await ticket.save();
                    await m.reply({ content: '🗒️ Nota interna registada.', flags: discord_js_1.MessageFlags.Ephemeral });
                }
                catch {
                    await m.reply({ content: '❌ Falha ao guardar nota.', flags: discord_js_1.MessageFlags.Ephemeral });
                }
                return;
            }
            if (m.customId === 'ticket:feedback:modal') {
                const channel = m.channel;
                const ticket = await (0, ticketService_1.resolveTicket)(channel);
                if (!ticket)
                    return; // legacy system will handle
                const result = await (0, ticketService_1.handleFeedbackSubmit)({ interaction: m, ticket, guildId: m.guildId, userId: m.user.id });
                return m.reply({ content: result, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            if (m.customId === 'ticket:add_member:modal') {
                const channel = m.channel;
                const ticket = await (0, ticketService_1.resolveTicket)(channel);
                if (!ticket)
                    return;
                const raw = m.fields.getTextInputValue('ticket:add_member:ids');
                const ids = Array.from(new Set(raw.split(/[\s,]+/).map(s => s.replace(/[^0-9]/g, '')).filter(Boolean))).slice(0, 10);
                let ok = [];
                for (const id of ids) {
                    try { await channel.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: true }); ok.push(id); } catch { }
                }
                return m.reply({ content: ok.length ? `➕ Adicionados: ${ok.map(i => `<@${i}>`).join(', ')}` : '❌ Nenhum ID válido.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
            if (m.customId === 'ticket:remove_member:modal') {
                const channel = m.channel;
                const ticket = await (0, ticketService_1.resolveTicket)(channel);
                if (!ticket)
                    return;
                const raw = m.fields.getTextInputValue('ticket:remove_member:ids');
                const ids = Array.from(new Set(raw.split(/[\s,]+/).map(s => s.replace(/[^0-9]/g, '')).filter(Boolean))).slice(0, 10);
                let ok = [];
                for (const id of ids) {
                    try { await channel.permissionOverwrites.delete(id).catch(() => { }); ok.push(id); } catch { }
                }
                return m.reply({ content: ok.length ? `❌ Removidos: ${ok.map(i => `<@${i}>`).join(', ')}` : '❌ Nenhum ID válido.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
            if (m.customId === 'ticket:move:other:modal') {
                const channel = m.channel;
                const ticket = await (0, ticketService_1.resolveTicket)(channel);
                if (!ticket)
                    return;
                const res = await (0, ticketService_1.handleMoveOtherModal)({ interaction: m, ticket, guildId: m.guildId, userId: m.user.id });
                return m.reply({ content: res, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            return;
        }
        if (interaction.isUserSelectMenu()) {
            const sel = interaction;
            const channel = sel.channel;
            const ticket = await (0, ticketService_1.resolveTicket)(channel);
            if (!ticket)
                return; // legacy system will handle
            const ids = sel.values;
            try {
                if (sel.customId === 'ticket:add_member:select') {
                    for (const id of ids) {
                        await channel.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: true });
                    }
                    await sel.reply({ content: `➕ Adicionados: ${ids.map(i => `<@${i}>`).join(', ')}`, flags: discord_js_1.MessageFlags.Ephemeral });
                }
                else if (sel.customId === 'ticket:remove_member:select') {
                    for (const id of ids) {
                        await channel.permissionOverwrites.delete(id).catch(() => { });
                    }
                    await sel.reply({ content: `❌ Removidos: ${ids.map(i => `<@${i}>`).join(', ')}`, flags: discord_js_1.MessageFlags.Ephemeral });
                }
            }
            catch {
                await sel.reply({ content: '❌ Falha a atualizar permissões.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
            return;
        }
        if (interaction.isStringSelectMenu()) {
            const sel = interaction;
            const channel = sel.channel;
            const ticket = await (0, ticketService_1.resolveTicket)(channel);
            if (!ticket)
                return; // legacy handles legacy tickets
            if (sel.customId === 'ticket:priority:select') {
                const value = sel.values?.[0];
                const ctx = { guildId: sel.guildId, channel, userId: sel.user.id, member: sel.member, ticket, interaction: sel };
                const result = await (0, ticketService_1.handlePrioritySet)(ctx, value);
                try {
                    await sel.reply({ content: typeof result === 'string' ? result : result.content || 'Atualizado', flags: discord_js_1.MessageFlags.Ephemeral });
                }
                catch { }
                return;
            }
        }
        if (interaction.isRoleSelectMenu()) {
            const sel = interaction;
            const channel = sel.channel;
            const ticket = await (0, ticketService_1.resolveTicket)(channel);
            if (!ticket)
                return; // legacy system will handle
            const roleIds = sel.values;
            try {
                const mention = roleIds.map(r => `<@&${r}>`).join(' ');
                await channel.send({ content: `🔔 Chamando: ${mention}` });
                await sel.reply({ content: '🔔 Notificação enviada.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
            catch {
                await sel.reply({ content: '❌ Falha ao chamar cargo.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
            return;
        }
        if (interaction.isChannelSelectMenu()) {
            const sel = interaction;
            const channel = sel.channel;
            const ticket = await (0, ticketService_1.resolveTicket)(channel);
            if (!ticket)
                return; // legacy system will handle
            const targetCategoryId = sel.values[0];
            try {
                await channel.setParent(targetCategoryId, { lockPermissions: false });
                await sel.reply({ content: '🔁 Ticket movido para nova categoria.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
            catch {
                await sel.reply({ content: '❌ Falha ao mover ticket.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
            return;
        }
    }
};
