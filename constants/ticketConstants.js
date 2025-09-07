// Constantes UI para o sistema de tickets
const ticketTypes = {
    suporte: {
        nome: 'Suporte Técnico',
        emoji: '🛠️',
        cor: 0x3498db,
        descricao: 'Suporte técnico para problemas com bots e comandos'
    },
    problema: {
        nome: 'Reportar Problema',
        emoji: '🚨',
        cor: 0xe74c3c,
        descricao: 'Reportar bugs ou comportamentos inesperados'
    },
    sugestao: {
        nome: 'Sugestão',
        emoji: '💡',
        cor: 0x2ecc71,
        descricao: 'Sugestões para melhorar o servidor'
    },
    moderacao: {
        nome: 'Moderação',
        emoji: '👤',
        cor: 0x9b59b6,
        descricao: 'Questões relacionadas à moderação'
    },
    geral: {
        nome: 'Geral',
        emoji: '📝',
        cor: 0x95a5a6,
        descricao: 'Outros assuntos diversos'
    }
};

const ticketPriorities = {
    urgent: {
        nome: 'Urgente',
        emoji: '🔴',
        cor: 0xe74c3c
    },
    high: {
        nome: 'Alta',
        emoji: '🟠',
        cor: 0xe67e22
    },
    normal: {
        nome: 'Normal',
        emoji: '🟡',
        cor: 0xf1c40f
    },
    low: {
        nome: 'Baixa',
        emoji: '🟢',
        cor: 0x2ecc71
    }
};

const ticketStatus = {
    open: {
        nome: 'Aberto',
        emoji: '🟢',
        cor: 0x2ecc71
    },
    assigned: {
        nome: 'Em Atendimento',
        emoji: '🟡',
        cor: 0xf1c40f
    },
    closed: {
        nome: 'Fechado',
        emoji: '🔴',
        cor: 0xe74c3c
    },
    archived: {
        nome: 'Arquivado',
        emoji: '⚪',
        cor: 0x95a5a6
    }
};

module.exports = {
    ticketTypes,
    ticketPriorities,
    ticketStatus
};
