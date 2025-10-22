(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const eventsEl = document.getElementById('events');

  function notify(msg, type='info'){
    try{ const div=document.createElement('div'); div.className=`notification notification-${type} slide-up`; div.innerHTML=`<i class=\"fas ${type==='error'?'fa-exclamation-circle': type==='success'? 'fa-check-circle':'fa-info-circle'}\"></i><span>${msg}</span>`; document.body.appendChild(div); setTimeout(()=>{div.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>div.remove(),300);},3000);}catch{}
  }

  async function api(path){
    const { ok, json } = await window.IGNISFetch.fetchJsonCached(path, { ttlMs: 10_000, credentials:'same-origin' });
    if(!ok) throw new Error(json?.error||'Request failed');
    return json;
  }

  function render(list){
    if(!Array.isArray(list) || !list.length){ eventsEl.innerHTML = '<div class="text-secondary">Sem eventos</div>'; return; }
    eventsEl.innerHTML = list.map(e => `
      <div class="event-row">
        <div><b>Tipo:</b> ${e.type} ${e.resolved ? '<span class="pill pill-green">Resolvido</span>' : ''}</div>
        <div><b>Utilizador:</b> ${e.user_id||'-'} <b>Canal:</b> ${e.channel_id||'-'}</div>
        <div><b>Conteúdo:</b> ${e.content ? e.content.slice(0,200) : '-'}</div>
        ${!e.resolved ? `<button class="btn btn-glass" data-release="${e._id}"><i class="fas fa-unlock"></i> Liberar</button>` : ''}
      </div>
    `).join('');
    eventsEl.querySelectorAll('button[data-release]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-release');
        const r = await fetch(`/api/guild/${guildId}/mod/automod/events/${id}/review`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify({ action: 'release' }) });
        const j = await r.json().catch(()=>({})); if(!r.ok || !j.success) return notify(j.error||'Falhou','error');
        notify('Marcado como resolvido','success');
        load();
      });
    });
  }

  async function load(){
    const d = await api(`/api/guild/${guildId}/mod/automod/events?resolved=false`);
    render(d.events||[]);
  }

  if(!guildId) { notify('guildId em falta','error'); return; }
  load().catch(e=>notify(e.message,'error'));
})();
