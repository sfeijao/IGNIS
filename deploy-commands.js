const { REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const commands = [];

// Carregar comandos
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ Comando adicionado: ${command.data.name}`);
    } else {
        console.log(`⚠️ Comando em ${filePath} está faltando propriedades necessárias.`);
    }
}

// Configurar REST
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || config.token);

// Deploy dos comandos
(async () => {
    try {
        console.log(`🔄 Iniciando refresh de ${commands.length} comandos de aplicação (/).`);

        // Refresh global dos comandos
        const data = await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID || config.clientId, 
                process.env.GUILD_ID || config.guildId
            ),
            { body: commands },
        );

        console.log(`✅ ${data.length} comandos de aplicação (/) recarregados com sucesso.`);
        console.log('==========================================');
        console.log('🎉 Deploy completo! O bot está pronto para usar.');
        console.log('==========================================');
        
    } catch (error) {
        console.error('❌ Erro durante o deploy:', error);
    }
})();
