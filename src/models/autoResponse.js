const mongoose = require('mongoose');

const autoResponseSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },

    name: { type: String, required: true },
    triggers: [{ type: String, required: true }],
    response: { type: String, required: true },

    matchType: {
        type: String,
        enum: ['exact', 'contains', 'startsWith', 'endsWith', 'regex'],
        default: 'contains'
    },

    caseSensitive: { type: Boolean, default: false },

    cooldown: { type: Number, default: 0 },
    lastTriggered: { type: Map, of: Date, default: new Map() },

    channelIds: { type: [String], default: [] },
    roleIds: { type: [String], default: [] },

    enabled: { type: Boolean, default: true },

    stats: {
        totalTriggers: { type: Number, default: 0 },
        lastTriggeredAt: { type: Date, default: null }
    },

    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = { AutoResponse: mongoose.model('AutoResponse', autoResponseSchema) };
