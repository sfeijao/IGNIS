const { AutoResponse } = require('../models/autoResponse');

class AutoResponseService {
    async createResponse(guildId, name, triggers, response, options = {}) {
        return await AutoResponse.create({
            guildId,
            name,
            triggers,
            response,
            matchType: options.matchType || 'contains',
            caseSensitive: options.caseSensitive || false,
            cooldown: options.cooldown || 0,
            channelIds: options.channelIds || [],
            roleIds: options.roleIds || [],
            createdBy: options.createdBy
        });
    }

    async checkTriggers(message) {
        const responses = await AutoResponse.find({
            guildId: message.guild.id,
            enabled: true
        });

        for (const autoResp of responses) {
            if (autoResp.channelIds.length > 0 && !autoResp.channelIds.includes(message.channel.id)) {
                continue;
            }

            if (autoResp.roleIds.length > 0) {
                const hasRole = message.member.roles.cache.some(r => autoResp.roleIds.includes(r.id));
                if (!hasRole) continue;
            }

            if (autoResp.cooldown > 0) {
                const lastUsed = autoResp.lastTriggered.get(message.author.id);
                if (lastUsed && (Date.now() - lastUsed.getTime() < autoResp.cooldown * 1000)) {
                    continue;
                }
            }

            const content = autoResp.caseSensitive ? message.content : message.content.toLowerCase();

            for (const trigger of autoResp.triggers) {
                const trig = autoResp.caseSensitive ? trigger : trigger.toLowerCase();
                let matched = false;

                switch (autoResp.matchType) {
                    case 'exact':
                        matched = content === trig;
                        break;
                    case 'contains':
                        matched = content.includes(trig);
                        break;
                    case 'startsWith':
                        matched = content.startsWith(trig);
                        break;
                    case 'endsWith':
                        matched = content.endsWith(trig);
                        break;
                    case 'regex':
                        try {
                            matched = new RegExp(trig, autoResp.caseSensitive ? '' : 'i').test(content);
                        } catch (e) {
                            logger.error('Regex inválido:', e);
                        }
                        break;
                }

                if (matched) {
                    await message.reply(autoResp.response);

                    autoResp.stats.totalTriggers++;
                    autoResp.stats.lastTriggeredAt = new Date();
                    autoResp.lastTriggered.set(message.author.id, new Date());
                    await autoResp.save();

                    return true;
                }
            }
        }

        return false;
    }

    async getGuildResponses(guildId) {
        return await AutoResponse.find({ guildId }).sort({ createdAt: -1 });
    }

    async updateResponse(id, updates) {
        return await AutoResponse.findByIdAndUpdate(id, updates, { new: true });
    }

    async deleteResponse(id) {
        return await AutoResponse.findByIdAndDelete(id);
    }

    async toggleResponse(id) {
        const response = await AutoResponse.findById(id);
        response.enabled = !response.enabled;
        return await response.save();
    }
}

module.exports = new AutoResponseService();
