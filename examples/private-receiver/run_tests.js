const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
console.log('Running receiver tests (ensure server is running on port 3001)');
try {
  console.log('-> test-post-signed.js');
  execSync('node .\\examples\\private-receiver\\test-post-signed.js', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.error('test-post-signed failed', e && e.message ? e.message : e);
}

try {
  console.log('-> test-send-from-bot.js');
  execSync('node .\\examples\\private-receiver\\test-send-from-bot.js', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.error('test-send-from-bot failed', e && e.message ? e.message : e);
}

try {
  console.log('-> test-replay.js');
  execSync('node .\\examples\\private-receiver\\test-replay.js', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.error('test-replay failed', e && e.message ? e.message : e);
}

try {
  console.log('-> tests/test_privateLogger.js');
  execSync('node .\\examples\\private-receiver\\tests\\test_privateLogger.js', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.error('test_privateLogger failed', e && e.message ? e.message : e);
}

try {
  console.log('-> tests/test_receiver_hmac.js');
  execSync('node .\\examples\\private-receiver\\tests\\test_receiver_hmac.js', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.error('test_receiver_hmac failed', e && e.message ? e.message : e);
}

console.log('done');
