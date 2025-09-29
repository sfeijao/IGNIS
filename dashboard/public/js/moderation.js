(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const els = {
    window: document.getElementById('window'),
    q: document.getElementById('q'),
    from: document.getElementById('from'),
    to: document.getElementById('to'),
    userId: document.getElementById('userId'),
    moderatorId: document.getElementById('moderatorId'),
    channelId: document.getElementById('channelId'),
    btnRefresh: document.getElementById('btnRefresh'),
    btnAuto: document.getElementById('btnAuto'),
    btnExport: document.getElementById('btnExport'),
    exportFormat: document.getElementById('exportFormat'),
    stats: {
      bans: document.getElementById('countBans'),
      msgDel: document.getElementById('countMsgDel'),
      msgEdit: document.getElementById('countMsgEdit'),
      jl: document.getElementById('countJoinsLeaves'),
      voice: document.getElementById('countVoice')
    },
    feed: document.getElementById('feed'),
    filterButtons: Array.from(document.querySelectorAll('.btn-toggle[data-filter]')),
    modal: document.getElementById('moderationModal'),
    modalTitle: document.getElementById('modModalTitle'),
    modalBody: document.getElementById('modModalBody')
  };

  let autoTimer = null;
  let currentFamily = 'all';

  function notify(msg, type='info'){
    const n = document.createElement('div');
    n.className = `notification notification-${type} slide-up`;
    n.innerHTML = `<i class="fas ${type==='error'?'fa-exclamation-circle': type==='success'?'fa-check-circle':'fa-info-circle'}"></i><span>${msg}</span>`;
    document.body.appendChild(n);
    setTimeout(()=>{n.style.animation='slideDown 0.3s ease-in'; setTimeout(()=>n.remove(),300);},2500);
  }

  // Modal helpers and polished confirmation UI
  function isModalVisible(){ return els.modal && els.modal.classList.contains('modal-visible'); }
  function openModal(title, html){
    if (!els.modal) return;
    if (title != null) els.modalTitle.textContent = title;
    if (html != null) els.modalBody.innerHTML = html;
    els.modal.classList.remove('modal-hidden');
    els.modal.classList.add('modal-visible');
    els.modal.setAttribute('aria-hidden','false');
  }
  function closeModal(){
    if (!els.modal) return;
    // clean any transient confirm blocks
    try { els.modalBody?.querySelectorAll?.('.confirm-block')?.forEach(n=> n.remove()); } catch {}
    els.modal.classList.add('modal-hidden');
    els.modal.classList.remove('modal-visible');
    els.modal.setAttribute('aria-hidden','true');
  }
  function buildConfirmBlock(plan){
    const risks = Array.isArray(plan?.risks) ? plan.risks : [];
    const planObj = plan?.plan ?? plan;
    const pre = escapeHtml(JSON.stringify(planObj, null, 2));
    return `
      <div class="confirm-block" style="margin-top:10px">
        <div class="kv"><b>Pré-visualização</b> (sem aplicar alterações)</div>
        ${risks.length ? `<div class="alert alert-warning" style="margin-top:8px"><b>Riscos potenciais</b><ul>${risks.map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul></div>`:''}
        <pre class="code-block" style="margin-top:8px" id="__confirmPlanPre">${pre}</pre>
        <div class="actions-row" style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap">
          <button class="btn" data-confirm-cancel><i class="fas fa-times"></i> Cancelar</button>
          <button class="btn" data-copy-plan><i class="fas fa-copy"></i> Copiar</button>
          <button class="btn btn-primary" data-confirm-apply><i class="fas fa-check"></i> Confirmar</button>
        </div>
      </div>`;
  }
  function attachConfirmHandlers(container, onConfirm, onCancel){
    const btnCancel = container.querySelector('[data-confirm-cancel]');
    const btnCopy = container.querySelector('[data-copy-plan]');
    const btnApply = container.querySelector('[data-confirm-apply]');
    const getText = () => {
      const pre = container.querySelector('#__confirmPlanPre');
      return pre ? pre.textContent : '';
    };
    const copyText = async () => {
      const text = getText();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        }
        notify('Plano copiado para a área de transferência','success');
      } catch(e){ notify('Não foi possível copiar','error'); }
    };
    btnCancel?.addEventListener('click', ()=>{ onCancel?.(); });
    btnCopy?.addEventListener('click', copyText);
    btnApply?.addEventListener('click', ()=>{ onConfirm?.(); });
  }
  // Show confirmation as a new modal replacing current content; returns Promise<boolean>
  function showConfirmModal(plan, title){
    return new Promise(resolve => {
      openModal(title || 'Confirmar alterações', buildConfirmBlock(plan));
      const block = els.modalBody.querySelector('.confirm-block');
      attachConfirmHandlers(block, ()=>{ closeModal(); resolve(true); }, ()=>{ closeModal(); resolve(false); });
    });
  }
  // Inject confirmation block into current, already open modal; returns Promise<boolean>
  function injectConfirmInCurrentModal(plan){
    return new Promise(resolve => {
      // remove any prior confirm blocks to avoid stacking
      els.modalBody.querySelectorAll('.confirm-block')?.forEach(n=> n.remove());
      els.modalBody.insertAdjacentHTML('beforeend', buildConfirmBlock(plan));
      const block = els.modalBody.querySelector('.confirm-block');
      attachConfirmHandlers(block, ()=>{ block.remove(); resolve(true); }, ()=>{ block.remove(); resolve(false); });
    });
  }

  function buildTypeParam(){
    switch(currentFamily){
      case 'messages': return 'mod_message*';
      case 'members': return 'mod_member*';
      case 'voice': return 'mod_voice*';
      case 'bans': return 'mod_ban*';
      default: return 'mod_*';
    }
  }

  function buildRange(url){
    const from = (els.from?.value||'').trim(); if (from) url.searchParams.set('from', from);
    const to = (els.to?.value||'').trim(); if (to) url.searchParams.set('to', to);
    const q = (els.q?.value||'').trim(); if (q) url.searchParams.set('q', q);
    const userId = (els.userId?.value||'').trim(); if (userId) url.searchParams.set('userId', userId);
    const modId = (els.moderatorId?.value||'').trim(); if (modId) url.searchParams.set('moderatorId', modId);
    const channelId = (els.channelId?.value||'').trim(); if (channelId) url.searchParams.set('channelId', channelId);
    return url;
  }

  async function loadSummary(){
    if (!guildId) return; // guildId is required
    try {
      const w = (els.window?.value||'24h');
      const u = new URL(`/api/guild/${guildId}/moderation/summary`, window.location.origin);
      u.searchParams.set('window', w);
      const r = await fetch(u, { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
      const m = d.metrics || {};
      els.stats.bans && (els.stats.bans.textContent = (m.banAdds||0) + (m.banRemoves||0));
      els.stats.msgDel && (els.stats.msgDel.textContent = (m.messageDeletes||0) + (m.messageBulkDeletes||0));
      els.stats.msgEdit && (els.stats.msgEdit.textContent = (m.messageUpdates||0));
      els.stats.jl && (els.stats.jl.textContent = (m.memberJoins||0) + (m.memberLeaves||0));
      els.stats.voice && (els.stats.voice.textContent = (m.voiceJoins||0) + (m.voiceLeaves||0) + (m.voiceMoves||0));
    } catch(e){ console.error(e); }
  }

  let currentLimit = 200;
  async function loadFeed(){
    if (!guildId) return notify('guildId em falta','error');
    els.feed.innerHTML = `<div class="loading"><span class="loading-spinner"></span> A carregar...</div>`;
    try {
      const u = new URL(`/api/guild/${guildId}/logs`, window.location.origin);
      u.searchParams.set('type', buildTypeParam());
      buildRange(u);
      u.searchParams.set('limit', String(currentLimit));
      const r = await fetch(u, { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
      renderFeed(d.logs||[]);
    } catch(e){ console.error(e); notify(e.message,'error'); els.feed.innerHTML = `<div class="no-tickets">Erro ao carregar feed</div>`; }
  }

  function renderFeed(items){
    if (!items.length){ els.feed.innerHTML = `<div class="no-tickets">Sem eventos</div>`; return; }
    const iconFor = (t) => {
      if (!t) return 'fa-list';
      if (t.startsWith('mod_message')) return 'fa-comment-dots';
      if (t.startsWith('mod_member')) return 'fa-user';
      if (t.startsWith('mod_voice')) return 'fa-microphone';
      if (t.startsWith('mod_ban')) return 'fa-ban';
      if (t.startsWith('mod_channel')) return 'fa-hashtag';
      if (t.startsWith('mod_role')) return 'fa-user-shield';
      return 'fa-list';
    };
    const typePill = (t) => {
      if (t.startsWith('mod_message')) return 'type-pill tp-msg';
      if (t.startsWith('mod_member')) return 'type-pill tp-mem';
      if (t.startsWith('mod_voice')) return 'type-pill tp-voice';
      if (t.startsWith('mod_ban')) return 'type-pill tp-ban';
      if (t.startsWith('mod_role')) return 'type-pill tp-role';
      if (t.startsWith('mod_channel')) return 'type-pill tp-chan';
      return 'type-pill';
    };
    const avatar = (id, avatar) => {
      if (id && avatar) return `https://cdn.discordapp.com/avatars/${encodeURIComponent(id)}/${encodeURIComponent(avatar)}.png?size=64`;
      return '/default-avatar.svg';
    };
    els.feed.innerHTML = items.map(l => {
      const d = l.data || {};
      const r = l.resolved || {};
      const dt = new Date(l.timestamp).toLocaleString('pt-PT');
      const userLabel = r.user ? `${escapeHtml(r.user.username||'')}${r.user.nick? ' ('+escapeHtml(r.user.nick)+')':''} [${escapeHtml(r.user.id)}]` : (d.userId ? escapeHtml(d.userId) : '');
      const modLabel = r.executor ? `${escapeHtml(r.executor.username||'')}${r.executor.nick? ' ('+escapeHtml(r.executor.nick)+')':''} [${escapeHtml(r.executor.id)}]` : (d.executorId ? escapeHtml(d.executorId) : '');
      const chanLabel = r.channel ? `#${escapeHtml(r.channel.name||'')} [${escapeHtml(r.channel.id)}]` : (d.channelId ? escapeHtml(d.channelId) : '');
      const meta = [
        userLabel ? `<span class=\"badge-soft\" data-filter-user="${escapeHtml(d.userId||r.user?.id||'')}"><i class=\"fas fa-user\"></i> ${userLabel}</span>` : '',
        modLabel ? `<span class=\"badge-soft\" data-filter-mod="${escapeHtml(d.executorId||r.executor?.id||'')}"><i class=\"fas fa-shield-alt\"></i> ${modLabel}</span>` : '',
        chanLabel ? `<span class=\"badge-soft\" data-filter-channel="${escapeHtml(d.channelId||r.channel?.id||'')}"><i class=\"fas fa-hashtag\"></i> ${chanLabel}</span>` : ''
      ].filter(Boolean).join(' ');
      const quick = [];
      if (l.type === 'mod_message_update') {
        if (d.before) quick.push(`<div class=\"feed-meta\"><b>Antes:</b> ${escapeHtml(String(d.before).slice(0, 160))}${String(d.before).length>160?'…':''}</div>`);
        if (d.after) quick.push(`<div class=\"feed-meta\"><b>Depois:</b> ${escapeHtml(String(d.after).slice(0, 160))}${String(d.after).length>160?'…':''}</div>`);
      } else if (l.type === 'mod_message_delete' && d.content) {
        quick.push(`<div class=\"feed-meta\"><b>Conteúdo:</b> ${escapeHtml(String(d.content).slice(0,200))}${String(d.content).length>200?'…':''}</div>`);
      }
      return `
      <div class="feed-item" role="button" data-log-id="${l.id}" aria-expanded="false">
        <div class="feed-row">
          <img class="feed-avatar" src="${avatar(r.user?.id, r.user?.avatar)}" alt="avatar" />
          <div class="feed-content">
            <div class="feed-title">
              <span class="${typePill(l.type||'')}"><i class="fas ${iconFor(l.type||'')}"></i> ${escapeHtml(l.type||'log')}</span>
              <span class="feed-meta" style="margin-left:8px">${dt}</span>
            </div>
            ${meta ? `<div class="feed-meta" style="margin-top:6px">${meta}</div>`:''}
            ${l.message ? `<div style="margin-top:6px">${escapeHtml(l.message)}</div>`:''}
            ${quick.length? `<div class="expand">${quick.join('')}</div>`:''}
          </div>
        </div>
      </div>`;
    }).join('');
    // Attach handlers
    [...els.feed.querySelectorAll('[data-log-id]')].forEach(btn => btn.addEventListener('click', (e) => {
      const el = e.currentTarget;
      el.setAttribute('aria-expanded', el.getAttribute('aria-expanded')==='true' ? 'false' : 'true');
      // Only open modal when double-clicking the item title area (optional) or meta-less
      if (e.detail === 2) openEventModal(el.getAttribute('data-log-id'));
    }));
    // Filter chips
    els.feed.querySelectorAll('[data-filter-user]')?.forEach(n=> n.addEventListener('click', (e)=>{ e.stopPropagation(); const id=n.getAttribute('data-filter-user'); if(id){ els.userId.value=id; loadFeed(); }}));
    els.feed.querySelectorAll('[data-filter-mod]')?.forEach(n=> n.addEventListener('click', (e)=>{ e.stopPropagation(); const id=n.getAttribute('data-filter-mod'); if(id){ els.moderatorId.value=id; loadFeed(); }}));
    els.feed.querySelectorAll('[data-filter-channel]')?.forEach(n=> n.addEventListener('click', (e)=>{ e.stopPropagation(); const id=n.getAttribute('data-filter-channel'); if(id){ els.channelId.value=id; loadFeed(); }}));
    // Load more control
    const more = document.createElement('div');
    more.style.textAlign='center'; more.style.marginTop='8px';
    more.innerHTML = `<button id="btnLoadMore" class="btn btn-glass"><i class="fas fa-angles-down"></i> Carregar mais</button>`;
    els.feed.appendChild(more);
    document.getElementById('btnLoadMore')?.addEventListener('click', async ()=>{ currentLimit = Math.min(1000, currentLimit + 200); await loadFeed(); });
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c)); }

  function toggleAuto(){
    const pressed = els.btnAuto.getAttribute('aria-pressed') === 'true';
    const next = !pressed;
    els.btnAuto.setAttribute('aria-pressed', String(next));
    els.btnAuto.innerHTML = next ? `<i class="fas fa-pause"></i> Auto` : `<i class="fas fa-play"></i> Auto`;
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    if (next) {
      autoTimer = setInterval(async ()=>{ await loadSummary(); await loadFeed(); }, 5000);
    }
  }

  function exportCsv(){
    const u = new URL(`/api/guild/${guildId}/logs/export`, window.location.origin);
    u.searchParams.set('type', buildTypeParam());
    buildRange(u);
    const fmt = (els.exportFormat?.value||'csv');
    u.searchParams.set('format', fmt);
    window.location.href = u.toString();
  }

  async function openEventModal(logId){
    try {
      if (!logId) return;
      const u = new URL(`/api/guild/${guildId}/moderation/event/${encodeURIComponent(logId)}`, window.location.origin);
      const r = await fetch(u, { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok || !d.success) {
        if (r.status === 404 || d.error === 'log_not_found') {
          // Friendly modal for missing events
          els.modalTitle.textContent = 'Evento indisponível';
          els.modalBody.innerHTML = `<div class="kv"><b>Este evento já não existe.</b></div><div class="text-secondary" style="margin-top:6px">Pode ter sido removido ou está fora do histórico guardado.</div>`;
          els.modal.classList.remove('modal-hidden');
          els.modal.classList.add('modal-visible');
          els.modal.setAttribute('aria-hidden','false');
          return;
        }
        throw new Error(d.error || `HTTP ${r.status}`);
      }
      const ev = d.event;
      // Build actions based on type
      const actions = [];
      const data = ev.data || {};
      if (ev.type === 'mod_ban_add') {
        actions.push({ key:'unban', label:'Remover ban', icon:'fa-unlock', payload:{ userId: data.userId } });
      } else if (ev.type === 'mod_ban_remove') {
        if (data.userId) actions.push({ key:'ban', label:'Banir', icon:'fa-ban', payload:{ userId: data.userId } });
      } else if (ev.type === 'mod_member_update') {
        if (data.userId) actions.push({ key:'kick', label:'Expulsar', icon:'fa-person-running', payload:{ userId: data.userId } });
        if (data.userId) actions.push({ key:'timeout', label:'Timeout 10m', icon:'fa-hourglass-half', payload:{ userId: data.userId, durationSeconds: 600 } });
        if (data.userId) actions.push({ key:'remove_timeout', label:'Remover timeout', icon:'fa-clock', payload:{ userId: data.userId } });
        if (data.userId && data.nickname && 'before' in data.nickname) actions.push({ key:'revert_nickname', label:'Reverter apelido', icon:'fa-undo', payload:{ userId: data.userId } });
        if (data.userId && data.roles) actions.push({ key:'revert_roles', label:'Reverter cargos', icon:'fa-layer-group', payload:{ userId: data.userId } });
      } else if (ev.type === 'mod_member_join' || ev.type === 'mod_member_leave') {
        if (data.userId) actions.push({ key:'ban', label:'Banir', icon:'fa-ban', payload:{ userId: data.userId } });
      } else if (ev.type.startsWith('mod_voice_')) {
        if (data.userId) actions.push({ key:'mute', label:'Mutar', icon:'fa-microphone-slash', payload:{ userId: data.userId } });
        if (data.userId) actions.push({ key:'unmute', label:'Desmutar', icon:'fa-microphone', payload:{ userId: data.userId } });
        if (data.userId) actions.push({ key:'deafen', label:'Ensurdecer', icon:'fa-deaf', payload:{ userId: data.userId } });
        if (data.userId) actions.push({ key:'undeafen', label:'Dessurdir', icon:'fa-assistive-listening-systems', payload:{ userId: data.userId } });
      } else if (ev.type.startsWith('mod_message_')) {
        if (ev.type === 'mod_message_delete' && (data.content && data.channelId)) {
          actions.push({ key:'restore_message', label:'Restaurar mensagem', icon:'fa-undo', payload:{ logId: ev.id } });
        }
      } else if (ev.type.startsWith('mod_channel_')) {
        if (ev.type === 'mod_channel_delete') {
          actions.push({ key:'recreate_channel', label:'Recriar canal', icon:'fa-plus-square', payload:{ logId: ev.id } });
        } else if (ev.type === 'mod_channel_update') {
          actions.push({ key:'rename_channel', label:'Reverter nome do canal', icon:'fa-i-cursor', payload:{ logId: ev.id } });
        }
      } else if (ev.type.startsWith('mod_role_')) {
        if (ev.type === 'mod_role_delete') {
          actions.push({ key:'restore_role', label:'Restaurar cargo', icon:'fa-user-shield', payload:{ logId: ev.id } });
        } else if (ev.type === 'mod_role_update') {
          actions.push({ key:'revert_role_props', label:'Reverter propriedades do cargo', icon:'fa-undo', payload:{ logId: ev.id } });
        }
      }

      const resolved = ev.resolved || {};
      const avatarUrl = (id, avatar) => {
        if (id && avatar) return `https://cdn.discordapp.com/avatars/${encodeURIComponent(id)}/${encodeURIComponent(avatar)}.png?size=128`;
        return '/default-avatar.svg';
      };
  const userText = resolved.user ? `${escapeHtml(resolved.user.username||'')}${resolved.user.nick? ' ('+escapeHtml(resolved.user.nick)+')':''} [${escapeHtml(resolved.user.id)}]` : (data.userId ? escapeHtml(data.userId) : '-');
  const modText = resolved.executor ? `${escapeHtml(resolved.executor.username||'')}${resolved.executor.nick? ' ('+escapeHtml(resolved.executor.nick)+')':''} [${escapeHtml(resolved.executor.id)}]` : (data.executorId ? escapeHtml(data.executorId) : '-');
  const chanText = resolved.channel ? `#${escapeHtml(resolved.channel.name||'')} [${escapeHtml(resolved.channel.id)}]` : (data.channelId ? escapeHtml(data.channelId) : '-');
  const body = [];
  body.push(`<div class="kv"><b>Tipo:</b> ${escapeHtml(ev.type)}</div>`);
  body.push(`<div class="kv"><b>Quando:</b> ${new Date(ev.timestamp).toLocaleString('pt-PT')}</div>`);
      // Identity header with avatars
      body.push(`
        <div class="identity-row">
          <div class="id-card">
            <img class="avatar-sm" src="${avatarUrl(resolved.user?.id, resolved.user?.avatar)}" alt="avatar usuário" />
            <div class="id-meta">
              <div class="id-title"><i class="fas fa-user"></i> Usuário</div>
              <div class="id-name">${resolved.user ? `${escapeHtml(resolved.user.username||'')}${resolved.user.nick? ' ('+escapeHtml(resolved.user.nick)+')':''}` : (data.userId? escapeHtml(data.userId) : '-')}</div>
            </div>
          </div>
          <div class="id-card">
            <img class="avatar-sm" src="${avatarUrl(resolved.executor?.id, resolved.executor?.avatar)}" alt="avatar moderador" />
            <div class="id-meta">
              <div class="id-title"><i class="fas fa-shield-alt"></i> Moderador</div>
              <div class="id-name">${resolved.executor ? `${escapeHtml(resolved.executor.username||'')}${resolved.executor.nick? ' ('+escapeHtml(resolved.executor.nick)+')':''}` : (data.executorId? escapeHtml(data.executorId) : '-')}</div>
            </div>
          </div>
        </div>
      `);
  body.push(`<div class="kv"><b>Usuário:</b> ${userText} ${data.userId? `<button class=\"btn btn-sm btn-glass\" data-copy-id=\"${escapeHtml(data.userId)}\"><i class=\"fas fa-copy\"></i> Copiar ID</button>`:''}</div>`);
      body.push(`<div class="kv"><b>Moderador:</b> ${modText} ${data.executorId? `<button class=\"btn btn-sm btn-glass\" data-copy-id=\"${escapeHtml(data.executorId)}\"><i class=\"fas fa-copy\"></i> Copiar ID</button>`:''}</div>`);
      const userOpen = data.userId ? `<a class=\"btn btn-sm btn-glass\" target=\"_blank\" href=\"https://discord.com/users/${encodeURIComponent(data.userId)}\"><i class=\"fas fa-external-link-alt\"></i> Abrir no Discord</a>` : '';
      const modOpen = data.executorId ? `<a class=\"btn btn-sm btn-glass\" target=\"_blank\" href=\"https://discord.com/users/${encodeURIComponent(data.executorId)}\"><i class=\"fas fa-external-link-alt\"></i> Abrir no Discord</a>` : '';
      const chanOpen = data.channelId ? `<a class=\"btn btn-sm btn-glass\" target=\"_blank\" href=\"https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(data.channelId)}\"><i class=\"fas fa-external-link-alt\"></i> Abrir no Discord</a>` : '';
      const msgOpen = (data.channelId && data.messageId) ? `<a class=\"btn btn-sm btn-glass\" target=\"_blank\" href=\"https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(data.channelId)}/${encodeURIComponent(data.messageId)}\"><i class=\"fas fa-external-link-alt\"></i> Abrir mensagem</a>` : '';
      body.push(`<div class=\"kv\"><b>Abrir:</b> ${[userOpen, modOpen, chanOpen, msgOpen].filter(Boolean).join(' ')||'-'}</div>`);
      body.push(`<div class=\"kv\"><b>Canal:</b> ${chanText} ${data.channelId? `<button class=\"btn btn-sm btn-glass\" data-copy-id=\"${escapeHtml(data.channelId)}\"><i class=\"fas fa-copy\"></i> Copiar ID</button>`:''}</div>`);
      if (ev.message) body.push(`<div class="kv"><b>Motivo:</b> ${escapeHtml(ev.message)}</div>`);
      if (ev.type === 'mod_message_update') {
        if (data.before) body.push(`<pre class="code-block"><b>Antes:</b>\n${escapeHtml(data.before)}</pre>`);
        if (data.after) body.push(`<pre class="code-block"><b>Depois:</b>\n${escapeHtml(data.after)}</pre>`);
      } else if (ev.type === 'mod_message_delete') {
        // If content available in message, show it
        if (data.content) body.push(`<pre class="code-block"><b>Conteúdo:</b>\n${escapeHtml(data.content)}</pre>`);
      }

      if (actions.length) {
        body.push('<div class="actions-row">' + actions.map(a => `<button class="btn btn-primary" data-action="${a.key}"><i class="fas ${a.icon}"></i> ${a.label}</button>`).join(' ') + '</div>');
        const persisted = localStorage.getItem('mod-event-dryrun') === 'true';
        body.push(`<div class="kv" style="margin-top:8px"><label><input type="checkbox" id="dryRunToggle" ${persisted? 'checked':''} /> Pré-visualizar (dry run)</label></div>`);
      }

  els.modalTitle.textContent = 'Evento de moderação';
  els.modalBody.innerHTML = body.join('');
  els.modal.classList.remove('modal-hidden');
  els.modal.classList.add('modal-visible');
  els.modal.setAttribute('aria-hidden','false');
      // Wire copy buttons
      els.modalBody.querySelectorAll('[data-copy-id]')?.forEach(btn => {
        btn.addEventListener('click', async () => {
          const val = btn.getAttribute('data-copy-id');
          try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(val);
            else { const ta=document.createElement('textarea'); ta.value=val; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
            notify('ID copiado','success');
          } catch { notify('Não foi possível copiar','error'); }
        });
      });
      // Persist dry-run toggle changes
      const dryToggle = els.modalBody.querySelector('#dryRunToggle');
      if (dryToggle){ dryToggle.addEventListener('change', ()=>{ localStorage.setItem('mod-event-dryrun', dryToggle.checked ? 'true':'false'); }); }
      // Wire action clicks
      if (actions.length) {
        actions.forEach(a => {
          const btn = els.modalBody.querySelector(`[data-action="${a.key}"]`);
          if (!btn) return;
          btn.addEventListener('click', async () => {
            try {
              btn.disabled = true; btn.textContent = 'A executar...';
              const payload = { action: a.key, ...a.payload, logId: ev.id };
              const dry = !!(els.modalBody.querySelector('#dryRunToggle')?.checked);
              if (dry) payload.dryRun = true;
              const r = await fetch(`/api/guild/${guildId}/moderation/action`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload) });
              const d2 = await r.json();
              if (!r.ok || !d2.success) throw new Error(d2.error || `HTTP ${r.status}`);
              if (payload.dryRun) {
                // Polished in-modal confirmation: show risks + plan, then confirm to apply
                const ok = await injectConfirmInCurrentModal(d2);
                if (!ok) { btn.disabled = false; btn.textContent = `${a.label}`; return; }
                // Apply for real
                const payload2 = { ...payload };
                delete payload2.dryRun;
                const r2 = await fetch(`/api/guild/${guildId}/moderation/action`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(payload2) });
                const d3 = await r2.json();
                if (!r2.ok || !d3.success) throw new Error(d3.error || `HTTP ${r2.status}`);
                notify('Ação concluída','success');
                els.modal.classList.add('modal-hidden');
                els.modal.classList.remove('modal-visible');
                els.modal.setAttribute('aria-hidden','true');
                await loadFeed(); await loadSummary();
              } else {
                notify('Ação concluída','success');
                els.modal.classList.add('modal-hidden');
                els.modal.classList.remove('modal-visible');
                els.modal.setAttribute('aria-hidden','true');
                await loadFeed(); await loadSummary();
              }
            } catch(e){ console.error(e); notify(e.message,'error'); } finally { btn.disabled = false; }
          });
        });
      }
    } catch(e){ console.error(e); notify(e.message,'error'); }
  }

  // Events
  els.btnRefresh?.addEventListener('click', async ()=>{ await loadSummary(); await loadFeed(); });
  els.btnAuto?.addEventListener('click', toggleAuto);
  els.btnExport?.addEventListener('click', exportCsv);
  els.window?.addEventListener('change', loadSummary);
  els.q?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); });
  els.from?.addEventListener('change', loadFeed);
  els.to?.addEventListener('change', loadFeed);
  els.userId?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); });
  els.moderatorId?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); });
  els.channelId?.addEventListener('keyup', (e)=>{ if(e.key==='Enter') loadFeed(); });
  // Simple autocomplete for user/mod/channel fields
  function attachAutocomplete(inputEl, endpoint){
    if (!inputEl) return;
    let dd;
    const ensureDd = () => { if (!dd){ dd = document.createElement('div'); dd.className = 'dropdown'; dd.style.position='absolute'; dd.style.zIndex=10; dd.style.background='var(--bg-elev)'; dd.style.border='1px solid var(--glass-border)'; dd.style.borderRadius='8px'; dd.style.minWidth = (inputEl.offsetWidth+"px"); document.body.appendChild(dd);} return dd; };
    const placeDd = () => { const r = inputEl.getBoundingClientRect(); dd.style.left = (window.scrollX + r.left)+"px"; dd.style.top = (window.scrollY + r.bottom + 4)+"px"; dd.style.minWidth = r.width+"px"; };
    const hide = () => { if(dd) dd.style.display='none'; };
    const show = () => { if(dd) dd.style.display='block'; };
    inputEl.addEventListener('input', async ()=>{
      const q = inputEl.value.trim(); if (!q || q.length < 2) { hide(); return; }
      try {
        const u = new URL(`/api/guild/${guildId}/search/${endpoint}`, window.location.origin); u.searchParams.set('q', q);
        const r = await fetch(u, { credentials: 'same-origin' }); const d = await r.json(); if(!d.success) throw new Error(d.error||'search_failed');
        const list = Array.isArray(d.results)? d.results: [];
        const el = ensureDd(); placeDd(); el.innerHTML = list.map(it => {
          if (endpoint==='members') return `<div class="dd-item" data-id="${it.id}"><span>${(it.nick? (escapeHtml(it.nick)+' • '):'')+escapeHtml(it.username)}</span> <small>${it.id}</small></div>`;
          return `<div class="dd-item" data-id="${it.id}"><span>#${escapeHtml(it.name||'')}</span> <small>${it.id}</small></div>`;
        }).join('');
        el.querySelectorAll('.dd-item').forEach(n=> n.addEventListener('click', ()=>{ inputEl.value = n.getAttribute('data-id'); hide(); loadFeed(); }));
        show();
      } catch(e){ hide(); }
    });
    inputEl.addEventListener('blur', ()=> setTimeout(hide, 200));
  }
  attachAutocomplete(els.userId, 'members');
  attachAutocomplete(els.moderatorId, 'members');
  attachAutocomplete(els.channelId, 'channels');
  els.filterButtons.forEach(btn=> btn.addEventListener('click', ()=>{
    els.filterButtons.forEach(b=> b.classList.remove('active'));
    btn.classList.add('active');
    currentFamily = btn.getAttribute('data-filter') || 'all';
    loadFeed();
  }));

  // Public API for socket-driven refreshes
  window.ModerationPage = {
    refresh: async () => { await loadSummary(); await loadFeed(); }
  };
  window.addEventListener('moderation:refresh', () => { window.ModerationPage.refresh(); });

  // Initial load
  loadSummary();
  loadFeed();
  // UX: Close modal on ESC and overlay background click
  try {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isModalVisible()) closeModal();
    });
    els.modal?.addEventListener('click', (e) => {
      if (e.target === els.modal) closeModal();
    });
  } catch {}
  // Hierarchy quick tools
  async function postAction(body){
    const r = await fetch(`/api/guild/${guildId}/moderation/action`, { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin', body: JSON.stringify(body) });
    const d = await r.json(); if(!r.ok || !d.success) throw new Error(d.error||`HTTP ${r.status}`); return d;
  }
  async function confirmPlan(plan, title){
    // Use modal-based confirmation everywhere
    return await showConfirmModal(plan, title || 'Confirmar alterações');
  }
  const roleUp = document.getElementById('btnRoleUp');
  const roleDown = document.getElementById('btnRoleDown');
  const chanUp = document.getElementById('btnChanUp');
  const chanDown = document.getElementById('btnChanDown');
  const moveToCat = document.getElementById('btnMoveToCategory');
  function bool(id){ return !!document.getElementById(id)?.checked; }
  // Restore persisted state for hierarchy dry run
  try {
    const hierDry = document.getElementById('hierDryRun');
    const val = localStorage.getItem('mod-hier-dryrun');
    if (hierDry && (val === 'true' || val === 'false')) hierDry.checked = (val === 'true');
    hierDry?.addEventListener('change', ()=>{ localStorage.setItem('mod-hier-dryrun', hierDry.checked ? 'true':'false'); });
  } catch {}
  roleUp?.addEventListener('click', async()=>{
    try{ const roleId=(document.getElementById('roleIdQuick')?.value||'').trim(); if(!roleId) return notify('ID do cargo em falta','error'); const steps=parseInt(document.getElementById('roleSteps')?.value||'1',10)||1; const dry=bool('hierDryRun'); const payload={ action:'move_role_up', roleId, steps }; if(dry) payload.dryRun=true; const resp=await postAction(payload); if(dry){ const ok=await confirmPlan(resp, 'Confirmar mover cargo'); if(!ok) return; const resp2=await postAction({ action:'move_role_up', roleId, steps }); if(resp2.success) { notify('Cargo movido','success'); closeModal(); } } else { notify('Cargo movido','success'); } }catch(e){ notify(e.message,'error'); }
  });
  roleDown?.addEventListener('click', async()=>{
    try{ const roleId=(document.getElementById('roleIdQuick')?.value||'').trim(); if(!roleId) return notify('ID do cargo em falta','error'); const steps=parseInt(document.getElementById('roleSteps')?.value||'1',10)||1; const dry=bool('hierDryRun'); const payload={ action:'move_role_down', roleId, steps }; if(dry) payload.dryRun=true; const resp=await postAction(payload); if(dry){ const ok=await confirmPlan(resp, 'Confirmar mover cargo'); if(!ok) return; const resp2=await postAction({ action:'move_role_down', roleId, steps }); if(resp2.success) { notify('Cargo movido','success'); closeModal(); } } else { notify('Cargo movido','success'); } }catch(e){ notify(e.message,'error'); }
  });
  chanUp?.addEventListener('click', async()=>{
    try{ const channelId=(document.getElementById('channelIdQuick')?.value||'').trim(); if(!channelId) return notify('ID do canal em falta','error'); const steps=parseInt(document.getElementById('channelSteps')?.value||'1',10)||1; const dry=bool('hierDryRun'); const payload={ action:'move_channel_up', channelId, steps }; if(dry) payload.dryRun=true; const resp=await postAction(payload); if(dry){ const ok=await confirmPlan(resp, 'Confirmar mover canal'); if(!ok) return; const resp2=await postAction({ action:'move_channel_up', channelId, steps }); if(resp2.success) { notify('Canal movido','success'); closeModal(); } } else { notify('Canal movido','success'); } }catch(e){ notify(e.message,'error'); }
  });
  chanDown?.addEventListener('click', async()=>{
    try{ const channelId=(document.getElementById('channelIdQuick')?.value||'').trim(); if(!channelId) return notify('ID do canal em falta','error'); const steps=parseInt(document.getElementById('channelSteps')?.value||'1',10)||1; const dry=bool('hierDryRun'); const payload={ action:'move_channel_down', channelId, steps }; if(dry) payload.dryRun=true; const resp=await postAction(payload); if(dry){ const ok=await confirmPlan(resp, 'Confirmar mover canal'); if(!ok) return; const resp2=await postAction({ action:'move_channel_down', channelId, steps }); if(resp2.success) { notify('Canal movido','success'); closeModal(); } } else { notify('Canal movido','success'); } }catch(e){ notify(e.message,'error'); }
  });
  moveToCat?.addEventListener('click', async()=>{
    try{ const channelId=(document.getElementById('channelIdQuick')?.value||'').trim(); if(!channelId) return notify('ID do canal em falta','error'); const parentId=(document.getElementById('channelToCategory')?.value||'').trim(); const dry=bool('hierDryRun'); const payload={ action:'move_channel_to_category', channelId, parentId: parentId||null }; if(dry) payload.dryRun=true; const resp=await postAction(payload); if(dry){ const ok=await confirmPlan(resp, 'Confirmar mover canal para categoria'); if(!ok) return; const resp2=await postAction({ action:'move_channel_to_category', channelId, parentId: parentId||null }); if(resp2.success) { notify('Canal movido para categoria','success'); closeModal(); } } else { notify('Canal movido para categoria','success'); } }catch(e){ notify(e.message,'error'); }
  });
})();
