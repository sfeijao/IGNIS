"use strict";
// Simple in-memory lock manager for critical ticket actions.
// For production scale replace with Redis-based distributed lock.
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTicketLock = withTicketLock;
const locks = new Map();
async function withTicketLock(ticketId, fn) {
    // Chain promises to serialize actions per ticket
    const current = locks.get(ticketId) || Promise.resolve();
    let release;
    const p = new Promise(res => { release = res; });
    locks.set(ticketId, current.then(() => p));
    try {
        const result = await fn();
        return result;
    }
    finally {
        release();
        // Cleanup if chain resolved
        current.then(() => {
            if (locks.get(ticketId) === p) {
                locks.delete(ticketId);
            }
        }).catch(() => { });
    }
}
