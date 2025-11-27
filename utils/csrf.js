// utils/csrf.js - Proteção CSRF personalizada e moderna
const crypto = require('crypto');

class CSRFProtection {
    constructor() {
        this.tokens = new Map(); // Em produção, usar Redis
        this.cleanup();
    }

    /**
     * Gera um token CSRF único
     * @param {string} sessionId - ID da sessão
     * @returns {string} Token CSRF
     */
    generateToken(sessionId) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + (30 * 60 * 1000); // 30 minutos
        
        this.tokens.set(token, {
            sessionId,
            expires
        });
        
        return token;
    }

    /**
     * Valida um token CSRF
     * @param {string} token - Token a validar
     * @param {string} sessionId - ID da sessão atual
     * @returns {boolean} True se válido
     */
    validateToken(token, sessionId) {
        if (!token || !sessionId) return false;
        
        const tokenData = this.tokens.get(token);
        if (!tokenData) return false;
        
        // Verificar se expirou
        if (Date.now() > tokenData.expires) {
            this.tokens.delete(token);
            return false;
        }
        
        // Verificar se pertence à sessão
        if (tokenData.sessionId !== sessionId) return false;
        
        // Token válido - remover para uso único
        this.tokens.delete(token);
        return true;
    }

    /**
     * Middleware Express para proteção CSRF
     * @returns {Function} Middleware
     */
    middleware() {
        return (req, res, next) => {
            // Adicionar função para gerar token
            req.csrfToken = () => {
                if (!req.session) throw new Error('Sessão requerida para CSRF');
                return this.generateToken(req.sessionID);
            };

            // Para métodos seguros, apenas adicionar token
            if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                return next();
            }

            // Para métodos que modificam, validar token
            const token = req.headers['x-csrf-token'] || 
                         req.body._csrf || 
                         req.query._csrf;

            if (!this.validateToken(token, req.sessionID)) {
                return res.status(403).json({
                    error: 'CSRF token inválido',
                    code: 'INVALID_CSRF_TOKEN'
                });
            }

            next();
        };
    }

    /**
     * Iniciar limpeza periódica de tokens expirados
     */
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [token, data] of this.tokens.entries()) {
                if (now > data.expires) {
                    this.tokens.delete(token);
                }
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Parar cleanup e limpar timers
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// Singleton instance
const csrfProtection = new CSRFProtection();

module.exports = csrfProtection;
