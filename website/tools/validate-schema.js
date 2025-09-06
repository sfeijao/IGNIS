const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
if (!fs.existsSync(schemaPath)) {
  console.error('schema.sql not found at', schemaPath);
  process.exit(2);
}

const sql = fs.readFileSync(schemaPath, 'utf8');
const db = new sqlite3.Database(':memory:');

console.log('Applying schema from', schemaPath, 'into in-memory SQLite DB...');

db.exec('PRAGMA foreign_keys = ON;')
db.exec(sql, (err) => {
  if (err) {
    console.error('ERROR applying schema:', err && err.message ? err.message : err);
    process.exit(3);
  }
  console.log('Schema applied successfully (in-memory). No syntax errors detected.');
  process.exit(0);
});
