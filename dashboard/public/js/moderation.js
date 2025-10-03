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
  let currentLimit = 200;
  let lastTopId = null; // track latest rendered id for live-append
  let lastTopTs = null; // track latest rendered timestamp for live-append
  let lastLiveAppendTs = null; // track last time we auto-appended
  let LONG_PAUSE_MS = 2 * 60 * 1000; // 2 minutes (configurable)

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
  // Preference helpers
  function persistPrefs(){
    try {
      localStorage.setItem('mod-feed-filter', currentFamily);
      localStorage.setItem('mod-limit', String(currentLimit));
      localStorage.setItem('mod-auto', els.btnAuto.getAttribute('aria-pressed') === 'true' ? 'true' : 'false');
    } catch {}
  }
  function restorePrefs(){
    try {
      const f = localStorage.getItem('mod-feed-filter');
      if (f) currentFamily = f;
      const lim = parseInt(localStorage.getItem('mod-limit')||'', 10);
      if (!isNaN(lim) && lim>0) currentLimit = lim;
      const auto = localStorage.getItem('mod-auto');
      if (auto === 'true') {
        els.btnAuto.setAttribute('aria-pressed','false'); // will toggle to true
        toggleAuto();
      }
      const lp = parseInt(localStorage.getItem('mod-long-pause-minutes')||'2', 10);
      if (!isNaN(lp) && lp>0) {
        const input = document.getElementById('longPauseMin');
        if (input) input.value = String(lp);
        LONG_PAUSE_MS = lp * 60 * 1000;
      }
      // Apply active button state for filter
      if (els.filterButtons?.length) {
        els.filterButtons.forEach(b=> b.classList.remove('active'));
        const btn = els.filterButtons.find(b=> (b.getAttribute('data-filter')||'all') === currentFamily);
        btn?.classList.add('active');
      }
    } catch {}
  }
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
      // Track head for live-append
      if (Array.isArray(d.logs) && d.logs.length) {
        lastTopId = d.logs[0].id;
        lastTopTs = d.logs[0].timestamp;
      }
    } catch(e){ console.error(e); notify(e.message,'error'); els.feed.innerHTML = `<div class="no-tickets">Erro ao carregar feed</div>`; }
  }

  function formatDateGroup(ts){
    const d = new Date(ts);
    const today = new Date(); today.setHours(0,0,0,0);
    const that = new Date(d); that.setHours(0,0,0,0);
    const diff = (today - that) / 86400000; // days
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    try { return d.toLocaleDateString('pt-PT', { weekday:'long', day:'2-digit', month:'short', year:'numeric' }); } catch { return d.toDateString(); }
  }

  function iconFor(t){
    if (!t) return 'fa-list';
    if (t.startsWith('mod_message')) return 'fa-comment-dots';
    if (t.startsWith('mod_member')) return 'fa-user';
    if (t.startsWith('mod_voice')) return 'fa-microphone';
    if (t.startsWith('mod_ban')) return 'fa-ban';
    if (t.startsWith('mod_channel')) return 'fa-hashtag';
    if (t.startsWith('mod_role')) return 'fa-user-shield';
    return 'fa-list';
  }
  function typePill(t){
    if (!t) return 'type-pill';
    if (t.startsWith('mod_message')) return 'type-pill tp-msg';
    if (t.startsWith('mod_member')) return 'type-pill tp-mem';
    if (t.startsWith('mod_voice')) return 'type-pill tp-voice';
    if (t.startsWith('mod_ban')) return 'type-pill tp-ban';
    if (t.startsWith('mod_role')) return 'type-pill tp-role';
    if (t.startsWith('mod_channel')) return 'type-pill tp-chan';
    return 'type-pill';
  }
  function typeLabel(t){
    if (!t) return 'Evento';
    const m = {
      'mod_message_delete': 'Mensagem apagada',
      'mod_message_update': 'Mensagem editada',
      'mod_member_join': 'Membro entrou',
      'mod_member_leave': 'Membro saiu',
      'mod_member_update': 'Membro atualizado',
      'mod_voice_join': 'Entrou em canal de voz',
      'mod_voice_leave': 'Saiu do canal de voz',
      'mod_voice_move': 'Moveu-se de canal de voz',
      'mod_ban_add': 'Banimento aplicado',
      'mod_ban_remove': 'Banimento removido',
      'mod_channel_update': 'Canal atualizado',
      'mod_channel_delete': 'Canal apagado',
      'mod_role_update': 'Cargo atualizado',
      'mod_role_delete': 'Cargo apagado'
    };
    return m[t] || t.replace(/^mod_/,'').replace(/_/g,' ');
  }
  function avatarUrl(id, avatar){
    if (id && avatar) return `https://cdn.discordapp.com/avatars/${encodeURIComponent(id)}/${encodeURIComponent(avatar)}.png?size=64`;
    return '/default-avatar.svg';
  }

  function buildQuickActions(l){
    const d = l.data || {};
    const acts = [];
    if (l.type === 'mod_ban_add' && d.userId) {
      acts.push({ key:'unban', label:'Remover ban', icon:'fa-unlock', payload:{ userId: d.userId } });
    } else if (l.type === 'mod_ban_remove' && d.userId) {
      acts.push({ key:'ban', label:'Banir', icon:'fa-ban', payload:{ userId: d.userId } });
    } else if (l.type === 'mod_message_delete' && d.content && d.channelId) {
      acts.push({ key:'restore_message', label:'Restaurar', icon:'fa-undo', payload:{ logId: l.id } });
    } else if (l.type === 'mod_channel_delete') {
      acts.push({ key:'recreate_channel', label:'Recriar canal', icon:'fa-plus-square', payload:{ logId: l.id } });
    } else if (l.type === 'mod_channel_update') {
      acts.push({ key:'rename_channel', label:'Reverter nome', icon:'fa-i-cursor', payload:{ logId: l.id } });
    } else if (l.type === 'mod_role_delete') {
      acts.push({ key:'restore_role', label:'Restaurar cargo', icon:'fa-user-shield', payload:{ logId: l.id } });
    } else if (l.type === 'mod_role_update') {
      acts.push({ key:'revert_role_props', label:'Reverter props', icon:'fa-undo', payload:{ logId: l.id } });
    } else if (l.type === 'mod_member_update' && d.userId) {
      // Member-related safe quick actions
      acts.push({ key:'kick', label:'Expulsar', icon:'fa-person-running', payload:{ userId: d.userId } });
      acts.push({ key:'timeout', label:'Timeout 10m', icon:'fa-hourglass-half', payload:{ userId: d.userId, durationSeconds: 600 } });
      acts.push({ key:'remove_timeout', label:'Remover timeout', icon:'fa-clock', payload:{ userId: d.userId } });
      if (d.nickname && Object.prototype.hasOwnProperty.call(d, 'nickname')) {
        acts.push({ key:'revert_nickname', label:'Reverter apelido', icon:'fa-undo', payload:{ userId: d.userId } });
      }
      if (d.roles) {
        acts.push({ key:'revert_roles', label:'Reverter cargos', icon:'fa-layer-group', payload:{ userId: d.userId } });
      }
    }
    return acts;
  }

  function renderCard(l){
    const d = l.data || {};
    const r = l.resolved || {};
    const dt = new Date(l.timestamp).toLocaleString('pt-PT');
    const userLabel = r.user ? `${escapeHtml(r.user.username||'')}${r.user.nick? ' ('+escapeHtml(r.user.nick)+')':''} [${escapeHtml(r.user.id)}]` : (d.userId ? escapeHtml(d.userId) : '');
    const modLabel = r.executor ? `${escapeHtml(r.executor.username||'')}${r.executor.nick? ' ('+escapeHtml(r.executor.nick)+')':''} [${escapeHtml(r.executor.id)}]` : (d.executorId ? escapeHtml(d.executorId) : '');
    const chanLabel = r.channel ? `#${escapeHtml(r.channel.name||'')} [${escapeHtml(r.channel.id)}]` : (d.channelId ? escapeHtml(d.channelId) : '');
    const meta = [
      userLabel ? `<span class=\"badge-soft\" title=\"Clique para filtrar • Shift+Clique copia o ID\" data-filter-user="${escapeHtml(d.userId||r.user?.id||'')}" data-copy-id="${escapeHtml(d.userId||r.user?.id||'')}"><i class=\"fas fa-user\"></i> ${userLabel}</span>` : '',
      modLabel ? `<span class=\"badge-soft\" title=\"Clique para filtrar • Shift+Clique copia o ID\" data-filter-mod="${escapeHtml(d.executorId||r.executor?.id||'')}" data-copy-id="${escapeHtml(d.executorId||r.executor?.id||'')}"><i class=\"fas fa-shield-alt\"></i> ${modLabel}</span>` : '',
      chanLabel ? `<span class=\"badge-soft\" title=\"Clique para filtrar • Shift+Clique copia o ID\" data-filter-channel="${escapeHtml(d.channelId||r.channel?.id||'')}" data-copy-id="${escapeHtml(d.channelId||r.channel?.id||'')}"><i class=\"fas fa-hashtag\"></i> ${chanLabel}</span>` : ''
    ].filter(Boolean).join(' ');
    const quick = [];
    if (l.type === 'mod_message_update') {
      if (d.before) quick.push(`<div class=\"feed-meta\"><b>Antes:</b> ${escapeHtml(String(d.before).slice(0, 160))}${String(d.before).length>160?'…':''}</div>`);
      if (d.after) quick.push(`<div class=\"feed-meta\"><b>Depois:</b> ${escapeHtml(String(d.after).slice(0, 160))}${String(d.after).length>160?'…':''}</div>`);
    } else if (l.type === 'mod_message_delete' && d.content) {
      quick.push(`<div class=\"feed-meta\"><b>Conteúdo:</b> ${escapeHtml(String(d.content).slice(0,200))}${String(d.content).length>200?'…':''}</div>`);
    } else if (l.type === 'mod_voice_move') {
      const from = r.fromChannel ? `#${escapeHtml(r.fromChannel.name)} (${escapeHtml(r.fromChannel.id)})` : (d.fromChannelId ? `#${escapeHtml(d.fromChannelId)}` : 'desconhecido');
      const to = r.toChannel ? `#${escapeHtml(r.toChannel.name)} (${escapeHtml(r.toChannel.id)})` : (d.toChannelId ? `#${escapeHtml(d.toChannelId)}` : (r.channel ? `#${escapeHtml(r.channel.name)} (${escapeHtml(r.channel.id)})` : 'desconhecido'));
      quick.push(`<div class=\"feed-meta\"><b>Move:</b> ${from} → ${to}</div>`);
    } else if (l.type === 'mod_voice_join') {
      const to = r.channel ? `#${escapeHtml(r.channel.name)} (${escapeHtml(r.channel.id)})` : (d.channelId ? `#${escapeHtml(d.channelId)}` : 'desconhecido');
      quick.push(`<div class=\"feed-meta\"><b>Entrou:</b> ${to}</div>`);
    } else if (l.type === 'mod_voice_leave') {
      const from = r.channel ? `#${escapeHtml(r.channel.name)} (${escapeHtml(r.channel.id)})` : (d.channelId ? `#${escapeHtml(d.channelId)}` : 'desconhecido');
      quick.push(`<div class=\"feed-meta\"><b>Saiu:</b> ${from}</div>`);
    } else if (l.type === 'mod_member_update') {
      if (d.nickname && (typeof d.nickname === 'object')) {
        const nb = (typeof d.nickname.before !== 'undefined') ? String(d.nickname.before||'') : null;
        const na = (typeof d.nickname.after !== 'undefined') ? String(d.nickname.after||'') : null;
        if (nb !== null || na !== null) quick.push(`<div class=\"feed-meta\"><b>Apelido:</b> ${escapeHtml(nb??'—')} → ${escapeHtml(na??'—')}</div>`);
      }
      const rr = r.roles || {};
      if (rr.added?.length || rr.removed?.length) {
        const added = (rr.added||[]).slice(0,3).map(ro=>`@${escapeHtml(ro.name||ro.id)}`).join(', ');
        const removed = (rr.removed||[]).slice(0,3).map(ro=>`@${escapeHtml(ro.name||ro.id)}`).join(', ');
        if (added) quick.push(`<div class=\"feed-meta\"><b>Cargos adicionados:</b> ${added}${rr.added.length>3?'…':''}</div>`);
        if (removed) quick.push(`<div class=\"feed-meta\"><b>Cargos removidos:</b> ${removed}${rr.removed.length>3?'…':''}</div>`);
      }
    } else if (l.type === 'mod_ban_add') {
      const reason = l.message || d.reason || '';
      if (reason) quick.push(`<div class=\"feed-meta\"><b>Motivo:</b> ${escapeHtml(String(reason).slice(0,200))}${String(reason).length>200?'…':''}</div>`);
    }
    const acts = buildQuickActions(l);
    const actionsRow = acts.length ? `<div class=\"feed-actions\" style=\"margin-top:8px\">${acts.map(a=>{
      const extra = a.payload ? Object.entries(a.payload).map(([k,v])=>`data-${k.replace(/[A-Z]/g, m=>'-'+m.toLowerCase())}=\"${String(v)}\"`).join(' ') : '';
      const title = `title=\"${escapeHtml(a.label)}\"`;
      return `<button class=\"btn btn-sm btn-glass qa-btn\" ${title} data-action=\"${a.key}\" data-log-id=\"${l.id}\" ${extra}><i class=\"fas ${a.icon}\"></i> ${a.label}</button>`;
    }).join(' ')}</div>` : '';

    // In-card deep links (open in Discord)
    const userOpen = d.userId ? `<a class=\"btn btn-sm btn-glass\" title=\"Abrir utilizador no Discord\" target=\"_blank\" href=\"https://discord.com/users/${encodeURIComponent(d.userId)}\"><i class=\"fas fa-external-link-alt\"></i> Utilizador</a>` : '';
    const modOpen = d.executorId ? `<a class=\"btn btn-sm btn-glass\" title=\"Abrir moderador no Discord\" target=\"_blank\" href=\"https://discord.com/users/${encodeURIComponent(d.executorId)}\"><i class=\"fas fa-external-link-alt\"></i> Moderador</a>` : '';
    const chanOpen = d.channelId ? `<a class=\"btn btn-sm btn-glass\" title=\"Abrir canal no Discord\" target=\"_blank\" href=\"https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(d.channelId)}\"><i class=\"fas fa-external-link-alt\"></i> Canal</a>` : '';
    const msgOpen = (d.channelId && d.messageId) ? `<a class=\"btn btn-sm btn-glass\" title=\"Abrir mensagem no Discord\" target=\"_blank\" href=\"https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(d.channelId)}/${encodeURIComponent(d.messageId)}\"><i class=\"fas fa-external-link-alt\"></i> Mensagem</a>` : '';
    const linksRow = (userOpen || modOpen || chanOpen || msgOpen) ? `<div class=\"feed-actions\" style=\"margin-top:6px\">${[userOpen, modOpen, chanOpen, msgOpen].filter(Boolean).join(' ')}</div>` : '';

    // Copy summary button
    const copyBtn = `<button class=\"btn btn-sm btn-glass copy-summary\" title=\"Copiar resumo\" data-log-id=\"${l.id}\"><i class=\"fas fa-copy\"></i> Copiar resumo</button>`;
    return `
      <div class="feed-item" role="button" data-log-id="${l.id}" aria-expanded="false" aria-label="${escapeHtml(typeLabel(l.type||''))} em ${dt}">
        <div class="feed-row">
          <div class="avatar-wrap">
            <img class="feed-avatar" src="${avatarUrl(r.user?.id, r.user?.avatar)}" alt="avatar" />
            ${r.executor ? `<img class="exec-avatar" src="${avatarUrl(r.executor.id, r.executor.avatar)}" alt="moderador" title="Executor" />` : ''}
          </div>
          <div class="feed-content">
            <div class="feed-title">
              <span class="${typePill(l.type||'')}" title="${escapeHtml(typeLabel(l.type||''))}"><i class="fas ${iconFor(l.type||'')}"></i> ${escapeHtml(typeLabel(l.type||'log'))}</span>
              <span class="feed-meta" style="margin-left:8px">${dt}</span>
            </div>
            ${meta ? `<div class="feed-meta" style="margin-top:6px">${meta}</div>`:''}
            ${l.message ? `<div style="margin-top:6px">${escapeHtml(l.message)}</div>`:''}
            ${quick.length? `<div class="expand">${quick.join('')}</div>`:''}
            ${linksRow}
            <div class="feed-actions" style="margin-top:6px">${copyBtn}</div>
            ${actionsRow}
          </div>
        </div>
      </div>`;
  }

  function renderFeed(items){
    if (!items.length){ els.feed.innerHTML = `<div class="no-tickets">Sem eventos</div>`; return; }
    const parts = [];
    let lastGroup = null;
    for (const l of items) {
      const grp = formatDateGroup(l.timestamp);
      if (grp !== lastGroup) {
        parts.push(`<div class="feed-date" aria-label="${escapeHtml(grp)}">${escapeHtml(grp)}</div>`);
        lastGroup = grp;
      }
      parts.push(renderCard(l));
    }
    els.feed.innerHTML = parts.join('');
    // Attach handlers
    [...els.feed.querySelectorAll('[data-log-id]')].forEach(btn => btn.addEventListener('click', (e) => {
      const el = e.currentTarget;
      el.setAttribute('aria-expanded', el.getAttribute('aria-expanded')==='true' ? 'false' : 'true');
      // Only open modal when double-clicking the item title area (optional) or meta-less
      if (e.detail === 2) openEventModal(el.getAttribute('data-log-id'));
    }));
    // Quick actions
    els.feed.querySelectorAll('.qa-btn')?.forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const logId = btn.getAttribute('data-log-id');
        try {
          btn.disabled = true;
          // Always do dry-run first for safety
          const payload = { action, logId };
          const userId = btn.getAttribute('data-user-id'); if (userId) payload.userId = userId;
          const durStr = btn.getAttribute('data-duration-seconds'); const dur = durStr? parseInt(durStr,10):NaN; if (!isNaN(dur)) payload.durationSeconds = dur;
          const dryResp = await postAction({ ...payload, dryRun: true });
          const ok = await showConfirmModal(dryResp, 'Confirmar ação rápida');
          if (!ok) { btn.disabled = false; return; }
          const apply = await postAction(payload);
          if (apply?.success) {
            notify('Ação aplicada','success');
            await loadSummary();
            await loadFeed();
          }
        } catch(e){ console.error(e); notify(e.message,'error'); }
        finally { btn.disabled = false; }
      });
    });
    // Copy summary handlers
    els.feed.querySelectorAll('.copy-summary')?.forEach(btn => {
      btn.addEventListener('click', async (e)=>{
        e.stopPropagation();
        const id = btn.getAttribute('data-log-id');
        try {
          // Compose a compact summary from the DOM and item data
          const title = btn.closest('.feed-item')?.querySelector('.feed-title .type-pill')?.textContent?.trim() || 'Evento';
          const when = btn.closest('.feed-item')?.querySelector('.feed-title .feed-meta')?.textContent?.trim() || '';
          const chips = Array.from(btn.closest('.feed-item')?.querySelectorAll('[data-filter-user],[data-filter-mod],[data-filter-channel]')||[]).map(n=>n.textContent.trim()).join(' | ');
          const extra = Array.from(btn.closest('.feed-item')?.querySelectorAll('.expand .feed-meta')||[]).map(n=>n.textContent.trim()).join('\n');
          const reason = Array.from(btn.closest('.feed-item')?.querySelectorAll(':scope > .feed-content > div'))
            .map(n=>n.textContent.trim()).find(t=>t && !t.startsWith('Copiar resumo') && !t.includes('Abrir') && !t.includes('Carregar mais')) || '';
          const lines = [title, when, chips].filter(Boolean);
          if (reason) lines.push(reason);
          if (extra) lines.push(extra);
          const text = lines.join('\n');
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text); else {
            const ta = document.createElement('textarea'); ta.value = text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
          }
          notify('Resumo copiado','success');
        } catch { notify('Não foi possível copiar','error'); }
      });
    });
    // Filter chips with Shift+Click to copy ID
    function chipHandler(kind){
      return (e)=>{
        e.stopPropagation();
        const id = e.currentTarget.getAttribute(`data-filter-${kind}`);
        if (!id) return;
        if (e.shiftKey) {
          try { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(id); notify('ID copiado','success'); } catch {}
          return;
        }
        if (kind==='user') els.userId.value = id;
        if (kind==='mod') els.moderatorId.value = id;
        if (kind==='channel') els.channelId.value = id;
        loadFeed();
      };
    }
    els.feed.querySelectorAll('[data-filter-user]')?.forEach(n=> n.addEventListener('click', chipHandler('user')));
    els.feed.querySelectorAll('[data-filter-mod]')?.forEach(n=> n.addEventListener('click', chipHandler('mod')));
    els.feed.querySelectorAll('[data-filter-channel]')?.forEach(n=> n.addEventListener('click', chipHandler('channel')));
    // Load more control
    const more = document.createElement('div');
    more.style.textAlign='center'; more.style.marginTop='8px';
    more.innerHTML = `<button id="btnLoadMore" class="btn btn-glass"><i class="fas fa-angles-down"></i> Carregar mais</button>`;
    els.feed.appendChild(more);
    document.getElementById('btnLoadMore')?.addEventListener('click', async ()=>{ currentLimit = Math.min(1000, currentLimit + 200); persistPrefs(); await loadFeed(); });
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
    persistPrefs();
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
  // Persist long pause threshold changes
  try {
    const lpInput = document.getElementById('longPauseMin');
    lpInput?.addEventListener('change', ()=>{
      const raw = parseInt(lpInput.value||'2', 10);
      const val = (!isNaN(raw) && raw>0) ? raw : 1;
      lpInput.value = String(val);
      localStorage.setItem('mod-long-pause-minutes', String(val));
      LONG_PAUSE_MS = val * 60 * 1000;
    });
  } catch {}
  els.filterButtons.forEach(btn=> btn.addEventListener('click', ()=>{
    els.filterButtons.forEach(b=> b.classList.remove('active'));
    btn.classList.add('active');
    currentFamily = btn.getAttribute('data-filter') || 'all';
    persistPrefs();
    loadFeed();
  }));

  // Public API for socket-driven refreshes
  window.ModerationPage = {
    refresh: async () => { await loadSummary(); await loadFeed(); },
    handleLiveEvent: async (_payload) => {
      // If auto is ON, let existing debounced full refresh handle it
      if (els.btnAuto.getAttribute('aria-pressed') === 'true') return false;
      try {
        const u = new URL(`/api/guild/${guildId}/logs`, window.location.origin);
        u.searchParams.set('type', buildTypeParam());
        buildRange(u);
        u.searchParams.set('limit', '5');
        const r = await fetch(u, { credentials:'same-origin' });
        const d = await r.json();
        if (!r.ok || !d.success) return false;
        const list = Array.isArray(d.logs)? d.logs: [];
        if (!list.length) return true;
        const container = els.feed;
        const prevFirst = container.firstElementChild;
        // Find position after possible initial date header
        let inserted = 0;
        // Determine newest items not yet shown (by timestamp or id)
        const newer = list.filter(it => !lastTopTs || (it.timestamp >= lastTopTs && it.id !== lastTopId));
        if (!newer.length) return true;
        // Build HTML for newest first (reverse chronological in API already)
        // Insert from bottom of 'newer' to preserve order when prepending
        for (let i = newer.length - 1; i >= 0; i--) {
          const l = newer[i];
          const grp = formatDateGroup(l.timestamp);
          let top = container.firstElementChild;
          let topIsHeader = top && top.classList.contains('feed-date');
          let topHeaderText = topIsHeader ? top.textContent.trim() : null;
          // Insert header if needed
          if (!topIsHeader || grp !== topHeaderText) {
            const header = document.createElement('div');
            header.className = 'feed-date';
            header.setAttribute('aria-label', grp);
            header.textContent = grp;
            container.insertBefore(header, container.firstElementChild || null);
            top = header; topIsHeader = true; topHeaderText = grp;
          }
          const wrapper = document.createElement('div');
          wrapper.innerHTML = renderCard(l);
          const node = wrapper.firstElementChild;
          // Insert after header when present
          if (topIsHeader) {
            container.insertBefore(node, top.nextSibling);
          } else {
            container.insertBefore(node, container.firstElementChild || null);
          }
          inserted++;
        }
        // If long pause since last append, insert a resume marker before previous first element
        const now = Date.now();
        if (prevFirst && lastLiveAppendTs && (now - lastLiveAppendTs) > LONG_PAUSE_MS) {
          const marker = document.createElement('div');
          marker.className = 'feed-marker';
          const t = new Date().toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' });
          marker.innerHTML = `<span>Retomar a partir daqui • ${t}</span>`;
          container.insertBefore(marker, prevFirst);
        }
        lastLiveAppendTs = now;
        // Reattach listeners for newly inserted nodes
        [...els.feed.querySelectorAll('[data-log-id]')].slice(0, inserted).forEach(btn => btn.addEventListener('click', (e) => {
          const el = e.currentTarget; el.setAttribute('aria-expanded', el.getAttribute('aria-expanded')==='true' ? 'false' : 'true'); if (e.detail === 2) openEventModal(el.getAttribute('data-log-id'));
        }));
        els.feed.querySelectorAll('.qa-btn')?.forEach(btn=>{
          if (btn.__qaBound) return; btn.__qaBound = true;
          btn.addEventListener('click', async (e)=>{
            e.stopPropagation();
            const action = btn.getAttribute('data-action');
            const logId = btn.getAttribute('data-log-id');
            try {
              btn.disabled = true;
              const payload = { action, logId };
              const userId = btn.getAttribute('data-user-id'); if (userId) payload.userId = userId;
              const durStr = btn.getAttribute('data-duration-seconds'); const dur = durStr? parseInt(durStr,10):NaN; if(!isNaN(dur)) payload.durationSeconds = dur;
              const dryResp = await postAction({ ...payload, dryRun:true });
              const ok = await showConfirmModal(dryResp, 'Confirmar ação rápida');
              if(!ok){ btn.disabled=false; return; }
              const apply = await postAction(payload);
              if (apply?.success){ notify('Ação aplicada','success'); await loadSummary(); }
            } catch(e){ console.error(e); notify(e.message,'error'); } finally { btn.disabled=false; }
          });
        });
        // Mild highlight on new cards
        try {
          const newNodes = [...els.feed.querySelectorAll('[data-log-id]')].slice(0, inserted);
          newNodes.forEach(n => n.classList.add('feed-flash'));
          setTimeout(()=> newNodes.forEach(n => n.classList.remove('feed-flash')), 1100);
        } catch {}
        // Subtle in-page toast for new events (click to jump to newest area)
        try { showFeedToast(`${inserted} novo(s) evento(s)`, () => { try { els.feed?.scrollIntoView({ behavior:'smooth', block:'start' }); } catch {} }); } catch {}
        // Update head trackers
        lastTopId = list[0].id; lastTopTs = list[0].timestamp;
        return true;
      } catch { return false; }
    }
  };
  window.addEventListener('moderation:refresh', () => { window.ModerationPage.refresh(); });

  // Initial load
  restorePrefs();
  loadSummary();
  loadFeed();

  // In-page subtle toast in feed area
  function showFeedToast(msg, onClick){
    try {
      const host = els.feed;
      if (!host) return;
      const toast = document.createElement('div');
      toast.className = 'feed-toast';
      toast.innerHTML = `<i class="fas fa-bell"></i> <span>${escapeHtml(msg)}</span>`;
      host.insertBefore(toast, host.firstChild);
      if (typeof onClick === 'function') { toast.style.cursor='pointer'; toast.addEventListener('click', onClick); }
      setTimeout(()=>{
        toast.style.opacity = '0.0'; toast.style.transition = 'opacity .4s ease';
        setTimeout(()=> toast.remove(), 450);
      }, 2200);
    } catch {}
  }
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
