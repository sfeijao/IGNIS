// IGNIS Website Dashboard Controller
// Handles navigation (#/servers, #/home), loads user & guilds, updates stats, and binds ticket actions

(function(){
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));
  const setText = (sel, text) => { const el = qs(sel); if (el) el.textContent = text; };

  const views = {
    servers: qs('#view-servers'),
    home: qs('#view-home')
  };

  let currentGuild = null;
  let guildsCache = [];

  const SELECTED_GUILD_KEY = 'ignis:selectedGuildId';

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
      showView('servers');
      if (!guildsCache.length) loadGuilds();
    } else {
      showView('home');
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
      name.className = 'server-name'; name.textContent = g.name;
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
  }

  async function loadGuilds(){
    try{
      renderServerSkeletons();
      const res = await fetch('/api/guilds');
      if (!res.ok) return;
      const data = await res.json();
      guildsCache = data.guilds || [];
      renderServers(guildsCache);
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
    }catch{}
  }

  function setupServerSearch(){
    const input = qs('#server-search');
    const reload = qs('#server-reload');
    if (reload){ reload.addEventListener('click', () => loadGuilds()); }
    if (!input) return;
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      if (!query){ renderServers(guildsCache); return; }
      const filtered = guildsCache.filter(g => (g.name||'').toLowerCase().includes(query));
      renderServers(filtered);
    });
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
