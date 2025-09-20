(function() {
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const listEl = document.getElementById('webhooksList');
  const typeEl = document.getElementById('whType');
  const nameEl = document.getElementById('whName');
  const urlEl = document.getElementById('whUrl');
  const channelEl = document.getElementById('whChannel');
  const btnSave = document.getElementById('btnSaveWebhook');
  const btnAuto = document.getElementById('btnAutoSetup');

  function notify(msg, type='info') {
    const div = document.createElement('div');
    div.className = `notification notification-${type} slide-up`;
    div.innerHTML = `<i class="fas ${type==='error'?'fa-exclamation-circle': type==='success'? 'fa-check-circle':'fa-info-circle'}"></i><span>${msg}</span>`;
    document.body.appendChild(div);
    setTimeout(() => { div.style.animation = 'slideDown 0.3s ease-in'; setTimeout(() => div.remove(), 300); }, 3000);
  }

  async function api(path, opts) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...opts });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const err = new Error(json.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  function render(list) {
    if (!listEl) return;
    if (!list || list.length === 0) {
      listEl.innerHTML = `<div class="no-servers glass-card"><div class="no-servers-content"><div class="no-servers-icon"><i class=\"fas fa-plug\"></i></div><h3>Nenhum webhook configurado</h3><p>Adicione um webhook usando o formulário acima.</p></div></div>`;
      return;
    }
    listEl.innerHTML = list.map(w => `
      <div class="server-card glass-card">
        <div class="server-info">
          <div class="server-icon">🔗</div>
          <div class="server-details">
            <h3>${w.type || 'logs'} — ${w.name || ''}</h3>
            <div class="server-stats"><span><i class="fas fa-hashtag"></i> ${w.channel_name || w.channel_id || '—'}</span><span class="server-status ${w.enabled ? 'online':'offline'}"><i class="fas fa-circle"></i> ${w.enabled ? 'Ativo':'Inativo'}</span></div>
            <div class="control-grid" style="margin-top:10px; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px;">
              <a href="${w.url}" target="_blank" rel="noopener" class="btn btn-glass btn-sm"><i class="fas fa-external-link-alt"></i> Abrir</a>
              <button class="btn btn-glass btn-sm" data-del="${w._id}"><i class="fas fa-trash"></i> Remover</button>
              <button class="btn btn-glass btn-sm" data-copy="${w.url}"><i class="fas fa-copy"></i> Copiar URL</button>
            </div>
          </div>
        </div>
      </div>`).join('');

    listEl.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-del');
      if (!confirm('Remover webhook?')) return;
      try {
        await api(`/api/guild/${guildId}/webhooks/${id}`, { method: 'DELETE' });
        notify('Removido', 'success');
        await load();
      } catch (err) { notify(err.message, 'error'); }
    }));

    listEl.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async (e) => {
      const url = e.currentTarget.getAttribute('data-copy');
      try { await navigator.clipboard.writeText(url); notify('URL copiada', 'success'); } catch { notify('Falha ao copiar', 'error'); }
    }));
  }

  async function loadChannels() {
    try {
      const data = await api(`/api/guild/${guildId}/channels`);
      channelEl.innerHTML = `<option value="">—</option>` + (data.channels || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch {}
  }

  async function load() {
    if (!guildId) { notify('guildId em falta', 'error'); return; }
    try {
      const data = await api(`/api/guild/${guildId}/webhooks`);
      render(data.webhooks || []);
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
})();
