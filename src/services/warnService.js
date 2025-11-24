const { Warn } = require('../models/warn');
const logger = require('../../utils/logger');

class WarnService {
    async addWarn(guildId, userId, moderatorId, reason, level = 1, expiresInDays = null) {
        try {
            const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;
            
            const warn = await Warn.create({
                guildId, userId, moderatorId, reason, level,
                expiresAt, active: true
            });
            
            // Auto-punish baseado no total de warns
            const activeWarns = await this.getActiveWarns(guildId, userId);
            const punishment = this.calculatePunishment(activeWarns.length, level);
            
            if (punishment !== 'none') {
                warn.punishment = punishment;
                await warn.save();
            }
            
            logger.info(`[Warn] Added warn for ${userId} in ${guildId}: ${reason}`);
            return warn;
        } catch (error) {
            logger.error('[Warn] Error adding warn:', error);
            throw error;
        }
    }

    async getActiveWarns(guildId, userId) {
        return await Warn.find({ guildId, userId, active: true }).sort({ createdAt: -1 });
    }

    async revokeWarn(warnId, moderatorId, reason) {
        const warn = await Warn.findByIdAndUpdate(warnId, {
            active: false,
            revokedBy: moderatorId,
            revokedAt: new Date(),
            revokedReason: reason
        }, { new: true });
        
        return warn;
    }

    async getUserWarns(guildId, userId) {
        return await Warn.find({ guildId, userId }).sort({ createdAt: -1 });
    }

    calculatePunishment(totalWarns, level) {
        if (level >= 5 || totalWarns >= 5) return 'ban';
        if (level >= 4 || totalWarns >= 4) return 'tempban';
        if (level >= 3 || totalWarns >= 3) return 'kick';
        if (totalWarns >= 2) return 'mute';
        return 'none';
    }

    async expireWarns() {
        const expired = await Warn.updateMany(
            { active: true, expiresAt: { $lte: new Date() } },
            { $set: { active: false } }
        );
        return expired.modifiedCount;
    }
}

module.exports = new WarnService();
