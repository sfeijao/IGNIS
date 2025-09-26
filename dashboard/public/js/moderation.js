(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const els = {
    window: document.getElementById('window'),
    q: document.getElementById('q'),
    from: document.getElementById('from'),
    to: document.getElementById('to'),
    btnRefresh: document.getElementById('btnRefresh'),
    btnAuto: document.getElementById('btnAuto'),
    btnExport: document.getElementById('btnExport'),
    stats: {
      bans: document.getElementById('countBans'),
      msgDel: document.getElementById('countMsgDel'),
      msgEdit: document.getElementById('countMsgEdit'),
      jl: document.getElementById('countJoinsLeaves'),
      voice: document.getElementById('countVoice')
    },
    feed: document.getElementById('feed'),
    filterButtons: Array.from(document.querySelectorAll('.btn-toggle[data-filter]'))
  };

  let autoTimer = null;
  let currentFamily = 'all';

  function notify(msg, type='info'){
    const n = document.createElement('div');
    n.className = `notification notification-${type} slide-up`;
    n.innerHTML = `<i class="fas ${type==='error'?'fa-exclamation-circle': type==='success'?'fa-check-circle':'fa-info-circle'}"></i><span>${msg}</span>`;
    document.body.appendChild(n);
    setTimeout(()=>{n.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>n.remove(),300);},2500);
  }

  function buildTypeParam(){
    switch(currentFamily){
      case 'messages': return 'mod_message*';
      case 'members': return 'mod_member*';
      case 'voice': return 'mod_voice*';
      case 'bans': return 'mod_ban*';
      default: return 'mod_*';
    }
  }

  function buildRange(url){
    const from = (els.from?.value||'').trim(); if (from) url.searchParams.set('from', from);
    const to = (els.to?.value||'').trim(); if (to) url.searchParams.set('to', to);
    const q = (els.q?.value||'').trim(); if (q) url.searchParams.set('q', q);
    return url;
  }

  async function loadSummary(){
    if (!guildId) return; // guildId is required
    try {
      const w = (els.window?.value||'24h');
      const u = new URL(`/api/guild/${guildId}/moderation/summary`, window.location.origin);
      u.searchParams.set('window', w);
      const r = await fetch(u, { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
      const m = d.metrics || {};
      els.stats.bans && (els.stats.bans.textContent = (m.banAdds||0) + (m.banRemoves||0));
      els.stats.msgDel && (els.stats.msgDel.textContent = (m.messageDeletes||0) + (m.messageBulkDeletes||0));
      els.stats.msgEdit && (els.stats.msgEdit.textContent = (m.messageUpdates||0));
      els.stats.jl && (els.stats.jl.textContent = (m.memberJoins||0) + (m.memberLeaves||0));
      els.stats.voice && (els.stats.voice.textContent = (m.voiceJoins||0) + (m.voiceLeaves||0) + (m.voiceMoves||0));
    } catch(e){ console.error(e); }
  }

  async function loadFeed(){
    if (!guildId) return notify('guildId em falta','error');
    els.feed.innerHTML = `<div class="loading"><span class="loading-spinner"></span> A carregar...</div>`;
    try {
      const u = new URL(`/api/guild/${guildId}/logs`, window.location.origin);
      u.searchParams.set('type', buildTypeParam());
      buildRange(u);
      u.searchParams.set('limit', '200');
      const r = await fetch(u, { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
      renderFeed(d.logs||[]);
    } catch(e){ console.error(e); notify(e.message,'error'); els.feed.innerHTML = `<div class="no-tickets">Erro ao carregar feed</div>`; }
  }

  function renderFeed(items){
    if (!items.length){ els.feed.innerHTML = `<div class="no-tickets">Sem eventos</div>`; return; }
    els.feed.innerHTML = items.map(l => `
      <div class="feed-item">
        <div class="feed-meta">[${new Date(l.timestamp).toLocaleString('pt-PT')}] [${escapeHtml(l.type||'log')}]</div>
        <div>${escapeHtml(l.message||'')}</div>
      </div>
    `).join('');
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); }

  function toggleAuto(){
    const pressed = els.btnAuto.getAttribute('aria-pressed') === 'true';
    const next = !pressed;
    els.btnAuto.setAttribute('aria-pressed', String(next));
    els.btnAuto.innerHTML = next ? `<i class="fas fa-pause"></i> Auto` : `<i class="fas fa-play"></i> Auto`;
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    if (next) {
      autoTimer = setInterval(async ()=>{ await loadSummary(); await loadFeed(); }, 5000);
    }
  }

  function exportCsv(){
    const u = new URL(`/api/guild/${guildId}/logs/export`, window.location.origin);
    u.searchParams.set('type', buildTypeParam());
    buildRange(u);
    u.searchParams.set('format', 'csv');
    window.location.href = u.toString();
  }

  // Events
  els.btnRefresh?.addEventListener('click', async ()=>{ await loadSummary(); await loadFeed(); });
  els.btnAuto?.addEventListener('click', toggleAuto);
  els.btnExport?.addEventListener('click', exportCsv);
  els.window?.addEventListener('change', loadSummary);
  els.q?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); });
  els.from?.addEventListener('change', loadFeed);
  els.to?.addEventListener('change', loadFeed);
  els.filterButtons.forEach(btn=> btn.addEventListener('click', ()=>{
    els.filterButtons.forEach(b=> b.classList.remove('active'));
    btn.classList.add('active');
    currentFamily = btn.getAttribute('data-filter') || 'all';
    loadFeed();
  }));

  // Initial load
  loadSummary();
  loadFeed();
})();
