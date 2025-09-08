class RateLimit {
    constructor() {
        this.limits = new Map();
        // Limpar limites expirados a cada 15 minutos
        setInterval(() => this.cleanup(), 15 * 60 * 1000);
    }

    check(key, limit = 3, window = 3600000) { // window em ms (1 hora default)
        const now = Date.now();
        const userLimits = this.limits.get(key) || [];
        
        // Remover tentativas antigas
        const validAttempts = userLimits.filter(timestamp => now - timestamp < window);
        
        // Verificar se excedeu o limite
        if (validAttempts.length >= limit) {
            return {
                allowed: false,
                resetTime: validAttempts[0] + window,
                remaining: 0
            };
        }
        
        // Adicionar nova tentativa
        validAttempts.push(now);
        this.limits.set(key, validAttempts);
        
        return {
            allowed: true,
            resetTime: now + window,
            remaining: limit - validAttempts.length
        };
    }

    cleanup() {
        const now = Date.now();
        for (const [key, timestamps] of this.limits.entries()) {
            // Remover timestamps mais antigos que 24 horas
            const validTimestamps = timestamps.filter(ts => now - ts < 24 * 60 * 60 * 1000);
            if (validTimestamps.length === 0) {
                this.limits.delete(key);
            } else {
                this.limits.set(key, validTimestamps);
            }
        }
    }
}

module.exports = new RateLimit(); // Singleton instance
