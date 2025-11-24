const mongoose = require('mongoose');

// Schema para categorias de tickets
const ticketCategorySchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    
    name: { type: String, required: true },
    description: { type: String, default: '' },
    emoji: { type: String, default: '🎫' },
    
    // Configurações de canal
    channelSettings: {
        categoryChannelId: { type: String, default: null }, // Categoria Discord onde criar canais
        namingPattern: { type: String, default: 'ticket-{number}' }, // Padrão: ticket-0001
        privateChannel: { type: Boolean, default: true }
    },
    
    // Configurações de staff
    staffSettings: {
        roleIds: [{ type: String }], // Roles com acesso
        autoAssign: { type: Boolean, default: false },
        notifyOnCreate: { type: Boolean, default: true },
        notificationChannelId: { type: String, default: null }
    },
    
    // Configurações adicionais
    requireReason: { type: Boolean, default: false },
    maxOpenPerUser: { type: Number, default: 1 },
    
    // Perguntas iniciais
    initialQuestions: [{
        question: { type: String },
        required: { type: Boolean, default: false }
    }],
    
    enabled: { type: Boolean, default: true },
    
    // Estatísticas
    stats: {
        totalTickets: { type: Number, default: 0 },
        averageResponseTime: { type: Number, default: 0 }, // em minutos
        averageResolutionTime: { type: Number, default: 0 } // em minutos
    },
    
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Schema melhorado para tickets
const ticketEnhancedSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    ticketNumber: { type: Number, required: true }, // Número sequencial por servidor
    
    // Canal e usuário
    channelId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    
    // Categoria
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketCategory', index: true },
    categoryName: { type: String, default: 'Geral' },
    
    // Status e atribuição
    status: {
        type: String,
        enum: ['open', 'pending', 'answered', 'closed', 'archived'],
        default: 'open',
        index: true
    },
    
    // Staff
    staffAssigned: [{ type: String }], // Múltiplos staff members
    claimedBy: { type: String, default: null }, // Primeiro a reclamar
    claimedAt: { type: Date, default: null },
    
    // Prioridade
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
        index: true
    },
    
    // Assunto e razão
    subject: { type: String, default: 'Sem assunto' },
    reason: { type: String, default: '' },
    
    // Respostas às perguntas iniciais
    initialAnswers: [{
        question: { type: String },
        answer: { type: String }
    }],
    
    // Notas internas (staff only)
    notes: [{
        authorId: { type: String },
        content: { type: String },
        createdAt: { type: Date, default: Date.now }
    }],
    
    // Tags
    tags: [{ type: String }],
    
    // Tempos de resposta
    responseTimes: {
        firstResponse: { type: Date, default: null },
        firstResponseTime: { type: Number, default: null }, // em minutos
        lastResponse: { type: Date, default: null }
    },
    
    // Encerramento
    closedBy: { type: String, default: null },
    closedAt: { type: Date, default: null },
    closeReason: { type: String, default: null },
    
    // Transcrição
    transcript: {
        enabled: { type: Boolean, default: true },
        url: { type: String, default: null },
        messageCount: { type: Number, default: 0 }
    },
    
    // Avaliação (rating)
    rating: {
        score: { type: Number, min: 1, max: 5, default: null },
        feedback: { type: String, default: null },
        ratedAt: { type: Date, default: null }
    },
    
    // Metadata
    metadata: {
        totalMessages: { type: Number, default: 0 },
        participantIds: [{ type: String }],
        reopenCount: { type: Number, default: 0 }
    },
    
    createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

// Índice composto para número de ticket único por servidor
ticketEnhancedSchema.index({ guildId: 1, ticketNumber: 1 }, { unique: true });

module.exports = {
    TicketCategory: mongoose.models.TicketCategory || mongoose.model('TicketCategory', ticketCategorySchema),
    TicketEnhanced: mongoose.models.TicketEnhanced || mongoose.model('TicketEnhanced', ticketEnhancedSchema)
};
