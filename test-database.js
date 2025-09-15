// Teste rápido da estrutura da base de dados SQLite
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔍 Testando estrutura da base de dados SQLite...');

const dbPath = path.join(__dirname, 'website', 'database', 'ignis_dashboard.db');

// Verificar se o ficheiro da base de dados existe
const fs = require('fs');
if (fs.existsSync(dbPath)) {
    console.log('✅ Ficheiro da base de dados encontrado:', dbPath);
} else {
    console.log('⚠️ Ficheiro da base de dados não encontrado. Será criado automaticamente.');
}

// Conectar à base de dados
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar à base de dados:', err);
        return;
    }
    console.log('✅ Conectado à base de dados SQLite com sucesso');
    
    // Verificar se as tabelas de tickets existem
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tickets', 'ticket_users')", (err, rows) => {
        if (err) {
            console.error('❌ Erro ao verificar tabelas:', err);
            return;
        }
        
        console.log('📋 Tabelas encontradas:');
        rows.forEach(row => {
            console.log(`  - ${row.name}`);
        });
        
        // Verificar estrutura da tabela tickets
        db.all("PRAGMA table_info(tickets)", (err, columns) => {
            if (err) {
                console.error('❌ Erro ao verificar estrutura da tabela tickets:', err);
                return;
            }
            
            console.log('\n🎫 Estrutura da tabela tickets:');
            columns.forEach(col => {
                console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
            });
            
            // Verificar se as novas colunas existem
            const hasTitle = columns.some(col => col.name === 'title');
            const hasSeverity = columns.some(col => col.name === 'severity');
            
            console.log('\n🔧 Status das novas funcionalidades:');
            console.log(`  - Coluna 'title': ${hasTitle ? '✅ Presente' : '❌ Ausente'}`);
            console.log(`  - Coluna 'severity': ${hasSeverity ? '✅ Presente' : '❌ Ausente'}`);
            
            // Verificar tabela ticket_users
            db.all("PRAGMA table_info(ticket_users)", (err, userColumns) => {
                if (err) {
                    console.error('❌ Erro ao verificar tabela ticket_users:', err);
                } else {
                    console.log('\n👥 Estrutura da tabela ticket_users:');
                    userColumns.forEach(col => {
                        console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''}`);
                    });
                }
                
                console.log('\n🎉 Verificação da base de dados concluída!');
                console.log('💡 Nota: Os erros de sintaxe MSSQL podem ser ignorados - este é um projeto SQLite.');
                
                db.close();
            });
        });
    });
});
