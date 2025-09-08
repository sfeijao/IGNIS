const { 
    Client, 
    Collection, 
    GatewayIntentBits, 
    Partials,
    REST,
    Routes
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./utils/config');
const logger = require('./utils/logger');
const storage = require('./utils/storage');
const TicketManager = require('./utils/ticketManager');

// Iniciar dashboard se CLIENT_SECRET estiver disponível
if (config.DISCORD.CLIENT_SECRET) {
    logger.info('✅ CLIENT_SECRET disponível - iniciando dashboard');
    require('./dashboard/server');
} else {
    logger.warn('⚠️  CLIENT_SECRET não disponível - dashboard desabilitado');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
    ]
});

client.commands = new Collection();

// Setup storage
client.storage = storage;

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    logger.info(`✅ Comando carregado: ${command.data.name}`);
    } else {
        logger.warn(`⚠️ Comando em ${filePath} está faltando propriedades necessárias.`);
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'))
    .filter(file => file !== 'ticketHandler.js'); // Remove ticketHandler.js (replaced by ticketInteractions.js)

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
    logger.info(`✅ Evento carregado: ${event.name} (${file})`);
}

// Tratamento de erros
process.on('unhandledRejection', error => {
    logger.error('❌ Unhandled promise rejection', { error: error && error.message ? error.message : error, stack: error && error.stack });
});

process.on('uncaughtException', error => {
    logger.error('❌ Uncaught exception', { error: error && error.message ? error.message : error, stack: error && error.stack });
    process.exit(1);
});

// Função para registrar comandos automaticamente
async function registerCommands() {
    try {
    logger.info('🔄 Registrando comandos slash...');
        
        const commands = [];
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            }
        }

        const rest = new REST({ version: '10' }).setToken(config.DISCORD.TOKEN);
        
        await rest.put(
            Routes.applicationGuildCommands(config.DISCORD.CLIENT_ID, config.DISCORD.GUILD_ID),
            { body: commands }
        );
        
    logger.info(`✅ ${commands.length} comandos registrados com sucesso!`);
    } catch (error) {
    logger.error('❌ Erro ao registrar comandos', { error: error && error.message ? error.message : error, stack: error && error.stack });
    }
}

// Registrar comandos e fazer login
(async () => {
    await registerCommands();
    
    client.login(config.DISCORD.TOKEN).catch(error => {
        logger.error('❌ Erro ao fazer login:', { error: error && error.message ? error.message : error, stack: error && error.stack });
        process.exit(1);
    });
})();

// Enhanced ready event
client.once('ready', () => {
    logger.info(`✅ Bot logado como ${client.user.tag}`);
    logger.info(`🏠 Servidores: ${client.guilds.cache.size}`);
    logger.info(`👥 Usuários: ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`);
    
    // Update bot status
    client.user.setActivity('🤖 Bot ativo | /ajuda', { type: 'WATCHING' });
    
    // Tornar cliente disponível globalmente para o dashboard
    global.discordClient = client;
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('🛑 SIGTERM received, shutting down bot gracefully');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('🛑 SIGINT received, shutting down bot gracefully');
    client.destroy();
    process.exit(0);
});

module.exports = client;
