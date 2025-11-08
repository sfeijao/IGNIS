import { Interaction, ButtonInteraction, TextChannel, ModalSubmitInteraction, UserSelectMenuInteraction, RoleSelectMenuInteraction, ChannelSelectMenuInteraction } from 'discord.js';
import { resolveTicket, handleCancel, handleHowDM, handleClaim, handleClose, handleRename, handleMove, handleAddMember, handleRemoveMember, handleCallMember, handleGreet, handleNote, handleExport, handleFeedbackButton, handleFeedbackSubmit } from '../services/ticketService';

module.exports = {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;
      const channel = btn.channel as TextChannel;
      const ticket = await resolveTicket(channel);
      if (!ticket) return btn.reply({ content: 'Ticket não encontrado.', ephemeral: true });

      const ctx: any = { guildId: btn.guildId!, channel, userId: btn.user.id, member: btn.member as any, ticket, interaction: btn };
  let response: any = 'Ação não reconhecida.';
      switch (btn.customId) {
        case 'ticket:cancel': response = await handleCancel(ctx); break;
        case 'ticket:how_dm': response = await handleHowDM(); break;
        case 'ticket:claim': response = await handleClaim(ctx); break;
        case 'ticket:close': response = await handleClose(ctx); break;
        case 'ticket:rename': response = await handleRename(ctx); break;
        case 'ticket:move': response = await handleMove(ctx); break;
  case 'ticket:add_member': response = await handleAddMember(ctx); break;
  case 'ticket:remove_member': response = await handleRemoveMember(ctx); break;
  case 'ticket:call_member': response = await handleCallMember(ctx); break;
        case 'ticket:greet': response = await handleGreet(ctx); break;
  case 'ticket:note': response = await handleNote(ctx); break;
  case 'ticket:export': response = await handleExport(ctx); break;
  case 'ticket:feedback': response = await handleFeedbackButton(ctx); break;
      }
      try {
        if (typeof response === 'string') {
          await btn.reply({ content: response, ephemeral: true });
        } else {
          const r: any = response;
          await btn.reply({ content: r.content || 'Ok', components: r.components as any, ephemeral: true });
        }
      } catch {}
      return;
    }
    if (interaction.isModalSubmit()) {
      const m = interaction as ModalSubmitInteraction;
      if (m.customId === 'ticket:rename:modal') {
        const name = m.fields.getTextInputValue('ticket:rename:name');
        try {
          if (m.channel && 'setName' in m.channel) await (m.channel as any).setName(name);
          await m.reply({ content: '📝 Canal renomeado com sucesso.', ephemeral: true });
        } catch (e) {
          await m.reply({ content: '❌ Não foi possível renomear o canal (permissões?).', ephemeral: true });
        }
        return;
      }
      if (m.customId === 'ticket:note:modal') {
        const text = m.fields.getTextInputValue('ticket:note:text');
        try {
          const channel = m.channel as TextChannel;
          const ticket: any = await resolveTicket(channel);
          if (!ticket) return m.reply({ content: 'Ticket não encontrado.', ephemeral: true });
          ticket.notes = ticket.notes || [];
          ticket.notes.push({ by: m.user.id, text, createdAt: new Date() });
          await ticket.save();
          await m.reply({ content: '🗒️ Nota interna registada.', ephemeral: true });
        } catch {
          await m.reply({ content: '❌ Falha ao guardar nota.', ephemeral: true });
        }
        return;
      }
      if (m.customId === 'ticket:feedback:modal') {
        const channel = m.channel as TextChannel;
        const ticket: any = await resolveTicket(channel);
        if (!ticket) return m.reply({ content: 'Ticket não encontrado.', ephemeral: true });
        const result = await handleFeedbackSubmit({ interaction: m, ticket, guildId: m.guildId!, userId: m.user.id });
        return m.reply({ content: result, ephemeral: true });
      }
      return;
    }
    if (interaction.isUserSelectMenu()) {
      const sel = interaction as UserSelectMenuInteraction;
      const channel = sel.channel as TextChannel;
      const ticket = await resolveTicket(channel);
      if (!ticket) return sel.reply({ content: 'Ticket não encontrado.', ephemeral: true });
      const ids = sel.values;
      try {
        if (sel.customId === 'ticket:add_member:select') {
          for (const id of ids) {
            await channel.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: true });
          }
          await sel.reply({ content: `➕ Adicionados: ${ids.map(i=>`<@${i}>`).join(', ')}`, ephemeral: true });
        } else if (sel.customId === 'ticket:remove_member:select') {
          for (const id of ids) {
            await channel.permissionOverwrites.delete(id).catch(()=>{});
          }
          await sel.reply({ content: `❌ Removidos: ${ids.map(i=>`<@${i}>`).join(', ')}`, ephemeral: true });
        }
      } catch {
        await sel.reply({ content: '❌ Falha a atualizar permissões.', ephemeral: true });
      }
      return;
    }
    if (interaction.isRoleSelectMenu()) {
      const sel = interaction as RoleSelectMenuInteraction;
      const channel = sel.channel as TextChannel;
      const ticket = await resolveTicket(channel);
      if (!ticket) return sel.reply({ content: 'Ticket não encontrado.', ephemeral: true });
      const roleIds = sel.values;
      try {
        const mention = roleIds.map(r=>`<@&${r}>`).join(' ');
        await channel.send({ content: `🔔 Chamando: ${mention}` });
        await sel.reply({ content: '🔔 Notificação enviada.', ephemeral: true });
      } catch {
        await sel.reply({ content: '❌ Falha ao chamar cargo.', ephemeral: true });
      }
      return;
    }
    if (interaction.isChannelSelectMenu()) {
      const sel = interaction as ChannelSelectMenuInteraction;
      const channel = sel.channel as TextChannel;
      const ticket = await resolveTicket(channel);
      if (!ticket) return sel.reply({ content: 'Ticket não encontrado.', ephemeral: true });
      const targetCategoryId = sel.values[0];
      try {
        await channel.setParent(targetCategoryId, { lockPermissions: false });
        await sel.reply({ content: '🔁 Ticket movido para nova categoria.', ephemeral: true });
      } catch {
        await sel.reply({ content: '❌ Falha ao mover ticket.', ephemeral: true });
      }
      return;
    }
  }
};
