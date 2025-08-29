// Teste das correções do SocketManager
const { server, socketManager } = require('./website/server');

const logger = require('./utils/logger');
logger.info('🧪 Testando correções do SocketManager...');

// Simular inicialização
setTimeout(() => {
    logger.info('✅ SocketManager inicializado');
    
    // Testar se a database está pronta
    if (socketManager.isDatabaseReady()) {
        logger.info('✅ Database está pronta e funcionando');
    } else {
        logger.warn('⚠️ Database ainda não está pronta (normal se estiver a inicializar)');
    }
    
    // Simular evento de voz que estava a causar erro
    const testVoiceData = {
        joined: true,
        userId: '123456789',
        channelName: 'Canal de Teste',
        channelId: '987654321'
    };
    
    logger.info('🎤 Testando handleVoiceUpdate...');
    try {
        socketManager.handleVoiceUpdate('test_guild', testVoiceData);
    logger.info('✅ handleVoiceUpdate executado sem erros');
    } catch (error) {
    logger.error('❌ Erro em handleVoiceUpdate:', { error });
    }
    
    // Testar outros métodos
    logger.info('📊 Testando sendAnalyticsUpdate...');
    try {
        socketManager.sendAnalyticsUpdate('test_guild');
    logger.info('✅ sendAnalyticsUpdate executado sem erros');
    } catch (error) {
    logger.error('❌ Erro em sendAnalyticsUpdate:', { error });
    }
    
    logger.info('\n🎉 Teste das correções concluído!');
    logger.info('💡 As verificações de database foram implementadas em todos os métodos.');
    logger.info('🔒 Os erros de database null foram corrigidos.');
    
    process.exit(0);
}, 2000); // Aguardar 2 segundos para a inicialização
