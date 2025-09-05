const fs = require('fs');
const path = require('path');

function findHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) result.push(...findHtmlFiles(full));
    else if (e.isFile() && full.endsWith('.html')) result.push(full);
  }
  return result;
}

function stripScripts(content) {
  // remove <script ...>...</script> blocks
  return content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

function scanFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const outside = stripScripts(content);
  const suspicious = [];
  const patterns = [ /appendChild\s*\(/, /document\./, /function\s+\w+\s*\(/, /console\./, /\bconst\s+\w+/, /\blet\s+\w+/, /\bvar\s+\w+/, /\$\{[^}]+\}/ ];
  const lines = outside.split(/\r?\n/);
  lines.forEach((ln, idx) => {
    for (const p of patterns) {
      if (p.test(ln)) {
        suspicious.push({ line: idx + 1, text: ln.trim(), pattern: p.toString() });
        break;
      }
    }
  });
  return suspicious;
}

const publicDir = path.join(__dirname, '..', 'website', 'public');
const files = findHtmlFiles(publicDir);
let total = 0;
for (const f of files) {
  const s = scanFile(f);
  if (s.length) {
    total += s.length;
    console.log('----', f);
    s.slice(0, 50).forEach(r => console.log('  L' + r.line + ':', r.text));
  }
}
if (total === 0) console.log('No suspicious JS-like text found outside <script> tags.');
else console.log('Total suspicious fragments found:', total);
