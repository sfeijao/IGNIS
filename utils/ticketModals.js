const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

function createTicketModal(type) {
    return new ModalBuilder()
        .setCustomId(`ticket_modal_${type}`)
        .setTitle(`🎫 Criar Ticket - ${getTicketTypeInfo(type).name}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('ticket_subject')
                    .setLabel('Assunto do Ticket')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(5)
                    .setMaxLength(100)
                    .setPlaceholder('Descreva brevemente o assunto...')
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('ticket_description')
                    .setLabel('Descrição Detalhada')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMinLength(10)
                    .setMaxLength(1000)
                    .setPlaceholder('Explique detalhadamente sua solicitação...')
                    .setRequired(true)
            )
        );
}

function getTicketTypeInfo(type) {
    const types = {
        'suporte': {
            name: '🛠️ Suporte Técnico',
            color: 0x3498db,
            description: 'Suporte técnico para problemas com bots e comandos'
        },
        'problema': {
            name: '🚨 Reportar Problema',
            color: 0xe74c3c,
            description: 'Reportar bugs ou comportamentos inesperados'
        },
        'sugestao': {
            name: '💡 Sugestão',
            color: 0x2ecc71,
            description: 'Sugestões para melhorar o servidor'
        },
        'moderacao': {
            name: '👤 Moderação',
            color: 0x9b59b6,
            description: 'Questões relacionadas à moderação'
        },
        'geral': {
            name: '📝 Geral',
            color: 0x95a5a6,
            description: 'Outros assuntos diversos'
        }
    };
    return types[type] || types['geral'];
}

module.exports = {
    createTicketModal,
    getTicketTypeInfo
};
