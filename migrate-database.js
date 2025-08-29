// Script de migração para adicionar as novas funcionalidades de tickets
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('./utils/logger');

logger.info('🔄 Iniciando migração da base de dados...');

const dbPath = path.join(__dirname, 'website', 'database', 'ysnm_dashboard.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
    const logger = require('./utils/logger');
    logger.error('❌ Erro ao conectar à base de dados:', { error: err && err.message ? err.message : err });
        return;
    }
    
    logger.info('✅ Conectado à base de dados SQLite');
    
    // Migração 1: Adicionar coluna title
    db.run("ALTER TABLE tickets ADD COLUMN title TEXT", (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            logger.error('❌ Erro ao adicionar coluna title:', { error: err.message || err });
        } else {
            logger.info('✅ Coluna title adicionada com sucesso');
        }
        
        // Migração 2: Adicionar coluna severity
        db.run("ALTER TABLE tickets ADD COLUMN severity TEXT DEFAULT 'medium'", (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                logger.error('❌ Erro ao adicionar coluna severity:', { error: err.message || err });
            } else {
                logger.info('✅ Coluna severity adicionada com sucesso');
            }
            
            // Migração 3: Criar tabela ticket_users
            db.run(`
                CREATE TABLE IF NOT EXISTS ticket_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticket_id INTEGER NOT NULL,
                    user_id TEXT NOT NULL,
                    added_by TEXT,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(discord_id),
                    FOREIGN KEY (added_by) REFERENCES users(discord_id),
                    UNIQUE(ticket_id, user_id)
                )
            `, (err) => {
                if (err) {
                    logger.error('❌ Erro ao criar tabela ticket_users:', { error: err.message || err });
                } else {
                    logger.info('✅ Tabela ticket_users criada com sucesso');
                }
                
                // Migração 4: Criar índices
                const indexes = [
                    "CREATE INDEX IF NOT EXISTS idx_ticket_users_ticket_id ON ticket_users(ticket_id)",
                    "CREATE INDEX IF NOT EXISTS idx_ticket_users_user_id ON ticket_users(user_id)"
                ];
                
                let indexCount = 0;
                indexes.forEach(indexSql => {
                    db.run(indexSql, (err) => {
                        if (err) {
                            logger.error('❌ Erro ao criar índice:', { error: err.message || err });
                        } else {
                            indexCount++;
                            logger.info(`✅ Índice ${indexCount}/${indexes.length} criado`);
                        }
                        
                        if (indexCount === indexes.length) {
                            // Verificação final
                            logger.info('\n🔍 Verificando estrutura após migração...');
                            
                            db.all("PRAGMA table_info(tickets)", (err, columns) => {
                                if (err) {
                                    logger.error('❌ Erro na verificação:', { error: err.message || err });
                                    return;
                                }
                                
                                const hasTitle = columns.some(col => col.name === 'title');
                                const hasSeverity = columns.some(col => col.name === 'severity');
                                
                                logger.info('📊 Resultado da migração:');
                                logger.info(`  - Coluna 'title': ${hasTitle ? '✅ Presente' : '❌ Ausente'}`);
                                logger.info(`  - Coluna 'severity': ${hasSeverity ? '✅ Presente' : '❌ Ausente'}`);
                                
                                // Verificar tabela ticket_users
                                db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_users'", (err, rows) => {
                                    if (err) {
                                        logger.error('❌ Erro na verificação da tabela ticket_users:', { error: err.message || err });
                                    } else {
                                        logger.info(`  - Tabela 'ticket_users': ${rows.length > 0 ? '✅ Presente' : '❌ Ausente'}`);
                                    }
                                    
                                    logger.info('\n🎉 Migração da base de dados concluída!');
                                    logger.info('🚀 O sistema de tickets está agora completamente funcional.');
                                    
                                    db.close();
                                });
                            });
                        }
                    });
                });
            });
        });
    });
});
