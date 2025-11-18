const { mongoose } = require('./mongoose');

// Time Tracking Schema
const TimeTrackingSchema = new mongoose.Schema({
  guild_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  message_id: { type: String, index: true },
  channel_id: { type: String },
  started_at: { type: Date, required: true },
  ended_at: { type: Date },
  status: { type: String, enum: ['active', 'paused', 'ended'], default: 'active' },
  pauses: [{
    started: { type: Date },
    ended: { type: Date }
  }],
  total_time: { type: Number, default: 0 }, // milliseconds
  created_at: { type: Date, default: Date.now }
});

TimeTrackingSchema.index({ guild_id: 1, user_id: 1, status: 1 });
TimeTrackingSchema.index({ guild_id: 1, status: 1, started_at: -1 });

const TimeTrackingModel = mongoose.models.TimeTracking || mongoose.model('TimeTracking', TimeTrackingSchema);

module.exports = { TimeTrackingModel };
