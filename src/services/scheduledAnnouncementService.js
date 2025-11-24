const { ScheduledAnnouncement } = require('../models/scheduledAnnouncement');
const { EmbedBuilder } = require('discord.js');

class ScheduledAnnouncementService {
    async createAnnouncement(guildId, createdBy, announcementData) {
        return await ScheduledAnnouncement.create({
            guildId,
            createdBy,
            ...announcementData
        });
    }

    async checkPendingAnnouncements(client) {
        const now = new Date();

        const pending = await ScheduledAnnouncement.find({
            status: 'pending',
            scheduledFor: { $lte: now }
        });

        for (const announcement of pending) {
            try {
                await this.sendAnnouncement(client, announcement);

                if (announcement.repeat.enabled) {
                    await this.scheduleNextRepeat(announcement);
                } else {
                    announcement.status = 'sent';
                    announcement.sentAt = new Date();
                }

                await announcement.save();
            } catch (error) {
                announcement.status = 'failed';
                announcement.errorMessage = error.message;
                await announcement.save();
                console.error('Erro ao enviar anúncio:', error);
            }
        }
    }

    async sendAnnouncement(client, announcement) {
        const channel = await client.channels.fetch(announcement.channelId);

        let content = '';
        if (announcement.mentions.everyone) content = '@everyone ';
        if (announcement.mentions.here) content = '@here ';
        if (announcement.mentions.roles.length > 0) {
            content += announcement.mentions.roles.map(id => `<@&${id}>`).join(' ');
        }

        if (announcement.embed.enabled) {
            const embed = new EmbedBuilder()
                .setTitle(announcement.title)
                .setDescription(announcement.message)
                .setColor(announcement.embed.color)
                .setTimestamp();

            if (announcement.embed.thumbnail) embed.setThumbnail(announcement.embed.thumbnail);
            if (announcement.embed.image) embed.setImage(announcement.embed.image);
            if (announcement.embed.footer) embed.setFooter({ text: announcement.embed.footer });

            await channel.send({ content: content.trim() || undefined, embeds: [embed] });
        } else {
            await channel.send({ content: `${content}\n\n**${announcement.title}**\n${announcement.message}`.trim() });
        }
    }

    async scheduleNextRepeat(announcement) {
        const nextDate = new Date(announcement.scheduledFor);

        switch (announcement.repeat.interval) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
        }

        if (announcement.repeat.endDate && nextDate > announcement.repeat.endDate) {
            announcement.status = 'sent';
            return;
        }

        announcement.scheduledFor = nextDate;
    }

    async getGuildAnnouncements(guildId, status = null) {
        const query = { guildId };
        if (status) query.status = status;

        return await ScheduledAnnouncement.find(query).sort({ scheduledFor: 1 });
    }

    async cancelAnnouncement(id) {
        const announcement = await ScheduledAnnouncement.findById(id);
        announcement.status = 'cancelled';
        return await announcement.save();
    }

    async deleteAnnouncement(id) {
        return await ScheduledAnnouncement.findByIdAndDelete(id);
    }
}

module.exports = new ScheduledAnnouncementService();
