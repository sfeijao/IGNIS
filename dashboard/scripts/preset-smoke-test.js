#!/usr/bin/env node
// Quick smoke test for moderation preset sync endpoints
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

async function run(){
  const guildId = process.argv[2];
  if(!guildId){ console.error('Usage: node preset-smoke-test.js <guildId>'); process.exit(1); }
  function log(step, ok, extra){ console.log(`[${step}] ${ok?'OK':'FAIL'}${extra? ' - ' + extra:''}`); }
  try {
    const base = `http://localhost:${process.env.PORT||3000}`;
    // 1. Get current presets
    let r = await fetch(`${base}/api/guild/${guildId}/mod-presets`, { credentials:'include' });
    let j = await r.json(); log('GET initial', j.success, Object.keys(j.presets||{}).length + ' presets');
    const name = 'smoke_test_' + Date.now();
    const body = { name, preset: { whitelist:['id'], includePrefixes:[], headerMap:{ id:'Log ID'}, orderMode:'whitelist', groups:[], groupedSectionRows:false, includeArrays:true, maxDepth:5, dateFormat:'iso', includeRawOriginal:false, previewRowLimit:5, groupsDisabled:[] } };
    // 2. Post single preset
    r = await fetch(`${base}/api/guild/${guildId}/mod-presets`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    j = await r.json(); log('POST upsert', j.success);
    // 3. Verify presence
    r = await fetch(`${base}/api/guild/${guildId}/mod-presets`); j = await r.json();
    log('GET verify add', j.success && j.presets && j.presets[name] ? true:false);
    // 4. Delete it
    r = await fetch(`${base}/api/guild/${guildId}/mod-presets/${encodeURIComponent(name)}`, { method:'DELETE' }); j = await r.json(); log('DELETE preset', j.success);
    // 5. Final list
    r = await fetch(`${base}/api/guild/${guildId}/mod-presets`); j = await r.json(); log('GET final', j.success);
  } catch(e){ console.error('Smoke test error:', e); process.exit(2); }
}
run();
