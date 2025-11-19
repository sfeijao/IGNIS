const { mongoose } = require('../mongoose');

/**
 * TimeTrackingSession Model
 * 
 * Rastreia sessões de trabalho/atividade de membros (bate-ponto)
 * Suporta pausas, retomadas e cálculo de tempo total
 */
const TimeTrackingSessionSchema = new mongoose.Schema({
  guild_id: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  user_id: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  // Timestamps principais
  started_at: { 
    type: Date, 
    required: true, 
    default: Date.now 
  },
  
  ended_at: { 
    type: Date 
  },
  
  // Status da sessão
  status: { 
    type: String, 
    enum: ['active', 'paused', 'ended'],
    default: 'active',
    index: true
  },
  
  // Pausas durante a sessão
  pauses: [{
    paused_at: { 
      type: Date, 
      required: true 
    },
    resumed_at: { 
      type: Date 
    },
    duration_ms: { 
      type: Number 
    }, // Calculado quando resumed_at é definido
    reason: { 
      type: String 
    }
  }],
  
  // Tempo total (calculado)
  total_time_ms: { 
    type: Number, 
    default: 0 
  },
  
  active_time_ms: { 
    type: Number, 
    default: 0 
  }, // Tempo total - pausas
  
  // Message ID do painel de controle
  control_message_id: { 
    type: String 
  },
  
  control_channel_id: { 
    type: String 
  },
  
  // Metadata
  notes: { 
    type: String 
  },
  
  tags: [{ 
    type: String 
  }], // Ex: 'development', 'moderation', 'support'
  
  created_by: { 
    type: String 
  },
  
  ended_by: { 
    type: String 
  },
  
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  
  updated_at: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  } 
});

// Indexes compostos para queries eficientes
TimeTrackingSessionSchema.index({ guild_id: 1, user_id: 1 });
TimeTrackingSessionSchema.index({ guild_id: 1, status: 1 });
TimeTrackingSessionSchema.index({ guild_id: 1, user_id: 1, status: 1 });
TimeTrackingSessionSchema.index({ guild_id: 1, started_at: -1 });
TimeTrackingSessionSchema.index({ user_id: 1, started_at: -1 });

// Métodos de instância
TimeTrackingSessionSchema.methods.pause = function(reason = null) {
  if (this.status !== 'active') {
    throw new Error('Session is not active');
  }

  this.pauses.push({
    paused_at: new Date(),
    resumed_at: null,
    reason
  });

  this.status = 'paused';
  return this.save();
};

TimeTrackingSessionSchema.methods.resume = function() {
  if (this.status !== 'paused') {
    throw new Error('Session is not paused');
  }

  // Encontrar última pausa não finalizada
  const lastPause = this.pauses[this.pauses.length - 1];
  
  if (!lastPause || lastPause.resumed_at) {
    throw new Error('No active pause found');
  }

  lastPause.resumed_at = new Date();
  lastPause.duration_ms = lastPause.resumed_at - lastPause.paused_at;

  this.status = 'active';
  return this.save();
};

TimeTrackingSessionSchema.methods.end = function(endedBy = null) {
  if (this.status === 'ended') {
    throw new Error('Session already ended');
  }

  // Se estava pausada, finalizar a pausa primeiro
  if (this.status === 'paused') {
    const lastPause = this.pauses[this.pauses.length - 1];
    if (lastPause && !lastPause.resumed_at) {
      lastPause.resumed_at = new Date();
      lastPause.duration_ms = lastPause.resumed_at - lastPause.paused_at;
    }
  }

  this.ended_at = new Date();
  this.status = 'ended';
  this.ended_by = endedBy;

  // Calcular tempos totais
  this.calculateTotalTime();

  return this.save();
};

TimeTrackingSessionSchema.methods.calculateTotalTime = function() {
  if (!this.ended_at) {
    // Se ainda ativa, calcular até agora
    this.total_time_ms = Date.now() - this.started_at.getTime();
  } else {
    this.total_time_ms = this.ended_at.getTime() - this.started_at.getTime();
  }

  // Calcular tempo em pausa
  const totalPauseTime = this.pauses.reduce((total, pause) => {
    if (pause.duration_ms) {
      return total + pause.duration_ms;
    }
    return total;
  }, 0);

  this.active_time_ms = this.total_time_ms - totalPauseTime;
  
  return this;
};

TimeTrackingSessionSchema.methods.getCurrentDuration = function() {
  const endTime = this.ended_at ? this.ended_at.getTime() : Date.now();
  const totalMs = endTime - this.started_at.getTime();

  const totalPauseMs = this.pauses.reduce((total, pause) => {
    if (pause.duration_ms) {
      return total + pause.duration_ms;
    } else if (pause.paused_at && !pause.resumed_at) {
      // Pausa ativa
      return total + (Date.now() - pause.paused_at.getTime());
    }
    return total;
  }, 0);

  return {
    total_ms: totalMs,
    active_ms: totalMs - totalPauseMs,
    paused_ms: totalPauseMs,
    total_formatted: this.formatDuration(totalMs),
    active_formatted: this.formatDuration(totalMs - totalPauseMs),
    paused_formatted: this.formatDuration(totalPauseMs)
  };
};

TimeTrackingSessionSchema.methods.formatDuration = function(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const h = hours;
  const m = minutes % 60;
  const s = seconds % 60;

  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  } else if (m > 0) {
    return `${m}m ${s}s`;
  } else {
    return `${s}s`;
  }
};

TimeTrackingSessionSchema.methods.isActive = function() {
  return this.status === 'active';
};

TimeTrackingSessionSchema.methods.isPaused = function() {
  return this.status === 'paused';
};

TimeTrackingSessionSchema.methods.isEnded = function() {
  return this.status === 'ended';
};

// Métodos estáticos
TimeTrackingSessionSchema.statics.findActiveSession = function(guildId, userId) {
  return this.findOne({ 
    guild_id: guildId, 
    user_id: userId, 
    status: { $in: ['active', 'paused'] } 
  });
};

TimeTrackingSessionSchema.statics.findUserSessions = function(guildId, userId, limit = 10) {
  return this.find({ 
    guild_id: guildId, 
    user_id: userId 
  })
    .sort({ started_at: -1 })
    .limit(limit);
};

TimeTrackingSessionSchema.statics.findGuildSessions = function(guildId, startDate = null, endDate = null) {
  const query = { guild_id: guildId };
  
  if (startDate || endDate) {
    query.started_at = {};
    if (startDate) query.started_at.$gte = startDate;
    if (endDate) query.started_at.$lte = endDate;
  }
  
  return this.find(query).sort({ started_at: -1 });
};

TimeTrackingSessionSchema.statics.getGuildStats = async function(guildId, startDate = null, endDate = null) {
  const query = { 
    guild_id: guildId,
    status: 'ended'
  };
  
  if (startDate || endDate) {
    query.started_at = {};
    if (startDate) query.started_at.$gte = startDate;
    if (endDate) query.started_at.$lte = endDate;
  }
  
  const sessions = await this.find(query);
  
  const totalSessions = sessions.length;
  const totalTime = sessions.reduce((sum, s) => sum + s.total_time_ms, 0);
  const totalActiveTime = sessions.reduce((sum, s) => sum + s.active_time_ms, 0);
  
  const userStats = {};
  sessions.forEach(session => {
    if (!userStats[session.user_id]) {
      userStats[session.user_id] = {
        sessions: 0,
        total_time_ms: 0,
        active_time_ms: 0
      };
    }
    userStats[session.user_id].sessions++;
    userStats[session.user_id].total_time_ms += session.total_time_ms;
    userStats[session.user_id].active_time_ms += session.active_time_ms;
  });
  
  return {
    total_sessions: totalSessions,
    total_time_ms: totalTime,
    total_active_time_ms: totalActiveTime,
    avg_session_time_ms: totalSessions > 0 ? totalTime / totalSessions : 0,
    user_stats: userStats
  };
};

const TimeTrackingSessionModel = mongoose.models.TimeTrackingSession || 
  mongoose.model('TimeTrackingSession', TimeTrackingSessionSchema);

module.exports = { TimeTrackingSessionModel };
