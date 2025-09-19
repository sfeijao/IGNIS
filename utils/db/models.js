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
  panel_message_id: String
}, { timestamps: true });

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
  payload: { type: Object, default: null }
}, { timestamps: true });

const TicketModel = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);
const GuildConfigModel = mongoose.models.GuildConfig || mongoose.model('GuildConfig', GuildConfigSchema);
const PanelModel = mongoose.models.Panel || mongoose.model('Panel', PanelSchema);

// Tags por utilizador (por guild)
const TagSchema = new mongoose.Schema({
  guild_id: { type: String, index: true },
  user_id: { type: String, index: true },
  tags: { type: [String], default: [] }
}, { timestamps: true });

const TagModel = mongoose.models.Tag || mongoose.model('Tag', TagSchema);

module.exports = { TicketModel, GuildConfigModel, PanelModel, TagModel };
