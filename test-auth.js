// Test authentication script
const http = require('http');

const testAuth = (token) => {
    const options = {
        hostname: 'localhost',
        port: 4000,
        path: '/api/test-auth',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Response: ${data}`);
        });
    });

    req.on('error', (error) => {
        console.error('Error:', error);
    });

    req.end();
};

// Test different tokens
console.log('Testing dev-token...');
testAuth('dev-token');

setTimeout(() => {
    console.log('\nTesting admin-token...');
    testAuth('admin-token');
}, 1000);

setTimeout(() => {
    console.log('\nTesting dashboard-token...');
    testAuth('dashboard-token');
}, 2000);

setTimeout(() => {
    console.log('\nTesting Discord bot token...');
    // Token real do seu bot do config.json
    testAuth('MTQwNDU4NDk0OTI4NTM4ODMzOQ.GcRiYa.9cr231ajakipPbuj9T6fUK3eJSubWZn4F57DFc');
}, 3000);

setTimeout(() => {
    console.log('\nTesting invalid token...');
    testAuth('invalid-token');
}, 4000);
