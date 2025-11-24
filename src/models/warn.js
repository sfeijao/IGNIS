const mongoose = require('mongoose');

const warnSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    moderatorId: { type: String, required: true },
    
    reason: { type: String, required: true },
    level: { type: Number, default: 1, min: 1, max: 5 }, // 1-5 severity
    
    // Auto-punição
    punishment: {
        type: String,
        enum: ['none', 'mute', 'kick', 'tempban', 'ban'],
        default: 'none'
    },
    punishmentDuration: { type: Number, default: null }, // em minutos
    
    // Status
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    revokedBy: { type: String, default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    
    createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

warnSchema.index({ guildId: 1, userId: 1, active: 1 });
warnSchema.index({ guildId: 1, expiresAt: 1 });

const Warn = mongoose.model('Warn', warnSchema);
module.exports = { Warn };
