#!/usr/bin/env node

/**
 * 🤖 YSNM Bot - Modo Bot-Only (sem website)
 * 
 * Script para iniciar apenas o bot Discord sem a interface web.
 * Útil para debugging e deployment quando CLIENT_SECRET não está disponível.
 */

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./utils/config');
const logger = require('./utils/logger');

logger.info('🤖 === YSNM Bot - Modo Bot-Only ===');
logger.info('⏰ Iniciando em: %s', new Date().toISOString());
logger.info('🌍 Environment: %s', process.env.NODE_ENV || 'development');
logger.info('🚂 Railway: %s', process.env.RAILWAY_ENVIRONMENT_NAME || 'local');

async function startBotOnly() {
    try {
        // Verificar configuração mínima
        const botToken = config.DISCORD.TOKEN || config.DISCORD.BOT_TOKEN;
        if (!botToken) {
            throw new Error('❌ TOKEN/BOT_TOKEN é obrigatório para iniciar o bot');
        }
        
        if (!config.DISCORD.CLIENT_ID) {
            throw new Error('❌ CLIENT_ID é obrigatório para comandos slash');
        }
        
    logger.info('✅ Configuração básica validada');
    logger.info('   Bot Token: %s...', botToken.substring(0, 20));
    logger.info('   Client ID: %s', config.DISCORD.CLIENT_ID);
    logger.info('   Client Secret: %s', config.DISCORD.CLIENT_SECRET ? 'Presente (modo completo)' : 'Ausente (modo bot-only)');
        
        // Criar cliente Discord
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent
            ]
        });
        
        // Collection para comandos
        client.commands = new Collection();
        
        // Carregar comandos
    logger.info('\n📂 Carregando comandos...');
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        let loadedCommands = 0;
        for (const file of commandFiles) {
            try {
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    loadedCommands++;
                    logger.info('   ✅ %s', command.data.name);
                } else {
                    logger.warn('   ⚠️  %s - formato inválido', file);
                }
            } catch (error) {
                logger.error('   ❌ %s - erro: %s', file, error && error.message ? error.message : error);
            }
        }
        
        logger.info('✅ %d comandos carregados', loadedCommands);
        
        // Carregar eventos
    logger.info('\n🎭 Carregando eventos...');
        const eventsPath = path.join(__dirname, 'events');
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
        
        let loadedEvents = 0;
        for (const file of eventFiles) {
            try {
                const filePath = path.join(eventsPath, file);
                const event = require(filePath);
                
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args));
                } else {
                    client.on(event.name, (...args) => event.execute(...args));
                }
                
        loadedEvents++;
        logger.info('   ✅ %s (%s)', event.name, event.once ? 'once' : 'on');
            } catch (error) {
        logger.error('   ❌ %s - erro: %s', file, error && error.message ? error.message : error);
            }
        }
        
    logger.info('✅ %d eventos carregados', loadedEvents);
        
        // Event listeners básicos
        client.once('ready', () => {
            logger.info('\n🎉 === BOT PRONTO ===');
            logger.info('✅ Logado como: %s', client.user.tag);
            logger.info('✅ ID: %s', client.user.id);
            logger.info('✅ Servidores: %d', client.guilds.cache.size);
            logger.info('✅ Usuários: %d', client.users.cache.size);
            logger.info('✅ Latência: %dms', client.ws.ping);
            logger.info('⏰ Pronto em: %s', new Date().toISOString());
            
            // Log para Railway
            logger.info('Bot iniciado com sucesso', {
                user: client.user.tag,
                guilds: client.guilds.cache.size,
                users: client.users.cache.size,
                ping: client.ws.ping,
                mode: 'bot-only'
            });
        });
        
        client.on('error', (error) => {
            logger.error('❌ Erro do cliente Discord', { error: error && error.message ? error.message : error, stack: error && error.stack });
        });
        
        client.on('warn', (warning) => {
            logger.warn('⚠️  Aviso do Discord', { warning });
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            logger.info('\n🛑 Recebido SIGINT, desligando bot...');
            client.destroy();
            process.exit(0);
        });
        
        process.on('SIGTERM', () => {
            logger.info('\n🛑 Recebido SIGTERM, desligando bot...');
            client.destroy();
            process.exit(0);
        });
        
        // Login
    logger.info('\n🔐 Conectando ao Discord...');
    await client.login(botToken);
        
    } catch (error) {
        logger.error('❌ Erro fatal ao iniciar bot', { error: error && error.message ? error.message : error, stack: error && error.stack });
        process.exit(1);
    }
}

// Iniciar se executado diretamente
if (require.main === module) {
    startBotOnly();
}

module.exports = { startBotOnly };
