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

// ✨ NOVO: Schema para categorias customizáveis de tickets
const TicketCategorySchema = new mongoose.Schema({
  guild_id: { type: String, required: true, index: true },
  name: { type: String, required: true }, // Nome da categoria (ex: "Suporte Técnico")
  emoji: { type: String, default: '📩' }, // Emoji opcional
  description: { type: String }, // Descrição opcional
  color: { type: Number, default: 0x7C3AED }, // Cor do embed
  order: { type: Number, default: 0 }, // Ordem de exibição
  enabled: { type: Boolean, default: true }, // Ativa/desativa
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: true });

// Index composto para queries eficientes
TicketCategorySchema.index({ guild_id: 1, order: 1 });
TicketCategorySchema.index({ guild_id: 1, enabled: 1, order: 1 });

const TicketCategoryModel = mongoose.models.TicketCategory || mongoose.model('TicketCategory', TicketCategorySchema);

// ✨ NOVO: Schema para sistema de boas-vindas e saídas
const WelcomeConfigSchema = new mongoose.Schema({
  guild_id: { type: String, required: true, unique: true, index: true },
  welcome: {
    enabled: { type: Boolean, default: false },
    channel_id: { type: String },
    message: { type: String, default: 'Bem-vindo {user} ao **{server}**!' },
    embed: {
      enabled: { type: Boolean, default: true },
      title: { type: String, default: '👋 Bem-vindo!' },
      description: { type: String, default: 'Olá {user}, bem-vindo ao **{server}**!\n\nSomos agora **{memberCount}** membros! 🎉' },
      color: { type: Number, default: 0x10B981 }, // Verde
      thumbnail: { type: String }, // URL ou {user.avatar}, {server.icon}
      image: { type: String }, // URL do banner
      footer: { type: String, default: 'Conta criada' },
      show_footer_timestamp: { type: Boolean, default: true }
    }
  },
  goodbye: {
    enabled: { type: Boolean, default: false },
    channel_id: { type: String },
    message: { type: String, default: '👋 **{user.tag}** saiu do servidor.' },
    embed: {
      enabled: { type: Boolean, default: true },
      title: { type: String, default: '👋 Adeus!' },
      description: { type: String, default: '**{user.tag}** saiu do servidor.\n\nAgora somos **{memberCount}** membros.' },
      color: { type: Number, default: 0xEF4444 }, // Vermelho
      thumbnail: { type: String },
      image: { type: String },
      footer: { type: String, default: 'Membro desde' },
      show_footer_timestamp: { type: Boolean, default: true }
    }
  },
  server_stats: {
    enabled: { type: Boolean, default: false },
    category_id: { type: String },
    channels: {
      total_members: { type: String },
      humans: { type: String },
      bots: { type: String },
      boosters: { type: String },
      online: { type: String }
    },
    update_interval: { type: Number, default: 10 } // minutos
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: true });

const WelcomeConfigModel = mongoose.models.WelcomeConfig || mongoose.model('WelcomeConfig', WelcomeConfigSchema);

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

module.exports = { 
  TicketModel, 
  GuildConfigModel, 
  PanelModel, 
  TagModel, 
  WebhookModel, 
  TicketLogModel, 
  ModerationCaseModel, 
  AppealModel, 
  NotificationModel, 
  AutomodEventModel,
  TicketCategoryModel, // ✨ NOVO
  WelcomeConfigModel // ✨ NOVO - Welcome/Goodbye system
};
