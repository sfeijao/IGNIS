// Script para verificar se a correção do deleteTicket foi deployada
// Execute este script para testar a funcionalidade

async function testProductionDelete() {
    const baseUrl = 'https://ysnmbot-alberto.up.railway.app';
    
    console.log('🧪 Testando DELETE de tickets na produção...');
    console.log('📡 URL:', baseUrl);
    
    try {
        // Tentar fazer uma requisição DELETE com ID inválido (deve retornar 400, não 500)
        const response = await fetch(`${baseUrl}/api/tickets/test-invalid-id`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer dev-token-fixed-local-123'
            }
        });
        
        console.log('📊 Status Code:', response.status);
        
        if (response.status === 400) {
            console.log('✅ CORREÇÃO DEPLOYADA! Agora retorna 400 (validation error) em vez de 500');
            console.log('🎉 A deleção de tickets com IDs válidos deve funcionar agora!');
        } else if (response.status === 500) {
            console.log('❌ Ainda com erro 500 - Railway não fez redeploy ainda');
            console.log('⏳ Aguarde mais alguns minutos...');
        } else {
            console.log('ℹ️ Status inesperado:', response.status);
        }
        
        const text = await response.text();
        console.log('📄 Resposta:', text);
        
    } catch (error) {
        console.error('❌ Erro na requisição:', error.message);
    }
}

// Execute o teste
testProductionDelete();
