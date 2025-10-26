(function(){
	// Ensure guild context
	try{
		const p0=new URLSearchParams(window.location.search); const gid0=p0.get('guildId');
		if(!gid0){
			const last=localStorage.getItem('IGNIS_LAST_GUILD');
			if(last){ const q=new URLSearchParams(window.location.search); q.set('guildId', last); const next=`${window.location.pathname}?${q.toString()}${window.location.hash||''}`; window.location.replace(next); return; }
			else { window.location.href='/dashboard'; return; }
		} else { try{ localStorage.setItem('IGNIS_LAST_GUILD', gid0); }catch{} }
	}catch{}
})();

(function(){
	const p=new URLSearchParams(window.location.search); const guildId=p.get('guildId');
	const els={ name:document.getElementById('cmdName'), desc:document.getElementById('cmdDesc'), type:document.getElementById('cmdType'), content:document.getElementById('cmdContent'), preview:document.getElementById('preview'), save:document.getElementById('save'), list:document.getElementById('cmdsList'), modal:document.getElementById('modal'), modalBody:document.getElementById('modalBody'), modalOk:document.getElementById('modalOk'), modalCancel:document.getElementById('modalCancel') };
	let all = [];

	function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); }

	function renderEmbedPreview(obj){
		// Minimal renderer: title, description, fields
		const title = obj.title? `<div class="embed-title"><strong>${escapeHtml(obj.title)}</strong></div>`: '';
		const desc = obj.description? `<div class="embed-desc">${escapeHtml(obj.description)}</div>`: '';
		const fields = Array.isArray(obj.fields)? `<div class="embed-fields">${obj.fields.map(f=>`<div class="embed-field"><div class="embed-field-name"><strong>${escapeHtml(f.name||'')}</strong></div><div class="embed-field-value">${escapeHtml(f.value||'')}</div></div>`).join('')}</div>`: '';
		return `<div class="embed glass-card pad-12">${title}${desc}${fields}</div>`;
	}

	function update(){
		const type=(els.type?.value||'text');
		const content=(els.content?.value||'').trim();
		let ok=true; let preview='';
		if(type==='embed'){
			try{ const obj = content? JSON.parse(content): {}; preview = renderEmbedPreview(obj); }
			catch(e){ preview = '<div class="text-danger">JSON inválido</div>'; ok=false; }
		} else { preview = escapeHtml(content || '(vazio)'); }
		els.preview.innerHTML = preview;
		if(els.save) els.save.disabled = false === ok; // enable if ok
	}

	async function load(){
		try{
			const r=await fetch(`/api/guild/${guildId}/commands`, {credentials:'same-origin'});
			const d=await r.json();
			if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`);
			all = Array.isArray(d.commands)? d.commands: [];
			renderList();
		}catch(e){ console.error(e); notify(e.message,'error'); }
	}

	function renderList(){
		if(!els.list) return;
		if(!Array.isArray(all) || all.length===0){ els.list.innerHTML = '<div class="text-secondary">Sem comandos.</div>'; return; }
		els.list.innerHTML = all.map((c,i)=>{
			const enabled = c.enabled!==false;
			const descr = c.description? ` — ${escapeHtml(c.description)}`: '';
			const disabledBadge = enabled? '' : ' <span class="badge" title="Desativado"><i class="fas fa-ban"></i> Desativado</span>';
			const muted = enabled? '' : ' style="opacity:.6"';
			return `<div class="cmd-item" data-i="${i}">
				<div class="cmd-left"${muted}>
					<div><strong>/${escapeHtml(c.name||'')}</strong>${descr}${disabledBadge}</div>
					<div class="text-secondary">Tipo: ${escapeHtml(c.type||'text')}</div>
				</div>
				<div class="cmd-actions">
					<label class="switch" title="Ativar/Desativar"><input type="checkbox" class="cmd-toggle" data-i="${i}" ${enabled?'checked':''} /><span class="slider"></span></label>
					<button class="btn btn-glass btn-sm" data-act="edit" data-i="${i}"><i class="fas fa-edit"></i></button>
					<button class="btn btn-danger btn-sm" data-act="delete" data-i="${i}"><i class="fas fa-trash"></i></button>
				</div>
			</div>`;
		}).join('');
		// Handlers
		els.list.querySelectorAll('button[data-act="edit"]').forEach(btn=> btn.addEventListener('click', ()=>{
			const i=parseInt(btn.getAttribute('data-i'),10); if(Number.isNaN(i)) return;
			const c=all[i]; if(!c) return;
			els.name.value = `/${c.name||''}`;
			els.desc.value = c.description||'';
			els.type.value = c.type||'text';
			els.content.value = c.type==='embed'? JSON.stringify(c.content||{}, null, 2): String(c.content||'');
			update();
		}));
		els.list.querySelectorAll('button[data-act="delete"]').forEach(btn=> btn.addEventListener('click', ()=>{
			const i=parseInt(btn.getAttribute('data-i'),10); if(Number.isNaN(i)) return;
			const c = all[i]; if(!c) return;
			confirmModal(`Eliminar comando /${escapeHtml(c.name||'')}?`, async()=>{
				const next = all.filter((_,idx)=> idx!==i);
				try{
					const r=await fetch(`/api/guild/${guildId}/commands`, {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({ commands: next })});
					const d=await r.json(); if(!r.ok||!d.success) throw new Error((d.details&&d.details.join(', '))||d.error||`HTTP ${r.status}`);
					all = next; renderList(); notify('Comando removido','success');
				}catch(e){ console.error(e); notify(e.message,'error'); }
			});
		}));
		els.list.querySelectorAll('input.cmd-toggle').forEach(chk=> chk.addEventListener('change', async()=>{
			const i=parseInt(chk.getAttribute('data-i'),10); if(Number.isNaN(i)) return;
			const next = all.slice(); next[i] = { ...next[i], enabled: !!chk.checked };
			try{
				const r=await fetch(`/api/guild/${guildId}/commands`, {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({ commands: next })});
				const d=await r.json(); if(!r.ok||!d.success) throw new Error((d.details&&d.details.join(', '))||d.error||`HTTP ${r.status}`);
				all = next; renderList(); notify(chk.checked? 'Ativado':'Desativado','success');
			}catch(e){ console.error(e); notify(e.message,'error'); chk.checked = !chk.checked; }
		}));
	}

	function notify(m,t='info'){ const n=document.createElement('div'); n.className=`notification notification-${t} slide-up`; n.innerHTML=`<i class="fas ${t==='error'?'fa-exclamation-circle': t==='success'?'fa-check-circle':'fa-info-circle'}"></i><span>${m}</span>`; document.body.appendChild(n); setTimeout(()=>{n.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>n.remove(),300);},2500); }

	async function save(){
		const name=(els.name?.value||'').trim().replace(/^\//,'');
		const description=(els.desc?.value||'').trim();
		const type=(els.type?.value||'text');
		const contentRaw=(els.content?.value||'').trim();
		if(!name) return notify('Nome obrigatório','error');
		let payload;
		if(type==='embed'){
			try{ payload = contentRaw? JSON.parse(contentRaw): {}; }
			catch(e){ return notify('JSON inválido','error'); }
		} else { payload = contentRaw; }
		// merge/replace by name (case-insensitive)
		const key = name.toLowerCase();
		const next = (all||[]).filter(c=> (c?.name||'').toLowerCase()!==key).concat([{ name, description, type, content: payload, enabled: true }]);
		try{
			const r=await fetch(`/api/guild/${guildId}/commands`, {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({ commands: next })});
			const d=await r.json();
			if(!r.ok||!d.success) throw new Error((d.details&&d.details.join(', '))||d.error||`HTTP ${r.status}`);
			all = next; notify('Comando guardado','success');
		}catch(e){ console.error(e); notify(e.message,'error'); }
	}

	['input','change'].forEach(evt=>{ els.name?.addEventListener(evt, update); els.desc?.addEventListener(evt, update); els.type?.addEventListener(evt, update); els.content?.addEventListener(evt, update); });
	els.save?.addEventListener('click', save);

	function confirmModal(message, onOk){
		if(!els.modal||!els.modalBody||!els.modalOk||!els.modalCancel){ if(window.confirm(message)) onOk?.(); return; }
		els.modalBody.textContent = message;
		els.modal.style.display='block'; els.modal.setAttribute('aria-hidden','false');
		const close=()=>{ els.modal.style.display='none'; els.modal.setAttribute('aria-hidden','true'); els.modalOk.onclick=null; els.modalCancel.onclick=null; };
		els.modalOk.onclick = ()=>{ const fn=onOk; close(); Promise.resolve().then(()=>fn?.()); };
		els.modalCancel.onclick = close;
	}

	load().then(update);
})();
