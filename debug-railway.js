// Debug script para verificar variáveis no Railway
const logger = require('./utils/logger');
logger.info('🔍 Verificando configuração do Railway...');
const logger = require('./utils/logger');
logger.info('🔎 Verificando configuração do Railway...');

// Verificar se o arquivo config.json existe
try {
    const config = require('./config.json');
        logger.info('✅ config.json carregado com sucesso');
        logger.info('📊 Dados básicos:');
        logger.info(`   - Client ID: ${config.clientId ? 'Configurado' : 'FALTANDO'}`);
        logger.info(`   - Guild ID: ${config.guildId ? 'Configurado' : 'FALTANDO'}`);
        logger.info(`   - Token: ${config.token ? 'Configurado' : 'FALTANDO'}`);
} catch (error) {
    logger.error('❌ Erro ao carregar config.json:', { error: error && error.message ? error.message : error });
        logger.error('❌ Erro ao carregar config.json:', { error: error.message });
}

// Verificar variáveis de ambiente
logger.info('\n🌍 Variáveis de ambiente:');
logger.info('\n🌍 Variáveis de ambiente:');
logger.info(`   - DISCORD_TOKEN: ${process.env.DISCORD_TOKEN ? 'Configurado' : 'FALTANDO'}`);
logger.info(`   - CLIENT_ID: ${process.env.CLIENT_ID ? 'Configurado' : 'FALTANDO'}`);
logger.info(`   - GUILD_ID: ${process.env.GUILD_ID ? 'Configurado' : 'FALTANDO'}`);

// Verificar Node.js
logger.info('\n🟢 Node.js:', { version: process.version });
logger.info(`\n🖥️ Node.js: ${process.version}`);
logger.info(`🧭 Plataforma: ${process.platform}`);

// Verificar dependências
logger.info('\n📦 Verificando dependências...');
logger.info('\n📦 Verificando dependências...');
try {
    require('discord.js');
    logger.info('✅ discord.js carregado');
        logger.info('✅ discord.js carregado');
} catch (error) {
    logger.error('❌ discord.js não encontrado:', { error: error && error.message ? error.message : error });
        logger.error('❌ discord.js não encontrado:', { error: error.message });
}

try {
    require('dotenv');
    logger.info('✅ dotenv carregado');
        logger.info('✅ dotenv carregado');
} catch (error) {
    logger.error('❌ dotenv não encontrado:', { error: error && error.message ? error.message : error });
        logger.error('❌ dotenv não encontrado:', { error: error.message });
}

logger.info('\n🚀 Verificação completa!');
logger.info('\n🚀 Verificação completa!');
logger.info('==========================================');
