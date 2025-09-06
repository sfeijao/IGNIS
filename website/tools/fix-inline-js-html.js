const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const backupDir = path.join(__dirname, '..', 'public_backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const htmlFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));
const suspiciousPatterns = [
  /\/\//, // JS comments
  /\bwhile\s*\(/i,
  /\bfunction\s+\w+/i,
  /\bnew\s+YSNMDashboard\b/i,
  /preview\.style\.setProperty/i,
  /embedInputs\b/i,
  /embedTitle\b/i,
  /document\.createElement\(/i,
  /innerHTML\b/i
];

const standardScripts = [
  '<script src="/js/dompurify.min.js"></script>',
  '<script src="/js/frontend-helpers.js"></script>',
  '<script src="/js/script.js"></script>'
];

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

function ensureScriptsPresent(html) {
  const lower = html.toLowerCase();
  const need = standardScripts.filter(s => !lower.includes(s.toLowerCase()));
  if (need.length === 0) return html;
  if (lower.includes('</body>')) {
    return html.replace(/<\/body>/i, need.join('\n') + '\n</body>');
  }
  return html + '\n' + need.join('\n');
}

function processFile(file) {
  const full = path.join(publicDir, file);
  let content = fs.readFileSync(full, 'utf8');

  // Remove script blocks to inspect only visible HTML
  const scriptRegex = /<script[\s\S]*?<\/script>/gi;
  const scripts = content.match(scriptRegex) || [];
  const contentNoScripts = content.replace(scriptRegex, '');

  // Check for suspicious tokens outside script tags
  const lines = contentNoScripts.split(/\r?\n/);
  let changed = false;
  const cleanedLines = lines.map(line => {
    const shouldStrip = suspiciousPatterns.some(p => p.test(line));
    if (shouldStrip && line.trim().length > 0) {
      changed = true;
      return ''; // remove the line
    }
    return line;
  });

  if (!changed) return null;

  // Backup original
  const bakPath = path.join(backupDir, `${file}.${timestamp()}.bak`);
  fs.writeFileSync(bakPath, content, 'utf8');

  // Reconstruct: cleaned HTML + original scripts appended + ensure standard scripts
  let newHtml = cleanedLines.join('\n') + '\n' + scripts.join('\n');
  newHtml = ensureScriptsPresent(newHtml);
  fs.writeFileSync(full, newHtml, 'utf8');
  return { file, bakPath };
}

const results = [];
htmlFiles.forEach(f => {
  try {
    const r = processFile(f);
    if (r) results.push(r);
  } catch (e) {
    console.error('Error processing', f, e && e.message);
  }
});

if (results.length === 0) {
  console.log('No HTML files needed cleaning.');
} else {
  console.log('Cleaned files:');
  results.forEach(r => console.log('-', r.file, 'backup->', r.bakPath));
}
