const { mongoose } = require('./mongoose');

// Giveaway core schema
// Represents a single giveaway lifecycle: draft -> scheduled(optional) -> active -> ended/cancelled
const GiveawaySchema = new mongoose.Schema({
  guild_id: { type: String, required: true },
  channel_id: { type: String, index: true },
  message_id: { type: String, index: true }, // Discord message once published
  title: { type: String, required: true, maxlength: 150 },
  description: { type: String, default: '', maxlength: 2000 },
  banner_url: { type: String, default: '' },
  icon_emoji: { type: String, default: '🎉' },
  method: { type: String, enum: ['reaction','button','command'], default: 'reaction', index: true },
  status: { type: String, enum: ['draft','scheduled','active','ended','cancelled'], default: 'draft', index: true },
  winners_count: { type: Number, default: 1, min: 1 },
  // Scheduling & duration
  scheduled_at: { type: Date }, // when to publish (optional)
  starts_at: { type: Date, index: true }, // actual start time
  ends_at: { type: Date }, // planned end time
  ended_at: { type: Date }, // actual end time (after selection)
  cancelled_at: { type: Date },
  created_by: { type: String, index: true }, // staff user id
  created_at: { type: Date, default: Date.now },
  // Runtime counters
  entries_count: { type: Number, default: 0 },
  winners_announced: { type: Boolean, default: false },
  lock_version: { type: Number, default: 0 }, // optimistic concurrency for selection process
  // Rules & options
  rules: {
    roles_required: { type: [String], default: [] },
    min_join_duration_ms: { type: Number, default: 0 },
    locale_allow: { type: [String], default: [] },
    entrants_cap: { type: Number, default: 0 }, // 0 == no cap
    weight_roles: { type: Object, default: {} } // roleId -> weight multiplier
  },
  options: {
    allow_reroll: { type: Boolean, default: true },
    auto_pin: { type: Boolean, default: false },
    allow_manual_pick: { type: Boolean, default: true },
    multi_prizes: { type: [String], default: [] }, // e.g. ["Nitro", "VIP"]
    dm_winners: { type: Boolean, default: false },
    live_update_interval_minutes: { type: Number, default: 0 } // >0 enables periodic message edits
  },
  announcement_markdown: { type: String, default: '' }, // WYSIWYG/markdown content
  fair_rng_seed: { type: String, default: '' }, // stored seed used for winner selection transparency
  audit: {
    last_action_by: { type: String },
    last_action_at: { type: Date }
  },
  last_live_update_at: { type: Date }
}, { timestamps: true });

// Ensure logical constraints
GiveawaySchema.index({ guild_id: 1, status: 1 });
GiveawaySchema.index({ guild_id: 1, ends_at: 1 });
GiveawaySchema.index({ guild_id: 1, scheduled_at: 1 });

// Entries: one row per distinct user participation (weight can derive from roles or tasks)
const GiveawayEntrySchema = new mongoose.Schema({
  giveaway_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Giveaway', index: true, required: true },
  guild_id: { type: String, required: true },
  user_id: { type: String, required: true },
  username: { type: String, default: '' }, // snapshot for export convenience
  joined_at: { type: Date, default: Date.now },
  method: { type: String, enum: ['reaction','button','command'], default: 'reaction' },
  weight: { type: Number, default: 1, min: 0 }, // expanded into ticket pool during selection
  flags: {
    is_bot: { type: Boolean, default: false },
    suspicious_alt: { type: Boolean, default: false }
  }
}, { timestamps: true });
GiveawayEntrySchema.index({ giveaway_id: 1, user_id: 1 }, { unique: true }); // Deduplicate entrants
GiveawayEntrySchema.index({ guild_id: 1, user_id: 1 });

// Winners history: stores initial pick and rerolls (reroll_of references previous winner)
const GiveawayWinnerSchema = new mongoose.Schema({
  giveaway_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Giveaway', index: true, required: true },
  guild_id: { type: String, index: true, required: true },
  user_id: { type: String, index: true, required: true },
  picked_at: { type: Date, default: Date.now },
  reroll_of: { type: mongoose.Schema.Types.ObjectId, ref: 'GiveawayWinner', default: null },
  prize: { type: String, default: '' }, // for multi-prize mapping
  method: { type: String, enum: ['initial','reroll','manual'], default: 'initial' }
}, { timestamps: true });
GiveawayWinnerSchema.index({ giveaway_id: 1, user_id: 1 });

// Action log for audit trail (creation, edit, end, reroll, manual-pick, cancel)
const GiveawayLogSchema = new mongoose.Schema({
  giveaway_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Giveaway', index: true, required: true },
  guild_id: { type: String, index: true, required: true },
  actor_id: { type: String },
  action: { type: String, index: true },
  payload: { type: Object, default: {} },
  occurred_at: { type: Date, default: Date.now }
}, { timestamps: true });
GiveawayLogSchema.index({ giveaway_id: 1, action: 1 });

const GiveawayModel = mongoose.models.Giveaway || mongoose.model('Giveaway', GiveawaySchema);
const GiveawayEntryModel = mongoose.models.GiveawayEntry || mongoose.model('GiveawayEntry', GiveawayEntrySchema);
const GiveawayWinnerModel = mongoose.models.GiveawayWinner || mongoose.model('GiveawayWinner', GiveawayWinnerSchema);
const GiveawayLogModel = mongoose.models.GiveawayLog || mongoose.model('GiveawayLog', GiveawayLogSchema);

module.exports = {
  GiveawayModel,
  GiveawayEntryModel,
  GiveawayWinnerModel,
  GiveawayLogModel
};
