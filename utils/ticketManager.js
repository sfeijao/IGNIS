'use strict';
// Deprecated legacy module: ticketManager
console.warn('[IGNIS] Deprecated module loaded: utils/ticketManager.js — using stub.');

module.exports = class TicketManager {
  constructor() {
    throw new Error('ticketManager is deprecated.');
  }
};
