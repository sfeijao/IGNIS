// IGNIS Website Dashboard Controller
// Handles navigation (#/servers, #/home), loads user & guilds, updates stats, and binds ticket actions

(function(){
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));
  const setText = (sel, text) => { const el = qs(sel); if (el) el.textContent = text; };

  const views = {
    servers: qs('#view-servers'),
    home: qs('#view-home'),
    ticketsConfig: qs('#view-tickets-config')
  };

  let currentGuild = null;
  let guildsCache = [];
  let serverScrollY = 0;

  const SELECTED_GUILD_KEY = 'ignis:selectedGuildId';
  const SEARCH_KEY = 'ignis:serverSearch';
  const SORT_KEY = 'ignis:serverSort';

  function mountLayout(){
    const navbarMount = qs('#app-navbar');
    const footerMount = qs('#app-footer');
    if (navbarMount && window.IGNISComponents){
      navbarMount.innerHTML = '';
      const nav = window.IGNISComponents.createNavbar({ username: 'Utilizador', logoutHref: '/logout' });
      navbarMount.appendChild(nav);
    }
    if (footerMount && window.IGNISComponents){
      footerMount.innerHTML = '';
      footerMount.appendChild(window.IGNISComponents.createFooter());
    }
  }

  function showView(name){
    Object.values(views).forEach(v => v && (v.hidden = true));
    if (views[name]) views[name].hidden = false;
  }

  function route(){
    const hash = location.hash || '#/home';
    if (hash.startsWith('#/servers')){
      // restore scroll and focus search on /
      showView('servers');
      if (!guildsCache.length) loadGuilds();
      try {
        const input = qs('#server-search');
        const saved = localStorage.getItem(SEARCH_KEY) || '';
        const savedSort = localStorage.getItem(SORT_KEY) || 'name-asc';
        if (input && input.value !== saved){ input.value = saved; }
        const sortSel = qs('#server-sort'); if (sortSel) sortSel.value = savedSort;
        applyFilterAndSort();
        window.scrollTo({ top: serverScrollY, behavior: 'instant' });
      } catch{}
    } else if (hash.startsWith('#/tickets-config')){
      showView('ticketsConfig');
      // ensure a guild is selected
      if (!currentGuild) autoPickGuild();
      // Load form lists and state
      initTicketsConfig();
    } else {
      showView('home');
      serverScrollY = window.scrollY;
      if (!currentGuild) autoPickGuild();
    }
  // Close mobile menu on navigation (ensures overlay/body scroll reset)
  if (window.IGNISNav && window.IGNISNav.isOpen()) window.IGNISNav.close();
  }

  async function loadUser(){
    try{
      const res = await fetch('/api/user');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success){
        setText('#userName', data.user?.username ?? 'Utilizador');
      }
    }catch{}
  }

  function renderServers(list){
    const grid = qs('#server-grid');
    const empty = qs('#server-empty');
    const count = qs('#server-count');
    if (!grid) return;
    grid.setAttribute('aria-busy','true');
    grid.innerHTML = '';
    list.forEach(g => {
      const card = document.createElement('button');
      card.className = 'server-card';
      card.setAttribute('role','listitem');
      card.setAttribute('aria-label', `Abrir ${g.name}`);

      const avatar = document.createElement('div');
      avatar.className = 'server-avatar';
      if (g.iconURL){
        const img = document.createElement('img');
        img.src = g.iconURL; img.alt = '';
        img.width = 44; img.height = 44; img.style.borderRadius = '50%';
        avatar.textContent = '';
        avatar.appendChild(img);
      } else {
        avatar.textContent = (g.name || '?').slice(0,2).toUpperCase();
      }

      const meta = document.createElement('div');
      meta.className = 'server-meta';
  const name = document.createElement('div');
  name.className = 'server-name'; name.innerHTML = highlight(g.name);
      const count = document.createElement('div');
      count.className = 'server-count'; count.textContent = `${g.memberCount ?? '—'} membros`;
      meta.append(name, count);

      card.append(avatar, meta);
      card.addEventListener('click', () => selectGuild(g));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectGuild(g); }});
      grid.appendChild(card);
    });
    grid.removeAttribute('aria-busy');
    if (empty){ empty.hidden = list.length !== 0; }
    if (count){ count.textContent = `${list.length} resultado${list.length===1?'':'s'}`; }
  }

  async function loadGuilds(){
    try{
      renderServerSkeletons();
      const res = await fetch('/api/guilds');
      if (!res.ok) throw new Error('Falha ao carregar servidores');
      const data = await res.json();
      guildsCache = data.guilds || [];
      renderServers(applyFilterAndSort());
      setupServerSearch();
      // If we have a persisted selection, restore it
      const persisted = localStorage.getItem(SELECTED_GUILD_KEY);
      if (persisted){
        const found = guildsCache.find(g => String(g.id) === String(persisted));
        if (found){
          selectGuild(found);
          return;
        }
      }
    }catch(e){
      const empty = qs('#server-empty');
      if (empty) empty.hidden = false;
      window.IGNISToast?.show({ title:'Erro a carregar', message: e?.message || 'Não foi possível obter a lista de servidores.', type:'error' });
    }
  }

  function setupServerSearch(){
    const input = qs('#server-search');
    const reload = qs('#server-reload');
    if (reload){ reload.addEventListener('click', () => loadGuilds()); }
    if (!input) return;
    const sortSel = qs('#server-sort');
    const doApply = () => renderServers(applyFilterAndSort());
    input.addEventListener('input', () => { try{ localStorage.setItem(SEARCH_KEY, input.value); }catch{} doApply(); });
    if (sortSel){ sortSel.addEventListener('change', () => { try{ localStorage.setItem(SORT_KEY, sortSel.value);}catch{} doApply(); }); }
  }

  function applyFilterAndSort(){
    const input = qs('#server-search');
    const sortSel = qs('#server-sort');
    const query = (input?.value || '').trim().toLowerCase();
    const sort = sortSel?.value || 'name-asc';
    let list = guildsCache;
    if (query){ list = list.filter(g => (g.name||'').toLowerCase().includes(query)); }
    const byName = (a,b)=> (a.name||'').localeCompare(b.name||'', undefined, { sensitivity:'base' });
    const byMembers = (a,b)=> (b.memberCount||0) - (a.memberCount||0);
    if (sort === 'name-asc') list = list.slice().sort(byName);
    else if (sort === 'name-desc') list = list.slice().sort((a,b)=> byName(b,a));
    else if (sort === 'members-desc') list = list.slice().sort(byMembers);
    else if (sort === 'members-asc') list = list.slice().sort((a,b)=> -byMembers(a,b));
    return list;
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c])); }
  function highlight(text){
    const input = qs('#server-search');
    const q = (input?.value||'').trim();
    if (!q) return escapeHtml(text);
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return escapeHtml(text);
    const before = escapeHtml(text.slice(0, idx));
    const match = escapeHtml(text.slice(idx, idx+q.length));
    const after = escapeHtml(text.slice(idx+q.length));
    return `${before}<span class="hl">${match}</span>${after}`;
  }

  function renderServerSkeletons(count=6){
    const grid = qs('#server-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for(let i=0;i<count;i++){
      const wrap = document.createElement('div');
      wrap.className = 'server-card skeleton';
      const av = document.createElement('div'); av.className = 'skeleton-avatar';
      const lines = document.createElement('div'); lines.className = 'skeleton-lines';
      const l1 = document.createElement('div'); l1.className = 'skeleton-line'; l1.style.width = '50%';
      const l2 = document.createElement('div'); l2.className = 'skeleton-line'; l2.style.width = '30%';
      lines.append(l1,l2);
      wrap.append(av, lines);
      grid.appendChild(wrap);
    }
  }

  function autoPickGuild(){
    if (guildsCache.length){
      // prefer persisted if available
      const persisted = localStorage.getItem(SELECTED_GUILD_KEY);
      const candidate = persisted ? guildsCache.find(g => String(g.id) === String(persisted)) : null;
      selectGuild(candidate || guildsCache[0]);
    } else {
      // try fetch once to populate then pick first
      loadGuilds().then(()=>{ if (guildsCache.length) selectGuild(guildsCache[0]); });
    }
  }

  async function selectGuild(g){
    currentGuild = g;
    setText('[data-guild-name]', g.name);
    location.hash = '#/home';
    try{ document.title = `Central • ${g.name} – IGNIS`; }catch{}
    try{ localStorage.setItem(SELECTED_GUILD_KEY, String(g.id)); }catch{}
    const pills = qs('.pills'); if (pills) pills.setAttribute('aria-busy','true');
    // Start pill skeletons
    window.IGNISPills?.setSkeleton(true);
    renderCardsSkeletons(true);
    await updateStats();
    await updateTicketsStatus();
    if (pills) pills.removeAttribute('aria-busy');
    // Stop pill skeletons
    window.IGNISPills?.setSkeleton(false);
    renderCardsSkeletons(false);
    // If currently on tickets-config view, reload its data for the new guild
    if (!views.ticketsConfig?.hidden){ initTicketsConfig(true); }
    // Rewire admin quick-links to include guildId context
    try{
      const links = Array.from(document.querySelectorAll('.cards-admin .card .card-link'));
      links.forEach(a => {
        const url = new URL(a.getAttribute('href'), location.origin);
        if (!url.pathname.startsWith('/dashboard/')) return; // only classic modules
        url.searchParams.set('guildId', String(g.id));
        a.setAttribute('href', url.toString());
      });
    }catch{}
  }

  // ================= Tickets Config (SPA) =================
  function notifyToast(title, message, type='success'){
    window.IGNISToast?.show({ title, message, type });
  }
  async function api(path, opts){
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...(opts||{}) });
    const json = await res.json().catch(()=>({}));
    if (!res.ok || json.success === false) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }
  function elsTC(){
    return {
      panel: qs('#tc_panelChannel'),
      cat: qs('#tc_ticketsCategory'),
      logs: qs('#tc_logsChannel'),
      roles: qs('#tc_accessRoles'),
      tmpl: qs('#tc_defaultTemplate'),
      theme: qs('#tc_theme'),
      color: qs('#tc_embedColor'),
      msg: qs('#tc_welcomeMsg'),
      btnSave: qs('#tc_btnSave'),
      btnPrev: qs('#tc_btnPreview'),
      btnPub: qs('#tc_btnPublish'),
      newCat: qs('#tc_newCategoryName'),
      btnCreateCat: qs('#tc_btnCreateCategory'),
      prevWrap: qs('#tc_preview'),
      prevBody: qs('#tc_previewBody')
    };
  }
  async function loadLists(){
    if (!currentGuild?.id) return;
    const gid = currentGuild.id;
    const [channelsR, catsR, rolesR] = await Promise.allSettled([
      api(`/api/guild/${gid}/channels`),
      api(`/api/guild/${gid}/categories`),
      api(`/api/guild/${gid}/roles`)
    ]);
    const channels = channelsR.status==='fulfilled' ? (channelsR.value.channels||[]) : [];
    const cats = catsR.status==='fulfilled' ? (catsR.value.categories||[]) : [];
    const roles = rolesR.status==='fulfilled' ? (rolesR.value.roles||[]) : [];
    const el = elsTC();
    if (el.panel) el.panel.innerHTML = `<option value="">— Selecionar canal —</option>` + channels.map(c=>`<option value="${c.id}">${c.name||c.id}</option>`).join('');
    if (el.cat) el.cat.innerHTML = `<option value="">— Sem categoria —</option>` + cats.map(c=>`<option value="${c.id}">${c.name||c.id}</option>`).join('');
    if (el.logs) el.logs.innerHTML = `<option value="">— Sem logs —</option>` + channels.map(c=>`<option value="${c.id}">${c.name||c.id}</option>`).join('');
    if (el.roles) el.roles.innerHTML = roles.map(r=>`<option value="${r.id}">${r.name||r.id}</option>`).join('');
  }
  async function loadConfig(){
    const gid = currentGuild?.id; if (!gid) return;
    const el = elsTC();
    const d = await api(`/api/guild/${gid}/tickets/config`).catch(()=>({config:{}}));
    const t = d?.config?.tickets || {};
    if (el.panel) el.panel.value = t.panelChannelId || '';
    if (el.cat) el.cat.value = t.ticketsCategoryId || '';
    if (el.logs) el.logs.value = t.logsChannelId || '';
    if (el.tmpl) el.tmpl.value = ['classic','compact','premium','minimal'].includes(t.defaultTemplate) ? t.defaultTemplate : 'classic';
  if (el.theme) el.theme.value = 'dark';
  if (el.color) el.color.value = '';
    if (el.msg) el.msg.value = t.welcomeMsg || 'Olá {user}, obrigado por abrir o ticket #{ticket_id}!';
    if (el.roles && Array.isArray(t.accessRoleIds)){
      Array.from(el.roles.options).forEach(o => { o.selected = t.accessRoleIds.includes(o.value); });
    }
  }
  function buildPanelModel(tmpl){
    const t = tmpl || 'classic';
    const model = { title:'', desc:'', fields:[], buttons:[] };
    if (t==='compact'){
      model.title='🎫 Tickets • Compacto';
      model.desc='Escolhe abaixo e abre um ticket privado.';
      model.buttons=[{label:'Suporte',emoji:'🎫',style:'primary'},{label:'Problema',emoji:'⚠️',style:'danger'}];
    } else if (t==='minimal'){
      model.title='🎫 Abrir ticket';
      model.desc='Carrega num botão para abrir um ticket.';
      model.buttons=[{label:'Abrir Ticket',emoji:'🎟️',style:'primary'}];
    } else if (t==='premium'){
      model.title='🎫 Centro de Suporte • Premium';
      model.desc='Serviço prioritário, acompanhamento dedicado e histórico guardado.';
      model.fields=[{name:'• Resposta express',value:'Prioridade máxima'},{name:'• Privado & seguro',value:'Só tu e equipa'},{name:'• Transcript',value:'Disponível a pedido'}];
      model.buttons=[{label:'VIP / Premium',emoji:'👑',style:'success'},{label:'Suporte Técnico',emoji:'🔧',style:'primary'},{label:'Reportar Problema',emoji:'⚠️',style:'danger'},{label:'Moderação & Segurança',emoji:'🛡️',style:'secondary'},{label:'Dúvidas Gerais',emoji:'💬',style:'secondary'}];
    } else {
      model.title='🎫 Centro de Suporte';
      model.desc='Escolhe o departamento abaixo para abrir um ticket privado com a equipa.';
      model.fields=[{name:'• Resposta rápida',value:'Tempo médio: minutos'},{name:'• Canal privado',value:'Visível só para ti e staff'},{name:'• Histórico guardado',value:'Transcript disponível'}];
      model.buttons=[{label:'Suporte Técnico',emoji:'🔧',style:'primary'},{label:'Reportar Problema',emoji:'⚠️',style:'danger'},{label:'Moderação & Segurança',emoji:'🛡️',style:'secondary'},{label:'Dúvidas Gerais',emoji:'💬',style:'secondary'},{label:'Suporte de Conta',emoji:'🧾',style:'secondary'}];
    }
    return model;
  }
  function renderPreview(){
    const el = elsTC();
    if (!el.prevWrap || !el.prevBody) return;
    const tmpl = el.tmpl?.value || 'classic';
    const theme = (el.theme?.value === 'light') ? 'light' : 'dark';
    const parseColor = (s)=>{
      if (!s) return null;
      if (typeof s === 'number') return s;
      const t = String(s).trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(t)) return parseInt(t.replace('#',''), 16);
      return null;
    };
    const resolvedColor = parseColor(el.color?.value) ?? (theme === 'light' ? 0x60A5FA : 0x7C3AED);
    const model = buildPanelModel(tmpl);
    el.prevWrap.classList.remove('hidden');
    el.prevWrap.style.display = '';
    const fields = model.fields?.length ? `<div class="preview-fields">${model.fields.map(f=>`<div class=\"preview-field\"><div class=\"text-secondary\" style=\"font-size:12px\">${f.name}</div><div>${f.value}</div></div>`).join('')}</div>` : '';
    const btns = model.buttons?.length ? `<div class="preview-buttons">${model.buttons.map(b=>`<div class=\"preview-btn ${b.style}\">${b.emoji} ${b.label}</div>`).join('')}</div>` : '';
    const cssColor = `#${resolvedColor.toString(16).padStart(6,'0')}`;
    el.prevBody.innerHTML = `<div class="preview-embed" style="--embed-color:${cssColor}"><div class=\"preview-title\">${model.title}</div><div class=\"preview-desc\">${model.desc}</div>${fields}${btns}</div>`;
  }
  async function saveConfig(){
    const el = elsTC();
    // validations
    const rolesSel = Array.from(el.roles?.selectedOptions || []);
    if (rolesSel.length === 0){ notifyToast('Validação', 'Seleciona pelo menos um cargo com acesso', 'error'); return; }
    if (!el.cat?.value){ notifyToast('Validação', 'Seleciona a categoria de tickets', 'error'); return; }
    if (!el.logs?.value){ notifyToast('Validação', 'Seleciona o canal de logs', 'error'); return; }
    const payload = {
      tickets: {
        defaultTemplate: (['classic','compact','premium','minimal'].includes(el.tmpl?.value) ? el.tmpl.value : 'classic'),
        panelChannelId: el.panel?.value || '',
        ticketsCategoryId: el.cat?.value || '',
        logsChannelId: el.logs?.value || '',
        welcomeMsg: el.msg?.value || '',
        accessRoleIds: rolesSel.map(o=>o.value)
      }
    };
    await api(`/api/guild/${currentGuild.id}/tickets/config`, { method:'POST', body: JSON.stringify(payload) });
    notifyToast('Sucesso', 'Configurações guardadas');
  }
  async function publishPanel(){
    const el = elsTC();
    if (!el.panel?.value) { notifyToast('Validação', 'Seleciona o canal do painel', 'error'); return; }
    if (!el.cat?.value) { notifyToast('Validação', 'Seleciona a categoria de tickets', 'error'); return; }
    if (!el.logs?.value) { notifyToast('Validação', 'Seleciona o canal de logs', 'error'); return; }
    const template = el.tmpl?.value || 'classic';
    const theme = (el.theme?.value === 'light') ? 'light' : 'dark';
    const colorStr = (el.color?.value || '').trim();
    const hasColor = /^#?[0-9a-fA-F]{6}$/.test(colorStr);
    const body = { type:'tickets', channel_id: el.panel.value, template, theme };
    if (hasColor){ body.options = { color: colorStr.startsWith('#') ? colorStr : `#${colorStr}` }; }
    await api(`/api/guild/${currentGuild.id}/panels/create`, { method:'POST', body: JSON.stringify(body) });
    notifyToast('Sucesso', 'Painel publicado/atualizado');
  }
  async function createCategory(){
    const el = elsTC();
    const name = (el.newCat?.value || '').trim();
    if (!name){ notifyToast('Validação', 'Indica um nome para a categoria', 'error'); return; }
    const res = await api(`/api/guild/${currentGuild.id}/categories/create`, { method:'POST', body: JSON.stringify({ name }) });
    // refresh list and select
    await loadLists();
    if (elsTC().cat) elsTC().cat.value = res?.category?.id || '';
    notifyToast('Sucesso', 'Categoria criada');
  }
  function bindTicketsConfig(){
    const el = elsTC();
    el?.btnSave?.addEventListener('click', saveConfig);
    el?.btnPrev?.addEventListener('click', renderPreview);
    el?.btnPub?.addEventListener('click', publishPanel);
    el?.btnCreateCat?.addEventListener('click', createCategory);
  }
  async function initTicketsConfig(forceReloadLists=false){
    try{
      if (!currentGuild?.id) return;
      if (forceReloadLists) await loadLists(); else await loadLists();
      await loadConfig();
      bindTicketsConfig();
    }catch(e){ notifyToast('Erro', e.message || 'Falha ao carregar configuração', 'error'); }
  }

  async function updateStats(){
    try{
      if (!currentGuild?.id) return;
      const res = await fetch(`/api/guild/${currentGuild.id}/stats`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success){
        setText('[data-staff-online]', data.stats?.onlineCount ?? 0);
        setText('[data-total-members]', data.stats?.memberCount ?? '—');
      }
    }catch{}
  }

  async function updateTicketsStatus(){
    try{
      if (!currentGuild?.id) return;
      const res = await fetch(`/api/guild/${currentGuild.id}/tickets`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success){
        const open = data.stats?.open || 0;
        setText('[data-active-tickets]', open);
        const statusEl = qs('#pill-status');
        const labelEl = qs('[data-system-status]');
        if (!statusEl || !labelEl) return;
        if (open < 5){
          statusEl.dataset.status = 'online';
          labelEl.textContent = 'ONLINE';
        } else if (open < 15){
          statusEl.dataset.status = 'degraded';
          labelEl.textContent = 'DEGRADED';
        } else {
          statusEl.dataset.status = 'offline';
          labelEl.textContent = 'OFFLINE';
        }
      }
    }catch{}
  }

  function setupButtons(){
    qsa('[data-ticket]').forEach(btn => {
      const handler = async () => {
        const type = btn.getAttribute('data-ticket');
        if (!currentGuild){
          window.IGNISToast?.show({ title:'Selecione um servidor', message:'Escolha um servidor antes de abrir um ticket.', type:'error' });
          return;
        }
        const original = btn.textContent;
        btn.setAttribute('aria-busy','true');
        btn.disabled = true; btn.classList.add('loading'); btn.textContent = 'A criar…';
        try{
          await new Promise(r => setTimeout(r, 800));
          window.IGNISToast?.show({
            title: 'Pedido enviado',
            message: `${type.toUpperCase()}: verifica o Discord para o canal privado.`,
            type: 'success'
          });
        } finally {
          btn.removeAttribute('aria-busy');
          btn.disabled = false; btn.classList.remove('loading'); btn.textContent = original;
        }
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('keydown', (e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); handler(); }});
    });
  }

  function renderCardsSkeletons(enable){
    const cards = qsa('.cards .card');
    cards.forEach(card => { card.classList.toggle('skeleton', !!enable); });
  }

  function setupNav(){
    const nav = document.getElementById('nav-dashboard');
    if (nav){
      nav.addEventListener('click', (e) => {
        e.preventDefault();
        location.hash = '#/servers';
      });
    }
    // Keyboard shortcuts
    document.addEventListener('keydown', (e)=>{
      // '/' focuses search when servers view visible
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey){
        if (!views.servers?.hidden){ const input = qs('#server-search'); if (input){ e.preventDefault(); input.focus(); input.select(); } }
      }
      // g s → servers, g h → home
      if (e.key.toLowerCase() === 's' && e.ctrlKey === false && e.metaKey === false && e.altKey === false && e.shiftKey === false && window.__gPress){ e.preventDefault(); location.hash = '#/servers'; window.__gPress = false; }
      else if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && window.__gPress){ e.preventDefault(); location.hash = '#/home'; window.__gPress = false; }
      else if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey){ window.__gPress = true; setTimeout(()=> window.__gPress = false, 1500); }
    });
  }

  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', async () => {
    mountLayout();
    setupNav();
    setupButtons();
    await loadUser();
    route();
  });
})();
