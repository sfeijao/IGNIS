(function(){
  const qs = (k)=>new URLSearchParams(location.search).get(k);
  const guildId = qs('guildId');
  const ticketId = qs('ticketId');
  const el = (id)=>document.getElementById(id);
  const $ = (sel)=>document.querySelector(sel);

  const state = { guildId, ticketId, ticket: null };

  function badgeClass(status){
    switch(status){
      case 'open': return 'badge-open';
      case 'claimed': return 'badge-claimed';
      case 'waiting': return 'badge-waiting';
      case 'closed': return 'badge-closed';
      default: return '';
    }
  }

  function setBadges(t){
    el('t-id').textContent = `#${t.id}`;
    el('t-status').textContent = (({
      open:'ABERTO', claimed:'RECLAMADO', closed:'FECHADO', pending:'PENDENTE'
    })[t.status] || (t.status||'open').toUpperCase());
    el('t-status').className = `badge ${badgeClass(t.status)}`;
    el('t-priority').textContent = (t.priority||'normal').toUpperCase();
    el('t-sla').textContent = timeAgo(new Date(t.created_at));
    const lockPill = el('t-locked');
    if (lockPill) {
      if (t.locked) {
        lockPill.classList.remove('hidden');
      } else {
        lockPill.classList.add('hidden');
      }
    }
  }

  function timeAgo(date){
    const now = new Date();
    const diff = now - date;
    const m = Math.floor(diff/60000), h = Math.floor(m/60), d = Math.floor(h/24);
    if(d>0) return `${d}d`;
    if(h>0) return `${h}h`;
    if(m>0) return `${m}m`;
    return 'agora';
  }

  function renderMessages(msgs){
    const box = el('messages');
    box.innerHTML = '';
    (msgs||[]).forEach(m=>{
      const item = document.createElement('div');
      item.className = `bubble other`;
      item.innerHTML = `
        <div class='meta'>
          <span>${m.author?.username || 'utilizador'}</span>
          <span>${new Date(m.timestamp).toLocaleString('pt-PT')}</span>
        </div>
        <div>${m.content ? escapeHtml(m.content) : '<em>Mensagem vazia</em>'}</div>
      `;
      box.appendChild(item);
    });
    box.scrollTop = box.scrollHeight;
  }

  function escapeHtml(text){
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  async function load(){
    if(!guildId || !ticketId){
      alert('Parâmetros inválidos');
      return;
    }
    const res = await fetch(`/api/guild/${guildId}/tickets/${ticketId}`);
    const data = await res.json();
    if(!data.success){
      alert('Erro a carregar ticket');
      return;
    }
    state.ticket = data.ticket;
    setBadges(state.ticket);
    el('t-title').textContent = state.ticket.subject || `Ticket #${state.ticket.id}`;
    el('author-tag').textContent = state.ticket.ownerTag || '-';
    el('author-id').textContent = state.ticket.user_id || '-';
    el('guild-id').textContent = state.ticket.guild_id;
    el('channel-name').textContent = state.ticket.channelName || '-';
    const channelUrl = `https://discord.com/channels/${state.ticket.guild_id}/${state.ticket.channel_id}`;
    el('channel-link').href = channelUrl;
    renderMessages(state.ticket.messages);

    // Toggle action buttons by status
    const s = (state.ticket.status||'open');
    $('#btn-claim').style.display = s==='open' ? 'inline-flex' : 'none';
    $('#btn-release').style.display = s==='claimed' ? 'inline-flex' : 'none';
    $('#btn-close').style.display = (s==='open'||s==='claimed') ? 'inline-flex' : 'none';
    $('#btn-reopen').style.display = s==='closed' ? 'inline-flex' : 'none';
  }

  async function action(type, body={}){
    const res = await fetch(`/api/guild/${guildId}/tickets/${ticketId}/action`,{
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:type, data: body })
    });
    const data = await res.json();
    if(!data.success){
      alert(data.error || data.message || 'Erro');
      return false;
    }
    await load();
    return true;
  }

  // Events
  document.addEventListener('DOMContentLoaded', ()=>{
    load();
    el('btn-claim').addEventListener('click', ()=> action('claim'));
    el('btn-release').addEventListener('click', ()=> action('release'));
    el('btn-close').addEventListener('click', ()=> {
      const reason = prompt('Motivo do fechamento (opcional):');
      action('close', { reason: reason || 'Fechado via painel' });
    });
    el('btn-reopen').addEventListener('click', ()=> action('reopen'));
    el('btn-send').addEventListener('click', async ()=>{
      const content = el('reply').value.trim();
      if(!content) return;
      const ok = await action('reply', { content });
      if(ok) el('reply').value='';
    });
    el('btn-note').addEventListener('click', async ()=>{
      const content = el('reply').value.trim();
      if(!content) return;
      const ok = await action('addNote', { content });
      if(ok) el('reply').value='';
    });
    el('btn-export-json').addEventListener('click', ()=>{
      window.open(`/api/guild/${guildId}/tickets/${ticketId}`,'_blank');
    });
    el('btn-transcript').addEventListener('click', ()=>{
      window.open(`/api/guild/${guildId}/tickets/${ticketId}?download=transcript`,'_blank');
    });
  });
})();
