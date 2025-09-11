// const Database = require('../website/database/database.js');

async function cleanupCorruptedTickets() {
    const logger = require('../utils/logger');
    logger.info('🧹 Limpando tickets corrompidos da base de dados...');
    
    // TODO: Implementar limpeza usando o storage do cliente quando necessário
    logger.warn('⚠️ Script de limpeza desabilitado - database.js não encontrado');
    return;
    
    // const db = new Database();
    await db.initialize();
    
    try {
        // Primeiro, vamos ver todos os tickets
    logger.info('📋 Listando todos os tickets...');
        const allTickets = await new Promise((resolve, reject) => {
            db.db.all('SELECT * FROM tickets', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
    logger.info(`📊 Total de tickets encontrados: ${allTickets.length}`);
        
        allTickets.forEach((ticket, index) => {
            logger.info(`${index + 1}. ID: ${ticket.id}, Título: "${ticket.title}", Status: ${ticket.status}, Guild: ${ticket.guild_id}`);
        });
        
        // Identificar tickets problemáticos (título null ou vazio)
        const corruptedTickets = allTickets.filter(ticket => 
            !ticket.title || 
            ticket.title === 'null' || 
            ticket.title.trim() === '' ||
            ticket.title === 'undefined'
        );
        
    logger.info(`\n🔍 Tickets corrompidos encontrados: ${corruptedTickets.length}`);
        
        if (corruptedTickets.length > 0) {
            logger.info('❓ Deseja deletar os tickets corrompidos? (s/n)');
            
            // Vamos forçar a limpeza para demonstração
            logger.info('🗑️ Iniciando limpeza automática...');
            
            for (const ticket of corruptedTickets) {
                logger.info(`🗑️ Deletando ticket corrompido ID: ${ticket.id}, Título: "${ticket.title}"`);
                
                try {
                    // Deletar diretamente do banco sem usar o método que tem bug
                    await new Promise((resolve, reject) => {
                        db.db.serialize(() => {
                            db.db.run('BEGIN TRANSACTION');
                            
                            // Deletar usuários associados
                            db.db.run('DELETE FROM ticket_users WHERE ticket_id = ?', [ticket.id], (err) => {
                                if (err) {
                                    logger.error('Erro ao deletar usuários:', { error: err && err.message ? err.message : err });
                                    db.db.run('ROLLBACK');
                                    reject(err);
                                    return;
                                }
                                
                                // Deletar ticket
                                db.db.run('DELETE FROM tickets WHERE id = ?', [ticket.id], function(err) {
                                    if (err) {
                                        logger.error('Erro ao deletar ticket:', { error: err && err.message ? err.message : err });
                                        db.db.run('ROLLBACK');
                                        reject(err);
                                    } else {
                                        logger.info(`✅ Ticket ${ticket.id} deletado (${this.changes} linha(s))`);
                                        db.db.run('COMMIT');
                                        resolve();
                                    }
                                });
                            });
                        });
                    });
                } catch (error) {
                    logger.error(`❌ Erro ao deletar ticket ${ticket.id}:`, { error: error && error.message ? error.message : error });
                }
            }
            
            logger.info('✅ Limpeza concluída!');
        } else {
            logger.info('✅ Nenhum ticket corrompido encontrado');
        }
        
        // Verificar estado final
        const finalTickets = await new Promise((resolve, reject) => {
            db.db.all('SELECT * FROM tickets', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
    logger.info(`\n📊 Estado final: ${finalTickets.length} tickets na base de dados`);
        finalTickets.forEach((ticket, index) => {
            logger.info(`${index + 1}. ID: ${ticket.id}, Título: "${ticket.title}", Status: ${ticket.status}`);
        });
        
    } catch (error) {
            logger.error('❌ Erro na limpeza:', { error: error.message || error });
    } finally {
        if (db.db) {
            db.db.close();
        }
    }
}

    cleanupCorruptedTickets().catch(err => logger.error('Erro não tratado na limpeza de tickets', { error: err.message || err }));
