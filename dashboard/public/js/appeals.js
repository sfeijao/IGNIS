(function(){
  // Ensure guild context
  try{
    const params = new URLSearchParams(window.location.search);
    const gid = params.get('guildId');
    if(!gid){
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
      try{ localStorage.setItem('IGNIS_LAST_GUILD', gid); }catch{}
    }
  }catch{}
})();

(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const appealsEl = document.getElementById('appeals');

  function notify(msg, type='info'){
    try{ const div=document.createElement('div'); div.className=`notification notification-${type} slide-up`; div.innerHTML=`<i class=\"fas ${type==='error'?'fa-exclamation-circle': type==='success'? 'fa-check-circle':'fa-info-circle'}\"></i><span>${msg}</span>`; document.body.appendChild(div); setTimeout(()=>{div.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>div.remove(),300);},3000);}catch{}
  }

  async function api(path){
    const { ok, json } = await window.IGNISFetch.fetchJsonCached(path, { ttlMs: 10_000, credentials:'same-origin' });
    if(!ok) throw new Error(json?.error||'Request failed');
    return json;
  }

  function render(list){
    if(!Array.isArray(list) || !list.length){ appealsEl.innerHTML = '<div class="text-secondary">Sem apelações</div>'; return; }
    appealsEl.innerHTML = list.map(a => `
      <div class="appeal-row">
        <div><b>Utilizador:</b> ${a.user_id||'-'} | <b>Estado:</b> ${a.status}</div>
        <div><b>Mensagem:</b> ${a.message||'-'}</div>
        ${a.status==='pending' ? `
        <div style="margin-top:8px;display:flex;gap:8px">
          <button class="btn btn-primary" data-accept="${a._id}"><i class="fas fa-check"></i> Aceitar</button>
          <button class="btn btn-danger" data-reject="${a._id}"><i class="fas fa-times"></i> Rejeitar</button>
        </div>` : ''}
      </div>
    `).join('');
    appealsEl.querySelectorAll('button[data-accept]').forEach(b=>b.addEventListener('click',()=>decide(b.getAttribute('data-accept'),'accepted')));
    appealsEl.querySelectorAll('button[data-reject]').forEach(b=>b.addEventListener('click',()=>decide(b.getAttribute('data-reject'),'rejected')));
  }

  async function decide(id, status){
    const r = await fetch(`/api/guild/${guildId}/mod/appeals/${id}/decision`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify({ status }) });
    const j = await r.json().catch(()=>({}));
    if(!r.ok || !j.success) return notify(j.error||'Falhou','error');
    notify('Decisão aplicada','success');
    load();
  }

  async function load(){
    const d = await api(`/api/guild/${guildId}/mod/appeals?status=pending`);
    render(d.appeals||[]);
  }

  if(!guildId) { notify('guildId em falta','error'); return; }
  load().catch(e=>notify(e.message,'error'));
})();
