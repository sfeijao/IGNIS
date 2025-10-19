#!/usr/bin/env node
/*
  Resolve an Atlas mongodb+srv URI to a standard mongodb URI by querying DNS over HTTPS.
  Usage:
    node scripts/resolve-srv.js               # uses env MONGO_URI/MONGODB_URI
    node scripts/resolve-srv.js <mongo_uri>   # specific URI
  Output: prints a suggested standard mongodb URI (with your credentials) to stdout.
  Note: This prints credentials to your terminal. Do NOT paste the output publicly.
*/

const fetch = require('node-fetch');
require('dotenv').config();

function parseUri(uri){
  const m = uri.match(/^(mongodb\+srv):\/\/([^@]+)@([^/?#]+)(\/?[^?#]*)?(?:\?([^#]*))?/i);
  if (!m) return null;
  return { scheme: m[1], auth: m[2], host: m[3], path: m[4] || '', query: m[5] || '' };
}

function parseQuery(q){
  const out = {};
  if (!q) return out;
  for (const part of q.split('&')){
    const [k,v] = part.split('=');
    if (!k) continue;
    out[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
  }
  return out;
}

async function dohJson(name, type){
  const u = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type||'A')}`;
  const res = await fetch(u, { headers: { 'accept': 'application/dns-json' } });
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
  return await res.json();
}

function pickReplicaSetFromTxt(txtRecords){
  for (const rr of txtRecords){
    const joined = rr.join('');
    const m = joined.match(/replicaSet=([^&\s"]+)/i);
    if (m) return m[1];
  }
  return null;
}

function pickTxtOptions(txtRecords){
  const opts = {};
  for (const rr of txtRecords){
    const joined = rr.join('');
    for (const kv of joined.split('&')){
      const [k,v] = kv.split('=');
      if (k) opts[k] = v || '';
    }
  }
  return opts;
}

(async () => {
  const input = process.argv[2] || process.env.MONGO_URI || process.env.MONGODB_URI || '';
  if (!/^mongodb\+srv:\/\//i.test(input)){
    console.log('Input is not mongodb+srv. Nothing to convert.');
    console.log(input);
    process.exit(0);
  }
  const p = parseUri(input);
  if (!p){
    console.error('Failed to parse mongodb+srv URI.');
    process.exit(2);
  }
  const srvName = `_mongodb._tcp.${p.host}`;
  const srv = await dohJson(srvName, 'SRV').catch(e => ({ Status: 2, Error: e.message }));
  if (!srv || srv.Status !== 0 || !Array.isArray(srv.Answer)){
    console.error('SRV query failed via DoH:', srv && (srv.Error || srv.Comment || srv.Status));
    process.exit(3);
  }
  const answers = srv.Answer.filter(a => a.type === 33); // SRV
  const hosts = answers.map(a => {
    // SRV data is: priority weight port target
    const parts = a.data.trim().split(/\s+/);
    const port = parts[2];
    const target = parts[3].replace(/\.$/, '');
    return { host: target, port };
  });
  if (!hosts.length){
    console.error('No SRV hosts found.');
    process.exit(4);
  }
  const txt = await dohJson(p.host, 'TXT').catch(() => null);
  let txtOpts = {};
  if (txt && txt.Status === 0 && Array.isArray(txt.Answer)){
    const records = txt.Answer.map(a => a.data.replace(/^"|"$/g,'')).map(s => s.split('" "'));
    txtOpts = pickTxtOptions(records);
  }
  // Build standard mongodb:// URI
  const seed = hosts.map(h => `${h.host}:${h.port}`).join(',');
  const existingParams = parseQuery(p.query);
  const finalParams = Object.assign({
    tls: 'true',
    retryWrites: existingParams.retryWrites || 'true',
    w: existingParams.w || 'majority'
  }, txtOpts, existingParams);
  const qp = Object.entries(finalParams).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const standard = `mongodb://${p.auth}@${seed}/?${qp}`;
  console.log(standard);
})();
