const logger = require('./logger');
const { setTimeout: sleep } = require('node:timers/promises');

class TicketTimeout {
    constructor(client) {
        this.client = client;
        this.timeouts = new Map();
        this.INACTIVE_TIMEOUT = 72 * 60 * 60 * 1000; // 72 horas em ms
        this.WARNING_TIME = 24 * 60 * 60 * 1000; // 24 horas em ms
    }

    async startTracking(ticket) {
        if (this.timeouts.has(ticket.id)) {
            clearTimeout(this.timeouts.get(ticket.id));
        }

        // Configurar timeout para aviso
        const warningTimeout = setTimeout(async () => {
            await this.sendWarning(ticket);
        }, this.WARNING_TIME);

        // Configurar timeout para fechamento
        const closeTimeout = setTimeout(async () => {
            await this.closeInactiveTicket(ticket);
        }, this.INACTIVE_TIMEOUT);

        this.timeouts.set(ticket.id, {
            warning: warningTimeout,
            close: closeTimeout,
            lastActivity: Date.now()
        });
    }

    async updateActivity(ticketId) {
        const timeout = this.timeouts.get(ticketId);
        if (timeout) {
            clearTimeout(timeout.warning);
            clearTimeout(timeout.close);
            
            const ticket = await this.client.storage.getTicket(ticketId);
            if (ticket && ticket.status !== 'closed') {
                await this.startTracking(ticket);
            }
        }
    }

    async sendWarning(ticket) {
        try {
            const channel = await this.client.channels.fetch(ticket.channel_id);
            if (!channel) return;

            await channel.send({
                content: `⚠️ **Aviso de Inatividade**\nEste ticket está inativo há 24 horas. Será fechado automaticamente em 48 horas se não houver atividade.`,
                allowedMentions: { parse: ['users'] }
            });

        } catch (error) {
            logger.error('Erro ao enviar aviso de inatividade', {
                ticketId: ticket.id,
                error: error.message
            });
        }
    }

    async closeInactiveTicket(ticket) {
        try {
            // Verificar se o ticket ainda está aberto
            const updatedTicket = await this.client.storage.getTicket(ticket.id);
            if (!updatedTicket || updatedTicket.status === 'closed') {
                return;
            }

            const channel = await this.client.channels.fetch(ticket.channel_id);
            if (!channel) return;

            // Fechar ticket
            await this.client.storage.updateTicket(ticket.id, {
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by: this.client.user.id,
                close_reason: 'Fechado automaticamente por inatividade'
            });

            // Enviar mensagem final
            await channel.send('🔒 **Ticket fechado automaticamente por inatividade**');
            
            // Aguardar 5 segundos antes de deletar o canal
            await sleep(5000);
            await channel.delete('Ticket fechado por inatividade');

            // Limpar timeouts
            const timeout = this.timeouts.get(ticket.id);
            if (timeout) {
                clearTimeout(timeout.warning);
                clearTimeout(timeout.close);
                this.timeouts.delete(ticket.id);
            }

            logger.info('Ticket fechado por inatividade', { ticketId: ticket.id });

        } catch (error) {
            logger.error('Erro ao fechar ticket inativo', {
                ticketId: ticket.id,
                error: error.message
            });
        }
    }

    stopTracking(ticketId) {
        const timeout = this.timeouts.get(ticketId);
        if (timeout) {
            clearTimeout(timeout.warning);
            clearTimeout(timeout.close);
            this.timeouts.delete(ticketId);
        }
    }
}

module.exports = TicketTimeout;
