const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    
    title: { type: String, required: true },
    description: { type: String, required: true },
    
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, default: null },
    
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    
    participants: [{ type: String }],
    maxParticipants: { type: Number, default: null },
    
    reminders: [{
        time: { type: Number, required: true },
        sent: { type: Boolean, default: false }
    }],
    
    imageUrl: { type: String, default: null },
    
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = { Event: mongoose.model('Event', eventSchema) };
