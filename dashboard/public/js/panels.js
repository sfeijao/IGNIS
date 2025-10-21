// Panels management page logic
(function() {
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const container = document.getElementById('panelsContainer');
  const chanSel = document.getElementById('panelChannel');
  const typeSel = document.getElementById('panelType');
  const themeSel = document.getElementById('panelTheme');
  const templateSel = document.getElementById('panelTemplate');
  const btnCreate = document.getElementById('btnCreatePanel');
  const btnScan = document.getElementById('btnScanPanels');
  const scanBox = document.getElementById('scanAdvanced');
  const scanChannels = document.getElementById('scanChannels');
  const scanMessages = document.getElementById('scanMessages');
  const btnScanNow = document.getElementById('btnScanNow');
  const preview = document.getElementById('panelPreview');
  const fetchCached = window.IGNISFetch && window.IGNISFetch.fetchJsonCached;

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
    // Prefer cached GETs (for listing panels/channels) to reduce bursts; POST/others go direct
    const isGet = !opts || !opts.method || String(opts.method).toUpperCase() === 'GET';
    if (isGet && fetchCached) {
      const { ok, json, stale, status } = await fetchCached(path, { ttlMs: 60_000, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
      if (stale) showStaleBanner();
      if (!ok) throw new Error(json?.error || `HTTP ${status || 500}`);
      if (json?.success === false) throw new Error(json?.error || 'Erro');
      return json;
    }
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...opts });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  function showStaleBanner() {
    try {
      if (document.getElementById('stale-banner')) return;
      const el = document.createElement('div');
      el.id = 'stale-banner';
      el.style.position = 'fixed';
      el.style.bottom = '16px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.background = 'rgba(124,58,237,0.95)';
      el.style.color = '#fff';
      el.style.padding = '10px 14px';
      el.style.borderRadius = '8px';
      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      el.style.zIndex = '9999';
      el.style.fontSize = '14px';
      el.textContent = 'Mostrando dados em cache temporariamente (a API do Discord limitou pedidos).';
      document.body.appendChild(el);
      setTimeout(() => { el.remove(); }, 4000);
    } catch {}
  }

  function renderList(panels) {
    if (!container) return;
    const visible = (panels || []).filter(p => (p.detected === true) || (p.channelExists && p.messageExists));
    if (!visible || visible.length === 0) {
      container.innerHTML = `
        <div class="no-servers glass-card">
          <div class="no-servers-content">
            <div class="no-servers-icon"><i class="fas fa-ticket-alt"></i></div>
            <h3>Nenhum painel ativo encontrado</h3>
            <p>Crie um novo painel ou use "Procurar Painéis" para detetar painéis existentes no Discord.</p>
          </div>
        </div>`;
      return;
    }

    const html = visible.map(p => {
      const created = new Date(p.createdAt || p.created_at || p._id?.toString().substring(0,8)).toLocaleString('pt-PT');
      const detectedBadge = p.detected ? '<span class="badge badge-warn">detectado</span>' : '<span class="badge badge-ok">guardado</span>';
      const currentTemplate = (p.template || 'classic');
      const tFriendly = {
        classic: 'Clássico',
        compact: 'Compacto',
        premium: 'Premium',
        minimal: 'Minimal'
      };
      const nextTemplate = (cur) => {
        const order = ['classic','compact','premium','minimal'];
        const idx = order.indexOf(cur);
        return order[(idx >= 0 ? idx : 0) + 1 === order.length ? 0 : (idx >= 0 ? idx + 1 : 1)];
      };
      const nextT = nextTemplate(currentTemplate);
      // Controls: if detected, only allow Save; other actions require a persisted panel
      const controls = p.detected
        ? '<button class="btn btn-success btn-sm" data-action="save" title="Registar este painel na base de dados"><i class="fas fa-save"></i> Guardar</button>'
        : [
            '<button class="btn btn-glass btn-sm" data-action="resend"><i class="fas fa-paper-plane"></i> Reenviar</button>',
            '<button class="btn btn-primary btn-sm" data-action="recreate"><i class="fas fa-rotate"></i> Recriar</button>',
            `<button class=\"btn btn-glass btn-sm\" data-action=\"theme\" data-theme=\"${p.theme==='dark'?'light':'dark'}\"><i class=\"fas fa-adjust\"></i> Tema: ${p.theme==='dark'?'Claro':'Escuro'}</button>`,
            `<button class=\"btn btn-glass btn-sm\" data-action=\"template\" data-template=\"${nextT}\"><i class=\"fas fa-layer-group\"></i> Modelo: ${tFriendly[nextT] || nextT}</button>`,
            '<button class="btn btn-logout btn-sm" data-action="delete"><i class="fas fa-trash"></i> Eliminar</button>'
          ].join('');
      return `
        <div class="server-card glass-card ${p.__justSaved ? 'highlight-saved' : ''}" data-panel-id="${p._id}" data-channel-name="${(p.channelName || p.channel_id).toString().replace(/"/g,'&quot;')}">
          <div class="server-info">
            <div class="server-icon">🎫</div>
            <div class="server-details">
              <h3>Canal: #${p.channelName || p.channel_id} ${detectedBadge}</h3>
              <div class="server-stats">
                <span><i class="fas fa-palette"></i> Tema: ${p.theme || 'dark'}</span>
                <span><i class="fas fa-layer-group"></i> Modelo: ${p.template || 'classic'}</span>
                <span class="server-status ${p.messageExists ? 'online':'offline'}">
                  <i class="fas fa-circle"></i> Mensagem ${p.messageExists ? 'encontrada':'não encontrada'}
                </span>
              </div>
              <div class="control-grid">
                ${controls}
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
          if (action === 'template') {
            const template = e.currentTarget.dataset.template;
            if (template) body.data = { template };
          }
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
      const type = typeSel?.value || 'tickets';
      const theme = themeSel?.value || 'dark';
      const template = templateSel?.value || 'classic';
      if (!channel_id) return notify('Selecione um canal', 'error');
      const body = { channel_id, theme, template, type };
      await api(`/api/guild/${guildId}/panels/create`, { method: 'POST', body: JSON.stringify(body) });
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

  // Live preview rendering
  function renderPreview() {
    if (!preview) return;
    const theme = themeSel?.value || 'dark';
    const type = typeSel?.value || 'tickets';
    const template = templateSel?.value || 'classic';
    preview.className = `preview-embed ${theme}`;
    if (type === 'verification') {
      // Filter template options to verification-compatible
      if (templateSel) {
        Array.from(templateSel.options).forEach(opt => {
          const forType = opt.getAttribute('data-for') || 'tickets';
          opt.hidden = (forType !== 'verification');
        });
        if (!templateSel.value || templateSel.querySelector(`option[value="${templateSel.value}"][data-for="verification"]`) == null) {
          templateSel.value = 'minimal';
        }
        templateSel.disabled = false;
      }
      const vt = templateSel?.value || 'minimal';
      const title = '🔒 Verificação do Servidor';
      const desc = vt === 'rich'
        ? 'Bem-vindo(a)! Para aceder a todos os canais, conclui a verificação abaixo.'
        : 'Clica em Verificar para concluir e ganhar acesso aos canais.';
      const buttons = [{ label: 'Verificar', emoji: '✅' }];
      const fields = vt === 'rich' ? [
        { name: '⚠️ Importante', value: 'Segue as regras do servidor e mantém um perfil adequado.' }
      ] : [];
      preview.innerHTML = `
        <div class="preview-title">${title}</div>
        <div class="preview-desc">${desc}</div>
        ${fields.length ? `<div class="preview-fields">${fields.map(f => `<div class=\"preview-field\"><div class=\"text-secondary\" style=\"font-size:12px\">${f.name}</div><div>${f.value}</div></div>`).join('')}</div>` : ''}
        <div class="preview-buttons">${buttons.map(b => `<div class=\"preview-btn\">${b.emoji} ${b.label}</div>`).join('')}</div>
      `;
    } else {
      if (templateSel) {
        templateSel.disabled = false;
        Array.from(templateSel.options).forEach(opt => {
          const forType = opt.getAttribute('data-for') || 'tickets';
          opt.hidden = (forType !== 'tickets');
        });
        if (!templateSel.value || templateSel.querySelector(`option[value="${templateSel.value}"][data-for="tickets"]`) == null) {
          templateSel.value = 'classic';
        }
      }
      const title = template === 'premium' ? '🎫 Centro de Suporte • Premium'
                   : template === 'compact' ? '🎫 Tickets • Compacto'
                   : template === 'minimal' ? '🎫 Abrir ticket'
                   : '🎫 Centro de Suporte';
      const desc = template === 'minimal'
        ? 'Clica num botão para abrir um ticket privado.'
        : 'Escolhe o departamento abaixo para abrir um ticket privado com a equipa.';
      const fields = [
        { name: '• Resposta rápida', value: template==='compact' ? 'Minutos' : 'Tempo médio: minutos' },
        { name: '• Canal privado', value: 'Visível só para ti e staff' },
        { name: '• Histórico guardado', value: 'Transcript disponível' }
      ];
      const buttons = template === 'compact'
        ? [
            { label: 'Suporte', emoji: '🎫', style: 'primary' },
            { label: 'Problema', emoji: '⚠️', style: 'danger' },
          ]
        : [
            { label: 'Suporte Técnico', emoji: '🔧', style: 'primary' },
            { label: 'Reportar Problema', emoji: '⚠️', style: 'danger' },
            { label: 'Moderação & Segurança', emoji: '🛡️', style: 'secondary' },
            { label: 'Dúvidas Gerais', emoji: '💬', style: 'secondary' },
            { label: 'Suporte de Conta', emoji: '🧾', style: 'secondary' }
          ];
      preview.innerHTML = `
        <div class="preview-title">${title}</div>
        <div class="preview-desc">${desc}</div>
        <div class="preview-fields">${fields.map(f => `<div class="preview-field"><div class="text-secondary" style="font-size:12px">${f.name}</div><div>${f.value}</div></div>`).join('')}</div>
        <div class="preview-buttons">${buttons.map(b => `<div class="preview-btn">${b.emoji} ${b.label}</div>`).join('')}</div>
      `;
    }
  }

  if (typeSel) typeSel.addEventListener('change', renderPreview);
  if (themeSel) themeSel.addEventListener('change', renderPreview);
  if (templateSel) templateSel.addEventListener('change', renderPreview);
  renderPreview();

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
