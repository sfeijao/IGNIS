(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const els = {
    window: document.getElementById('window'),
    q: document.getElementById('q'),
    from: document.getElementById('from'),
    to: document.getElementById('to'),
    userId: document.getElementById('userId'),
    moderatorId: document.getElementById('moderatorId'),
    channelId: document.getElementById('channelId'),
    btnRefresh: document.getElementById('btnRefresh'),
    btnAuto: document.getElementById('btnAuto'),
    btnExport: document.getElementById('btnExport'),
    exportFormat: document.getElementById('exportFormat'),
    stats: {
      bans: document.getElementById('countBans'),
      msgDel: document.getElementById('countMsgDel'),
      msgEdit: document.getElementById('countMsgEdit'),
      jl: document.getElementById('countJoinsLeaves'),
      voice: document.getElementById('countVoice')
    },
    feed: document.getElementById('feed'),
    filterButtons: Array.from(document.querySelectorAll('.btn-toggle[data-filter]')),
    modal: document.getElementById('moderationModal'),
    modalTitle: document.getElementById('modModalTitle'),
    modalBody: document.getElementById('modModalBody')
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
    const userId = (els.userId?.value||'').trim(); if (userId) url.searchParams.set('userId', userId);
    const modId = (els.moderatorId?.value||'').trim(); if (modId) url.searchParams.set('moderatorId', modId);
    const channelId = (els.channelId?.value||'').trim(); if (channelId) url.searchParams.set('channelId', channelId);
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
      <button class="feed-item" data-log-id="${l.id}" aria-label="Abrir detalhes do evento">
        <div class="feed-meta">[${new Date(l.timestamp).toLocaleString('pt-PT')}] [${escapeHtml(l.type||'log')}]</div>
        <div>${escapeHtml(l.message||'')}</div>
      </button>
    `).join('');
    // Attach handlers
    [...els.feed.querySelectorAll('[data-log-id]')].forEach(btn => btn.addEventListener('click', () => openEventModal(btn.getAttribute('data-log-id'))));
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
    const fmt = (els.exportFormat?.value||'csv');
    u.searchParams.set('format', fmt);
    window.location.href = u.toString();
  }

  async function openEventModal(logId){
    try {
      if (!logId) return;
      const u = new URL(`/api/guild/${guildId}/moderation/event/${encodeURIComponent(logId)}`, window.location.origin);
      const r = await fetch(u, { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
      const ev = d.event;
      // Build actions based on type
      const actions = [];
      const data = ev.data || {};
      if (ev.type === 'mod_ban_add') {
        actions.push({ key:'unban', label:'Remover ban', icon:'fa-unlock', payload:{ userId: data.userId } });
      } else if (ev.type === 'mod_ban_remove') {
        if (data.userId) actions.push({ key:'ban', label:'Banir', icon:'fa-ban', payload:{ userId: data.userId } });
      } else if (ev.type === 'mod_member_update') {
        if (data.userId) actions.push({ key:'kick', label:'Expulsar', icon:'fa-person-running', payload:{ userId: data.userId } });
        if (data.userId) actions.push({ key:'timeout', label:'Timeout 10m', icon:'fa-hourglass-half', payload:{ userId: data.userId, durationSeconds: 600 } });
        if (data.userId) actions.push({ key:'remove_timeout', label:'Remover timeout', icon:'fa-clock', payload:{ userId: data.userId } });
        if (data.userId && data.nickname && 'before' in data.nickname) actions.push({ key:'revert_nickname', label:'Reverter apelido', icon:'fa-undo', payload:{ userId: data.userId } });
        if (data.userId && data.roles) actions.push({ key:'revert_roles', label:'Reverter cargos', icon:'fa-layer-group', payload:{ userId: data.userId } });
      } else if (ev.type === 'mod_member_join' || ev.type === 'mod_member_leave') {
        if (data.userId) actions.push({ key:'ban', label:'Banir', icon:'fa-ban', payload:{ userId: data.userId } });
      } else if (ev.type.startsWith('mod_voice_')) {
        if (data.userId) actions.push({ key:'mute', label:'Mutar', icon:'fa-microphone-slash', payload:{ userId: data.userId } });
        if (data.userId) actions.push({ key:'unmute', label:'Desmutar', icon:'fa-microphone', payload:{ userId: data.userId } });
        if (data.userId) actions.push({ key:'deafen', label:'Ensurdecer', icon:'fa-deaf', payload:{ userId: data.userId } });
        if (data.userId) actions.push({ key:'undeafen', label:'Dessurdir', icon:'fa-assistive-listening-systems', payload:{ userId: data.userId } });
      } else if (ev.type.startsWith('mod_message_')) {
        // Read-only for now
      }

      const resolved = ev.resolved || {};
      const user = resolved.user ? `${escapeHtml(resolved.user.username||'')} (${resolved.user.id})` : (data.userId ? data.userId : '-');
      const mod = resolved.executor ? `${escapeHtml(resolved.executor.username||'')} (${resolved.executor.id})` : (data.executorId ? data.executorId : '-');
      const channel = resolved.channel ? `#${escapeHtml(resolved.channel.name)} (${resolved.channel.id})` : (data.channelId ? data.channelId : '-');
      const body = [];
      body.push(`<div class="kv"><b>Tipo:</b> ${escapeHtml(ev.type)}</div>`);
      body.push(`<div class="kv"><b>Quando:</b> ${new Date(ev.timestamp).toLocaleString('pt-PT')}</div>`);
      body.push(`<div class="kv"><b>Usuário:</b> ${user}</div>`);
      body.push(`<div class="kv"><b>Moderador:</b> ${mod}</div>`);
      body.push(`<div class="kv"><b>Canal:</b> ${channel}</div>`);
      if (ev.message) body.push(`<div class="kv"><b>Motivo:</b> ${escapeHtml(ev.message)}</div>`);
      if (ev.type === 'mod_message_update') {
        if (data.before) body.push(`<pre class="code-block"><b>Antes:</b>\n${escapeHtml(data.before)}</pre>`);
        if (data.after) body.push(`<pre class="code-block"><b>Depois:</b>\n${escapeHtml(data.after)}</pre>`);
      } else if (ev.type === 'mod_message_delete') {
        // If content available in message, show it
        if (data.content) body.push(`<pre class="code-block"><b>Conteúdo:</b>\n${escapeHtml(data.content)}</pre>`);
      }

      if (actions.length) {
        body.push('<div class="actions-row">' + actions.map(a => `<button class="btn btn-primary" data-action="${a.key}"><i class="fas ${a.icon}"></i> ${a.label}</button>`).join(' ') + '</div>');
      }

  els.modalTitle.textContent = 'Evento de moderação';
  els.modalBody.innerHTML = body.join('');
  els.modal.classList.remove('modal-hidden');
  els.modal.classList.add('modal-visible');
  els.modal.setAttribute('aria-hidden','false');
      // Wire action clicks
      if (actions.length) {
        actions.forEach(a => {
          const btn = els.modalBody.querySelector(`[data-action="${a.key}"]`);
          if (!btn) return;
          btn.addEventListener('click', async () => {
            try {
              btn.disabled = true; btn.textContent = 'A executar...';
              const payload = { action: a.key, ...a.payload, logId: ev.id };
              const r = await fetch(`/api/guild/${guildId}/moderation/action`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) });
              const d2 = await r.json();
              if (!r.ok || !d2.success) throw new Error(d2.error || `HTTP ${r.status}`);
              notify('Ação concluída','success');
              els.modal.classList.add('modal-hidden');
              els.modal.classList.remove('modal-visible');
              els.modal.setAttribute('aria-hidden','true');
              await loadFeed(); await loadSummary();
            } catch(e){ console.error(e); notify(e.message,'error'); } finally { btn.disabled = false; }
          });
        });
      }
    } catch(e){ console.error(e); notify(e.message,'error'); }
  }

  // Events
  els.btnRefresh?.addEventListener('click', async ()=>{ await loadSummary(); await loadFeed(); });
  els.btnAuto?.addEventListener('click', toggleAuto);
  els.btnExport?.addEventListener('click', exportCsv);
  els.window?.addEventListener('change', loadSummary);
  els.q?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); });
  els.from?.addEventListener('change', loadFeed);
  els.to?.addEventListener('change', loadFeed);
  els.userId?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); });
  els.moderatorId?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); });
  els.channelId?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); });
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
