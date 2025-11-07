const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.WEBSITE_PORT || 3001;

// Middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Normaliza caminhos duplicados /next/next/... para /next/... (previne 404 em prefetch do Next)
app.use((req, _res, next) => {
    try {
        if (typeof req.url === 'string' && req.url.startsWith('/next/next/')) {
            let rest = req.url.slice(1); // remove '/'
            while (rest.startsWith('next/')) rest = rest.slice('next/'.length);
            req.url = '/next/' + rest;
        }
    } catch {}
    next();
});

// Servir o dashboard Next.js exportado estaticamente sob /next
// O export final é gerado em dashboard/public/next-export
try {
    const NEXT_EXPORT_DIR = path.join(__dirname, '..', 'dashboard', 'public', 'next-export');
    app.use('/next', express.static(NEXT_EXPORT_DIR, { index: 'index.html', redirect: false }));
    console.log(`📦 /next servido a partir de: ${NEXT_EXPORT_DIR}`);
} catch {}

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
