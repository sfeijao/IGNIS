const logger = require('../utils/logger');
const { Events } = require('discord.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        try {
            const guildId = newState.guild.id;
            const userId = newState.id;
            
            let eventData = null;

            // User joined voice channel
            if (oldState.channelId === null && newState.channelId !== null) {
                eventData = {
                    userId,
                    username: newState.member.user.username,
                    channelId: newState.channelId,
                    channelName: newState.channel.name,
                    action: 'joined',
                    timestamp: new Date().toISOString()
                };

                // Persist mod log
                try {
                    const storage = require('../utils/storage');
                    await storage.addLog({ guild_id: guildId, type: 'mod_voice_join', message: userId, data: { channelId: newState.channelId } });
                } catch (e) { logger.debug('Caught error:', e?.message || e); }

                // Analytics
                if (newState.client.database) {
                    await newState.client.database.recordAnalytics(
                        guildId, 
                        'voice_channel_joined', 
                        1,
                        {
                            userId,
                            channelId: newState.channelId,
                            channelName: newState.channel.name
                        }
                    );
                }
            } 
            // User left voice channel
            else if (oldState.channelId !== null && newState.channelId === null) {
                eventData = {
                    userId,
                    username: oldState.member.user.username,
                    channelId: oldState.channelId,
                    channelName: oldState.channel.name,
                    action: 'left',
                    timestamp: new Date().toISOString()
                };

                // Persist mod log
                try {
                    const storage = require('../utils/storage');
                    await storage.addLog({ guild_id: guildId, type: 'mod_voice_leave', message: userId, data: { channelId: oldState.channelId } });
                } catch (e) { logger.debug('Caught error:', e?.message || e); }

                // Analytics
                if (oldState.client.database) {
                    await oldState.client.database.recordAnalytics(
                        guildId, 
                        'voice_channel_left', 
                        1,
                        {
                            userId,
                            channelId: oldState.channelId,
                            channelName: oldState.channel.name
                        }
                    );
                }
            }
            // User moved between channels
            else if (oldState.channelId !== newState.channelId && oldState.channelId !== null && newState.channelId !== null) {
                eventData = {
                    userId,
                    username: newState.member.user.username,
                    fromChannelId: oldState.channelId,
                    fromChannelName: oldState.channel.name,
                    toChannelId: newState.channelId,
                    toChannelName: newState.channel.name,
                    action: 'moved',
                    timestamp: new Date().toISOString()
                };

                // Persist mod log
                try {
                    const storage = require('../utils/storage');
                    await storage.addLog({ guild_id: guildId, type: 'mod_voice_move', message: userId, data: { fromChannelId: oldState.channelId, toChannelId: newState.channelId } });
                } catch (e) { logger.debug('Caught error:', e?.message || e); }

                // Analytics
                if (newState.client.database) {
                    await newState.client.database.recordAnalytics(
                        guildId, 
                        'voice_channel_moved', 
                        1,
                        {
                            userId,
                            fromChannelId: oldState.channelId,
                            toChannelId: newState.channelId
                        }
                    );
                }
            }

            // Send socket event for dashboard if there was a meaningful change
            if (eventData && newState.client.socketManager) {
                newState.client.socketManager.onDiscordEvent('voiceStateUpdate', guildId, eventData);
            }

        } catch (error) {
            logger.error('Erro ao processar mudança de estado de voz:', error);
        }
    },
};
