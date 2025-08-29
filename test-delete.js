const Database = require('./website/database/database.js');

async function testDelete() {
    const logger = require('./utils/logger');
    logger.info('🧪 Testando funcionalidade de delete de tickets...');
    
    const db = new Database();
    await db.initialize();
    
    try {
        // Criar um ticket de teste
    logger.info('📝 Criando ticket de teste...');
        const testTicket = await db.createTicket({
            guild_id: 'test-guild',
            user_id: 'test-user',
            username: 'TestUser',
            title: 'Ticket de Teste',
            reason: 'Teste de deleção',
            severity: 'medium',
            status: 'open',
            channel_id: 'test-channel-' + Date.now()
        });
        
    logger.info('✅ Ticket criado com ID:', { ticketId: testTicket.id });
        
        // Tentar deletar o ticket
    logger.info('🗑️ Tentando deletar ticket...');
        const result = await db.deleteTicket(testTicket.id);
        
    logger.info('✅ Ticket deletado com sucesso!', { result });
        
        // Verificar se foi realmente deletado
        const tickets = await db.getTickets('test-guild');
        const deletedTicket = tickets.find(t => t.id === testTicket.id);
        
        if (!deletedTicket) {
            logger.info('✅ Confirmado: Ticket foi removido da base de dados');
        } else {
            logger.warn('❌ Erro: Ticket ainda existe na base de dados');
        }
        
    } catch (error) {
    logger.error('❌ Erro no teste:', { error: error && error.message ? error.message : error });
    } finally {
        if (db.db) {
            db.db.close();
        }
    }
}

testDelete().catch(err => logger.error('Unhandled rejection in testDelete', { error: err && err.message ? err.message : err }));
