const { mongoose } = require('./mongoose');

const TicketSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  guild_id: { type: String, index: true },
  channel_id: { type: String, index: true },
  user_id: String,
  category: String,
  subject: String,
  description: String,
  priority: { type: String, default: 'normal' },
  status: { type: String, default: 'open' },
  created_at: { type: Date, default: Date.now },
  assigned_to: { type: String, default: null },
  closed_at: Date,
  notes: { type: Array, default: [] },
  panel_message_id: String,
  locked: { type: Boolean, default: false }
}, { timestamps: true });

// Performance: Composite indexes para queries comuns
TicketSchema.index({ guild_id: 1, status: 1, created_at: -1 }); // Listar tickets por status
TicketSchema.index({ guild_id: 1, user_id: 1, status: 1 }); // Tickets de um user específico
TicketSchema.index({ guild_id: 1, assigned_to: 1, status: 1 }); // Tickets assignados a alguém
TicketSchema.index({ guild_id: 1, category: 1, status: 1 }); // Por categoria

const GuildConfigSchema = new mongoose.Schema({
  guild_id: { type: String, unique: true },
  data: { type: Object, default: {} }
}, { timestamps: true });

const PanelSchema = new mongoose.Schema({
  guild_id: { type: String, index: true },
  channel_id: { type: String, index: true },
  message_id: { type: String, index: true },
  type: { type: String, default: 'tickets' },
  theme: { type: String, default: 'dark' },
  template: { type: String, default: 'classic' },
  payload: { type: Object, default: null }
}, { timestamps: true });

const TicketModel = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);
const GuildConfigModel = mongoose.models.GuildConfig || mongoose.model('GuildConfig', GuildConfigSchema);
const PanelModel = mongoose.models.Panel || mongoose.model('Panel', PanelSchema);

// Webhooks por guild (tipos: logs, updates, tickets)
const WebhookSchema = new mongoose.Schema({
  guild_id: { type: String, index: true },
  type: { type: String, default: 'logs', index: true },
  name: { type: String },
  url: { type: String },
  channel_id: { type: String },
  channel_name: { type: String },
  enabled: { type: Boolean, default: true }
}, { timestamps: true });
const WebhookModel = mongoose.models.Webhook || mongoose.model('Webhook', WebhookSchema);

// Tags por utilizador (por guild)
const TagSchema = new mongoose.Schema({
  guild_id: { type: String, index: true },
  user_id: { type: String, index: true },
  tags: { type: [String], default: [] }
}, { timestamps: true });

const TagModel = mongoose.models.Tag || mongoose.model('Tag', TagSchema);
// Ticket action logs (lightweight)
const TicketLogSchema = new mongoose.Schema({
  ticket_id: { type: String, index: true },
  guild_id: { type: String, index: true },
  actor_id: { type: String },
  action: { type: String, index: true },
  message: { type: String },
  data: { type: Object, default: null },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const TicketLogModel = mongoose.models.TicketLog || mongoose.model('TicketLog', TicketLogSchema);

// Moderation: generic case (warn/mute/ban/kick/note)
const ModerationCaseSchema = new mongoose.Schema({
  guild_id: { type: String, index: true },
  user_id: { type: String, index: true },
  staff_id: { type: String, index: true },
  type: { type: String, enum: ['warn','mute','ban','kick','note'], index: true },
  reason: { type: String, default: '' },
  duration_ms: { type: Number, default: 0 },
  status: { type: String, enum: ['open','archived','closed'], default: 'open', index: true },
  data: { type: Object, default: {} },
  occurred_at: { type: Date, default: Date.now }
}, { timestamps: true });
const ModerationCaseModel = mongoose.models.ModerationCase || mongoose.model('ModerationCase', ModerationCaseSchema);

// Appeals for moderation cases
const AppealSchema = new mongoose.Schema({
  guild_id: { type: String, index: true },
  user_id: { type: String, index: true },
  case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ModerationCase', index: true },
  message: { type: String, default: '' },
  status: { type: String, enum: ['pending','accepted','rejected'], default: 'pending', index: true },
  staff_id: { type: String, default: null },
  staff_response: { type: String, default: '' }
}, { timestamps: true });
const AppealModel = mongoose.models.Appeal || mongoose.model('Appeal', AppealSchema);

// Internal notifications (dashboard)
const NotificationSchema = new mongoose.Schema({
  guild_id: { type: String, index: true },
  type: { type: String, index: true },
  message: { type: String, default: '' },
  data: { type: Object, default: {} },
  read: { type: Boolean, default: false }
}, { timestamps: true });
const NotificationModel = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

// Automoderation events
const AutomodEventSchema = new mongoose.Schema({
  guild_id: { type: String, index: true },
  user_id: { type: String, index: true },
  type: { type: String, enum: ['spam','flood','offensive','link','other'], index: true },
  message_id: { type: String },
  channel_id: { type: String },
  content: { type: String, default: '' },
  action: { type: String, enum: ['flag','mute','kick','ban','none'], default: 'flag' },
  resolved: { type: Boolean, default: false },
  resolved_by: { type: String, default: null },
  resolved_at: { type: Date, default: null }
}, { timestamps: true });
const AutomodEventModel = mongoose.models.AutomodEvent || mongoose.model('AutomodEvent', AutomodEventSchema);

module.exports = { TicketModel, GuildConfigModel, PanelModel, TagModel, WebhookModel, TicketLogModel, ModerationCaseModel, AppealModel, NotificationModel, AutomodEventModel };
