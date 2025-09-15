#!/usr/bin/env node

/**
 * 🔍 IGNIS Bot - Advanced Railway Diagnostic
 */

const https = require('https');
const fs = require('fs');

async function downloadAndAnalyze() {
    console.log('🔍 === ANÁLISE AVANÇADA DO RAILWAY ===\n');
    
    return new Promise((resolve, reject) => {
        const req = https.get('https://ignisbot.up.railway.app', (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers:`, JSON.stringify(res.headers, null, 2));
            
            let data = '';
            res.on('data', chunk => data += chunk);
            
            res.on('end', () => {
                console.log('\n📄 === CONTEÚDO HTML ===');
                console.log(`Tamanho: ${data.length} caracteres`);
                
                // Salvar conteúdo para análise
                fs.writeFileSync('railway-response.html', data);
                console.log('💾 Conteúdo salvo em: railway-response.html');
                
                // Analisar possíveis problemas
                console.log('\n🔍 === ANÁLISE DE PROBLEMAS ===');
                
                if (data.includes('<!DOCTYPE html>')) {
                    console.log('✅ HTML válido detectado');
                } else {
                    console.log('❌ HTML inválido ou incompleto');
                }
                
                if (data.includes('<title>')) {
                    const titleMatch = data.match(/<title>(.*?)<\/title>/);
                    console.log(`📋 Título: ${titleMatch ? titleMatch[1] : 'N/A'}`);
                } else {
                    console.log('❌ Tag <title> não encontrada');
                }
                
                if (data.includes('script')) {
                    console.log('📜 JavaScript detectado na página');
                } else {
                    console.log('⚠️  Nenhum JavaScript detectado');
                }
                
                if (data.includes('css') || data.includes('style')) {
                    console.log('🎨 CSS detectado na página');
                } else {
                    console.log('⚠️  Nenhum CSS detectado');
                }
                
                // Verificar por links externos
                const externalLinks = data.match(/https?:\/\/[^\s"'<>]+/g) || [];
                console.log(`🔗 Links externos encontrados: ${externalLinks.length}`);
                externalLinks.slice(0, 5).forEach(link => console.log(`   - ${link}`));
                
                // Verificar por possíveis erros
                const errorWords = ['error', 'Error', 'ERROR', 'failed', 'Failed', 'FAILED'];
                const foundErrors = errorWords.filter(word => data.includes(word));
                if (foundErrors.length > 0) {
                    console.log(`❌ Possíveis erros encontrados: ${foundErrors.join(', ')}`);
                } else {
                    console.log('✅ Nenhum erro óbvio encontrado no HTML');
                }
                
                console.log('\n📋 === PRIMEIROS 1000 CARACTERES ===');
                console.log(data.substring(0, 1000));
                
                resolve(data);
            });
        });
        
        req.on('error', (err) => {
            console.error('❌ Erro na requisição:', err.message);
            reject(err);
        });
        
        req.setTimeout(10000, () => {
            console.error('❌ Timeout na requisição');
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

downloadAndAnalyze().catch(console.error);