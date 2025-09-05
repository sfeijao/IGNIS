const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

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

function analyzeFile(file) {
    const rel = path.relative(publicDir, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    const issues = [];

    if (/\$\{[^}]*\}/.test(text)) issues.push('template-placeholder-${} found');
    if (/%24%7B/i.test(text)) issues.push('encoded-placeholder-%24%7B found');
    if (/backup|_backup|original-backup|\.bak/i.test(rel)) issues.push('filename looks like backup');
    if (/src=["']?\/?js\//i.test(text)) issues.push('script src references /js/ (verify path)');

    return { file: rel, issues };
}

function main() {
    console.log('Scanning website/public for issues...');
    // Focus placeholder scans on HTML files only to avoid false positives in JS helper files
    const files = walk(publicDir).filter(f => f.endsWith('.html') || f.endsWith('.htm'));
    const report = files.map(analyzeFile).filter(r => r.issues.length > 0);
    if (report.length === 0) {
        console.log('No issues detected.');
        return;
    }
    console.log('Found', report.length, 'files with possible issues:');
    report.forEach(r => {
        console.log('- ' + r.file);
        r.issues.forEach(i => console.log('   - ' + i));
    });
}

if (require.main === module) main();
module.exports = { main };
