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
  const casesContainer = document.getElementById('casesContainer');
  const fltType = document.getElementById('fltType');
  const fltUserId = document.getElementById('fltUserId');
  const fltStaffId = document.getElementById('fltStaffId');
  const fltStatus = document.getElementById('fltStatus');
  const btnSearch = document.getElementById('btnSearch');

  function notify(msg, type='info'){
    try{ const div=document.createElement('div'); div.className=`notification notification-${type} slide-up`; div.innerHTML=`<i class="fas ${type==='error'?'fa-exclamation-circle': type==='success'? 'fa-check-circle':'fa-info-circle'}"></i><span>${msg}</span>`; document.body.appendChild(div); setTimeout(()=>{div.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>div.remove(),300);},3000);}catch{}
  }

  async function api(path){
    const { ok, json } = await window.IGNISFetch.fetchJsonCached(path, { ttlMs: 15_000, credentials:'same-origin' });
    if(!ok) throw new Error(json?.error||'Request failed');
    return json;
  }

  function statusPill(status){
    const map = { open:'pill-yellow', archived:'pill-green', closed:'pill-red' };
    return `<span class="pill ${map[status]||''}">${status||'open'}</span>`;
  }

  function render(list){
    if(!Array.isArray(list) || !list.length){ casesContainer.innerHTML = '<div class="text-secondary">Sem resultados</div>'; return; }
    casesContainer.innerHTML = `
      <div class="case-row" style="font-weight:600;opacity:0.8">
        <div>Utilizador</div>
        <div>Staff</div>
        <div>Tipo</div>
        <div>Motivo</div>
        <div>Data</div>
        <div>Ações</div>
      </div>
      ${list.map(c => `
        <div class="case-row">
          <div>${c.user_id||'-'}</div>
          <div>${c.staff_id||'-'}</div>
          <div><span class="pill">${c.type}</span></div>
          <div>${(c.reason||'').slice(0,120)}</div>
          <div>${new Date(c.occurred_at||c.createdAt).toLocaleString()}</div>
          <div>
            ${statusPill(c.status)}
            ${c.status!=='archived' ? `<button class="btn btn-glass" data-archive="${c._id}"><i class="fas fa-box-archive"></i> Arquivar</button>` : ''}
          </div>
        </div>
      `).join('')}
    `;
    casesContainer.querySelectorAll('button[data-archive]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-archive');
        try{
          const r = await fetch(`/api/guild/${guildId}/mod/cases/${id}/archive`, { method:'POST', credentials:'same-origin' });
          const j = await r.json();
          if(!r.ok || !j.success) throw new Error(j.error||'Falha ao arquivar');
          notify('Caso arquivado', 'success');
          load();
        }catch(e){ notify(e.message,'error'); }
      });
    });
  }

  async function load(){
    try{
      const q = new URLSearchParams();
      if(fltType.value) q.set('type', fltType.value);
      if(fltUserId.value.trim()) q.set('userId', fltUserId.value.trim());
      if(fltStaffId.value.trim()) q.set('staffId', fltStaffId.value.trim());
      if(fltStatus.value) q.set('status', fltStatus.value);
      const d = await api(`/api/guild/${guildId}/mod/cases?${q.toString()}`);
      render(d.cases||[]);
    }catch(e){ notify(e.message,'error'); }
  }

  if(!guildId){ notify('guildId em falta','error'); return; }
  btnSearch.addEventListener('click', load);
  load();
})();
