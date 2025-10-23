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
  const matrix = document.getElementById('permMatrix');
  const btnSave = document.getElementById('btnSave');
  const actions = ['warn','mute','ban','kick','note'];

  async function api(path){
    const r = await fetch(path, { credentials:'same-origin' });
    const j = await r.json().catch(()=>({}));
    if(!r.ok || !j.success) throw new Error(j.error||'HTTP '+r.status);
    return j;
  }

  function notify(msg, type='info'){
    try{ const div=document.createElement('div'); div.className=`notification notification-${type} slide-up`; div.innerHTML=`<i class=\\"fas ${type==='error'?'fa-exclamation-circle': type==='success'? 'fa-check-circle':'fa-info-circle'}\\"></i><span>${msg}</span>`; document.body.appendChild(div); setTimeout(()=>{div.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>div.remove(),300);},3000);}catch{}
  }

  async function load(){
    const rolesData = await api(`/api/guild/${guildId}/roles`);
    const cfg = await api(`/api/guild/${guildId}/config`);
    const perms = (cfg.config && cfg.config.moderationPermissions) || {};
    const roles = rolesData.roles || [];

    matrix.innerHTML = `
      <div class="perm-row" style="font-weight:600;opacity:0.8">
        <div>Cargo</div>
        ${actions.map(a=>`<div>${a.toUpperCase()}</div>`).join('')}
      </div>
      ${roles.map(r=>`
        <div class="perm-row">
          <div>${r.name}</div>
          ${actions.map(a=>{
            const checked = Array.isArray(perms[a]) && perms[a].includes(r.id);
            return `<div><input type="checkbox" data-role="${r.id}" data-action="${a}" ${checked? 'checked':''}></div>`;
          }).join('')}
        </div>
      `).join('')}
    `;
  }

  async function save(){
    const out = { moderationPermissions: {} };
    actions.forEach(a => out.moderationPermissions[a] = []);
    matrix.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      if(chk.checked){ const a = chk.getAttribute('data-action'); const rid = chk.getAttribute('data-role'); out.moderationPermissions[a].push(rid); }
    });
    const r = await fetch(`/api/guild/${guildId}/config`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify(out) });
    const j = await r.json();
    if(!r.ok || !j.success) throw new Error(j.error||'Falhou');
    notify('Permissões guardadas', 'success');
  }

  if(!guildId){ notify('guildId em falta','error'); return; }
  btnSave.addEventListener('click', () => save().catch(e=>notify(e.message,'error')));
  load().catch(e=>notify(e.message,'error'));
})();
