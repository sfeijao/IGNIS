// Test moderation action
const http = require('http');

const testModerationAction = (action, userId, reason, token) => {
    const data = JSON.stringify({
        action: action,
        memberId: userId,
        reason: reason
    });

    const options = {
        hostname: 'localhost',
        port: 4000,
        path: `/api/admin/members/action`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
            responseData += chunk;
        });
        res.on('end', () => {
            console.log(`\n=== Testing ${action} action ===`);
            console.log(`Status: ${res.statusCode}`);
            console.log(`Response: ${responseData}`);
        });
    });

    req.on('error', (error) => {
        console.error('Error:', error);
    });

    req.write(data);
    req.end();
};

// Test moderation actions with dev-token
const testUserId = '123456789012345678';
const testReason = 'Test moderation action';

console.log('Testing moderation actions with dev-token...');

testModerationAction('kick', testUserId, testReason, 'dev-token');

setTimeout(() => {
    testModerationAction('ban', testUserId, testReason, 'admin-token');
}, 1000);

setTimeout(() => {
    testModerationAction('timeout', testUserId, testReason, 'dashboard-token');
}, 2000);
