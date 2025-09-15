const https = require('https');

console.log('🔥 TESTE FUNCIONAL - Página de Teste Direto');
console.log('=============================================');

const testUrl = 'https://ignisbot.up.railway.app/functional-test.html';

const options = {
    hostname: 'ignisbot.up.railway.app',
    port: 443,
    path: '/functional-test.html',
    method: 'GET',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }
};

console.log(`🎯 Testando: ${testUrl}`);
console.log(`📊 Método: ${options.method}`);
console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
console.log('');

const req = https.request(options, (res) => {
    console.log('✅ RESPOSTA RECEBIDA:');
    console.log(`📋 Status: ${res.statusCode} ${res.statusMessage}`);
    console.log(`📏 Content-Length: ${res.headers['content-length'] || 'Não especificado'}`);
    console.log(`🗂️ Content-Type: ${res.headers['content-type'] || 'Não especificado'}`);
    console.log(`🔄 Cache-Control: ${res.headers['cache-control'] || 'Não especificado'}`);
    console.log('');

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`📄 CONTEÚDO RECEBIDO (${data.length} caracteres):`);
        console.log('================================================');
        
        if (data.includes('IGNIS BOT - TESTE FUNCIONAL')) {
            console.log('🎉 SUCESSO! A nova página funcional está sendo servida!');
            console.log('✅ O Railway está funcionando corretamente');
            console.log('🔧 O problema anterior era com a página complexa');
        } else if (data.includes('IGNIS')) {
            console.log('⚠️ Ainda servindo conteúdo antigo...');
            console.log('🔄 Cache do Railway ainda não foi limpo');
        } else {
            console.log('❌ Conteúdo inesperado recebido');
        }
        
        console.log('');
        console.log('📋 PRIMEIROS 300 CARACTERES:');
        console.log(data.substring(0, 300));
        
        if (data.length > 300) {
            console.log('\n📋 ÚLTIMOS 200 CARACTERES:');
            console.log(data.substring(data.length - 200));
        }
    });
});

req.on('error', (e) => {
    console.error('❌ ERRO NA REQUISIÇÃO:', e.message);
});

req.setTimeout(10000, () => {
    console.error('⏰ TIMEOUT - Requisição demorou mais de 10 segundos');
    req.destroy();
});

req.end();