const logger = require('../utils/logger');
(function(){
	// Ensure guild context
	try{
		const p0=new URLSearchParams(window.location.search); const gid0=p0.get('guildId');
		if(!gid0){
			const last=localStorage.getItem('IGNIS_LAST_GUILD');
			if(last){ const q=new URLSearchParams(window.location.search); q.set('guildId', last); const next=`${window.location.pathname}?${q.toString()}${window.location.hash||''}`; window.location.replace(next); return; }
			else { window.location.href='/dashboard'; return; }
		} else { try{ localStorage.setItem('IGNIS_LAST_GUILD', gid0); }catch(e) { logger.debug('Caught error:', e?.message || e); } }
	}catch(e) { logger.debug('Caught error:', e?.message || e); }
})();

(function(){
	const p=new URLSearchParams(window.location.search); const guildId=p.get('guildId');
	const grid=document.getElementById('perfGrid'); const sel=document.getElementById('refresh'); const btn=document.getElementById('refreshNow');
	const sparkMem=document.getElementById('sparkMem'); const sparkUsers=document.getElementById('sparkUsers');
	const tooltipEl = document.getElementById('tooltip');
	const deltaToggle = document.getElementById('showDeltaCards');
	let lastRendered = { metrics:null, history:[] };
	let timer=null;
	function notify(m,t='info'){const n=document.createElement('div'); n.className=`notification notification-${t} slide-up`; n.innerHTML=`<i class="fas ${t==='error'?'fa-exclamation-circle': t==='success'?'fa-check-circle':'fa-info-circle'}"></i><span>${m}</span>`; document.body.appendChild(n); setTimeout(()=>{n.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>n.remove(),300);},2500);}

	function formatTime(ms){ try{ const d=new Date(ms||Date.now()); return d.toLocaleTimeString('pt-PT', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' }); }catch{ return ''; } }
	function showTip(html, clientX, clientY){ if(!tooltipEl) return; tooltipEl.innerHTML = html; tooltipEl.style.display = 'block'; tooltipEl.setAttribute('aria-hidden','false'); // position with viewport clamping
		const pad = 10; const vw = window.innerWidth||800; const vh = window.innerHeight||600; const rect = tooltipEl.getBoundingClientRect(); let left = clientX + pad; let top = clientY + pad; if(left + rect.width > vw - pad) left = clientX - rect.width - pad; if(top + rect.height > vh - pad) top = clientY - rect.height - pad; if(left < pad) left = pad; if(top < pad) top = pad; tooltipEl.style.left = left + 'px'; tooltipEl.style.top = top + 'px'; }
	function hideTip(){ if(!tooltipEl) return; tooltipEl.style.display='none'; tooltipEl.setAttribute('aria-hidden','true'); }

	function attachSparkTooltip(el, series, times, label){ if(!el){ return; } const n = Array.isArray(series)? series.length : 0; if(!n){ el.onmousemove = null; el.onmouseleave = null; el.removeAttribute && el.removeAttribute('title'); return; }
		el.onmousemove = (e)=>{ const rect = el.getBoundingClientRect(); const x = Math.max(0, Math.min(rect.width, (e.clientX - rect.left))); const idx = Math.max(0, Math.min(n-1, Math.round((x/Math.max(1,rect.width))*(n-1)))); const val = series[idx]; const prev = series[Math.max(0, idx-1)]; const delta = (val - prev) || 0; const arrow = delta>0? '▲' : delta<0? '▼' : '—'; const ts = Array.isArray(times) && times[idx] ? times[idx] : Date.now(); const timeStr = formatTime(ts); const valueStr = `${val}`; const html = `<strong>${label}</strong> · ${valueStr} <span style="opacity:.8">(${arrow} ${Math.abs(delta)})</span><br/><small>${timeStr}</small>`; showTip(html, e.clientX, e.clientY); };
		el.onmouseleave = ()=>{ hideTip(); };
	}
	function render(m){ lastRendered.metrics = m.metrics||null; lastRendered.history = Array.isArray(m.history)? m.history : []; const u = (m.metrics?.uptimeSeconds||0); const mem=(m.metrics?.memoryMB||0); const heap=(m.metrics?.heapUsedMB||0); const ping=(m.metrics?.apiPing??'—'); const fmtU = (s)=>{ const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), ss=s%60; return `${h}h ${m}m ${ss}s`; }; const showDelta = !!(deltaToggle && deltaToggle.checked); let memDeltaHtml = ''; if(showDelta){ const hist = lastRendered.history.map(x=> x.memMB||0); const last = hist.at(-1); const prev = hist.at(-2); if(Number.isFinite(last) && Number.isFinite(prev)){ const d = last - prev; const arrow = d>0?'▲': d<0?'▼':'—'; memDeltaHtml = ` <span class="text-secondary" title="Δ desde última amostra">(${arrow} ${Math.abs(d)})</span>`; } } grid.innerHTML = [`<div class="stat-card"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-content"><div class="stat-value">${fmtU(u)}</div><div class="stat-label">Uptime</div></div></div>`,`<div class="stat-card"><div class="stat-icon"><i class="fas fa-memory"></i></div><div class="stat-content"><div class="stat-value">${mem} MB${memDeltaHtml}</div><div class="stat-label">Memória (RSS)</div></div></div>`,`<div class="stat-card"><div class="stat-icon"><i class="fas fa-database"></i></div><div class="stat-content"><div class="stat-value">${heap} MB</div><div class="stat-label">Heap Usado</div></div></div>`,`<div class="stat-card"><div class="stat-icon"><i class="fas fa-bolt"></i></div><div class="stat-content"><div class="stat-value">${ping}</div><div class="stat-label">Ping API</div></div></div>`].join(''); drawSparks(m.history||[]); }
	function drawSparks(history){
		const memSeries = history.map(h=> h.memMB||0);
		const usersSeries = history.map(h=> h.activeUsers||0);
		const times = history.map(h=> h.t || Date.now());
		sparkMem && (sparkMem.innerHTML = makeSpark(memSeries));
		sparkUsers && (sparkUsers.innerHTML = makeSpark(usersSeries));
		// labels
		const mmin = memSeries.length? Math.min(...memSeries): 0; const mmax = memSeries.length? Math.max(...memSeries): 0;
		const umin = usersSeries.length? Math.min(...usersSeries): 0; const umax = usersSeries.length? Math.max(...usersSeries): 0;
		const mm = document.getElementById('memMin'); if(mm) mm.textContent = `min ${mmin}`;
		const mx = document.getElementById('memMax'); if(mx) mx.textContent = `max ${mmax}`;
		const um = document.getElementById('usersMin'); if(um) um.textContent = `min ${umin}`;
		const ux = document.getElementById('usersMax'); if(ux) ux.textContent = `max ${umax}`;
		// trends
		const memTrend = document.getElementById('memTrend');
		if(memTrend){ const last = memSeries.at(-1) ?? 0; const prev = memSeries.at(-2) ?? last; const delta = last - prev; memTrend.className = 'trend ' + (delta>0?'up': delta<0?'down':''); memTrend.innerHTML = `${delta>0?'▲':delta<0?'▼':'—'} ${Math.abs(delta)}`; }
		const usersTrend = document.getElementById('usersTrend');
		if(usersTrend){ const last = usersSeries.at(-1) ?? 0; const prev = usersSeries.at(-2) ?? last; const delta = last - prev; usersTrend.className = 'trend ' + (delta>0?'up': delta<0?'down':''); usersTrend.innerHTML = `${delta>0?'▲':delta<0?'▼':'—'} ${Math.abs(delta)}`; }
		// tooltips via title with last value
		if(sparkMem) sparkMem.title = memSeries.length? `Último: ${memSeries.at(-1)} (Δ ${((memSeries.at(-1)??0)-(memSeries.at(-2)??memSeries.at(-1)))})` : 'Sem dados';
		if(sparkUsers) sparkUsers.title = usersSeries.length? `Último: ${usersSeries.at(-1)} (Δ ${((usersSeries.at(-1)??0)-(usersSeries.at(-2)??usersSeries.at(-1)))})` : 'Sem dados';
		// interactive nearest-point tooltip
		attachSparkTooltip(sparkMem, memSeries, times, 'Memória (MB)');
		attachSparkTooltip(sparkUsers, usersSeries, times, 'Utilizadores Ativos');
	}
	function makeSpark(series){
		if(!series.length) return '<svg></svg>';
		const w=300,h=60; const min=Math.min(...series), max=Math.max(...series);
		const dx = series.length>1? (w/(series.length-1)): 0; const rng = (max-min)||1;
		const pts = series.map((v,i)=>{
			const x = Math.round(i*dx);
			const y = Math.round(h - ((v-min)/rng)*h);
			return `${x},${y}`;
		});
		return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts.join(' ')}" class="sparkline" style="fill:none;stroke:var(--accent);stroke-width:2"/></svg>`;
	}
	async function fetchPerf(){ try{ const r=await fetch(`/api/guild/${guildId}/performance`, {credentials:'same-origin'}); const d=await r.json(); if(!r.ok||!d.success) throw new Error(d.error||`HTTP ${r.status}`); render(d); }catch(e){console.error(e); notify(e.message,'error');} }
	function setTimer(){ if(timer) clearInterval(timer); const sec=parseInt(sel?.value||'0',10); if(sec>0){ timer=setInterval(fetchPerf, sec*1000); } }
	sel?.addEventListener('change', ()=>{ setTimer(); }); btn?.addEventListener('click', fetchPerf); if(deltaToggle){ deltaToggle.addEventListener('change', ()=>{ if(lastRendered && lastRendered.metrics){ render({ metrics: lastRendered.metrics, history: lastRendered.history }); } }); } fetchPerf(); setTimer();
})();
