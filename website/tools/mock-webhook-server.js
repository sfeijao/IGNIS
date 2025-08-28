const express = require('express');
const bodyParser = require('body-parser');

function startMockWebhookServer(port = 4005) {
    const app = express();
    app.use(bodyParser.json());

    let received = [];

    app.post('/webhook', (req, res) => {
    const logger = require('../../utils/logger');
    logger.info('Mock webhook received', { embeds: req.body?.embeds ? req.body.embeds.length : 0 });
        received.push({ body: req.body, headers: req.headers });
        res.status(204).send();
    });

    const logger = require('../../utils/logger');
    const server = app.listen(port, () => logger.info(`Mock webhook server listening on http://localhost:${port}/webhook`));

    return {
        url: `http://localhost:${port}/webhook`,
        server,
        getReceived: () => received,
        stop: () => new Promise(resolve => server.close(resolve))
    };
}

module.exports = { startMockWebhookServer };
