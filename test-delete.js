const Database = require('./website/database/database.js');

async function testDelete() {
    console.log('🧪 Testando funcionalidade de delete de tickets...');
    
    const db = new Database();
    await db.initialize();
    
    try {
        // Criar um ticket de teste
        console.log('📝 Criando ticket de teste...');
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
        
        console.log('✅ Ticket criado com ID:', testTicket.id);
        
        // Tentar deletar o ticket
        console.log('🗑️ Tentando deletar ticket...');
        const result = await db.deleteTicket(testTicket.id);
        
        console.log('✅ Ticket deletado com sucesso!', result);
        
        // Verificar se foi realmente deletado
        const tickets = await db.getTickets('test-guild');
        const deletedTicket = tickets.find(t => t.id === testTicket.id);
        
        if (!deletedTicket) {
            console.log('✅ Confirmado: Ticket foi removido da base de dados');
        } else {
            console.log('❌ Erro: Ticket ainda existe na base de dados');
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    } finally {
        if (db.db) {
            db.db.close();
        }
    }
}

testDelete().catch(console.error);
