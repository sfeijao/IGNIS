import type { Document, Model } from 'mongoose';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mongoose } = require('../../utils/db/mongoose');

export interface ITicketLog extends Document {
  ticketId: string;
  guildId: string;
  byUserId: string;
  action: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
}

const TicketLogSchema = new mongoose.Schema({
  ticketId: { type: String, index: true },
  guildId: { type: String, index: true },
  byUserId: { type: String, index: true },
  action: { type: String, index: true },
  payload: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false });

export const TicketLogModel: Model<ITicketLog> = mongoose.models.TicketLogTS || mongoose.model('TicketLogTS', TicketLogSchema);
