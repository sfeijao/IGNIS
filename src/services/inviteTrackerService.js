const { InviteTracker, MemberJoin } = require('../models/inviteTracker');
const logger = require('../../utils/logger');

/**
 * Invite Tracker Service - Gerencia convites e detecta fake invites
 */
class InviteTrackerService {
    constructor() {
        this.inviteCache = new Map(); // guildId -> Map(inviteCode -> Invite)
    }

    /**
     * Sincroniza convites do servidor com o banco de dados
     * Deve ser chamado quando o bot inicia ou quando o servidor cria/deleta convites
     */
    async syncGuildInvites(guild) {
        try {
            const guildId = guild.id;
            
            // Buscar convites atuais do Discord
            const discordInvites = await guild.invites.fetch().catch(() => new Map());
            
            // Atualizar cache
            const inviteMap = new Map();
            for (const [code, invite] of discordInvites) {
                inviteMap.set(code, {
                    code: invite.code,
                    uses: invite.uses,
                    inviterId: invite.inviter?.id,
                    channelId: invite.channel?.id,
                    maxUses: invite.maxUses,
                    maxAge: invite.maxAge,
                    temporary: invite.temporary,
                    createdAt: invite.createdAt,
                    expiresAt: invite.expiresTimestamp ? new Date(invite.expiresTimestamp) : null
                });
            }
            this.inviteCache.set(guildId, inviteMap);

            // Sincronizar com banco de dados
            for (const [code, invite] of inviteMap) {
                await InviteTracker.findOneAndUpdate(
                    { guildId, inviteCode: code },
                    {
                        $set: {
                            inviterId: invite.inviterId,
                            channelId: invite.channelId,
                            uses: invite.uses,
                            maxUses: invite.maxUses,
                            maxAge: invite.maxAge,
                            temporary: invite.temporary,
                            expiresAt: invite.expiresAt,
                            updatedAt: new Date()
                        },
                        $setOnInsert: {
                            createdAt: invite.createdAt,
                            totalJoins: 0,
                            validJoins: 0,
                            fakeJoins: 0,
                            leftJoins: 0,
                            isActive: true
                        }
                    },
                    { upsert: true, new: true }
                );
            }

            // Marcar convites deletados como inativos
            const activeCodes = Array.from(inviteMap.keys());
            await InviteTracker.updateMany(
                { guildId, inviteCode: { $nin: activeCodes }, isActive: true },
                { $set: { isActive: false, updatedAt: new Date() } }
            );

            logger.info(`[InviteTracker] Synced ${inviteMap.size} invites for guild ${guildId}`);
            return inviteMap;
        } catch (error) {
            logger.error('[InviteTracker] Error syncing guild invites:', error);
            throw error;
        }
    }

    /**
     * Detecta qual convite foi usado quando um membro entra
     * Compara cache antes/depois para identificar o convite
     * @param {Guild} guild - Guild do Discord
     * @param {GuildMember} member - Membro que entrou
     * @returns {Promise<{code: string, inviterId: string}|null>} Dados do convite usado ou null
     */
    async detectUsedInvite(guild, member) {
        try {
            const guildId = guild.id;
            const userId = member.id;

            // Buscar convites atuais
            const currentInvites = await guild.invites.fetch().catch(() => new Map());
            const cachedInvites = this.inviteCache.get(guildId) || new Map();

            let usedInvite = null;

            // Comparar usos para encontrar qual aumentou
            for (const [code, current] of currentInvites) {
                const cached = cachedInvites.get(code);
                if (cached && current.uses > cached.uses) {
                    usedInvite = {
                        code: current.code,
                        uses: current.uses,
                        inviterId: current.inviter?.id,
                        channelId: current.channel?.id
                    };
                    break;
                }
            }

            // Se não encontrou, pode ser um convite que expirou após uso único
            // Procurar por convites que desapareceram
            if (!usedInvite) {
                for (const [code, cached] of cachedInvites) {
                    if (!currentInvites.has(code) && cached.maxUses === 1) {
                        usedInvite = {
                            code: cached.code,
                            uses: 1,
                            inviterId: cached.inviterId,
                            channelId: cached.channelId
                        };
                        break;
                    }
                }
            }

            // Atualizar cache com novos valores
            await this.syncGuildInvites(guild);

            return usedInvite;
        } catch (error) {
            logger.error('[InviteTracker] Error detecting used invite:', error);
            return null;
        }
    }

    /**
     * Registra entrada de membro e atualiza métricas
     */
    async trackMemberJoin(guild, member, inviteCode) {
        try {
            const guildId = guild.id;
            const userId = member.id;

            if (!inviteCode) {
                logger.warn(`[InviteTracker] No invite code detected for ${userId} in ${guildId}`);
                return null;
            }

            // Buscar dados do convite
            const invite = await InviteTracker.findOne({ guildId, inviteCode });
            if (!invite) {
                logger.warn(`[InviteTracker] Invite ${inviteCode} not found in database`);
                return null;
            }

            // Calcular idade da conta
            const accountCreatedAt = member.user.createdAt;
            const accountAgeInDays = Math.floor((Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

            // Detectar se é potencialmente fake
            let isFake = false;
            let fakeReason = null;

            if (accountAgeInDays < 7) {
                isFake = true;
                fakeReason = 'new_account';
            }

            // Registrar entrada do membro
            const memberJoin = await MemberJoin.create({
                guildId,
                userId,
                inviteCode,
                inviterId: invite.inviterId,
                username: member.user.username,
                discriminator: member.user.discriminator,
                accountCreatedAt,
                accountAgeAtJoin: accountAgeInDays,
                joinedAt: new Date(),
                isFake,
                fakeReason
            });

            // Atualizar métricas do convite
            const updateData = {
                $inc: {
                    totalJoins: 1,
                    validJoins: isFake ? 0 : 1,
                    fakeJoins: isFake ? 1 : 0
                },
                $set: { updatedAt: new Date() }
            };

            await InviteTracker.findByIdAndUpdate(invite._id, updateData);

            logger.info(`[InviteTracker] Tracked join: ${userId} via ${inviteCode} (fake: ${isFake})`);
            return memberJoin;
        } catch (error) {
            logger.error('[InviteTracker] Error tracking member join:', error);
            throw error;
        }
    }

    /**
     * Registra saída de membro e atualiza detecção de fake
     */
    async trackMemberLeave(guild, member) {
        try {
            const guildId = guild.id;
            const userId = member.id;

            // Buscar registro de entrada
            const memberJoin = await MemberJoin.findOne({ guildId, userId });
            if (!memberJoin) {
                logger.warn(`[InviteTracker] No join record found for ${userId} in ${guildId}`);
                return null;
            }

            // Calcular tempo no servidor (em horas)
            const timeInServerMs = Date.now() - memberJoin.joinedAt.getTime();
            const timeInServerHours = timeInServerMs / (1000 * 60 * 60);

            // Atualizar registro
            let isFake = memberJoin.isFake;
            let fakeReason = memberJoin.fakeReason;

            // Detectar quick leave (saiu em menos de 1 hora)
            if (timeInServerHours < 1) {
                isFake = true;
                fakeReason = fakeReason ? 'combined' : 'quick_leave';
            }

            memberJoin.leftAt = new Date();
            memberJoin.hasLeft = true;
            memberJoin.timeInServer = timeInServerHours;
            memberJoin.isFake = isFake;
            memberJoin.fakeReason = fakeReason;
            await memberJoin.save();

            // Atualizar métricas do convite
            const invite = await InviteTracker.findOne({
                guildId,
                inviteCode: memberJoin.inviteCode
            });

            if (invite) {
                const updateData = {
                    $inc: {
                        leftJoins: 1
                    },
                    $set: { updatedAt: new Date() }
                };

                // Se não era fake antes mas é agora, ajustar contadores
                if (!memberJoin.isFake && isFake) {
                    updateData.$inc.validJoins = -1;
                    updateData.$inc.fakeJoins = 1;
                }

                await InviteTracker.findByIdAndUpdate(invite._id, updateData);
            }

            logger.info(`[InviteTracker] Tracked leave: ${userId} after ${timeInServerHours.toFixed(2)}h (fake: ${isFake})`);
            return memberJoin;
        } catch (error) {
            logger.error('[InviteTracker] Error tracking member leave:', error);
            throw error;
        }
    }

    /**
     * Obter estatísticas de convites de um servidor
     */
    async getGuildStats(guildId) {
        try {
            const invites = await InviteTracker.find({ guildId }).lean();
            const members = await MemberJoin.find({ guildId }).lean();

            const stats = {
                totalInvites: invites.length,
                activeInvites: invites.filter(i => i.isActive).length,
                totalJoins: invites.reduce((sum, i) => sum + i.totalJoins, 0),
                validJoins: invites.reduce((sum, i) => sum + i.validJoins, 0),
                fakeJoins: invites.reduce((sum, i) => sum + i.fakeJoins, 0),
                leftJoins: invites.reduce((sum, i) => sum + i.leftJoins, 0),
                fakeRate: 0
            };

            if (stats.totalJoins > 0) {
                stats.fakeRate = ((stats.fakeJoins / stats.totalJoins) * 100).toFixed(2);
            }

            return stats;
        } catch (error) {
            logger.error('[InviteTracker] Error getting guild stats:', error);
            throw error;
        }
    }

    /**
     * Obter top inviters de um servidor
     */
    async getTopInviters(guildId, limit = 10) {
        try {
            const invites = await InviteTracker.aggregate([
                { $match: { guildId } },
                {
                    $group: {
                        _id: '$inviterId',
                        totalJoins: { $sum: '$totalJoins' },
                        validJoins: { $sum: '$validJoins' },
                        fakeJoins: { $sum: '$fakeJoins' },
                        leftJoins: { $sum: '$leftJoins' },
                        inviteCount: { $sum: 1 }
                    }
                },
                { $sort: { validJoins: -1 } },
                { $limit: limit }
            ]);

            return invites.map(i => ({
                inviterId: i._id,
                totalJoins: i.totalJoins,
                validJoins: i.validJoins,
                fakeJoins: i.fakeJoins,
                leftJoins: i.leftJoins,
                inviteCount: i.inviteCount,
                fakeRate: i.totalJoins > 0 ? ((i.fakeJoins / i.totalJoins) * 100).toFixed(2) : 0
            }));
        } catch (error) {
            logger.error('[InviteTracker] Error getting top inviters:', error);
            throw error;
        }
    }

    /**
     * Obter detalhes de convites de um usuário
     */
    async getUserInvites(guildId, userId) {
        try {
            const invites = await InviteTracker.find({ guildId, inviterId: userId }).lean();
            const members = await MemberJoin.find({ guildId, inviterId: userId }).lean();

            return {
                invites,
                members,
                stats: {
                    totalInvites: invites.length,
                    activeInvites: invites.filter(i => i.isActive).length,
                    totalJoins: invites.reduce((sum, i) => sum + i.totalJoins, 0),
                    validJoins: invites.reduce((sum, i) => sum + i.validJoins, 0),
                    fakeJoins: invites.reduce((sum, i) => sum + i.fakeJoins, 0),
                    leftJoins: invites.reduce((sum, i) => sum + i.leftJoins, 0)
                }
            };
        } catch (error) {
            logger.error('[InviteTracker] Error getting user invites:', error);
            throw error;
        }
    }
}

module.exports = new InviteTrackerService();
