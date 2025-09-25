// constants/ui.js - Centralização de IDs de componentes UI
/**
 * IDs dos botões interativos
 */
const BUTTON_IDS = {
    // Sistema de Verificação
    VERIFY_USER: 'verify_user',
    VERIFY_OPEN_CAPTCHA: 'verify_captcha_open',
    VERIFY_REFRESH_CAPTCHA: 'verify_captcha_refresh',
    
    // Sistema de Tickets
    CREATE_TICKET: 'create_ticket',
    CLOSE_TICKET: 'close_ticket',
    CONFIRM_CLOSE: 'confirm_close',
    CANCEL_CLOSE: 'cancel_close',
    TICKET_DELETE: 'delete_ticket',
    TICKET_REOPEN: 'reopen_ticket',
    TICKET_CLAIM: 'claim_ticket',
    TICKET_ARCHIVE: 'archive_ticket',
    // Extra ticket panel actions (dashboard / in-channel panel)
    TICKET_CALL_MEMBER: 'ticket_call_member',
    TICKET_ADD_MEMBER: 'ticket_add_member',
    TICKET_REMOVE_MEMBER: 'ticket_remove_member',
    TICKET_MOVE: 'ticket_move',
    TICKET_RENAME_CHANNEL: 'ticket_rename_channel',
    TICKET_GREET: 'ticket_greet',
    TICKET_INTERNAL_NOTE: 'ticket_internal_note',
    TICKET_FINALIZE: 'ticket_finalize',
    
    // Sistema de Tags
    TAG_REQUEST: 'request_tag',
    TAG_APPROVE: 'approve_tag',
    TAG_DENY: 'deny_tag',
    
    // Sistema de Moderação
    MOD_BAN: 'mod_ban',
    MOD_KICK: 'mod_kick',
    MOD_MUTE: 'mod_mute',
    MOD_WARN: 'mod_warn',
    
    // Sistema de Logs
    LOGS_CLEAR: 'logs_clear',
    LOGS_EXPORT: 'logs_export',
    
    // Dashboard
    DASHBOARD_REFRESH: 'dashboard_refresh',
    DASHBOARD_SETTINGS: 'dashboard_settings',
};

/**
 * IDs dos modais
 */
const MODAL_IDS = {
    TICKET_CREATE: 'ticket_create_modal',
    VERIFICATION_CAPTCHA: 'modal_verification_captcha',
    TAG_REQUEST: 'tag_request_modal',
    USER_REPORT: 'user_report_modal',
    BUG_REPORT: 'bug_report_modal',
    FEEDBACK: 'feedback_modal',
    REASON_INPUT: 'reason_input_modal',
};

/**
 * IDs dos selects/dropdowns
 */
const SELECT_IDS = {
    TICKET_CATEGORY: 'ticket_category_select',
    TICKET_SEVERITY: 'ticket_severity_select',
    TAG_TYPE: 'tag_type_select',
    LANGUAGE: 'language_select',
    TIMEZONE: 'timezone_select',
};

/**
 * IDs dos text inputs
 */
const INPUT_IDS = {
    TICKET_TITLE: 'ticket_title',
    TICKET_DESCRIPTION: 'ticket_description',
    TAG_NAME: 'tag_name',
    TAG_REASON: 'tag_reason',
    USER_ID: 'user_id',
    REASON: 'reason',
    MESSAGE: 'message',
    CAPTCHA_INPUT: 'captcha_input',
};

/**
 * Cores dos embeds por categoria/severidade
 */
const EMBED_COLORS = {
    // Severidade de tickets
    SEVERITY: {
        LOW: 0x00FF00,      // Verde
        MEDIUM: 0xFFFF00,   // Amarelo
        HIGH: 0xFF8000,     // Laranja
        URGENT: 0xFF0000,   // Vermelho
        CRITICAL: 0x8B0000, // Vermelho escuro
    },
    
    // Estados do sistema
    PRIMARY: '#5865F2',     // Azul Discord (Blurple)
    SUCCESS: '#00FF00',     // Verde
    WARNING: '#FFFF00',     // Amarelo
    ERROR: '#FF0000',       // Vermelho
    INFO: '#0099FF',        // Azul
    NEUTRAL: '#99AAB5',     // Cinzento
    
    // Categorias de tickets
    CATEGORY: {
        SUPORTE: 0x0099FF,     // Azul
        TECHNICAL: 0xFF8000,   // Laranja
        BILLING: 0xFFFF00,     // Amarelo
        REPORT: 0xFF0000,      // Vermelho
        SUGGESTION: 0x00FF00,  // Verde
        OTHER: 0x99AAB5,       // Cinzento
    },
    
    // Estados de verificação
    VERIFICATION: {
        PENDING: 0xFFFF00,   // Amarelo
        APPROVED: 0x00FF00,  // Verde
        DENIED: 0xFF0000,    // Vermelho
    },
};

/**
 * Emojis utilizados no bot
 */
const EMOJIS = {
    // Estados
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    LOADING: '⏳',
    CLOCK: '🕐',
    
    // Ações
    CREATE: '➕',
    DELETE: '🗑️',
    EDIT: '✏️',
    SAVE: '💾',
    CANCEL: '❌',
    CONFIRM: '✅',
    REFRESH: '🔄',
    
    // Categorias
    TICKET: '🎫',
    TAG: '🏷️',
    USER: '👤',
    GUILD: '🏛️',
    CHANNEL: '💬',
    ROLE: '🎭',
    
    // Severidade
    LOW: '🟢',
    MEDIUM: '🟡',
    HIGH: '🟠',
    URGENT: '🔴',
    CRITICAL: '⚫',
    
    // Moderação
    BAN: '🔨',
    KICK: '👢',
    MUTE: '🔇',
    WARN: '⚠️',
    
    // Sistema
    ONLINE: '🟢',
    OFFLINE: '🔴',
    MAINTENANCE: '🔧',
};

/**
 * Limites do sistema
 */
const LIMITS = {
    // Discord API
    EMBED_TITLE_MAX: 256,
    EMBED_DESCRIPTION_MAX: 4096,
    EMBED_FIELD_NAME_MAX: 256,
    EMBED_FIELD_VALUE_MAX: 1024,
    EMBED_FIELDS_MAX: 25,
    EMBED_FOOTER_MAX: 2048,
    EMBED_AUTHOR_MAX: 256,
    
    // Modal inputs
    MODAL_TITLE_MAX: 45,
    TEXT_INPUT_LABEL_MAX: 45,
    TEXT_INPUT_VALUE_MAX: 4000,
    TEXT_INPUT_PLACEHOLDER_MAX: 100,
    
    // Button/Select
    BUTTON_LABEL_MAX: 80,
    SELECT_LABEL_MAX: 100,
    SELECT_DESCRIPTION_MAX: 100,
    SELECT_OPTIONS_MAX: 25,
    
    // Sistema específico
    TICKETS_PER_USER_MAX: 3,
    TAGS_PER_USER_MAX: 5,
    MESSAGE_HISTORY_MAX: 100,
    AUDIT_LOG_DAYS_MAX: 30,
};

/**
 * Timeouts em milissegundos
 */
const TIMEOUTS = {
    BUTTON_DISABLE: 30 * 60 * 1000,     // 30 minutos
    MODAL_EXPIRE: 15 * 60 * 1000,       // 15 minutos
    VERIFICATION_EXPIRE: 24 * 60 * 60 * 1000, // 24 horas
    TICKET_AUTO_CLOSE: 7 * 24 * 60 * 60 * 1000, // 7 dias
    CACHE_TTL: 5 * 60 * 1000,           // 5 minutos
    RATE_LIMIT_RESET: 60 * 1000,        // 1 minuto
};

/**
 * Mensagens de erro padrão
 */
const ERROR_MESSAGES = {
    NO_PERMISSION: '❌ Não tens permissão para usar este comando.',
    NOT_FOUND: '❌ Recurso não encontrado.',
    ALREADY_EXISTS: '❌ Este recurso já existe.',
    RATE_LIMITED: '⏳ Estás a fazer muitos pedidos. Tenta novamente em alguns segundos.',
    INVALID_INPUT: '❌ Dados inválidos fornecidos.',
    SYSTEM_ERROR: '❌ Ocorreu um erro interno. Tenta novamente mais tarde.',
    DATABASE_ERROR: '❌ Erro na base de dados. Contacta um administrador.',
    DISCORD_ERROR: '❌ Erro na comunicação com o Discord. Tenta novamente.',
    MAINTENANCE: '🔧 Sistema em manutenção. Tenta novamente mais tarde.',
    USER_NOT_VERIFIED: '❌ Precisas de estar verificado para usar esta funcionalidade.',
    COOLDOWN_ACTIVE: '⏳ Comando em cooldown. Tenta novamente em {time}.',
};

/**
 * Mensagens de sucesso padrão
 */
const SUCCESS_MESSAGES = {
    CREATED: '✅ Criado com sucesso!',
    UPDATED: '✅ Atualizado com sucesso!',
    DELETED: '✅ Eliminado com sucesso!',
    VERIFIED: '✅ Verificado com sucesso!',
    SENT: '✅ Enviado com sucesso!',
    SAVED: '✅ Guardado com sucesso!',
    COMPLETED: '✅ Completado com sucesso!',
};

module.exports = {
    BUTTON_IDS,
    MODAL_IDS,
    SELECT_IDS,
    INPUT_IDS,
    EMBED_COLORS,
    EMOJIS,
    LIMITS,
    TIMEOUTS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
};
