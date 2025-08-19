// Debug script para verificar variáveis no Railway
console.log('🔍 Verificando configuração do Railway...');

// Verificar se o arquivo config.json existe
try {
    const config = require('./config.json');
    console.log('✅ config.json carregado com sucesso');
    console.log('📊 Dados básicos:');
    console.log('   - Client ID:', config.clientId ? 'Configurado' : 'FALTANDO');
    console.log('   - Guild ID:', config.guildId ? 'Configurado' : 'FALTANDO');
    console.log('   - Token:', config.token ? 'Configurado' : 'FALTANDO');
} catch (error) {
    console.error('❌ Erro ao carregar config.json:', error.message);
}

// Verificar variáveis de ambiente
console.log('\n🌍 Variáveis de ambiente:');
console.log('   - DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'Configurado' : 'FALTANDO');
console.log('   - CLIENT_ID:', process.env.CLIENT_ID ? 'Configurado' : 'FALTANDO');
console.log('   - GUILD_ID:', process.env.GUILD_ID ? 'Configurado' : 'FALTANDO');

// Verificar Node.js
console.log('\n🟢 Node.js:', process.version);
console.log('🟢 Plataforma:', process.platform);

// Verificar dependências
console.log('\n📦 Verificando dependências...');
try {
    require('discord.js');
    console.log('✅ discord.js carregado');
} catch (error) {
    console.error('❌ discord.js não encontrado:', error.message);
}

try {
    require('dotenv');
    console.log('✅ dotenv carregado');
} catch (error) {
    console.error('❌ dotenv não encontrado:', error.message);
}

console.log('\n🚀 Verificação completa!');
console.log('==========================================');
