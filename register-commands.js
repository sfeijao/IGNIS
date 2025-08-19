const { REST, Routes } = require('discord.js');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando registro de comandos...');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Limpar cache do require
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    delete require.cache[require.resolve(filePath)];
}

for (const file of commandFiles) {
    try {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`✅ ${command.data.name}`);
        } else {
            console.log(`❌ ${file} - faltando propriedades`);
        }
    } catch (error) {
        console.log(`❌ ${file} - erro: ${error.message}`);
    }
}

console.log(`\n📦 ${commands.length} comandos para registrar`);

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('🔄 Registrando comandos no Discord...');
        
        const data = await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );

        console.log(`✅ ${data.length} comandos registrados!`);
        
        console.log('\n📋 Lista de comandos:');
        data.forEach(cmd => console.log(`   /${cmd.name}`));
        
        console.log('\n🎉 Registro completo!');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.code === 50001) {
            console.error('⚠️ Bot sem permissões suficientes no servidor');
        }
        if (error.code === 10004) {
            console.error('⚠️ Guild ID inválido');
        }
    }
})();
