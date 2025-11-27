import logger from '../utils/logger';
import { Interaction, ButtonInteraction, TextChannel, ModalSubmitInteraction, UserSelectMenuInteraction, RoleSelectMenuInteraction, ChannelSelectMenuInteraction, StringSelectMenuInteraction, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { resolveTicket, handleCancel, handleHowDM, handleClaim, handleClose, handleRename, handleMove, handleAddMember, handleRemoveMember, handleCallMember, handleGreet, handleNote, handleExport, handleFeedbackButton, handleFeedbackSubmit, handleRelease, handleLockToggle, handleTranscript, handlePrioritySet } from '../services/ticketService';

module.exports = {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;
      const channel = btn.channel as TextChannel;
      const ticket = await resolveTicket(channel);
      // If this channel isn't managed by the TS TicketModel (legacy system handles it), do not interfere
      if (!ticket) return; // let communityTickets/ticketHandler.js process

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
        case 'ticket:release': response = await handleRelease(ctx); break;
        case 'ticket:lock-toggle': response = await handleLockToggle(ctx); break;
        case 'ticket:transcript': response = await handleTranscript(ctx); break;
        case 'ticket:priority': {
          // Build select menu inline
          const current = (ctx.ticket.meta?.priority || 'normal').toLowerCase();
          const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket:priority:select')
            .setPlaceholder('Seleciona a prioridade')
            .addOptions(
              { label: 'Baixa', value: 'low', description: 'Menos urgente', default: current === 'low' },
              { label: 'Normal', value: 'normal', description: 'Prioridade padrão', default: current === 'normal' },
              { label: 'Alta', value: 'high', description: 'Requer atenção', default: current === 'high' },
              { label: 'URGENTE', value: 'urgent', description: 'Criticidade máxima', default: current === 'urgent' },
            );
          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
          response = { content: '⚡ Escolhe a nova prioridade para este ticket:', components: [row as any] };
          break;
        }
      }
      try {
        if (typeof response === 'string') {
          await btn.reply({ content: response, flags: MessageFlags.Ephemeral });
        } else {
          const r: any = response;
          await btn.reply({ content: r.content || 'Ok', components: r.components as any, flags: MessageFlags.Ephemeral });
        }
      } catch (e) { logger.debug('Caught error:', e?.message || e); }
      return;
    }
    if (interaction.isModalSubmit()) {
      const m = interaction as ModalSubmitInteraction;
      if (m.customId === 'ticket:rename:modal') {
        const name = m.fields.getTextInputValue('ticket:rename:name');
        try {
          if (m.channel && 'setName' in m.channel) await (m.channel as any).setName(name);
          await m.reply({ content: '📝 Canal renomeado com sucesso.', flags: MessageFlags.Ephemeral });
        } catch (e) {
          await m.reply({ content: '❌ Não foi possível renomear o canal (permissões?).', flags: MessageFlags.Ephemeral });
        }
        return;
      }
      if (m.customId === 'ticket:note:modal') {
        const text = m.fields.getTextInputValue('ticket:note:text');
        try {
          const channel = m.channel as TextChannel;
          const ticket: any = await resolveTicket(channel);
          if (!ticket) return; // legacy system will handle
          ticket.notes = ticket.notes || [];
          ticket.notes.push({ by: m.user.id, text, createdAt: new Date() });
          await ticket.save();
          await m.reply({ content: '🗒️ Nota interna registada.', flags: MessageFlags.Ephemeral });
        } catch {
          await m.reply({ content: '❌ Falha ao guardar nota.', flags: MessageFlags.Ephemeral });
        }
        return;
      }
      if (m.customId === 'ticket:feedback:modal') {
        const channel = m.channel as TextChannel;
        const ticket: any = await resolveTicket(channel);
        if (!ticket) return; // legacy system will handle
        const result = await handleFeedbackSubmit({ interaction: m, ticket, guildId: m.guildId!, userId: m.user.id });
        return m.reply({ content: result, flags: MessageFlags.Ephemeral });
      }
      return;
    }
    if (interaction.isUserSelectMenu()) {
      const sel = interaction as UserSelectMenuInteraction;
      const channel = sel.channel as TextChannel;
      const ticket = await resolveTicket(channel);
      if (!ticket) return; // legacy system will handle
      const ids = sel.values;
      try {
        if (sel.customId === 'ticket:add_member:select') {
          for (const id of ids) {
            await channel.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: true });
          }
          await sel.reply({ content: `➕ Adicionados: ${ids.map(i=>`<@${i}>`).join(', ')}`, flags: MessageFlags.Ephemeral });
        } else if (sel.customId === 'ticket:remove_member:select') {
          for (const id of ids) {
            await channel.permissionOverwrites.delete(id).catch(()=>{});
          }
          await sel.reply({ content: `❌ Removidos: ${ids.map(i=>`<@${i}>`).join(', ')}`, flags: MessageFlags.Ephemeral });
        }
      } catch {
        await sel.reply({ content: '❌ Falha a atualizar permissões.', flags: MessageFlags.Ephemeral });
      }
      return;
    }
    if (interaction.isStringSelectMenu()) {
      const sel = interaction as StringSelectMenuInteraction;
      const channel = sel.channel as TextChannel;
      const ticket = await resolveTicket(channel);
      if (!ticket) return; // legacy handles legacy tickets
      if (sel.customId === 'ticket:priority:select') {
        const value = sel.values?.[0];
        const ctx: any = { guildId: sel.guildId!, channel, userId: sel.user.id, member: sel.member as any, ticket, interaction: sel };
        const result = await handlePrioritySet(ctx, value);
        try { await sel.reply({ content: typeof result === 'string' ? result : (result as any).content || 'Atualizado', flags: MessageFlags.Ephemeral }); } catch (e) { logger.debug('Caught error:', e?.message || e); }
        return;
      }
    }
    if (interaction.isRoleSelectMenu()) {
      const sel = interaction as RoleSelectMenuInteraction;
      const channel = sel.channel as TextChannel;
      const ticket = await resolveTicket(channel);
      if (!ticket) return; // legacy system will handle
      const roleIds = sel.values;
      try {
        const mention = roleIds.map(r=>`<@&${r}>`).join(' ');
        await channel.send({ content: `🔔 Chamando: ${mention}` });
        await sel.reply({ content: '🔔 Notificação enviada.', flags: MessageFlags.Ephemeral });
      } catch {
        await sel.reply({ content: '❌ Falha ao chamar cargo.', flags: MessageFlags.Ephemeral });
      }
      return;
    }
    if (interaction.isChannelSelectMenu()) {
      const sel = interaction as ChannelSelectMenuInteraction;
      const channel = sel.channel as TextChannel;
      const ticket = await resolveTicket(channel);
      if (!ticket) return; // legacy system will handle
      const targetCategoryId = sel.values[0];
      try {
        await channel.setParent(targetCategoryId, { lockPermissions: false });
        await sel.reply({ content: '🔁 Ticket movido para nova categoria.', flags: MessageFlags.Ephemeral });
      } catch {
        await sel.reply({ content: '❌ Falha ao mover ticket.', flags: MessageFlags.Ephemeral });
      }
      return;
    }
  }
};
