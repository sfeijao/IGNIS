#!/usr/bin/env node

/**
 * 🩺 IGNIS Bot - Health Check & Quick Status
 * 
 * Este arquivo é um health check simples para verificar se o bot está funcionando
 * corretamente no Railway. Não requer autenticação e verifica componentes básicos.
 */

const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./utils/config');
const logger = require('./utils/logger');

async function healthCheck() {
    logger.info('🩺 === IGNIS Bot Health Check ===');
    logger.info(`⏰ Timestamp: ${new Date().toISOString()}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🚂 Railway: ${process.env.RAILWAY_ENVIRONMENT_NAME || 'local'}`);
    
    const results = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        railway: process.env.RAILWAY_ENVIRONMENT_NAME || 'local',
        status: 'starting',
        checks: {}
    };
    
    try {
        // 1. Verificar configuração
    logger.info('\n📋 1. Verificando configuração...');
        results.checks.config = {
            status: 'ok',
            hasToken: !!(config.DISCORD.TOKEN || config.DISCORD.BOT_TOKEN),
            hasClientId: !!config.DISCORD.CLIENT_ID,
            hasClientSecret: !!config.DISCORD.CLIENT_SECRET,
            mode: config.DISCORD.CLIENT_SECRET ? 'full' : 'bot-only'
        };
        
    logger.info(`   ✅ Bot Token: ${results.checks.config.hasToken ? 'Presente' : 'AUSENTE'}`);
    logger.info(`   ✅ Client ID: ${results.checks.config.hasClientId ? 'Presente' : 'AUSENTE'}`);
    logger.info(`   ${config.DISCORD.CLIENT_SECRET ? '✅' : '⚠️ '} Client Secret: ${results.checks.config.hasClientSecret ? 'Presente' : 'AUSENTE'}`);
    logger.info(`   📋 Modo: ${results.checks.config.mode}`);
        
        // 2. Teste de conexão Discord (rápido)
    logger.info('\n🔌 2. Testando conexão Discord...');
        
        const botToken = config.DISCORD.TOKEN || config.DISCORD.BOT_TOKEN;
        if (!botToken) {
            throw new Error('TOKEN/BOT_TOKEN não configurado');
        }
        
        const client = new Client({ 
            intents: [GatewayIntentBits.Guilds] 
        });
        
        const connectionPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout de conexão (10s)'));
            }, 10000);
            
            client.once('ready', () => {
                clearTimeout(timeout);
                resolve({
                    status: 'connected',
                    user: client.user.tag,
                    id: client.user.id,
                    guilds: client.guilds.cache.size,
                    ping: client.ws.ping
                });
            });
            
            client.once('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
        
        await client.login(botToken);
        results.checks.discord = await connectionPromise;
        
    logger.info(`   ✅ Bot conectado: ${results.checks.discord.user}`);
    logger.info(`   ✅ Servidores: ${results.checks.discord.guilds}`);
    logger.info(`   ✅ Latência: ${results.checks.discord.ping}ms`);
        
        // Desconectar após teste
        client.destroy();
        
        // 3. Verificar database
    logger.info('\n💾 3. Verificando database...');
        try {
            const db = require('./website/database/database');
            
            // Verificar se método init existe, senão usar query diretamente
            if (typeof db.init === 'function') {
                await db.init();
            }
            
            // Teste simples de query
            const testResult = await db.query('SELECT 1 as test');
            results.checks.database = {
                status: 'ok',
                connection: 'working',
                testQuery: testResult.length > 0
            };
            
            logger.info('   ✅ Database conectado e funcional');
        } catch (dbError) {
            results.checks.database = {
                status: 'warning',
                error: dbError.message,
                note: 'Database não crítico para funcionamento do bot'
            };
            logger.warn(`   ⚠️  Database aviso: ${dbError.message}`);
            logger.info('   ℹ️  Bot funcionará normalmente sem database');
        }
        
    results.status = 'healthy';
    logger.info('\n🎉 === Health Check CONCLUÍDO ===');
    logger.info('✅ Bot está funcionando corretamente!');
        
    } catch (error) {
        results.status = 'unhealthy';
        results.error = error.message;
        results.checks.discord = {
            status: 'error',
            error: error.message
        };
        
    logger.error(`\n❌ === Health Check FALHOU ===`);
    logger.error(`❌ Erro: ${error.message}`);
        process.exit(1);
    }
    
    // Output JSON para automação
    logger.info('\n📊 === Resultado JSON ===');
    logger.info(JSON.stringify(results, null, 2));
    
    return results;
}

// Executar se chamado diretamente
if (require.main === module) {
    healthCheck().catch(error => {
        logger.error('❌ Health check falhou:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        process.exit(1);
    });
}

module.exports = healthCheck;
