const fetch = global.fetch || require('node-fetch');
const crypto = require('crypto');
const logger = require('../../utils/logger');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Send JSON payload to a private endpoint with optional Bearer token and retries.
 * Returns true on success, false on final failure.
 */
async function sendToPrivateEndpoint(url, token, payload, opts = {}) {
    if (!url) return false;
    const maxAttempts = opts.maxAttempts || 3;
    const timeoutMs = opts.timeoutMs || 8000;
    // Normalize token if provided (trim and strip surrounding quotes)
    let TOKEN = token ? String(token).trim() : null;
    if (TOKEN && ((TOKEN.startsWith('"') && TOKEN.endsWith('"')) || (TOKEN.startsWith("'") && TOKEN.endsWith("'")))) {
        TOKEN = TOKEN.slice(1, -1).trim();
    }

    // HMAC secret: prefer opts.hmacSecret, fallback to env var
    let HMAC = opts.hmacSecret ? String(opts.hmacSecret).trim() : (process.env.PRIVATE_LOG_HMAC_SECRET ? String(process.env.PRIVATE_LOG_HMAC_SECRET).trim() : null);
    if (HMAC && ((HMAC.startsWith('"') && HMAC.endsWith('"')) || (HMAC.startsWith("'") && HMAC.endsWith("'")))) {
        HMAC = HMAC.slice(1, -1).trim();
    }
    const HMAC_TTL = opts.hmacTtl || (process.env.PRIVATE_LOG_HMAC_TTL ? parseInt(process.env.PRIVATE_LOG_HMAC_TTL, 10) : 300);
    const TIMESTAMP_HEADER = opts.timestampHeader || 'X-Timestamp';

    const body = JSON.stringify(payload);
    const bodyBuf = Buffer.from(body, 'utf8');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const signal = controller ? controller.signal : undefined;
            if (controller) setTimeout(() => controller.abort(), timeoutMs);

            const headers = { 'Content-Type': 'application/json' };
            if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

            // If HMAC secret available, compute signature over exact bytes and add header
            if (HMAC) {
                try {
                    // Prefer timestamped signature if TTL enabled
                    const ts = Date.now();
                    headers[TIMESTAMP_HEADER] = String(ts);
                    const buf = Buffer.concat([Buffer.from(String(ts) + '.'), bodyBuf]);
                    const sig = crypto.createHmac('sha256', HMAC).update(buf).digest('hex');
                    headers['X-Signature'] = `sha256=${sig}`;
                } catch (e) {
                    logger.warn('Failed to compute HMAC signature for private endpoint', { error: e && e.message ? e.message : e });
                }
            }

            const res = await fetch(url, { method: 'POST', headers, body: bodyBuf, signal });
            if (res.ok) return true;
            logger.warn('Private endpoint responded non-OK', { url, status: res.status, statusText: res.statusText, attempt });
        } catch (err) {
            logger.warn('Error sending to private endpoint', { url, error: err && err.message ? err.message : err, attempt });
        }

        if (attempt < maxAttempts) await sleep(500 * attempt);
    }
    return false;
}

module.exports = { sendToPrivateEndpoint };
