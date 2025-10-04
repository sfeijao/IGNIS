(function(){
	const p=new URLSearchParams(window.location.search); const guildId=p.get('guildId');
	const els={ search:document.getElementById('search'), roleFilter:document.getElementById('roleFilter'), refresh:document.getElementById('refresh'), members:document.getElementById('members'), roles:document.getElementById('roles'), selectAll:document.getElementById('selectAllMembers'), clearSel:document.getElementById('clearMembers'), bulkRole:document.getElementById('bulkRole'), bulkAdd:document.getElementById('bulkAddRole'), bulkRemove:document.getElementById('bulkRemoveRole'), bulkProgress:document.getElementById('bulkProgress'), bulkPanel:document.getElementById('bulkPanel'), bulkResults:document.getElementById('bulkResults'), copyBulkSummary:document.getElementById('copyBulkSummary'), clearBulkResults:document.getElementById('clearBulkResults'), openOnFailOnly:document.getElementById('openOnFailOnly') };
	let allRoles=[]; let members=[]; let selectedMember=null; let selectedRoles=new Set(); let multiSel=new Set();
	function notify(m,t='info'){ const n=document.createElement('div'); n.className=`notification notification-${t} slide-up`; n.innerHTML=`<i class="fas ${t==='error'?'fa-exclamation-circle': t==='success'?'fa-check-circle':'fa-info-circle'}"></i><span>${m}</span>`; document.body.appendChild(n); setTimeout(()=>{n.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>n.remove(),300);},2500); }
	function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); }
	async function loadRoles(){ const r=await fetch(`/api/guild/${guildId}/roles`,{credentials:'same-origin'}); const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`); allRoles = d.roles||[]; renderRolesList(); if(els.roleFilter){ els.roleFilter.innerHTML='<option value="">Todos os cargos</option>'+allRoles.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join(''); } if(els.bulkRole){ els.bulkRole.innerHTML='<option value="">(Selecionar cargo)</option>'+allRoles.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join(''); } }
	async function loadMembers(refresh=false){ const q=(els.search?.value||'').trim(); const role=(els.roleFilter?.value||'').trim(); const url=new URL(`/api/guild/${guildId}/members`, window.location.origin); if(q) url.searchParams.set('q',q); if(role) url.searchParams.set('role',role); url.searchParams.set('limit','100'); if(refresh) url.searchParams.set('refresh','true'); const r=await fetch(url.toString(),{credentials:'same-origin'}); const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`); members=d.members||[]; renderMembers(); }
	function renderMembers(){ if(!els.members) return; const onlyManageable = !!(document.getElementById('onlyManageable')?.checked); const list = onlyManageable? members.filter(m=>m.manageable!==false) : members; if(!list.length){ els.members.innerHTML='<div class="text-secondary">Sem resultados.</div>'; return; } els.members.innerHTML = list.map(m=>{ const avatar=m.avatar?`https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png`:'/default-avatar.svg'; const chips=(m.roles||[]).slice(0,5).map(id=>{ const r=allRoles.find(x=>x.id===id); return r?`<span class="role-chip">${escapeHtml(r.name)}</span>`:''; }).join(' '); const checked = multiSel.has(m.id)? 'checked':''; const badge = m.manageable===false? ' <span class="role-chip" title="hierarquia do bot inferior">não gerenciável</span>' : ''; const disabledEdit = m.manageable===false? 'disabled title="não gerenciável pela hierarquia do bot"' : ''; return `<div class="member" data-id="${m.id}"><div class="member-left"><input type="checkbox" class="msel" data-id="${m.id}" ${checked}/><img src="${avatar}" class="user-avatar" style="width:28px;height:28px;border-radius:50%"/><div><div><strong>${escapeHtml(m.username)}</strong> <span class="text-secondary">#${escapeHtml(m.discriminator)}</span>${badge}</div><div class="mt-4">${chips}</div></div></div><div><button class="btn btn-secondary btn-sm" data-act="edit" data-id="${m.id}" ${disabledEdit}><i class="fas fa-pen"></i></button></div></div>`; }).join(''); els.members.querySelectorAll('button[data-act="edit"]').forEach(btn=> btn.addEventListener('click', ()=>{ if(btn.hasAttribute('disabled')) return; openMember(btn.getAttribute('data-id')); })); els.members.querySelectorAll('input.msel').forEach(chk=> chk.addEventListener('change', ()=>{ const id=chk.getAttribute('data-id'); if(chk.checked) multiSel.add(id); else multiSel.delete(id); })); }
	function renderRolesList(){ if(!els.roles) return; els.roles.innerHTML = allRoles.map(r=>{ const checked = selectedRoles.has(r.id)?'checked':''; const unmanageable = r.managed || (r.manageable===false); const dis = unmanageable? 'disabled':''; const color = r.color && r.color!=='#000000'? `style="color:${r.color}"`:''; const title = unmanageable? `${escapeHtml(r.name)} — não gerenciável (hierarquia)` : escapeHtml(r.name); return `<label class="role-list role" title="${title}"><input type="checkbox" value="${r.id}" ${checked} ${dis}/> <i class="fas fa-tag" ${color}></i> <span>${escapeHtml(r.name)}</span></label>`; }).join(''); els.roles.querySelectorAll('input[type="checkbox"]').forEach(chk=> chk.addEventListener('change', ()=>{ const id=chk.value; if(chk.checked) selectedRoles.add(id); else selectedRoles.delete(id); debounceApply(); })); }
	let applyTimer=null; function debounceApply(){ if(applyTimer) clearTimeout(applyTimer); applyTimer=setTimeout(apply, 400); }
	async function openMember(id){ selectedMember = members.find(m=>m.id===id); if(!selectedMember) return; selectedRoles = new Set(selectedMember.roles||[]); renderRolesList(); notify(`A editar cargos de ${selectedMember.username}`,'info'); }
	 async function apply(){ if(!selectedMember) return; const current=new Set(selectedMember.roles||[]); const toAdd=[...selectedRoles].filter(id=>!current.has(id)); const toRemove=[...current].filter(id=>!selectedRoles.has(id)); if(!toAdd.length && !toRemove.length) return; try{ const r=await fetch(`/api/guild/${guildId}/members/${selectedMember.id}/roles`,{method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({ add: toAdd, remove: toRemove })}); const d=await r.json(); if(!r.ok||!d.success){ const code = d && d.error ? d.error : `HTTP ${r.status}`; throw new Error(code); } if(d.partial){ const s=(d.details&&d.details.skipped?d.details.skipped.length:0); const ecount=(d.details&&d.details.errors?d.details.errors.length:0); notify(`Cargos atualizados (parcial): ${s} ignorado(s), ${ecount} erro(s)`,`info`); } else { notify('Cargos atualizados','success'); } // refresh member roles local
 selectedMember.roles=[...selectedRoles]; renderMembers(); }catch(e){ console.error(e); const msg = (e && e.message)||''; if(msg==='insufficient_role_hierarchy'){ notify('Não é possível gerir cargos acima (ou iguais) ao do bot.','error'); } else if(msg==='insufficient_member_hierarchy'){ notify('Não é possível alterar cargos deste utilizador: a hierarquia do bot é inferior.','error'); } else { notify(msg||'Erro ao atualizar cargos','error'); } // revert UI to server state
 selectedRoles = new Set(selectedMember.roles||[]); renderRolesList(); }
	}
	els.roleFilter?.addEventListener('change', ()=>loadMembers(false)); els.search?.addEventListener('input', ()=>loadMembers(false)); els.refresh?.addEventListener('click', ()=>loadMembers(true));
	const onlyManageableEl = document.getElementById('onlyManageable');
	onlyManageableEl?.addEventListener('change', ()=>{ renderMembers(); });
	els.selectAll?.addEventListener('click', ()=>{ const onlyManageable = !!(onlyManageableEl && onlyManageableEl.checked); const list = onlyManageable? members.filter(m=>m.manageable!==false) : members; multiSel = new Set(list.map(m=>m.id)); renderMembers(); });
	els.clearSel?.addEventListener('click', ()=>{ multiSel = new Set(); renderMembers(); });
	async function bulkUpdate(kind){ const rid=(els.bulkRole?.value||'').trim(); if(!rid) return notify('Escolha um cargo','error'); const ids=[...multiSel]; if(ids.length===0) return notify('Selecione membros','error'); const total=ids.length; let done=0, ok=0, fail=0; const results=[]; const updateProgress=()=>{ if(els.bulkProgress) els.bulkProgress.textContent = `Progresso: ${done}/${total} (${ok} ok, ${fail} falhas)`; }; const renderResults=()=>{ if(!els.bulkResults) return; els.bulkResults.innerHTML = results.map(r=>{ const m = members.find(x=>x.id===r.id) || { username:r.id, discriminator:'' }; const cls = r.ok? 'ok':'fail'; const icon = r.ok? 'fa-check-circle':'fa-times-circle'; const msg = r.ok? (kind==='add'? 'Adicionado' : 'Removido') : (r.error||'Falhou'); const extra = r.note? ` — ${escapeHtml(r.note)}`:''; return `<div class="result-row ${cls}"><i class="fas ${icon}"></i> <strong>${escapeHtml(m.username)}</strong> <span class="text-secondary">#${escapeHtml(m.discriminator||'')}</span> — <span>${escapeHtml(msg)}</span>${extra}</div>`; }).join(''); };
		if(els.bulkPanel){ const onlyOnFail = !!(els.openOnFailOnly && els.openOnFailOnly.checked); els.bulkPanel.open = !onlyOnFail; }
		if(els.bulkResults){ els.bulkResults.innerHTML=''; }
		if(els.clearBulkResults){ els.clearBulkResults.onclick = ()=>{ results.length = 0; if(els.bulkResults) els.bulkResults.innerHTML=''; if(els.bulkPanel) els.bulkPanel.open = false; if(els.bulkProgress) els.bulkProgress.textContent = ''; } }
		if(els.copyBulkSummary){ els.copyBulkSummary.onclick = async()=>{ const lines = results.map(r=>{ const m = members.find(x=>x.id===r.id) || { username:r.id, discriminator:'' }; const status = r.ok? 'OK':'FAIL'; const action = kind==='add'? 'ADD':'REMOVE'; return `${status}\t${action}\t${m.username}#${m.discriminator||''}\t(${r.id})${r.ok?'':`\t${r.error||''}`}`; }).join('\n'); try{ await navigator.clipboard.writeText(lines); notify('Resumo copiado','success'); }catch{ notify('Não foi possível copiar','error'); } }; }
		updateProgress();
		const limit=4; const queue=ids.slice();
		const runOne=async(uid)=>{ try{ const body = kind==='add'? { add:[rid] } : { remove:[rid] }; const r=await fetch(`/api/guild/${guildId}/members/${uid}/roles`,{method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify(body)}); const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`); ok++; const note = d.partial? `parcial (${(d.details?.skipped||[]).length} ignorado(s))` : ''; results.push({ id: uid, ok: true, note }); }catch(e){ console.error('Bulk role error for', uid, e); fail++; results.push({ id: uid, ok: false, error: (e && e.message) ? e.message : 'erro' }); } finally{ done++; updateProgress(); renderResults(); } };
		const workers = Array.from({length: Math.min(limit, queue.length)}, async()=>{ while(queue.length){ const uid=queue.shift(); await runOne(uid); } }); await Promise.all(workers);
		// After all, if we only open on failures and there were any, open it now
		if(els.bulkPanel){ const onlyOnFail = !!(els.openOnFailOnly && els.openOnFailOnly.checked); if(onlyOnFail && fail>0){ els.bulkPanel.open = true; } }
		if(els.bulkProgress) els.bulkProgress.textContent = `Concluído: ${ok} sucesso(s), ${fail} falha(s)`; notify(kind==='add'?`Cargo adicionado a ${ok}`:`Cargo removido de ${ok}`,'success'); if(fail>0) notify(`${fail} falha(s) durante a operação`,'error'); await loadMembers(false); }
	els.bulkAdd?.addEventListener('click', ()=>bulkUpdate('add'));
	els.bulkRemove?.addEventListener('click', ()=>bulkUpdate('remove'));
	Promise.resolve().then(loadRoles).then(()=>loadMembers(true)).catch(e=>{ console.error(e); notify(e.message,'error'); });
})();
// Add role management logic + event bindings for new toolbar
(function(){
  const apiBase = window.apiBase || '/api';
  function getGuildId(){
    // Try to reuse existing logic if defined globally
    if(window.currentGuildId) return window.currentGuildId;
    const el = document.querySelector('[data-guild-id]');
    return el ? el.getAttribute('data-guild-id') : (window.guildId || '');
  }
  async function createRoleStandalone(){
    const nameEl = document.getElementById('rmNewRoleName2');
    const colorEl = document.getElementById('rmNewRoleColor2');
    if(!nameEl || !colorEl) return;
    const name = nameEl.value.trim();
    let color = colorEl.value.trim();
    if(!name){
      alert('Nome do cargo é obrigatório');
      return;
    }
    if(color){
      if(!/^#?[0-9a-fA-F]{6}$/.test(color)){ alert('Cor inválida (use #RRGGBB)'); return; }
      if(color[0] !== '#') color = '#' + color;
    }
    const guildId = getGuildId();
    try {
      const res = await fetch(`${apiBase}/guild/${guildId}/roles`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name, color })
      });
      const data = await res.json();
      if(!res.ok){ throw new Error(data.error || 'Falha ao criar cargo'); }
      nameEl.value=''; colorEl.value='';
      toast('Cargo criado');
      if(window.refreshRoles) window.refreshRoles();
      else document.getElementById('refresh')?.click();
    } catch(e){ console.error(e); alert(e.message); }
  }
  async function moveRoleStandalone(direction){
    const idEl = document.getElementById('rmMoveRoleId');
    const stepsEl = document.getElementById('rmMoveSteps');
    if(!idEl || !stepsEl) return;
    const roleId = idEl.value.trim();
    const steps = parseInt(stepsEl.value,10)||1;
    if(!roleId){ alert('ID do cargo necessário'); return; }
    const guildId = getGuildId();
    try {
      const res = await fetch(`${apiBase}/guild/${guildId}/roles/${roleId}/move`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ direction, steps })
      });
      const data = await res.json();
      if(!res.ok){ throw new Error(data.error || 'Falha ao mover cargo'); }
      toast('Cargo movido');
      if(window.refreshRoles) window.refreshRoles(); else document.getElementById('refresh')?.click();
    } catch(e){ console.error(e); alert(e.message); }
  }
  async function deleteRoleStandalone(){
    const idEl = document.getElementById('rmDeleteRoleId');
    if(!idEl) return;
    const roleId = idEl.value.trim();
    if(!roleId){ alert('ID do cargo necessário'); return; }
    if(!confirm('Tem certeza que deseja apagar este cargo?')) return;
    const guildId = getGuildId();
    try {
      const res = await fetch(`${apiBase}/guild/${guildId}/roles/${roleId}`, { method:'DELETE' });
      const data = await res.json();
      if(!res.ok){ throw new Error(data.error || 'Falha ao apagar cargo'); }
      idEl.value='';
      toast('Cargo apagado');
      if(window.refreshRoles) window.refreshRoles(); else document.getElementById('refresh')?.click();
    } catch(e){ console.error(e); alert(e.message); }
  }
  function toast(msg){
    if(window.showToast) return window.showToast(msg,'success');
    console.log('[toast]', msg);
  }
  function bindBtn(id, handler){ const el = document.getElementById(id); if(el) el.addEventListener('click', handler); }
  document.addEventListener('DOMContentLoaded', ()=>{
    bindBtn('rmBtnCreateRole2', createRoleStandalone);
    bindBtn('rmBtnMoveUp', ()=>moveRoleStandalone('up'));
    bindBtn('rmBtnMoveDown', ()=>moveRoleStandalone('down'));
    bindBtn('rmBtnDeleteRole', deleteRoleStandalone);
  });
})();
// Enhancement: dropdown population + copy ID buttons + toast errors + inline refresh
(function(){
  const guildParam=new URLSearchParams(window.location.search); const guildId=guildParam.get('guildId');
  const moveSel=document.getElementById('rmMoveRoleSelect');
  const delSel=document.getElementById('rmDeleteRoleSelect');
  // Attempt to hook into existing roles loading by monkey patching loadRoles if present later
  function populateDropdowns(){
    if(!window.allRolesGlobal && !window.getAllRolesInternal){
      // Try to infer roles from DOM list
      const roleLabels=[...document.querySelectorAll('#roles label.role-list input[type="checkbox"]')];
      if(roleLabels.length && moveSel && delSel){
        const opts=roleLabels.map(chk=>`<option value="${chk.value}">${chk.parentElement?.textContent?.trim()||chk.value}</option>`).join('');
        if(moveSel && moveSel.options.length<=1) moveSel.insertAdjacentHTML('beforeend',opts);
        if(delSel && delSel.options.length<=1) delSel.insertAdjacentHTML('beforeend',opts);
      }
      return;
    }
  }
  // Provide a hook that roles.js can call after roles render
  window.refreshRoleDropdownHelpers = function(allRoles){
    if(!allRoles) return populateDropdowns();
    if(moveSel){ moveSel.innerHTML='<option value="">(Cargo)</option>'+allRoles.map(r=>`<option value="${r.id}">${r.name}</option>`).join(''); }
    if(delSel){ delSel.innerHTML='<option value="">(Cargo)</option>'+allRoles.map(r=>`<option value="${r.id}">${r.name}</option>`).join(''); }
  };
  // Copy ID buttons: delegate after roles render
  function addCopyButtons(){
    const container=document.getElementById('roles');
    if(!container) return;
    container.querySelectorAll('label.role').forEach(label=>{
      if(label.querySelector('.copy-id-btn')) return;
      const chk=label.querySelector('input[type="checkbox"]'); if(!chk) return;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='btn btn-glass btn-xs copy-id-btn';
      btn.title='Copiar ID';
      btn.innerHTML='<i class="fas fa-copy"></i>';
      btn.addEventListener('click',e=>{ e.stopPropagation(); navigator.clipboard.writeText(chk.value).then(()=>toast('ID copiado')).catch(()=>toastError('Falha ao copiar')); });
      label.appendChild(btn);
    });
  }
  // Observe mutations to re-inject copy buttons when roles list updates
  const rolesEl=document.getElementById('roles');
  if(rolesEl){
    const obs=new MutationObserver(()=>{ addCopyButtons(); populateDropdowns(); });
    obs.observe(rolesEl,{childList:true, subtree:true});
  }
  function getGuildId(){ return guildId || window.currentGuildId || window.guildId || ''; }
  function toast(msg,type='success'){ if(window.showToast) return window.showToast(msg,type); console.log('[toast]',type,msg); }
  function toastError(msg){ toast(msg,'error'); }
  async function apiJson(url,opts){
    const res=await fetch(url,opts); let data=null; try{ data=await res.json(); }catch{ /* ignore */ }
    if(!res.ok || (data && data.success===false)) throw new Error((data&&data.error)||`HTTP ${res.status}`);
    return data;
  }
  async function createRole(){
    const nameEl=document.getElementById('rmNewRoleName2');
    const colorEl=document.getElementById('rmNewRoleColor2');
    const name=nameEl?.value.trim(); let color=colorEl?.value.trim();
    if(!name){ toastError('Nome obrigatório'); return; }
    if(color){ if(!/^#?[0-9a-fA-F]{6}$/.test(color)){ toastError('Cor inválida'); return;} if(color[0]!=='#') color='#'+color; }
    try{ await apiJson(`/api/guild/${getGuildId()}/roles`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,color})}); nameEl.value=''; if(colorEl) colorEl.value=''; toast('Cargo criado'); triggerSoftReload(); }
    catch(e){ toastError(e.message||'Erro ao criar'); }
  }
  function selValue(sel){ return sel && sel.value ? sel.value.trim():''; }
  async function moveRole(direction){
    const roleId=selValue(moveSel); const stepsEl=document.getElementById('rmMoveSteps'); const steps=parseInt(stepsEl?.value||'1',10)||1;
    if(!roleId){ toastError('Selecione cargo para mover'); return; }
    try{ await apiJson(`/api/guild/${getGuildId()}/roles/${roleId}/move`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({direction,steps})}); toast('Cargo movido'); triggerSoftReload(); }
    catch(e){ toastError(e.message||'Erro ao mover'); }
  }
  async function deleteRole(){ const roleId=selValue(delSel); if(!roleId){ toastError('Selecione cargo para apagar'); return; } if(!confirm('Apagar cargo selecionado?')) return; try{ await apiJson(`/api/guild/${getGuildId()}/roles/${roleId}`,{method:'DELETE'}); toast('Cargo apagado'); if(delSel) delSel.value=''; triggerSoftReload(); }catch(e){ toastError(e.message||'Erro ao apagar'); } }
  function triggerSoftReload(){
    // Try to reuse existing refresh logic; if loadRoles function in closure not accessible, fallback to clicking refresh button
    const btn=document.getElementById('refresh'); if(btn) btn.click();
  }
  document.getElementById('rmBtnCreateRole2')?.addEventListener('click',createRole);
  document.getElementById('rmBtnMoveUp')?.addEventListener('click',()=>moveRole('up'));
  document.getElementById('rmBtnMoveDown')?.addEventListener('click',()=>moveRole('down'));
  document.getElementById('rmBtnDeleteRole')?.addEventListener('click',deleteRole);
  // Initial attempt after load
  window.addEventListener('load',()=>{ populateDropdowns(); addCopyButtons(); });
})();
// Role search + hierarchy display + disable unmanaged in dropdowns
(function(){
  const roleSearch=document.getElementById('roleSearch');
  const roleCount=document.getElementById('roleCount');
  const moveSel=document.getElementById('rmMoveRoleSelect');
  const delSel=document.getElementById('rmDeleteRoleSelect');
  // Hook into existing global helper
  const origRefresh = window.refreshRoleDropdownHelpers;
  window.refreshRoleDropdownHelpers = function(allRoles){
    if(origRefresh) origRefresh(allRoles);
    if(allRoles){
      // Disable unmanaged
      const buildOpts = list => list.map(r=>`<option value="${r.id}" ${ (r.managed||r.manageable===false)?'disabled':'' }>${r.name}${(r.managed||r.manageable===false)?' (X)':''}</option>`).join('');
      if(moveSel) moveSel.innerHTML='<option value="">(Cargo)</option>'+buildOpts(allRoles);
      if(delSel) delSel.innerHTML='<option value="">(Cargo)</option>'+buildOpts(allRoles.filter(r=>!r.managed && r.manageable!==false));
    }
    filterRoles();
  };
  function filterRoles(){
    const term=(roleSearch?.value||'').toLowerCase();
    const container=document.getElementById('roles'); if(!container) return;
    const items=[...container.querySelectorAll('label.role')];
    let visible=0;
    items.forEach(lab=>{
      const txt=lab.textContent.toLowerCase();
      if(!term || txt.includes(term)){ lab.style.display='flex'; visible++; } else { lab.style.display='none'; }
    });
    if(roleCount){ roleCount.textContent = visible? `${visible} cargo(s)` : 'Nenhum cargo'; }
  }
  roleSearch?.addEventListener('input', filterRoles);
  // Mutation to inject position badges
  const rolesEl=document.getElementById('roles');
  const injectPositions=()=>{
    const labels=[...rolesEl.querySelectorAll('label.role')];
    labels.forEach(lab=>{
      if(lab.querySelector('.role-pos')) return;
      const idInput=lab.querySelector('input[type="checkbox"]');
      if(!idInput) return;
      // attempt to read position info from title or dataset later; fallback unknown
      // We will add a placeholder now; replaced when dataset present
      const posSpan=document.createElement('span'); posSpan.className='role-pos'; posSpan.textContent='?';
      lab.insertBefore(posSpan, lab.firstChild);
    });
  };
  if(rolesEl){
    const obs=new MutationObserver(()=>{ injectPositions(); filterRoles(); });
    obs.observe(rolesEl,{childList:true, subtree:true});
  }
})();
// Patch renderRolesList to show position numbers
(function(){
  const origRenderRolesList = typeof renderRolesList !== 'undefined' ? renderRolesList : null;
})();
// Since renderRolesList is inside IIFE we re-implement position labeling using MutationObserver + roles from API
(function(){
  let lastRoles=[];
  // Intercept fetch of roles via monkey patch fetch (lightweight) to capture positions
  const origFetch = window.fetch;
  window.fetch = async function(input, init){
    const res = await origFetch(input, init);
    try {
      const url = typeof input==='string'? input : input.url;
      if(/\/api\/guild\/.+\/roles$/.test(url) && res.ok){
        const cloned = res.clone();
        const data = await cloned.json();
        if(data && data.roles){ lastRoles = data.roles; setTimeout(applyPositions, 50); window.refreshRoleDropdownHelpers && window.refreshRoleDropdownHelpers(lastRoles); }
      }
    } catch {}
    return res;
  };
  function applyPositions(){
    if(!lastRoles.length) return;
    const map = new Map(lastRoles.map(r=>[r.id,r.position]));
    document.querySelectorAll('#roles label.role').forEach(lab=>{
      const chk = lab.querySelector('input[type="checkbox"]'); if(!chk) return;
      let posEl = lab.querySelector('.role-pos');
      if(!posEl){ posEl=document.createElement('span'); posEl.className='role-pos'; lab.insertBefore(posEl, lab.firstChild); }
      const pos = map.get(chk.value); posEl.textContent = typeof pos==='number'? pos : '?';
    });
  }
  // Initial attempt
  setInterval(applyPositions, 1500); // low frequency fallback
})();