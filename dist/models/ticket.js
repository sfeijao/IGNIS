"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketModel = void 0;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mongoose } = require('../../utils/db/mongoose');
const TicketSchema = new mongoose.Schema({
    guildId: { type: String, index: true },
    channelId: { type: String, index: true },
    messageId: { type: String },
    ownerId: { type: String, index: true },
    category: { type: String },
    status: { type: String, enum: ['open', 'closed', 'archived', 'cancelled'], default: 'open', index: true },
    staffAssigned: { type: String, default: null },
    notes: { type: Array, default: [] },
    meta: { type: Object, default: {} }
}, { timestamps: true });
exports.TicketModel = mongoose.models.TicketTS || mongoose.model('TicketTS', TicketSchema);
