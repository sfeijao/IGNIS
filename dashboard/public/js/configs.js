(function(){
  // Ensure guild context
  try{
    const params = new URLSearchParams(window.location.search);
    const gid = params.get('guildId');
    if(!gid){
      const last = localStorage.getItem('IGNIS_LAST_GUILD');
      if(last){
        const q = new URLSearchParams(window.location.search);
        q.set('guildId', last);
        const next = `${window.location.pathname}?${q.toString()}${window.location.hash||''}`;
        window.location.replace(next);
        return;
      } else {
        window.location.href = '/dashboard';
        return;
      }
    } else {
      try{ localStorage.setItem('IGNIS_LAST_GUILD', gid); }catch{}
    }
  }catch{}
})();

(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const logsSel = document.getElementById('cfgLogsChannel');
  const roleSel = document.getElementById('cfgStaffRole');
  const btn = document.getElementById('cfgSave');
  const autoRefreshChk = document.getElementById('cfgAutoRefreshPanels');
  const routeCreate = document.getElementById('routeCreate');
  const routeClose = document.getElementById('routeClose');
  const routeUpdate = document.getElementById('routeUpdate');
  const routeClaim = document.getElementById('routeClaim');

  function notify(msg, type='info') {
    const div = document.createElement('div');
    div.className = `notification notification-${type} slide-up`;
    div.innerHTML = `<i class="fas ${type==='error'?'fa-exclamation-circle': type==='success'? 'fa-check-circle':'fa-info-circle'}"></i><span>${msg}</span>`;
    document.body.appendChild(div);
    setTimeout(() => { div.style.animation = 'slideDown 0.3s ease-in'; setTimeout(() => div.remove(), 300); }, 3000);
  }

  async function api(path, opts) {
    const isGet = !opts || !opts.method || String(opts.method).toUpperCase() === 'GET';
    if (isGet && window.IGNISFetch && window.IGNISFetch.fetchJsonCached){
      const { ok, json, stale, status } = await window.IGNISFetch.fetchJsonCached(path, { ttlMs: 60_000, credentials:'same-origin', headers:{'Content-Type':'application/json'} });
      if (stale) showStaleBanner();
      if (!ok) throw new Error(json?.error || `HTTP ${status||500}`);
      return json;
    }
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...opts });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  function showStaleBanner(){
    try {
      if (document.getElementById('stale-banner')) return;
      const el=document.createElement('div'); el.id='stale-banner'; el.style.position='fixed'; el.style.bottom='16px'; el.style.left='50%'; el.style.transform='translateX(-50%)'; el.style.background='rgba(124,58,237,0.95)'; el.style.color='#fff'; el.style.padding='10px 14px'; el.style.borderRadius='8px'; el.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)'; el.style.zIndex='9999'; el.style.fontSize='14px'; el.textContent='Mostrando dados em cache temporariamente (a API do Discord limitou pedidos).'; document.body.appendChild(el); setTimeout(()=>{ el.remove(); }, 4000);
    } catch {}
  }

  async function loadChannels() {
    try { const d = await api(`/api/guild/${guildId}/channels`); logsSel.innerHTML = `<option value="">—</option>` + d.channels.map(c => `<option value="${c.id}">${c.name}</option>`).join(''); } catch {}
  }
  async function loadRoles() {
    try { const d = await api(`/api/guild/${guildId}/roles`); roleSel.innerHTML = `<option value="">—</option>` + d.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join(''); } catch {}
  }
  async function loadConfig() {
    try {
      const d = await api(`/api/guild/${guildId}/config`);
      const cfg = d.config || {};
      if (cfg.logs_channel_id) logsSel.value = cfg.logs_channel_id;
      if (cfg.staff_role_id) roleSel.value = cfg.staff_role_id;
      if (autoRefreshChk) autoRefreshChk.checked = (cfg.autoRefreshPanels !== false);
  const routing = (cfg.webhookRouting) || {};
      if (routeCreate) routeCreate.value = routing.create || 'tickets';
      if (routeClose) routeClose.value = routing.close || 'tickets';
      if (routeUpdate) routeUpdate.value = routing.update || 'updates';
  if (routeClaim) routeClaim.value = routing.claim || 'updates';
    } catch {}
  }

  if (btn) btn.addEventListener('click', async () => {
    try {
      // Validation: warn when routing points to missing webhook types
      try {
        const listData = await api(`/api/guild/${guildId}/webhooks`);
        const loadedTypes = new Set((listData.webhooks || []).map(w => w.type || 'logs'));
        const sel = {
          create: routeCreate?.value || 'tickets',
          close: routeClose?.value || 'tickets',
          update: routeUpdate?.value || 'updates',
          claim: routeClaim?.value || 'updates'
        };
        const missing = Array.from(new Set(Object.values(sel))).filter(t => !loadedTypes.has(t));
        if (missing.length) {
          notify(`Atenção: mapeamento aponta para tipos não configurados: ${missing.join(', ')}`, 'error');
        }
      } catch {}
      const updates = {
        logs_channel_id: logsSel.value || null,
        staff_role_id: roleSel.value || null,
        autoRefreshPanels: autoRefreshChk ? !!autoRefreshChk.checked : true,
        webhookRouting: {
          create: routeCreate?.value || 'tickets',
          close: routeClose?.value || 'tickets',
          update: routeUpdate?.value || 'updates',
          claim: routeClaim?.value || 'updates'
        }
      };
      await api(`/api/guild/${guildId}/config`, { method: 'POST', body: JSON.stringify(updates) });
      notify('Configurações guardadas', 'success');
    } catch (err) { notify(err.message, 'error'); }
  });

  if (!guildId) { notify('guildId em falta', 'error'); return; }
  loadChannels();
  loadRoles();
  loadConfig();
})();
