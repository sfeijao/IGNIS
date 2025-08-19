const { REST, Routes } = require('discord.js');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('🔍 Verificando comandos...');

for (const file of commandFiles) {
    try {
        const filePath = path.join(commandsPath, file);
        delete require.cache[require.resolve(filePath)]; // Limpar cache
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`✅ Comando carregado: ${command.data.name}`);
        } else {
            console.log(`⚠️ Comando ${file} está faltando propriedades`);
        }
    } catch (error) {
        console.log(`❌ Erro no comando ${file}:`, error.message);
    }
}

console.log(`\n📦 Total de comandos a registrar: ${commands.length}`);

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('🚀 Iniciando deploy dos comandos...');
        
        const data = await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );

        console.log(`✅ ${data.length} comandos registrados com sucesso!`);
        console.log('\n📋 Comandos disponíveis:');
        data.forEach(cmd => {
            console.log(`   • /${cmd.name} - ${cmd.description}`);
        });
        
        console.log('\n🎉 Deploy completo! Os comandos devem aparecer no Discord agora.');
        
    } catch (error) {
        console.error('❌ Erro durante o deploy:', error.message);
        if (error.code) console.error('Código do erro:', error.code);
        if (error.rawError && error.rawError.message) {
            console.error('Detalhes:', error.rawError.message);
        }
    }
})();
