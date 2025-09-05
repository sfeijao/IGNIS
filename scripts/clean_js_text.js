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
  return content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, match => ' '.repeat(match.length));
}

const publicDir = path.join(__dirname, '..', 'website', 'public');
const files = findHtmlFiles(publicDir);
const suspiciousRe = /\b(document\.|appendChild\(|function\s+\w+\s*\(|console\.|\bconst\s+\w+|\blet\s+\w+|\bvar\s+\w+|=>)\b/;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const cleanable = stripScripts(content);
  const lines = content.split(/\r?\n/);
  const maskLines = cleanable.split(/\r?\n/);
  let changed = false;
  for (let i = 0; i < maskLines.length; i++) {
    const l = maskLines[i];
    if (suspiciousRe.test(l) && l.trim().length > 8) {
      // remove the corresponding original line
      lines[i] = '';
      changed = true;
    }
  }
  if (changed) {
    // backup
    fs.writeFileSync(file + '.bak', content, 'utf8');
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Cleaned:', file);
  }
});
