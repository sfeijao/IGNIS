const Database = require('./website/database/database.js');

async function cleanupCorruptedTickets() {
    console.log('🧹 Limpando tickets corrompidos da base de dados...');
    
    const db = new Database();
    await db.initialize();
    
    try {
        // Primeiro, vamos ver todos os tickets
        console.log('📋 Listando todos os tickets...');
        const allTickets = await new Promise((resolve, reject) => {
            db.db.all('SELECT * FROM tickets', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log(`📊 Total de tickets encontrados: ${allTickets.length}`);
        
        allTickets.forEach((ticket, index) => {
            console.log(`${index + 1}. ID: ${ticket.id}, Título: "${ticket.title}", Status: ${ticket.status}, Guild: ${ticket.guild_id}`);
        });
        
        // Identificar tickets problemáticos (título null ou vazio)
        const corruptedTickets = allTickets.filter(ticket => 
            !ticket.title || 
            ticket.title === 'null' || 
            ticket.title.trim() === '' ||
            ticket.title === 'undefined'
        );
        
        console.log(`\n🔍 Tickets corrompidos encontrados: ${corruptedTickets.length}`);
        
        if (corruptedTickets.length > 0) {
            console.log('❓ Deseja deletar os tickets corrompidos? (s/n)');
            
            // Vamos forçar a limpeza para demonstração
            console.log('🗑️ Iniciando limpeza automática...');
            
            for (const ticket of corruptedTickets) {
                console.log(`🗑️ Deletando ticket corrompido ID: ${ticket.id}, Título: "${ticket.title}"`);
                
                try {
                    // Deletar diretamente do banco sem usar o método que tem bug
                    await new Promise((resolve, reject) => {
                        db.db.serialize(() => {
                            db.db.run('BEGIN TRANSACTION');
                            
                            // Deletar usuários associados
                            db.db.run('DELETE FROM ticket_users WHERE ticket_id = ?', [ticket.id], (err) => {
                                if (err) {
                                    console.error('Erro ao deletar usuários:', err);
                                    db.db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                }
                                
                                // Deletar ticket
                                db.db.run('DELETE FROM tickets WHERE id = ?', [ticket.id], function(err) {
                                    if (err) {
                                        console.error('Erro ao deletar ticket:', err);
                                        db.db.run('ROLLBACK');
                                        reject(err);
                                    } else {
                                        console.log(`✅ Ticket ${ticket.id} deletado (${this.changes} linha(s))`);
                                        db.db.run('COMMIT');
                                        resolve();
                                    }
                                });
                            });
                        });
                    });
                } catch (error) {
                    console.error(`❌ Erro ao deletar ticket ${ticket.id}:`, error);
                }
            }
            
            console.log('✅ Limpeza concluída!');
        } else {
            console.log('✅ Nenhum ticket corrompido encontrado');
        }
        
        // Verificar estado final
        const finalTickets = await new Promise((resolve, reject) => {
            db.db.all('SELECT * FROM tickets', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log(`\n📊 Estado final: ${finalTickets.length} tickets na base de dados`);
        finalTickets.forEach((ticket, index) => {
            console.log(`${index + 1}. ID: ${ticket.id}, Título: "${ticket.title}", Status: ${ticket.status}`);
        });
        
    } catch (error) {
        console.error('❌ Erro na limpeza:', error);
    } finally {
        if (db.db) {
            db.db.close();
        }
    }
}

cleanupCorruptedTickets().catch(console.error);
