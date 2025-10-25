#!/usr/bin/env node

/**
 * 🚂 IGNIS Bot - Railway Smart Starter
 * 
 * Script inteligente para iniciar o bot no Railway com detecção automática
 * da configuração disponível e fallback para modo bot-only se necessário.
 */

const config = require('./utils/config');
const logger = require('./utils/logger');

logger.info('🚂 === IGNIS Bot - Railway Smart Starter ===');
logger.info(`⏰ Timestamp: ${new Date().toISOString()}`);
logger.info('🌍 NODE_ENV', { NODE_ENV: process.env.NODE_ENV });
logger.info('🚂 RAILWAY_ENVIRONMENT', { RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME });
logger.info('🏷️  RAILWAY_PROJECT', { RAILWAY_PROJECT_NAME: process.env.RAILWAY_PROJECT_NAME });
// Debug seguro da MONGO_URI
try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    const protoIndex = uri ? uri.indexOf('://') : -1;
    const atIndex = uri ? uri.indexOf('@') : -1;
    let masked = 'N/A';
    if (uri) {
        if (protoIndex !== -1 && atIndex !== -1 && atIndex > protoIndex) {
            const scheme = uri.substring(0, protoIndex + 3);
            const afterAt = uri.substring(atIndex + 1);
            masked = `${scheme}***@${afterAt}`;
        } else {
            masked = `${uri.split('://')[0] || 'mongodb'}://***`;
        }
    }
    const key = process.env.MONGO_URI ? 'MONGO_URI' : (process.env.MONGODB_URI ? 'MONGODB_URI' : 'none');
    logger.info(`🧩 Mongo env (Railway): present=${!!uri} key=${key} uri=${masked}`);
} catch {}

async function railwayStart() {
    try {
        // 1. Verificar configuração disponível
    logger.info('\n📋 Verificando configuração...');
        const botToken = config.DISCORD.TOKEN || config.DISCORD.BOT_TOKEN;
        const hasToken = !!botToken;
        const hasClientId = !!config.DISCORD.CLIENT_ID;
        const hasClientSecret = !!config.DISCORD.CLIENT_SECRET;
        
    logger.info(`   BOT_TOKEN: ${hasToken ? '✅ Presente' : '❌ AUSENTE'}`);
    logger.info(`   CLIENT_ID: ${hasClientId ? '✅ Presente' : '❌ AUSENTE'}`);
    logger.info(`   CLIENT_SECRET: ${hasClientSecret ? '✅ Presente' : '⚠️  Ausente'}`);
        
        // 2. Validar configuração mínima
        if (!hasToken) {
            throw new Error('❌ TOKEN/BOT_TOKEN é obrigatório - Configure na Railway');
        }
        
        if (!hasClientId) {
            throw new Error('❌ CLIENT_ID é obrigatório - Configure na Railway');
        }
        
        // 3. Determinar modo de operação
        let startMode;
        if (hasClientSecret) {
            startMode = 'full'; // Bot + Website completo
            logger.info('\n🎯 Modo selecionado: COMPLETO (Bot + Website)');
        } else {
            startMode = 'bot-only'; // Apenas bot Discord
            logger.info('\n🎯 Modo selecionado: BOT-ONLY (sem website)');
            logger.info('   ℹ️  CLIENT_SECRET não encontrado, website será desabilitado');
        }
        
        // 4. Deploy dos comandos primeiro
    logger.info('\n⚙️  Deploying comandos slash...');
        try {
            const deployCommands = require('./scripts/deploy-commands');
            if (typeof deployCommands === 'function') {
                await deployCommands();
            } else {
                // Se o script não exporta função, execute via child_process
                const { execSync } = require('child_process');
                execSync('node scripts/deploy-commands.js', { 
                    stdio: 'inherit',
                    cwd: __dirname 
                });
            }
            logger.info('✅ Comandos deployados com sucesso');
        } catch (deployError) {
            logger.warn('⚠️  Erro ao deploy comandos:', { error: deployError && deployError.message ? deployError.message : deployError });
            logger.warn('   Continuando mesmo assim...');
        }
        
        // 5. Iniciar modo apropriado
        if (startMode === 'full') {
            logger.info('\n🚀 Iniciando modo COMPLETO...');
            
            // Iniciar o index.js principal (bot + website)
            require('./index.js');
            
        } else {
            logger.info('\n🤖 Iniciando modo BOT-ONLY...');
            // No Railway, precisamos expor uma porta para o healthcheck mesmo em bot-only
            if (process.env.RAILWAY_ENVIRONMENT_NAME) {
                const express = require('express');
                const app = express();
                const port = process.env.PORT || 3000;

                app.get('/health', (req, res) => {
                    res.json({
                        status: 'ok',
                        timestamp: new Date().toISOString(),
                        environment: process.env.RAILWAY_ENVIRONMENT_NAME,
                        mode: 'bot-only'
                    });
                });

                app.listen(port, () => {
                    logger.info(`🏥 Health check (bot-only) ativo na porta ${port}`);
                });
            }
            
            // Iniciar apenas o bot
            const { startBotOnly } = require('./bot-only');
            await startBotOnly();
        }
        
        // 6. Log de sucesso
        logger.info('Railway startup completed', {
            mode: startMode,
            hasClientSecret,
            environment: process.env.RAILWAY_ENVIRONMENT_NAME
        });
        
    logger.info(`\n🎉 Bot iniciado com sucesso em modo ${startMode.toUpperCase()}!`);
        
    } catch (error) {
    logger.error('\n❌ === ERRO FATAL ===');
    logger.error(`❌ ${error.message}`);
    logger.error('\n🔧 Verificações necessárias:');
    logger.error('   1. DISCORD_TOKEN configurado na Railway');
    logger.error('   2. CLIENT_ID configurado na Railway');
    logger.error('   3. CLIENT_SECRET configurado na Railway (opcional para bot-only)');
    logger.error('\n📚 Consulte: RAILWAY_DEPLOYMENT.md');
        
        logger.error('Railway startup failed', {
            error: error.message,
            stack: error.stack,
            environment: process.env.RAILWAY_ENVIRONMENT_NAME
        });
        
        process.exit(1);
    }
}

// Iniciar se executado diretamente
if (require.main === module) {
    railwayStart();
}

module.exports = { railwayStart };
