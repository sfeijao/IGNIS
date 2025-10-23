(function(){
  // Ensure guild context
  try{
    const params0 = new URLSearchParams(window.location.search);
    const gid0 = params0.get('guildId');
    if(!gid0){
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
      try{ localStorage.setItem('IGNIS_LAST_GUILD', gid0); }catch{}
    }
  }catch{}
})();

(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  let page = 1; let perPage = 100; let total = 0;
  const els = {
    type: document.getElementById('fType'),
    from: document.getElementById('fFrom'),
    to: document.getElementById('fTo'),
    q: document.getElementById('fQuery'),
    apply: document.getElementById('btnApply'),
    list: document.getElementById('logsList'),
    exportCsv: document.getElementById('btnExportCsv'),
    exportTxt: document.getElementById('btnExportTxt'),
  };

  function notify(msg, type='info'){
    const n = document.createElement('div');
    n.className = `notification notification-${type} slide-up`;
    n.innerHTML = `<i class="fas ${type==='error'?'fa-exclamation-circle': type==='success'?'fa-check-circle':'fa-info-circle'}"></i><span>${msg}</span>`;
    document.body.appendChild(n);
    setTimeout(()=>{n.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>n.remove(),300);},2500);
  }

  function buildUrl(){
    const u = new URL(`/api/guild/${guildId}/logs`, window.location.origin);
    const type = (els.type?.value||'').trim(); if (type) u.searchParams.set('type', type);
    const from = (els.from?.value||'').trim(); if (from) u.searchParams.set('from', from);
    const to = (els.to?.value||'').trim(); if (to) u.searchParams.set('to', to);
    const q = (els.q?.value||'').trim(); if (q) u.searchParams.set('q', q);
    u.searchParams.set('page', String(page));
    u.searchParams.set('limit', String(perPage));
    return u.toString();
  }

  async function fetchLogs(){
    if (!guildId) return notify('guildId em falta','error');
    els.list.innerHTML = `<div class="loading"><span class="loading-spinner"></span> A carregar...</div>`;
    try {
      const r = await fetch(buildUrl(), { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
      const items = Array.isArray(d.logs)? d.logs: [];
      // Fetch total for accurate page count
      try {
        const cu = new URL(`/api/guild/${guildId}/logs/count`, window.location.origin);
        const type = (els.type?.value||'').trim(); if (type) cu.searchParams.set('type', type);
        const from = (els.from?.value||'').trim(); if (from) cu.searchParams.set('from', from);
        const to = (els.to?.value||'').trim(); if (to) cu.searchParams.set('to', to);
        const q = (els.q?.value||'').trim(); if (q) cu.searchParams.set('q', q);
        const cr = await fetch(cu, { credentials: 'same-origin' });
        const cd = await cr.json();
        total = (cr.ok && typeof cd.total === 'number') ? cd.total : items.length;
      } catch { total = items.length; }
      render(items);
      renderPager();
    } catch(e){ console.error(e); notify(e.message,'error'); els.list.innerHTML = `<div class="no-tickets">Erro ao carregar logs</div>`; }
  }

  function render(items){
    if (!items.length){ els.list.innerHTML = `<div class="no-tickets">Sem resultados</div>`; return; }
    els.list.innerHTML = items.map(l => `
      <div class="log-item">
        <div class="log-meta">[${new Date(l.timestamp).toLocaleString('pt-PT')}] [${l.type||'log'}]</div>
        <div>${escapeHtml(l.message||'')}</div>
      </div>
    `).join('');
  }

  function renderPager(){
    try {
      const parent = els.list?.parentElement || document.body;
      let bar = document.getElementById('logsPager');
      if (!bar) { bar = document.createElement('div'); bar.id = 'logsPager'; bar.style.marginTop='8px'; bar.style.display='flex'; bar.style.gap='8px'; bar.style.alignItems='center'; parent.appendChild(bar); }
      const totalPages = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
      bar.innerHTML = '';
      const prev = document.createElement('button'); prev.className='btn btn-glass'; prev.textContent='Anterior'; prev.disabled = page<=1;
      const next = document.createElement('button'); next.className='btn btn-glass'; next.textContent='Próxima'; next.disabled = page>=totalPages;
      const info = document.createElement('span'); info.className='text-secondary'; info.textContent = `Página ${page} de ${totalPages} • Itens ${perPage} (Total ${total})`;
      prev.addEventListener('click', ()=>{ if(page>1){ page--; fetchLogs(); }});
      next.addEventListener('click', ()=>{ if(page<totalPages){ page++; fetchLogs(); }});
      bar.appendChild(prev); bar.appendChild(next); bar.appendChild(info);
    } catch {}
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); }

  function exportAs(fmt){
    const u = new URL(`/api/guild/${guildId}/logs/export`, window.location.origin);
    const type = (els.type?.value||'').trim(); if (type) u.searchParams.set('type', type);
    const from = (els.from?.value||'').trim(); if (from) u.searchParams.set('from', from);
    const to = (els.to?.value||'').trim(); if (to) u.searchParams.set('to', to);
    const q = (els.q?.value||'').trim(); if (q) u.searchParams.set('q', q);
    u.searchParams.set('page', String(page));
    u.searchParams.set('limit', String(perPage));
    u.searchParams.set('format', fmt);
    window.location.href = u.toString();
  }

  els.apply?.addEventListener('click', ()=>{ page = 1; fetchLogs(); });
  els.exportCsv?.addEventListener('click', () => exportAs('csv'));
  els.exportTxt?.addEventListener('click', () => exportAs('txt'));

  // Navbar user avatar/name
  (async()=>{ try{ const r = await fetch('/api/user'); const d = await r.json(); if(d?.success){ const a=document.getElementById('userAvatar'); const n=document.getElementById('userName'); if(a&&d.user.avatar) a.src=d.user.avatar; if(n) n.textContent=d.user.username; } }catch{} })();
  // Health badge
  (async()=>{ const setTip=(t)=>{const hb=document.getElementById('healthBadge'); if(hb) hb.title=t;}; const dot=(el, st)=>{ if(!el) return; el.classList.remove('dot-green','dot-red','dot-gray'); el.classList.add(st==='ok'?'dot-green': st==='bad'?'dot-red':'dot-gray');}; try{ const r=await fetch('/api/health',{credentials:'same-origin'}); const h=await r.json(); dot(document.getElementById('health-mongo'), h.mongo==='connected'?'ok': (h.mongo==='disabled'?'gray':'bad')); dot(document.getElementById('health-discord'), h.discord?'ok':'bad'); setTip(`${h.mongo==='connected'?'DB: ligado': h.mongo==='disabled'?'DB: desativado':'DB: desligado'} • ${h.discord?'Discord: online':'Discord: offline'}`);}catch{}})();

  fetchLogs();
})();
