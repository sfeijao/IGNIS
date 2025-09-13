const { 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    StringSelectMenuBuilder 
} = require('discord.js');

class TicketComponentManager {
    constructor() {
        this.cannedResponses = {
            'canned:password': {
                label: 'Instruções para password',
                content: 'Para redefinir a tua password:\n\n1. Vai a [link de recuperação]\n2. Introduz o teu email\n3. Verifica a tua caixa de email\n4. Segue as instruções no email\n\nSe continuares com problemas, avisa-nos!'
            },
            'canned:refund': {
                label: 'Pedido de reembolso',
                content: 'Para processar o teu reembolso:\n\n1. Indica o número do pedido/transação\n2. Motivo do reembolso\n3. Método de pagamento usado\n\nVamos analisar e responder em 24-48h úteis.'
            },
            'canned:inactivity': {
                label: 'Fechar por inatividade',
                content: 'Este ticket será fechado devido à inatividade. Se ainda precisas de ajuda, podes reabrir o ticket ou criar um novo.\n\nObrigado!'
            },
            'canned:solved': {
                label: 'Problema resolvido',
                content: 'Fico contente que o teu problema tenha sido resolvido! Se precisares de mais alguma coisa, não hesites em criar um novo ticket.\n\nObrigado por usar o nosso suporte!'
            },
            'canned:escalate': {
                label: 'Escalar para supervisor',
                content: 'O teu caso foi escalado para um supervisor que irá analisar a situação com mais detalhe. Deverás ter uma resposta em breve.\n\nObrigado pela paciência!'
            }
        };
    }

    // Componentes principais do ticket (activos)
    createActiveTicketComponents(ticketId, isStaff = false, isOwner = false, ticket = null) {
        const components = [];

        if (isStaff) {
            // Primeira linha - Ações principais de staff
            const mainRow = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                    .setCustomId(`ticket:claim:${ticketId}`)
                    .setLabel('Atender Ticket')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✋'),
                
                new ButtonBuilder()
                    .setCustomId(`ticket:transfer:${ticketId}`)
                    .setLabel('Transferir/Categoria')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄'),
                
                new ButtonBuilder()
                    .setCustomId(`ticket:addnote:${ticketId}`)
                    .setLabel('Adicionar Nota')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📝')
            ]);

            // Segunda linha - Ações secundárias
            const secondRow = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                    .setCustomId(`ticket:transcript:${ticketId}`)
                    .setLabel('Transcript / Enviar Vlog')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📄'),
                
                new ButtonBuilder()
                    .setCustomId(`ticket:escalate:${ticketId}`)
                    .setLabel('Escalar')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🚨'),
                
                new ButtonBuilder()
                    .setCustomId(`ticket:lock:${ticketId}`)
                    .setLabel(ticket?.locked ? 'Desbloquear' : 'Bloquear')
                    .setStyle(ticket?.locked ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji(ticket?.locked ? '🔓' : '🔒')
            ]);

            // Terceira linha - Menu de respostas rápidas
            const cannedRow = new ActionRowBuilder().addComponents([
                new StringSelectMenuBuilder()
                    .setCustomId(`ticket:canned:${ticketId}`)
                    .setPlaceholder('Selecionar resposta rápida...')
                    .addOptions([
                        {
                            label: 'Instruções para password',
                            value: 'canned:password',
                            emoji: '🔑'
                        },
                        {
                            label: 'Pedido de reembolso',
                            value: 'canned:refund',
                            emoji: '💰'
                        },
                        {
                            label: 'Problema resolvido',
                            value: 'canned:solved',
                            emoji: '✅'
                        },
                        {
                            label: 'Escalar para supervisor',
                            value: 'canned:escalate',
                            emoji: '⬆️'
                        },
                        {
                            label: 'Fechar por inatividade',
                            value: 'canned:inactivity',
                            emoji: '⏰'
                        }
                    ])
            ]);

            // Quarta linha - Ação crítica (fechar)
            const closeRow = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                    .setCustomId(`ticket:close:${ticketId}`)
                    .setLabel('Fechar Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            ]);

            components.push(mainRow, secondRow, cannedRow, closeRow);
        }

        // Botões para o dono do ticket
        if (isOwner && !isStaff) {
            const ownerRow = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                    .setCustomId(`ticket:close:${ticketId}`)
                    .setLabel('Fechar Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                
                new ButtonBuilder()
                    .setCustomId(`ticket:attach:${ticketId}`)
                    .setLabel('Anexar Evidência')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📎')
            ]);

            components.push(ownerRow);
        }

        return components;
    }

    // Componentes para tickets fechados
    createClosedTicketComponents(ticketId, canReopen = false) {
        const components = [];

        if (canReopen) {
            const reopenRow = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                    .setCustomId(`ticket:reopen:${ticketId}`)
                    .setLabel('Reabrir Ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
                
                new ButtonBuilder()
                    .setCustomId(`ticket:transcript:${ticketId}`)
                    .setLabel('Ver Transcript')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📄')
            ]);

            components.push(reopenRow);
        }

        return components;
    }

    // Menu de categorias para transferência
    createCategorySelectMenu(ticketId, categories) {
        const options = categories.map(category => ({
            label: category.name,
            value: `category:${category.id}`,
            emoji: this.getCategoryEmoji(category.name)
        }));

        return new ActionRowBuilder().addComponents([
            new StringSelectMenuBuilder()
                .setCustomId(`ticket:category:${ticketId}`)
                .setPlaceholder('Selecionar nova categoria...')
                .addOptions(options)
        ]);
    }

    // Menu de escalação
    createEscalationSelectMenu(ticketId, escalationLevels) {
        const options = escalationLevels.map(level => ({
            label: level.name,
            value: `escalate:${level.roleId}`,
            description: level.description,
            emoji: '🚨'
        }));

        return new ActionRowBuilder().addComponents([
            new StringSelectMenuBuilder()
                .setCustomId(`ticket:escalate-menu:${ticketId}`)
                .setPlaceholder('Escalar para...')
                .addOptions(options)
        ]);
    }

    // Obter resposta rápida
    getCannedResponse(value) {
        return this.cannedResponses[value] || null;
    }

    // Emoji para categorias
    getCategoryEmoji(categoryName) {
        const name = categoryName.toLowerCase();
        if (name.includes('suporte') || name.includes('support')) return '🛠️';
        if (name.includes('problema') || name.includes('bug')) return '🐛';
        if (name.includes('sugestão') || name.includes('suggestion')) return '💡';
        if (name.includes('billing') || name.includes('pagamento')) return '💰';
        if (name.includes('técnico') || name.includes('technical')) return '⚙️';
        if (name.includes('reclamação') || name.includes('complaint')) return '😠';
        return '📂';
    }

    // Componentes simplificados para mobile/limite de componentes
    createSimplifiedComponents(ticketId, isStaff = false) {
        const components = [];

        if (isStaff) {
            const row = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                    .setCustomId(`ticket:claim:${ticketId}`)
                    .setLabel('Atender')
                    .setStyle(ButtonStyle.Success),
                
                new ButtonBuilder()
                    .setCustomId(`ticket:close:${ticketId}`)
                    .setLabel('Fechar')
                    .setStyle(ButtonStyle.Danger),
                
                new ButtonBuilder()
                    .setCustomId(`ticket:transcript:${ticketId}`)
                    .setLabel('Transcript')
                    .setStyle(ButtonStyle.Secondary)
            ]);

            components.push(row);
        }

        return components;
    }

    // Verificar se há componentes em excesso (Discord limita a 5 ActionRows)
    validateComponents(components) {
        if (components.length > 5) {
            console.warn(`Demasiados componentes (${components.length}). Discord limita a 5 ActionRows.`);
            return components.slice(0, 5);
        }
        return components;
    }

    // Atualizar estado dos botões baseado no ticket
    updateButtonStates(components, ticket) {
        // Esta função pode ser usada para desativar/ativar botões
        // baseado no estado do ticket (ex: desativar "Claim" se já foi claimed)
        
        components.forEach(row => {
            row.components.forEach(component => {
                if (component.data && component.data.custom_id) {
                    const customId = component.data.custom_id;
                    
                    // Desativar botão "Atender" se já foi atendido
                    if (customId.includes('ticket:claim') && ticket.claimedBy) {
                        component.setDisabled(true);
                        component.setLabel('Já Atendido');
                    }
                    
                    // Desativar botão "Escalar" se já foi escalado
                    if (customId.includes('ticket:escalate') && ticket.escalated) {
                        component.setDisabled(true);
                        component.setLabel('Já Escalado');
                    }
                }
            });
        });

        return components;
    }
}

module.exports = TicketComponentManager;