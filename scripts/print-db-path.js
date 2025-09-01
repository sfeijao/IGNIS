const path = require('path');
const fs = require('fs');
const dbPath = path.join(__dirname, '..', 'website', 'database', 'ysnm_dashboard.db');
console.log('dbPath:', dbPath);
console.log('exists:', fs.existsSync(dbPath));
try { const stat = fs.statSync(dbPath); console.log('size:', stat.size); } catch(e) { }
