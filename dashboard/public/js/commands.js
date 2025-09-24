(function(){
	const p=new URLSearchParams(window.location.search); const guildId=p.get('guildId');
	const els={ name:document.getElementById('cmdName'), desc:document.getElementById('cmdDesc'), type:document.getElementById('cmdType'), content:document.getElementById('cmdContent'), preview:document.getElementById('preview'), save:document.getElementById('save') };
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
		}catch(e){ console.error(e); notify(e.message,'error'); }
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
	load().then(update);
})();