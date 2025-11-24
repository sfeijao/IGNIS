const mongoose = require('mongoose');

/**
 * Anti-Raid Configuration Schema
 * Configurações de proteção contra raids para cada servidor
 */
const antiRaidConfigSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Status do sistema
    enabled: {
        type: Boolean,
        default: false
    },
    
    // Sensibilidade (low, medium, high, paranoid)
    sensitivity: {
        type: String,
        enum: ['low', 'medium', 'high', 'paranoid'],
        default: 'medium'
    },
    
    // Limites de detecção
    thresholds: {
        // Máximo de joins por minuto antes de alertar
        joinsPerMinute: {
            type: Number,
            default: 10
        },
        // Máximo de joins em 5 minutos
        joinsPerFiveMinutes: {
            type: Number,
            default: 30
        },
        // Idade mínima da conta (em dias)
        minimumAccountAge: {
            type: Number,
            default: 7
        },
        // Similaridade de usernames (% de usernames similares para alertar)
        usernameSimilarity: {
            type: Number,
            default: 70 // 70%
        }
    },
    
    // Ações automáticas
    actions: {
        // Kickar automaticamente membros suspeitos
        autoKick: {
            type: Boolean,
            default: false
        },
        // Banir automaticamente em raids severos
        autoBan: {
            type: Boolean,
            default: false
        },
        // Colocar em quarentena (remover permissões)
        quarantine: {
            type: Boolean,
            default: true
        },
        // Ativar verificação CAPTCHA
        enableCaptcha: {
            type: Boolean,
            default: false
        }
    },
    
    // Role de quarentena
    quarantineRoleId: {
        type: String,
        default: null
    },
    
    // Canal de logs de raid
    logChannelId: {
        type: String,
        default: null
    },
    
    // Webhook para alertas críticos
    alertWebhook: {
        type: String,
        default: null
    },
    
    // Whitelist de usuários (IDs que nunca serão afetados)
    whitelist: [{
        type: String
    }],
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

/**
 * Raid Event Schema
 * Registra eventos de raid detectados
 */
const raidEventSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    
    // Status do raid
    status: {
        type: String,
        enum: ['active', 'resolved', 'false_alarm'],
        default: 'active',
        index: true
    },
    
    // Severidade (low, medium, high, critical)
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    
    // Momento de início
    startedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // Momento de resolução
    resolvedAt: {
        type: Date,
        default: null
    },
    
    // Estatísticas do raid
    stats: {
        totalJoins: {
            type: Number,
            default: 0
        },
        suspiciousJoins: {
            type: Number,
            default: 0
        },
        actionsKicked: {
            type: Number,
            default: 0
        },
        actionsBanned: {
            type: Number,
            default: 0
        },
        actionsQuarantined: {
            type: Number,
            default: 0
        }
    },
    
    // Indicadores de raid detectados
    indicators: [{
        type: {
            type: String,
            enum: ['mass_join', 'new_accounts', 'similar_usernames', 'no_avatar', 'rapid_succession']
        },
        count: Number,
        timestamp: Date
    }],
    
    // Membros envolvidos (IDs)
    memberIds: [{
        type: String
    }],
    
    // Nota do staff
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Índice composto para queries eficientes
raidEventSchema.index({ guildId: 1, status: 1, startedAt: -1 });

/**
 * Suspicious Member Schema
 * Membros suspeitos detectados durante raids
 */
const suspiciousMemberSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    
    // Dados do membro
    username: String,
    discriminator: String,
    accountCreatedAt: Date,
    joinedAt: {
        type: Date,
        default: Date.now
    },
    
    // Idade da conta em dias ao entrar
    accountAgeInDays: Number,
    
    // Flags de suspeita
    flags: [{
        type: String,
        enum: [
            'new_account',
            'no_avatar',
            'similar_username',
            'mass_join_pattern',
            'rapid_join',
            'suspicious_name'
        ]
    }],
    
    // Ação tomada
    actionTaken: {
        type: String,
        enum: ['none', 'quarantine', 'kick', 'ban'],
        default: 'none'
    },
    
    // ID do evento de raid relacionado
    raidEventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RaidEvent',
        default: null
    },
    
    // Se ainda está no servidor
    isInGuild: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Índice composto
suspiciousMemberSchema.index({ guildId: 1, userId: 1 }, { unique: true });
suspiciousMemberSchema.index({ guildId: 1, actionTaken: 1 });

const AntiRaidConfig = mongoose.model('AntiRaidConfig', antiRaidConfigSchema);
const RaidEvent = mongoose.model('RaidEvent', raidEventSchema);
const SuspiciousMember = mongoose.model('SuspiciousMember', suspiciousMemberSchema);

module.exports = {
    AntiRaidConfig,
    RaidEvent,
    SuspiciousMember
};
