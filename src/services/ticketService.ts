import { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, TextChannel } from 'discord.js';
import { TicketModel } from '../models/ticket';
import { TicketLogModel } from '../models/ticketLog';
import { withTicketLock } from '../utils/lockManager';

interface ActionContext {
  guildId: string;
  channel: TextChannel;
  userId: string;
  member: GuildMember;
  // Using any here to avoid tight coupling with mongoose Document generics in this minimal setup
  ticket: any;
}

async function log(ticketId: string, guildId: string, byUserId: string, action: string, payload: Record<string, unknown> = {}) {
  await TicketLogModel.create({ ticketId, guildId, byUserId, action, payload });
}

function isStaff(member: GuildMember, guildConfig?: any): boolean {
  const staffRoles: string[] = guildConfig?.staffRoles || [];
  return member.roles.cache.some(r => staffRoles.includes(r.id));
}

export async function buildPanelEmbed(author: GuildMember, categoryName: string, thumbnailUrl?: string) {
  return new EmbedBuilder()
    .setTitle('Ticket Criado com Sucesso! 📌')
    .setDescription(
      'Todos os responsáveis pelo ticket já estão cientes da abertura.\n' +
      'Evite chamar alguém via DM, basta aguardar alguém já irá lhe atender...'
    )
    .addFields(
      { name: 'Categoria Escolhida:', value: `🧾 \`Ticket ${categoryName || 'Suporte'}\``, inline: false },
      { name: '\u200B', value: '**DESCREVA O MOTIVO DO CONTACTO COM O MÁXIMO DE DETALHES POSSÍVEIS...**', inline: false }
    )
    .setThumbnail(thumbnailUrl || author.displayAvatarURL())
    .setColor(0x2F3136)
    .setFooter({ text: 'OBS: Procure manter sua DM aberta para receber uma cópia deste ticket e a opção de avaliar seu atendimento.' });
}

export function buildPanelComponents() {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket:cancel').setLabel('Desejo sair ou cancelar este ticket').setStyle(ButtonStyle.Danger).setEmoji('🧯'),
    new ButtonBuilder().setCustomId('ticket:how_dm').setLabel('Como libero minha DM?').setStyle(ButtonStyle.Secondary).setEmoji('❓'),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket:call_member').setLabel('Chamar Membro').setStyle(ButtonStyle.Primary).setEmoji('🔔'),
    new ButtonBuilder().setCustomId('ticket:add_member').setLabel('Adicionar Membro').setStyle(ButtonStyle.Success).setEmoji('➕'),
    new ButtonBuilder().setCustomId('ticket:remove_member').setLabel('Remover Membro').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    new ButtonBuilder().setCustomId('ticket:move').setLabel('Mover Ticket').setStyle(ButtonStyle.Secondary).setEmoji('🔁'),
    new ButtonBuilder().setCustomId('ticket:rename').setLabel('Trocar Nome do Canal').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
  );
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket:claim').setLabel('Assumir Atendimento').setStyle(ButtonStyle.Primary).setEmoji('🟦'),
    new ButtonBuilder().setCustomId('ticket:greet').setLabel('Saudar Atendimento').setStyle(ButtonStyle.Primary).setEmoji('👋'),
    new ButtonBuilder().setCustomId('ticket:note').setLabel('Adicionar Observação Interna').setStyle(ButtonStyle.Secondary).setEmoji('🗒️'),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Finalizar Ticket').setStyle(ButtonStyle.Success).setEmoji('✅'),
  );
  return [row1, row2, row3];
}

// Individual handlers (minimal logic for now)
export async function handleCancel(ctx: ActionContext) {
  return withTicketLock(ctx.ticket.id, async () => {
    if (ctx.ticket.status !== 'open') return 'Ticket já não está aberto.';
    ctx.ticket.status = 'cancelled';
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'cancel');
    return '✅ Ticket cancelado.';
  });
}

export async function handleHowDM() { return 'Para abrir as DMs: Vá a Definições > Privacidade & Segurança > Permitir mensagens de membros do servidor.'; }

export async function handleClaim(ctx: ActionContext) {
  return withTicketLock(ctx.ticket.id, async () => {
    if (ctx.ticket.staffAssigned) return 'Já está atribuído.';
    ctx.ticket.staffAssigned = ctx.userId;
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'claim');
    return '📌 Atendimento assumido.';
  });
}

export async function handleClose(ctx: ActionContext) {
  return withTicketLock(ctx.ticket.id, async () => {
    if (ctx.ticket.status !== 'open') return 'Ticket já fechado.';
    ctx.ticket.status = 'closed';
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'close');
    return '✅ Ticket fechado.';
  });
}

// Placeholder minimal handlers
export async function handleRename() { return '📝 Renomear canal em breve.'; }
export async function handleMove() { return '🔁 Mover ticket em breve.'; }
export async function handleAddMember() { return '➕ Adicionar membro em breve.'; }
export async function handleRemoveMember() { return '❌ Remover membro em breve.'; }
export async function handleCallMember() { return '🔔 Chamar membro em breve.'; }
export async function handleGreet(ctx: ActionContext) { return `👋 Olá! Sou <@${ctx.userId}>. Em que posso ajudar?`; }
export async function handleNote() { return '🗒️ Nota interna em breve.'; }

export async function resolveTicket(channel: TextChannel): Promise<Awaited<ReturnType<typeof TicketModel.findOne>> | null> {
  return TicketModel.findOne({ channelId: channel.id });
}
