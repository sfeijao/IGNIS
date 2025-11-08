import type { Document, Model } from 'mongoose';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mongoose } = require('../../utils/db/mongoose');

export type TicketStatus = 'open' | 'closed' | 'archived' | 'cancelled';

export interface ITicket extends Document {
  guildId: string;
  channelId: string;
  messageId?: string; // painel
  ownerId: string;
  category?: string;
  status: TicketStatus;
  staffAssigned?: string | null;
  notes: Array<{ by: string; text: string; createdAt: Date }>;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new mongoose.Schema({
  guildId: { type: String, index: true },
  channelId: { type: String, index: true },
  messageId: { type: String },
  ownerId: { type: String, index: true },
  category: { type: String },
  status: { type: String, enum: ['open','closed','archived','cancelled'], default: 'open', index: true },
  staffAssigned: { type: String, default: null },
  notes: { type: Array, default: [] },
  meta: { type: Object, default: {} }
}, { timestamps: true });

export const TicketModel: Model<ITicket> = mongoose.models.TicketTS || mongoose.model('TicketTS', TicketSchema);
