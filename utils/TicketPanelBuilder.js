const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const TICKET_IDS = require('../constants/ticketButtonIds');
const logger = require('./logger');

/**
 * 🎫 TICKET PANEL BUILDER
 * 
 * Cria painéis de tickets com dois modos:
 * 1. SIMPLES: 1 botão → Select menu de categorias
 * 2. AVANÇADO: Botões individuais por categoria
 */

class TicketPanelBuilder {
    /**
     * Criar painel simples
     * - 1 botão "Abrir Ticket"
     * - Ao clicar, mostra select menu com categorias
     */
    static createSimplePanel(options = {}) {
        const {
            title = '🎫 Sistema de Tickets',
            description = 'Clique no botão abaixo para abrir um ticket de suporte.',
            color = 0x5865F2,
            thumbnail = null,
            image = null,
            footer = null
        } = options;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();

        if (thumbnail) embed.setThumbnail(thumbnail);
        if (image) embed.setImage(image);
        if (footer) embed.setFooter({ text: footer });

        // Botão único
        const button = new ButtonBuilder()
            .setCustomId(TICKET_IDS.PANEL_SIMPLE_OPEN)
            .setLabel('🎟️ Abrir Ticket')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        return {
            embeds: [embed],
            components: [row]
        };
    }

    /**
     * Criar select menu de categorias (para painel simples)
     */
    static createCategorySelect(categories = []) {
        // Categorias padrão se não especificadas
        const defaultCategories = [
            { value: 'support', label: '🆘 Suporte Geral', description: 'Ajuda geral e dúvidas' },
            { value: 'technical', label: '🔧 Suporte Técnico', description: 'Problemas técnicos e bugs' },
            { value: 'incident', label: '⚠️ Reportar Problema', description: 'Reportar um problema ou incidente' },
            { value: 'billing', label: '💳 Faturamento', description: 'Questões sobre pagamentos e faturas' }
        ];

        const categoriesToUse = categories.length > 0 ? categories : defaultCategories;

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(TICKET_IDS.CATEGORY_SELECT)
            .setPlaceholder('📂 Selecione a categoria do seu ticket...')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(categoriesToUse.map(cat => ({
                label: cat.label,
                description: cat.description || '',
                value: cat.value,
                emoji: cat.emoji || undefined
            })));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return row;
    }

    /**
     * Criar painel avançado
     * - Botões individuais por categoria selecionada
     * - Máximo 25 botões (limite do Discord)
     */
    static createAdvancedPanel(options = {}) {
        const {
            title = '🎫 Sistema de Tickets',
            description = 'Selecione o tipo de ticket que deseja abrir:',
            color = 0x5865F2,
            thumbnail = null,
            image = null,
            footer = null,
            categories = []
        } = options;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();

        if (thumbnail) embed.setThumbnail(thumbnail);
        if (image) embed.setImage(image);
        if (footer) embed.setFooter({ text: footer });

        // Criar botões por categoria
        const buttons = this.createCategoryButtons(categories);
        
        // Dividir em rows (máx 5 botões por row)
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            const rowButtons = buttons.slice(i, i + 5);
            rows.push(new ActionRowBuilder().addComponents(rowButtons));
        }

        return {
            embeds: [embed],
            components: rows
        };
    }

    /**
     * Criar botões de categoria
     */
    static createCategoryButtons(categories = []) {
        // Categorias padrão
        const defaultCategories = [
            { 
                id: 'support', 
                label: 'Suporte', 
                emoji: '🎫', 
                style: ButtonStyle.Primary 
            },
            { 
                id: 'technical', 
                label: 'Suporte Técnico', 
                emoji: '🔧', 
                style: ButtonStyle.Primary 
            },
            { 
                id: 'incident', 
                label: 'Reportar Problema', 
                emoji: '⚠️', 
                style: ButtonStyle.Danger 
            },
            { 
                id: 'general', 
                label: 'Dúvidas Gerais', 
                emoji: '💬', 
                style: ButtonStyle.Secondary 
            }
        ];

        const categoriesToUse = categories.length > 0 ? categories : defaultCategories;

        return categoriesToUse.map(cat => {
            const customId = TICKET_IDS[`CREATE_${cat.id.toUpperCase()}`] || `ticket:create:${cat.id}`;
            
            const button = new ButtonBuilder()
                .setCustomId(customId)
                .setLabel(cat.label)
                .setStyle(cat.style || ButtonStyle.Primary);

            if (cat.emoji) {
                button.setEmoji(cat.emoji);
            }

            return button;
        });
    }

    /**
     * Criar painel customizado (detecta automaticamente o tipo)
     */
    static createPanel(config = {}) {
        const {
            type = 'simple', // 'simple' ou 'advanced'
            title,
            description,
            color,
            thumbnail,
            image,
            footer,
            categories = []
        } = config;

        const options = {
            title,
            description,
            color,
            thumbnail,
            image,
            footer,
            categories
        };

        if (type === 'advanced' || (categories.length > 0 && type !== 'simple')) {
            return this.createAdvancedPanel(options);
        }

        return this.createSimplePanel(options);
    }

    /**
     * Validar configuração de painel
     */
    static validatePanelConfig(config) {
        const errors = [];

        if (config.categories && !Array.isArray(config.categories)) {
            errors.push('categories deve ser um array');
        }

        if (config.categories && config.categories.length > 25) {
            errors.push('Máximo de 25 categorias permitidas');
        }

        if (config.type && !['simple', 'advanced'].includes(config.type)) {
            errors.push('type deve ser "simple" ou "advanced"');
        }

        if (config.color && (typeof config.color !== 'number' || config.color < 0 || config.color > 0xFFFFFF)) {
            errors.push('color deve ser um número hexadecimal válido');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Criar botões de ação dentro de um ticket
     */
    static createTicketActionButtons(options = {}) {
        const {
            showClaim = true,
            showClose = true,
            showTranscript = true,
            showMembers = true,
            isClaimed = false,
            isStaff = false
        } = options;

        const buttons = [];

        // Botão de claim (apenas se não claimed)
        if (showClaim && !isClaimed && isStaff) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(TICKET_IDS.CLAIM)
                    .setLabel('Atribuir')
                    .setEmoji('🙋')
                    .setStyle(ButtonStyle.Success)
            );
        }

        // Botão de fechar
        if (showClose) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(TICKET_IDS.CLOSE)
                    .setLabel('Fechar')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger)
            );
        }

        // Botões de gestão de membros (apenas staff)
        if (showMembers && isStaff) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(TICKET_IDS.ADD_MEMBER)
                    .setLabel('Adicionar Membro')
                    .setEmoji('➕')
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        // Botão de transcript (apenas staff)
        if (showTranscript && isStaff) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(TICKET_IDS.TRANSCRIPT)
                    .setLabel('Exportar')
                    .setEmoji('📜')
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        // Dividir em rows
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            const rowButtons = buttons.slice(i, i + 5);
            rows.push(new ActionRowBuilder().addComponents(rowButtons));
        }

        return rows;
    }

    /**
     * Criar mensagem de confirmação de fechamento
     */
    static createCloseConfirmation() {
        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('⚠️ Confirmar Fechamento')
            .setDescription('Tem certeza que deseja fechar este ticket?\n\nEsta ação não pode ser desfeita.')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(TICKET_IDS.CLOSE_CONFIRM)
                .setLabel('✅ Confirmar')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(TICKET_IDS.CLOSE_CANCEL)
                .setLabel('❌ Cancelar')
                .setStyle(ButtonStyle.Secondary)
        );

        return {
            embeds: [embed],
            components: [row],
            ephemeral: true
        };
    }
}

module.exports = TicketPanelBuilder;
