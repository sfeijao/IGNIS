const logger = require('../utils/logger');
// Tags management with selection, bulk actions, and drag-and-drop reordering
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
			try{ localStorage.setItem('IGNIS_LAST_GUILD', gid); }catch(e) { logger.debug('Caught error:', e?.message || e); }
		}
	}catch(e) { logger.debug('Caught error:', e?.message || e); }
})();

(function(){
	const p=new URLSearchParams(window.location.search); const guildId=p.get('guildId');
	const els={
		list:document.getElementById('tagsList'), name:document.getElementById('tagName'), text:document.getElementById('tagText'), category:document.getElementById('tagCategory'), add:document.getElementById('addTag'),
		search:document.getElementById('search'), filterCategory:document.getElementById('filterCategory'), resetFilters:document.getElementById('resetFilters'),
		selectAll:document.getElementById('selectAll'), clearSelection:document.getElementById('clearSelection'), deleteSelected:document.getElementById('deleteSelected'),
		bulkCategory:document.getElementById('bulkCategory'), moveSelected:document.getElementById('moveSelected'), clearCategorySelected:document.getElementById('clearCategorySelected'),
		renameCategoryFrom:document.getElementById('renameCategoryFrom'), renameCategoryTo:document.getElementById('renameCategoryTo'), renameCategory:document.getElementById('renameCategory'),
		deleteCategoryName:document.getElementById('deleteCategoryName'), deleteCategory:document.getElementById('deleteCategory'),
		live:document.getElementById('a11yLive'),
		categoryBadges:document.getElementById('categoryBadges'),
		catColumns:document.getElementById('catColumns')
	};

	let _allTags=[]; let _sel=new Set();
	let dragState = { fromIndex: null };

	function notify(m,t='info'){ const n=document.createElement('div'); n.className=`notification notification-${t} slide-up`; n.innerHTML=`<i class="fas ${t==='error'?'fa-exclamation-circle': t==='success'?'fa-check-circle':'fa-info-circle'}"></i><span>${m}</span>`; document.body.appendChild(n); setTimeout(()=>{n.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>n.remove(),300);},2500); announce(m); }
	function announce(msg){ try{ if(els.live){ els.live.textContent=''; setTimeout(()=>{ els.live.textContent = msg; }, 50);} }catch(e) { logger.debug('Caught error:', e?.message || e); }
	}

	async function load(){ try{ const r=await fetch(`/api/guild/${guildId}/quick-tags`, {credentials:'same-origin'}); const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`); _allTags=Array.isArray(d.tags)?d.tags:[]; renderFilters(); render(); renderCategoryColumns(); }catch(e){console.error(e); notify(e.message,'error');} }

	function categories(){ return [...new Set(_allTags.map(t=>String(t?.category||'').trim()).filter(Boolean))]; }

	function renderFilters(){ const cats=categories(); if(els.filterCategory){ els.filterCategory.innerHTML = '<option value="">Todas as categorias</option>' + cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join(''); } if(els.renameCategoryFrom) els.renameCategoryFrom.innerHTML = '<option value="">(Selecionar)</option>' + cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join(''); if(els.deleteCategoryName) els.deleteCategoryName.innerHTML = '<option value="">(Selecionar)</option>' + cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join(''); renderCategoryBadges(); }

	function renderCategoryBadges(){ if(!els.categoryBadges) return; const cats=categories(); const items=[]; const noneCount = (_allTags||[]).filter(t=>!t.category).length; items.push(`<span class="badge">Sem categoria: ${noneCount}</span>`); for(const c of cats){ const cnt = (_allTags||[]).filter(t=> String(t?.category||'')===c).length; items.push(`<span class="badge">${escapeHtml(c)}: ${cnt}</span>`); } els.categoryBadges.innerHTML = items.join(' '); }

	function renderCategoryColumns(){ if(!els.catColumns) return; const cats = categories(); const special = ['(Sem categoria)']; const allCols = special.concat(cats);
		// counts per category
		const counts = {};
		counts['(Sem categoria)'] = (_allTags||[]).filter(t=>!t.category).length;
		for(const c of cats){ counts[c] = (_allTags||[]).filter(t=> String(t?.category||'')===c).length; }
		els.catColumns.innerHTML = allCols.map(cat=>`<div class="cat-col" data-cat="${escapeHtml(cat)}" tabindex="0"><div class="text-secondary mb-8"><span class="cat-name">${escapeHtml(cat)}</span> <span class="cat-count">(${counts[cat]||0})</span></div><div class="cat-droparea" aria-label="Solte aqui"></div></div>`).join('');
		els.catColumns.querySelectorAll('.cat-col').forEach(col=>{ const cat = col.getAttribute('data-cat'); const baseCount = counts[cat]||0; const countEl = col.querySelector('.cat-count');
			const updatePreview = ()=>{ if(!countEl) return; const fromIndex = dragState.fromIndex; if(fromIndex==null || Number.isNaN(fromIndex)) { countEl.textContent = `(${baseCount})`; return; } const fromTag = _allTags[fromIndex]; const fromCat = String(fromTag?.category||'') || '(Sem categoria)'; const delta = (fromCat===cat)? 0 : 1; countEl.textContent = `(${baseCount + delta})`; };
			col.addEventListener('dragenter', ()=>{ col.classList.add('drag-over'); updatePreview(); });
			col.addEventListener('dragleave', ()=>{ col.classList.remove('drag-over'); if(countEl) countEl.textContent = `(${baseCount})`; });
			col.addEventListener('dragover', (ev)=>{ ev.preventDefault(); updatePreview(); });
			col.addEventListener('drop', async(ev)=>{ ev.preventDefault(); col.classList.remove('drag-over'); if(countEl) countEl.textContent = `(${baseCount})`; const data = ev.dataTransfer.getData('text/plain'); const fromIndex = parseInt(data,10); if(Number.isNaN(fromIndex)) return; const target = col.getAttribute('data-cat'); const next=_allTags.map((t,i)=> i===fromIndex? (target==='(Sem categoria)'? ({ name:t.name, text:t.text }): { ...t, category: target }): t); await saveAll(next, 'Movido'); announce(`Item movido para categoria ${target}`); }); }); }

	function currentFilters(){ const q=(els.search?.value||'').toLowerCase(); const cat=(els.filterCategory?.value||'').trim(); return { q, cat }; }

	function render(){
		const {q,cat}=currentFilters();
		const list = (_allTags||[]).filter(t=>{ const name=(t?.name||'').toLowerCase(); const text=(t?.text||'').toLowerCase(); const matchesQ = !q || name.includes(q) || text.includes(q); const matchesCat = !cat || String(t?.category||'')===cat; return matchesQ && matchesCat; });

		els.list.innerHTML = list.map((t)=>{
			const idx = (_allTags||[]).indexOf(t);
			const checked=_sel.has(idx)?'checked':'';
			return `<div class="tag" data-i="${idx}" draggable="true">
				<div class="tag-left">
					<span class="drag-handle" title="Arrastar"><i class="fas fa-grip-vertical"></i></span>
					<input type="checkbox" class="sel" data-i="${idx}" ${checked} />
					<div><strong>${escapeHtml(t?.name||'')}</strong> — ${escapeHtml(t?.text||'')}</div>
					${t?.category?`<div class=\"mt-4\"><span class=\"badge\">${escapeHtml(t.category)}</span></div>`:''}
				</div>
				<div class="tag-actions">
					<button data-act="up" data-i="${idx}" class="btn btn-glass btn-sm" title="Subir"><i class="fas fa-arrow-up"></i></button>
					<button data-act="down" data-i="${idx}" class="btn btn-glass btn-sm" title="Descer"><i class="fas fa-arrow-down"></i></button>
					<button data-act="remove" data-i="${idx}" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i></button>
				</div>
			</div>`;
		}).join('');

		// Selection checkboxes
		els.list.querySelectorAll('input.sel').forEach(chk=> chk.addEventListener('change', ()=>{ const i=parseInt(chk.getAttribute('data-i'),10); if(Number.isNaN(i)) return; if(chk.checked) _sel.add(i); else _sel.delete(i); }));

		// Button actions
		els.list.querySelectorAll('button[data-act]').forEach(btn=> btn.addEventListener('click', async()=>{ const act=btn.getAttribute('data-act'); const idx=parseInt(btn.getAttribute('data-i'),10); if(Number.isNaN(idx)) return; if(act==='remove'){ const name=_allTags[idx]?.name||'tag'; const ok = (window.UI && UI.confirm)? await UI.confirm(`Eliminar tag ${name}?`) : window.confirm(`Eliminar tag ${name}?`); if(!ok) return; const next=(_allTags||[]).filter((_,j)=>j!==idx); _sel.delete(idx); await saveAll(next, 'Removido'); announce(`Tag ${name} eliminada`); } else if(act==='up' && idx>0){ const next=_allTags.slice(); [next[idx-1], next[idx]] = [next[idx], next[idx-1]]; await saveAll(next, 'Reordenado'); announce('Item movido para cima'); } else if(act==='down' && idx<_allTags.length-1){ const next=_allTags.slice(); [next[idx+1], next[idx]] = [next[idx], next[idx+1]]; await saveAll(next, 'Reordenado'); announce('Item movido para baixo'); } }) );

		// Drag & Drop events per row
		els.list.querySelectorAll('.tag').forEach(row=>{
			row.addEventListener('dragstart', (ev)=>{
				const i = parseInt(row.getAttribute('data-i'),10);
				dragState.fromIndex = Number.isNaN(i)? null : i;
				ev.dataTransfer.effectAllowed = 'move';
				try{ ev.dataTransfer.setData('text/plain', String(i)); }catch(e) { logger.debug('Caught error:', e?.message || e); }
			});
			row.addEventListener('dragenter', ()=>{ row.classList.add('drag-over'); });
			row.addEventListener('dragleave', ()=>{ row.classList.remove('drag-over'); });
			row.addEventListener('dragover', (ev)=>{ ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; });
			row.addEventListener('drop', async(ev)=>{
				ev.preventDefault(); row.classList.remove('drag-over');
				const toIndex = parseInt(row.getAttribute('data-i'),10);
				const fromIndex = dragState.fromIndex;
				dragState.fromIndex = null;
				if(Number.isNaN(toIndex) || Number.isNaN(fromIndex) || toIndex===fromIndex) return;

				const next=_allTags.slice();
				const [moved] = next.splice(fromIndex,1);
				next.splice(toIndex,0,moved);
				await saveAll(next, 'Reordenado'); announce('Ordem atualizada');
			});
			row.addEventListener('dragend', ()=>{ row.classList.remove('drag-over'); dragState.fromIndex=null; });
			// Keyboard reordering (focus on drag handle or row)
			row.setAttribute('tabindex','0');
			row.addEventListener('keydown', async(e)=>{
				const idx = parseInt(row.getAttribute('data-i'),10);
				if(Number.isNaN(idx)) return;
				if(e.key==='ArrowUp' && idx>0){ e.preventDefault(); const next=_allTags.slice(); [next[idx-1], next[idx]]=[next[idx], next[idx-1]]; await saveAll(next,'Reordenado'); announce('Item movido para cima'); const prev=els.list.querySelector(`.tag[data-i="${idx-1}"]`); prev?.focus(); }
				if(e.key==='ArrowDown' && idx<_allTags.length-1){ e.preventDefault(); const next=_allTags.slice(); [next[idx+1], next[idx]]=[next[idx], next[idx+1]]; await saveAll(next,'Reordenado'); announce('Item movido para baixo'); const nxt=els.list.querySelector(`.tag[data-i="${idx+1}"]`); nxt?.focus(); }
			});
			// Basic touch support
			let touchStartY=null; let touchFromIndex=null;
			row.addEventListener('touchstart', (ev)=>{ touchStartY = ev.touches[0].clientY; touchFromIndex = parseInt(row.getAttribute('data-i'),10); }, {passive:true});
			row.addEventListener('touchmove', (ev)=>{ ev.preventDefault(); }, {passive:false});
			row.addEventListener('touchend', async(ev)=>{
				if(touchStartY==null) return; const dy = (ev.changedTouches && ev.changedTouches[0]?.clientY || 0) - touchStartY;
				const from = touchFromIndex; touchStartY=null; touchFromIndex=null; if(Number.isNaN(from)) return;
				let to = from + (dy>20? 1: dy<-20? -1: 0);
				if(to<0||to>=_allTags.length||to===from) return;
				const next=_allTags.slice(); const [m]=next.splice(from,1); next.splice(to,0,m); await saveAll(next,'Reordenado'); announce('Ordem atualizada');
			});
		});
	}

	async function saveAll(next, okMsg='Guardado'){
		const r=await fetch(`/api/guild/${guildId}/quick-tags`, {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({ tags: next })});
		const d=await r.json();
		if(d?.success){ _allTags = next; _sel = new Set(); renderFilters(); render(); renderCategoryColumns(); notify(okMsg,'success'); }
	}

	function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); }

	// Bulk actions
	els.selectAll?.addEventListener('click', ()=>{ _sel = new Set(_allTags.map((_,i)=>i)); render(); });
	els.clearSelection?.addEventListener('click', ()=>{ _sel = new Set(); render(); });
	els.deleteSelected?.addEventListener('click', async()=>{ if(_sel.size===0) return; const ok=(window.UI && UI.confirm)? await UI.confirm(`Eliminar ${_sel.size} selecionadas?`) : window.confirm(`Eliminar ${_sel.size} selecionadas?`); if(!ok) return; const next=_allTags.filter((_,i)=>!_sel.has(i)); _sel=new Set(); await saveAll(next, 'Excluídos'); announce('Tags selecionadas excluídas'); });
	els.moveSelected?.addEventListener('click', async()=>{ const cat=(els.bulkCategory?.value||'').trim(); if(!cat) return notify('Escreva a categoria','error'); if(_sel.size===0) return; const next=_allTags.map((t,i)=> _sel.has(i)? { ...t, category: cat }: t); await saveAll(next, 'Movidos'); });
	els.clearCategorySelected?.addEventListener('click', async()=>{ if(_sel.size===0) return; const next=_allTags.map((t,i)=> _sel.has(i)? ({ name:t.name, text:t.text }): t); await saveAll(next,'Categorias limpas'); announce('Categoria removida dos selecionados'); });
	els.renameCategory?.addEventListener('click', async()=>{ const from=(els.renameCategoryFrom?.value||'').trim(); const to=(els.renameCategoryTo?.value||'').trim(); if(!from||!to) return; const next=_allTags.map(t=> String(t?.category||'')===from? { ...t, category: to }: t); await saveAll(next, 'Categoria renomeada'); announce(`Categoria ${from} renomeada para ${to}`); });
	els.deleteCategory?.addEventListener('click', async()=>{ const name=(els.deleteCategoryName?.value||'').trim(); if(!name) return; const next=_allTags.map(t=> String(t?.category||'')===name? ({ name:t.name, text:t.text }): t); await saveAll(next, 'Categoria removida'); announce(`Categoria ${name} removida`); });

	// Add new tag
	els.add?.addEventListener('click', async ()=>{ const name=(els.name?.value||'').trim(); const text=(els.text?.value||'').trim(); const category=(els.category?.value||'').trim(); if(!name||!text) return notify('Preencha nome e conteúdo','error'); try{ const next=[..._allTags, { name, text, category: category||undefined }]; const r=await fetch(`/api/guild/${guildId}/quick-tags`, {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({ tags: next })}); const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`); notify('Adicionado','success'); announce(`Tag ${name} adicionada`); els.name.value=''; els.text.value=''; if(els.category) els.category.value=''; _allTags = next; renderFilters(); render(); }catch(e){console.error(e); notify(e.message,'error');} });

	// Search/filters
	els.search?.addEventListener('input', render); els.filterCategory?.addEventListener('change', render); els.resetFilters?.addEventListener('click', ()=>{ if(els.search) els.search.value=''; if(els.filterCategory) els.filterCategory.value=''; render(); });

	load();
})();
