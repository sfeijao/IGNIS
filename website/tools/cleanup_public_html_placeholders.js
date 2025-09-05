const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const backupDir = path.join(__dirname, '..', 'public_backups_html');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

function walk(dir) {
    const results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const p = path.join(dir, file);
        const stat = fs.statSync(p);
        if (stat && stat.isDirectory()) results.push(...walk(p));
        else results.push(p);
    });
    return results;
}

const files = walk(publicDir).filter(f => f.endsWith('.html') || f.endsWith('.htm'));
let changed = 0;
files.forEach(file => {
    const rel = path.relative(publicDir, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    const cleaned = text.replace(/\$\{[^}]*\}/g, '').replace(/%24%7B/gi, '');
    if (cleaned !== text) {
        const dest = path.join(backupDir, rel);
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(file, dest);
        fs.writeFileSync(file, cleaned, 'utf8');
        console.log('Cleaned:', rel);
        changed++;
    }
});
console.log('Done. Files changed:', changed);
