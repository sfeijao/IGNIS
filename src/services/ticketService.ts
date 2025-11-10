import { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, TextChannel, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, PermissionsBitField } from 'discord.js';
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
  .setThumbnail(author.guild?.iconURL() || thumbnailUrl || author.displayAvatarURL())
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
  .setThumbnail(author.guild?.iconURL() || thumbnailUrl || author.displayAvatarURL())
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
    new ButtonBuilder().setCustomId('ticket:priority').setLabel('Prioridade').setStyle(ButtonStyle.Secondary).setEmoji('⚡'),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Finalizar Ticket').setStyle(ButtonStyle.Success).setEmoji('✅'),
  );
  return [row1, row2, row3];
}

// Helper: same components without the Priority button (para ficar igual ao print)
export function buildPanelComponentsNoPriority() {
  const rows = buildPanelComponents();
  try {
    if (Array.isArray(rows) && rows[2]?.components) {
      // @ts-ignore accessing runtime data
      rows[2].components = rows[2].components.filter((c: any)=> (c?.data?.custom_id || c?.customId) !== 'ticket:priority');
    }
  } catch {}
  return rows;
}

// --- Unified status embed builder (for convergence) ---
// Generates the dual-embed V2 status panel for a ticket, reflecting dynamic fields.
export function buildTicketStatusEmbedsV2(ticket: any, author: GuildMember) {
  const estado = (ticket.status || 'open').toLowerCase();
  const statusLabel = estado === 'open' ? 'Aberto' : (estado === 'closed' ? 'Fechado' : estado === 'cancelled' ? 'Cancelado' : estado);
  const prioridade = (ticket.priority || ticket.meta?.priority || 'normal');
  const prioridadeMap: Record<string,string> = { low: 'BAIXA', normal: 'NORMAL', high: 'ALTA', urgent: 'URGENTE' };
  const prioridadeLabel = prioridadeMap[prioridade.toLowerCase()] || prioridade.toUpperCase();
  const responsavel = ticket.staffAssigned ? `<@${ticket.staffAssigned}>` : '—';
  const openedTs = Math.floor((ticket.createdAt ? new Date(ticket.createdAt).getTime() : Date.now()) / 1000);
  const idDisplay = ticket.id || ticket._id || '—';
  const categoryName = ticket.category || 'Suporte';
  const main = new EmbedBuilder()
    .setTitle('Ticket Criado com Sucesso! 📌')
    .setDescription('Todos os responsáveis pelo ticket já estão cientes da abertura.\nEvite chamar alguém via DM, basta aguardar alguém já irá lhe atender..')
    .addFields(
      { name: 'Categoria Escolhida:', value: `🧾 \`Ticket ${categoryName}\``, inline: false },
      { name: 'Estado', value: statusLabel, inline: true },
      { name: 'Utilizador', value: `<@${ticket.ownerId || ticket.user_id || author.id}>`, inline: true },
      { name: 'Abertura', value: `<t:${openedTs}:R>`, inline: true },
      { name: 'ID', value: `#${idDisplay}`, inline: true },
      { name: 'Prioridade', value: prioridadeLabel, inline: true },
      { name: 'Responsável', value: responsavel, inline: true }
    )
  .setThumbnail(author.guild?.iconURL() || author.displayAvatarURL())
    .setColor(0x2F3136);
  const singleMode = (process.env.TICKET_PANEL_SINGLE_EMBED || '').toLowerCase() === 'true';
  if (singleMode) return [main];
  const notice = new EmbedBuilder().setDescription('OBS: Procure manter sua DM aberta para receber uma cópia deste ticket e a opção de avaliar seu atendimento.').setColor(0xED4245);
  return [main, notice];
}

// Update existing ticket panel message with current status fields (TS tickets only for now)
export async function updateTicketStatusEmbeds(client: Client, ticket: any) {
  if (!ticket?.messageId) return false;
  try {
    const guild = client.guilds.cache.get(ticket.guildId) || await client.guilds.fetch(ticket.guildId).catch(()=>null);
    if (!guild) return false;
    const channel = guild.channels.cache.get(ticket.channelId) as TextChannel || await guild.channels.fetch(ticket.channelId).catch(()=>null) as TextChannel;
    if (!channel) return false;
    const msg = await channel.messages.fetch(ticket.messageId).catch(()=>null);
    if (!msg || !msg.editable) return false;
    const member = await guild.members.fetch(ticket.ownerId).catch(()=>guild.members.cache.first());
    const embeds = buildTicketStatusEmbedsV2(ticket, member!);
    await msg.edit({ embeds });
    return true;
  } catch { return false; }
}

// --- TS Ticket open routine -------------------------------------------------
// Cria (ou regista) um ticket TS para o canal e publica o painel V2 sem dropdown
export async function openTicketTS(channel: TextChannel, owner: GuildMember, categoryName?: string) {
  // Se já existir um TicketModel para este canal, apenas garante o painel
  let ticket = await TicketModel.findOne({ guildId: channel.guild.id, channelId: channel.id });
  if (!ticket) {
    ticket = await TicketModel.create({
      guildId: channel.guild.id,
      channelId: channel.id,
      ownerId: owner.id,
      category: categoryName || 'Suporte',
      status: 'open',
      meta: { priority: 'normal' }
    } as any);
  }
  const embeds = buildPanelEmbedsV2(owner, categoryName || ticket.category || 'Suporte');
  let components = buildPanelComponentsNoPriority();
  try {
    // se houver painel antigo, editá-lo; caso contrário, enviar novo
    let existing: Message | null = null;
    if (ticket.messageId) {
      existing = await channel.messages.fetch(ticket.messageId).catch(()=>null);
    }
    if (existing && existing.editable) {
      await existing.edit({ embeds, components });
    } else {
      const sent = await channel.send({ embeds, components });
      ticket.messageId = sent.id;
      await ticket.save();
    }
  } catch {}
  return ticket;
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
    // Atualizar painel com novo estado
    try { await updateTicketStatusEmbeds((ctx.channel.client as any), ctx.ticket); } catch {}
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
    // Atualizar painel com responsável
    try { await updateTicketStatusEmbeds((ctx.channel.client as any), ctx.ticket); } catch {}
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
  try { await updateTicketStatusEmbeds((ctx.channel.client as any), ctx.ticket); } catch {}
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

// --- New handlers for convergence ---
export async function handleRelease(ctx: ActionContext): Promise<ActionResult> {
  return withTicketLock(ctx.ticket.id, async () => {
    if (!ctx.ticket.staffAssigned) return 'Nenhum responsável atribuído.';
    if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode libertar.';
    const prev = ctx.ticket.staffAssigned;
    ctx.ticket.staffAssigned = null;
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'release', { previous: prev });
    try { await updateTicketStatusEmbeds((ctx.channel.client as any), ctx.ticket); } catch {}
    return '👐 Ticket libertado.';
  });
}

export async function handleLockToggle(ctx: ActionContext): Promise<ActionResult> {
  return withTicketLock(ctx.ticket.id, async () => {
    if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode bloquear.';
    ctx.ticket.meta = ctx.ticket.meta || {};
    const locked = !!ctx.ticket.meta.locked;
    ctx.ticket.meta.locked = !locked;
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, locked ? 'unlock' : 'lock');
    try { await updateTicketStatusEmbeds((ctx.channel.client as any), ctx.ticket); } catch {}
    return locked ? '🔓 Ticket desbloqueado.' : '🔐 Ticket bloqueado.';
  });
}

export async function handleTranscript(ctx: ActionContext): Promise<ActionResult> {
  return withTicketLock(ctx.ticket.id, async () => {
    // Gerar transcript sem fechar
    let transcriptText = '';
    try {
      const messages: any[] = [];
      let lastId: string | undefined = undefined;
      for (let i = 0; i < 3; i++) {
        const fetched: any = await ctx.channel.messages.fetch(lastId ? { limit: 100, before: lastId } : { limit: 100 }).catch(() => null);
        if (!fetched || !fetched.size) break;
        const batch: any[] = Array.from((fetched as any).values());
        messages.push(...batch);
        const last: any = batch[batch.length - 1];
        lastId = last?.id as string | undefined;
        if (fetched.size < 100) break;
      }
      messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      const lines: string[] = [];
      lines.push(`Ticket ${ctx.ticket.id} Transcript (on-demand)`);
      lines.push(`Canal: ${ctx.channel.name} (${ctx.channel.id})`);
      lines.push(`Gerado por: ${ctx.userId}`);
      lines.push(`Gerado em: ${new Date().toISOString()}`);
      lines.push('');
      for (const m of messages) {
        const when = new Date(m.createdTimestamp).toISOString();
        const authorTag = `${m.author?.username || 'Desconhecido'}#${m.author?.discriminator || '0000'}`;
        const content = (m.content || '').replace(/\n/g, ' ');
        lines.push(`[${when}] ${authorTag}: ${content}`);
      }
      transcriptText = lines.join('\n');
    } catch {}
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'transcript', { size: transcriptText.length });
    if (!transcriptText) return '❌ Não foi possível gerar transcript.';
    if (transcriptText.length < 180000) {
      const buf = Buffer.from(transcriptText, 'utf8');
      try { await ctx.channel.send({ files: [{ attachment: buf, name: `ticket_${ctx.ticket.id}_transcript.txt` }] }); } catch {}
      return '📄 Transcript gerado.';
    }
    return '📄 Transcript demasiado grande (armazenado internamente).';
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

// Novo painel para mover ticket: mostra botões de categorias + opção "Outra"
export async function handleMove(ctx: ActionContext): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode mover.';
  const guild = ctx.channel.guild;
  // Recolher até 15 categorias (limite prático de 3 linhas x 5 botões)
  const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).first(15);
  if (!categories.length) return '❌ Nenhuma categoria disponível.';
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  for (const cat of categories) {
    if (currentRow.components.length >= 5) { rows.push(currentRow); currentRow = new ActionRowBuilder<ButtonBuilder>(); }
    currentRow.addComponents(
      new ButtonBuilder().setCustomId(`ticket:move:cat:${cat.id}`).setLabel(cat.name.substring(0,20)).setStyle(ButtonStyle.Secondary).setEmoji('📁')
    );
  }
  if (currentRow.components.length) rows.push(currentRow);
  // Botão "Outra" para inserir ID/manual
  const extraRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket:move:other').setLabel('Outra Categoria').setStyle(ButtonStyle.Primary).setEmoji('🆕'),
  );
  rows.push(extraRow);
  return { content: '🔁 Escolhe uma categoria destino ou usa "Outra" para ID manual:', components: rows as any };
}

// Alterado: agora usa Modal para IDs/menções, em vez de UserSelect
export async function handleAddMember(ctx: ActionContext): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode adicionar membros.';
  const key = `${ctx.channel.id}:add:${ctx.userId}`;
  if (isRateLimited(key, 5000)) return '⏱️ Aguarde alguns segundos antes de repetir.';
  const modal = new ModalBuilder().setCustomId('ticket:add_member:modal').setTitle('Adicionar Membros');
  const input = new TextInputBuilder()
    .setCustomId('ticket:add_member:ids')
    .setLabel('IDs ou menções (separados por espaço)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(400);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  try { await (ctx as any).interaction?.showModal?.(modal); } catch {}
  return '➕ Introduza os IDs/menções no modal.';
}

export async function handleRemoveMember(ctx: ActionContext): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode remover membros.';
  const key = `${ctx.channel.id}:remove:${ctx.userId}`;
  if (isRateLimited(key, 5000)) return '⏱️ Aguarde alguns segundos antes de repetir.';
  const modal = new ModalBuilder().setCustomId('ticket:remove_member:modal').setTitle('Remover Membros');
  const input = new TextInputBuilder()
    .setCustomId('ticket:remove_member:ids')
    .setLabel('IDs ou menções (separados por espaço)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(400);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  try { await (ctx as any).interaction?.showModal?.(modal); } catch {}
  return '❌ Introduza os IDs/menções a remover.';
}

// Alterado: agora apenas menciona o autor do ticket (owner) para chamar atenção
export async function handleCallMember(ctx: ActionContext): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode chamar o autor.';
  const key = `${ctx.channel.id}:call_owner:${ctx.userId}`;
  if (isRateLimited(key, 10000)) return '⏱️ Evite spam — aguarde 10 segundos.';
  try {
    const ownerId = ctx.ticket.ownerId;
    if (!ownerId) return '❌ Ticket sem owner definido.';
    await ctx.channel.send({ content: `🔔 <@${ownerId}> precisamos da tua resposta. (${ctx.member})` });
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'call_owner', { ownerId });
    return '🔔 Membro chamado.';
  } catch {
    return '❌ Falha ao chamar membro.';
  }
}

// Utilitários extras para mover via botão categoria / modal outra
export async function handleMoveToCategory(ctx: ActionContext, categoryId: string): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff.';
  try {
    if (!categoryId) return '❌ Categoria inválida.';
    await ctx.channel.setParent(categoryId, { lockPermissions: false }).catch(()=>{});
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'move', { categoryId });
    return '🔁 Ticket movido.';
  } catch {
    return '❌ Falha ao mover.';
  }
}

export async function handleMoveOtherModal(ctx: { interaction: any; ticket: any; guildId: string; userId: string }): Promise<string> {
  try {
    const raw = ctx.interaction.fields.getTextInputValue('ticket:move:other:category_id').trim();
    const id = raw.replace(/[^0-9]/g,'');
    if (!id) return '❌ ID inválido.';
    const channel = ctx.interaction.channel;
    try { await channel.setParent(id, { lockPermissions: false }); } catch { return '❌ Falha ao mover (ID incorreto ou sem permissão).'; }
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'move', { categoryId: id, manual: true });
    return '🔁 Ticket movido para categoria personalizada.';
  } catch { return '❌ Erro ao processar modal.'; }
}

// Fluxo de fecho com confirmação
export function buildCloseConfirmRow() {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket:close:confirm').setLabel('Confirmar Fecho').setStyle(ButtonStyle.Danger).setEmoji('✅'),
    new ButtonBuilder().setCustomId('ticket:close:cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary).setEmoji('✖️')
  );
  return [row];
}

export async function handleCloseRequest(ctx: ActionContext): Promise<ActionResult> {
  // Não fecha ainda, só pede confirmação
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode fechar.';
  return { content: '⚠️ Tens a certeza que queres fechar o ticket?', components: buildCloseConfirmRow() as any };
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

// Definir prioridade (seleção via select menu)
export async function handlePrioritySet(ctx: ActionContext, chosenRaw: string): Promise<ActionResult> {
  if (!(await isStaff(ctx.member, ctx.guildId))) return '⛔ Apenas staff pode definir prioridade.';
  return withTicketLock(ctx.ticket.id, async () => {
    const allowed = ['low','normal','high','urgent'];
    const chosen = allowed.includes((chosenRaw || '').toLowerCase()) ? chosenRaw.toLowerCase() : 'normal';
    ctx.ticket.meta = ctx.ticket.meta || {};
    (ctx.ticket.meta as any).priority = chosen; // Persistido dentro de meta para evitar alterar schema
    await ctx.ticket.save();
    await log(ctx.ticket.id, ctx.guildId, ctx.userId, 'priority', { value: chosen });
    try { await updateTicketStatusEmbeds((ctx.channel.client as any), ctx.ticket); } catch {}
    const labelMap: Record<string,string> = { low: 'BAIXA', normal: 'NORMAL', high: 'ALTA', urgent: 'URGENTE' };
    return `⚡ Prioridade alterada para ${labelMap[chosen] || chosen.toUpperCase()}`;
  });
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
