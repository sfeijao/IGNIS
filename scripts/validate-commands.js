const fs = require('fs');
const path = require('path');

const commandsDir = path.join(__dirname, '..', 'commands');

console.log('Scanning command files in', commandsDir);

const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
let problems = 0;

for (const file of files) {
  const full = path.join(commandsDir, file);
  try {
    const cmd = require(full);
    if (!cmd || !cmd.data || typeof cmd.data.toJSON !== 'function') {
      console.log(`- SKIP ${file}: no data.toJSON()`);
      continue;
    }
    // This will throw if the builder data is invalid
    const json = cmd.data.toJSON();
    console.log(`+ OK ${file} -> name=${json.name} desc=${typeof json.description === 'string' ? json.description : '<NO DESC>'}`);
  } catch (err) {
    problems++;
    console.error(`! ERROR ${file}:`, err && err.message ? err.message : err);
  }
}

if (problems === 0) {
  console.log('\n✅ All command builders validated OK');
  process.exit(0);
} else {
  console.error(`\n❌ Found ${problems} problem(s) in command builders`);
  process.exit(2);
}
