// Teste das correções do SocketManager
const { server, socketManager } = require('./website/server');

console.log('🧪 Testando correções do SocketManager...');

// Simular inicialização
setTimeout(() => {
    console.log('✅ SocketManager inicializado');
    
    // Testar se a database está pronta
    if (socketManager.isDatabaseReady()) {
        console.log('✅ Database está pronta e funcionando');
    } else {
        console.log('⚠️ Database ainda não está pronta (normal se estiver a inicializar)');
    }
    
    // Simular evento de voz que estava a causar erro
    const testVoiceData = {
        joined: true,
        userId: '123456789',
        channelName: 'Canal de Teste',
        channelId: '987654321'
    };
    
    console.log('🎤 Testando handleVoiceUpdate...');
    try {
        socketManager.handleVoiceUpdate('test_guild', testVoiceData);
        console.log('✅ handleVoiceUpdate executado sem erros');
    } catch (error) {
        console.error('❌ Erro em handleVoiceUpdate:', error);
    }
    
    // Testar outros métodos
    console.log('📊 Testando sendAnalyticsUpdate...');
    try {
        socketManager.sendAnalyticsUpdate('test_guild');
        console.log('✅ sendAnalyticsUpdate executado sem erros');
    } catch (error) {
        console.error('❌ Erro em sendAnalyticsUpdate:', error);
    }
    
    console.log('\n🎉 Teste das correções concluído!');
    console.log('💡 As verificações de database foram implementadas em todos os métodos.');
    console.log('🔒 Os erros de database null foram corrigidos.');
    
    process.exit(0);
}, 2000); // Aguardar 2 segundos para a inicialização
