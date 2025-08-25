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

console.log('🤖 === YSNM Bot - Modo Bot-Only ===');
console.log(`⏰ Iniciando em: ${new Date().toISOString()}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🚂 Railway: ${process.env.RAILWAY_ENVIRONMENT_NAME || 'local'}`);

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
        
        console.log('✅ Configuração básica validada');
        console.log(`   Bot Token: ${botToken.substring(0, 20)}...`);
        console.log(`   Client ID: ${config.DISCORD.CLIENT_ID}`);
        console.log(`   Client Secret: ${config.DISCORD.CLIENT_SECRET ? 'Presente (modo completo)' : 'Ausente (modo bot-only)'}`);
        
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
        console.log('\n📂 Carregando comandos...');
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
                    console.log(`   ✅ ${command.data.name}`);
                } else {
                    console.log(`   ⚠️  ${file} - formato inválido`);
                }
            } catch (error) {
                console.log(`   ❌ ${file} - erro: ${error.message}`);
            }
        }
        
        console.log(`✅ ${loadedCommands} comandos carregados`);
        
        // Carregar eventos
        console.log('\n🎭 Carregando eventos...');
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
                console.log(`   ✅ ${event.name} (${event.once ? 'once' : 'on'})`);
            } catch (error) {
                console.log(`   ❌ ${file} - erro: ${error.message}`);
            }
        }
        
        console.log(`✅ ${loadedEvents} eventos carregados`);
        
        // Event listeners básicos
        client.once('ready', () => {
            console.log('\n🎉 === BOT PRONTO ===');
            console.log(`✅ Logado como: ${client.user.tag}`);
            console.log(`✅ ID: ${client.user.id}`);
            console.log(`✅ Servidores: ${client.guilds.cache.size}`);
            console.log(`✅ Usuários: ${client.users.cache.size}`);
            console.log(`✅ Latência: ${client.ws.ping}ms`);
            console.log(`⏰ Pronto em: ${new Date().toISOString()}`);
            
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
            console.error('❌ Erro do cliente Discord:', error);
            logger.error('Discord client error', error);
        });
        
        client.on('warn', (warning) => {
            console.warn('⚠️  Aviso do Discord:', warning);
            logger.warn('Discord warning', { warning });
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Recebido SIGINT, desligando bot...');
            client.destroy();
            process.exit(0);
        });
        
        process.on('SIGTERM', () => {
            console.log('\n🛑 Recebido SIGTERM, desligando bot...');
            client.destroy();
            process.exit(0);
        });
        
        // Login
        console.log('\n🔐 Conectando ao Discord...');
        await client.login(botToken);
        
    } catch (error) {
        console.error('❌ Erro fatal ao iniciar bot:', error);
        logger.error('Bot startup failed', error);
        process.exit(1);
    }
}

// Iniciar se executado diretamente
if (require.main === module) {
    startBotOnly();
}

module.exports = { startBotOnly };
