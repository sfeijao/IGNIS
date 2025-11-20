const logger = require('../logger');
const { GiveawayClaimModel } = require('../db/models');
const { GiveawayModel, GiveawayWinnerModel, GiveawayEntryModel } = require('../db/giveawayModels');

/**
 * Giveaway Claim Job Processor
 *
 * Responsável por processar:
 * - Claims expirados (48h sem resposta) → trigger re-roll
 * - Envio de lembretes (24h e 6h antes do deadline)
 * - Verificação de respostas em tickets
 *
 * Executa a cada 5 minutos e processa tarefas pendentes.
 * Usa DB-first approach para persistência across restarts.
 */
class GiveawayClaimJobProcessor {
  constructor(client) {
    this.client = client;
    this.isRunning = false;
    this.intervalMs = 5 * 60 * 1000; // 5 minutos
    this.intervalId = null;
    this.lastRunAt = null;
  }

  /**
   * Inicia o job processor
   */
  start() {
    if (this.isRunning) {
      logger.warn('[GiveawayClaimJob] Job processor já está rodando');
      return;
    }

    logger.info('[GiveawayClaimJob] Iniciando job processor...');
    this.isRunning = true;

    // Executa imediatamente ao start (para processar claims pendentes após restart)
    this.run().catch(err => {
      logger.error('[GiveawayClaimJob] Erro na execução inicial:', err);
    });

    // Agenda execuções periódicas
    this.intervalId = setInterval(() => {
      this.run().catch(err => {
        logger.error('[GiveawayClaimJob] Erro na execução periódica:', err);
      });
    }, this.intervalMs);

    logger.info(`[GiveawayClaimJob] Job processor iniciado (intervalo: ${this.intervalMs / 1000}s)`);
  }

  /**
   * Para o job processor
   */
  stop() {
    if (!this.isRunning) return;

    logger.info('[GiveawayClaimJob] Parando job processor...');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[GiveawayClaimJob] Job processor parado');
  }

  /**
   * Execução principal do job
   */
  async run() {
    const startTime = Date.now();
    logger.info('[GiveawayClaimJob] Executando job processor...');

    try {
      // 1. Processar claims expirados (re-roll)
      const expiredCount = await this.processExpiredClaims();

      // 2. Enviar lembretes
      const remindersCount = await this.sendReminders();

      // 3. Verificar respostas em tickets pendentes
      const checkedCount = await this.checkPendingTickets();

      const duration = Date.now() - startTime;
      this.lastRunAt = new Date();

      logger.info(`[GiveawayClaimJob] Job concluído em ${duration}ms - Expirados: ${expiredCount}, Lembretes: ${remindersCount}, Verificados: ${checkedCount}`);
    } catch (error) {
      logger.error('[GiveawayClaimJob] Erro ao executar job:', error);
    }
  }

  /**
   * Processa claims que expiraram (deadline passou sem resposta)
   * Marca como unclaimed e triggera re-roll automático
   */
  async processExpiredClaims() {
    try {
      const expiredClaims = await GiveawayClaimModel.findExpiredClaims();

      if (expiredClaims.length === 0) return 0;

      logger.info(`[GiveawayClaimJob] Encontrados ${expiredClaims.length} claims expirados para processar`);

      let processedCount = 0;

      for (const claim of expiredClaims) {
        try {
          // Marcar como unclaimed
          await claim.markAsUnclaimed();
          claim.processed_by_job = true;
          claim.job_last_check_at = new Date();
          await claim.save();

          // Anunciar no canal do giveaway que o vencedor não reclamou
          await this.announceUnclaimedWinner(claim);

          // Trigger re-roll automático
          await this.triggerReroll(claim);

          processedCount++;
          logger.info(`[GiveawayClaimJob] Claim ${claim._id} processado (unclaimed + re-roll)`);
        } catch (err) {
          logger.error(`[GiveawayClaimJob] Erro ao processar claim ${claim._id}:`, err);
        }
      }

      return processedCount;
    } catch (error) {
      logger.error('[GiveawayClaimJob] Erro ao buscar claims expirados:', error);
      return 0;
    }
  }

  /**
   * Envia lembretes (24h e 6h antes do deadline)
   */
  async sendReminders() {
    try {
      const claimsNeedingReminders = await GiveawayClaimModel.findClaimsNeedingReminders();

      if (claimsNeedingReminders.length === 0) return 0;

      logger.info(`[GiveawayClaimJob] Encontrados ${claimsNeedingReminders.length} claims precisando lembretes`);

      let sentCount = 0;

      for (const claim of claimsNeedingReminders) {
        try {
          // Verificar qual lembrete enviar
          if (claim.shouldSendReminder24h()) {
            await this.sendReminderMessage(claim, '24h');
            claim.notifications_sent.reminder_24h = true;
            await claim.save();
            sentCount++;
          } else if (claim.shouldSendReminder6h()) {
            await this.sendReminderMessage(claim, '6h');
            claim.notifications_sent.reminder_6h = true;
            await claim.save();
            sentCount++;
          }
        } catch (err) {
          logger.error(`[GiveawayClaimJob] Erro ao enviar lembrete para claim ${claim._id}:`, err);
        }
      }

      return sentCount;
    } catch (error) {
      logger.error('[GiveawayClaimJob] Erro ao processar lembretes:', error);
      return 0;
    }
  }

  /**
   * Verifica tickets pendentes para detectar respostas do vencedor
   */
  async checkPendingTickets() {
    try {
      const pendingClaims = await GiveawayClaimModel.findPendingClaims();

      if (pendingClaims.length === 0) return 0;

      let checkedCount = 0;

      for (const claim of pendingClaims) {
        try {
          if (!claim.ticket_channel_id) continue;

          const channel = await this.client.channels.fetch(claim.ticket_channel_id).catch(() => null);
          if (!channel) continue;

          // Buscar mensagens recentes do canal
          const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
          if (!messages) continue;

          // Verificar se o vencedor respondeu
          const userMessage = messages.find(m =>
            m.author.id === claim.user_id &&
            m.createdTimestamp > claim.ticket_created_at?.getTime()
          );

          if (userMessage && !claim.claimed_at) {
            // Vencedor respondeu! Marcar como claimed
            await claim.markAsClaimed(userMessage.content.substring(0, 500));
            await this.announcePrizeClaimed(claim);
            checkedCount++;
            logger.info(`[GiveawayClaimJob] Claim ${claim._id} marcado como claimed (resposta detectada)`);
          }
        } catch (err) {
          logger.error(`[GiveawayClaimJob] Erro ao verificar ticket do claim ${claim._id}:`, err);
        }
      }

      return checkedCount;
    } catch (error) {
      logger.error('[GiveawayClaimJob] Erro ao verificar tickets pendentes:', error);
      return 0;
    }
  }

  /**
   * Anuncia no canal do giveaway que o vencedor não reclamou
   */
  async announceUnclaimedWinner(claim) {
    try {
      const giveaway = await GiveawayModel.findById(claim.giveaway_id);
      if (!giveaway || !giveaway.channel_id) return;

      const channel = await this.client.channels.fetch(giveaway.channel_id).catch(() => null);
      if (!channel) return;

      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setColor(0xF59E0B)
        .setTitle('⚠️ Prêmio Não Reclamado')
        .setDescription(`O vencedor <@${claim.user_id}> não reclamou o prêmio dentro de 48 horas.\n\n🔄 Realizando novo sorteio...`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      logger.info(`[GiveawayClaimJob] Anunciado vencedor não reclamado: ${claim.user_id}`);
    } catch (error) {
      logger.error('[GiveawayClaimJob] Erro ao anunciar vencedor não reclamado:', error);
    }
  }

  /**
   * Anuncia que o prêmio foi reclamado com sucesso
   */
  async announcePrizeClaimed(claim) {
    try {
      const giveaway = await GiveawayModel.findById(claim.giveaway_id);
      if (!giveaway || !giveaway.channel_id) return;

      const channel = await this.client.channels.fetch(giveaway.channel_id).catch(() => null);
      if (!channel) return;

      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setColor(0x10B981)
        .setTitle('✅ Prêmio Reclamado')
        .setDescription(`Parabéns <@${claim.user_id}>! O prêmio foi reclamado com sucesso.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      logger.info(`[GiveawayClaimJob] Anunciado prêmio reclamado: ${claim.user_id}`);
    } catch (error) {
      logger.error('[GiveawayClaimJob] Erro ao anunciar prêmio reclamado:', error);
    }
  }

  /**
   * Envia mensagem de lembrete no ticket
   */
  async sendReminderMessage(claim, timeframe) {
    try {
      if (!claim.ticket_channel_id) return;

      const channel = await this.client.channels.fetch(claim.ticket_channel_id).catch(() => null);
      if (!channel) return;

      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setColor(0xF59E0B)
        .setTitle(`⏰ Lembrete: ${timeframe} restantes`)
        .setDescription(`<@${claim.user_id}>, você tem apenas **${timeframe}** para responder e reclamar seu prêmio!\n\nSe não responder, um novo sorteio será realizado.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      logger.info(`[GiveawayClaimJob] Lembrete ${timeframe} enviado para claim ${claim._id}`);
    } catch (error) {
      logger.error(`[GiveawayClaimJob] Erro ao enviar lembrete para claim ${claim._id}:`, error);
    }
  }

  /**
   * Triggera re-roll automático
   */
  async triggerReroll(claim) {
    try {
      const giveaway = await GiveawayModel.findById(claim.giveaway_id);
      if (!giveaway) {
        logger.warn(`[GiveawayClaimJob] Giveaway ${claim.giveaway_id} não encontrado para re-roll`);
        return;
      }

      // Buscar todas as entradas EXCETO o vencedor anterior
      const allEntries = await GiveawayEntryModel.find({
        giveaway_id: claim.giveaway_id
      });

      // Filtrar vencedores anteriores desta chain de re-rolls
      const previousWinners = await this.getPreviousWinnersChain(claim);
      const eligibleEntries = allEntries.filter(entry =>
        !previousWinners.includes(entry.user_id)
      );

      if (eligibleEntries.length === 0) {
        logger.warn(`[GiveawayClaimJob] Sem participantes elegíveis para re-roll do giveaway ${giveaway._id}`);
        // Se não há mais participantes, considerar o giveaway como failed
        return;
      }

      // Selecionar novo vencedor aleatório (weighted)
      const newWinner = this.selectRandomWinner(eligibleEntries);

      // Criar novo GiveawayWinner
      const { GiveawayWinnerModel } = require('../db/giveawayModels');
      const winnerRecord = await GiveawayWinnerModel.create({
        giveaway_id: giveaway._id,
        guild_id: giveaway.guild_id,
        user_id: newWinner.user_id,
        picked_at: new Date(),
        reroll_of: claim.winner_id,
        method: 'reroll'
      });

      // Criar novo claim
      const newClaim = await GiveawayClaimModel.create({
        giveaway_id: giveaway._id,
        guild_id: giveaway.guild_id,
        winner_id: winnerRecord._id,
        user_id: newWinner.user_id,
        claim_deadline_at: new Date(Date.now() + 48 * 60 * 60 * 1000),
        previous_claim_id: claim._id,
        reroll_count: claim.reroll_count + 1,
        prize_description: claim.prize_description
      });

      // Marcar claim anterior como re-rolled
      claim.status = 're-rolled';
      await claim.save();

      // Abrir novo ticket para o novo vencedor
      await this.openClaimTicket(newClaim, giveaway);

      // Anunciar novo vencedor
      await this.announceNewWinner(newClaim, giveaway);

      logger.info(`[GiveawayClaimJob] Re-roll concluído: novo vencedor ${newWinner.user_id} (claim: ${newClaim._id})`);
    } catch (error) {
      logger.error('[GiveawayClaimJob] Erro ao fazer re-roll:', error);
    }
  }

  /**
   * Busca todos os vencedores anteriores na chain de re-rolls
   */
  async getPreviousWinnersChain(claim) {
    const winners = [claim.user_id];
    let currentClaim = claim;

    // Seguir a chain de previous_claim_id até o início
    while (currentClaim.previous_claim_id) {
      currentClaim = await GiveawayClaimModel.findById(currentClaim.previous_claim_id);
      if (!currentClaim) break;
      winners.push(currentClaim.user_id);
    }

    return winners;
  }

  /**
   * Seleciona vencedor aleatório considerando weight
   */
  selectRandomWinner(entries) {
    // Expandir entries baseado no weight (weighted random selection)
    const weightedPool = [];
    for (const entry of entries) {
      const weight = Math.max(1, entry.weight || 1);
      for (let i = 0; i < weight; i++) {
        weightedPool.push(entry);
      }
    }

    // Selecionar aleatoriamente do pool
    const randomIndex = Math.floor(Math.random() * weightedPool.length);
    return weightedPool[randomIndex];
  }

  /**
   * Abre ticket de reclamação para o vencedor
   */
  async openClaimTicket(claim, giveaway) {
    try {
      const communityTickets = require('../communityTickets');
      const guild = await this.client.guilds.fetch(giveaway.guild_id).catch(() => null);
      if (!guild) return;

      const user = await this.client.users.fetch(claim.user_id).catch(() => null);
      if (!user) return;

      // Criar ticket usando sistema existente (adaptado para giveaways)
      // TODO: Implementar criação programática de ticket para giveaways
      // Por enquanto, log e notificar manualmente

      logger.info(`[GiveawayClaimJob] Ticket de reclamação deve ser criado para ${claim.user_id} (giveaway: ${giveaway._id})`);

      // Atualizar claim com info do ticket quando criado
      // claim.ticket_channel_id = ticketChannel.id;
      // claim.ticket_created_at = new Date();
      // await claim.save();

    } catch (error) {
      logger.error('[GiveawayClaimJob] Erro ao abrir ticket de reclamação:', error);
    }
  }

  /**
   * Anuncia novo vencedor no canal
   */
  async announceNewWinner(claim, giveaway) {
    try {
      const channel = await this.client.channels.fetch(giveaway.channel_id).catch(() => null);
      if (!channel) return;

      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setColor(0x10B981)
        .setTitle('🎉 Novo Vencedor!')
        .setDescription(`Parabéns <@${claim.user_id}>!\n\nVocê foi selecionado no re-sorteio!\n\n📩 Um ticket foi aberto para você reclamar seu prêmio.\n⏰ Você tem **48 horas** para responder.`)
        .setFooter({ text: `Re-roll #${claim.reroll_count}` })
        .setTimestamp();

      await channel.send({
        content: `<@${claim.user_id}>`,
        embeds: [embed]
      });

      logger.info(`[GiveawayClaimJob] Novo vencedor anunciado: ${claim.user_id}`);
    } catch (error) {
      logger.error('[GiveawayClaimJob] Erro ao anunciar novo vencedor:', error);
    }
  }

  /**
   * Retorna estatísticas do job processor
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      lastRunAt: this.lastRunAt,
      nextRunAt: this.lastRunAt ? new Date(this.lastRunAt.getTime() + this.intervalMs) : null
    };
  }
}

module.exports = { GiveawayClaimJobProcessor };
