const { EmbedBuilder } = require('discord.js');
const { getUserDisplayName } = require('./userHelper');

class TicketEmbedManager {
    constructor(client) {
        this.client = client;
    }

    // Embed principal do ticket (com thumbnail do utilizador)
    createTicketEmbed(ticket, guild, owner, claimedByUser = null) {
        const embed = new EmbedBuilder()
            .setTitle('🧾 Ticket Criado')
            .setDescription(
                '**Aqui podes resolver os teus problemas.**\n' +
                'Explica o problema com o máximo de detalhe (o que aconteceu, quando, anexos se houver). ' +
                'Aguarda pela equipa — um membro do staff irá atender este ticket em breve. ' +
                'Se for urgente, usa a opção "Escalar".'
            )
            .setColor(this.getStatusColor(ticket.status))
            .setThumbnail(owner?.displayAvatarURL?.() || owner?.avatarURL?.() || null);

        // Campos principais
        embed.addFields([
            { 
                name: 'Criado por', 
                value: `<@${ticket.ownerId}>`, 
                inline: true 
            },
            { 
                name: 'ID do Ticket', 
                value: `\`${ticket.ticketId}\``, 
                inline: true 
            },
            { 
                name: 'Categoria', 
                value: ticket.category, 
                inline: true 
            }
        ]);

        // Status dinâmico
        const statusText = this.getStatusText(ticket, claimedByUser);
        embed.addFields([
            { 
                name: 'Status', 
                value: statusText, 
                inline: false 
            }
        ]);

        // Atendido por
        const attendedByText = claimedByUser ? 
            `<@${ticket.claimedBy}> (${getUserDisplayName(claimedByUser, guild)})` : 
            'Nenhum';
        
        embed.addFields([
            { 
                name: 'Atendido por', 
                value: attendedByText, 
                inline: true 
            }
        ]);

        // Tempo desde criação
        const timeSinceCreation = this.calculateTimeSince(ticket.createdAt);
        embed.addFields([
            { 
                name: 'Tempo desde criação', 
                value: timeSinceCreation, 
                inline: true 
            }
        ]);

        // Última ação
        const lastAction = this.getLastAction(ticket);
        if (lastAction) {
            embed.addFields([
                { 
                    name: 'Última ação', 
                    value: lastAction, 
                    inline: false 
                }
            ]);
        }

        // Prioridade e flags especiais
        if (ticket.escalated) {
            embed.addFields([
                { 
                    name: '🚨 Escalado', 
                    value: 'Este ticket foi escalado para atenção prioritária', 
                    inline: false 
                }
            ]);
        }

        if (ticket.locked) {
            embed.addFields([
                { 
                    name: '🔒 Bloqueado', 
                    value: 'Aguardando resposta do utilizador', 
                    inline: false 
                }
            ]);
        }

        // Notas internas (apenas visível para staff)
        if (ticket.notes && ticket.notes.length > 0) {
            embed.addFields([
                { 
                    name: '📝 Notas Internas', 
                    value: `${ticket.notes.length} nota(s) adicionada(s)`, 
                    inline: true 
                }
            ]);
        }

        // Footer com informações
        const createdDate = new Date(ticket.createdAt);
        const timeString = createdDate.toLocaleTimeString('pt-PT', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const dateString = createdDate.toLocaleDateString('pt-PT') === new Date().toLocaleDateString('pt-PT') ? 
            'Hoje' : 
            createdDate.toLocaleDateString('pt-PT');

        embed.setFooter({ 
            text: `Ticket n.º ${ticket.ticketId} • ${dateString} às ${timeString}`
        });

        return embed;
    }

    // Embed para ticket fechado
    createClosedTicketEmbed(ticket, guild, owner, closedByUser, reason = null) {
        const embed = new EmbedBuilder()
            .setTitle('🔒 Ticket Fechado')
            .setDescription('Este ticket foi fechado. Obrigado por usar o nosso sistema de suporte!')
            .setColor(0xF44336)
            .setThumbnail(owner?.displayAvatarURL?.() || owner?.avatarURL?.() || null);

        embed.addFields([
            { 
                name: 'Ticket Original', 
                value: `#${ticket.ticketId}`, 
                inline: true 
            },
            { 
                name: 'Fechado por', 
                value: `<@${ticket.closedBy}> (${getUserDisplayName(closedByUser, guild)})`, 
                inline: true 
            },
            { 
                name: 'Categoria', 
                value: ticket.category, 
                inline: true 
            }
        ]);

        if (reason) {
            embed.addFields([
                { 
                    name: 'Motivo', 
                    value: reason, 
                    inline: false 
                }
            ]);
        }

        // Estatísticas do ticket
        const totalTime = this.calculateTotalTime(ticket.createdAt, ticket.closedAt);
        embed.addFields([
            { 
                name: 'Duração Total', 
                value: totalTime, 
                inline: true 
            },
            { 
                name: 'Mensagens Trocadas', 
                value: ticket.logs.length.toString(), 
                inline: true 
            }
        ]);

        const closedDate = new Date(ticket.closedAt);
        embed.setFooter({ 
            text: `Fechado em ${closedDate.toLocaleDateString('pt-PT')} às ${closedDate.toLocaleTimeString('pt-PT')}`
        });

        return embed;
    }

    // Embed para notas internas (apenas staff)
    createNotesEmbed(ticket, guild) {
        const embed = new EmbedBuilder()
            .setTitle('📝 Notas Internas do Ticket')
            .setDescription(`Ticket #${ticket.ticketId}`)
            .setColor(0xFF9800);

        if (ticket.notes.length === 0) {
            embed.addFields([
                { 
                    name: 'Nenhuma Nota', 
                    value: 'Não há notas internas para este ticket.', 
                    inline: false 
                }
            ]);
        } else {
            ticket.notes.slice(-5).forEach((note, index) => {
                const date = new Date(note.at);
                const timeString = date.toLocaleString('pt-PT');
                
                embed.addFields([
                    { 
                        name: `Nota ${ticket.notes.length - 4 + index}`, 
                        value: `**Por:** <@${note.by}>\n**Data:** ${timeString}\n**Nota:** ${note.text}`, 
                        inline: false 
                    }
                ]);
            });

            if (ticket.notes.length > 5) {
                embed.setFooter({ 
                    text: `Mostrando as últimas 5 de ${ticket.notes.length} notas` 
                });
            }
        }

        return embed;
    }

    // Cores baseadas no status
    getStatusColor(status) {
        switch (status) {
            case 'aberto': return 0x4CAF50; // Verde
            case 'em_atendimento': return 0xFF9800; // Laranja
            case 'fechado': return 0xF44336; // Vermelho
            case 'arquivado': return 0x9E9E9E; // Cinzento
            default: return 0x2196F3; // Azul
        }
    }

    // Texto do status
    getStatusText(ticket, claimedByUser = null) {
        switch (ticket.status) {
            case 'aberto': 
                return ticket.escalated ? 
                    '🚨 **Aberto — ESCALADO (Prioridade Alta)** ⚠️' : 
                    '🟢 **Aberto — À espera de atendimento**';
            case 'em_atendimento': 
                return claimedByUser ? 
                    `🟡 **Em atendimento por ${getUserDisplayName(claimedByUser, null)}**` : 
                    '🟡 **Em atendimento**';
            case 'fechado': 
                return '🔴 **Fechado**';
            case 'arquivado': 
                return '📁 **Arquivado**';
            default: 
                return '❓ **Estado desconhecido**';
        }
    }

    // Última ação baseada nos logs
    getLastAction(ticket) {
        if (!ticket.logs || ticket.logs.length === 0) return null;

        const lastLog = ticket.logs[ticket.logs.length - 1];
        const date = new Date(lastLog.at);
        const timeAgo = this.getTimeAgo(date);

        switch (lastLog.type) {
            case 'created':
                return `Ticket criado (${timeAgo})`;
            case 'claimed':
                return `Assumido por staff (${timeAgo})`;
            case 'note_added':
                return `Nota interna adicionada (${timeAgo})`;
            case 'transferred':
                return `Transferido para ${lastLog.extra?.to} (${timeAgo})`;
            case 'escalated':
                return `Escalado (${timeAgo})`;
            case 'locked':
                return `Bloqueado (${timeAgo})`;
            case 'unlocked':
                return `Desbloqueado (${timeAgo})`;
            default:
                return `Última atividade (${timeAgo})`;
        }
    }

    // Calcular tempo desde criação
    calculateTimeSince(createdAt) {
        const now = new Date();
        const created = new Date(createdAt);
        const diff = now - created;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // Calcular tempo total (criação até fecho)
    calculateTotalTime(createdAt, closedAt) {
        const created = new Date(createdAt);
        const closed = new Date(closedAt);
        const diff = closed - created;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // Tempo atrás (para logs)
    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days > 0) {
            return `há ${days}d`;
        } else if (hours > 0) {
            return `há ${hours}h`;
        } else {
            return `há ${minutes}m`;
        }
    }
}

module.exports = TicketEmbedManager;