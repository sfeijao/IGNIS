const mongoose = require('mongoose');

const scheduledAnnouncementSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    
    title: { type: String, required: true },
    message: { type: String, required: true },
    
    embed: {
        enabled: { type: Boolean, default: true },
        color: { type: String, default: '#5865F2' },
        thumbnail: { type: String, default: null },
        image: { type: String, default: null },
        footer: { type: String, default: null }
    },
    
    channelId: { type: String, required: true },
    scheduledFor: { type: Date, required: true, index: true },
    
    repeat: {
        enabled: { type: Boolean, default: false },
        interval: { type: String, enum: ['daily', 'weekly', 'monthly'], default: null },
        endDate: { type: Date, default: null }
    },
    
    mentions: {
        everyone: { type: Boolean, default: false },
        here: { type: Boolean, default: false },
        roles: [{ type: String }]
    },
    
    status: {
        type: String,
        enum: ['pending', 'sent', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    
    sentAt: { type: Date, default: null },
    errorMessage: { type: String, default: null },
    
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = { ScheduledAnnouncement: mongoose.model('ScheduledAnnouncement', scheduledAnnouncementSchema) };
