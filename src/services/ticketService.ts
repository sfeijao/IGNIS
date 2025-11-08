import { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, TextChannel, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, PermissionsBitField } from 'discord.js';
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

type ActionResult = string | { content?: string; components?: ActionRowBuilder<any>[] };

const rateMap = new Map<string, number>();
function isRateLimited(key: string, ms: number) {
  const now = Date.now();
  const last = rateMap.get(key) || 0;
  if (now - last < ms) return true;
  rateMap.set(key, now);
  return false;
}

// Individual handlers (minimal logic for now)
export async function handleCancel(ctx: ActionContext): Promise<ActionResult> {
  return withTicketLock(ctx.ticket.id, async () => {
    if (ctx.ticket.status !== 'open') return 'Ticket já não está aberto.';
    ctx.ticket.status = 'cancelled';
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'cancel');
    return '✅ Ticket cancelado.';
  });
}

export async function handleHowDM() { return 'Para abrir as DMs: Vá a Definições > Privacidade & Segurança > Permitir mensagens de membros do servidor.'; }

export async function handleClaim(ctx: ActionContext): Promise<ActionResult> {
  return withTicketLock(ctx.ticket.id, async () => {
    if (ctx.ticket.staffAssigned) return 'Já está atribuído.';
    ctx.ticket.staffAssigned = ctx.userId;
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'claim');
    return '📌 Atendimento assumido.';
  });
}

export async function handleClose(ctx: ActionContext): Promise<ActionResult> {
  return withTicketLock(ctx.ticket.id, async () => {
    if (ctx.ticket.status !== 'open') return 'Ticket já fechado.';
    ctx.ticket.status = 'closed';
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'close');
    return '✅ Ticket fechado.';
  });
}

// Placeholder minimal handlers
export async function handleRename(ctx: ActionContext): Promise<ActionResult> {
  const modal = new ModalBuilder().setCustomId('ticket:rename:modal').setTitle('Renomear Canal');
  const input = new TextInputBuilder().setCustomId('ticket:rename:name').setLabel('Novo nome do canal').setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(90).setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await (ctx.channel as any).client.api; // noop to keep TS calm
  await (ctx as any).interaction?.showModal?.(modal); // if called from dispatcher with interaction
  return '📝 Introduza o novo nome (modal).';
}

export async function handleMove(ctx: ActionContext): Promise<ActionResult> {
  const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('ticket:move:select').setPlaceholder('Escolhe uma categoria…').addChannelTypes(ChannelType.GuildCategory)
  );
  return { content: '🔁 Seleciona a categoria para mover o ticket.', components: [row as any] };
}

export async function handleAddMember(ctx: ActionContext): Promise<ActionResult> {
  const key = `${ctx.channel.id}:add:${ctx.userId}`;
  if (isRateLimited(key, 5000)) return '⏱️ Aguarde alguns segundos antes de repetir.';
  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder().setCustomId('ticket:add_member:select').setPlaceholder('Seleciona membros para adicionar…').setMinValues(1).setMaxValues(5)
  );
  return { content: '➕ Escolhe quem adicionar ao ticket.', components: [row as any] };
}

export async function handleRemoveMember(ctx: ActionContext): Promise<ActionResult> {
  const key = `${ctx.channel.id}:remove:${ctx.userId}`;
  if (isRateLimited(key, 5000)) return '⏱️ Aguarde alguns segundos antes de repetir.';
  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder().setCustomId('ticket:remove_member:select').setPlaceholder('Seleciona membros para remover…').setMinValues(1).setMaxValues(5)
  );
  return { content: '❌ Escolhe quem remover do ticket.', components: [row as any] };
}

export async function handleCallMember(ctx: ActionContext): Promise<ActionResult> {
  const key = `${ctx.channel.id}:call:${ctx.userId}`;
  if (isRateLimited(key, 10000)) return '⏱️ Evite spam — aguarde 10 segundos.';
  const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder().setCustomId('ticket:call_member:role').setPlaceholder('Escolhe um cargo para chamar…')
  );
  return { content: '🔔 Escolhe o cargo a mencionar.', components: [row as any] };
}

export async function handleGreet(ctx: ActionContext): Promise<ActionResult> { return `👋 Olá! Sou <@${ctx.userId}>. Em que posso ajudar?`; }

export async function handleNote(ctx: ActionContext): Promise<ActionResult> {
  const modal = new ModalBuilder().setCustomId('ticket:note:modal').setTitle('Nota interna');
  const input = new TextInputBuilder().setCustomId('ticket:note:text').setLabel('Conteúdo da nota').setStyle(TextInputStyle.Paragraph).setMinLength(2).setMaxLength(1000).setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await (ctx as any).interaction?.showModal?.(modal);
  return '🗒️ Introduza a nota (modal).';
}

export async function resolveTicket(channel: TextChannel): Promise<Awaited<ReturnType<typeof TicketModel.findOne>> | null> {
  return TicketModel.findOne({ channelId: channel.id });
}
