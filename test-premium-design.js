const https = require('https');

console.log('🎨 TESTE DESIGN  - Verificação Avançada');
console.log('============================================');

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
        'Expires': '0',
        'If-None-Match': '*'
    }
};

const req = https.request(options, (res) => {
    console.log(`📋 Status: ${res.statusCode} ${res.statusMessage}`);
    console.log(`📏 Tamanho: ${res.headers['content-length']} bytes`);
    console.log('');

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('🔍 ANÁLISE DO CONTEÚDO:');
        console.log('======================');
        
        // Verificações específicas do novo design
        const checks = [
            { name: 'Título ', pattern: '🔥 IGNIS Bot - Dashboard Avançado', found: data.includes('🔥 IGNIS Bot - Dashboard Avançado') },
            { name: 'Partículas de fundo', pattern: 'particles', found: data.includes('particles') },
            { name: 'Animações gradiente', pattern: 'gradientShift', found: data.includes('gradientShift') },
            { name: 'Efeito shimmer', pattern: 'shimmer', found: data.includes('shimmer') },
            { name: 'CSS moderno', pattern: 'backdrop-filter', found: data.includes('backdrop-filter') },
            { name: 'Grid responsivo', pattern: 'grid-template-columns', found: data.includes('grid-template-columns') },
            { name: 'JavaScript melhorado', pattern: 'createRandomParticle', found: data.includes('createRandomParticle') }
        ];
        
        let foundNew = 0;
        checks.forEach(check => {
            const status = check.found ? '✅' : '❌';
            console.log(`${status} ${check.name}: ${check.found ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
            if (check.found) foundNew++;
        });
        
        console.log('');
        console.log(`📊 RESULTADO: ${foundNew}/${checks.length} características do design encontradas`);
        
        if (foundNew >= 5) {
            console.log('🎉 SUCESSO! O design foi deployado!');
        } else if (foundNew > 0) {
            console.log('🔄 PARCIAL: Algumas características detectadas, deploy em progresso...');
        } else {
            console.log('⏳ AGUARDAR: Ainda servindo versão anterior, cache em limpeza...');
        }
        
        console.log('');
        console.log('📄 PRIMEIROS 200 CARACTERES:');
        console.log(data.substring(0, 200));
    });
});

req.on('error', (e) => {
    console.error('❌ ERRO:', e.message);
});

req.setTimeout(15000, () => {
    console.error('⏰ TIMEOUT');
    req.destroy();
});

req.end();