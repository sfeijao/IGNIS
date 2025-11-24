const { Event } = require('../models/event');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

class EventService {
    async createEvent(client, guildId, createdBy, eventData) {
        const { title, description, startDate, endDate, channelId, maxParticipants, imageUrl, reminders } = eventData;
        
        const event = await Event.create({
            guildId,
            title,
            description,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            channelId,
            maxParticipants,
            imageUrl,
            reminders: reminders || [
                { time: 24 * 60, sent: false },
                { time: 60, sent: false },
                { time: 15, sent: false }
            ],
            createdBy
        });
        
        const channel = await client.channels.fetch(channelId);
        const message = await channel.send({ embeds: [this.createEventEmbed(event)], components: [this.createEventButtons()] });
        
        event.messageId = message.id;
        await event.save();
        
        return event;
    }
    
    createEventEmbed(event) {
        const embed = new EmbedBuilder()
            .setTitle(`📅 ${event.title}`)
            .setDescription(event.description)
            .setColor('#FF6B6B')
            .addFields([
                { name: '📆 Data de Início', value: `<t:${Math.floor(event.startDate.getTime() / 1000)}:F>`, inline: true },
                { name: '👥 Participantes', value: `${event.participants.length}${event.maxParticipants ? `/${event.maxParticipants}` : ''}`, inline: true }
            ])
            .setTimestamp();
        
        if (event.endDate) {
            embed.addFields([{ name: '🏁 Data de Término', value: `<t:${Math.floor(event.endDate.getTime() / 1000)}:F>`, inline: true }]);
        }
        
        if (event.imageUrl) {
            embed.setImage(event.imageUrl);
        }
        
        return embed;
    }
    
    createEventButtons() {
        return new ActionRowBuilder().addComponents([
            new ButtonBuilder()
                .setCustomId('event_join')
                .setLabel('Participar')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('event_leave')
                .setLabel('Sair')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        ]);
    }
    
    async joinEvent(client, eventId, userId) {
        const event = await Event.findById(eventId);
        if (!event) return null;
        
        if (event.participants.includes(userId)) {
            return { success: false, message: 'Você já está participando!' };
        }
        
        if (event.maxParticipants && event.participants.length >= event.maxParticipants) {
            return { success: false, message: 'Evento lotado!' };
        }
        
        event.participants.push(userId);
        await event.save();
        
        await this.updateEventMessage(client, event);
        return { success: true, message: 'Você está participando!' };
    }
    
    async leaveEvent(client, eventId, userId) {
        const event = await Event.findById(eventId);
        if (!event) return null;
        
        if (!event.participants.includes(userId)) {
            return { success: false, message: 'Você não está participando!' };
        }
        
        event.participants = event.participants.filter(id => id !== userId);
        await event.save();
        
        await this.updateEventMessage(client, event);
        return { success: true, message: 'Você saiu do evento!' };
    }
    
    async updateEventMessage(client, event) {
        const channel = await client.channels.fetch(event.channelId);
        const message = await channel.messages.fetch(event.messageId);
        await message.edit({ embeds: [this.createEventEmbed(event)] });
    }
    
    async checkReminders(client) {
        const now = new Date();
        const events = await Event.find({ startDate: { $gt: now } });
        
        for (const event of events) {
            for (const reminder of event.reminders) {
                if (!reminder.sent) {
                    const minutesUntil = (event.startDate - now) / 1000 / 60;
                    
                    if (minutesUntil <= reminder.time) {
                        await this.sendReminder(client, event, reminder.time);
                        reminder.sent = true;
                        await event.save();
                    }
                }
            }
        }
    }
    
    async sendReminder(client, event, minutesBefore) {
        const channel = await client.channels.fetch(event.channelId);
        
        const embed = new EmbedBuilder()
            .setTitle(`⏰ Lembrete de Evento`)
            .setDescription(`O evento **${event.title}** começa em ${minutesBefore} minutos!`)
            .setColor('#FFA500')
            .setTimestamp();
        
        const mentions = event.participants.map(id => `<@${id}>`).join(' ');
        await channel.send({ content: mentions, embeds: [embed] });
    }
    
    async getUpcomingEvents(guildId, limit = 10) {
        return await Event.find({
            guildId,
            startDate: { $gt: new Date() }
        }).sort({ startDate: 1 }).limit(limit);
    }
    
    async deleteEvent(eventId) {
        return await Event.findByIdAndDelete(eventId);
    }
}

module.exports = new EventService();
