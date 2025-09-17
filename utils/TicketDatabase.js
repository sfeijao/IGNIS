'use strict';
// Deprecated legacy module: TicketDatabase
// This module has been replaced by JSON storage in `utils/storage.js`.
// Loading this file will emit a warning; any attempt to use it will throw.

console.warn('[IGNIS] Deprecated module loaded: utils/TicketDatabase.js — using stub.');

class TicketDatabase {
  constructor() {
    throw new Error('TicketDatabase is deprecated and has been removed. Use utils/storage.js instead.');
  }
  static async init() { return null; }
  async query() { return { rows: [] }; }
}

module.exports = TicketDatabase;