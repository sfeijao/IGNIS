(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
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
    return u.toString();
  }

  async function fetchLogs(){
    if (!guildId) return notify('guildId em falta','error');
    els.list.innerHTML = `<div class="loading"><span class="loading-spinner"></span> A carregar...</div>`;
    try {
      const r = await fetch(buildUrl(), { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
      render(d.logs||[]);
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

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); }

  function exportAs(fmt){
    const u = new URL(`/api/guild/${guildId}/logs/export`, window.location.origin);
    const type = (els.type?.value||'').trim(); if (type) u.searchParams.set('type', type);
    const from = (els.from?.value||'').trim(); if (from) u.searchParams.set('from', from);
    const to = (els.to?.value||'').trim(); if (to) u.searchParams.set('to', to);
    const q = (els.q?.value||'').trim(); if (q) u.searchParams.set('q', q);
    u.searchParams.set('format', fmt);
    window.location.href = u.toString();
  }

  els.apply?.addEventListener('click', fetchLogs);
  els.exportCsv?.addEventListener('click', () => exportAs('csv'));
  els.exportTxt?.addEventListener('click', () => exportAs('txt'));

  // Navbar user avatar/name
  (async()=>{ try{ const r = await fetch('/api/user'); const d = await r.json(); if(d?.success){ const a=document.getElementById('userAvatar'); const n=document.getElementById('userName'); if(a&&d.user.avatar) a.src=d.user.avatar; if(n) n.textContent=d.user.username; } }catch{} })();
  // Health badge
  (async()=>{ const setTip=(t)=>{const hb=document.getElementById('healthBadge'); if(hb) hb.title=t;}; const dot=(el, st)=>{ if(!el) return; el.classList.remove('dot-green','dot-red','dot-gray'); el.classList.add(st==='ok'?'dot-green': st==='bad'?'dot-red':'dot-gray');}; try{ const r=await fetch('/api/health',{credentials:'same-origin'}); const h=await r.json(); dot(document.getElementById('health-mongo'), h.mongo==='connected'?'ok': (h.mongo==='disabled'?'gray':'bad')); dot(document.getElementById('health-discord'), h.discord?'ok':'bad'); setTip(`${h.mongo==='connected'?'DB: ligado': h.mongo==='disabled'?'DB: desativado':'DB: desligado'} • ${h.discord?'Discord: online':'Discord: offline'}`);}catch{}})();

  fetchLogs();
})();
