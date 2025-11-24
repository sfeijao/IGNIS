const mongoose = require('mongoose');

const staffActionSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    staffId: { type: String, required: true, index: true },
    
    actionType: {
        type: String,
        enum: ['warn', 'mute', 'unmute', 'kick', 'ban', 'unban', 'timeout', 'untimeout', 'ticket_close', 'ticket_delete'],
        required: true
    },
    
    targetId: { type: String, required: true },
    reason: { type: String, default: 'Não especificado' },
    
    metadata: {
        duration: { type: Number, default: null },
        warnLevel: { type: Number, default: null },
        ticketId: { type: String, default: null }
    },
    
    timestamp: { type: Date, default: Date.now, index: true }
});

module.exports = { StaffAction: mongoose.model('StaffAction', staffActionSchema) };
