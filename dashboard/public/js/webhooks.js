const logger = require('../utils/logger');
(function() {
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  // Ensure guild context
  try{
    if(!guildId){
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
      try{ localStorage.setItem('IGNIS_LAST_GUILD', guildId); }catch(e) { logger.debug('Caught error:', e?.message || e); }
    }
  }catch(e) { logger.debug('Caught error:', e?.message || e); }
  const listEl = document.getElementById('webhooksList');
  const typeEl = document.getElementById('whType');
  const nameEl = document.getElementById('whName');
  const urlEl = document.getElementById('whUrl');
  const channelEl = document.getElementById('whChannel');
  const btnSave = document.getElementById('btnSaveWebhook');
  const btnAuto = document.getElementById('btnAutoSetup');
  // Modal elements
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  const modalSubmit = document.getElementById('modalSubmit');
  const modalTypes = document.getElementById('modalTypes');
  let cachedChannels = [];

  function notify(msg, type='info') {
    const div = document.createElement('div');
    div.className = `notification notification-${type} slide-up`;
    div.innerHTML = `<i class="fas ${type==='error'?'fa-exclamation-circle': type==='success'? 'fa-check-circle':'fa-info-circle'}"></i><span>${msg}</span>`;
    document.body.appendChild(div);
    setTimeout(() => { div.style.animation = 'slideDown 0.3s ease-in'; setTimeout(() => div.remove(), 300); }, 3000);
  }

  async function api(path, opts) {
    const isGet = !opts || !opts.method || String(opts.method).toUpperCase() === 'GET';
    if (isGet && window.IGNISFetch && window.IGNISFetch.fetchJsonCached){
      const { ok, json, stale, status } = await window.IGNISFetch.fetchJsonCached(path, { ttlMs: 60_000, credentials:'same-origin', headers:{'Content-Type':'application/json'} });
      if (stale) showStaleBanner();
      if (!ok) { const e=new Error(json?.error || `HTTP ${status||500}`); e.status = status||500; throw e; }
      return json;
    }
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...opts });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const err = new Error(json.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  function showStaleBanner(){
    try {
      if (document.getElementById('stale-banner')) return;
      const el=document.createElement('div'); el.id='stale-banner'; el.style.position='fixed'; el.style.bottom='16px'; el.style.left='50%'; el.style.transform='translateX(-50%)'; el.style.background='rgba(124,58,237,0.95)'; el.style.color='#fff'; el.style.padding='10px 14px'; el.style.borderRadius='8px'; el.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)'; el.style.zIndex='9999'; el.style.fontSize='14px'; el.textContent='Mostrando dados em cache temporariamente (a API do Discord limitou pedidos).'; document.body.appendChild(el); setTimeout(()=>{ el.remove(); }, 4000);
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
  }

  function render(list, config) {
    if (!listEl) return;
    if (!list || list.length === 0) {
      listEl.innerHTML = `<div class="no-servers glass-card"><div class="no-servers-content"><div class="no-servers-icon"><i class=\"fas fa-plug\"></i></div><h3>Nenhum webhook configurado</h3><p>Adicione um webhook usando o formulário acima.</p></div></div>`;
      return;
    }
    const loadedTypes = new Set((list || []).filter(w=>w.loaded).map(w=>w.type||'logs'));
    // Routing notice if mapping points to a missing type
    let routingNotice = '';
    try {
      const routing = config?.webhookRouting || {};
      const required = new Set(Object.values(routing).filter(Boolean));
      const missing = Array.from(required).filter(t => !loadedTypes.has(t));
      if (missing.length) {
        routingNotice = `<div class="notification notification-error" style="margin-bottom:8px">O mapeamento aponta para tipos não configurados: <strong>${missing.join(', ')}</strong>. <button id="btnFixRouting" class="btn btn-sm btn-primary">Adicionar automaticamente</button></div>`;
        // Prepare modal content
        if (modalTypes) {
          modalTypes.innerHTML = missing.map(t => `
            <div class="type-row">
              <div><strong>${t}</strong></div>
              <div class="input-row">
                <select class="input" data-channel-for="${t}"><option value="">Selecionar canal…</option>${cachedChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
                <input class="input" data-url-for="${t}" placeholder="Ou cole a URL do webhook do tipo '${t}'" />
              </div>
            </div>
          `).join('');
        }
      }
    } catch (e) { logger.debug('Caught error:', e?.message || e); }

    listEl.innerHTML = routingNotice + list.map(w => `
      <div class="server-card glass-card">
        <div class="server-info">
          <div class="server-icon">🔗</div>
          <div class="server-details">
            <h3>${w.type || 'logs'} — ${w.name || ''}</h3>
            <div class="server-stats"><span><i class="fas fa-hashtag"></i> ${w.channel_name || w.channel_id || '—'}</span><span class="server-status ${w.enabled ? 'online':'offline'}"><i class="fas fa-circle"></i> ${w.enabled ? 'Ativo':'Inativo'}</span><span class="badge" title="Estado de carregamento">${w.loaded ? 'carregado' : 'não carregado'}</span></div>
            <div class="control-grid" style="margin-top:10px;">
              <a href="${w.url}" target="_blank" rel="noopener" class="btn btn-glass btn-sm"><i class="fas fa-external-link-alt"></i> Abrir</a>
              <button class="btn btn-glass btn-sm ${w.loaded ? '' : 'btn-disabled'}" data-test="${w._id}" data-type="${w.type || 'logs'}" data-url="${w.url}" ${w.loaded ? '' : 'disabled'}><i class="fas fa-vial"></i> Testar</button>
              <button class="btn btn-glass btn-sm" data-del="${w._id}" data-type="${w.type || 'logs'}" title="Remover webhook do tipo '${w.type || 'logs'}'"><i class="fas fa-trash"></i> Remover</button>
              <button class="btn btn-glass btn-sm" data-copy="${w.url}"><i class="fas fa-copy"></i> Copiar URL</button>
            </div>
            <div class="text-secondary" data-status="${w.type || 'logs'}"></div>
            <small class="text-secondary">Remover tipo: <strong>${w.type || 'logs'}</strong></small>
          </div>
        </div>
      </div>`).join('');

    listEl.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-del');
      const type = e.currentTarget.getAttribute('data-type') || 'logs';
      if (!confirm(`Remover webhook do tipo '${type}'?`)) return;
      try {
        await api(`/api/guild/${guildId}/webhooks/${id}?type=${encodeURIComponent(type)}`, { method: 'DELETE' });
        notify('Removido', 'success');
        await load();
      } catch (err) { notify(err.message, 'error'); }
    }));

    listEl.querySelectorAll('[data-test]').forEach(btn => btn.addEventListener('click', async (e) => {
      const type = e.currentTarget.getAttribute('data-type') || 'logs';
      const statusEl = listEl.querySelector(`[data-status="${type}"]`);
      if (statusEl) statusEl.textContent = 'A testar...';
      try {
        await api(`/api/guild/${guildId}/webhooks/test`, { method: 'POST', body: JSON.stringify({ type }) });
        notify(`Teste enviado (${type})`, 'success');
        if (statusEl) statusEl.textContent = 'Teste enviado com sucesso';
      } catch (err) { notify(err.message || 'Falha ao testar webhook', 'error'); }
    }));

    const fixBtn = document.getElementById('btnFixRouting');
    if (fixBtn) fixBtn.addEventListener('click', async () => {
      if (!modalOverlay) return;
      modalOverlay.classList.remove('hidden');
      const modal = modalOverlay.querySelector('.modal');
      if (modal) modal.classList.remove('hidden');
    });

    listEl.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async (e) => {
      const url = e.currentTarget.getAttribute('data-copy');
      try { await navigator.clipboard.writeText(url); notify('URL copiada', 'success'); } catch { notify('Falha ao copiar', 'error'); }
    }));
  }

  async function loadChannels() {
    try {
      const data = await api(`/api/guild/${guildId}/channels`);
      cachedChannels = data.channels || [];
      channelEl.innerHTML = `<option value="">—</option>` + (cachedChannels).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
  }

  async function load() {
    if (!guildId) { notify('guildId em falta', 'error'); return; }
    try {
      const [listData, cfgData] = await Promise.all([
        api(`/api/guild/${guildId}/webhooks`),
        api(`/api/guild/${guildId}/config`)
      ]);
      render(listData.webhooks || [], cfgData.config || {});
    } catch (err) {
      if (err && err.status === 503) {
        notify('Base de dados indisponível (MongoDB). Algumas funcionalidades estão temporariamente desativadas.', 'error');
        render([]);
      } else {
        listEl.innerHTML = `<div class="notification notification-error">${(err && err.message) || 'Erro ao carregar webhooks'}</div>`;
      }
    }
  }

  if (btnSave) btnSave.addEventListener('click', async () => {
    try {
      const body = { type: typeEl.value, name: nameEl.value, url: urlEl.value, channel_id: channelEl.value || undefined, channel_name: channelEl.options[channelEl.selectedIndex]?.text || undefined };
      await api(`/api/guild/${guildId}/webhooks`, { method: 'POST', body: JSON.stringify(body) });
      notify('Guardado', 'success');
      await load();
    } catch (err) {
      if (err && err.status === 503) notify('Base de dados indisponível. Tente mais tarde.', 'error');
      else notify(err.message || 'Erro ao guardar webhook', 'error');
    }
  });

  if (btnAuto) btnAuto.addEventListener('click', async () => {
    try {
      await api(`/api/guild/${guildId}/webhooks/auto-setup`, { method: 'POST' });
      notify('Auto-setup solicitado', 'success');
      await load();
    } catch (err) {
      if (err && err.status === 503) notify('Base de dados indisponível. Auto-setup continuará sem persistência.', 'error');
      else notify(err.message || 'Erro no auto-setup', 'error');
    }
  });

  loadChannels();
  load();

  // Modal handlers
  if (modalClose) modalClose.addEventListener('click', () => { modalOverlay?.classList.add('hidden'); modalOverlay?.querySelector('.modal')?.classList.add('hidden'); });
  if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) { modalOverlay.classList.add('hidden'); modalOverlay.querySelector('.modal')?.classList.add('hidden'); } });
  if (modalSubmit) modalSubmit.addEventListener('click', async () => {
    try {
      // Collect entries for each missing type
      const rows = modalTypes?.querySelectorAll('.type-row') || [];
      for (const row of rows) {
        const t = row.querySelector('strong')?.textContent;
        if (!t) continue;
        const chSel = row.querySelector(`[data-channel-for="${t}"]`);
        const urlInput = row.querySelector(`[data-url-for="${t}"]`);
        const chId = chSel?.value || '';
        const url = urlInput?.value?.trim() || '';
        if (!chId && !url) continue; // skip
        if (chId) {
          await api(`/api/guild/${guildId}/webhooks/create-in-channel`, { method: 'POST', body: JSON.stringify({ type: t, channel_id: chId, name: t }) });
        } else if (url) {
          await api(`/api/guild/${guildId}/webhooks`, { method: 'POST', body: JSON.stringify({ type: t, name: t, url }) });
        }
      }
      notify('Tipos em falta adicionados (se fornecidos).', 'success');
      modalOverlay?.classList.add('hidden'); modalOverlay?.querySelector('.modal')?.classList.add('hidden');
      await load();
    } catch (err) { notify(err.message || 'Falha ao guardar', 'error'); }
  });
})();
