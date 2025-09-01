const fetch = global.fetch || require('node-fetch');
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

    const body = JSON.stringify(payload);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const signal = controller ? controller.signal : undefined;
            if (controller) setTimeout(() => controller.abort(), timeoutMs);

            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(url, { method: 'POST', headers, body, signal });
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
