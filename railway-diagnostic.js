#!/usr/bin/env node

/**
 * 🔍 IGNIS Bot - Railway Diagnostic Tool
 * 
 * Script para diagnosticar problemas com o deployment no Railway
 */

const https = require('https');
const http = require('http');

const RAILWAY_URL = 'https://ignisbot.up.railway.app';

async function checkWebsite(url) {
    return new Promise((resolve) => {
        console.log(`\n🔍 Verificando: ${url}`);
        
        const client = url.startsWith('https') ? https : http;
        const startTime = Date.now();
        
        const req = client.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'IGNIS-Bot-Diagnostic/1.0',
                'Accept': 'text/html,application/json,*/*'
            }
        }, (res) => {
            const responseTime = Date.now() - startTime;
            
            console.log(`   ✅ Status: ${res.statusCode}`);
            console.log(`   ⏱️  Tempo de resposta: ${responseTime}ms`);
            console.log(`   📦 Content-Type: ${res.headers['content-type'] || 'N/A'}`);
            console.log(`   📏 Content-Length: ${res.headers['content-length'] || 'N/A'}`);
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    success: true,
                    status: res.statusCode,
                    responseTime,
                    headers: res.headers,
                    body: data.slice(0, 500) // Primeiros 500 caracteres
                });
            });
        });
        
        req.on('timeout', () => {
            console.log(`   ❌ TIMEOUT após 30 segundos`);
            req.destroy();
            resolve({
                success: false,
                error: 'TIMEOUT',
                responseTime: Date.now() - startTime
            });
        });
        
        req.on('error', (err) => {
            const responseTime = Date.now() - startTime;
            console.log(`   ❌ ERRO: ${err.message}`);
            resolve({
                success: false,
                error: err.message,
                responseTime
            });
        });
    });
}

async function runDiagnostic() {
    console.log('🚂 === IGNIS Bot - Railway Diagnostic ===');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);
    
    // Teste 1: Página principal
    console.log('📋 Teste 1: Página Principal');
    const mainPageResult = await checkWebsite(RAILWAY_URL);
    
    if (mainPageResult.success) {
        console.log(`   📄 Conteúdo (primeiros 500 chars):`);
        console.log(`   "${mainPageResult.body}"`);
    }
    
    // Teste 2: Health check endpoint
    console.log('\n📋 Teste 2: Health Check');
    const healthResult = await checkWebsite(`${RAILWAY_URL}/health`);
    
    if (healthResult.success && healthResult.body) {
        try {
            const healthData = JSON.parse(healthResult.body);
            console.log(`   💚 Health Check Response:`, healthData);
        } catch (e) {
            console.log(`   ⚠️  Health response não é JSON válido`);
        }
    }
    
    // Teste 3: Debug endpoint
    console.log('\n📋 Teste 3: Debug OAuth');
    const debugResult = await checkWebsite(`${RAILWAY_URL}/auth/debug`);
    
    if (debugResult.success && debugResult.body) {
        try {
            const debugData = JSON.parse(debugResult.body);
            console.log(`   🔧 Debug OAuth Response:`, debugData);
        } catch (e) {
            console.log(`   ⚠️  Debug response não é JSON válido`);
        }
    }
    
    // Teste 4: Verificar se está rodando apenas o bot
    console.log('\n📋 Teste 4: Verificar logs de startup');
    console.log(`   ℹ️  Se o website não carregar, pode estar em modo bot-only`);
    console.log(`   ℹ️  Verificar se CLIENT_SECRET está configurado no Railway`);
    
    // Resumo
    console.log('\n📊 === RESUMO DO DIAGNÓSTICO ===');
    console.log(`Página Principal: ${mainPageResult.success ? '✅ OK' : '❌ FALHA'}`);
    console.log(`Health Check: ${healthResult.success ? '✅ OK' : '❌ FALHA'}`);
    console.log(`Debug OAuth: ${debugResult.success ? '✅ OK' : '❌ FALHA'}`);
    
    if (!mainPageResult.success) {
        console.log('\n🔧 === POSSÍVEIS SOLUÇÕES ===');
        console.log('1. ⚙️  Verificar se CLIENT_SECRET está configurado no Railway');
        console.log('2. 📋 Verificar logs do Railway para erros de startup');
        console.log('3. 🔄 Redeploy no Railway');
        console.log('4. 🌐 Verificar se a porta está configurada corretamente (PORT=3000)');
        console.log('5. 🔐 Verificar se todas as variáveis de ambiente estão configuradas:');
        console.log('   - DISCORD_TOKEN');
        console.log('   - CLIENT_ID'); 
        console.log('   - CLIENT_SECRET');
        console.log('   - CALLBACK_URL (opcional)');
    }
    
    console.log('\n🚂 Diagnóstico finalizado.');
}

// Executar diagnóstico
runDiagnostic().catch(console.error);