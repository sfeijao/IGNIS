const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    messageId: { type: String, unique: true, index: true },
    channelId: { type: String, required: true },

    title: { type: String, required: true },
    description: { type: String, required: true },

    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'implemented'],
        default: 'pending',
        index: true
    },

    votes: {
        upvotes: { type: [String], default: [] },
        downvotes: { type: [String], default: [] }
    },

    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: null },

    createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

module.exports = { Suggestion: mongoose.model('Suggestion', suggestionSchema) };
