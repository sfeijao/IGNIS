const { Suggestion } = require('../models/suggestion');
const { EmbedBuilder } = require('discord.js');

class SuggestionService {
    async createSuggestion(client, guildId, userId, channelId, title, description) {
        const channel = await client.channels.fetch(channelId);

        const embed = new EmbedBuilder()
            .setTitle(`💡 ${title}`)
            .setDescription(description)
            .setColor('#FFD700')
            .setAuthor({ name: `Sugestão de ${(await client.users.fetch(userId)).tag}`, iconURL: (await client.users.fetch(userId)).displayAvatarURL() })
            .addFields([
                { name: '👍 Votos Positivos', value: '0', inline: true },
                { name: '👎 Votos Negativos', value: '0', inline: true },
                { name: '📊 Status', value: 'Pendente', inline: true }
            ])
            .setTimestamp();

        const message = await channel.send({ embeds: [embed] });
        await message.react('👍');
        await message.react('👎');

        return await Suggestion.create({
            guildId,
            userId,
            messageId: message.id,
            channelId,
            title,
            description
        });
    }

    async vote(messageId, userId, voteType) {
        const suggestion = await Suggestion.findOne({ messageId });
        if (!suggestion) return null;

        const upvotes = suggestion.votes.upvotes.filter(id => id !== userId);
        const downvotes = suggestion.votes.downvotes.filter(id => id !== userId);

        if (voteType === 'up' && !suggestion.votes.upvotes.includes(userId)) {
            upvotes.push(userId);
        } else if (voteType === 'down' && !suggestion.votes.downvotes.includes(userId)) {
            downvotes.push(userId);
        }

        suggestion.votes.upvotes = upvotes;
        suggestion.votes.downvotes = downvotes;

        await suggestion.save();
        return suggestion;
    }

    async updateStatus(client, messageId, status, reviewedBy, reviewNote = null) {
        const suggestion = await Suggestion.findOne({ messageId });
        if (!suggestion) return null;

        suggestion.status = status;
        suggestion.reviewedBy = reviewedBy;
        suggestion.reviewedAt = new Date();
        suggestion.reviewNote = reviewNote;

        await suggestion.save();

        const channel = await client.channels.fetch(suggestion.channelId);
        const message = await channel.messages.fetch(messageId);

        const embed = message.embeds[0];
        const statusColors = {
            approved: '#00FF00',
            rejected: '#FF0000',
            implemented: '#0099FF',
            pending: '#FFD700'
        };

        const statusEmojis = {
            approved: '✅',
            rejected: '❌',
            implemented: '🎉',
            pending: '⏳'
        };

        const updatedEmbed = EmbedBuilder.from(embed)
            .setColor(statusColors[status])
            .setFields([
                { name: '👍 Votos Positivos', value: String(suggestion.votes.upvotes.length), inline: true },
                { name: '👎 Votos Negativos', value: String(suggestion.votes.downvotes.length), inline: true },
                { name: '📊 Status', value: `${statusEmojis[status]} ${status.charAt(0).toUpperCase() + status.slice(1)}`, inline: true }
            ]);

        if (reviewNote) {
            updatedEmbed.addFields([{ name: '📝 Nota do Staff', value: reviewNote }]);
        }

        await message.edit({ embeds: [updatedEmbed] });
        return suggestion;
    }

    async getGuildSuggestions(guildId, status = null) {
        const query = { guildId };
        if (status) query.status = status;

        return await Suggestion.find(query).sort({ createdAt: -1 });
    }

    async getUserSuggestions(guildId, userId) {
        return await Suggestion.find({ guildId, userId }).sort({ createdAt: -1 });
    }
}

module.exports = new SuggestionService();
