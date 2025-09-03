const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const backupDir = path.join(__dirname, 'backup_public_html_' + Date.now());

function ensureDir(d){ if(!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
ensureDir(backupDir);

const htmlFiles = [];
function walk(dir){
  for(const f of fs.readdirSync(dir)){
    const p = path.join(dir,f);
    const st = fs.statSync(p);
    if(st.isDirectory()) walk(p);
    else if(p.endsWith('.html')) htmlFiles.push(p);
  }
}
walk(publicDir);

console.log('Found', htmlFiles.length, '.html files in public. Backup dir:', backupDir);

const placeholderRegex = /\$\{[^}]*\}/g; // matches ${...}
const encodedRegex = /%24%7B/gi; // matches encoded %24%7B

const report = [];
for(const file of htmlFiles){
  const rel = path.relative(publicDir, file);
  let content = fs.readFileSync(file,'utf8');

  // Skip processing inside <script> and <style> blocks: split by those blocks
  const parts = [];
  let lastIndex = 0;
  const tagRegex = /<(?:(script|style)\b)[^>]*>[\s\S]*?<\/\1>/gi;
  let m;
  while((m = tagRegex.exec(content)) !== null){
    const start = m.index;
    const end = tagRegex.lastIndex;
    parts.push({ type: 'html', text: content.slice(lastIndex, start) });
    parts.push({ type: 'code', text: content.slice(start, end) });
    lastIndex = end;
  }
  if(lastIndex < content.length) parts.push({ type: 'html', text: content.slice(lastIndex) });

  let patched = false;
  for(const p of parts){
    if(p.type === 'html'){
      const before = p.text;
      const replaced = before.replace(encodedRegex, '').replace(placeholderRegex, '');
      if(replaced !== before){
        p.text = replaced;
        patched = true;
      }
    }
  }

  if(!patched) continue;

  // backup original
  const dest = path.join(backupDir, rel);
  ensureDir(path.dirname(dest));
  fs.copyFileSync(file, dest);

  // reassemble content
  const newContent = parts.map(p=>p.text).join('');
  fs.writeFileSync(file, newContent, 'utf8');
  report.push({ file: rel });
  console.log('Patched file:', rel);
}

console.log('Patched', report.length, 'files.');
if(report.length===0) console.log('No changes required.');

process.exit(0);
