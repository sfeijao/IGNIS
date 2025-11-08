import { Interaction, ButtonInteraction, TextChannel } from 'discord.js';
import { resolveTicket, handleCancel, handleHowDM, handleClaim, handleClose, handleRename, handleMove, handleAddMember, handleRemoveMember, handleCallMember, handleGreet, handleNote } from '../services/ticketService';

module.exports = {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    if (!interaction.isButton()) return;
    const btn = interaction as ButtonInteraction;
    const channel = btn.channel as TextChannel;
    const ticket = await resolveTicket(channel);
    if (!ticket) return btn.reply({ content: 'Ticket não encontrado.', ephemeral: true });

    const ctx = { guildId: btn.guildId!, channel, userId: btn.user.id, member: btn.member as any, ticket };
    let response: string = 'Ação não reconhecida.';
    switch (btn.customId) {
      case 'ticket:cancel': response = await handleCancel(ctx); break;
      case 'ticket:how_dm': response = await handleHowDM(); break;
      case 'ticket:claim': response = await handleClaim(ctx); break;
      case 'ticket:close': response = await handleClose(ctx); break;
      case 'ticket:rename': response = await handleRename(); break;
      case 'ticket:move': response = await handleMove(); break;
      case 'ticket:add_member': response = await handleAddMember(); break;
      case 'ticket:remove_member': response = await handleRemoveMember(); break;
      case 'ticket:call_member': response = await handleCallMember(); break;
      case 'ticket:greet': response = await handleGreet(ctx); break;
      case 'ticket:note': response = await handleNote(); break;
    }
    try {
      await btn.reply({ content: response, ephemeral: true });
    } catch {}
  }
};
