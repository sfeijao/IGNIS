#!/usr/bin/env node
// scripts/migrate-to-env.js - Script para migrar config.json para .env
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔄 Iniciando migração de config.json para .env...\n');

const configPath = path.join(__dirname, '..', 'config.json');
const envPath = path.join(__dirname, '..', '.env');

// Verificar se config.json existe
if (!fs.existsSync(configPath)) {
    console.log('❌ config.json não encontrado. Nada para migrar.');
    process.exit(0);
}

try {
    // Ler config.json
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ config.json carregado');
    
    // Verificar se .env já existe
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
        console.log('⚠️  .env já existe - será atualizado');
    }
    
    // Gerar SESSION_SECRET seguro se não existir
    const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
    
    // Construir novo conteúdo .env
    const newEnvContent = `# =================================
# YSNM BOT - CONFIGURAÇÃO MIGRADA
# =================================

# Ambiente
NODE_ENV=development

# Discord Configuration
DISCORD_TOKEN=${config.token || 'SEU_TOKEN_AQUI'}
CLIENT_ID=${config.clientId || 'SEU_CLIENT_ID_AQUI'}
CLIENT_SECRET=${config.clientSecret || 'SEU_CLIENT_SECRET_AQUI'}
GUILD_ID=${config.guildId || 'SEU_GUILD_ID_AQUI'}

# Website Configuration
BASE_URL=${config.website?.baseUrl || 'http://localhost:4000'}
PORT=4000
SESSION_SECRET=${sessionSecret}
CALLBACK_URL=/auth/discord/callback

# Channels Configuration
UPDATES_CHANNEL_ID=${config.channels?.updates || ''}
VERIFICATION_CHANNEL_ID=${config.channels?.verification || ''}
LOGS_CHANNEL_ID=${config.channels?.logs || ''}
TICKETS_CHANNEL_ID=${config.channels?.tickets || ''}

# Roles Configuration
VERIFIED_ROLE_ID=${config.roles?.verified || ''}
STAFF_ROLE_ID=${config.roles?.staff || ''}
ADMIN_ROLE_ID=${config.roles?.admin || ''}
OWNER_ROLE_ID=${config.roles?.owner || ''}

# Database
DATABASE_PATH=./website/database/ysnm_dashboard.db

# Webhooks (se existirem)
WEBHOOK_LOGS=${config.webhooks?.logs || ''}
WEBHOOK_UPDATES=${config.webhooks?.updates || ''}
WEBHOOK_TICKETS=${config.webhooks?.tickets || ''}

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
`;

    // Salvar .env
    fs.writeFileSync(envPath, newEnvContent);
    console.log('✅ .env criado/atualizado com sucesso');
    
    // Criar backup do config.json
    const backupPath = path.join(__dirname, '..', 'config.json.backup');
    fs.copyFileSync(configPath, backupPath);
    console.log('✅ Backup criado: config.json.backup');
    
    console.log('\n🎉 MIGRAÇÃO CONCLUÍDA!');
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Verifique se o arquivo .env está correto');
    console.log('2. Teste o bot: npm start');
    console.log('3. Se tudo funcionar, pode remover config.json e config.json.backup');
    console.log('\n⚠️  IMPORTANTE:');
    console.log('- Nunca commite o arquivo .env');
    console.log('- Use .env.example como referência para outros desenvolvedores');
    console.log('- Em produção, configure as variáveis no Railway/hosting');
    
    console.log('\n🔐 SESSION_SECRET gerado automaticamente:');
    console.log(`${sessionSecret}`);
    console.log('\n📝 Para regenerar: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"`');
    
} catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
}
