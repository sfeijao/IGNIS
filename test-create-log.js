#!/usr/bin/env node

/**
 * 🧪 Test createLog function
 * Simple test to verify the createLog function works correctly
 */

const config = require('./utils/config');

async function testCreateLog() {
    console.log('🧪 Testing createLog function...');
    
    try {
        if (!config.DISCORD.CLIENT_SECRET) {
            console.log('⚠️  CLIENT_SECRET not available - skipping database test');
            return;
        }
        
        const Database = require('./website/database/database');
        const db = new Database();
        
        await db.initialize();
        console.log('✅ Database initialized');
        
        // Test 1: Object format (like events use)
        console.log('\n📝 Test 1: Object format');
        const result1 = await db.createLog({
            guild_id: '1333820000791691284',
            type: 'test_object_format',
            level: 'info',
            message: 'Test log entry using object format',
            user_id: '123456789',
            details: { test: true, method: 'object' }
        });
        console.log('✅ Object format result:', result1);
        
        // Test 2: Parameter format (like API uses)
        console.log('\n📝 Test 2: Parameter format');
        const result2 = await db.createLog('1333820000791691284', 'test_parameter_format', {
            ticketId: 5,
            title: 'Test ticket',
            createdBy: '987654321',
            description: 'Test log entry using parameter format'
        });
        console.log('✅ Parameter format result:', result2);
        
        // Test 3: Verify logs were created
        console.log('\n📝 Test 3: Retrieve logs');
        const logs = await db.getLogs('1333820000791691284', null, 5);
        console.log('✅ Retrieved logs:', logs.length, 'entries');
        logs.forEach(log => {
            console.log(`   - ${log.type}: ${log.message} (${log.timestamp})`);
        });
        
        console.log('\n🎉 All tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    testCreateLog();
}

module.exports = { testCreateLog };
