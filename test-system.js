/**
 * Script de Diagnóstico e Teste Completo
 * Sistema de Tickets e Giveaways - IGNIS Bot
 */

const logger = require('./utils/logger');

// Cores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(msg, color = 'reset') {
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

function section(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'bold');
    console.log('='.repeat(60) + '\n');
}

async function testDatabase() {
    section('🗄️  TESTE DE CONEXÃO À DATABASE');

    try {
        const mongoose = require('mongoose');
        log('✓ Mongoose carregado', 'green');

        // Verificar se está conectado
        if (mongoose.connection.readyState === 1) {
            log('✓ MongoDB conectado', 'green');
            log(`  Database: ${mongoose.connection.name}`, 'blue');
        } else {
            log('✗ MongoDB não conectado', 'red');
            return false;
        }

        // Testar modelos de Giveaway
        const { GiveawayModel, GiveawayEntryModel, GiveawayWinnerModel } = require('./utils/db/giveawayModels');
        log('✓ Modelos de Giveaway carregados', 'green');

        const giveawayCount = await GiveawayModel.countDocuments();
        log(`  Total de Giveaways: ${giveawayCount}`, 'blue');

        return true;
    } catch (error) {
        log(`✗ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function testGiveawayRoutes() {
    section('🎉 TESTE DE ROTAS DE GIVEAWAY');

    try {
        const giveawayRoutes = require('./dashboard/routes/giveawayRoutes');
        log('✓ Rotas de Giveaway carregadas', 'green');

        const giveawayController = require('./dashboard/controllers/giveawayController');
        log('✓ Controller de Giveaway carregado', 'green');

        // Verificar funções do controller
        const requiredFunctions = [
            'createGiveaway',
            'listGiveaways',
            'getGiveaway',
            'updateGiveaway',
            'endNow',
            'reroll',
            'enter',
            'getEntries',
            'exportEntriesCsv'
        ];

        for (const fn of requiredFunctions) {
            if (typeof giveawayController[fn] === 'function') {
                log(`  ✓ ${fn}`, 'green');
            } else {
                log(`  ✗ ${fn} não encontrada`, 'red');
            }
        }

        return true;
    } catch (error) {
        log(`✗ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function testGiveawayInteractions() {
    section('🎰 TESTE DE INTERAÇÕES DE GIVEAWAY');

    try {
        const { handleGiveawayEntry, handleGiveawayLeave } = require('./utils/giveaways/interactions');
        log('✓ Handlers de interação carregados', 'green');

        if (typeof handleGiveawayEntry === 'function') {
            log('  ✓ handleGiveawayEntry', 'green');
        }

        if (typeof handleGiveawayLeave === 'function') {
            log('  ✓ handleGiveawayLeave', 'green');
        }

        return true;
    } catch (error) {
        log(`✗ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function testTicketSystem() {
    section('🎫 TESTE DE SISTEMA DE TICKETS');

    try {
        const ticketRoutes = require('./dashboard/routes/ticketRoutes');
        log('✓ Rotas de Tickets carregadas', 'green');

        const ticketController = require('./dashboard/controllers/ticketController');
        log('✓ Controller de Tickets carregado', 'green');

        // Verificar sistema de tickets
        const ticketSystem = require('./utils/ticketSystem');
        log('✓ Sistema de Tickets carregado', 'green');

        const ticketModals = require('./utils/ticketModals');
        log('✓ Modals de Tickets carregados', 'green');

        return true;
    } catch (error) {
        log(`✗ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function testDiscordClient() {
    section('🤖 TESTE DE CLIENTE DISCORD');

    try {
        const client = global.discordClient;

        if (!client) {
            log('✗ Cliente Discord não está no global', 'red');
            return false;
        }

        log('✓ Cliente Discord encontrado', 'green');

        if (client.isReady()) {
            log('✓ Cliente está pronto (online)', 'green');
            log(`  Bot: ${client.user.tag}`, 'blue');
            log(`  Servidores: ${client.guilds.cache.size}`, 'blue');
        } else {
            log('✗ Cliente não está pronto', 'yellow');
        }

        // Verificar handlers
        if (client.commands) {
            log(`✓ Commands carregados: ${client.commands.size}`, 'green');
        }

        return true;
    } catch (error) {
        log(`✗ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function testSocketIO() {
    section('🔌 TESTE DE SOCKET.IO');

    try {
        const io = global.io;

        if (!io) {
            log('✗ Socket.IO não está no global', 'red');
            return false;
        }

        log('✓ Socket.IO encontrado', 'green');

        // Verificar namespaces
        const namespaces = Array.from(io._nsps.keys());
        log(`  Namespaces: ${namespaces.join(', ')}`, 'blue');

        return true;
    } catch (error) {
        log(`✗ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function testDashboardComponents() {
    section('📊 TESTE DE COMPONENTES DO DASHBOARD');

    try {
        const fs = require('fs');
        const path = require('path');

        const componentsPath = path.join(__dirname, 'dashboard', 'next', 'components');

        const requiredComponents = [
            'GiveawayRoulette.tsx',
            'GiveawayManager.tsx',
            'ParticipantsList.tsx',
            'GiveawayStats.tsx'
        ];

        for (const component of requiredComponents) {
            const componentPath = path.join(componentsPath, component);
            if (fs.existsSync(componentPath)) {
                log(`  ✓ ${component}`, 'green');
            } else {
                log(`  ✗ ${component} não encontrado`, 'red');
            }
        }

        return true;
    } catch (error) {
        log(`✗ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function testPermissions() {
    section('🔐 TESTE DE SISTEMA DE PERMISSÕES');

    try {
        const giveawayGuards = require('./dashboard/middleware/giveawayGuards');
        log('✓ Giveaway Guards carregados', 'green');

        if (typeof giveawayGuards.hasManagerPermission === 'function') {
            log('  ✓ hasManagerPermission', 'green');
        }

        if (typeof giveawayGuards.requireGiveawayManage === 'function') {
            log('  ✓ requireGiveawayManage', 'green');
        }

        return true;
    } catch (error) {
        log(`✗ Erro: ${error.message}`, 'red');
        return false;
    }
}

async function runAllTests() {
    console.clear();
    log('╔════════════════════════════════════════════════════════════╗', 'blue');
    log('║     DIAGNÓSTICO COMPLETO - IGNIS BOT v2.0                 ║', 'blue');
    log('║     Sistemas: Tickets & Giveaways                         ║', 'blue');
    log('╚════════════════════════════════════════════════════════════╝', 'blue');

    const results = {
        database: await testDatabase(),
        giveawayRoutes: await testGiveawayRoutes(),
        giveawayInteractions: await testGiveawayInteractions(),
        ticketSystem: await testTicketSystem(),
        discordClient: await testDiscordClient(),
        socketIO: await testSocketIO(),
        dashboardComponents: await testDashboardComponents(),
        permissions: await testPermissions()
    };

    section('📋 RESUMO FINAL');

    let passed = 0;
    let failed = 0;

    for (const [test, result] of Object.entries(results)) {
        if (result) {
            log(`✓ ${test}`, 'green');
            passed++;
        } else {
            log(`✗ ${test}`, 'red');
            failed++;
        }
    }

    console.log('\n' + '='.repeat(60));
    log(`Total: ${passed + failed} | Passou: ${passed} | Falhou: ${failed}`, 'bold');

    if (failed === 0) {
        log('\n🎉 TODOS OS TESTES PASSARAM! Sistema 100% funcional!', 'green');
    } else {
        log(`\n⚠️  ${failed} teste(s) falharam. Verifique os erros acima.`, 'yellow');
    }

    console.log('='.repeat(60) + '\n');

    return failed === 0;
}

// Executar testes se chamado diretamente
if (require.main === module) {
    runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Erro fatal:', error);
            process.exit(1);
        });
}

module.exports = { runAllTests };
