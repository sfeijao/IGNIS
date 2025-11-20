const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * 🎨 PANEL BUILDER
 *
 * Utilitários para construir painéis de tickets customizados com embeds e botões.
 * Suporta configuração flexível de categorias, templates e temas.
 */

/**
 * Constrói um embed customizado para um painel de tickets
 * @param {Object} panel - Configuração do painel
 * @param {string} panel.title - Título do painel
 * @param {string} panel.description - Descrição do painel
 * @param {string} panel.icon_url - URL do ícone (thumbnail)
 * @param {string} panel.banner_url - URL do banner (image)
 * @param {string} panel.template - Template visual (classic, compact, premium, minimal, gamer)
 * @param {string} panel.theme - Tema de cores (dark, light)
 * @returns {EmbedBuilder} Embed configurado
 */
function buildPanelEmbed(panel) {
    const {
        title = 'Centro de Suporte',
        description = 'Clique em um botão abaixo para abrir um ticket.',
        icon_url,
        banner_url,
        template = 'classic',
        theme = 'dark'
    } = panel;

    // Cores por tema
    const colors = {
        dark: 0x7C3AED,    // Purple
        light: 0x60A5FA    // Blue
    };

    const embed = new EmbedBuilder()
        .setColor(colors[theme] || colors.dark)
        .setTitle(title)
        .setDescription(description);

    // Adicionar thumbnail (ícone no canto superior direito)
    if (icon_url) {
        embed.setThumbnail(icon_url);
    }

    // Adicionar banner (imagem na parte inferior)
    if (banner_url) {
        embed.setImage(banner_url);
    }

    // Customizações por template
    switch (template) {
        case 'premium':
            embed.addFields({
                name: '⭐ Suporte Premium',
                value: 'Nossa equipe está pronta para ajudar!',
                inline: false
            });
            break;

        case 'compact':
            // Template minimalista - sem fields extras
            break;

        case 'minimal':
            embed.setFooter({ text: '💬 Suporte disponível 24/7' });
            break;

        case 'gamer':
            embed.setFooter({
                text: '🎮 Game On! Nossa equipe está online',
                iconURL: icon_url || undefined
            });
            break;

        case 'classic':
        default:
            embed.setFooter({ text: '📩 Selecione uma categoria abaixo' });
            break;
    }

    return embed;
}

/**
 * Constrói botões de categoria para um painel de tickets
 * @param {Array} ticketCategories - Todas as categorias de tickets do servidor
 * @param {Array} selectedCategoryIds - IDs das categorias selecionadas para este painel
 * @returns {Array<ActionRowBuilder>} Linhas de botões (max 5 por linha)
 */
function buildCategoryButtons(ticketCategories, selectedCategoryIds) {
    if (!ticketCategories || !selectedCategoryIds || selectedCategoryIds.length === 0) {
        return [];
    }

    // Filtrar apenas as categorias selecionadas
    const selectedCategories = ticketCategories.filter(cat =>
        selectedCategoryIds.includes(cat._id.toString()) && cat.enabled
    );

    if (selectedCategories.length === 0) {
        return [];
    }

    // Ordenar por ordem
    selectedCategories.sort((a, b) => (a.order || 0) - (b.order || 0));

    const rows = [];
    let currentRow = new ActionRowBuilder();

    for (const category of selectedCategories) {
        // Se a linha atual já tem 5 botões, criar nova linha
        if (currentRow.components.length >= 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }

        // Criar botão para a categoria
        const button = new ButtonBuilder()
            .setCustomId(`ticket:category:${category._id}`)
            .setLabel(category.name)
            .setStyle(getButtonStyle(category.color))
            .setEmoji(category.emoji || '📩');

        currentRow.addComponents(button);
    }

    // Adicionar última linha se tiver botões
    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }

    return rows;
}

/**
 * Determina o estilo do botão baseado na cor da categoria
 * @param {number} color - Cor em formato hexadecimal
 * @returns {ButtonStyle} Estilo do botão
 */
function getButtonStyle(color) {
    if (!color) return ButtonStyle.Primary;

    // Converter cor para determinar estilo
    // Cores quentes -> Danger (vermelho)
    // Cores frias -> Primary (azul)
    // Cores neutras -> Secondary (cinza)
    // Verde -> Success

    const hex = color.toString(16).padStart(6, '0');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Verde dominante
    if (g > r && g > b && g > 150) {
        return ButtonStyle.Success;
    }

    // Vermelho dominante
    if (r > g && r > b && r > 150) {
        return ButtonStyle.Danger;
    }

    // Cinza/neutro
    if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
        return ButtonStyle.Secondary;
    }

    // Padrão: azul
    return ButtonStyle.Primary;
}

/**
 * Envia ou atualiza um painel de tickets no Discord
 * @param {Object} params - Parâmetros
 * @param {Object} params.client - Cliente do Discord
 * @param {string} params.guildId - ID do servidor
 * @param {string} params.channelId - ID do canal
 * @param {Object} params.panel - Configuração do painel
 * @param {Array} params.ticketCategories - Categorias de tickets disponíveis
 * @param {string} params.messageId - ID da mensagem existente (para atualizar)
 * @returns {Promise<Object>} Mensagem enviada/atualizada
 */
async function sendOrUpdatePanel({ client, guildId, channelId, panel, ticketCategories, messageId }) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Guild not found');

    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== 0) throw new Error('Invalid text channel');

    // Construir embed e botões
    const embed = buildPanelEmbed(panel);
    const buttons = buildCategoryButtons(ticketCategories, panel.selected_categories || []);

    const messagePayload = {
        embeds: [embed],
        components: buttons
    };

    // Se existe message_id, tentar atualizar
    if (messageId) {
        try {
            const message = await channel.messages.fetch(messageId);
            return await message.edit(messagePayload);
        } catch (error) {
            // Se falhar ao atualizar, enviar nova mensagem
            console.log('Failed to update panel message, sending new one:', error.message);
        }
    }

    // Enviar nova mensagem
    return await channel.send(messagePayload);
}

module.exports = {
    buildPanelEmbed,
    buildCategoryButtons,
    sendOrUpdatePanel,
    getButtonStyle
};
