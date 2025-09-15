const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.WEBSITE_PORT || 3001;

// Middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal - serve o dashboard.html como index
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Rota para health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'IGNIS Website',
        timestamp: new Date().toISOString()
    });
});

// Middleware para páginas não encontradas
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Página não encontrada</title>
            <style>
                body { font-family: Arial, sans-serif; background: #0F1419; color: #fff; text-align: center; padding: 50px; }
                h1 { color: #9932CC; }
                a { color: #7B68EE; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <h1>404 - Página não encontrada</h1>
            <p>A página que procura não existe.</p>
            <a href="/">← Voltar ao início</a>
        </body>
        </html>
    `);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🌐 IGNIS Website rodando em http://localhost:${PORT}`);
    console.log(`📁 Servindo arquivos de: ${path.join(__dirname, 'public')}`);
});

module.exports = app;