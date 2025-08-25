const { Client, Collection, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Importar sistema do dashboard
const { server, socketManager } = require('./website/server');
const Database = require('./website/database/database');
const config = require('./utils/config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        // GatewayIntentBits.MessageContent, // Removido - só necessário se ler conteúdo de mensagens
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
        // GatewayIntentBits.GuildPresences // Removido - privilegiado e desnecessário
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
client.socketManager = socketManager;
client.database = new Database();

// Initialize database for bot
client.database.initialize().then(() => {
    console.log('✅ Bot database connection established');
}).catch(error => {
    console.error('❌ Bot database connection failed:', error);
});

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Comando carregado: ${command.data.name}`);
    } else {
        console.log(`⚠️ Comando em ${filePath} está faltando propriedades necessárias.`);
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`✅ Evento carregado: ${event.name}`);
}

// Tratamento de erros
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// Função para registrar comandos automaticamente
async function registerCommands() {
    try {
        console.log('🔄 Registrando comandos slash...');
        
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
        
        console.log(`✅ ${commands.length} comandos registrados com sucesso!`);
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
}

// Registrar comandos e fazer login
(async () => {
    await registerCommands();
    
    client.login(config.DISCORD.TOKEN).catch(error => {
        console.error('❌ Erro ao fazer login:', error);
        process.exit(1);
    });
})();

// Enhanced ready event (único)
client.once('ready', () => {
    console.log(`✅ Bot logado como ${client.user.tag}`);
    console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
    console.log(`👥 Usuários: ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`);
    
    console.log('✅ Integração com dashboard configurada');
});

// Registrar comandos e fazer login
(async () => {
    await registerCommands();
    
    client.login(config.DISCORD.TOKEN).catch(error => {
        console.error('❌ Erro ao fazer login:', error);
        process.exit(1);
    });
})();

// Enhanced ready event (único)
client.once('ready', () => {
    console.log(`✅ Bot logado como ${client.user.tag}`);
    console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
    console.log(`👥 Usuários: ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`);
    
    // Update bot status
    client.user.setActivity('🛡️ Dashboard ativo | /ajuda', { type: 'WATCHING' });
    
    // Tornar cliente disponível globalmente para o website
    global.discordClient = client;
    
    // Iniciar servidor web
    try {
        require('./website/server.js');
    } catch (error) {
        console.error('⚠️ Erro ao iniciar website de updates:', error);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down bot gracefully');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down bot gracefully');
    client.destroy();
    process.exit(0);
});

module.exports = client;
