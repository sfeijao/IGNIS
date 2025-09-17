'use strict';
// Deprecated legacy module: TicketInteractionHandler
// Replaced by communityTickets.js and events/ticketHandler.js
console.warn('[IGNIS] Deprecated module loaded: utils/TicketInteractionHandler.js — using stub.');

module.exports = class TicketInteractionHandler {
  constructor() {
    throw new Error('TicketInteractionHandler is deprecated. Use utils/communityTickets.js and events/ticketHandler.js');
  }
};