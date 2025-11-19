/**
 * GenericKV Model
 * Simple key-value storage for temporary data and locks
 */

const mongoose = require('mongoose');

const genericKVSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  // TTL index: auto-delete documents after 1 hour
  expires_at: {
    type: Date,
    default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    index: { expires: 0 } // TTL index
  }
}, {
  timestamps: false,
  collection: 'generickv'
});

// Update updated_at on save
genericKVSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const GenericKVModel = mongoose.model('GenericKV', genericKVSchema);

module.exports = { GenericKVModel };
