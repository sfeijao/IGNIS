const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    MessageFlags 
} = require('discord.js');
const { getUserDisplayName } = require('./userHelper');
const logger = require('./logger');

class TicketPanelManager {
    constructor(client) {
        this.client = client;
        this.cooldowns = new Map(); // Sistema de cooldowns
    }

    /**
     * Cria o embed principal do painel de tickets
     */
    createTicketPanelEmbed(ticket, guild, owner, assignedStaff = null) {
        const embed = new EmbedBuilder()
            .setTitle('🎫 IGNIS - Sistema de Tickets')
            .setColor(0x5865F2) // Discord Blurple - cor marcante mas legível
            .setThumbnail(owner?.displayAvatarURL?.({ dynamic: true, size: 256 }) || owner?.avatarURL?.({ dynamic: true, size: 256 }) || null);

        // Descrição principal com resumo
        let description = [
            '### 📋 **INFORMAÇÕES DO TICKET**',
            '',
            `🏷️ **Categoria:** \`${this.getCategoryDisplayName(ticket.category)}\``,
            `👤 **Criado por:** ${owner}`,
            `📅 **Criado:** <t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:R>`,
            `🆔 **ID:** \`${ticket.ticketId}\``,
            ''
        ];

        // Status do ticket
        if (assignedStaff) {
            description.push(`👥 **Responsável:** <@${ticket.claimedBy}>`);
        } else {
            description.push('⏳ **Status:** Aguardando atribuição');
        }

        // Prioridade se definida
        if (ticket.priority) {
            const priorityEmoji = this.getPriorityEmoji(ticket.priority);
            description.push(`${priorityEmoji} **Prioridade:** \`${ticket.priority.toUpperCase()}\``);
        }

        description.push('');

        // Próximos passos
        description.push(
            '### 🎯 **PRÓXIMOS PASSOS**',
            '',
            assignedStaff 
                ? '✅ **Ticket atribuído** - Nossa equipe está a trabalhar na sua solicitação'
                : '📋 **Aguardando atribuição** - Um membro da equipe assumirá em breve',
            '',
            '> 💡 **Tempo médio de resposta: 15-30 minutos**'
        );

        embed.setDescription(description.join('\n'));

        // Footer com informações úteis
        embed.setFooter({ 
            text: `${guild.name} • Use os botões abaixo para interagir`,
            iconURL: guild.iconURL({ dynamic: true })
        });

        embed.setTimestamp();

        return embed;
    }

    /**
     * Cria os botões do Grupo 1 - Staff
     */
    createStaffButtons(ticketId, ticket = {}) {
        const row = new ActionRowBuilder();

        // Assumir Ticket - desabilita se já assumido
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_panel:claim:${ticketId}`)
                .setLabel('Assumir')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!!ticket.claimedBy)
        );

        // Fechar Ticket
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_panel:close:${ticketId}`)
                .setLabel('Fechar')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );

        // Adicionar Nota Interna
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_panel:add_note:${ticketId}`)
                .setLabel('Nota')
                .setEmoji('📝')
                .setStyle(ButtonStyle.Secondary)
        );

        // Histórico
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_panel:history:${ticketId}`)
                .setLabel('Histórico')
                .setEmoji('📂')
                .setStyle(ButtonStyle.Secondary)
        );

        return row;
    }

    /**
     * Cria os botões do Grupo 1 - Staff (segunda linha)
     */
    createStaffButtons2(ticketId, ticket = {}) {
        const row = new ActionRowBuilder();

        // Escalar Ticket
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_panel:escalate:${ticketId}`)
                .setLabel('Escalar')
                .setEmoji('⬆️')
                .setStyle(ButtonStyle.Primary)
        );

        // Transferir Ticket
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_panel:transfer:${ticketId}`)
                .setLabel('Transferir')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary)
        );

        // Bloquear Ticket
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_panel:lock:${ticketId}`)
                .setLabel(ticket.locked ? 'Desbloquear' : 'Bloquear')
                .setEmoji('🔐')
                .setStyle(ticket.locked ? ButtonStyle.Success : ButtonStyle.Secondary)
        );

        return row;
    }

    /**
     * Cria os botões do Grupo 2 - Utilizador
     */
    createUserButtons(ticketId, userId, ticket = {}) {
        const row = new ActionRowBuilder();

        // Editar Descrição
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_panel:edit_desc:${ticketId}`)
                .setLabel('Editar Descrição')
                .setEmoji('✍️')
                .setStyle(ButtonStyle.Secondary)
        );

        // Adicionar Mais Informações
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_panel:add_info:${ticketId}`)
                .setLabel('Mais Info')
                .setEmoji('📝')
                .setStyle(ButtonStyle.Secondary)
        );

        // Pedir Urgência - com cooldown
        const urgencyDisabled = this.isOnCooldown(userId, 'urgency');
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_panel:urgent:${ticketId}`)
                .setLabel('Urgência')
                .setEmoji('🆘')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(urgencyDisabled || ticket.escalated)
        );

        // Trocar Idioma
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_panel:language:${ticketId}`)
                .setLabel('PT/EN')
                .setEmoji('🌐')
                .setStyle(ButtonStyle.Secondary)
        );

        return row;
    }

    /**
     * Cria o painel completo com todos os componentes
     */
    async createCompletePanel(ticket, guild, owner, assignedStaff = null) {
        const embed = this.createTicketPanelEmbed(ticket, guild, owner, assignedStaff);
        const components = [];

        // Sempre adicionar botões de staff
        components.push(this.createStaffButtons(ticket.ticketId, ticket));
        components.push(this.createStaffButtons2(ticket.ticketId, ticket));
        
        // Adicionar botões de utilizador
        components.push(this.createUserButtons(ticket.ticketId, ticket.ownerId, ticket));

        return {
            embeds: [embed],
            components: components
        };
    }

    /**
     * Atualiza o painel existente com novas informações
     */
    async updatePanel(channel, ticket, guild, owner, assignedStaff = null) {
        try {
            // Buscar a mensagem do painel (primeira mensagem do bot no canal)
            const messages = await channel.messages.fetch({ limit: 10 });
            const panelMessage = messages.find(msg => 
                msg.author.id === this.client.user.id && 
                msg.embeds.length > 0 &&
                msg.embeds[0].title?.includes('IGNIS - Sistema de Tickets')
            );

            if (panelMessage) {
                const panelData = await this.createCompletePanel(ticket, guild, owner, assignedStaff);
                await panelMessage.edit(panelData);
                logger.info(`Painel do ticket ${ticket.ticketId} atualizado`);
                return panelMessage;
            } else {
                logger.warn(`Mensagem do painel não encontrada para ticket ${ticket.ticketId}`);
                return null;
            }
        } catch (error) {
            logger.error(`Erro ao atualizar painel do ticket ${ticket.ticketId}:`, error);
            return null;
        }
    }

    /**
     * Sistema de cooldown para ações limitadas
     */
    isOnCooldown(userId, action) {
        const key = `${userId}_${action}`;
        const cooldownTime = this.cooldowns.get(key);
        
        if (!cooldownTime) return false;
        
        const now = Date.now();
        if (now >= cooldownTime) {
            this.cooldowns.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * Define cooldown para uma ação
     */
    setCooldown(userId, action, hours = 24) {
        const key = `${userId}_${action}`;
        const cooldownTime = Date.now() + (hours * 60 * 60 * 1000);
        this.cooldowns.set(key, cooldownTime);
    }

    /**
     * Obtém tempo restante do cooldown em formato legível
     */
    getCooldownTime(userId, action) {
        const key = `${userId}_${action}`;
        const cooldownTime = this.cooldowns.get(key);
        
        if (!cooldownTime) return null;
        
        const remaining = cooldownTime - Date.now();
        if (remaining <= 0) return null;
        
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        
        return `${hours}h ${minutes}m`;
    }

    // Funções auxiliares
    getCategoryDisplayName(category) {
        const names = {
            'technical': 'Suporte Técnico',
            'account': 'Problemas de Conta', 
            'report': 'Denúncia',
            'suggestion': 'Sugestão',
            'support': 'Suporte Geral',
            'billing': 'Financeiro',
            'feedback': 'Feedback',
            'partnership': 'Parcerias',
            'bug': 'Report de Bug',
            'appeal': 'Recurso',
            'general': 'Ajuda Geral',
            'staff': 'Candidatura Staff',
            'vip': 'Suporte VIP',
            'premium': 'Premium Support',
            'urgent': 'Urgente',
            'private': 'Privado'
        };
        return names[category] || 'Ticket Geral';
    }

    getPriorityEmoji(priority) {
        const emojis = {
            'baixa': '🟢',
            'normal': '🟡',
            'alta': '🟠',
            'urgente': '🔴'
        };
        return emojis[priority?.toLowerCase()] || '🟡';
    }
}

module.exports = TicketPanelManager;