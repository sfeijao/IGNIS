(function(){
  if (window.IGNISFetch && window.IGNISFetch.fetchJsonCached) return;
  const ns = window.IGNISFetch || (window.IGNISFetch = {});
  const store = ns.__store || (ns.__store = new Map());
  function keyOf(url, opts){ try { return (opts && opts.key) ? String(opts.key) : String(url);} catch { return String(url);} }
  ns.fetchJsonCached = async function(url, opts){
    const ttl = (opts && Number(opts.ttlMs)) || 60_000;
    const key = keyOf(url, opts);
    const now = Date.now();
    let entry = store.get(key);
    if (entry && entry.data && (now - entry.at < ttl)) return { ok:true, json:entry.data, stale:!!entry.stale, fromCache:true };
    if (entry && entry.promise) return entry.promise;
    const p = (async () => {
      const res = await fetch(url, { credentials: (opts && opts.credentials) || 'same-origin', headers: (opts && opts.headers) || {} });
      const stale = res.headers.get('X-Stale-Cache') === '1';
      const json = await res.json().catch(()=>({}));
      const ok = res.ok && json && json.success !== false;
      if (ok) store.set(key, { at: Date.now(), data: json, stale: false, promise: null });
      if (stale) { const e = store.get(key); if (e) e.stale = true; }
      return { ok, json, stale, status: res.status };
    })();
    store.set(key, { at: now, data: null, stale: false, promise: p });
    const out = await p; const cur = store.get(key); if (cur) cur.promise = null; return out;
  };
})();
