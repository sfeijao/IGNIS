// Script de migração para adicionar as novas funcionalidades de tickets
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔄 Iniciando migração da base de dados...');

const dbPath = path.join(__dirname, 'website', 'database', 'ysnm_dashboard.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar à base de dados:', err);
        return;
    }
    
    console.log('✅ Conectado à base de dados SQLite');
    
    // Migração 1: Adicionar coluna title
    db.run("ALTER TABLE tickets ADD COLUMN title TEXT", (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('❌ Erro ao adicionar coluna title:', err);
        } else {
            console.log('✅ Coluna title adicionada com sucesso');
        }
        
        // Migração 2: Adicionar coluna severity
        db.run("ALTER TABLE tickets ADD COLUMN severity TEXT DEFAULT 'medium'", (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('❌ Erro ao adicionar coluna severity:', err);
            } else {
                console.log('✅ Coluna severity adicionada com sucesso');
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
                    console.error('❌ Erro ao criar tabela ticket_users:', err);
                } else {
                    console.log('✅ Tabela ticket_users criada com sucesso');
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
                            console.error('❌ Erro ao criar índice:', err);
                        } else {
                            indexCount++;
                            console.log(`✅ Índice ${indexCount}/${indexes.length} criado`);
                        }
                        
                        if (indexCount === indexes.length) {
                            // Verificação final
                            console.log('\n🔍 Verificando estrutura após migração...');
                            
                            db.all("PRAGMA table_info(tickets)", (err, columns) => {
                                if (err) {
                                    console.error('❌ Erro na verificação:', err);
                                    return;
                                }
                                
                                const hasTitle = columns.some(col => col.name === 'title');
                                const hasSeverity = columns.some(col => col.name === 'severity');
                                
                                console.log('📊 Resultado da migração:');
                                console.log(`  - Coluna 'title': ${hasTitle ? '✅ Presente' : '❌ Ausente'}`);
                                console.log(`  - Coluna 'severity': ${hasSeverity ? '✅ Presente' : '❌ Ausente'}`);
                                
                                // Verificar tabela ticket_users
                                db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_users'", (err, rows) => {
                                    if (err) {
                                        console.error('❌ Erro na verificação da tabela ticket_users:', err);
                                    } else {
                                        console.log(`  - Tabela 'ticket_users': ${rows.length > 0 ? '✅ Presente' : '❌ Ausente'}`);
                                    }
                                    
                                    console.log('\n🎉 Migração da base de dados concluída!');
                                    console.log('🚀 O sistema de tickets está agora completamente funcional.');
                                    
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
