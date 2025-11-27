const { AntiRaidConfig, RaidEvent, SuspiciousMember } = require('../models/antiRaid');
const logger = require('../../utils/logger');
const { EmbedBuilder } = require('discord.js');

/**
 * Anti-Raid Service - Proteção inteligente contra raids
 */
class AntiRaidService {
    constructor() {
        // Cache de joins recentes: guildId -> array de timestamps
        this.recentJoins = new Map();
        // Cache de raids ativos: guildId -> raidEventId
        this.activeRaids = new Map();
        // Limpar cache a cada 10 minutos
        this.cleanupInterval = setInterval(() => this.cleanupCache(), 10 * 60 * 1000);
    }

    /**
     * Obter configuração de anti-raid de um servidor
     */
    async getConfig(guildId) {
        try {
            let config = await AntiRaidConfig.findOne({ guildId });

            if (!config) {
                // Criar configuração padrão
                config = await AntiRaidConfig.create({
                    guildId,
                    enabled: false,
                    sensitivity: 'medium',
                    thresholds: {
                        joinsPerMinute: 10,
                        joinsPerFiveMinutes: 30,
                        minimumAccountAge: 7,
                        usernameSimilarity: 70
                    },
                    actions: {
                        autoKick: false,
                        autoBan: false,
                        quarantine: true,
                        enableCaptcha: false
                    }
                });
            }

            return config;
        } catch (error) {
            logger.error('[AntiRaid] Error getting config:', error);
            throw error;
        }
    }

    /**
     * Atualizar configuração
     */
    async updateConfig(guildId, updates) {
        try {
            const config = await AntiRaidConfig.findOneAndUpdate(
                { guildId },
                { $set: { ...updates, updatedAt: new Date() } },
                { new: true, upsert: true }
            );

            logger.info(`[AntiRaid] Config updated for guild ${guildId}`);
            return config;
        } catch (error) {
            logger.error('[AntiRaid] Error updating config:', error);
            throw error;
        }
    }

    /**
     * Detectar se há um raid em andamento
     * @param {Guild} guild - Guild do Discord
     * @param {GuildMember} member - Membro que acabou de entrar
     * @returns {Promise<RaidEvent|null>} Evento de raid criado ou null se não detectado
     */
    async detectRaid(guild, member) {
        try {
            const guildId = guild.id;
            const config = await this.getConfig(guildId);

            if (!config.enabled) return null;

            // Adicionar join ao cache
            if (!this.recentJoins.has(guildId)) {
                this.recentJoins.set(guildId, []);
            }

            const now = Date.now();
            const joins = this.recentJoins.get(guildId);
            joins.push(now);

            // Limpar joins antigos (mais de 5 minutos)
            const fiveMinutesAgo = now - (5 * 60 * 1000);
            const recentJoins = joins.filter(t => t > fiveMinutesAgo);
            this.recentJoins.set(guildId, recentJoins);

            // Contar joins no último minuto
            const oneMinuteAgo = now - (60 * 1000);
            const joinsLastMinute = recentJoins.filter(t => t > oneMinuteAgo).length;

            // Verificar thresholds
            const isRaid = joinsLastMinute >= config.thresholds.joinsPerMinute ||
                          recentJoins.length >= config.thresholds.joinsPerFiveMinutes;

            if (isRaid && !this.activeRaids.has(guildId)) {
                // Criar novo evento de raid
                const severity = this.calculateSeverity(joinsLastMinute, recentJoins.length, config);
                const raidEvent = await this.createRaidEvent(guildId, severity);
                this.activeRaids.set(guildId, raidEvent._id);

                // Enviar alerta
                await this.sendRaidAlert(guild, raidEvent, config);

                return raidEvent;
            }

            return this.activeRaids.has(guildId) ?
                await RaidEvent.findById(this.activeRaids.get(guildId)) : null;
        } catch (error) {
            logger.error('[AntiRaid] Error detecting raid:', error);
            return null;
        }
    }

    /**
     * Calcular severidade do raid
     */
    calculateSeverity(joinsPerMinute, totalJoins, config) {
        const ratio = joinsPerMinute / config.thresholds.joinsPerMinute;

        if (ratio >= 3) return 'critical';
        if (ratio >= 2) return 'high';
        if (ratio >= 1.5) return 'medium';
        return 'low';
    }

    /**
     * Criar evento de raid
     */
    async createRaidEvent(guildId, severity) {
        try {
            const raidEvent = await RaidEvent.create({
                guildId,
                severity,
                status: 'active',
                startedAt: new Date(),
                stats: {
                    totalJoins: 0,
                    suspiciousJoins: 0,
                    actionsKicked: 0,
                    actionsBanned: 0,
                    actionsQuarantined: 0
                },
                indicators: []
            });

            logger.warn(`[AntiRaid] 🚨 RAID DETECTED in guild ${guildId} - Severity: ${severity}`);
            return raidEvent;
        } catch (error) {
            logger.error('[AntiRaid] Error creating raid event:', error);
            throw error;
        }
    }

    /**
     * Analisar membro suspeito
     */
    async analyzeMember(guild, member, raidEvent) {
        try {
            const config = await this.getConfig(guild.id);
            const flags = [];

            // Verificar idade da conta
            const accountAge = Math.floor((Date.now() - member.user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            if (accountAge < config.thresholds.minimumAccountAge) {
                flags.push('new_account');
            }

            // Verificar avatar padrão
            if (!member.user.avatar) {
                flags.push('no_avatar');
            }

            // Verificar username suspeito (números demais, caracteres especiais)
            const username = member.user.username;
            const hasLotsOfNumbers = (username.match(/\d/g) || []).length > username.length / 2;
            const hasWeirdChars = /[^\w\s-]/g.test(username);
            if (hasLotsOfNumbers || hasWeirdChars) {
                flags.push('suspicious_name');
            }

            // Se há raid ativo, adicionar flag
            if (raidEvent) {
                flags.push('mass_join_pattern');
            }

            // Decidir ação baseado nas flags e configuração
            let actionTaken = 'none';

            if (flags.length >= 2) {
                if (config.actions.autoBan && raidEvent?.severity === 'critical') {
                    actionTaken = 'ban';
                    await member.ban({ reason: `Anti-Raid: Suspicious member during ${raidEvent.severity} raid` });
                } else if (config.actions.autoKick && flags.length >= 3) {
                    actionTaken = 'kick';
                    await member.kick(`Anti-Raid: Multiple red flags (${flags.join(', ')})`);
                } else if (config.actions.quarantine && config.quarantineRoleId) {
                    actionTaken = 'quarantine';
                    const quarantineRole = guild.roles.cache.get(config.quarantineRoleId);
                    if (quarantineRole) {
                        await member.roles.add(quarantineRole);
                    }
                }
            }

            // Registrar membro suspeito
            const suspiciousMember = await SuspiciousMember.create({
                guildId: guild.id,
                userId: member.id,
                username: member.user.username,
                discriminator: member.user.discriminator,
                accountCreatedAt: member.user.createdAt,
                joinedAt: new Date(),
                accountAgeInDays: accountAge,
                flags,
                actionTaken,
                raidEventId: raidEvent?._id || null
            });

            // Atualizar estatísticas do raid
            if (raidEvent) {
                await RaidEvent.findByIdAndUpdate(raidEvent._id, {
                    $inc: {
                        'stats.totalJoins': 1,
                        'stats.suspiciousJoins': flags.length > 0 ? 1 : 0,
                        [`stats.actions${actionTaken.charAt(0).toUpperCase() + actionTaken.slice(1)}`]: actionTaken !== 'none' ? 1 : 0
                    },
                    $push: { memberIds: member.id }
                });
            }

            logger.info(`[AntiRaid] Analyzed ${member.user.tag}: ${flags.length} flags, action: ${actionTaken}`);
            return { suspiciousMember, actionTaken, flags };
        } catch (error) {
            logger.error('[AntiRaid] Error analyzing member:', error);
            return { suspiciousMember: null, actionTaken: 'none', flags: [] };
        }
    }

    /**
     * Resolver raid manualmente
     */
    async resolveRaid(guildId, raidEventId, notes = '') {
        try {
            const raidEvent = await RaidEvent.findByIdAndUpdate(
                raidEventId,
                {
                    status: 'resolved',
                    resolvedAt: new Date(),
                    notes
                },
                { new: true }
            );

            this.activeRaids.delete(guildId);
            logger.info(`[AntiRaid] Raid ${raidEventId} resolved in guild ${guildId}`);
            return raidEvent;
        } catch (error) {
            logger.error('[AntiRaid] Error resolving raid:', error);
            throw error;
        }
    }

    /**
     * Enviar alerta de raid
     */
    async sendRaidAlert(guild, raidEvent, config) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🚨 RAID DETECTED!')
                .setDescription(`A raid has been detected in **${guild.name}**`)
                .setColor(raidEvent.severity === 'critical' ? 0xFF0000 :
                         raidEvent.severity === 'high' ? 0xFF6600 :
                         raidEvent.severity === 'medium' ? 0xFFAA00 : 0xFFDD00)
                .addFields(
                    { name: 'Severity', value: raidEvent.severity.toUpperCase(), inline: true },
                    { name: 'Status', value: raidEvent.status, inline: true },
                    { name: 'Started At', value: `<t:${Math.floor(raidEvent.startedAt.getTime() / 1000)}:R>`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Raid ID: ${raidEvent._id}` });

            // Enviar para canal de logs
            if (config.logChannelId) {
                const logChannel = guild.channels.cache.get(config.logChannelId);
                if (logChannel) {
                    await logChannel.send({ embeds: [embed] });
                }
            }

            // Enviar para webhook de alertas
            if (config.alertWebhook) {
                const fetch = require('node-fetch');
                await fetch(config.alertWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        embeds: [embed.toJSON()],
                        username: 'IGNIS Anti-Raid',
                        avatar_url: guild.iconURL()
                    })
                });
            }
        } catch (error) {
            logger.error('[AntiRaid] Error sending raid alert:', error);
        }
    }

    /**
     * Obter estatísticas de raids
     */
    async getGuildStats(guildId) {
        try {
            const totalRaids = await RaidEvent.countDocuments({ guildId });
            const activeRaids = await RaidEvent.countDocuments({ guildId, status: 'active' });
            const resolvedRaids = await RaidEvent.countDocuments({ guildId, status: 'resolved' });

            const suspiciousMembers = await SuspiciousMember.countDocuments({ guildId });
            const quarantined = await SuspiciousMember.countDocuments({ guildId, actionTaken: 'quarantine' });
            const kicked = await SuspiciousMember.countDocuments({ guildId, actionTaken: 'kick' });
            const banned = await SuspiciousMember.countDocuments({ guildId, actionTaken: 'ban' });

            return {
                raids: {
                    total: totalRaids,
                    active: activeRaids,
                    resolved: resolvedRaids
                },
                members: {
                    suspicious: suspiciousMembers,
                    quarantined,
                    kicked,
                    banned
                }
            };
        } catch (error) {
            logger.error('[AntiRaid] Error getting stats:', error);
            throw error;
        }
    }

    /**
     * Limpar cache de joins antigos
     */
    cleanupCache() {
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);

        for (const [guildId, joins] of this.recentJoins.entries()) {
            const recentJoins = joins.filter(t => t > fiveMinutesAgo);
            if (recentJoins.length === 0) {
                this.recentJoins.delete(guildId);
            } else {
                this.recentJoins.set(guildId, recentJoins);
            }
        }
    }
    
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

module.exports = new AntiRaidService();
