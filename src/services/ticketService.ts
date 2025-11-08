import { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, TextChannel, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, PermissionsBitField } from 'discord.js';
import { TicketModel } from '../models/ticket';
import { TicketLogModel } from '../models/ticketLog';
import { withTicketLock } from '../utils/lockManager';
import { Client, TextBasedChannel, Message } from 'discord.js';

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

// legacy helper removed; using async isStaff below

export async function buildPanelEmbed(author: GuildMember, categoryName: string, thumbnailUrl?: string) {
  // Layout atualizado conforme screenshot fornecido
  return new EmbedBuilder()
    .setTitle('Ticket Criado com Sucesso! 📌')
    .setDescription(
      'Todos os responsáveis pelo ticket já estão cientes da abertura.\n' +
      'Evite chamar alguém via DM, basta aguardar alguém já irá lhe atender..'
    )
    .addFields(
      { name: 'Categoria Escolhida:', value: `🧾 \`Ticket ${categoryName || 'Suporte'}\``, inline: false },
      { name: 'Lembrando', value: 'que os botões são exclusivos para staff!\n\n`DESCREVA O MOTIVO DO CONTACTO COM O MÁXIMO DE DETALHES POSSÍVEIS QUE ALGUM RESPONSÁVEL JÁ IRÁ LHE ATENDER!`', inline: false }
    )
    .setThumbnail(thumbnailUrl || author.displayAvatarURL())
    .setColor(0x2F3136)
    .setFooter({ text: 'OBS: Procure manter sua DM aberta para receber uma cópia deste ticket e a opção de avaliar seu atendimento.' });
}

// --- V2 helpers (isolated) ---
export function buildPanelEmbedsV2(author: GuildMember, categoryName: string, thumbnailUrl?: string) {
  const main = new EmbedBuilder()
    .setTitle('Ticket Criado com Sucesso! 📌')
    .setDescription('Todos os responsáveis pelo ticket já estão cientes da abertura.\nEvite chamar alguém via DM, basta aguardar alguém já irá lhe atender..')
    .addFields(
      { name: 'Categoria Escolhida:', value: `🧾 \`Ticket ${categoryName || 'Suporte'}\``, inline: false },
      { name: 'Lembrando', value: 'que os botões são exclusivos para staff!\n\n`DESCREVA O MOTIVO DO CONTACTO COM O MÁXIMO DE DETALHES POSSÍVEIS QUE ALGUM RESPONSÁVEL JÁ IRÁ LHE ATENDER!`', inline: false }
    )
    .setThumbnail(thumbnailUrl || author.displayAvatarURL())
    .setColor(0x2F3136);
  const singleMode = (process.env.TICKET_PANEL_SINGLE_EMBED || '').toLowerCase() === 'true';
  if (singleMode) return [main];
  const notice = new EmbedBuilder()
    .setDescription('OBS: Procure manter sua DM aberta para receber uma cópia deste ticket e a opção de avaliar seu atendimento.')
    .setColor(0xED4245);
  return [main, notice];
}

export async function syncTicketPanel(client: Client, ticket: any): Promise<{ updated: boolean; reason?: string }> {
  try {
    if (!ticket || ticket.status !== 'open') return { updated: false, reason: 'not-open' };
    const guild = client.guilds.cache.get(ticket.guildId) || await client.guilds.fetch(ticket.guildId).catch(()=>null);
    if (!guild) return { updated: false, reason: 'guild-missing' };
    const channel = guild.channels.cache.get(ticket.channelId) as TextChannel || await guild.channels.fetch(ticket.channelId).catch(()=>null) as TextChannel;
    if (!channel || !channel.send) return { updated: false, reason: 'channel-missing' };
    // Try fetch existing message
    let existing: Message | null = null;
    if (ticket.messageId) {
      existing = await channel.messages.fetch(ticket.messageId).catch(()=>null);
    }
    // We need a guild member for avatar (fallback: guild owner or first member cached)
    let member: GuildMember | null = null;
    try { member = await guild.members.fetch(ticket.ownerId).catch(()=>null); } catch {}
    if (!member) {
      const ownerId = guild.ownerId || guild.members.cache.first()?.id;
      if (ownerId) member = await guild.members.fetch(ownerId).catch(()=>null);
    }
    if (!member) return { updated: false, reason: 'member-missing' };
    const embeds = buildPanelEmbedsV2(member, ticket.category || 'Suporte');
    const components = buildPanelComponents();
    if (existing && existing.editable) {
      await existing.edit({ embeds, components });
      return { updated: true };
    } else {
      const sent = await channel.send({ embeds, components });
      if (!ticket.messageId) {
        ticket.messageId = sent.id;
        try { await ticket.save(); } catch {}
      }
      return { updated: true, reason: existing ? 'replaced' : 'created' };
    }
  } catch (e: any) {
    return { updated: false, reason: e?.message || 'error' };
  }
}

export async function syncAllOpenTicketPanels(client: Client, guildId: string) {
  const openTickets = await TicketModel.find({ guildId, status: 'open' }).limit(500);
  const results = [] as Array<{ id: string; updated: boolean; reason?: string }>;
  for (const t of openTickets) {
    // small delay to avoid rate limit bursts
    // eslint-disable-next-line no-await-in-loop
    const r = await syncTicketPanel(client, t);
    results.push({ id: t.id, ...r });
  }
  return results;
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
    // Adicionar botões de export/feedback após cancelamento
    try {
      await ctx.channel.send({ content: 'Ticket cancelado. Ações pós-fecho:', components: buildPostCloseRow() });
    } catch {}
    return '✅ Ticket cancelado.';
  });
}

export async function handleHowDM() { return 'Para abrir as DMs: Vá a Definições > Privacidade & Segurança > Permitir mensagens de membros do servidor.'; }

export async function handleClaim(ctx: ActionContext): Promise<ActionResult> {
  return withTicketLock(ctx.ticket.id, async () => {
    if (ctx.ticket.staffAssigned) return 'Já está atribuído.';
    if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode assumir.';
    ctx.ticket.staffAssigned = ctx.userId;
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'claim');
    // Tentar atualizar embed original com responsável
    if (ctx.ticket.messageId) {
      try {
        const msg = await ctx.channel.messages.fetch(ctx.ticket.messageId).catch(()=>null);
        if (msg && msg.editable && msg.embeds?.[0]) {
          const original = EmbedBuilder.from(msg.embeds[0]);
          // Remover field antigo "Responsável" se existir
          const fields = original.data.fields || [];
          const filtered = fields.filter(f => !/Responsável/i.test(f.name));
          filtered.push({ name: 'Responsável', value: `<@${ctx.userId}>`, inline: false });
          original.setFields(filtered as any);
          await msg.edit({ embeds: [original] });
        }
      } catch {}
    }
    return '📌 Atendimento assumido.';
  });
}

export async function handleClose(ctx: ActionContext): Promise<ActionResult> {
  return withTicketLock(ctx.ticket.id, async () => {
    if (ctx.ticket.status !== 'open') return 'Ticket já fechado.';
    if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode fechar.';
    // Gerar transcript antes de fechar
    let transcriptText = '';
    let transcriptHtml = '';
    try {
      const messages: any[] = [];
      // Fetch up to 400 mensagens em páginas de 100 (limite razoável)
      let lastId: string | undefined = undefined;
      for (let i = 0; i < 4; i++) {
        const fetched: any = await ctx.channel.messages.fetch(lastId ? { limit: 100, before: lastId } : { limit: 100 }).catch(() => null);
        if (!fetched || !fetched.size) break;
        const batch: any[] = Array.from((fetched as any).values());
        messages.push(...batch);
        const last: any = batch[batch.length - 1];
        lastId = last?.id as string | undefined;
        if (fetched.size < 100) break; // no more messages
      }
      messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      const lines: string[] = [];
      lines.push(`Ticket ${ctx.ticket.id} Transcript`);
      lines.push(`Canal: ${ctx.channel.name} (${ctx.channel.id})`);
      lines.push(`Fechado por: ${ctx.userId}`);
      lines.push(`Gerado em: ${new Date().toISOString()}`);
      lines.push('');
      for (const m of messages) {
        const when = new Date(m.createdTimestamp).toISOString();
        const authorTag = `${m.author?.username || 'Desconhecido'}#${m.author?.discriminator || '0000'}`;
        const content = (m.content || '').replace(/\n/g, ' ');
        lines.push(`[${when}] ${authorTag}: ${content}`);
        // Incluir embeds simples
        if (Array.isArray(m.embeds) && m.embeds.length) {
          for (const e of m.embeds) {
            const etitle = e.title ? ` ${e.title}` : '';
            const edesc = e.description ? ` ${e.description}` : '';
            lines.push(`[${when}] EMBED:${etitle}${edesc}`.trim());
          }
        }
        // Incluir anexos (apenas nomes/urls)
        if (m.attachments?.size) {
          for (const at of m.attachments.values()) {
            lines.push(`[${when}] ANEXO: ${at.name} ${at.url}`);
          }
        }
      }
      transcriptText = lines.join('\n');
      // HTML muito simples
      const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]!));
      const rows = lines.map(l => `<div class="line">${esc(l)}</div>`).join('');
      transcriptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transcript Ticket ${ctx.ticket.id}</title><style>body{font-family:Segoe UI,Arial,sans-serif;background:#0f1113;color:#eee;padding:16px}h1{font-size:18px;margin:0 0 12px}div.line{font-size:13px;white-space:pre-wrap;font-family:Consolas,monospace;padding:2px 0;border-bottom:1px solid #222}div.line:nth-child(even){background:#14171a}</style></head><body><h1>Transcript Ticket ${ctx.ticket.id}</h1>${rows}</body></html>`;
    } catch {}

    ctx.ticket.status = 'closed';
    ctx.ticket.meta = ctx.ticket.meta || {};
    ctx.ticket.meta.transcript = {
      generatedAt: new Date(),
      messageCount: transcriptText ? transcriptText.split('\n').length - 6 : 0, // approximate count excluding header lines
      text: transcriptText.length > 200000 ? transcriptText.slice(0, 200000) + '\n...[TRUNCATED]' : transcriptText,
      html: transcriptHtml.length > 300000 ? '<!-- Transcript HTML truncado por tamanho -->' : transcriptHtml
    };
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'close', { transcriptStored: !!transcriptText });
    // Disparar webhooks configurados (transcript e vlog) após gerar transcript
    try {
      const webhookSvc = require('./webhookService');
      // Payload base
      const basePayload = {
        ticketId: ctx.ticket.id,
        guildId: ctx.guildId,
        closedBy: ctx.userId,
        channelId: ctx.channel.id,
        transcriptPresent: !!transcriptText,
        closedAt: new Date().toISOString()
      };
      // Transcript webhook (inclui talvez link ou snippet encurtado)
      if (transcriptText) {
        const shortTxt = transcriptText.length > 400 ? (transcriptText.slice(0, 390) + '...') : transcriptText;
        await webhookSvc.postToType(ctx.guildId, 'transcript', { ...basePayload, transcriptSnippet: shortTxt });
      } else {
        await webhookSvc.postToType(ctx.guildId, 'transcript', { ...basePayload, transcriptSnippet: null });
      }
      // Vlog webhook (poderia ser um futuro export em vídeo; placeholder)
      await webhookSvc.postToType(ctx.guildId, 'vlog', { ...basePayload, vlog: false });
      // Modlog webhook (informação administrativa)
      await webhookSvc.postToType(ctx.guildId, 'modlog', { ...basePayload, action: 'ticket_close' });
    } catch (e) {
      // Só loga, não falha operação de fecho
      // eslint-disable-next-line no-console
      const err: any = e as any;
      console.warn('Webhook dispatch after ticket close failed:', err?.message || String(err));
    }
    try {
      // Se o transcript for pequeno, anexar ficheiro txt ao canal
      if (transcriptText && transcriptText.length < 190000) {
        const buf = Buffer.from(transcriptText, 'utf8');
        await ctx.channel.send({ files: [{ attachment: buf, name: `ticket_${ctx.ticket.id}_transcript.txt` }], content: 'Ticket fechado. Transcript gerado. Ações pós-fecho:' });
      } else {
        await ctx.channel.send({ content: 'Ticket fechado. Transcript (grande) armazenado no sistema. Ações pós-fecho:', components: buildPostCloseRow() });
      }
      // Adicionar botões pós-fecho se ainda não incluídos quando enviamos ficheiro
      if (transcriptText && transcriptText.length < 190000) {
        await ctx.channel.send({ content: 'Ações pós-fecho:', components: buildPostCloseRow() }).catch(()=>{});
      }
    } catch {}
    return '✅ Ticket fechado (transcript gerado).';
  });
}

// Placeholder minimal handlers
export async function handleRename(ctx: ActionContext): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode renomear.';
  const modal = new ModalBuilder().setCustomId('ticket:rename:modal').setTitle('Renomear Canal');
  const input = new TextInputBuilder().setCustomId('ticket:rename:name').setLabel('Novo nome do canal').setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(90).setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await (ctx.channel as any).client.api; // noop to keep TS calm
  await (ctx as any).interaction?.showModal?.(modal); // if called from dispatcher with interaction
  return '📝 Introduza o novo nome (modal).';
}

export async function handleMove(ctx: ActionContext): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode mover.';
  const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('ticket:move:select').setPlaceholder('Escolhe uma categoria…').addChannelTypes(ChannelType.GuildCategory)
  );
  return { content: '🔁 Seleciona a categoria para mover o ticket.', components: [row as any] };
}

export async function handleAddMember(ctx: ActionContext): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode adicionar membros.';
  const key = `${ctx.channel.id}:add:${ctx.userId}`;
  if (isRateLimited(key, 5000)) return '⏱️ Aguarde alguns segundos antes de repetir.';
  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder().setCustomId('ticket:add_member:select').setPlaceholder('Seleciona membros para adicionar…').setMinValues(1).setMaxValues(5)
  );
  return { content: '➕ Escolhe quem adicionar ao ticket.', components: [row as any] };
}

export async function handleRemoveMember(ctx: ActionContext): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode remover membros.';
  const key = `${ctx.channel.id}:remove:${ctx.userId}`;
  if (isRateLimited(key, 5000)) return '⏱️ Aguarde alguns segundos antes de repetir.';
  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder().setCustomId('ticket:remove_member:select').setPlaceholder('Seleciona membros para remover…').setMinValues(1).setMaxValues(5)
  );
  return { content: '❌ Escolhe quem remover do ticket.', components: [row as any] };
}

export async function handleCallMember(ctx: ActionContext): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode chamar cargos.';
  const key = `${ctx.channel.id}:call:${ctx.userId}`;
  if (isRateLimited(key, 10000)) return '⏱️ Evite spam — aguarde 10 segundos.';
  const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder().setCustomId('ticket:call_member:role').setPlaceholder('Escolhe um cargo para chamar…')
  );
  return { content: '🔔 Escolhe o cargo a mencionar.', components: [row as any] };
}

export async function handleGreet(ctx: ActionContext): Promise<ActionResult> { return `👋 Olá! Sou <@${ctx.userId}>. Em que posso ajudar?`; }

export async function handleNote(ctx: ActionContext): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode adicionar notas.';
  const modal = new ModalBuilder().setCustomId('ticket:note:modal').setTitle('Nota interna');
  const input = new TextInputBuilder().setCustomId('ticket:note:text').setLabel('Conteúdo da nota').setStyle(TextInputStyle.Paragraph).setMinLength(2).setMaxLength(1000).setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await (ctx as any).interaction?.showModal?.(modal);
  return '🗒️ Introduza a nota (modal).';
}

export async function resolveTicket(channel: TextChannel): Promise<Awaited<ReturnType<typeof TicketModel.findOne>> | null> {
  return TicketModel.findOne({ channelId: channel.id });
}

// Staff gating
const staffCache = new Map<string, { roles: string[]; ts: number }>();
async function getStaffRoles(guildId: string): Promise<string[]> {
  const cached = staffCache.get(guildId);
  const now = Date.now();
  if (cached && (now - cached.ts < 60000)) return cached.roles;
  let roles: string[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const storage = require('../../utils/storage');
    const cfg = await storage.getGuildConfig(guildId, 'staffRoles');
    if (Array.isArray(cfg)) roles = cfg.filter(r => typeof r === 'string');
  } catch {}
  staffCache.set(guildId, { roles, ts: now });
  return roles;
}

async function isStaff(member: GuildMember, guildId: string): Promise<boolean> {
  try {
    const staffRoles = await getStaffRoles(guildId);
    if (!staffRoles.length) return false;
    return member.roles.cache.some(r => staffRoles.includes(r.id));
  } catch { return false; }
}

// Post-close action row
export function buildPostCloseRow() {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket:export').setLabel('Exportar Logs').setStyle(ButtonStyle.Secondary).setEmoji('📄'),
    new ButtonBuilder().setCustomId('ticket:feedback').setLabel('Avaliar Atendimento').setStyle(ButtonStyle.Primary).setEmoji('⭐')
  );
  return [row];
}

export async function handleExport(ctx: ActionContext): Promise<ActionResult> {
  const isStaffMember = await isStaff(ctx.member, ctx.guildId);
  if (!(isStaffMember || ctx.userId === ctx.ticket.ownerId)) return '⛔ Apenas staff ou autor pode exportar.';
  try {
  const entries: any[] = await TicketLogModel.find({ ticketId: ctx.ticket.id }).sort({ createdAt: 1 }).limit(500).lean();
  const lines = entries.map(e => `${new Date(e.createdAt || Date.now()).toISOString()} | ${e.byUserId || 'n/a'} | ${e.action} | ${JSON.stringify(e.payload || {})}`);
    const text = lines.join('\n');
    if (text.length < 1800) {
      await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'export', { count: entries.length });
      return '```\n' + text + '\n```';
    }
    // Send as attachment via calling channel send then ephemeral note
    const buf = Buffer.from(text, 'utf8');
    try { await ctx.channel.send({ files: [{ attachment: buf, name: `ticket_${ctx.ticket.id}_logs.txt` }] }); } catch {}
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'export', { count: entries.length, mode: 'file' });
    return '📄 Logs exportados (ficheiro enviado no canal).';
  } catch {
    return '❌ Falha ao exportar logs.';
  }
}

export async function handleFeedbackButton(ctx: ActionContext): Promise<ActionResult> {
  if (ctx.userId !== ctx.ticket.ownerId) return '⛔ Apenas o autor pode avaliar.';
  const modal = new ModalBuilder().setCustomId('ticket:feedback:modal').setTitle('Avaliar Atendimento');
  const rating = new TextInputBuilder().setCustomId('ticket:feedback:rating').setLabel('Nota (1-5)').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(1).setRequired(true);
  const comment = new TextInputBuilder().setCustomId('ticket:feedback:comment').setLabel('Comentário (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(rating), new ActionRowBuilder<TextInputBuilder>().addComponents(comment));
  await (ctx as any).interaction?.showModal?.(modal);
  return '⭐ Introduza feedback (modal).';
}

export async function handleFeedbackSubmit(ctx: { interaction: any; ticket: any; guildId: string; userId: string }): Promise<string> {
  try {
    const r = ctx.interaction.fields.getTextInputValue('ticket:feedback:rating');
    const c = ctx.interaction.fields.getTextInputValue('ticket:feedback:comment');
    const ratingNum = Number(r);
    if (!(ratingNum >= 1 && ratingNum <= 5)) return '❌ Nota inválida (use 1-5).';
    ctx.ticket.meta = ctx.ticket.meta || {};
    ctx.ticket.meta.feedback = { rating: ratingNum, comment: c || '', by: ctx.userId, at: new Date() };
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'feedback', { rating: ratingNum });
    return '✅ Feedback registado. Obrigado!';
  } catch { return '❌ Falha ao registar feedback.'; }
}
