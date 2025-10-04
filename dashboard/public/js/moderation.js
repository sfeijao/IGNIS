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
  btnExportSnapshot: document.getElementById('btnExportSnapshot'),
  btnLoadAll: document.getElementById('btnLoadAll'),
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
  let multiFamilies = new Set();
  let page = 1; let perPage = 100; let totalLogs = 0;
  let streamMode = false; const STREAM_MAX = 1200;
  let showLatency = false; let lastRenderTs = null;
  let currentLimit = 200;
  let lastTopId = null; // track latest rendered id for live-append
  let lastTopTs = null; // track latest rendered timestamp for live-append
  let lastLiveAppendTs = null; // track last time we auto-appended
  let LONG_PAUSE_MS = 2 * 60 * 1000; // 2 minutes (configurable)
  let orderDesc = true; // true = newest first
  let groupByMod = false; // group by moderator executor
  let groupSortByVolume = false; // secondary grouping sort
  let pinnedGroups = new Set(); // executorId values pinned
  let pinCustomOrder = []; // explicit ordering of pinned groups
  let pillAddedFamilies = new Set(); // families added via group pills (for quick clear)

  function notify(msg, type='info'){
    const n = document.createElement('div');
    n.className = `notification notification-${type} slide-up`;
    n.innerHTML = `<i class="fas ${type==='error'?'fa-exclamation-circle': type==='success'?'fa-check-circle':'fa-info-circle'}"></i><span>${msg}</span>`;
    document.body.appendChild(n);
    setTimeout(()=>{n.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>n.remove(),300);},2500);
  }

  // Modal helpers and polished confirmation UI
  function isModalVisible(){ return els.modal && els.modal.classList.contains('modal-visible'); }
  function openModal(title, html){
    if (!els.modal) return;
    if (title != null) els.modalTitle.textContent = title;
    if (html != null) els.modalBody.innerHTML = html;
    els.modal.classList.remove('modal-hidden');
    els.modal.classList.add('modal-visible');
    els.modal.setAttribute('aria-hidden','false');
  }
  function closeModal(){
    if (!els.modal) return;
    // clean any transient confirm blocks
    try { els.modalBody?.querySelectorAll?.('.confirm-block')?.forEach(n=> n.remove()); } catch {}
    els.modal.classList.add('modal-hidden');
    els.modal.classList.remove('modal-visible');
    els.modal.setAttribute('aria-hidden','true');
  }
  function buildConfirmBlock(plan){
    const risks = Array.isArray(plan?.risks) ? plan.risks : [];
    const planObj = plan?.plan ?? plan;
    const raw = escapeHtml(JSON.stringify(planObj, null, 2));
    // Extract role diffs if structure matches revert_roles plan { add:[], remove:[] }
    let roleDiffHtml = '';
    try {
      const add = planObj?.plan?.add || planObj?.add || [];
      const rem = planObj?.plan?.remove || planObj?.remove || [];
      const mk = (arr, cls, icon)=> arr.map(r=>`<span class=\"role-chip ${cls}\"><i class=\"fas ${icon}\"></i>@${escapeHtml(r.name||r.id)}</span>`).join('');
      const addHtml = Array.isArray(add) && add.length ? mk(add,'add','fa-plus') : '';
      const remHtml = Array.isArray(rem) && rem.length ? mk(rem,'rem','fa-minus') : '';
      if (addHtml || remHtml) roleDiffHtml = `<div class=\"plan-diff\" style=\"margin-top:8px\">${addHtml}${remHtml}</div>`;
    } catch {}
    return `
      <div class="confirm-block" style="margin-top:10px">
        <div class="kv"><b>Pré-visualização</b> <small>(dry-run)</small></div>
        ${risks.length ? `<div class=\"alert alert-warning\" style=\"margin-top:8px\"><b>Riscos potenciais</b><ul>${risks.map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul></div>`:''}
        ${roleDiffHtml}
        <div style="margin-top:8px"><button class="btn btn-glass btn-sm" data-toggle-raw><i class="fas fa-code"></i> Ver JSON</button></div>
        <pre class="code-block" style="margin-top:8px;display:none" id="__confirmPlanPre">${raw}</pre>
        <div class="actions-row" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap">
          <button class="btn" data-confirm-cancel><i class="fas fa-times"></i> Cancelar</button>
          <button class="btn" data-copy-plan><i class="fas fa-copy"></i> Copiar</button>
          <button class="btn btn-primary" data-confirm-apply><i class="fas fa-check"></i> Confirmar</button>
        </div>
      </div>`;
  }
  function attachConfirmHandlers(container, onConfirm, onCancel){
    const btnCancel = container.querySelector('[data-confirm-cancel]');
    const btnCopy = container.querySelector('[data-copy-plan]');
    const btnApply = container.querySelector('[data-confirm-apply]');
    const btnToggle = container.querySelector('[data-toggle-raw]');
    const getText = () => {
      const pre = container.querySelector('#__confirmPlanPre');
      return pre ? pre.textContent : '';
    };
    const copyText = async () => {
      const text = getText();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        }
        notify('Plano copiado para a área de transferência','success');
      } catch(e){ notify('Não foi possível copiar','error'); }
    };
    btnCancel?.addEventListener('click', ()=>{ onCancel?.(); });
    btnCopy?.addEventListener('click', copyText);
    btnApply?.addEventListener('click', ()=>{ onConfirm?.(); });
    btnToggle?.addEventListener('click', ()=>{
      const pre = container.querySelector('#__confirmPlanPre');
      if(!pre) return; const vis = pre.style.display !== 'none';
      pre.style.display = vis ? 'none':'block';
      btnToggle.innerHTML = vis ? '<i class="fas fa-code"></i> Ver JSON' : '<i class="fas fa-eye-slash"></i> Ocultar JSON';
    });
  }
  // Show confirmation as a new modal replacing current content; returns Promise<boolean>
  function showConfirmModal(plan, title){
    return new Promise(resolve => {
      openModal(title || 'Confirmar alterações', buildConfirmBlock(plan));
      const block = els.modalBody.querySelector('.confirm-block');
      attachConfirmHandlers(block, ()=>{ closeModal(); resolve(true); }, ()=>{ closeModal(); resolve(false); });
    });
  }
  // Inject confirmation block into current, already open modal; returns Promise<boolean>
  function injectConfirmInCurrentModal(plan){
    return new Promise(resolve => {
      // remove any prior confirm blocks to avoid stacking
      els.modalBody.querySelectorAll('.confirm-block')?.forEach(n=> n.remove());
      els.modalBody.insertAdjacentHTML('beforeend', buildConfirmBlock(plan));
      const block = els.modalBody.querySelector('.confirm-block');
      attachConfirmHandlers(block, ()=>{ block.remove(); resolve(true); }, ()=>{ block.remove(); resolve(false); });
    });
  }

  function buildTypeParam(){
    const map = {
      messages: 'mod_message*',
      members: 'mod_member*',
      voice: 'mod_voice*',
      bans: 'mod_ban*'
    };
    const active = (multiFamilies && multiFamilies.size) ? [...multiFamilies] : [currentFamily];
    if (active.includes('all')) return 'mod_*';
    const patterns = active.map(f=> map[f]).filter(Boolean);
    return patterns.length? patterns.join(',') : 'mod_*';
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
      if (!window.__animateNumber) {
        window.__animateNumber = function(el, to){
          if(!el) return; const from = parseInt(el.dataset.val || el.textContent || '0',10) || 0;
          if(from === to){ el.textContent = to; el.dataset.val = to; return; }
          const dur = 600; const start = performance.now();
          const ease = p => 1 - Math.pow(1-p,3);
          function frame(ts){
            const prog = Math.min(1,(ts-start)/dur); const cur = Math.round(from + (to-from)*ease(prog));
            el.textContent = cur; if(prog < 1) requestAnimationFrame(frame); else el.dataset.val = to;
          }
          requestAnimationFrame(frame);
        };
      }
      window.__animateNumber(els.stats.bans, (m.banAdds||0) + (m.banRemoves||0));
      window.__animateNumber(els.stats.msgDel, (m.messageDeletes||0) + (m.messageBulkDeletes||0));
      window.__animateNumber(els.stats.msgEdit, (m.messageUpdates||0));
      window.__animateNumber(els.stats.jl, (m.memberJoins||0) + (m.memberLeaves||0));
      window.__animateNumber(els.stats.voice, (m.voiceJoins||0) + (m.voiceLeaves||0) + (m.voiceMoves||0));
      // Update filter buttons with counters
      try {
        const countMessages = (m.messageDeletes||0) + (m.messageBulkDeletes||0) + (m.messageUpdates||0);
        const countMembers = (m.memberJoins||0) + (m.memberLeaves||0);
        const countVoice = (m.voiceJoins||0) + (m.voiceLeaves||0) + (m.voiceMoves||0);
        const countBans = (m.banAdds||0) + (m.banRemoves||0);
        const map = {
          all: { emoji: '📋', count: (countMessages + countMembers + countVoice + countBans) },
          messages: { emoji: '💬', count: countMessages },
          members: { emoji: '👤', count: countMembers },
          voice: { emoji: '🎙️', count: countVoice },
          bans: { emoji: '🚫', count: countBans }
        };
        els.filterButtons?.forEach(btn => {
          const key = btn.getAttribute('data-filter')||'all';
          const info = map[key]; if(!info) return;
          // Use a data attribute guard so we don't stack emojis
          const baseLabel = btn.getAttribute('data-base-label') || btn.textContent.trim();
          if(!btn.getAttribute('data-base-label')) btn.setAttribute('data-base-label', baseLabel.replace(/^[^A-Za-zÀ-ú0-9]+/,'').trim());
          const finalLabel = btn.getAttribute('data-base-label');
          btn.innerHTML = `${info.emoji} ${finalLabel} <span class="badge-soft" style="margin-left:4px">${info.count}</span>`;
        });
      } catch {}
      // Update simple 7-day chart (approximation using current window metrics)
      try {
        const canvas = document.getElementById('mod7Chart');
        if (canvas && window.Chart){
          const m = d.metrics || {};
          const del = (m.messageDeletes||0)+(m.messageBulkDeletes||0);
          const bans = (m.banAdds||0)+(m.banRemoves||0);
          const data = {
            labels: ['Mensagens apagadas','Banimentos'],
            datasets: [{ data:[del, bans], backgroundColor:['rgba(59,130,246,.35)','rgba(239,68,68,.35)'], borderColor:['#3b82f6','#ef4444'] }]
          };
          if (!window.__modChart){
            window.__modChart = new Chart(canvas.getContext('2d'), { type:'bar', data, options:{ responsive:true, plugins:{ legend:{ display:false }}, scales:{ y:{ beginAtZero:true } } } });
          } else {
            window.__modChart.data = data; window.__modChart.update();
          }
        }
      } catch {}
    } catch(e){ console.error(e); }
  }
  // Preference helpers
  function persistPrefs(){
    try {
      localStorage.setItem('mod-feed-filter', currentFamily);
      localStorage.setItem('mod-limit', String(currentLimit));
      localStorage.setItem('mod-auto', els.btnAuto.getAttribute('aria-pressed') === 'true' ? 'true' : 'false');
      localStorage.setItem('mod-feed-multi', JSON.stringify([...multiFamilies]));
      localStorage.setItem('mod-stream', streamMode?'true':'false');
      localStorage.setItem('mod-latency', showLatency?'true':'false');
      localStorage.setItem('mod-page', String(page));
      localStorage.setItem('mod-perPage', String(perPage));
  localStorage.setItem('mod-order-desc', orderDesc?'true':'false');
  localStorage.setItem('mod-group-mod', groupByMod?'true':'false');
  localStorage.setItem('mod-group-sort-volume', groupSortByVolume?'true':'false');
  localStorage.setItem('mod-group-pins', JSON.stringify([...pinnedGroups]));
  localStorage.setItem('mod-group-pin-order', JSON.stringify(pinCustomOrder));
  localStorage.setItem('mod-pill-added-fams', JSON.stringify([...pillAddedFamilies]));
    } catch {}
  }
  (function restorePrefs(){
    try {
      const fam = localStorage.getItem('mod-feed-filter'); if(fam) currentFamily = fam;
      const lim = parseInt(localStorage.getItem('mod-limit')||'200',10); if(!isNaN(lim)) currentLimit = lim;
      const auto = localStorage.getItem('mod-auto')==='true';
      try { const mf = JSON.parse(localStorage.getItem('mod-feed-multi')||'[]'); multiFamilies = new Set(mf); } catch {}
      streamMode = localStorage.getItem('mod-stream')==='true';
      showLatency = localStorage.getItem('mod-latency')==='true';
      page = parseInt(localStorage.getItem('mod-page')||'1',10)||1;
      perPage = parseInt(localStorage.getItem('mod-perPage')||'100',10)||100;
  orderDesc = localStorage.getItem('mod-order-desc') !== 'false';
  groupByMod = localStorage.getItem('mod-group-mod') === 'true';
  groupSortByVolume = localStorage.getItem('mod-group-sort-volume') === 'true';
  try { const pins = JSON.parse(localStorage.getItem('mod-group-pins')||'[]'); pinnedGroups = new Set(pins); } catch {}
  try { const ord = JSON.parse(localStorage.getItem('mod-group-pin-order')||'[]'); if(Array.isArray(ord)) pinCustomOrder = ord; } catch {}
  try { const pa = JSON.parse(localStorage.getItem('mod-pill-added-fams')||'[]'); pillAddedFamilies = new Set(pa); } catch {}
      // update UI for family
      els.filterButtons?.forEach(btn=>{ btn.classList.toggle('active', btn.getAttribute('data-filter')===currentFamily); });
      if(auto){ els.btnAuto.setAttribute('aria-pressed','true'); els.btnAuto.innerHTML = `<i class="fas fa-pause"></i> Auto`; }
      if(streamMode) document.getElementById('btnStream')?.setAttribute('aria-pressed','true');
      if(showLatency) document.getElementById('btnLatency')?.setAttribute('aria-pressed','true');
      const pgIn = document.getElementById('pageInput'); if(pgIn) pgIn.value = String(page);
      const pp = document.getElementById('perPage'); if(pp) pp.value = String(perPage);
  const btnOrder = document.getElementById('btnOrder'); if(btnOrder) btnOrder.setAttribute('aria-pressed', orderDesc?'true':'false');
  const btnGroup = document.getElementById('btnGroupMod'); if(btnGroup) btnGroup.setAttribute('aria-pressed', groupByMod?'true':'false');
    } catch {}
  })();
  function renderActiveFilters(){
    const row = document.getElementById('activeFilters'); if (!row) return;
    const chips = [];
    const f = (els.q?.value||'').trim(); if (f) chips.push({ k:'q', label:`Texto: ${f}` });
    const uf = (els.userId?.value||'').trim(); if (uf) chips.push({ k:'userId', label:`Usuário: ${uf}` });
    const mf = (els.moderatorId?.value||'').trim(); if (mf) chips.push({ k:'moderatorId', label:`Moderador: ${mf}` });
    const cf = (els.channelId?.value||'').trim(); if (cf) chips.push({ k:'channelId', label:`Canal: ${cf}` });
    const from = (els.from?.value||'').trim(); if (from) chips.push({ k:'from', label:`De: ${from}` });
    const to = (els.to?.value||'').trim(); if (to) chips.push({ k:'to', label:`Até: ${to}` });
    if (currentFamily && currentFamily !== 'all') chips.push({ k:'family', label:`Tipo: ${currentFamily}` });
    const quickClear = row.querySelector('#quickClearPills');
    if(quickClear){
      const hasPillFilters = pillAddedFamilies.size>0;
      quickClear.setAttribute('data-visible', hasPillFilters?'true':'false');
    }
    const baseChips = chips.map(c => `<span class="chip" data-k="${c.k}">${c.label} <i class="fas fa-times chip-clear" title="Limpar"></i></span>`).join('');
    const clearAll = ` <span class="chip chip-clear-all" data-clear-all="1" title="Limpar todos os filtros"><i class="fas fa-broom"></i> Limpar tudo</span>`;
    if (!chips.length) { row.querySelectorAll('.chip:not(#quickClearPills)')?.forEach(c=>{ if(c.id!=='quickClearPills') c.remove(); }); return; }
    // Only replace dynamic part, keep quick clear node
    // Remove existing dynamic chips (excluding quick clear)
    row.querySelectorAll('.chip[data-k]')?.forEach(n=> n.remove());
    row.querySelectorAll('.chip-clear-all')?.forEach(n=> n.remove());
    row.insertAdjacentHTML('beforeend', baseChips + clearAll);
    row.querySelectorAll('.chip')?.forEach(ch => ch.addEventListener('click', (e)=>{
      const k = ch.getAttribute('data-k'); const isClear = e.target?.classList?.contains('chip-clear');
      if (!k) return;
      if (k==='q') els.q.value = '';
      else if (k==='userId') els.userId.value = '';
      else if (k==='moderatorId') els.moderatorId.value = '';
      else if (k==='channelId') els.channelId.value = '';
      else if (k==='from') els.from.value = '';
      else if (k==='to') els.to.value = '';
      else if (k==='family') { currentFamily = 'all'; els.filterButtons?.forEach(b=> b.classList.toggle('active', (b.getAttribute('data-filter')||'all')==='all')); }
      loadFeed();
    }));
    // Clear all chip
    row.querySelector('[data-clear-all]')?.addEventListener('click', (e)=>{
      e.stopPropagation();
      if (els.q) els.q.value = '';
      if (els.userId) els.userId.value = '';
      if (els.moderatorId) els.moderatorId.value = '';
      if (els.channelId) els.channelId.value = '';
      if (els.from) els.from.value = '';
      if (els.to) els.to.value = '';
      currentFamily = 'all';
      els.filterButtons?.forEach(b=> b.classList.toggle('active', (b.getAttribute('data-filter')||'all')==='all'));
      multiFamilies.clear(); pillAddedFamilies.clear();
      persistPrefs();
      renderActiveFilters();
      loadFeed();
    });
    // Quick clear only pill-added filters
    row.querySelector('#quickClearPills')?.addEventListener('click', (e)=>{
      e.stopPropagation();
      let changed=false;
      pillAddedFamilies.forEach(f=>{ if(multiFamilies.has(f)){ multiFamilies.delete(f); changed=true; } });
      pillAddedFamilies.clear();
      if(multiFamilies.size===0) currentFamily='all';
      persistPrefs();
      renderActiveFilters();
      if(changed) loadFeed();
    });
  }
  // Presets
  const PRESETS_KEY = 'mod-filter-presets-v1';
  function loadPresets(){
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY)||'{}'); } catch { return {}; }
  }
  function savePresets(obj){
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(obj)); } catch {}
  }
  function refreshPresetSelect(){
    const sel = document.getElementById('presetSelect'); if(!sel) return;
    const cur = sel.value;
    const presets = loadPresets();
    sel.innerHTML = `<option value="">Presets...</option>` + Object.keys(presets).sort().map(k=>`<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('');
    if(cur && presets[cur]) sel.value = cur; else sel.value = '';
  }
  function captureCurrentFilterState(){
    return {
      family: currentFamily,
      multiFamilies: [...multiFamilies],
      q: els.q?.value||'',
      from: els.from?.value||'',
      to: els.to?.value||'',
      userId: els.userId?.value||'',
      moderatorId: els.moderatorId?.value||'',
      channelId: els.channelId?.value||'',
      orderDesc, groupByMod
    };
  }
  function applyFilterState(st){
    try {
      currentFamily = st.family || 'all';
      multiFamilies = new Set(st.multiFamilies||[]);
      if(els.q) els.q.value = st.q||'';
      if(els.from) els.from.value = st.from||'';
      if(els.to) els.to.value = st.to||'';
      if(els.userId) els.userId.value = st.userId||'';
      if(els.moderatorId) els.moderatorId.value = st.moderatorId||'';
      if(els.channelId) els.channelId.value = st.channelId||'';
      orderDesc = !!st.orderDesc; groupByMod = !!st.groupByMod;
      // update buttons
      const btnOrder = document.getElementById('btnOrder'); if(btnOrder) btnOrder.setAttribute('aria-pressed', orderDesc?'true':'false');
      const btnGroup = document.getElementById('btnGroupMod'); if(btnGroup) btnGroup.setAttribute('aria-pressed', groupByMod?'true':'false');
  const btnSortVol = document.getElementById('btnGroupSortVol'); if(btnSortVol) btnSortVol.setAttribute('aria-pressed', groupSortByVolume?'true':'false');
      els.filterButtons?.forEach(b=> b.classList.toggle('active', (b.getAttribute('data-filter')||'all')===currentFamily));
      persistPrefs();
      renderActiveFilters();
      loadFeed();
    } catch {}
  }
  function restorePrefs(){
    try {
      const f = localStorage.getItem('mod-feed-filter');
      if (f) currentFamily = f;
      const lim = parseInt(localStorage.getItem('mod-limit')||'', 10);
      if (!isNaN(lim) && lim>0) currentLimit = lim;
      const auto = localStorage.getItem('mod-auto');
      if (auto === 'true') {
        els.btnAuto.setAttribute('aria-pressed','false'); // will toggle to true
        toggleAuto();
      }
      const lp = parseInt(localStorage.getItem('mod-long-pause-minutes')||'2', 10);
      if (!isNaN(lp) && lp>0) {
        const input = document.getElementById('longPauseMin');
        if (input) input.value = String(lp);
        LONG_PAUSE_MS = lp * 60 * 1000;
      }
      // Apply active button state for filter
      if (els.filterButtons?.length) {
        els.filterButtons.forEach(b=> b.classList.remove('active'));
        const btn = els.filterButtons.find(b=> (b.getAttribute('data-filter')||'all') === currentFamily);
        btn?.classList.add('active');
      }
    } catch {}
  }
  async function loadFeed(){
    if (!guildId) return notify('guildId em falta','error');
    els.feed.innerHTML = `<div class="loading"><span class="loading-spinner"></span> A carregar...</div>`;
    try {
      const u = new URL(`/api/guild/${guildId}/logs`, window.location.origin);
      u.searchParams.set('type', buildTypeParam());
      buildRange(u);
      u.searchParams.set('limit', String(currentLimit));
      const r = await fetch(u, { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
      renderFeed(d.logs||[]);
      renderActiveFilters();
      // Track head for live-append
      if (Array.isArray(d.logs) && d.logs.length) {
        lastTopId = d.logs[0].id;
        lastTopTs = d.logs[0].timestamp;
      }
    } catch(e){ console.error(e); notify(e.message,'error'); els.feed.innerHTML = `<div class="no-tickets">Erro ao carregar feed</div>`; }
  }

  function formatDateGroup(ts){
    const d = new Date(ts);
    const today = new Date(); today.setHours(0,0,0,0);
    const that = new Date(d); that.setHours(0,0,0,0);
    const diff = (today - that) / 86400000; // days
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    try { return d.toLocaleDateString('pt-PT', { weekday:'long', day:'2-digit', month:'short', year:'numeric' }); } catch { return d.toDateString(); }
  }

  function iconFor(t){
    if (!t) return 'fa-list';
    if (t.startsWith('mod_message')) return 'fa-comment-dots';
    if (t.startsWith('mod_member')) return 'fa-user';
    if (t.startsWith('mod_voice')) return 'fa-microphone';
    if (t.startsWith('mod_ban')) return 'fa-ban';
    if (t.startsWith('mod_channel')) return 'fa-hashtag';
    if (t.startsWith('mod_role')) return 'fa-user-shield';
    return 'fa-list';
  }
  function typePill(t){
    if (!t) return 'type-pill';
    if (t.startsWith('mod_message')) return 'type-pill tp-msg';
    if (t.startsWith('mod_member')) return 'type-pill tp-mem';
    if (t.startsWith('mod_voice')) return 'type-pill tp-voice';
    if (t.startsWith('mod_ban')) return 'type-pill tp-ban';
    if (t.startsWith('mod_role')) return 'type-pill tp-role';
    if (t.startsWith('mod_channel')) return 'type-pill tp-chan';
    return 'type-pill';
  }
  function familyClass(t){
    if (!t) return '';
    if (t.startsWith('mod_message')) return 'family-msg';
    if (t.startsWith('mod_member')) return 'family-mem';
    if (t.startsWith('mod_voice')) return 'family-voice';
    if (t.startsWith('mod_ban')) return 'family-ban';
    if (t.startsWith('mod_channel')) return 'family-chan';
    if (t.startsWith('mod_role')) return 'family-role';
    return '';
  }
  function typeLabel(t){
    if (!t) return 'Evento';
    const m = {
      'mod_message_delete': 'Mensagem apagada',
      'mod_message_update': 'Mensagem editada',
      'mod_member_join': 'Membro entrou',
      'mod_member_leave': 'Membro saiu',
      'mod_member_update': 'Membro atualizado',
      'mod_voice_join': 'Entrou em canal de voz',
      'mod_voice_leave': 'Saiu do canal de voz',
      'mod_voice_move': 'Moveu-se de canal de voz',
      'mod_ban_add': 'Banimento aplicado',
      'mod_ban_remove': 'Banimento removido',
      'mod_channel_update': 'Canal atualizado',
      'mod_channel_delete': 'Canal apagado',
      'mod_role_update': 'Cargo atualizado',
      'mod_role_delete': 'Cargo apagado'
    };
    return m[t] || t.replace(/^mod_/,'').replace(/_/g,' ');
  }
  function avatarUrl(id, avatar){
    if (id && avatar) return `https://cdn.discordapp.com/avatars/${encodeURIComponent(id)}/${encodeURIComponent(avatar)}.png?size=64`;
    return '/default-avatar.svg';
  }

  function buildQuickActions(l){
    const d = l.data || {};
    const acts = [];
    if (l.type === 'mod_ban_add' && d.userId) {
      acts.push({ key:'unban', label:'Remover ban', icon:'fa-unlock', payload:{ userId: d.userId } });
    } else if (l.type === 'mod_ban_remove' && d.userId) {
      acts.push({ key:'ban', label:'Banir', icon:'fa-ban', payload:{ userId: d.userId } });
    } else if (l.type === 'mod_message_delete' && d.content && d.channelId) {
      acts.push({ key:'restore_message', label:'Restaurar', icon:'fa-undo', payload:{ logId: l.id } });
    } else if (l.type === 'mod_channel_delete') {
      acts.push({ key:'recreate_channel', label:'Recriar canal', icon:'fa-plus-square', payload:{ logId: l.id } });
    } else if (l.type === 'mod_channel_update') {
      acts.push({ key:'rename_channel', label:'Reverter nome', icon:'fa-i-cursor', payload:{ logId: l.id } });
    } else if (l.type === 'mod_role_delete') {
      acts.push({ key:'restore_role', label:'Restaurar cargo', icon:'fa-user-shield', payload:{ logId: l.id } });
    } else if (l.type === 'mod_role_update') {
      acts.push({ key:'revert_role_props', label:'Reverter props', icon:'fa-undo', payload:{ logId: l.id } });
    } else if (l.type === 'mod_member_update' && d.userId) {
      // Member-related safe quick actions
      acts.push({ key:'kick', label:'Expulsar', icon:'fa-person-running', payload:{ userId: d.userId } });
      acts.push({ key:'timeout', label:'Timeout 10m', icon:'fa-hourglass-half', payload:{ userId: d.userId, durationSeconds: 600 } });
      acts.push({ key:'remove_timeout', label:'Remover timeout', icon:'fa-clock', payload:{ userId: d.userId } });
      if (d.nickname && Object.prototype.hasOwnProperty.call(d, 'nickname')) {
        acts.push({ key:'revert_nickname', label:'Reverter apelido', icon:'fa-undo', payload:{ userId: d.userId } });
      }
      if (d.roles) {
        acts.push({ key:'revert_roles', label:'Reverter cargos', icon:'fa-layer-group', payload:{ userId: d.userId } });
      }
    }
    return acts;
  }

  function renderCard(l){
    const d = l.data || {};
    const r = l.resolved || {};
    const dt = new Date(l.timestamp).toLocaleString('pt-PT');
  let deltaHtml = '';
  if(showLatency){
    if(lastRenderTs!=null){ const diff = Math.max(0, l.timestamp - lastRenderTs); const sec = diff/1000; deltaHtml = `<span class=\"latency-delta\" title=\"Δ desde evento anterior\">+${sec>=60?( (sec/60).toFixed(1)+'m'): sec.toFixed(1)+'s'}</span>`; }
    lastRenderTs = l.timestamp;
  }
  const fallbackUserId = d.userId || (isSnowflake(l.message) ? l.message : null);
  const userLabel = r.user ? `${escapeHtml(r.user.username||'')}${r.user.nick? ' ('+escapeHtml(r.user.nick)+')':''}` : (fallbackUserId ? 'Desconhecido' : '');
  const modLabel = r.executor ? `${escapeHtml(r.executor.username||'')}${r.executor.nick? ' ('+escapeHtml(r.executor.nick)+')':''}` : (d.executorId ? 'Desconhecido' : '');
  const chanLabel = r.channel ? `#${escapeHtml(r.channel.name||'')}` : (d.channelId ? 'Desconhecido' : '');
    const meta = [
  userLabel ? `<span class=\"badge-soft\" title=\"Clique para filtrar • Shift+Clique copia o ID\" data-filter-user="${escapeHtml(fallbackUserId||r.user?.id||'')}" data-copy-id="${escapeHtml(fallbackUserId||r.user?.id||'')}"><i class=\"fas fa-user\"></i> ${userLabel}</span>` : '',
      modLabel ? `<span class=\"badge-soft\" title=\"Clique para filtrar • Shift+Clique copia o ID\" data-filter-mod="${escapeHtml(d.executorId||r.executor?.id||'')}" data-copy-id="${escapeHtml(d.executorId||r.executor?.id||'')}"><i class=\"fas fa-shield-alt\"></i> ${modLabel}</span>` : '',
      chanLabel ? `<span class=\"badge-soft\" title=\"Clique para filtrar • Shift+Clique copia o ID\" data-filter-channel="${escapeHtml(d.channelId||r.channel?.id||'')}" data-copy-id="${escapeHtml(d.channelId||r.channel?.id||'')}"><i class=\"fas fa-hashtag\"></i> ${chanLabel}</span>` : ''
    ].filter(Boolean).join(' ');
    const quick = [];
  if (l.type === 'mod_message_update') {
      if (d.before) quick.push(`<div class=\"feed-meta\"><b>Antes:</b> ${escapeHtml(String(d.before).slice(0, 160))}${String(d.before).length>160?'…':''}</div>`);
      if (d.after) quick.push(`<div class=\"feed-meta\"><b>Depois:</b> ${escapeHtml(String(d.after).slice(0, 160))}${String(d.after).length>160?'…':''}</div>`);
    } else if (l.type === 'mod_message_delete' && d.content) {
      quick.push(`<div class=\"feed-meta\"><b>Conteúdo:</b> ${escapeHtml(String(d.content).slice(0,200))}${String(d.content).length>200?'…':''}</div>`);
    } else if (l.type === 'mod_voice_move') {
      const from = r.fromChannel ? `#${escapeHtml(r.fromChannel.name)}` : 'desconhecido';
      const to = r.toChannel ? `#${escapeHtml(r.toChannel.name)}` : (r.channel ? `#${escapeHtml(r.channel.name)}` : 'desconhecido');
      quick.push(`<div class=\"feed-meta\"><b>Move:</b> ${from} → ${to}</div>`);
    } else if (l.type === 'mod_voice_join') {
      const to = r.channel ? `#${escapeHtml(r.channel.name)}` : 'desconhecido';
      quick.push(`<div class=\"feed-meta\"><b>Entrou:</b> ${to}</div>`);
    } else if (l.type === 'mod_voice_leave') {
      const from = r.channel ? `#${escapeHtml(r.channel.name)}` : 'desconhecido';
      quick.push(`<div class=\"feed-meta\"><b>Saiu:</b> ${from}</div>`);
    } else if (l.type === 'mod_member_update') {
      if (d.nickname && (typeof d.nickname === 'object')) {
        const nb = (typeof d.nickname.before !== 'undefined') ? String(d.nickname.before||'') : null;
        const na = (typeof d.nickname.after !== 'undefined') ? String(d.nickname.after||'') : null;
        if (nb !== null || na !== null) quick.push(`<div class=\"feed-meta\"><b>Apelido:</b> ${escapeHtml(nb??'—')} → ${escapeHtml(na??'—')}</div>`);
      }
      const rr = r.roles || {};
      if (rr.added?.length || rr.removed?.length) {
        const added = (rr.added||[]).slice(0,3).map(ro=>`@${escapeHtml(ro.name||ro.id)}`).join(', ');
        const removed = (rr.removed||[]).slice(0,3).map(ro=>`@${escapeHtml(ro.name||ro.id)}`).join(', ');
        if (added) quick.push(`<div class=\"feed-meta\"><b>Cargos adicionados:</b> ${added}${rr.added.length>3?'…':''}</div>`);
        if (removed) quick.push(`<div class=\"feed-meta\"><b>Cargos removidos:</b> ${removed}${rr.removed.length>3?'…':''}</div>`);
      }
    } else if (l.type === 'mod_ban_add') {
      const reason = l.message || d.reason || '';
      if (reason) quick.push(`<div class=\"feed-meta\"><b>Motivo:</b> ${escapeHtml(String(reason).slice(0,200))}${String(reason).length>200?'…':''}</div>`);
    }
    const acts = buildQuickActions(l);
    const actionsRow = acts.length ? `<div class=\"feed-actions\" style=\"margin-top:8px\">${acts.map(a=>{
      const extra = a.payload ? Object.entries(a.payload).map(([k,v])=>`data-${k.replace(/[A-Z]/g, m=>'-'+m.toLowerCase())}=\"${String(v)}\"`).join(' ') : '';
      const title = `title=\"${escapeHtml(a.label)}\"`;
      return `<button class=\"btn btn-sm btn-glass qa-btn\" ${title} data-action=\"${a.key}\" data-log-id=\"${l.id}\" ${extra}><i class=\"fas ${a.icon}\"></i> ${a.label}</button>`;
    }).join(' ')}</div>` : '';

  // In-card deep links (open in Discord) with glyph icons and more prominent placement
  const userOpen = d.userId ? `<a class=\"btn btn-sm btn-glass link-btn btn-link-user\" title=\"Abrir usuário no Discord\" target=\"_blank\" href=\"https://discord.com/users/${encodeURIComponent(d.userId)}\">@ Abrir usuário</a>` : '';
  const modOpen = d.executorId ? `<a class=\"btn btn-sm btn-glass link-btn btn-link-mod\" title=\"Abrir moderador no Discord\" target=\"_blank\" href=\"https://discord.com/users/${encodeURIComponent(d.executorId)}\">🛡️ Abrir moderador</a>` : '';
  const chanOpen = d.channelId ? `<a class=\"btn btn-sm btn-glass link-btn btn-link-channel\" title=\"Abrir canal no Discord\" target=\"_blank\" href=\"https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(d.channelId)}\"># Abrir canal</a>` : '';
  const msgOpen = (d.channelId && d.messageId) ? `<a class=\"btn btn-sm btn-glass link-btn btn-link-message\" title=\"Abrir mensagem no Discord\" target=\"_blank\" href=\"https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(d.channelId)}/${encodeURIComponent(d.messageId)}\">💬 Abrir mensagem</a>` : '';
  const linksRow = (userOpen || modOpen || chanOpen || msgOpen) ? `<div class=\"link-actions\" style=\"margin-top:6px\">${[userOpen, modOpen, chanOpen, msgOpen].filter(Boolean).join(' ')} </div>` : '';

  // Inline actions: copy + dismiss
  const copyBtn = `<button class=\"btn btn-sm btn-glass copy-summary\" title=\"Copiar resumo\" data-log-id=\"${l.id}\"><i class=\"fas fa-copy\"></i> Copiar resumo</button>`;
  const dismissBtn = `<button class=\"btn btn-sm btn-glass dismiss-card\" title=\"Remover do feed (apenas visual)\" data-log-id=\"${l.id}\"><i class=\"fas fa-eye-slash\"></i> Ocultar</button>`;
    // Build role diff chips for quick visual context in member updates
    let roleChips = '';
    try {
      if (l.type === 'mod_member_update' && r.roles) {
        const add = (r.roles.added||[]).slice(0,4).map(ro=>`<span class=\"role-chip add\"><i class=\"fas fa-plus\"></i>@${escapeHtml(ro.name||ro.id)}</span>`).join('');
        const rem = (r.roles.removed||[]).slice(0,4).map(ro=>`<span class=\"role-chip rem\"><i class=\"fas fa-minus\"></i>@${escapeHtml(ro.name||ro.id)}</span>`).join('');
        if (add || rem) roleChips = `<div class=\"plan-diff\" style=\"margin-top:6px\">${add}${rem}</div>`;
      }
    } catch {}
    const expandBlock = (quick.length || roleChips) ? `<div class=\"expand\" data-collapsed=\"true\">${quick.join('')}${roleChips}</div>` : '';
    return `
      <div class="feed-item ${familyClass(l.type||'')}" role="button" data-log-id="${l.id}" aria-expanded="false" aria-label="${escapeHtml(typeLabel(l.type||''))} em ${dt}">
        <div class="feed-content">
          <div class="feed-head">
            <div class="head-left">
              <div class="icon-badge"><i class="fas ${iconFor(l.type||'')}"></i></div>
              <div class="feed-title-text" title="${escapeHtml(typeLabel(l.type||''))}">${escapeHtml(typeLabel(l.type||'log'))}</div>
              <div class="caret"><i class="fas fa-caret-right"></i></div>
            </div>
            <div class="feed-timestamp">${dt} ${deltaHtml}</div>
          </div>
          <div class="recency-bar" data-ts="${Number(l.timestamp)}"><span></span></div>
          ${meta ? `<div class=\"feed-meta\" style=\"margin-top:4px\">${meta}</div>`:''}
          ${linksRow ? `<div style=\"margin-top:6px\">${linksRow}</div>`:''}
          ${l.message && !isSnowflake(l.message) ? `<div class=\"feed-meta\" style=\"margin-top:6px\">${escapeHtml(l.message)}</div>`:''}
          ${expandBlock}
          <div class="feed-actions" style="margin-top:8px">${copyBtn} ${dismissBtn}</div>
          ${actionsRow}
        </div>
      </div>`;
  }

  function renderFeed(items){
    if (!items.length){ els.feed.innerHTML = `<div class="no-tickets">Sem eventos</div>`; return; }
    const adaptiveBase = perPage || 100;
    const VIRTUAL_THRESHOLD = Math.max(400, adaptiveBase * 6); // adaptive threshold
    // Support ordering toggle
    if(!orderDesc){ items = [...items].reverse(); }
    // Grouping mode bypasses virtualization (handled separately)
    if(groupByMod){
      return renderGroupedByModerator(items);
    }
    const btnEG = document.getElementById('btnExportGroups'); if(btnEG) btnEG.style.display='none';
    if (items.length <= VIRTUAL_THRESHOLD){
      // Normal full render
      const parts = [];
      let lastGroup = null;
      for (const l of items){
        const grp = formatDateGroup(l.timestamp);
        if (grp !== lastGroup){ parts.push(`<div class=\"feed-date\" aria-label=\"${escapeHtml(grp)}\">${escapeHtml(grp)}</div>`); lastGroup = grp; }
        parts.push(renderCard(l));
      }
      els.feed.innerHTML = parts.join('');
      updateRecencyBars();
      scheduleBatchPrefetch(items);
    } else {
      // Virtualized incremental rendering
      els.feed.innerHTML = '';
      let lastGroup = null;
      const CHUNK = 150;
      let rendered = 0;
      const total = items.length;
      function appendChunk(){
        if (rendered >= total) return;
        const frag = document.createDocumentFragment();
        const slice = items.slice(rendered, rendered+CHUNK);
        for (const l of slice){
          const grp = formatDateGroup(l.timestamp);
          if (grp !== lastGroup){ const div=document.createElement('div'); div.className='feed-date'; div.textContent = grp; frag.appendChild(div); lastGroup = grp; }
          const wrapper = document.createElement('div'); wrapper.innerHTML = renderCard(l); frag.appendChild(wrapper.firstElementChild);
        }
        els.feed.appendChild(frag);
        rendered += slice.length;
        updateRecencyBars();
        if(rendered < total){ ensureSentinel(); }
      }
      function ensureSentinel(){
        if (els.feed.querySelector('.virt-sentinel')) return;
        const sent = document.createElement('div'); sent.className='virt-sentinel'; sent.style.height='1px'; sent.style.width='100%'; els.feed.appendChild(sent);
        const io = new IntersectionObserver((entries)=>{
          for(const en of entries){ if(en.isIntersecting){ io.disconnect(); sent.remove(); appendChunk(); break; } }
        });
        io.observe(sent);
      }
      appendChunk();
      scheduleBatchPrefetch(items);
    }
    // Attach handlers
    [...els.feed.querySelectorAll('[data-log-id]')].forEach(btn => btn.addEventListener('click', (e) => {
      const el = e.currentTarget;
      const expanded = el.getAttribute('aria-expanded')==='true';
      el.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      const exp = el.querySelector('.expand');
      if (exp){
        if (expanded){
          exp.setAttribute('data-collapsed','true');
        } else {
          exp.setAttribute('data-collapsed','false');
          // measure natural height then animate
          exp.style.height='auto';
          const h = exp.clientHeight; exp.style.height='0px';
          requestAnimationFrame(()=>{ exp.style.height=h+'px'; exp.addEventListener('transitionend', function done(){ exp.style.height='auto'; exp.removeEventListener('transitionend', done); }); });
        }
        // Expose last logs and maybe show clear stream button
        window.__lastLogs = items;
        updateClearStreamBtn();
      }
      if (e.detail === 2) openEventModal(el.getAttribute('data-log-id'));
    }));
    // Quick actions
    els.feed.querySelectorAll('.qa-btn')?.forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const logId = btn.getAttribute('data-log-id');
        try {
          btn.disabled = true;
          // Always do dry-run first for safety
          const payload = { action, logId };
          const userId = btn.getAttribute('data-user-id'); if (userId) payload.userId = userId;
          const durStr = btn.getAttribute('data-duration-seconds'); const dur = durStr? parseInt(durStr,10):NaN; if (!isNaN(dur)) payload.durationSeconds = dur;
          const dryResp = await postAction({ ...payload, dryRun: true });
          const ok = await showConfirmModal(dryResp, 'Confirmar ação rápida');
          if (!ok) { btn.disabled = false; return; }
          const apply = await postAction(payload);
          if (apply?.success) {
            notify('Ação aplicada','success');
            await loadSummary();
            await loadFeed();
          }
        } catch(e){ console.error(e); notify(e.message,'error'); }
        finally { btn.disabled = false; }
      });
    });
    // Copy summary handlers
    els.feed.querySelectorAll('.copy-summary')?.forEach(btn => {
      btn.addEventListener('click', async (e)=>{
        e.stopPropagation();
        const id = btn.getAttribute('data-log-id');
        try {
          // Compose a compact summary from the DOM and item data
          const title = btn.closest('.feed-item')?.querySelector('.feed-title .type-pill')?.textContent?.trim() || 'Evento';
          const when = btn.closest('.feed-item')?.querySelector('.feed-title .feed-meta')?.textContent?.trim() || '';
          const chips = Array.from(btn.closest('.feed-item')?.querySelectorAll('[data-filter-user],[data-filter-mod],[data-filter-channel]')||[]).map(n=>n.textContent.trim()).join(' | ');
          const extra = Array.from(btn.closest('.feed-item')?.querySelectorAll('.expand .feed-meta')||[]).map(n=>n.textContent.trim()).join('\n');
          const reason = Array.from(btn.closest('.feed-item')?.querySelectorAll(':scope > .feed-content > div'))
            .map(n=>n.textContent.trim()).find(t=>t && !t.startsWith('Copiar resumo') && !t.includes('Abrir') && !t.includes('Carregar mais')) || '';
          const lines = [title, when, chips].filter(Boolean);
          if (reason) lines.push(reason);
          if (extra) lines.push(extra);
          const text = lines.join('\n');
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text); else {
            const ta = document.createElement('textarea'); ta.value = text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
          }
          notify('Resumo copiado','success');
        } catch { notify('Não foi possível copiar','error'); }
      });
    });
    // Dismiss card handlers (UI-only)
    els.feed.querySelectorAll('.dismiss-card')?.forEach(btn => {
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const item = btn.closest('.feed-item');
        if (item) item.remove();
      });
    });
    // Filter chips with Shift+Click to copy ID
    function chipHandler(kind){
      return (e)=>{
        e.stopPropagation();
        const id = e.currentTarget.getAttribute(`data-filter-${kind}`);
        if (!id) return;
        if (e.shiftKey) {
          try { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(id); notify('ID copiado','success'); } catch {}
          return;
        }
        if (kind==='user') els.userId.value = id;
        if (kind==='mod') els.moderatorId.value = id;
        if (kind==='channel') els.channelId.value = id;
        loadFeed();
      };
    }
    els.feed.querySelectorAll('[data-filter-user]')?.forEach(n=> n.addEventListener('click', chipHandler('user')));
    els.feed.querySelectorAll('[data-filter-mod]')?.forEach(n=> n.addEventListener('click', chipHandler('mod')));
    els.feed.querySelectorAll('[data-filter-channel]')?.forEach(n=> n.addEventListener('click', chipHandler('channel')));
    // Load more control
    const more = document.createElement('div');
    more.style.textAlign='center'; more.style.marginTop='8px';
    more.innerHTML = `<button id="btnLoadMore" class="btn btn-glass"><i class="fas fa-angles-down"></i> Carregar mais</button>`;
    els.feed.appendChild(more);
    document.getElementById('btnLoadMore')?.addEventListener('click', async ()=>{ currentLimit = Math.min(1000, currentLimit + 200); persistPrefs(); await loadFeed(); });

    // After render: resolve chips to human-readable labels using their data attributes (avoid showing raw IDs)
    try {
      const chipNodes = els.feed.querySelectorAll('[data-filter-user],[data-filter-mod],[data-filter-channel]');
      chipNodes.forEach(async chip => {
        if (chip.dataset.resolved === '1') return;
        if (chip.hasAttribute('data-filter-user') || chip.hasAttribute('data-filter-mod')){
          const id = chip.getAttribute('data-filter-user') || chip.getAttribute('data-filter-mod');
          const label = await resolveMemberLabel(id);
          if (label) {
            const icon = chip.hasAttribute('data-filter-user') ? 'fa-user' : 'fa-shield-alt';
            chip.innerHTML = `<i class="fas ${icon}"></i> ${escapeHtml(label)}`;
            chip.dataset.resolved = '1';
          }
        } else if (chip.hasAttribute('data-filter-channel')){
          const id = chip.getAttribute('data-filter-channel');
          const label = await resolveChannelLabel(id);
          if (label) {
            chip.innerHTML = `<i class="fas fa-hashtag"></i> ${escapeHtml(label)}`;
            chip.dataset.resolved = '1';
          }
        }
      });
    } catch {}
  }

  function renderGroupedByModerator(items){
    if(!items.length){ els.feed.innerHTML = `<div class="no-tickets">Sem eventos</div>`; return; }
    // Build map executorId => logs
    const groups = new Map();
    for(const it of items){
      let exec = (it.data && it.data.executorId) || (it.resolved && it.resolved.executor && it.resolved.executor.id);
      if(!exec){
        // Fallback: actions sem executor explícito (ex: voice join/leave) — agrupar por próprio userId
        exec = (it.data && it.data.userId) || (it.resolved && it.resolved.user && it.resolved.user.id) || '__system';
      }
      if(!groups.has(exec)) groups.set(exec, []);
      groups.get(exec).push(it);
    }
    // Sort groups by most recent event inside (respect orderDesc)
    const arr = [...groups.entries()].map(([k, list])=>{
      list.sort((a,b)=> orderDesc ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
      return { executorId:k, logs:list, latest: list[0]?.timestamp || 0 };
    });
    if(groupSortByVolume){
      arr.sort((a,b)=> b.logs.length - a.logs.length || (orderDesc ? b.latest - a.latest : a.latest - b.latest));
    } else {
      arr.sort((a,b)=> orderDesc ? b.latest - a.latest : a.latest - b.latest);
    }
    // Pinned first preserving relative order among pinned slice
    if(pinnedGroups.size){
        const pinned = arr.filter(g=> pinnedGroups.has(g.executorId));
        // Apply custom order if present
        if(pinCustomOrder.length){
          pinned.sort((a,b)=>{
            const ia = pinCustomOrder.indexOf(a.executorId);
            const ib = pinCustomOrder.indexOf(b.executorId);
            if(ia===-1 && ib===-1) return 0;
            if(ia===-1) return 1;
            if(ib===-1) return -1;
            return ia-ib;
          });
        }
        const rest = arr.filter(g=> !pinnedGroups.has(g.executorId));
        arr.length = 0; arr.push(...pinned, ...rest);
    }
    const parts = [];
    for(const g of arr){
      const first = g.logs[0];
      let label;
      let iconClass = 'fa-user-shield';
      if(first?.resolved?.executor){
        label = `${first.resolved.executor.username}${first.resolved.executor.nick? ' ('+first.resolved.executor.nick+')':''}`;
      } else if (g.executorId === '__system') {
        label = 'Sistema'; iconClass = 'fa-cog';
      } else if (first?.resolved?.user){
        label = `${first.resolved.user.username}${first.resolved.user.nick? ' ('+first.resolved.user.nick+')':''}`; iconClass='fa-user';
      } else if (first?.data?.userId){
        label = `Utilizador ${first.data.userId}`; iconClass='fa-user';
      } else {
        label = g.executorId || '—';
      }
      parts.push(`<div class="group-mod" data-exec="${escapeHtml(g.executorId)}" aria-expanded="true" draggable="${pinnedGroups.has(g.executorId)?'true':'false'}">
        <div class="group-head"><span class="group-drag-handle" ${pinnedGroups.has(g.executorId)?'':'style="display:none"'} data-tip="Arraste para reordenar grupos fixados"><i class="fas fa-grip-vertical"></i></span><button class="btn btn-sm btn-glass group-toggle" title="Expandir/recolher"><i class="fas fa-chevron-down"></i></button>
          <span class="group-title"><i class="fas ${iconClass}"></i> ${escapeHtml(label||'—')}</span>
          <button class="btn btn-sm btn-glass pin-btn" data-pin="${escapeHtml(g.executorId)}" title="${pinnedGroups.has(g.executorId)?'Desafixar':'Fixar'} grupo" data-tip="${pinnedGroups.has(g.executorId)?'Desafixar':'Fixar'}"><i class="fas fa-thumbtack" style="transform:${pinnedGroups.has(g.executorId)?'rotate(45deg)':'none'}"></i></button>
          <button class="btn btn-sm btn-glass export-group-btn" data-export-group="${escapeHtml(g.executorId)}" data-tip="Exportar apenas este grupo"><i class="fas fa-download"></i></button>
          <span class="group-count">${g.logs.length} evento(s)</span>
        </div>
        ${buildGroupTypesPills(g.logs)}
        <div class="group-body">
          ${g.logs.map(l=> renderCard(l)).join('')}
        </div>
      </div>`);
    }
    els.feed.innerHTML = parts.join('');
  window.__lastLogs = items;
  updateClearStreamBtn();
    const btnEG = document.getElementById('btnExportGroups'); if(btnEG) btnEG.style.display='inline-flex';
    // Attach toggle
    els.feed.querySelectorAll('.group-mod .group-toggle')?.forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const wrap = btn.closest('.group-mod');
        const expanded = wrap.getAttribute('aria-expanded')==='true';
        wrap.setAttribute('aria-expanded', expanded?'false':'true');
        const body = wrap.querySelector('.group-body');
        if(body){ body.style.display = expanded? 'none':'block'; }
        btn.innerHTML = expanded? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-down"></i>';
      });
    });
    // After insertion, attach feed item click as usual
    els.feed.querySelectorAll('.feed-item[data-log-id]')?.forEach(el=>{
      el.addEventListener('click', (e)=>{
        const expanded = el.getAttribute('aria-expanded')==='true';
        el.setAttribute('aria-expanded', expanded?'false':'true');
        const exp = el.querySelector('.expand');
        if (exp){
          if (expanded){ exp.setAttribute('data-collapsed','true'); }
          else { exp.setAttribute('data-collapsed','false'); exp.style.height='auto'; const h=exp.clientHeight; exp.style.height='0px'; requestAnimationFrame(()=>{ exp.style.height=h+'px'; exp.addEventListener('transitionend', function done(){ exp.style.height='auto'; exp.removeEventListener('transitionend', done); }); }); }
        }
        if(e.detail===2) openEventModal(el.getAttribute('data-log-id'));
      });
    });
    // Pin handlers
    els.feed.querySelectorAll('.group-mod .pin-btn')?.forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const id = btn.getAttribute('data-pin');
        if(!id) return;
        if(pinnedGroups.has(id)) pinnedGroups.delete(id); else pinnedGroups.add(id);
        persistPrefs();
        if(window.__lastLogs) renderFeed(window.__lastLogs);
      });
    });
    // Pill click handlers for quick filtering
    els.feed.querySelectorAll('.group-types .gt-pill')?.forEach(pill=>{
      pill.addEventListener('click', (e)=>{
        e.stopPropagation();
        const raw = pill.getAttribute('data-group-type');
        if(!raw) return;
        // Map family root after 'mod_'
        const fam = raw.replace(/^mod_/, '').split('_')[0]; // message/member/voice/ban/channel/role
        const map = { message:'messages', member:'members', voice:'voice', ban:'bans', channel:'channels', role:'roles' };
        const famKey = map[fam];
        if(!famKey) return;
        // multiFamilies support: toggle
        if(multiFamilies.has(famKey)) multiFamilies.delete(famKey); else multiFamilies.add(famKey);
        if(multiFamilies.size===0) currentFamily='all';
        persistPrefs();
        loadFeed();
      });
    });
  }
  function buildGroupStats(items){
    const stats = {};
    for(const it of items){
      const execId = (it.data && it.data.executorId) || (it.resolved?.executor?.id) || (it.data?.userId) || '__system';
      if(!stats[execId]) stats[execId] = { executorId: execId, total:0, types:{} };
      stats[execId].total++;
      const root = (it.type||'').split('_').slice(0,2).join('_');
      stats[execId].types[root] = (stats[execId].types[root]||0)+1;
    }
    return Object.values(stats);
  }
  async function exportGroupStats(fmt){
    if(!window.__lastLogs){ notify('Sem dados','error'); return; }
    const stats = buildGroupStats(window.__lastLogs);
    if(!stats.length){ notify('Sem dados','error'); return; }
    if(fmt==='json'){
      const blob = new Blob([JSON.stringify(stats,null,2)],{type:'application/json'});
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`grupos-${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),4000); return;
    }
    // CSV: executorId,total,<type counts dynamic>
    const allTypes = new Set(); stats.forEach(s=> Object.keys(s.types).forEach(t=> allTypes.add(t)));
    const header = ['executorId','total',...allTypes];
    const rows = [header.join(',')];
    stats.forEach(s=>{
      const line = [s.executorId,s.total, ...[...allTypes].map(t=> s.types[t]||0)];
      rows.push(line.map(v=>`"${String(v).replace(/"/g,'"')}"`).join(','));
    });
    const blob = new Blob([rows.join('\n')],{type:'text/csv'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`grupos-${Date.now()}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  function buildGroupTypesPills(list){
    try {
      const counts = {};
      for(const l of list){
        const fam = (l.type||'').split('_').slice(0,2).join('_');
        counts[fam] = (counts[fam]||0)+1;
      }
      const mapLabel = {
        mod_message: 'Msg',
        mod_member: 'Membro',
        mod_voice: 'Voz',
        mod_ban: 'Ban',
        mod_channel: 'Canal',
        mod_role: 'Cargo'
      };
      const total = list.length || 1;
      const pills = Object.entries(counts)
        .sort((a,b)=> b[1]-a[1])
        .map(([k,v])=>{ const pct = ((v/total)*100).toFixed(0); return `<span class="gt-pill" data-group-type="${k}" title="${v} eventos (${pct}%) ${mapLabel[k]||k}"><b>${mapLabel[k]||k}</b> ${v} <span style="opacity:.6">${pct}%</span></span>`; })
        .join('');
      if(!pills) return '';
      return `<div class="group-types">${pills}</div>`;
    } catch { return '';} 
  }
  function updateClearStreamBtn(){
    try {
      const btn = document.getElementById('btnClearStream');
      if(!btn) return;
      const show = streamMode && (window.__lastLogs?.length || 0) > 0;
      btn.style.display = show ? 'inline-flex':'none';
    } catch {}
  }
  function clearStream(){
    if(!streamMode){ return; }
    els.feed.innerHTML = '<div class="no-tickets">Stream limpo</div>';
    window.__lastLogs = [];
    updateClearStreamBtn();
  }

  // Batch prefetch unresolved names (members & channels) to minimize flicker
  function scheduleBatchPrefetch(items){
    try {
      const memberIds = new Set();
      const channelIds = new Set();
      for (const l of items){
        const d = l.data||{}; const r = l.resolved||{};
        if(d.userId && !(__nameCache.member.has(d.userId) || (r.user && r.user.username))) memberIds.add(String(d.userId));
        if(d.executorId && !(__nameCache.member.has(d.executorId) || (r.executor && r.executor.username))) memberIds.add(String(d.executorId));
        if(d.channelId && !(__nameCache.channel.has(d.channelId) || (r.channel && r.channel.name))) channelIds.add(String(d.channelId));
      }
      if(!memberIds.size && !channelIds.size) return;
      // Simple debounce
      clearTimeout(window.__batchPrefetchTimer);
      window.__batchPrefetchTimer = setTimeout(async () => {
        try {
          if(memberIds.size) await batchFetchMembers([...memberIds].slice(0,50));
          if(channelIds.size) await batchFetchChannels([...channelIds].slice(0,50));
          // Re-render only labels needing update
          hydrateLabelsFromCache();
        } catch {}
      }, 250);
    } catch {}
  }

  async function batchFetchMembers(ids){
    try {
      const u = new URL(`/api/guild/${guildId}/search/members`, window.location.origin);
      u.searchParams.set('q', ids.join(','));
      const d = await fetchJson(u);
      const list = Array.isArray(d.results)? d.results: [];
      for(const m of list){
        const label = m.nick ? `${m.username} (${m.nick})` : `${m.username}`;
        __nameCache.member.set(String(m.id), label);
      }
    } catch {}
  }
  async function batchFetchChannels(ids){
    try {
      const u = new URL(`/api/guild/${guildId}/search/channels`, window.location.origin);
      u.searchParams.set('q', ids.join(','));
      const d = await fetchJson(u);
      const list = Array.isArray(d.results)? d.results: [];
      for(const c of list){
        const label = `#${c.name||c.id}`;
        __nameCache.channel.set(String(c.id), label);
      }
    } catch {}
  }
  function hydrateLabelsFromCache(){
    try {
      els.feed?.querySelectorAll('[data-filter-user],[data-filter-mod],[data-filter-channel]')?.forEach(el => {
        if(el.hasAttribute('data-filter-user')){
          const id = el.getAttribute('data-filter-user');
          if(id && __nameCache.member.has(id)) el.innerHTML = `<i class="fas fa-user"></i> ${escapeHtml(__nameCache.member.get(id))}`;
        } else if(el.hasAttribute('data-filter-mod')) {
          const id = el.getAttribute('data-filter-mod');
          if(id && __nameCache.member.has(id)) el.innerHTML = `<i class="fas fa-shield-alt"></i> ${escapeHtml(__nameCache.member.get(id))}`;
        } else if(el.hasAttribute('data-filter-channel')) {
          const id = el.getAttribute('data-filter-channel');
          if(id && __nameCache.channel.has(id)) el.innerHTML = `<i class=\"fas fa-hashtag\"></i> ${escapeHtml(__nameCache.channel.get(id))}`;
        }
      });
    } catch {}
  }

  // Recency progress bar logic: shows how old an event is within a chosen window (default 24h)
  function getRecencyWindowMs(){
    const sel = els.window?.value || '24h';
    if (sel === '1h') return 60 * 60 * 1000;
    if (sel === '7d') return 7 * 24 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000; // default 24h
  }
  function updateRecencyBars(){
    const now = Date.now();
    const bars = els.feed?.querySelectorAll('.recency-bar');
    if(!bars) return;
    bars.forEach(bar => {
      const ts = Number(bar.getAttribute('data-ts'));
      if(!ts) return;
      const age = now - ts;
  const ratio = Math.max(0, Math.min(1, age / getRecencyWindowMs()));
      const span = bar.querySelector('span');
      if(span){
        span.style.transform = `scaleX(${1 - ratio})`;
        span.style.opacity = (ratio < 1) ? '1' : '0.2';
      }
    });
  }
  function updateRecencyLegend(){
    const el = document.getElementById('recencyLegend');
    if(!el) return;
    const w = getRecencyWindowMs();
    const hours = w / 3600000;
    if(hours <= 1) el.textContent = 'Barra de recência: representa 1 hora completa.';
    else if(hours < 30) el.textContent = `Barra de recência: encolhe ao longo de ${hours.toFixed(0)} horas.`;
    else el.textContent = `Barra de recência: encolhe ao longo de ${(hours/24).toFixed(0)} dias.`;
  }
  setInterval(updateRecencyBars, 60000); // update every minute

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); }
  function isSnowflake(s){ return /^[0-9]{10,20}$/.test(String(s||'')); }

  function toggleAuto(){
    const pressed = els.btnAuto.getAttribute('aria-pressed') === 'true';
    const next = !pressed;
    els.btnAuto.setAttribute('aria-pressed', String(next));
    els.btnAuto.innerHTML = next ? `<i class="fas fa-pause"></i> Auto` : `<i class="fas fa-play"></i> Auto`;
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    if (next) {
      autoTimer = setInterval(async ()=>{ await loadSummary(); await loadFeed(); }, 5000);
    }
    persistPrefs();
  }
  function toggleStream(){
    streamMode = !streamMode;
    const btn = document.getElementById('btnStream');
    btn?.setAttribute('aria-pressed', streamMode?'true':'false');
    persistPrefs();
    updateClearStreamBtn();
  }
  function toggleLatency(){
    showLatency = !showLatency;
    const btn = document.getElementById('btnLatency');
    btn?.setAttribute('aria-pressed', showLatency?'true':'false');
    persistPrefs();
    if(window.__lastLogs) renderFeed(window.__lastLogs);
  }
  function toggleOrder(){
    orderDesc = !orderDesc;
    const btn = document.getElementById('btnOrder');
    btn?.setAttribute('aria-pressed', orderDesc?'true':'false');
    persistPrefs();
    if(window.__lastLogs) renderFeed(window.__lastLogs);
  }

  async function fetchAllForExport(){
    const u = new URL(`/api/guild/${guildId}/logs`, window.location.origin);
    u.searchParams.set('type', buildTypeParam());
    buildRange(u);
    u.searchParams.set('limit','5000');
    const r = await fetch(u, { credentials:'same-origin' }); const d = await r.json();
    if(!r.ok || !d.success) throw new Error(d.error||'Falha ao obter logs');
    return Array.isArray(d.logs)? d.logs: [];
  }
  async function exportCsv(){
    const fmt = (els.exportFormat?.value||'csv');
    try {
      const logs = await fetchAllForExport();
      if(fmt==='json'){
        const blob = new Blob([JSON.stringify(logs,null,2)], { type:'application/json' });
        const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`logs-${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),4000); return;
      }
      // CSV
      const headers=['id','timestamp','type','userId','executorId','channelId','message'];
      const rows=[headers.join(',')];
      logs.forEach(l=>{ const d=l.data||{}; const row=[l.id,l.timestamp,l.type,d.userId||'',d.executorId||'',d.channelId||'', (l.message||'').toString().replace(/\n/g,' ' )]; rows.push(row.map(v=>`"${String(v).replace(/"/g,'"')}"`).join(',')); });
      const blob = new Blob([rows.join('\n')], { type:'text/csv' });
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`logs-${Date.now()}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),4000);
    } catch(e){ notify(e.message||'Falha exportação','error'); }
  }

  // Name resolution helpers to avoid showing raw IDs in UI chips
  const __nameCache = { member: new Map(), channel: new Map() };
  async function fetchJson(url){ const r = await fetch(url, { credentials:'same-origin' }); const d = await r.json(); if(!r.ok || !d.success) throw new Error(d.error||`HTTP ${r.status}`); return d; }
  async function resolveMemberLabel(id){
    if (!id) return null;
    if (__nameCache.member.has(id)) return __nameCache.member.get(id);
    try {
      const u = new URL(`/api/guild/${guildId}/search/members`, window.location.origin); u.searchParams.set('q', id);
      const d = await fetchJson(u);
      const list = Array.isArray(d.results)? d.results: [];
      const m = list.find(x=> String(x.id)===String(id)) || list[0];
      if (!m) return null;
      const label = m.nick ? `${m.username} (${m.nick})` : `${m.username}`;
      __nameCache.member.set(id, label);
      return label;
    } catch { return null; }
  }
  async function resolveChannelLabel(id){
    if (!id) return null;
    if (__nameCache.channel.has(id)) return __nameCache.channel.get(id);
    try {
      const u = new URL(`/api/guild/${guildId}/search/channels`, window.location.origin); u.searchParams.set('q', id);
      const d = await fetchJson(u);
      const list = Array.isArray(d.results)? d.results: [];
      const c = list.find(x=> String(x.id)===String(id)) || list[0];
      if (!c) return null;
      const label = `#${c.name||id}`;
      __nameCache.channel.set(id, label);
      return label;
    } catch { return null; }
  }

  async function openEventModal(logId){
    try {
      if (!logId) return;
      const u = new URL(`/api/guild/${guildId}/moderation/event/${encodeURIComponent(logId)}`, window.location.origin);
      const r = await fetch(u, { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok || !d.success) {
        if (r.status === 404 || d.error === 'log_not_found') {
          // Friendly modal for missing events
          els.modalTitle.textContent = 'Evento indisponível';
          els.modalBody.innerHTML = `<div class="kv"><b>Este evento já não existe.</b></div><div class="text-secondary" style="margin-top:6px">Pode ter sido removido ou está fora do histórico guardado.</div>`;
          els.modal.classList.remove('modal-hidden');
          els.modal.classList.add('modal-visible');
          els.modal.setAttribute('aria-hidden','false');
          return;
        }
        throw new Error(d.error || `HTTP ${r.status}`);
      }
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
        if (ev.type === 'mod_message_delete' && (data.content && data.channelId)) {
          actions.push({ key:'restore_message', label:'Restaurar mensagem', icon:'fa-undo', payload:{ logId: ev.id } });
        }
      } else if (ev.type.startsWith('mod_channel_')) {
        if (ev.type === 'mod_channel_delete') {
          actions.push({ key:'recreate_channel', label:'Recriar canal', icon:'fa-plus-square', payload:{ logId: ev.id } });
        } else if (ev.type === 'mod_channel_update') {
          actions.push({ key:'rename_channel', label:'Reverter nome do canal', icon:'fa-i-cursor', payload:{ logId: ev.id } });
        }
      } else if (ev.type.startsWith('mod_role_')) {
        if (ev.type === 'mod_role_delete') {
          actions.push({ key:'restore_role', label:'Restaurar cargo', icon:'fa-user-shield', payload:{ logId: ev.id } });
        } else if (ev.type === 'mod_role_update') {
          actions.push({ key:'revert_role_props', label:'Reverter propriedades do cargo', icon:'fa-undo', payload:{ logId: ev.id } });
        }
      }

      const resolved = ev.resolved || {};
      const avatarUrl = (id, avatar) => {
        if (id && avatar) return `https://cdn.discordapp.com/avatars/${encodeURIComponent(id)}/${encodeURIComponent(avatar)}.png?size=128`;
        return '/default-avatar.svg';
      };
  const userText = resolved.user ? `${escapeHtml(resolved.user.username||'')}${resolved.user.nick? ' ('+escapeHtml(resolved.user.nick)+')':''}` : (data.userId ? 'Desconhecido' : '-');
  const modText = resolved.executor ? `${escapeHtml(resolved.executor.username||'')}${resolved.executor.nick? ' ('+escapeHtml(resolved.executor.nick)+')':''}` : (data.executorId ? 'Desconhecido' : '-');
  const chanText = resolved.channel ? `#${escapeHtml(resolved.channel.name||'')}` : (data.channelId ? 'Desconhecido' : '-');
  const body = [];
  body.push(`<div class="kv"><b>Tipo:</b> ${escapeHtml(ev.type)}</div>`);
  body.push(`<div class="kv"><b>Quando:</b> ${new Date(ev.timestamp).toLocaleString('pt-PT')}</div>`);
      // Identity header with avatars
      body.push(`
        <div class="identity-row">
          <div class="id-card">
            <img class="avatar-sm" src="${avatarUrl(resolved.user?.id, resolved.user?.avatar)}" alt="avatar usuário" />
            <div class="id-meta">
              <div class="id-title"><i class="fas fa-user"></i> Usuário</div>
              <div class="id-name">${resolved.user ? `${escapeHtml(resolved.user.username||'')}${resolved.user.nick? ' ('+escapeHtml(resolved.user.nick)+')':''}` : (data.userId? escapeHtml(data.userId) : '-')}</div>
            </div>
          </div>
          <div class="id-card">
            <img class="avatar-sm" src="${avatarUrl(resolved.executor?.id, resolved.executor?.avatar)}" alt="avatar moderador" />
            <div class="id-meta">
              <div class="id-title"><i class="fas fa-shield-alt"></i> Moderador</div>
              <div class="id-name">${resolved.executor ? `${escapeHtml(resolved.executor.username||'')}${resolved.executor.nick? ' ('+escapeHtml(resolved.executor.nick)+')':''}` : (data.executorId? escapeHtml(data.executorId) : '-')}</div>
            </div>
          </div>
        </div>
      `);
  body.push(`<div class=\"kv\"><b>Usuário:</b> ${userText} ${data.userId? `<button class=\"btn btn-sm btn-glass\" title=\"Copiar ID do usuário\" data-copy-id=\"${escapeHtml(data.userId)}\"><i class=\"fas fa-copy\"></i> Copiar ID</button>`:''}</div>`);
    body.push(`<div class=\"kv\"><b>Moderador:</b> ${modText} ${data.executorId? `<button class=\"btn btn-sm btn-glass\" title=\"Copiar ID do moderador\" data-copy-id=\"${escapeHtml(data.executorId)}\"><i class=\"fas fa-copy\"></i> Copiar ID</button>`:''}</div>`);
  const userOpen = data.userId ? `<a class=\"btn btn-sm btn-glass link-btn btn-link-user\" title=\"Abrir usuário no Discord\" target=\"_blank\" href=\"https://discord.com/users/${encodeURIComponent(data.userId)}\">@ Abrir usuário</a>` : '';
  const modOpen = data.executorId ? `<a class=\"btn btn-sm btn-glass link-btn btn-link-mod\" title=\"Abrir moderador no Discord\" target=\"_blank\" href=\"https://discord.com/users/${encodeURIComponent(data.executorId)}\">🛡️ Abrir moderador</a>` : '';
  const chanOpen = data.channelId ? `<a class=\"btn btn-sm btn-glass link-btn btn-link-channel\" title=\"Abrir canal no Discord\" target=\"_blank\" href=\"https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(data.channelId)}\"># Abrir canal</a>` : '';
  const msgOpen = (data.channelId && data.messageId) ? `<a class=\"btn btn-sm btn-glass link-btn btn-link-message\" title=\"Abrir mensagem no Discord\" target=\"_blank\" href=\"https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(data.channelId)}/${encodeURIComponent(data.messageId)}\">💬 Abrir mensagem</a>` : '';
  body.push(`<div class=\"kv\"><b>Abrir:</b> ${[userOpen, modOpen, chanOpen, msgOpen].filter(Boolean).join(' ')||'-'}</div>`);
  body.push(`<div class=\"kv\"><b>Canal:</b> ${chanText} ${data.channelId? `<button class=\"btn btn-sm btn-glass\" title=\"Copiar ID do canal\" data-copy-id=\"${escapeHtml(data.channelId)}\"><i class=\"fas fa-copy\"></i> Copiar ID</button>`:''}</div>`);
      if (ev.message) body.push(`<div class="kv"><b>Motivo:</b> ${escapeHtml(ev.message)}</div>`);
      if (ev.type === 'mod_message_update') {
        if (data.before) body.push(`<pre class="code-block"><b>Antes:</b>\n${escapeHtml(data.before)}</pre>`);
        if (data.after) body.push(`<pre class="code-block"><b>Depois:</b>\n${escapeHtml(data.after)}</pre>`);
      } else if (ev.type === 'mod_message_delete') {
        // If content available in message, show it
        if (data.content) body.push(`<pre class="code-block"><b>Conteúdo:</b>\n${escapeHtml(data.content)}</pre>`);
      }

      // Voice event rich details
      if (ev.type === 'mod_voice_move' || ev.type === 'mod_voice_join' || ev.type === 'mod_voice_leave') {
        try {
          const rsv = resolved || {};
          if (ev.type === 'mod_voice_move') {
            const from = rsv.fromChannel ? `#${escapeHtml(rsv.fromChannel.name)}` : 'desconhecido';
            const to = rsv.toChannel ? `#${escapeHtml(rsv.toChannel.name)}` : (rsv.channel ? `#${escapeHtml(rsv.channel.name)}` : 'desconhecido');
            body.push(`<div class="kv"><b>Moveu-se:</b> ${from} → ${to}</div>`);
          } else if (ev.type === 'mod_voice_join') {
            const to = rsv.channel ? `#${escapeHtml(rsv.channel.name)}` : 'desconhecido';
            body.push(`<div class="kv"><b>Entrou em:</b> ${to}</div>`);
          } else if (ev.type === 'mod_voice_leave') {
            const from = rsv.channel ? `#${escapeHtml(rsv.channel.name)}` : 'desconhecido';
            body.push(`<div class="kv"><b>Saiu de:</b> ${from}</div>`);
          }
        } catch {}
      }

      // Member update diffs (nickname, roles)
      if (ev.type === 'mod_member_update') {
        try {
          if (data.nickname && typeof data.nickname === 'object') {
            const nb = (typeof data.nickname.before !== 'undefined') ? String(data.nickname.before||'') : null;
            const na = (typeof data.nickname.after !== 'undefined') ? String(data.nickname.after||'') : null;
            if (nb !== null || na !== null) body.push(`<div class="kv"><b>Apelido:</b> ${escapeHtml(nb??'—')} → ${escapeHtml(na??'—')}</div>`);
          }
          const rr = (resolved && resolved.roles) ? resolved.roles : {};
          if (rr.added?.length || rr.removed?.length) {
            const added = (rr.added||[]).map(ro=>`@${escapeHtml(ro.name||ro.id)}`).join(', ');
            const removed = (rr.removed||[]).map(ro=>`@${escapeHtml(ro.name||ro.id)}`).join(', ');
            if (added) body.push(`<div class="kv"><b>Cargos adicionados:</b> ${added}</div>`);
            if (removed) body.push(`<div class="kv"><b>Cargos removidos:</b> ${removed}</div>`);
          }
        } catch {}
      }

      // Channel update diffs (best-effort)
      if (ev.type === 'mod_channel_update') {
        const showDiff = (obj, label) => {
          if (obj && typeof obj === 'object' && ('before' in obj || 'after' in obj)) {
            const b = (obj.before!=null)? String(obj.before): '—';
            const a = (obj.after!=null)? String(obj.after): '—';
            body.push(`<div class="kv"><b>${escapeHtml(label)}:</b> ${escapeHtml(b)} → ${escapeHtml(a)}</div>`);
          }
        };
        try {
          showDiff(data.name, 'Nome');
          showDiff(data.topic, 'Tópico');
          showDiff(data.parentId, 'Categoria');
          showDiff(data.position, 'Posição');
          showDiff(data.nsfw, 'NSFW');
          showDiff(data.rateLimitPerUser, 'Slowmode');
        } catch {}
      }

      // Role update diffs (best-effort)
      if (ev.type === 'mod_role_update') {
        const showDiff = (obj, label) => {
          if (obj && typeof obj === 'object' && ('before' in obj || 'after' in obj)) {
            const b = (obj.before!=null)? String(obj.before): '—';
            const a = (obj.after!=null)? String(obj.after): '—';
            body.push(`<div class="kv"><b>${escapeHtml(label)}:</b> ${escapeHtml(b)} → ${escapeHtml(a)}</div>`);
          }
        };
        try {
          showDiff(data.name, 'Nome');
          showDiff(data.color, 'Cor');
          showDiff(data.hoist, 'Separado');
          showDiff(data.mentionable, 'Mencionável');
          if (data.permissions && typeof data.permissions === 'object') {
            const add = Array.isArray(data.permissions.added)? data.permissions.added : [];
            const rem = Array.isArray(data.permissions.removed)? data.permissions.removed : [];
            if (add.length) body.push(`<div class="kv"><b>Permissões adicionadas:</b> ${add.map(p=>`<code>${escapeHtml(String(p))}</code>`).join(', ')}</div>`);
            if (rem.length) body.push(`<div class="kv"><b>Permissões removidas:</b> ${rem.map(p=>`<code>${escapeHtml(String(p))}</code>`).join(', ')}</div>`);
          }
        } catch {}
      }

      if (actions.length) {
        body.push('<div class="actions-row">' + actions.map(a => `<button class="btn btn-primary" data-action="${a.key}"><i class="fas ${a.icon}"></i> ${a.label}</button>`).join(' ') + '</div>');
        const persisted = localStorage.getItem('mod-event-dryrun') === 'true';
        body.push(`<div class="kv" style="margin-top:8px"><label><input type="checkbox" id="dryRunToggle" ${persisted? 'checked':''} /> Pré-visualizar (dry run)</label></div>`);
      }

  els.modalTitle.textContent = 'Evento de moderação';
  // Add copy details tool at the top
  body.unshift(`<div class=\"actions-row\">\n    <button id=\"btnCopyDetails\" class=\"btn btn-glass\" title=\"Copiar detalhes do evento\"><i class=\"fas fa-copy\"></i> Copiar detalhes</button>\n    <button id=\"btnExportJson\" class=\"btn btn-glass\" title=\"Exportar JSON bruto do evento\"><i class=\"fas fa-file-code\"></i> Exportar JSON</button>\n  </div>`);
  els.modalBody.innerHTML = body.join('');
  els.modal.classList.remove('modal-hidden');
  els.modal.classList.add('modal-visible');
  els.modal.setAttribute('aria-hidden','false');
      // Copy details aggregate handler
      try {
        const btnCopyDetails = els.modalBody.querySelector('#btnCopyDetails');
        const btnExportJson = els.modalBody.querySelector('#btnExportJson');
        btnCopyDetails?.addEventListener('click', async ()=>{
          try {
            const parts = [];
            // Prefer readable key-value lines
            els.modalBody.querySelectorAll('.kv')?.forEach(kv => parts.push(kv.textContent.trim()));
            // Include any code blocks (before/after/content)
            els.modalBody.querySelectorAll('.code-block')?.forEach(pre => parts.push(pre.textContent.trim()));
            const text = parts.filter(Boolean).join('\n');
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text); else {
              const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
            }
            notify('Detalhes copiados','success');
          } catch { notify('Não foi possível copiar','error'); }
        });
        btnExportJson?.addEventListener('click', ()=>{
          try {
            const blob = new Blob([JSON.stringify(ev, null, 2)], { type:'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `evento-${ev.id}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(()=> URL.revokeObjectURL(url), 5000);
          } catch { notify('Falha ao exportar JSON','error'); }
        });
      } catch {}
      // Wire copy buttons
      els.modalBody.querySelectorAll('[data-copy-id]')?.forEach(btn => {
        btn.addEventListener('click', async () => {
          const val = btn.getAttribute('data-copy-id');
          try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(val);
            else { const ta=document.createElement('textarea'); ta.value=val; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
            notify('ID copiado','success');
          } catch { notify('Não foi possível copiar','error'); }
        });
      });
      // Persist dry-run toggle changes
      const dryToggle = els.modalBody.querySelector('#dryRunToggle');
      if (dryToggle){ dryToggle.addEventListener('change', ()=>{ localStorage.setItem('mod-event-dryrun', dryToggle.checked ? 'true':'false'); }); }
      // Wire action clicks
      if (actions.length) {
        actions.forEach(a => {
          const btn = els.modalBody.querySelector(`[data-action="${a.key}"]`);
          if (!btn) return;
          btn.addEventListener('click', async () => {
            try {
              btn.disabled = true; btn.textContent = 'A executar...';
              const payload = { action: a.key, ...a.payload, logId: ev.id };
              const dry = !!(els.modalBody.querySelector('#dryRunToggle')?.checked);
              if (dry) payload.dryRun = true;
              const r = await fetch(`/api/guild/${guildId}/moderation/action`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) });
              const d2 = await r.json();
              if (!r.ok || !d2.success) throw new Error(d2.error || `HTTP ${r.status}`);
              if (payload.dryRun) {
                // Polished in-modal confirmation: show risks + plan, then confirm to apply
                const ok = await injectConfirmInCurrentModal(d2);
                if (!ok) { btn.disabled = false; btn.textContent = `${a.label}`; return; }
                // Apply for real
                const payload2 = { ...payload };
                delete payload2.dryRun;
                const r2 = await fetch(`/api/guild/${guildId}/moderation/action`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload2) });
                const d3 = await r2.json();
                if (!r2.ok || !d3.success) throw new Error(d3.error || `HTTP ${r2.status}`);
                notify('Ação concluída','success');
                els.modal.classList.add('modal-hidden');
                els.modal.classList.remove('modal-visible');
                els.modal.setAttribute('aria-hidden','true');
                await loadFeed(); await loadSummary();
              } else {
                notify('Ação concluída','success');
                els.modal.classList.add('modal-hidden');
                els.modal.classList.remove('modal-visible');
                els.modal.setAttribute('aria-hidden','true');
                await loadFeed(); await loadSummary();
              }
            } catch(e){ console.error(e); notify(e.message,'error'); } finally { btn.disabled = false; }
          });
        });
      }
    } catch(e){ console.error(e); notify(e.message,'error'); }
  }

  // Events
  els.btnRefresh?.addEventListener('click', async ()=>{ await loadSummary(); await loadFeed(); });
  els.btnAuto?.addEventListener('click', toggleAuto);
  document.getElementById('btnStream')?.addEventListener('click', toggleStream);
  document.getElementById('btnLatency')?.addEventListener('click', toggleLatency);
  document.getElementById('btnOrder')?.addEventListener('click', toggleOrder);
  document.getElementById('btnGroupMod')?.addEventListener('click', ()=>{ groupByMod = !groupByMod; document.getElementById('btnGroupMod')?.setAttribute('aria-pressed', groupByMod?'true':'false'); persistPrefs(); if(window.__lastLogs) renderFeed(window.__lastLogs); else loadFeed(); });
  document.getElementById('btnClearStream')?.addEventListener('click', clearStream);
  document.getElementById('btnGroupSortVol')?.addEventListener('click', ()=>{ groupSortByVolume = !groupSortByVolume; document.getElementById('btnGroupSortVol')?.setAttribute('aria-pressed', groupSortByVolume?'true':'false'); persistPrefs(); if(groupByMod && window.__lastLogs) renderFeed(window.__lastLogs); });
  document.getElementById('btnExportGroups')?.addEventListener('click', ()=>{ const fmt = (els.exportFormat?.value||'csv'); exportGroupStats(fmt==='json'?'json':'csv'); });
  document.getElementById('btnGroupsToggle')?.addEventListener('click', ()=>{
    // Drag & drop ordering for pinned groups
    let dragId = null;
    els.feed.querySelectorAll('.group-mod[draggable="true"]')?.forEach(g=>{
      g.addEventListener('dragstart', (e)=>{ dragId = g.getAttribute('data-exec'); g.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
      g.addEventListener('dragend', ()=>{ dragId=null; g.classList.remove('dragging'); });
      g.addEventListener('dragover', (e)=>{
        if(!dragId) return; e.preventDefault();
        const overId = g.getAttribute('data-exec'); if(overId===dragId) return;
        const list = [...els.feed.querySelectorAll('.group-mod[draggable="true"]')];
        const dragEl = list.find(n=> n.getAttribute('data-exec')===dragId);
        const overIndex = list.indexOf(g); const dragIndex = list.indexOf(dragEl);
        if(dragIndex < overIndex){ g.after(dragEl); } else { g.before(dragEl); }
      });
    });
    els.feed.addEventListener('drop', ()=>{
      if(!pinnedGroups.size) return;
      const ordered = [...els.feed.querySelectorAll('.group-mod[draggable="true"]')].map(n=> n.getAttribute('data-exec')).filter(Boolean);
      pinCustomOrder = ordered;
      persistPrefs();
    }, { once:true });
    // Per-group export button
    els.feed.querySelectorAll('.export-group-btn')?.forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const id = btn.getAttribute('data-export-group'); if(!id) return;
        const fmt = (els.exportFormat?.value||'csv');
        const logs = (window.__lastLogs||[]).filter(l=>{
          let exec = (l.data && l.data.executorId) || (l.resolved && l.resolved.executor && l.resolved.executor.id);
          if(!exec){ exec = (l.data && l.data.userId) || (l.resolved && l.resolved.user && l.resolved.user.id) || '__system'; }
          return exec === id;
        });
        if(!logs.length){ notify('Sem eventos neste grupo','error'); return; }
        if(fmt==='json'){
          const blob = new Blob([JSON.stringify(logs,null,2)],{type:'application/json'});
          const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`grupo-${id}-${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),4000); return;
        }
        const headers=['id','timestamp','type','userId','executorId','channelId','message'];
        const rows=[headers.join(',')];
        logs.forEach(l=>{ const d=l.data||{}; const row=[l.id,l.timestamp,l.type,d.userId||'',d.executorId||'',d.channelId||'', (l.message||'').toString().replace(/\n/g,' ')]; rows.push(row.map(v=>`"${String(v).replace(/"/g,'"')}"`).join(',')); });
        const blob = new Blob([rows.join('\n')],{type:'text/csv'});
        const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`grupo-${id}-${Date.now()}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),4000);
      });
    });
    const btn = document.getElementById('btnGroupsToggle'); if(!btn) return;
    const state = btn.getAttribute('data-state')||'expanded';
    const next = state==='expanded' ? 'collapsed' : 'expanded';
    btn.setAttribute('data-state', next);
    btn.innerHTML = next==='collapsed' ? '<i class="fas fa-expand-alt"></i> Expandir' : '<i class="fas fa-compress-alt"></i> Colapsar';
    const wrap = document.querySelectorAll('.group-mod');
    wrap.forEach(g=>{
      g.setAttribute('aria-expanded', next==='collapsed' ? 'false':'true');
      const body = g.querySelector('.group-body'); if(body) body.style.display = next==='collapsed' ? 'none':'block';
      const toggle = g.querySelector('.group-toggle'); if(toggle) toggle.innerHTML = next==='collapsed' ? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-down"></i>';
    });
  });
  document.getElementById('pagePrev')?.addEventListener('click', ()=>{ if(page>1){ page--; persistPrefs(); loadPaged(); }});
        if(!pillAddedFamilies.has(famKey)) pillAddedFamilies.add(famKey);
  document.getElementById('pageNext')?.addEventListener('click', ()=>{ page++; persistPrefs(); loadPaged(); });
  document.getElementById('pageInput')?.addEventListener('change', (e)=>{ const v=parseInt(e.target.value,10); if(!isNaN(v)&&v>0){ page=v; persistPrefs(); loadPaged(); }});
  document.getElementById('perPage')?.addEventListener('change', (e)=>{ perPage=parseInt(e.target.value,10)||100; page=1; persistPrefs(); loadPaged(); });
  els.btnExport?.addEventListener('click', exportCsv);
  els.btnExportSnapshot?.addEventListener('click', exportSnapshot);
  els.window?.addEventListener('change', ()=>{ loadSummary(); updateRecencyBars(); updateRecencyLegend(); });
  updateRecencyLegend();
  els.q?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); else renderActiveFilters(); });
  els.from?.addEventListener('change', ()=>{ renderActiveFilters(); loadFeed(); });
  els.to?.addEventListener('change', ()=>{ renderActiveFilters(); loadFeed(); });
  els.userId?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); else renderActiveFilters(); });
  els.moderatorId?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); else renderActiveFilters(); });
  els.channelId?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); else renderActiveFilters(); });
  // Simple autocomplete for user/mod/channel fields
  function attachAutocomplete(inputEl, endpoint){
    if (!inputEl) return;
    let dd;
    const ensureDd = () => { if (!dd){ dd = document.createElement('div'); dd.className = 'dropdown'; dd.style.position='absolute'; dd.style.zIndex=10; dd.style.background='var(--bg-elev)'; dd.style.border='1px solid var(--glass-border)'; dd.style.borderRadius='8px'; dd.style.minWidth = (inputEl.offsetWidth+"px"); document.body.appendChild(dd);} return dd; };
    const placeDd = () => { const r = inputEl.getBoundingClientRect(); dd.style.left = (window.scrollX + r.left)+"px"; dd.style.top = (window.scrollY + r.bottom + 4)+"px"; dd.style.minWidth = r.width+"px"; };
    const hide = () => { if(dd) dd.style.display='none'; };
    const show = () => { if(dd) dd.style.display='block'; };
    inputEl.addEventListener('input', async ()=>{
      const q = inputEl.value.trim(); if (!q || q.length < 2) { hide(); return; }
      try {
        const u = new URL(`/api/guild/${guildId}/search/${endpoint}`, window.location.origin); u.searchParams.set('q', q);
        const r = await fetch(u, { credentials: 'same-origin' }); const d = await r.json(); if(!d.success) throw new Error(d.error||'search_failed');
        const list = Array.isArray(d.results)? d.results: [];
        const el = ensureDd(); placeDd(); el.innerHTML = list.map(it => {
          if (endpoint==='members') return `<div class="dd-item" data-id="${it.id}"><span>${(it.nick? (escapeHtml(it.nick)+' • '):'')+escapeHtml(it.username)}</span> <small>${it.id}</small></div>`;
          return `<div class="dd-item" data-id="${it.id}"><span>#${escapeHtml(it.name||'')}</span> <small>${it.id}</small></div>`;
        }).join('');
        el.querySelectorAll('.dd-item').forEach(n=> n.addEventListener('click', ()=>{ inputEl.value = n.getAttribute('data-id'); hide(); loadFeed(); }));
        show();
      } catch(e){ hide(); }
    });
    inputEl.addEventListener('blur', ()=> setTimeout(hide, 200));
  }

  function exportSnapshot(){
    try {
      const feedHtml = els.feed ? els.feed.innerHTML : '';
      const doc = `<!DOCTYPE html><html lang=\"pt-PT\"><head><meta charset=\"utf-8\"/><title>Snapshot Feed Moderação</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif;background:#111;color:#eee;padding:24px}h1{font-size:1.2rem;margin:0 0 16px} .feed{max-width:1100px;margin:0 auto} .feed-item{border:1px solid #333;border-radius:10px;padding:12px 14px;margin:8px 0;background:#1b1b1f} .feed-date{margin-top:28px;font-weight:600;opacity:.8} .badge-soft{display:inline-block;background:#222;padding:2px 6px;border-radius:14px;font-size:.65rem;margin:2px 4px 2px 0} .feed-meta{font-size:.72rem;line-height:1.25;margin-top:4px} code{background:#222;padding:2px 4px;border-radius:4px}</style></head><body><h1>Snapshot Feed de Moderação</h1><div class=\"feed\">${feedHtml}</div></body></html>`;
      const blob = new Blob([doc], { type:'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `feed-snapshot-${Date.now()}.html`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),4000);
      notify('Snapshot exportado','success');
    } catch(e){ console.error(e); notify('Falha ao exportar snapshot','error'); }
  }
  attachAutocomplete(els.userId, 'members');
  attachAutocomplete(els.moderatorId, 'members');
  attachAutocomplete(els.channelId, 'channels');
  // Persist long pause threshold changes
  try {
    const lpInput = document.getElementById('longPauseMin');
    lpInput?.addEventListener('change', ()=>{
      const raw = parseInt(lpInput.value||'2', 10);
      const val = (!isNaN(raw) && raw>0) ? raw : 1;
      lpInput.value = String(val);
      localStorage.setItem('mod-long-pause-minutes', String(val));
      LONG_PAUSE_MS = val * 60 * 1000;
    });
  } catch {}
  els.filterButtons.forEach(btn=> btn.addEventListener('click', ()=>{
    els.filterButtons.forEach(b=> b.classList.remove('active'));
    btn.classList.add('active');
    currentFamily = btn.getAttribute('data-filter') || 'all';
    persistPrefs();
    renderActiveFilters();
    loadFeed();
  }));

  // Public API for socket-driven refreshes
  window.ModerationPage = {
    refresh: async () => { await loadSummary(); await loadFeed(); },
    handleLiveEvent: async (_payload) => {
      // If auto is ON, let existing debounced full refresh handle it
      if (els.btnAuto.getAttribute('aria-pressed') === 'true') return false;
      try {
        const u = new URL(`/api/guild/${guildId}/logs`, window.location.origin);
        u.searchParams.set('type', buildTypeParam());
        buildRange(u);
        u.searchParams.set('limit', '5');
        const r = await fetch(u, { credentials:'same-origin' });
        const d = await r.json();
        if (!r.ok || !d.success) return false;
        const list = Array.isArray(d.logs)? d.logs: [];
        if (!list.length) return true;
        if(!orderDesc){ list.reverse(); }
        const container = els.feed;
        const prevFirst = container.firstElementChild;
        // Find position after possible initial date header
        let inserted = 0;
        // Determine newest items not yet shown (by timestamp or id)
        const newer = orderDesc
          ? list.filter(it => !lastTopTs || (it.timestamp >= lastTopTs && it.id !== lastTopId))
          : list.filter(it => !lastTopTs || (it.timestamp <= lastTopTs && it.id !== lastTopId));
        if (!newer.length) return true;
        // Build HTML for newest first (reverse chronological in API already)
        // Insert from bottom of 'newer' to preserve order when prepending
        // Insert maintaining chosen order
        const sequence = orderDesc ? [...newer].reverse() : [...newer];
        for (const l of sequence){
          const grp = formatDateGroup(l.timestamp);
          let top = container.firstElementChild;
          let topIsHeader = top && top.classList.contains('feed-date');
          let topHeaderText = topIsHeader ? top.textContent.trim() : null;
          // Insert header if needed
          if (!topIsHeader || grp !== topHeaderText) {
            const header = document.createElement('div');
            header.className = 'feed-date';
            header.setAttribute('aria-label', grp);
            header.textContent = grp;
            container.insertBefore(header, container.firstElementChild || null);
            top = header; topIsHeader = true; topHeaderText = grp;
          }
          const wrapper = document.createElement('div');
          wrapper.innerHTML = renderCard(l);
          const node = wrapper.firstElementChild;
          // Insert after header when present
          if (topIsHeader) {
            container.insertBefore(node, top.nextSibling);
          } else {
            container.insertBefore(node, container.firstElementChild || null);
          }
          inserted++;
        }
        // If long pause since last append, insert a resume marker before previous first element
        const now = Date.now();
        if (prevFirst && lastLiveAppendTs && (now - lastLiveAppendTs) > LONG_PAUSE_MS) {
          const marker = document.createElement('div');
          marker.className = 'feed-marker';
          const t = new Date().toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' });
          marker.innerHTML = `<span>Retomar a partir daqui • ${t}</span>`;
          container.insertBefore(marker, prevFirst);
        }
        lastLiveAppendTs = now;
        // Reattach listeners for newly inserted nodes
        [...els.feed.querySelectorAll('[data-log-id]')].slice(0, inserted).forEach(btn => btn.addEventListener('click', (e) => {
          const el = e.currentTarget; el.setAttribute('aria-expanded', el.getAttribute('aria-expanded')==='true' ? 'false' : 'true'); if (e.detail === 2) openEventModal(el.getAttribute('data-log-id'));
        }));
        els.feed.querySelectorAll('.qa-btn')?.forEach(btn=>{
          if (btn.__qaBound) return; btn.__qaBound = true;
          btn.addEventListener('click', async (e)=>{
            e.stopPropagation();
            const action = btn.getAttribute('data-action');
            const logId = btn.getAttribute('data-log-id');
            try {
              btn.disabled = true;
              const payload = { action, logId };
              const userId = btn.getAttribute('data-user-id'); if (userId) payload.userId = userId;
              const durStr = btn.getAttribute('data-duration-seconds'); const dur = durStr? parseInt(durStr,10):NaN; if(!isNaN(dur)) payload.durationSeconds = dur;
              const dryResp = await postAction({ ...payload, dryRun:true });
              const ok = await showConfirmModal(dryResp, 'Confirmar ação rápida');
              if(!ok){ btn.disabled=false; return; }
              const apply = await postAction(payload);
              if (apply?.success){ notify('Ação aplicada','success'); await loadSummary(); }
            } catch(e){ console.error(e); notify(e.message,'error'); } finally { btn.disabled=false; }
          });
        });
        // Bind dismiss for newly inserted nodes as well
        els.feed.querySelectorAll('.dismiss-card')?.forEach(btn=>{
          if (btn.__dismissBound) return; btn.__dismissBound = true;
          btn.addEventListener('click', (e)=>{
            e.stopPropagation();
            const item = btn.closest('.feed-item');
            if (item) item.remove();
          });
        });
        // Mild highlight on new cards
        try {
          const newNodes = [...els.feed.querySelectorAll('[data-log-id]')].slice(0, inserted);
          newNodes.forEach(n => n.classList.add('feed-flash'));
          setTimeout(()=> newNodes.forEach(n => n.classList.remove('feed-flash')), 1100);
        } catch {}
        // Resolve chips to human-readable labels for newly inserted nodes
        try {
          const chips = [...els.feed.querySelectorAll('[data-filter-user],[data-filter-mod],[data-filter-channel]')].slice(0, inserted*3);
          chips.forEach(async chip => {
            if (chip.dataset.resolved === '1') return;
            if (chip.hasAttribute('data-filter-user') || chip.hasAttribute('data-filter-mod')){
              const id = chip.getAttribute('data-filter-user') || chip.getAttribute('data-filter-mod');
              const label = await resolveMemberLabel(id);
              if (label) {
                const icon = chip.hasAttribute('data-filter-user') ? 'fa-user' : 'fa-shield-alt';
                chip.innerHTML = `<i class="fas ${icon}"></i> ${escapeHtml(label)}`;
                chip.dataset.resolved = '1';
              }
            } else if (chip.hasAttribute('data-filter-channel')){
              const id = chip.getAttribute('data-filter-channel');
              const label = await resolveChannelLabel(id);
              if (label) {
                chip.innerHTML = `<i class=\"fas fa-hashtag\"></i> ${escapeHtml(label)}`;
                chip.dataset.resolved = '1';
              }
            }
          });
        } catch {}
        // Subtle in-page toast for new events (click to jump to newest area)
        try { showFeedToast(`${inserted} novo(s) evento(s)`, () => { try { els.feed?.scrollIntoView({ behavior:'smooth', block:'start' }); } catch {} }); } catch {}
        // Update head trackers
        lastTopId = list[0].id; lastTopTs = list[0].timestamp;
        return true;
      } catch { return false; }
    }
  };
  window.addEventListener('moderation:refresh', () => { window.ModerationPage.refresh(); });

  // Initial load
  restorePrefs();
  loadSummary();
  loadFeed();
  renderActiveFilters();
  refreshPresetSelect();
  document.getElementById('btnSavePreset')?.addEventListener('click', ()=>{
    const name = prompt('Nome do preset:');
    if(!name) return;
    const presets = loadPresets();
    presets[name] = captureCurrentFilterState();
    savePresets(presets);
    refreshPresetSelect();
    notify('Preset guardado','success');
  });
  document.getElementById('btnDeletePreset')?.addEventListener('click', ()=>{
    const sel = document.getElementById('presetSelect');
    if(!sel || !sel.value) return;
    const presets = loadPresets();
    if(!presets[sel.value]) return;
    if(!confirm('Apagar preset "'+sel.value+'"?')) return;
    delete presets[sel.value];
    savePresets(presets);
    refreshPresetSelect();
    notify('Preset removido','success');
  });
  document.getElementById('presetSelect')?.addEventListener('change', (e)=>{
    const v = e.target.value; if(!v) return; const presets = loadPresets(); if(presets[v]) applyFilterState(presets[v]);
  });

  // In-page subtle toast in feed area
  function showFeedToast(msg, onClick){
    try {
      const host = els.feed;
      if (!host) return;
      const toast = document.createElement('div');
      toast.className = 'feed-toast';
      toast.innerHTML = `<i class="fas fa-bell"></i> <span>${escapeHtml(msg)}</span>`;
      host.insertBefore(toast, host.firstChild);
      if (typeof onClick === 'function') { toast.style.cursor='pointer'; toast.addEventListener('click', onClick); }
      setTimeout(()=>{
        toast.style.opacity = '0.0'; toast.style.transition = 'opacity .4s ease';
        setTimeout(()=> toast.remove(), 450);
      }, 2200);
    } catch {}
  }
  // UX: Close modal on ESC and overlay background click
  try {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isModalVisible()) closeModal();
    });
    els.modal?.addEventListener('click', (e) => {
      if (e.target === els.modal) closeModal();
    });
  } catch {}
  // Hierarchy quick tools
  async function postAction(body){
    const r = await fetch(`/api/guild/${guildId}/moderation/action`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(body) });
    const d = await r.json(); if(!r.ok || !d.success) throw new Error(d.error||`HTTP ${r.status}`); return d;
  }
  async function confirmPlan(plan, title){
    // Use modal-based confirmation everywhere
    return await showConfirmModal(plan, title || 'Confirmar alterações');
  }
  const roleUp = document.getElementById('btnRoleUp');
  const roleDown = document.getElementById('btnRoleDown');
  const chanUp = document.getElementById('btnChanUp');
  const chanDown = document.getElementById('btnChanDown');
  const moveToCat = document.getElementById('btnMoveToCategory');
  function bool(id){ return !!document.getElementById(id)?.checked; }
  // Restore persisted state for hierarchy dry run
  try {
    const hierDry = document.getElementById('hierDryRun');
    const val = localStorage.getItem('mod-hier-dryrun');
    if (hierDry && (val === 'true' || val === 'false')) hierDry.checked = (val === 'true');
    hierDry?.addEventListener('change', ()=>{ localStorage.setItem('mod-hier-dryrun', hierDry.checked ? 'true':'false'); });
  } catch {}
  roleUp?.addEventListener('click', async()=>{
    try{ const roleId=(document.getElementById('roleIdQuick')?.value||'').trim(); if(!roleId) return notify('ID do cargo em falta','error'); const steps=parseInt(document.getElementById('roleSteps')?.value||'1',10)||1; const dry=bool('hierDryRun'); const payload={ action:'move_role_up', roleId, steps }; if(dry) payload.dryRun=true; const resp=await postAction(payload); if(dry){ const ok=await confirmPlan(resp, 'Confirmar mover cargo'); if(!ok) return; const resp2=await postAction({ action:'move_role_up', roleId, steps }); if(resp2.success) { notify('Cargo movido','success'); closeModal(); } } else { notify('Cargo movido','success'); } }catch(e){ notify(e.message,'error'); }
  });
  roleDown?.addEventListener('click', async()=>{
    try{ const roleId=(document.getElementById('roleIdQuick')?.value||'').trim(); if(!roleId) return notify('ID do cargo em falta','error'); const steps=parseInt(document.getElementById('roleSteps')?.value||'1',10)||1; const dry=bool('hierDryRun'); const payload={ action:'move_role_down', roleId, steps }; if(dry) payload.dryRun=true; const resp=await postAction(payload); if(dry){ const ok=await confirmPlan(resp, 'Confirmar mover cargo'); if(!ok) return; const resp2=await postAction({ action:'move_role_down', roleId, steps }); if(resp2.success) { notify('Cargo movido','success'); closeModal(); } } else { notify('Cargo movido','success'); } }catch(e){ notify(e.message,'error'); }
  });
  chanUp?.addEventListener('click', async()=>{
    try{ const channelId=(document.getElementById('channelIdQuick')?.value||'').trim(); if(!channelId) return notify('ID do canal em falta','error'); const steps=parseInt(document.getElementById('channelSteps')?.value||'1',10)||1; const dry=bool('hierDryRun'); const payload={ action:'move_channel_up', channelId, steps }; if(dry) payload.dryRun=true; const resp=await postAction(payload); if(dry){ const ok=await confirmPlan(resp, 'Confirmar mover canal'); if(!ok) return; const resp2=await postAction({ action:'move_channel_up', channelId, steps }); if(resp2.success) { notify('Canal movido','success'); closeModal(); } } else { notify('Canal movido','success'); } }catch(e){ notify(e.message,'error'); }
  });
  chanDown?.addEventListener('click', async()=>{
    try{ const channelId=(document.getElementById('channelIdQuick')?.value||'').trim(); if(!channelId) return notify('ID do canal em falta','error'); const steps=parseInt(document.getElementById('channelSteps')?.value||'1',10)||1; const dry=bool('hierDryRun'); const payload={ action:'move_channel_down', channelId, steps }; if(dry) payload.dryRun=true; const resp=await postAction(payload); if(dry){ const ok=await confirmPlan(resp, 'Confirmar mover canal'); if(!ok) return; const resp2=await postAction({ action:'move_channel_down', channelId, steps }); if(resp2.success) { notify('Canal movido','success'); closeModal(); } } else { notify('Canal movido','success'); } }catch(e){ notify(e.message,'error'); }
  });
  moveToCat?.addEventListener('click', async()=>{
    try{ const channelId=(document.getElementById('channelIdQuick')?.value||'').trim(); if(!channelId) return notify('ID do canal em falta','error'); const parentId=(document.getElementById('channelToCategory')?.value||'').trim(); const dry=bool('hierDryRun'); const payload={ action:'move_channel_to_category', channelId, parentId: parentId||null }; if(dry) payload.dryRun=true; const resp=await postAction(payload); if(dry){ const ok=await confirmPlan(resp, 'Confirmar mover canal para categoria'); if(!ok) return; const resp2=await postAction({ action:'move_channel_to_category', channelId, parentId: parentId||null }); if(resp2.success) { notify('Canal movido para categoria','success'); closeModal(); } } else { notify('Canal movido para categoria','success'); } }catch(e){ notify(e.message,'error'); }
  });
})();
