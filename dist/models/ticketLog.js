"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketLogModel = void 0;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mongoose } = require('../../utils/db/mongoose');
const TicketLogSchema = new mongoose.Schema({
    ticketId: { type: String, index: true },
    guildId: { type: String, index: true },
    byUserId: { type: String, index: true },
    action: { type: String, index: true },
    payload: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: false });
exports.TicketLogModel = mongoose.models.TicketLogTS || mongoose.model('TicketLogTS', TicketLogSchema);
