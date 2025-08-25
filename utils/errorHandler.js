// utils/errorHandler.js - Sistema de tratamento de erros centralizado
const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS, EMOJIS, ERROR_MESSAGES } = require('../constants/ui');

class ErrorHandler {
    constructor() {
        this.errorCounts = new Map(); // Em produção, usar Redis
    }

    /**
     * Tratamento de erros de interação do Discord
     * @param {Interaction} interaction - Interação do Discord
     * @param {Error} error - Erro ocorrido
     * @param {string} context - Contexto onde ocorreu o erro
     */
    async handleInteractionError(interaction, error, context = 'Comando') {
        const errorId = this.generateErrorId();
        
        // Log estruturado do erro
        console.error(`[ERROR ${errorId}] ${context}:`, {
            error: error.message,
            stack: error.stack,
            userId: interaction.user?.id,
            guildId: interaction.guild?.id,
            commandName: interaction.commandName || interaction.customId,
            timestamp: new Date().toISOString()
        });

        // Incrementar contador de erros
        this.incrementErrorCount(error.name);

        // Responder ao usuário
        const errorEmbed = new EmbedBuilder()
            .setColor(EMBED_COLORS.ERROR)
            .setTitle(`${EMOJIS.ERROR} Erro no ${context}`)
            .setDescription(this.getErrorMessage(error))
            .addFields([
                { name: 'ID do Erro', value: `\`${errorId}\``, inline: true },
                { name: 'Suporte', value: 'Contacta um administrador se o problema persistir', inline: true }
            ])
            .setTimestamp();

        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        } catch (replyError) {
            console.error('Erro ao responder com mensagem de erro:', replyError);
        }

        return errorId;
    }

    /**
     * Tratamento de erros do bot em geral
     * @param {Error} error - Erro ocorrido
     * @param {string} context - Contexto onde ocorreu o erro
     * @param {Object} metadata - Metadados adicionais
     */
    handleBotError(error, context = 'Bot', metadata = {}) {
        const errorId = this.generateErrorId();
        
        console.error(`[ERROR ${errorId}] ${context}:`, {
            error: error.message,
            stack: error.stack,
            ...metadata,
            timestamp: new Date().toISOString()
        });

        this.incrementErrorCount(error.name);
        return errorId;
    }

    /**
     * Tratamento de erros de Express/Web
     * @param {Error} error - Erro ocorrido
     * @param {Request} req - Request Express
     * @param {Response} res - Response Express
     * @param {Function} next - Next function
     */
    handleWebError(error, req, res, next) {
        const errorId = this.generateErrorId();
        
        console.error(`[WEB ERROR ${errorId}]:`, {
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user?.id,
            timestamp: new Date().toISOString()
        });

        this.incrementErrorCount(error.name);

        // Resposta padronizada
        const status = error.status || 500;
        res.status(status).json({
            error: true,
            errorId,
            message: status === 500 ? 'Erro interno do servidor' : error.message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Middleware Express para captura de erros
     */
    expressMiddleware() {
        return (error, req, res, next) => {
            this.handleWebError(error, req, res, next);
        };
    }

    /**
     * Gera ID único para o erro
     * @returns {string} ID do erro
     */
    generateErrorId() {
        return `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase();
    }

    /**
     * Incrementa contador de erros por tipo
     * @param {string} errorType - Tipo do erro
     */
    incrementErrorCount(errorType) {
        const current = this.errorCounts.get(errorType) || 0;
        this.errorCounts.set(errorType, current + 1);
    }

    /**
     * Obter estatísticas de erros
     * @returns {Object} Estatísticas
     */
    getErrorStats() {
        return Object.fromEntries(this.errorCounts.entries());
    }

    /**
     * Mapear erro para mensagem amigável ao usuário
     * @param {Error} error - Erro ocorrido
     * @returns {string} Mensagem amigável
     */
    getErrorMessage(error) {
        // Mapear erros comuns para mensagens amigáveis
        const errorMap = {
            'DiscordAPIError': 'Erro de comunicação com o Discord',
            'ValidationError': 'Dados fornecidos são inválidos',
            'PermissionError': ERROR_MESSAGES.NO_PERMISSION,
            'TimeoutError': 'Operação expirou, tenta novamente',
            'DatabaseError': ERROR_MESSAGES.DATABASE_ERROR,
            'TokenInvalid': 'Token do bot inválido',
            'RateLimited': ERROR_MESSAGES.RATE_LIMITED
        };

        // Verificar por nome do erro
        for (const [errorName, message] of Object.entries(errorMap)) {
            if (error.name === errorName || error.message.includes(errorName)) {
                return message;
            }
        }

        // Verificar por códigos de erro do Discord
        if (error.code) {
            switch (error.code) {
                case 10008: return 'Mensagem não encontrada';
                case 10003: return 'Canal não encontrado';
                case 10004: return 'Servidor não encontrado';
                case 10013: return 'Utilizador não encontrado';
                case 50013: return 'Permissões insuficientes';
                case 50001: return 'Acesso negado';
                case 50035: return 'Formulário inválido';
                default: return ERROR_MESSAGES.DISCORD_ERROR;
            }
        }

        // Mensagem genérica para erros não mapeados
        return ERROR_MESSAGES.SYSTEM_ERROR;
    }

    /**
     * Limpar estatísticas antigas (executar periodicamente)
     */
    cleanupStats() {
        setInterval(() => {
            // Em produção, implementar lógica mais sofisticada
            if (this.errorCounts.size > 1000) {
                this.errorCounts.clear();
            }
        }, 60 * 60 * 1000); // 1 hora
    }
}

// Singleton instance
const errorHandler = new ErrorHandler();

// Configurar limpeza automática
errorHandler.cleanupStats();

module.exports = errorHandler;
