const { mongoose } = require('../mongoose');

/**
 * GiveawayClaim Model
 * 
 * Gerencia o processo de reclamação de prêmios de giveaways:
 * - Quando um giveaway termina, um ticket é aberto para o vencedor
 * - O vencedor tem 48h para responder no ticket
 * - Se não responder, o prêmio é re-sorteado automaticamente
 * - Histórico completo de reclamações e re-rolls
 */
const GiveawayClaimSchema = new mongoose.Schema({
  // Referências
  giveaway_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Giveaway', 
    index: true, 
    required: true 
  },
  guild_id: { 
    type: String, 
    required: true 
  },
  winner_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'GiveawayWinner', 
    index: true, 
    required: true 
  },
  user_id: { 
    type: String, 
    index: true, 
    required: true 
  },
  
  // Ticket de reclamação
  ticket_channel_id: { 
    type: String 
  },
  ticket_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ticket' 
  },
  ticket_created_at: { 
    type: Date 
  },
  
  // Timelines
  claim_deadline_at: { 
    type: Date, 
    index: true, 
    required: true 
  }, // ticket_created_at + 48h
  claimed_at: { 
    type: Date, 
    index: true 
  }, // null até ser reclamado
  first_response_at: { 
    type: Date 
  }, // primeira mensagem do vencedor no ticket
  
  // Status do processo
  status: { 
    type: String, 
    enum: ['pending', 'claimed', 'unclaimed', 're-rolled', 'cancelled'], 
    default: 'pending',
    index: true 
  },
  
  // Re-roll tracking
  previous_claim_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'GiveawayClaim' 
  }, // se for re-roll, referência ao claim anterior
  reroll_count: { 
    type: Number, 
    default: 0 
  }, // quantos re-rolls já aconteceram nesta chain
  
  // Notificações
  notifications_sent: {
    ticket_opened: { type: Boolean, default: false },
    reminder_24h: { type: Boolean, default: false },
    reminder_6h: { type: Boolean, default: false },
    deadline_passed: { type: Boolean, default: false },
    prize_claimed: { type: Boolean, default: false }
  },
  
  // Metadata
  prize_description: { 
    type: String, 
    default: '' 
  },
  claim_message: { 
    type: String 
  }, // mensagem do vencedor que confirmou
  notes: { 
    type: String, 
    default: '' 
  }, // notas do staff
  
  // Audit
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  },
  processed_by_job: { 
    type: Boolean, 
    default: false 
  }, // flag para job processor
  job_last_check_at: { 
    type: Date 
  }
}, { 
  timestamps: true 
});

// Indexes compostos para queries eficientes
GiveawayClaimSchema.index({ giveaway_id: 1, status: 1 });
GiveawayClaimSchema.index({ guild_id: 1, status: 1 });
GiveawayClaimSchema.index({ claim_deadline_at: 1, status: 1 }); // para job de deadlines
GiveawayClaimSchema.index({ ticket_channel_id: 1 });
GiveawayClaimSchema.index({ status: 1, processed_by_job: 1 }); // para job processor

// Métodos de instância
GiveawayClaimSchema.methods.markAsClaimed = async function(claimMessage = '') {
  this.status = 'claimed';
  this.claimed_at = new Date();
  this.claim_message = claimMessage;
  this.notifications_sent.prize_claimed = true;
  this.updated_at = new Date();
  return this.save();
};

GiveawayClaimSchema.methods.markAsUnclaimed = async function() {
  this.status = 'unclaimed';
  this.notifications_sent.deadline_passed = true;
  this.updated_at = new Date();
  return this.save();
};

GiveawayClaimSchema.methods.isDeadlinePassed = function() {
  return new Date() > this.claim_deadline_at;
};

GiveawayClaimSchema.methods.isPending = function() {
  return this.status === 'pending' && !this.isDeadlinePassed();
};

GiveawayClaimSchema.methods.shouldSendReminder24h = function() {
  if (this.notifications_sent.reminder_24h) return false;
  const now = new Date();
  const twentyFourHoursBeforeDeadline = new Date(this.claim_deadline_at.getTime() - 24 * 60 * 60 * 1000);
  return now >= twentyFourHoursBeforeDeadline && now < this.claim_deadline_at;
};

GiveawayClaimSchema.methods.shouldSendReminder6h = function() {
  if (this.notifications_sent.reminder_6h) return false;
  const now = new Date();
  const sixHoursBeforeDeadline = new Date(this.claim_deadline_at.getTime() - 6 * 60 * 60 * 1000);
  return now >= sixHoursBeforeDeadline && now < this.claim_deadline_at;
};

// Métodos estáticos
GiveawayClaimSchema.statics.findPendingClaims = function() {
  return this.find({ 
    status: 'pending',
    claim_deadline_at: { $gte: new Date() }
  }).sort({ claim_deadline_at: 1 });
};

GiveawayClaimSchema.statics.findExpiredClaims = function() {
  return this.find({ 
    status: 'pending',
    claim_deadline_at: { $lt: new Date() },
    processed_by_job: false
  }).sort({ claim_deadline_at: 1 });
};

GiveawayClaimSchema.statics.findClaimsNeedingReminders = function() {
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  
  return this.find({
    status: 'pending',
    claim_deadline_at: { $gte: now },
    $or: [
      { 
        'notifications_sent.reminder_24h': false,
        claim_deadline_at: { $lte: twentyFourHoursFromNow }
      },
      { 
        'notifications_sent.reminder_6h': false,
        claim_deadline_at: { $lte: sixHoursFromNow }
      }
    ]
  });
};

// Pre-save middleware
GiveawayClaimSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const GiveawayClaimModel = mongoose.models.GiveawayClaim || 
  mongoose.model('GiveawayClaim', GiveawayClaimSchema);

module.exports = { GiveawayClaimModel };
