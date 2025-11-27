#!/usr/bin/env node
/**
 * Script automático para corrigir TODOS os empty catch blocks no projeto IGNIS
 * 
 * Execução: node scripts/fix-empty-catches.js
 * 
 * O que faz:
 * - Escaneia todos os ficheiros .js, .ts, .tsx
 * - Deteta padrões: } catch (e) { logger.debug('Caught error:', e?.message || e); }, } catch (e) { logger.debug('Caught error:', e?.message || e); }, } catch(err){ logger.debug('Caught error:', err?.message || err); }
 * - Substitui por: } catch (e) { logger.debug('Error context:', e?.message || e); }
 * - Cria backup antes de modificar
 * - Gera relatório detalhado
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Configuração
const ROOT_DIR = path.join(__dirname, '..');
const BACKUP_DIR = path.join(__dirname, '..', '.backup-empty-catches');
const EXTENSIONS = ['.js', '.ts', '.tsx'];
const EXCLUDE_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', '.backup-empty-catches'];

// Estatísticas
const stats = {
  filesScanned: 0,
  filesModified: 0,
  catchesFixed: 0,
  errors: [],
  details: []
};

/**
 * Padrões a detetar e corrigir
 */
const PATTERNS = [
  // Padrão 1: } catch (e) { logger.debug('Caught error:', e?.message || e); }
  {
    regex: /(\}\s*catch\s*)\{\s*\}/g,
    replacement: '$1(e) { logger.debug(\'Caught error:\', e?.message || e); }',
    description: 'Empty catch block without parameter'
  },
  // Padrão 2: } catch (e) { logger.debug('Caught error:', e?.message || e); }
  {
    regex: /(\}\s*catch\s*\([^)]+\)\s*)\{\s*\}/g,
    replacement: (match, prefix) => {
      const paramMatch = match.match(/catch\s*\(([^)]+)\)/);
      const param = paramMatch ? paramMatch[1].trim() : 'e';
      return `${prefix}{ logger.debug('Caught error:', ${param}?.message || ${param}); }`;
    },
    description: 'Empty catch block with parameter'
  },
  // Padrão 3: catch {} dentro de try-catch inline
  {
    regex: /(\}\s*)\}\s*catch\s*\{\s*\}/g,
    replacement: '$1} catch (e) { logger.debug(\'Inline catch error:\', e?.message || e); }',
    description: 'Inline empty catch'
  }
];

/**
 * Escaneia recursivamente diretórios
 */
async function scanDirectory(dir) {
  const entries = await readdir(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const fileStat = await stat(fullPath);
    
    if (fileStat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(entry)) {
        await scanDirectory(fullPath);
      }
    } else if (fileStat.isFile()) {
      const ext = path.extname(entry);
      if (EXTENSIONS.includes(ext)) {
        await processFile(fullPath);
      }
    }
  }
}

/**
 * Processa um ficheiro individual
 */
async function processFile(filePath) {
  stats.filesScanned++;
  
  try {
    let content = await readFile(filePath, 'utf8');
    const originalContent = content;
    let modified = false;
    let catchesInFile = 0;
    
    // Verificar se já tem logger importado
    const hasLogger = /require\(['"]\.*\/?\.*utils\/logger['"]\)|from\s+['"]\.*\/?\.*utils\/logger['"]|const\s+logger\s*=/.test(content);
    
    // Aplicar cada padrão
    for (const pattern of PATTERNS) {
      const matches = content.match(pattern.regex);
      if (matches && matches.length > 0) {
        const count = matches.length;
        catchesInFile += count;
        
        if (typeof pattern.replacement === 'function') {
          content = content.replace(pattern.regex, pattern.replacement);
        } else {
          content = content.replace(pattern.regex, pattern.replacement);
        }
        
        modified = true;
      }
    }
    
    if (modified) {
      // Adicionar logger import se necessário
      if (!hasLogger) {
        // Detetar tipo de ficheiro para import correto
        if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
          // TypeScript
          if (/^import\s/.test(content)) {
            content = `import logger from '../utils/logger';\n${content}`;
          } else {
            content = `const logger = require('../utils/logger');\n${content}`;
          }
        } else {
          // JavaScript
          if (/^const\s+\{/.test(content) || /^import\s/.test(content)) {
            content = `const logger = require('../utils/logger');\n${content}`;
          } else {
            // Inserir após primeiro require se existir
            const firstRequireIndex = content.indexOf('require(');
            if (firstRequireIndex !== -1) {
              const lineEnd = content.indexOf('\n', firstRequireIndex);
              content = content.slice(0, lineEnd + 1) + `const logger = require('../utils/logger');\n` + content.slice(lineEnd + 1);
            } else {
              content = `const logger = require('../utils/logger');\n${content}`;
            }
          }
        }
      }
      
      // Criar backup
      const backupPath = filePath.replace(ROOT_DIR, BACKUP_DIR);
      const backupDir = path.dirname(backupPath);
      fs.mkdirSync(backupDir, { recursive: true });
      await writeFile(backupPath, originalContent, 'utf8');
      
      // Escrever ficheiro modificado
      await writeFile(filePath, content, 'utf8');
      
      stats.filesModified++;
      stats.catchesFixed += catchesInFile;
      stats.details.push({
        file: path.relative(ROOT_DIR, filePath),
        catchesFixed: catchesInFile
      });
      
      console.log(`✅ ${path.relative(ROOT_DIR, filePath)}: ${catchesInFile} catch blocks fixed`);
    }
  } catch (err) {
    stats.errors.push({
      file: path.relative(ROOT_DIR, filePath),
      error: err.message
    });
    console.error(`❌ Error processing ${filePath}:`, err.message);
  }
}

/**
 * Gera relatório final
 */
function generateReport() {
  const report = `
═══════════════════════════════════════════════════════════════
  IGNIS - Relatório de Correção de Empty Catch Blocks
═══════════════════════════════════════════════════════════════

📊 Estatísticas:
  • Ficheiros escaneados: ${stats.filesScanned}
  • Ficheiros modificados: ${stats.filesModified}
  • Catch blocks corrigidos: ${stats.catchesFixed}
  • Erros encontrados: ${stats.errors.length}

📁 Backup criado em: ${BACKUP_DIR}

${stats.filesModified > 0 ? `
📝 Ficheiros modificados:
${stats.details.map(d => `  • ${d.file}: ${d.catchesFixed} fixes`).join('\n')}
` : ''}

${stats.errors.length > 0 ? `
⚠️  Erros:
${stats.errors.map(e => `  • ${e.file}: ${e.error}`).join('\n')}
` : ''}

✅ Processo concluído!

💡 Próximos passos:
  1. Verificar os ficheiros modificados
  2. Executar testes: npm test
  3. Se tudo estiver OK, commit as alterações
  4. Se houver problemas, restaurar do backup: ${BACKUP_DIR}

═══════════════════════════════════════════════════════════════
`;
  
  console.log(report);
  
  // Salvar relatório em ficheiro
  const reportPath = path.join(ROOT_DIR, 'EMPTY_CATCH_FIX_REPORT.md');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\n📄 Relatório salvo em: ${reportPath}`);
}

/**
 * Execução principal
 */
async function main() {
  console.log('🚀 Iniciando correção automática de empty catch blocks...\n');
  console.log(`📂 Diretório raiz: ${ROOT_DIR}`);
  console.log(`💾 Backup em: ${BACKUP_DIR}\n`);
  
  // Criar diretório de backup
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  
  // Escanear e processar
  await scanDirectory(ROOT_DIR);
  
  // Gerar relatório
  generateReport();
}

// Executar
main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
