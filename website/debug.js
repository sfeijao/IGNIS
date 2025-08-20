const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// Debug das variáveis de ambiente
console.log('🔍 Todas as variáveis de ambiente relevantes:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('RAILWAY_ENVIRONMENT_NAME:', process.env.RAILWAY_ENVIRONMENT_NAME);
console.log('RAILWAY_PROJECT_NAME:', process.env.RAILWAY_PROJECT_NAME);
console.log('RAILWAY_SERVICE_NAME:', process.env.RAILWAY_SERVICE_NAME);
console.log('PORT:', process.env.PORT);

// Carregar configuração
let config;
try {
    config = require('../config.json');
    console.log('✅ Config carregado com sucesso');
    console.log('Client ID:', config.clientId ? 'PRESENTE' : 'AUSENTE');
    console.log('Client Secret:', config.clientSecret ? 'PRESENTE' : 'AUSENTE');
} catch (error) {
    console.log('❌ Erro ao carregar config:', error.message);
    process.exit(1);
}

// Detectar ambiente
const isProduction = !!(process.env.NODE_ENV === 'production' || 
                       process.env.RAILWAY_ENVIRONMENT_NAME || 
                       process.env.RAILWAY_PROJECT_NAME ||
                       process.env.RAILWAY_SERVICE_NAME ||
                       (process.env.PORT && process.env.PORT !== '3001'));

console.log('🔍 Lógica de detecção:');
console.log('   NODE_ENV === production:', process.env.NODE_ENV === 'production');
console.log('   RAILWAY_ENVIRONMENT_NAME exists:', !!process.env.RAILWAY_ENVIRONMENT_NAME);
console.log('   RAILWAY_PROJECT_NAME exists:', !!process.env.RAILWAY_PROJECT_NAME);
console.log('   RAILWAY_SERVICE_NAME exists:', !!process.env.RAILWAY_SERVICE_NAME);
console.log('   PORT different from 3001:', !!(process.env.PORT && process.env.PORT !== '3001'));

const callbackURL = isProduction ? 
    (config.website?.production?.redirectUri || 'https://ysnmbot-alberto.up.railway.app/auth/discord/callback') :
    (config.website?.redirectUri || 'http://localhost:3001/auth/discord/callback');

console.log('🏷️ Ambiente detectado:', isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO');
console.log('🔗 Callback URL configurado:', callbackURL);

// Rota simples para testar
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        ambiente: isProduction ? 'produção' : 'desenvolvimento',
        callbackURL: callbackURL,
        timestamp: new Date().toISOString()
    });
});

// Rota para testar OAuth2
app.get('/auth/discord', (req, res) => {
    const discordOAuthURL = `https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(callbackURL)}&response_type=code&scope=identify%20guilds`;
    console.log('🔗 Redirecionando para:', discordOAuthURL);
    res.redirect(discordOAuthURL);
});

app.get('/auth/discord/callback', (req, res) => {
    const { code, error } = req.query;
    if (error) {
        console.log('❌ Erro OAuth2:', error);
        return res.json({ error, message: 'Erro na autenticação Discord' });
    }
    console.log('✅ Callback recebido com código:', code ? 'PRESENTE' : 'AUSENTE');
    res.json({ success: true, code: code ? 'RECEBIDO' : 'AUSENTE' });
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor de debug rodando na porta ${PORT}`);
    console.log(`🔑 Teste OAuth2 em: http://localhost:${PORT}/auth/discord`);
});

module.exports = app;
