(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const notifsEl = document.getElementById('notifs');

  async function api(path){
    const { ok, json } = await window.IGNISFetch.fetchJsonCached(path, { ttlMs: 5_000, credentials:'same-origin' });
    if(!ok) throw new Error(json?.error||'Request failed');
    return json;
  }

  function render(list){
    if(!Array.isArray(list) || !list.length){ notifsEl.innerHTML = '<div class="text-secondary">Sem notificações</div>'; return; }
    notifsEl.innerHTML = list.map(n => `
      <div class="notif-row">
        <div><b>${n.type}</b> • ${new Date(n.createdAt).toLocaleString()}</div>
        <div>${n.message||'-'}</div>
      </div>
    `).join('');
  }

  async function load(){
    const d = await api(`/api/guild/${guildId}/mod/notifications`);
    render(d.notifications||[]);
  }

  if(!guildId) { console.warn('guildId em falta'); return; }
  load().catch(console.error);
})();
