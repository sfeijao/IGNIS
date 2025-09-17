// Deprecated legacy module: ticketUtils
'use strict';
console.warn('[IGNIS] Deprecated module loaded: utils/ticketUtils.js — using stub.');

module.exports = {
  createTicket: async () => { throw new Error('ticketUtils is deprecated. Use utils/communityTickets.js instead.'); },
};
