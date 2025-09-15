#!/usr/bin/env node
// scripts/railway-config.js - Railway Environment Configuration Helper
const fs = require('fs');
const path = require('path');

console.log('🚂 IGNIS Bot - Railway Configuration Helper');
console.log('==========================================');

// Read current .env file
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found! Please create one first.');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n').filter(line => 
    line.trim() && 
    !line.startsWith('#') && 
    line.includes('=')
);

console.log('\n📋 Environment Variables for Railway:');
console.log('=====================================');
console.log('Copy and paste these into Railway dashboard:');
console.log('https://railway.app/project/[your-project]/settings/environment\n');

// Convert environment variables to Railway format
const railwayVars = {};
envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    
    // Skip localhost URLs and development specific vars
    if (key === 'BASE_URL' && value.includes('localhost')) {
        railwayVars[key] = 'https://ignisbot-alberto.up.railway.app';
    } else if (key === 'NODE_ENV') {
        railwayVars[key] = 'production';
    } else if (key === 'PORT') {
        // Railway automatically sets PORT
        console.log(`⚠️  Skipping ${key} (Railway sets this automatically)`);
        return;
    } else {
        railwayVars[key] = value;
    }
});

// Display variables for Railway
Object.entries(railwayVars).forEach(([key, value]) => {
    // Hide sensitive values partially
    let displayValue = value;
    if (key.includes('TOKEN') || key.includes('SECRET')) {
        displayValue = value.substring(0, 8) + '...' + value.substring(value.length - 4);
    }
    console.log(`${key}=${displayValue}`);
});

console.log('\n🔧 Required Railway Environment Variables:');
console.log('==========================================');
const requiredVars = [
    'NODE_ENV=production',
    'DISCORD_TOKEN=[your_bot_token]',
    'DISCORD_CLIENT_ID=[your_client_id]', 
    'DISCORD_CLIENT_SECRET=[your_client_secret]',
    'DISCORD_GUILD_ID=[your_guild_id]',
    'BASE_URL=https://ignisbot-alberto.up.railway.app',
    'SESSION_SECRET=[random_32_char_string]'
];

requiredVars.forEach(variable => {
    console.log(`✅ ${variable}`);
});

console.log('\n💡 Tips for Railway Deployment:');
console.log('================================');
console.log('1. Set NODE_ENV=production');
console.log('2. Use HTTPS for BASE_URL');
console.log('3. Generate a new SESSION_SECRET for production');
console.log('4. Ensure all DISCORD_* variables are set');
console.log('5. Railway will automatically set PORT');

console.log('\n🚀 Command to generate new SESSION_SECRET:');
console.log('node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');

// Generate a new session secret for production
const crypto = require('crypto');
const newSessionSecret = crypto.randomBytes(32).toString('hex');
console.log(`\n🔑 New SESSION_SECRET for production: ${newSessionSecret}`);

console.log('\n✅ Configuration helper completed!');
