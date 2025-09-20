// Panels management page logic
(function() {
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const container = document.getElementById('panelsContainer');
  const chanSel = document.getElementById('panelChannel');
  const themeSel = document.getElementById('panelTheme');
  const btnCreate = document.getElementById('btnCreatePanel');
  const btnScan = document.getElementById('btnScanPanels');
  const scanBox = document.getElementById('scanAdvanced');
  const scanChannels = document.getElementById('scanChannels');
  const scanMessages = document.getElementById('scanMessages');
  const btnScanNow = document.getElementById('btnScanNow');

  if (!guildId) {
    if (container) container.innerHTML = `<div class="notification notification-error">ID do servidor em falta. Volte ao dashboard e selecione um servidor.</div>`;
    return;
  }

  function notify(message, type = 'info') {
    const div = document.createElement('div');
    div.className = `notification notification-${type} slide-up`;
    div.innerHTML = `<i class="fas ${type==='error'?'fa-exclamation-circle': type==='success'? 'fa-check-circle':'fa-info-circle'}"></i><span>${message}</span>`;
    document.body.appendChild(div);
    setTimeout(() => { div.style.animation = 'slideDown 0.3s ease-in'; setTimeout(() => div.remove(), 300); }, 3000);
  }

  async function api(path, opts) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...opts });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  function renderList(panels) {
    if (!container) return;
    if (!panels || panels.length === 0) {
      container.innerHTML = `
        <div class="no-servers glass-card">
          <div class="no-servers-content">
            <div class="no-servers-icon"><i class="fas fa-ticket-alt"></i></div>
            <h3>Nenhum painel encontrado</h3>
            <p>Use o comando /configurar-painel-tickets no Discord para criar um.</p>
          </div>
        </div>`;
      return;
    }

    const html = panels.map(p => {
      const created = new Date(p.createdAt || p.created_at || p._id?.toString().substring(0,8)).toLocaleString('pt-PT');
      const detectedBadge = p.detected ? '<span class="badge badge-warn">detectado</span>' : '<span class="badge badge-ok">guardado</span>';
      return `
        <div class="server-card glass-card ${p.__justSaved ? 'highlight-saved' : ''}" data-panel-id="${p._id}" data-channel-name="${(p.channelName || p.channel_id).toString().replace(/"/g,'&quot;')}">
          <div class="server-info">
            <div class="server-icon">🎫</div>
            <div class="server-details">
              <h3>Canal: #${p.channelName || p.channel_id} ${detectedBadge}</h3>
              <div class="server-stats">
                <span><i class="fas fa-palette"></i> Tema: ${p.theme || 'dark'}</span>
                <span class="server-status ${p.messageExists ? 'online':'offline'}">
                  <i class="fas fa-circle"></i> Mensagem ${p.messageExists ? 'encontrada':'não encontrada'}
                </span>
              </div>
              <div class="control-grid" style="margin-top:10px; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 8px;">
                <button class="btn btn-glass btn-sm" data-action="resend"><i class="fas fa-paper-plane"></i> Reenviar</button>
                <button class="btn btn-primary btn-sm" data-action="recreate"><i class="fas fa-rotate"></i> Recriar</button>
                <button class="btn btn-glass btn-sm" data-action="theme" data-theme="${p.theme==='dark'?'light':'dark'}"><i class="fas fa-adjust"></i> Tema: ${p.theme==='dark'?'Claro':'Escuro'}</button>
                <button class="btn btn-logout btn-sm" data-action="delete"><i class="fas fa-trash"></i> Eliminar</button>
                ${p.detected ? '<button class="btn btn-success btn-sm" data-action="save" title="Registar este painel na base de dados"><i class="fas fa-save"></i> Guardar</button>' : ''}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = html;

    // Bind actions
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const card = e.currentTarget.closest('[data-panel-id]');
        const panelId = card?.dataset.panelId;
        const action = e.currentTarget.dataset.action;
        const theme = e.currentTarget.dataset.theme;
        if (!panelId) return;
        try {
          const body = { action };
          if (action === 'theme') body.data = { theme };
          const res = await api(`/api/guild/${guildId}/panels/${panelId}/action`, {
            method: 'POST',
            body: JSON.stringify(body)
          });
          // Custom handling for save to include channel name
          // Se acabámos de salvar um detetado, marcar highlight para esta sessão
          if (action === 'save' && panelId.startsWith('detected:') && res.panel) {
            const ch = card?.dataset?.channelName || res.panel.channel_id;
            if (ch) notify(`Painel guardado: #${ch}`, 'success');
            // Recarregar e adicionar marca visual breve
            await load();
            const card = container.querySelector(`[data-panel-id="${res.panel._id}"]`);
            if (card) {
              card.classList.add('highlight-saved');
              setTimeout(() => card.classList.remove('highlight-saved'), 2500);
            }
            return;
          }
          notify(res.message || 'Ação concluída', 'success');
          await load();
        } catch (err) {
          console.error(err);
          notify(err.message || 'Falha na ação', 'error');
        }
      });
    });
  }

  async function load() {
    try {
      const data = await api(`/api/guild/${guildId}/panels`);
      renderList(data.panels || []);
    } catch (err) {
      console.error(err);
      if (container) container.innerHTML = `<div class="notification notification-error">${err.message || 'Erro ao carregar painéis'}</div>`;
    }
  }

  async function loadChannels() {
    try {
      const d = await api(`/api/guild/${guildId}/channels`);
      if (chanSel) chanSel.innerHTML = `<option value="">—</option>` + (d.channels || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch {}
  }

  if (btnCreate) btnCreate.addEventListener('click', async () => {
    try {
      const channel_id = chanSel?.value;
      const theme = themeSel?.value || 'dark';
      if (!channel_id) return notify('Selecione um canal', 'error');
      await api(`/api/guild/${guildId}/panels/create`, { method: 'POST', body: JSON.stringify({ channel_id, theme }) });
      notify('Painel criado', 'success');
      await load();
    } catch (err) { notify(err.message, 'error'); }
  });

  if (btnScan) btnScan.addEventListener('click', async () => {
    try {
      // Usar limites razoáveis para varredura profunda
      const body = { channelsLimit: 100, messagesPerChannel: 200, persist: true };
      const res = await api(`/api/guild/${guildId}/panels/scan`, { method: 'POST', body: JSON.stringify(body) });
      notify(`Scan concluído: ${res.detected} detetados${typeof res.persisted==='number' ? `, ${res.persisted} guardados` : ''}.`, 'success');
      await load();
    } catch (err) {
      console.error(err);
      notify(err.message || 'Falha ao procurar painéis', 'error');
    }
  });

  if (btnScanNow) btnScanNow.addEventListener('click', async () => {
    try {
      const ch = Math.max(1, Math.min(200, parseInt(scanChannels?.value || '100', 10)));
      const msg = Math.max(1, Math.min(1000, parseInt(scanMessages?.value || '200', 10)));
      const res = await api(`/api/guild/${guildId}/panels/scan`, { method: 'POST', body: JSON.stringify({ channelsLimit: ch, messagesPerChannel: msg, persist: true }) });
      notify(`Scan avançado: ${res.detected} detetados${typeof res.persisted==='number' ? `, ${res.persisted} guardados` : ''}.`, 'success');
      await load();
    } catch (err) {
      console.error(err);
      notify(err.message || 'Falha no scan avançado', 'error');
    }
  });

  loadChannels();
  load();

  // Mostrar opções avançadas apenas para administradores
  (async () => {
    try {
      const r = await fetch(`/api/guild/${guildId}/is-admin`, { credentials: 'same-origin' });
      const d = await r.json().catch(()=>({}));
      if (r.ok && d.success && d.isAdmin) {
        if (scanBox) scanBox.style.display = '';
      }
    } catch {}
  })();
})();
