const logger = require('../utils/logger');
(function(){
	// Ensure guild context
	try{
		const p0=new URLSearchParams(window.location.search);
		const gid0=p0.get('guildId');
		if(!gid0){
			const last=localStorage.getItem('IGNIS_LAST_GUILD');
			if(last){
				const q=new URLSearchParams(window.location.search);
				q.set('guildId', last);
				const next=`${window.location.pathname}?${q.toString()}${window.location.hash||''}`;
				window.location.replace(next);
				return;
			} else {
				window.location.href='/dashboard';
				return;
			}
		} else {
			try{ localStorage.setItem('IGNIS_LAST_GUILD', gid0); }catch(e) { logger.debug('Caught error:', e?.message || e); }
		}
	}catch(e) { logger.debug('Caught error:', e?.message || e); }
})();

(function(){ const p=new URLSearchParams(window.location.search); const guildId=p.get('guildId'); const statsEl=document.getElementById('diagStats'); const listEl=document.getElementById('diagList'); function notify(m,t='info'){const n=document.createElement('div'); n.className=`notification notification-${t} slide-up`; n.innerHTML=`<i class="fas ${t==='error'?'fa-exclamation-circle': t==='success'?'fa-check-circle':'fa-info-circle'}"></i><span>${m}</span>`; document.body.appendChild(n); setTimeout(()=>{n.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>n.remove(),300);},2500);} async function load(){ try{ const r=await fetch(`/api/guild/${guildId}/diagnostics`, {credentials:'same-origin'}); const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`); const s=d.stats||{}; statsEl.innerHTML = [`<div class="stat-card"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-content"><div class="stat-value">${s.memberCount||0}</div><div class="stat-label">Membros</div></div></div>`,`<div class="stat-card"><div class="stat-icon"><i class="fas fa-sitemap"></i></div><div class="stat-content"><div class="stat-value">${s.roleCount||0}</div><div class="stat-label">Cargos</div></div></div>`,`<div class="stat-card"><div class="stat-icon"><i class="fas fa-hashtag"></i></div><div class="stat-content"><div class="stat-value">${s.channelCount||0}</div><div class="stat-label">Canais</div></div></div>`].join(''); const suggestions=Array.isArray(d.suggestions)?d.suggestions:[]; if(!suggestions.length){ listEl.innerHTML = '<li><i class="icon fas fa-check-circle"></i> Sem sugestões no momento — ótimo trabalho!</li>'; } else { listEl.innerHTML = suggestions.map(s=>`<li><i class=\"icon fas fa-lightbulb\"></i> ${escapeHtml(s.message||'')}</li>`).join(''); } }catch(e){console.error(e); notify(e.message,'error');} } function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); } load(); })();
