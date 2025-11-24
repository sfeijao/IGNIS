const mongoose = require('mongoose');

/**
 * Invite Tracker Schema - Rastreia convites e detecta fake invites
 *
 * Campos:
 * - inviteCode: Código do convite (ex: "abc123")
 * - guildId: ID do servidor Discord
 * - inviterId: ID do usuário que criou o convite
 * - channelId: ID do canal do convite
 * - uses: Número de usos atuais
 * - maxUses: Número máximo de usos (0 = ilimitado)
 * - maxAge: Tempo de expiração em segundos (0 = sem expiração)
 * - temporary: Se os membros recebem role temporária
 * - createdAt: Data de criação do convite
 * - expiresAt: Data de expiração calculada
 * - isActive: Se o convite ainda está ativo
 *
 * Métricas:
 * - totalJoins: Total de membros que entraram
 * - validJoins: Membros que ficaram (não saíram)
 * - fakeJoins: Membros suspeitos (saíram rápido, conta nova, etc)
 * - leftJoins: Membros que saíram depois de entrar
 */
const inviteTrackerSchema = new mongoose.Schema({
    inviteCode: {
        type: String,
        required: true,
        index: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    inviterId: {
        type: String,
        required: true,
        index: true
    },
    channelId: {
        type: String,
        required: true
    },

    // Configurações do convite
    uses: {
        type: Number,
        default: 0
    },
    maxUses: {
        type: Number,
        default: 0 // 0 = ilimitado
    },
    maxAge: {
        type: Number,
        default: 0 // 0 = sem expiração
    },
    temporary: {
        type: Boolean,
        default: false
    },

    // Métricas
    totalJoins: {
        type: Number,
        default: 0
    },
    validJoins: {
        type: Number,
        default: 0
    },
    fakeJoins: {
        type: Number,
        default: 0
    },
    leftJoins: {
        type: Number,
        default: 0
    },

    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    expiresAt: {
        type: Date,
        default: null
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Índice composto para queries eficientes
inviteTrackerSchema.index({ guildId: 1, inviteCode: 1 }, { unique: true });
inviteTrackerSchema.index({ guildId: 1, inviterId: 1 });
inviteTrackerSchema.index({ guildId: 1, isActive: 1 });

/**
 * Member Join Log Schema - Registra cada membro que entrou
 *
 * Detecta fake invites baseado em:
 * - Tempo no servidor (saiu < 1 hora = suspeito)
 * - Idade da conta (< 7 dias = suspeito)
 * - Padrão de comportamento (sem interação = suspeito)
 */
const memberJoinSchema = new mongoose.Schema({
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
    inviteCode: {
        type: String,
        required: true,
        index: true
    },
    inviterId: {
        type: String,
        required: true
    },

    // Informações do membro
    username: String,
    discriminator: String,
    accountCreatedAt: Date,

    // Timestamps
    joinedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    leftAt: {
        type: Date,
        default: null
    },

    // Métricas de detecção
    accountAgeAtJoin: {
        type: Number, // em dias
        default: 0
    },
    timeInServer: {
        type: Number, // em horas
        default: null
    },

    // Status
    isFake: {
        type: Boolean,
        default: false
    },
    fakeReason: {
        type: String,
        enum: [
            'quick_leave',      // Saiu em menos de 1 hora
            'new_account',      // Conta criada há menos de 7 dias
            'no_interaction',   // Sem mensagens/interação
            'mass_join',        // Vários membros do mesmo invite em curto período
            'combined'          // Múltiplas razões
        ],
        default: null
    },
    hasLeft: {
        type: Boolean,
        default: false,
        index: true
    },

    // Métricas de atividade (opcional - pode ser preenchido por outros sistemas)
    messageCount: {
        type: Number,
        default: 0
    },
    lastActivity: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Índice composto para queries eficientes
memberJoinSchema.index({ guildId: 1, userId: 1 }, { unique: true });
memberJoinSchema.index({ guildId: 1, inviteCode: 1 });
memberJoinSchema.index({ guildId: 1, isFake: 1 });
memberJoinSchema.index({ guildId: 1, hasLeft: 1 });

const InviteTracker = mongoose.model('InviteTracker', inviteTrackerSchema);
const MemberJoin = mongoose.model('MemberJoin', memberJoinSchema);

module.exports = {
    InviteTracker,
    MemberJoin
};
