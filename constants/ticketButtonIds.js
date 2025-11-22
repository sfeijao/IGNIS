/**
 * 🎫 TICKET BUTTON IDS - Sistema Unificado
 * 
 * IDs únicos e consistentes para todos os botões, selects e modals de tickets
 * Previne colisões e facilita manutenção
 * 
 * Padrão: ticket:{action}:{param}
 */

module.exports = {
    // ===== CRIAÇÃO DE TICKETS =====
    
    // Painel Simples - Botão único que abre select menu
    PANEL_SIMPLE_OPEN: 'ticket:panel:simple:open',
    
    // Select menu de categorias (painel simples)
    CATEGORY_SELECT: 'ticket:category:select',
    
    // Painel Avançado - Botões por categoria
    CREATE_SUPPORT: 'ticket:create:support',
    CREATE_TECHNICAL: 'ticket:create:technical',
    CREATE_INCIDENT: 'ticket:create:incident',
    CREATE_GENERAL: 'ticket:create:general',
    CREATE_VIP: 'ticket:create:vip',
    CREATE_MODERATION: 'ticket:create:moderation',
    CREATE_ACCOUNT: 'ticket:create:account',
    CREATE_BILLING: 'ticket:create:billing',
    CREATE_PARTNERSHIP: 'ticket:create:partnership',
    
    // Modals de criação (por categoria)
    MODAL_CREATE: (category) => `ticket:modal:create:${category}`,
    MODAL_INPUT_SUBJECT: 'ticket:input:subject',
    MODAL_INPUT_DESCRIPTION: 'ticket:input:description',
    MODAL_INPUT_PRIORITY: 'ticket:input:priority',
    
    // ===== AÇÕES DENTRO DO TICKET =====
    
    // Ações básicas
    CLAIM: 'ticket:action:claim',
    CLOSE: 'ticket:action:close',
    CLOSE_CONFIRM: 'ticket:action:close:confirm',
    CLOSE_CANCEL: 'ticket:action:close:cancel',
    REOPEN: 'ticket:action:reopen',
    
    // Gestão de membros
    ADD_MEMBER: 'ticket:member:add',
    REMOVE_MEMBER: 'ticket:member:remove',
    CALL_MEMBER: 'ticket:member:call',
    
    // Gestão do ticket
    RENAME: 'ticket:manage:rename',
    MOVE: 'ticket:manage:move',
    MOVE_CATEGORY: (categoryId) => `ticket:move:cat:${categoryId}`,
    TRANSFER: 'ticket:manage:transfer',
    
    // Comunicação
    GREET: 'ticket:comm:greet',
    NOTE: 'ticket:comm:note',
    FEEDBACK: 'ticket:comm:feedback',
    
    // Export/Admin
    EXPORT: 'ticket:admin:export',
    TRANSCRIPT: 'ticket:admin:transcript',
    
    // ===== GIVEAWAY TICKETS (SEPARADO) =====
    
    // Tickets criados automaticamente por giveaways
    GIVEAWAY_CLAIM: (giveawayId) => `giveaway_ticket:claim:${giveawayId}`,
    GIVEAWAY_MODAL: (giveawayId) => `giveaway_ticket:modal:${giveawayId}`,
    
    // ===== MODALS AUXILIARES =====
    
    MODAL_ADD_MEMBER: 'ticket:modal:member:add',
    MODAL_REMOVE_MEMBER: 'ticket:modal:member:remove',
    MODAL_MOVE: 'ticket:modal:move',
    MODAL_RENAME: 'ticket:modal:rename',
    MODAL_NOTE: 'ticket:modal:note',
    MODAL_FEEDBACK: 'ticket:modal:feedback',
    MODAL_TRANSFER: 'ticket:modal:transfer',
    
    // Inputs dos modals
    INPUT_MEMBER_ID: 'ticket:input:member_id',
    INPUT_CATEGORY_NAME: 'ticket:input:category_name',
    INPUT_CHANNEL_NAME: 'ticket:input:channel_name',
    INPUT_NOTE_TEXT: 'ticket:input:note_text',
    INPUT_FEEDBACK_TEXT: 'ticket:input:feedback_text',
    INPUT_CLOSE_REASON: 'ticket:input:close_reason',
    
    // ===== BOTÕES DE HELP/INFO =====
    
    STATUS_CHECK: 'ticket:info:status',
    MY_TICKETS: 'ticket:info:my_tickets',
    FAQ: 'ticket:info:faq',
    EMERGENCY: 'ticket:info:emergency',
    
    // ===== PAINEL DE ADMIN =====
    
    ADMIN_STATS: 'ticket:admin:stats',
    ADMIN_CLEANUP: 'ticket:admin:cleanup',
    ADMIN_FORCE_CLOSE: (ticketId) => `ticket:admin:force_close:${ticketId}`,
    
    // ===== HELPERS =====
    
    /**
     * Verificar se um ID é de ticket
     */
    isTicketId: (customId) => {
        return customId && customId.startsWith('ticket:');
    },
    
    /**
     * Verificar se um ID é de giveaway ticket
     */
    isGiveawayTicketId: (customId) => {
        return customId && customId.startsWith('giveaway_ticket:');
    },
    
    /**
     * Extrair categoria de um ID de criação
     */
    extractCategory: (customId) => {
        if (!customId || !customId.startsWith('ticket:create:')) return null;
        return customId.replace('ticket:create:', '');
    },
    
    /**
     * Extrair ID de categoria de um ID de movimento
     */
    extractMoveCategory: (customId) => {
        if (!customId || !customId.startsWith('ticket:move:cat:')) return null;
        return customId.replace('ticket:move:cat:', '');
    },
    
    /**
     * Extrair ID de giveaway
     */
    extractGiveawayId: (customId) => {
        if (!customId || !customId.startsWith('giveaway_ticket:')) return null;
        const parts = customId.split(':');
        return parts[parts.length - 1];
    }
};
