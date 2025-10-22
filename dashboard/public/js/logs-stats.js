(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const avgRes = document.getElementById('avgRes');
  const chartTicketsEl = document.getElementById('chartTickets');
  const chartModEl = document.getElementById('chartMod');

  function msToHuman(ms){
    if(!ms) return '—';
    const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
    return `${h}h ${m}m`;
  }

  async function api(path){
    const { ok, json } = await window.IGNISFetch.fetchJsonCached(path, { ttlMs: 60_000, credentials:'same-origin' });
    if(!ok) throw new Error(json?.error||'Request failed');
    return json;
  }

  async function load(){
    const d = await api(`/api/guild/${guildId}/mod/stats?days=14`);
    const tp = d.charts?.ticketsPerDay||[];
    const mod = d.charts?.modActionsByType||[];
    avgRes.textContent = msToHuman(d.charts?.avgResolutionMs||0);
    // tickets
    new Chart(chartTicketsEl, {
      type: 'line',
      data: { labels: tp.map(x=>x.date), datasets: [{ label: 'Tickets', data: tp.map(x=>x.count), borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.2)' }] },
      options: { plugins: { legend: { labels: { color:'#fff' } } }, scales: { x: { ticks:{ color:'#ccc' } }, y:{ ticks:{ color:'#ccc' } } } }
    });
    // moderation
    new Chart(chartModEl, {
      type: 'bar',
      data: { labels: mod.map(x=>x.type), datasets: [{ label: 'Ações', data: mod.map(x=>x.count), backgroundColor: ['#ef4444','#f59e0b','#3b82f6','#22c55e','#7C3AED'] }] },
      options: { plugins: { legend: { labels: { color:'#fff' } } }, scales: { x: { ticks:{ color:'#ccc' } }, y:{ ticks:{ color:'#ccc' } } } }
    });
  }

  if(!guildId) { console.warn('guildId em falta'); return; }
  load().catch(e=>console.error(e));
})();
