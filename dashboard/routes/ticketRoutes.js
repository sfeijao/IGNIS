const express = require('express');
const { Router } = express;
const router = Router();

// Middleware de autenticação
const { checkAuth, checkGuildAdmin } = require('../middleware/auth');

// Controllers
const ticketController = require('../controllers/ticketController');
const webhookController = require('../controllers/webhookController');

// Rotas de Tickets
router.get('/tickets/:ticketId', checkAuth, ticketController.getTicket);
router.get('/guilds/:guildId/tickets', checkAuth, ticketController.getGuildTickets);
router.patch('/tickets/:ticketId', checkAuth, ticketController.updateTicket);
router.post('/tickets/:ticketId/messages', checkAuth, ticketController.addMessage);
router.get('/tickets/:ticketId/messages', checkAuth, ticketController.getMessages);
router.post('/tickets/:ticketId/participants', checkAuth, ticketController.addParticipant);
router.delete('/tickets/:ticketId/participants/:userId', checkAuth, ticketController.removeParticipant);
router.post('/tickets/:ticketId/transcript', checkAuth, ticketController.generateTranscript);
router.post('/tickets/:ticketId/export', checkAuth, ticketController.exportTicket);

// Rotas de Configuração de Webhooks (requer admin do servidor)
router.get('/guilds/:guildId/webhooks', checkAuth, checkGuildAdmin, webhookController.getWebhooks);
router.post('/guilds/:guildId/webhooks', checkAuth, checkGuildAdmin, webhookController.setWebhook);
router.patch('/guilds/:guildId/webhooks/:eventType/toggle', checkAuth, checkGuildAdmin, webhookController.toggleWebhook);
router.delete('/guilds/:guildId/webhooks/:eventType', checkAuth, checkGuildAdmin, webhookController.removeWebhook);
router.post('/guilds/:guildId/webhooks/test', checkAuth, checkGuildAdmin, webhookController.testWebhook);
router.get('/webhooks/stats', checkAuth, webhookController.getStats);

module.exports = router;
