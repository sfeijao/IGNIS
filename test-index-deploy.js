const https = require('https');

console.log('🔥 TESTE INDEX.HTML - Verificação de Deploy');
console.log('==========================================');

const testUrl = 'https://ignisbot.up.railway.app/';

const options = {
    hostname: 'ignisbot.up.railway.app',
    port: 443,
    path: '/',
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
        
        // Verificar se é a versão simplificada
        if (data.includes('🔥 IGNIS Bot Dashboard - Versão Simplificada')) {
            console.log('🎉 SUCESSO! A versão simplificada foi deployada!');
            console.log('✅ O Railway fez o deploy da nova versão');
            console.log('🔧 Agora você pode testar se carrega no seu navegador');
        } else if (data.includes('Google Fonts') || data.includes('fonts.googleapis.com')) {
            console.log('⚠️ Ainda servindo a versão complexa antiga');
            console.log('🔄 O deploy ainda não foi concluído ou há cache');
        } else if (data.includes('IGNIS')) {
            console.log('🤔 Conteúdo IGNIS detectado mas não é a versão esperada');
        } else {
            console.log('❌ Conteúdo inesperado recebido');
        }
        
        console.log('');
        console.log('📋 PRIMEIROS 500 CARACTERES:');
        console.log(data.substring(0, 500));
        
        // Verificar dependências externas
        const externalDeps = [];
        if (data.includes('fonts.googleapis.com')) externalDeps.push('Google Fonts');
        if (data.includes('fontawesome')) externalDeps.push('Font Awesome');
        if (data.includes('cdnjs.cloudflare.com')) externalDeps.push('CDN JS');
        
        if (externalDeps.length > 0) {
            console.log('\n⚠️ DEPENDÊNCIAS EXTERNAS DETECTADAS:');
            externalDeps.forEach(dep => console.log(`   - ${dep}`));
        } else {
            console.log('\n✅ NENHUMA DEPENDÊNCIA EXTERNA DETECTADA (Bom!)');
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