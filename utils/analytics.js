// Simple analytics recorder (placeholder). Writes events to memory & optional Mongo collection if configured.
// Usage: recordAnalytics(eventName, payload)

let inMemory = [];
const MAX = 5000;

function recordAnalytics(event, payload){
  const row = { t: Date.now(), event: String(event), ...(payload||{}) };
  inMemory.push(row);
  if (inMemory.length > MAX) inMemory.splice(0, inMemory.length - MAX);
  // Optional: persist to Mongo if G_ANALYTICS_MONGO env enabled
  try {
    if ((process.env.GIVEAWAYS_ANALYTICS_PERSIST || '').toLowerCase() === 'mongo') {
      const mongoose = require('mongoose');
const logger = require('./logger');
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const model = getModel();
        model.create(row).catch(()=>{});
      }
    }
  } catch (e) { logger.debug('Caught error:', e?.message || e); }
}

let AnalyticsModel = null;
function getModel(){
  if (AnalyticsModel) return AnalyticsModel;
  try {
    const mongoose = require('mongoose');
    const schema = new mongoose.Schema({
      t: { type: Number, index: true },
      event: { type: String, index: true },
      guild_id: { type: String, index: true },
      giveaway_id: { type: String, index: true },
      winners: Number,
      count: Number
    }, { versionKey: false, collection: 'giveaway_analytics' });
    AnalyticsModel = mongoose.model('GiveawayAnalytics', schema);
  } catch (e) { logger.debug('Caught error:', e?.message || e); }
  return AnalyticsModel;
}

function getRecent(limit=100){
  return inMemory.slice(-Math.min(limit, inMemory.length));
}

module.exports = { recordAnalytics, getRecent };
