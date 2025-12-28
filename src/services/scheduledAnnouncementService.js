const { ScheduledAnnouncement } = require('../models/scheduledAnnouncement');
const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

class ScheduledAnnouncementService {
    async createAnnouncement(guildId, createdBy, announcementData) {
        const announcement = await ScheduledAnnouncement.create({
            guildId,
            createdBy,
            ...announcementData,
            status: announcementData.sendNow ? 'sent' : 'pending'
        });
        
        // If sendNow is true, send immediately
        if (announcementData.sendNow && global.discordClient) {
            try {
                const messageId = await this.sendAnnouncement(global.discordClient, announcement);
                announcement.status = 'sent';
                announcement.sentAt = new Date();
                announcement.messageId = messageId;
                await announcement.save();
            } catch (error) {
                announcement.status = 'failed';
                announcement.errorMessage = error.message;
                await announcement.save();
                throw error;
            }
        }
        
        return announcement;
    }

    async updateAnnouncement(id, updateData) {
        const announcement = await ScheduledAnnouncement.findById(id);
        if (!announcement) throw new Error('Announcement not found');
        
        // Update fields
        if (updateData.title) announcement.title = updateData.title;
        if (updateData.message) announcement.message = updateData.message;
        if (updateData.channelId) announcement.channelId = updateData.channelId;
        if (updateData.scheduledFor) announcement.scheduledFor = updateData.scheduledFor;
        if (updateData.embed) announcement.embed = { ...announcement.embed, ...updateData.embed };
        
        return await announcement.save();
    }

    async resendAnnouncement(id, client) {
        const announcement = await ScheduledAnnouncement.findById(id);
        if (!announcement) throw new Error('Announcement not found');
        
        try {
            const messageId = await this.sendAnnouncement(client, announcement);
            announcement.messageId = messageId;
            announcement.sentAt = new Date();
            await announcement.save();
            return announcement;
        } catch (error) {
            announcement.errorMessage = error.message;
            await announcement.save();
            throw error;
        }
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

                if (announcement.repeat && announcement.repeat.enabled) {
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
                logger.error('Erro ao enviar anúncio:', error);
            }
        }
    }

    async sendAnnouncement(client, announcement) {
        const channel = await client.channels.fetch(announcement.channelId);
        if (!channel) throw new Error('Channel not found');

        let content = '';
        if (announcement.mentions?.everyone) content = '@everyone ';
        else if (announcement.mentions?.here) content = '@here ';
        if (announcement.mentions?.roles?.length > 0) {
            content += announcement.mentions.roles.map(id => `<@&${id}>`).join(' ');
        }

        let sentMessage;
        if (announcement.embed?.enabled) {
            const embed = new EmbedBuilder()
                .setTitle(announcement.title)
                .setDescription(announcement.message)
                .setColor(announcement.embed.color || '#5865F2')
                .setTimestamp();

            if (announcement.embed.thumbnail) embed.setThumbnail(announcement.embed.thumbnail);
            if (announcement.embed.image) embed.setImage(announcement.embed.image);
            if (announcement.embed.footer) embed.setFooter({ text: announcement.embed.footer });

            sentMessage = await channel.send({ content: content.trim() || undefined, embeds: [embed] });
        } else {
            sentMessage = await channel.send({ content: `${content}\n\n**${announcement.title}**\n${announcement.message}`.trim() });
        }
        
        return sentMessage?.id;
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

        return await ScheduledAnnouncement.find(query).sort({ createdAt: -1 });
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
