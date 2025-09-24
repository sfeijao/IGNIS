(function(){
	const p=new URLSearchParams(window.location.search); const guildId=p.get('guildId');
	const grid=document.getElementById('perfGrid'); const sel=document.getElementById('refresh'); const btn=document.getElementById('refreshNow');
	const sparkMem=document.getElementById('sparkMem'); const sparkUsers=document.getElementById('sparkUsers');
	let timer=null;
	function notify(m,t='info'){const n=document.createElement('div'); n.className=`notification notification-${t} slide-up`; n.innerHTML=`<i class="fas ${t==='error'?'fa-exclamation-circle': t==='success'?'fa-check-circle':'fa-info-circle'}"></i><span>${m}</span>`; document.body.appendChild(n); setTimeout(()=>{n.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>n.remove(),300);},2500);} 
	function render(m){ const u = (m.metrics?.uptimeSeconds||0); const mem=(m.metrics?.memoryMB||0); const heap=(m.metrics?.heapUsedMB||0); const ping=(m.metrics?.apiPing??'—'); const fmtU = (s)=>{ const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), ss=s%60; return `${h}h ${m}m ${ss}s`; }; grid.innerHTML = [`<div class="stat-card"><div class="stat-icon"><i class="fas fa-clock"></i></div><div class="stat-content"><div class="stat-value">${fmtU(u)}</div><div class="stat-label">Uptime</div></div></div>`,`<div class="stat-card"><div class="stat-icon"><i class="fas fa-memory"></i></div><div class="stat-content"><div class="stat-value">${mem} MB</div><div class="stat-label">Memória (RSS)</div></div></div>`,`<div class="stat-card"><div class="stat-icon"><i class="fas fa-database"></i></div><div class="stat-content"><div class="stat-value">${heap} MB</div><div class="stat-label">Heap Usado</div></div></div>`,`<div class="stat-card"><div class="stat-icon"><i class="fas fa-bolt"></i></div><div class="stat-content"><div class="stat-value">${ping}</div><div class="stat-label">Ping API</div></div></div>`].join(''); drawSparks(m.history||[]); }
	function drawSparks(history){
		const memSeries = history.map(h=> h.memMB||0);
		const usersSeries = history.map(h=> h.activeUsers||0);
		sparkMem && (sparkMem.innerHTML = makeSpark(memSeries));
		sparkUsers && (sparkUsers.innerHTML = makeSpark(usersSeries));
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
	sel?.addEventListener('change', ()=>{ setTimer(); }); btn?.addEventListener('click', fetchPerf); fetchPerf(); setTimer(); 
})();