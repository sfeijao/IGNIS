// Simple in-memory lock manager for critical ticket actions.
// For production scale replace with Redis-based distributed lock.

const locks = new Map<string, Promise<void>>();

export async function withTicketLock<T>(ticketId: string, fn: () => Promise<T>): Promise<T> {
  // Chain promises to serialize actions per ticket
  const current = locks.get(ticketId) || Promise.resolve();
  let release: () => void;
  const p = new Promise<void>(res => { release = res; });
  locks.set(ticketId, current.then(() => p));
  try {
    const result = await fn();
    return result;
  } finally {
    release!();
    // Cleanup if chain resolved
    current.then(() => {
      if (locks.get(ticketId) === p) {
        locks.delete(ticketId);
      }
    }).catch(() => {});
  }
}
