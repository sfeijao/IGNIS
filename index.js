const { Client, Collection, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Importar sistema do dashboard
const { server, socketManager } = require('./website/server');
const Database = require('./website/database/database');

// Carregar configuração com fallback
let config;
try {
    config = require('./config.json');
    console.log('✅ Config.json carregado');
} catch (error) {
    console.log('⚠️ Config.json não encontrado, usando variáveis de ambiente');
    config = {
        clientId: process.env.CLIENT_ID,
        guildId: process.env.GUILD_ID,
        token: process.env.DISCORD_TOKEN
    };
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences
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

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || config.token);
        
        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );
        
        console.log(`✅ ${commands.length} comandos registrados com sucesso!`);
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
}

// Setup event handlers for dashboard integration
function setupDashboardIntegration() {
    // Message events for analytics
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        try {
            await client.database.recordAnalytics(
                message.guild.id, 
                'message_created', 
                1,
                {
                    channelId: message.channel.id,
                    authorId: message.author.id
                }
            );
            
            // Send real-time update to dashboard
            if (socketManager) {
                socketManager.onDiscordEvent('messageCreate', message.guild.id, {
                    channelId: message.channel.id,
                    authorId: message.author.id,
                    content: message.content
                });
            }
        } catch (error) {
            console.error('Erro ao processar mensagem para analytics:', error);
        }
    });
    
    // Member join/leave events
    client.on('guildMemberAdd', async (member) => {
        try {
            // Log member join to database
            try {
                await client.database.createLog({
                    guild_id: member.guild.id,
                    type: 'member_join',
                    user_id: member.id,
                    data: {
                        username: member.user.username,
                        description: `${member.user.username} entrou no servidor`
                    }
                });
            } catch (dbError) {
                console.error('Erro ao registrar entrada de membro no banco de dados:', dbError);
            }
            
            // Send socket event
            if (socketManager) {
                socketManager.onDiscordEvent('guildMemberAdd', member.guild.id, {
                    userId: member.id,
                    username: member.user.username
                });
            }
        } catch (error) {
            console.error('Erro ao processar entrada de membro:', error);
        }
    });
    
    client.on('guildMemberRemove', async (member) => {
        try {
            // Log member leave to database
            try {
                await client.database.createLog({
                    guild_id: member.guild.id,
                    type: 'member_leave',
                    user_id: member.id,
                    data: {
                        username: member.user.username,
                        description: `${member.user.username} saiu do servidor`
                    }
                });
            } catch (dbError) {
                console.error('Erro ao registrar saída de membro no banco de dados:', dbError);
            }
            
            // Send socket event
            if (socketManager) {
                socketManager.onDiscordEvent('guildMemberRemove', member.guild.id, {
                    userId: member.id,
                    username: member.user.username
                });
            }
        } catch (error) {
            console.error('Erro ao processar saída de membro:', error);
        }
    });
    
    // Voice state updates
    client.on('voiceStateUpdate', async (oldState, newState) => {
        try {
            const guildId = newState.guild.id;
            const userId = newState.id;
            
            if (oldState.channelId === null && newState.channelId !== null) {
                // User joined voice channel
                if (socketManager) {
                    socketManager.onDiscordEvent('voiceStateUpdate', guildId, {
                        userId,
                        channelId: newState.channelId,
                        channelName: newState.channel.name,
                        joined: true
                    });
                }
            } else if (oldState.channelId !== null && newState.channelId === null) {
                // User left voice channel
                if (socketManager) {
                    socketManager.onDiscordEvent('voiceStateUpdate', guildId, {
                        userId,
                        channelId: oldState.channelId,
                        channelName: oldState.channel.name,
                        left: true
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao processar mudança de voz:', error);
        }
    });
    
    // Message delete events
    client.on('messageDelete', async (message) => {
        if (!message.guild || message.author?.bot) return;
        
        try {
            if (socketManager) {
                socketManager.onDiscordEvent('messageDelete', message.guild.id, {
                    channelId: message.channel.id,
                    channelName: message.channel.name,
                    authorId: message.author?.id,
                    messageId: message.id,
                    content: message.content
                });
            }
        } catch (error) {
            console.error('Erro ao processar mensagem deletada:', error);
        }
    });
    
    console.log('✅ Integração com dashboard configurada');
}

// Registrar comandos e fazer login
(async () => {
    await registerCommands();
    
    client.login(process.env.DISCORD_TOKEN || config.token).catch(error => {
        console.error('❌ Erro ao fazer login:', error);
        process.exit(1);
    });
})();

// Enhanced ready event (único)
client.once('ready', () => {
    console.log(`✅ Bot logado como ${client.user.tag}`);
    console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
    console.log(`👥 Usuários: ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`);
    
    // Setup dashboard integration
    setupDashboardIntegration();
    
    // Update bot status
    client.user.setActivity('🛡️ Dashboard ativo | /help', { type: 'WATCHING' });
    
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
