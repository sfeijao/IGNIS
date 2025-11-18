const logger = require('./logger');

/**
 * Retry helper with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of function
 */
async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000, // 1 segundo
        maxDelay = 10000, // 10 segundos
        factor = 2,
        onRetry = null,
        retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'Internal Server Error']
    } = options;

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Verificar se é erro retryable
            const isRetryable = retryableErrors.some(err => 
                error.message?.includes(err) || 
                error.code === err ||
                error.status === 500 ||
                error.status === 502 ||
                error.status === 503 ||
                error.status === 504
            );

            if (!isRetryable || attempt === maxRetries) {
                throw error;
            }

            // Calcular delay com exponential backoff
            const delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);
            
            if (onRetry) {
                onRetry(attempt + 1, maxRetries, delay, error);
            } else {
                logger.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms:`, error.message);
            }

            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Rate limiter com token bucket algorithm
 */
class RateLimiter {
    constructor(maxTokens, refillRate) {
        this.maxTokens = maxTokens; // Máximo de tokens
        this.refillRate = refillRate; // Tokens por segundo
        this.tokens = maxTokens;
        this.lastRefill = Date.now();
    }

    async acquire(tokens = 1) {
        // Refill tokens baseado no tempo passado
        const now = Date.now();
        const timePassed = (now - this.lastRefill) / 1000; // segundos
        const tokensToAdd = timePassed * this.refillRate;
        
        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;

        // Verificar se há tokens suficientes
        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }

        // Calcular tempo de espera
        const tokensNeeded = tokens - this.tokens;
        const waitTime = (tokensNeeded / this.refillRate) * 1000;
        
        await sleep(waitTime);
        
        this.tokens = 0;
        this.lastRefill = Date.now();
        return true;
    }
}

/**
 * Rate limiter por key (ex: user ID, guild ID)
 */
class KeyedRateLimiter {
    constructor(maxTokens, refillRate, cleanupInterval = 60000) {
        this.limiters = new Map();
        this.maxTokens = maxTokens;
        this.refillRate = refillRate;

        // Cleanup de limiters inativos
        setInterval(() => {
            const now = Date.now();
            for (const [key, limiter] of this.limiters.entries()) {
                if (now - limiter.lastRefill > cleanupInterval) {
                    this.limiters.delete(key);
                }
            }
        }, cleanupInterval);
    }

    async acquire(key, tokens = 1) {
        if (!this.limiters.has(key)) {
            this.limiters.set(key, new RateLimiter(this.maxTokens, this.refillRate));
        }
        
        return await this.limiters.get(key).acquire(tokens);
    }

    check(key) {
        const limiter = this.limiters.get(key);
        if (!limiter) return { allowed: true, tokens: this.maxTokens };
        
        // Refill tokens
        const now = Date.now();
        const timePassed = (now - limiter.lastRefill) / 1000;
        const currentTokens = Math.min(limiter.maxTokens, limiter.tokens + (timePassed * limiter.refillRate));
        
        return {
            allowed: currentTokens >= 1,
            tokens: Math.floor(currentTokens),
            waitTime: currentTokens < 1 ? ((1 - currentTokens) / limiter.refillRate) * 1000 : 0
        };
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    retryWithBackoff,
    RateLimiter,
    KeyedRateLimiter,
    sleep
};
