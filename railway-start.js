#!/usr/bin/env node

/**
 * 🚂 YSNM Bot - Railway Smart Starter
 * 
 * Script inteligente para iniciar o bot no Railway com detecção automática
 * da configuração disponível e fallback para modo bot-only se necessário.
 */

const config = require('./utils/config');
const logger = require('./utils/logger');

console.log('🚂 === YSNM Bot - Railway Smart Starter ===');
console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`🚂 RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT_NAME}`);
console.log(`🏷️  RAILWAY_PROJECT: ${process.env.RAILWAY_PROJECT_NAME}`);

async function railwayStart() {
    try {
        // 1. Verificar configuração disponível
        console.log('\n📋 Verificando configuração...');
        const botToken = config.DISCORD.TOKEN || config.DISCORD.BOT_TOKEN;
        const hasToken = !!botToken;
        const hasClientId = !!config.DISCORD.CLIENT_ID;
        const hasClientSecret = !!config.DISCORD.CLIENT_SECRET;
        
        console.log(`   BOT_TOKEN: ${hasToken ? '✅ Presente' : '❌ AUSENTE'}`);
        console.log(`   CLIENT_ID: ${hasClientId ? '✅ Presente' : '❌ AUSENTE'}`);
        console.log(`   CLIENT_SECRET: ${hasClientSecret ? '✅ Presente' : '⚠️  Ausente'}`);
        
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
            console.log('\n🎯 Modo selecionado: COMPLETO (Bot + Website)');
        } else {
            startMode = 'bot-only'; // Apenas bot Discord
            console.log('\n🎯 Modo selecionado: BOT-ONLY (sem website)');
            console.log('   ℹ️  CLIENT_SECRET não encontrado, website será desabilitado');
        }
        
        // 4. Deploy dos comandos primeiro
        console.log('\n⚙️  Deploying comandos slash...');
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
            console.log('✅ Comandos deployados com sucesso');
        } catch (deployError) {
            console.warn('⚠️  Erro ao deploy comandos:', deployError.message);
            console.warn('   Continuando mesmo assim...');
        }
        
        // 5. Iniciar modo apropriado
        if (startMode === 'full') {
            console.log('\n🚀 Iniciando modo COMPLETO...');
            
            // Iniciar o index.js principal (bot + website)
            require('./index.js');
            
        } else {
            console.log('\n🤖 Iniciando modo BOT-ONLY...');
            
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
        
        console.log(`\n🎉 Bot iniciado com sucesso em modo ${startMode.toUpperCase()}!`);
        
    } catch (error) {
        console.error('\n❌ === ERRO FATAL ===');
        console.error(`❌ ${error.message}`);
        console.error('\n🔧 Verificações necessárias:');
        console.error('   1. DISCORD_TOKEN configurado na Railway');
        console.error('   2. CLIENT_ID configurado na Railway');
        console.error('   3. CLIENT_SECRET configurado na Railway (opcional para bot-only)');
        console.error('\n📚 Consulte: RAILWAY_DEPLOYMENT.md');
        
        logger.error('Railway startup failed', {
            error: error.message,
            stack: error.stack,
            environment: process.env.RAILWAY_ENVIRONMENT_NAME
        });
        
        process.exit(1);
    }
}

// Health check endpoint básico para Railway
if (process.env.RAILWAY_ENVIRONMENT_NAME) {
    const express = require('express');
    const app = express();
    const port = process.env.PORT || 3000;
    
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            environment: process.env.RAILWAY_ENVIRONMENT_NAME,
            mode: config.DISCORD.CLIENT_SECRET ? 'full' : 'bot-only'
        });
    });
    
    app.listen(port, () => {
        console.log(`🏥 Health check endpoint ativo na porta ${port}`);
    });
}

// Iniciar se executado diretamente
if (require.main === module) {
    railwayStart();
}

module.exports = { railwayStart };
