const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const backupDir = path.join(__dirname, '..', 'public_backups');

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

const files = walk(publicDir);
let moved = 0;
files.forEach(f => {
    const rel = path.relative(publicDir, f).replace(/\\/g, '/');
    const lower = rel.toLowerCase();
    if (/backup|_backup|original-backup|\.bak/i.test(lower)) {
        const dest = path.join(backupDir, rel);
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.renameSync(f, dest);
        console.log('Moved', rel, '->', path.relative(process.cwd(), dest));
        moved++;
    }
});
console.log('Done. Files moved:', moved);
