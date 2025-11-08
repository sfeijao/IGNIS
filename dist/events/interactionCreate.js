"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ticketService_1 = require("../services/ticketService");
module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isButton()) {
            const btn = interaction;
            const channel = btn.channel;
            const ticket = await (0, ticketService_1.resolveTicket)(channel);
            if (!ticket)
                return btn.reply({ content: 'Ticket não encontrado.', flags: discord_js_1.MessageFlags.Ephemeral });
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
                case 'ticket:close':
                    response = await (0, ticketService_1.handleClose)(ctx);
                    break;
                case 'ticket:rename':
                    response = await (0, ticketService_1.handleRename)(ctx);
                    break;
                case 'ticket:move':
                    response = await (0, ticketService_1.handleMove)(ctx);
                    break;
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
            }
            try {
                if (typeof response === 'string') {
                    await btn.reply({ content: response, flags: discord_js_1.MessageFlags.Ephemeral });
                }
                else {
                    const r = response;
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
                        return m.reply({ content: 'Ticket não encontrado.', flags: discord_js_1.MessageFlags.Ephemeral });
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
                    return m.reply({ content: 'Ticket não encontrado.', flags: discord_js_1.MessageFlags.Ephemeral });
                const result = await (0, ticketService_1.handleFeedbackSubmit)({ interaction: m, ticket, guildId: m.guildId, userId: m.user.id });
                return m.reply({ content: result, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            return;
        }
        if (interaction.isUserSelectMenu()) {
            const sel = interaction;
            const channel = sel.channel;
            const ticket = await (0, ticketService_1.resolveTicket)(channel);
            if (!ticket)
                return sel.reply({ content: 'Ticket não encontrado.', flags: discord_js_1.MessageFlags.Ephemeral });
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
        if (interaction.isRoleSelectMenu()) {
            const sel = interaction;
            const channel = sel.channel;
            const ticket = await (0, ticketService_1.resolveTicket)(channel);
            if (!ticket)
                return sel.reply({ content: 'Ticket não encontrado.', flags: discord_js_1.MessageFlags.Ephemeral });
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
                return sel.reply({ content: 'Ticket não encontrado.', flags: discord_js_1.MessageFlags.Ephemeral });
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
