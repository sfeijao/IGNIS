(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const els = {
    status: document.getElementById('fStatus'),
    priority: document.getElementById('fPriority'),
    from: document.getElementById('fFrom'),
    to: document.getElementById('fTo'),
    role: document.getElementById('fRole'),
    category: document.getElementById('fCategory'),
    assigned: document.getElementById('fAssigned'),
  staffOnly: document.getElementById('fStaffOnly'),
    q: document.getElementById('fQuery'),
    apply: document.getElementById('btnApply'),
    reset: document.getElementById('btnReset'),
    copyLink: document.getElementById('btnCopyLink'),
    pageSize: document.getElementById('pageSize'),
    stats: document.getElementById('stats'),
    list: document.getElementById('ticketsList'),
    pager: document.getElementById('pagination'),
    exportCsv: document.getElementById('btnExportCsv'),
    exportJson: document.getElementById('btnExportJson'),
  };

  let page = 1;
  let loading = false;
  let debounceTimer;
  let suggestTimer;

  function notify(msg, type='info') {
    const div = document.createElement('div');
    div.className = `notification notification-${type} slide-up`;
    div.innerHTML = `<i class="fas ${type==='error'?'fa-exclamation-circle': type==='success'? 'fa-check-circle':'fa-info-circle'}"></i><span>${msg}</span>`;
    document.body.appendChild(div);
    setTimeout(() => { div.style.animation = 'slideDown 0.3s ease-in'; setTimeout(() => div.remove(), 300); }, 2500);
  }

  function buildUrl(pageOverride){
    const u = new URL(`/api/guild/${guildId}/tickets`, window.location.origin);
    const status = (els.status?.value||'').trim(); if (status) u.searchParams.set('status', status);
    const priority = (els.priority?.value||'').trim(); if (priority) u.searchParams.set('priority', priority);
    const from = (els.from?.value||'').trim(); if (from) u.searchParams.set('from', from);
    const to = (els.to?.value||'').trim(); if (to) u.searchParams.set('to', to);
    const q = (els.q?.value||'').trim(); if (q) u.searchParams.set('q', q);
    const category = (els.category?.value||'').trim(); if (category) u.searchParams.set('category', category);
    const assigned = (els.assigned?.value||'').trim(); if (assigned) u.searchParams.set('assigned', assigned);
    const role = (els.role?.value||'').trim(); if (role) u.searchParams.set('role', role); else u.searchParams.delete('role');
    const staffOnly = !!els.staffOnly?.checked; if (staffOnly) u.searchParams.set('staffOnly','true'); else u.searchParams.delete('staffOnly');
    const ps = parseInt(els.pageSize?.value||'20',10); u.searchParams.set('pageSize', String(ps));
    u.searchParams.set('page', String(pageOverride ?? page));
    return u.toString();
  }

  function syncUrlBar(pageOverride){
    // Keep page path, update query with guildId and filters including role
    const cur = new URL(window.location.href);
    const q = new URLSearchParams(cur.search);
    if (guildId) q.set('guildId', guildId);
    const role = (els.role?.value||'').trim(); if (role) q.set('role', role); else q.delete('role');
    const status = (els.status?.value||'').trim(); if (status) q.set('status', status); else q.delete('status');
    const priority = (els.priority?.value||'').trim(); if (priority) q.set('priority', priority); else q.delete('priority');
    const from = (els.from?.value||'').trim(); if (from) q.set('from', from); else q.delete('from');
    const to = (els.to?.value||'').trim(); if (to) q.set('to', to); else q.delete('to');
    const query = (els.q?.value||'').trim(); if (query) q.set('q', query); else q.delete('q');
    const category = (els.category?.value||'').trim(); if (category) q.set('category', category); else q.delete('category');
    const assigned = (els.assigned?.value||'').trim(); if (assigned) q.set('assigned', assigned); else q.delete('assigned');
    const staffOnly = !!els.staffOnly?.checked; if (staffOnly) q.set('staffOnly','true'); else q.delete('staffOnly');
    const ps = parseInt(els.pageSize?.value||'20',10); q.set('pageSize', String(ps));
    q.set('page', String(pageOverride ?? page));
    const nextUrl = `${cur.pathname}?${q.toString()}`;
    window.history.replaceState(null, '', nextUrl);
  }

  async function fetchTickets() {
    if (!guildId) { notify('guildId em falta', 'error'); return; }
    if (loading) return;
    loading = true;
    els.list.innerHTML = `<div class="loading"><span class="loading-spinner"></span> A carregar...</div>`;
    try {
      const res = await fetch(buildUrl(), { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      renderStats(data.stats||{});
      renderList(data.tickets||[]);
      renderPager(data.pagination||{page:1,pageSize:20,total:0,totalPages:1});
      syncUrlBar();
    } catch (e) {
      console.error(e); notify(e.message, 'error');
      els.list.innerHTML = `<div class="no-tickets">Erro ao carregar tickets</div>`;
    } finally {
      loading = false;
    }
  }

  async function loadRoles(){
    try {
      if (!guildId || !els.role) return;
      const res = await fetch(`/api/guild/${guildId}/roles`, { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      const roles = [{ id:'', name:'Todos os cargos' }, ...(data.roles||[])];
      els.role.innerHTML = roles.map(r => `<option value="${r.id}">${escapeHtml(r.name||'Cargo')}</option>`).join('');
      // Restore from URL if present
      const initialRole = params.get('role') || '';
      if (initialRole && roles.some(r => `${r.id}` === `${initialRole}`)) {
        els.role.value = initialRole;
      }
    } catch (e) {
      console.error('Falha ao carregar cargos', e);
      if (els.role) els.role.innerHTML = `<option value="">(cargos indisponíveis)</option>`;
    }
  }

  function renderStats(stats){
    const { total=0, open=0, claimed=0, pending=0, closed=0 } = stats;
    els.stats.innerHTML = `
      <div class="badge stat"><i class="fas fa-hashtag"></i> Total: <strong>${total}</strong></div>
      <div class="badge stat"><i class="fas fa-door-open"></i> Abertos: <strong style="color:#60A5FA">${open}</strong></div>
      <div class="badge stat"><i class="fas fa-hand"></i> Reclamados: <strong style="color:#F59E0B">${claimed}</strong></div>
      <div class="badge stat"><i class="fas fa-clock"></i> Pendentes: <strong style="color:#A78BFA">${pending}</strong></div>
      <div class="badge stat"><i class="fas fa-check"></i> Fechados: <strong style="color:#10B981">${closed}</strong></div>
    `;
  }

  function renderList(items){
    if (!items.length) { els.list.innerHTML = `<div class="no-tickets">Sem resultados</div>`; return; }
    const html = items.map(t => {
      const statusColor = t.status==='closed' ? '#10B981' : t.status==='claimed' ? '#F59E0B' : t.status==='pending' ? '#A78BFA' : '#60A5FA';
      return `
        <div class="ticket-item">
          <div class="ticket-head">
            <div class="ticket-meta">
              <span class="ticket-id">#${t.id}</span>
              <span style="color:${statusColor}"><i class="fas fa-circle"></i> ${t.status||'-'}</span>
              <span><i class="fas fa-bolt"></i> ${t.priority||'normal'}</span>
              <span><i class="fas fa-user"></i> ${t.ownerTag||t.user_id}</span>
              ${t.claimedByTag ? `<span><i class=\"fas fa-hand\"></i> ${t.claimedByTag}</span>` : ''}
              <span><i class="fas fa-clock"></i> ${t.timeAgo||''}</span>
            </div>
            <div>
              <a class="btn btn-glass btn-sm" href="/ticket.html?guildId=${encodeURIComponent(guildId)}&ticketId=${encodeURIComponent(t.id)}"><i class="fas fa-eye"></i> Ver</a>
            </div>
          </div>
          <div class="ticket-body">
            <div class="ticket-meta">
              <span><i class="fas fa-hashtag"></i> Canal: ${t.channelName||t.channel_id}</span>
              ${t.subject ? `<span><i class=\"fas fa-tag\"></i> ${t.subject}</span>` : ''}
              ${t.category ? `<span><i class=\"fas fa-folder\"></i> ${t.category}</span>` : ''}
            </div>
            ${t.description ? `<div class="text-secondary" style="margin-top:6px">${escapeHtml(t.description).slice(0,240)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    els.list.innerHTML = html;
  }

  function renderPager(p){
    const { page:pg=1, pageSize=20, total=0, totalPages=1 } = p||{};
    page = pg;
    const prevDisabled = pg<=1 ? 'disabled' : '';
    const nextDisabled = pg>=totalPages ? 'disabled' : '';
    els.pager.innerHTML = `
      <button class="btn btn-glass" ${prevDisabled} data-nav="prev"><i class="fas fa-angle-left"></i></button>
      <span>Página <strong>${pg}</strong> de <strong>${totalPages}</strong> • ${total} resultados</span>
      <button class="btn btn-glass" ${nextDisabled} data-nav="next"><i class="fas fa-angle-right"></i></button>
    `;
    els.pager.querySelector('[data-nav="prev"]').onclick = () => { if (page>1) { page--; fetchTickets(); } };
    els.pager.querySelector('[data-nav="next"]').onclick = () => { if (page<totalPages) { page++; fetchTickets(); } };
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c));
  }

  function debouncedSearch(){
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { page = 1; fetchTickets(); }, 350);
  }

  function resetFilters(){
    if (els.status) els.status.value = '';
    if (els.priority) els.priority.value = '';
    if (els.from) els.from.value = '';
    if (els.to) els.to.value = '';
    if (els.q) els.q.value = '';
    page = 1;
    fetchTickets();
  }

  function exportCurrent(format){
    const url = new URL(`/api/guild/${guildId}/tickets/export`, window.location.origin);
    const status = (els.status?.value||'').trim(); if (status) url.searchParams.set('status', status);
    const priority = (els.priority?.value||'').trim(); if (priority) url.searchParams.set('priority', priority);
    const from = (els.from?.value||'').trim(); if (from) url.searchParams.set('from', from);
    const to = (els.to?.value||'').trim(); if (to) url.searchParams.set('to', to);
    const q = (els.q?.value||'').trim(); if (q) url.searchParams.set('q', q);
    const category = (els.category?.value||'').trim(); if (category) url.searchParams.set('category', category);
    const assigned = (els.assigned?.value||'').trim(); if (assigned) url.searchParams.set('assigned', assigned);
    const role = (els.role?.value||'').trim(); if (role) url.searchParams.set('role', role);
    const staffOnly = !!els.staffOnly?.checked; if (staffOnly) url.searchParams.set('staffOnly','true');
    url.searchParams.set('cap','1000');
    url.searchParams.set('format', format === 'csv' ? 'csv' : 'json');
    // Trigger download directly
    window.location.href = url.toString();
  }

  function downloadFile(filename, mime, content){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function initEvents(){
    els.apply?.addEventListener('click', () => { page = 1; fetchTickets(); });
    els.reset?.addEventListener('click', resetFilters);
    els.q?.addEventListener('input', debouncedSearch);
    els.status?.addEventListener('change', () => { page = 1; fetchTickets(); });
    els.priority?.addEventListener('change', () => { page = 1; fetchTickets(); });
    els.from?.addEventListener('change', () => { page = 1; fetchTickets(); });
    els.to?.addEventListener('change', () => { page = 1; fetchTickets(); });
    els.role?.addEventListener('change', () => {
      // Update URL and retrigger suggestions for assigned based on new role filter
      syncUrlBar(1);
      const val = (els.assigned?.value||'').trim();
      if (val.length >= 2 && val.toLowerCase() !== 'me') fetchAssignedSuggestions(val);
    });
    els.category?.addEventListener('change', () => { page = 1; fetchTickets(); });
    els.assigned?.addEventListener('change', () => { page = 1; fetchTickets(); });
  els.staffOnly?.addEventListener('change', () => { page = 1; fetchTickets(); });
    // Typeahead for assigned: query members when typing >=2 chars
    els.assigned?.addEventListener('input', () => {
      const val = (els.assigned?.value||'').trim();
      clearTimeout(suggestTimer);
      if (val.length < 2 || val.toLowerCase() === 'me') { populateAssigned([]); return; }
      suggestTimer = setTimeout(() => fetchAssignedSuggestions(val), 250);
    });
    els.pageSize?.addEventListener('change', () => { page = 1; fetchTickets(); });
    els.exportCsv?.addEventListener('click', () => exportCurrent('csv'));
    els.exportJson?.addEventListener('click', () => exportCurrent('json'));
    els.copyLink?.addEventListener('click', () => {
      // Build fully qualified link including current filters; ensure guildId present
      const cur = new URL(window.location.href);
      const base = `${cur.origin}${cur.pathname}`;
      const q = new URLSearchParams(cur.search);
      if (guildId) q.set('guildId', guildId);
      const role = (els.role?.value||'').trim(); if (role) q.set('role', role); else q.delete('role');
      const status = (els.status?.value||'').trim(); if (status) q.set('status', status); else q.delete('status');
      const priority = (els.priority?.value||'').trim(); if (priority) q.set('priority', priority); else q.delete('priority');
      const from = (els.from?.value||'').trim(); if (from) q.set('from', from); else q.delete('from');
      const to = (els.to?.value||'').trim(); if (to) q.set('to', to); else q.delete('to');
      const query = (els.q?.value||'').trim(); if (query) q.set('q', query); else q.delete('q');
      const category = (els.category?.value||'').trim(); if (category) q.set('category', category); else q.delete('category');
      const assigned = (els.assigned?.value||'').trim(); if (assigned) q.set('assigned', assigned); else q.delete('assigned');
      const staffOnly = !!els.staffOnly?.checked; if (staffOnly) q.set('staffOnly','true'); else q.delete('staffOnly');
      const ps = parseInt(els.pageSize?.value||'20',10); q.set('pageSize', String(ps));
      q.set('page', '1');
      const url = `${base}?${q.toString()}`;
      navigator.clipboard.writeText(url).then(() => notify('Link copiado!','success')).catch(() => notify('Não foi possível copiar o link','error'));
    });
  }

  async function fetchAssignedSuggestions(q){
    try {
      const url = new URL(`/api/guild/${guildId}/members/search`, window.location.origin);
      url.searchParams.set('q', q);
      url.searchParams.set('limit', '10');
      const roleId = (els.role?.value||'').trim(); if (roleId) url.searchParams.set('roleId', roleId);
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      populateAssigned(data.members||[]);
    } catch (e) {
      console.error('suggestions failed', e);
      populateAssigned([]);
    }
  }

  function populateAssigned(members){
    const dl = document.getElementById('assignedList');
    if (!dl) return;
    dl.innerHTML = '';
    for (const m of members) {
      const opt = document.createElement('option');
      opt.value = m.id; // selecting should use the ID
      opt.label = `${m.tag} — ${m.id}`;
      dl.appendChild(opt);
    }
  }

  // Load user for navbar
  (async () => {
    try {
      const r = await fetch('/api/user', { credentials: 'same-origin' });
      const d = await r.json();
      if (d?.success && d.user) {
        const u = d.user;
        const avatar = document.getElementById('userAvatar');
        const name = document.getElementById('userName');
        if (avatar && u.avatar) avatar.src = u.avatar; 
        if (name) name.textContent = u.username;
      }
    } catch {}
  })();

  initEvents();
  // Restore staffOnly from URL early
  (function(){
    const staffOnlyParam = (params.get('staffOnly')||'').toLowerCase();
    if (els.staffOnly) els.staffOnly.checked = (staffOnlyParam === 'true' || staffOnlyParam === '1');
  })();
  loadRoles().then(() => {
    // If role came from URL but not present in roles list, keep it in URL anyway
    const roleParam = params.get('role');
    if (roleParam && els.role && !Array.from(els.role.options).some(o => `${o.value}` === `${roleParam}`)) {
      els.role.value = '';
      syncUrlBar(1);
    }
  });
  fetchTickets();
})();
