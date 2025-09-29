// IGNIS Bot Settings UI
(function() {
  const qs = (s) => document.querySelector(s);
  const url = new URL(window.location.href);
  const guildId = url.searchParams.get('guildId');

  const alertBox = qs('#alert');
  const showAlert = (msg, type='info') => {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
  };

  const els = {
    nickname: qs('#nickname'),
    statusType: qs('#statusType'),
    statusText: qs('#statusText'),
    presenceStatus: qs('#presenceStatus'),
    defaultLanguage: qs('#defaultLanguage'),
    timezone: qs('#timezone'),
    prefix: qs('#prefix'),
    ephemeralByDefault: qs('#ephemeralByDefault'),
    enableModerationLogs: qs('#enableModerationLogs'),
    btnSave: qs('#btnSave'),
    btnReload: qs('#btnReload')
  };

  async function loadSettings() {
    if (!guildId) {
      showAlert('GuildId inválido', 'error');
      return;
    }
    try {
      const r = await fetch(`/api/guild/${guildId}/bot-settings`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!data.success) throw new Error(data.error || 'Falha ao obter configurações');
      const s = data.settings || {};
      els.nickname.value = s.nickname || '';
      els.statusType.value = s.statusType || 'CUSTOM';
      els.statusText.value = s.statusText || '';
      els.presenceStatus.value = s.presenceStatus || 'online';
      els.defaultLanguage.value = s.defaultLanguage || '';
      els.timezone.value = s.timezone || '';
      els.prefix.value = s.prefix || '';
      els.ephemeralByDefault.checked = !!s.ephemeralByDefault;
      els.enableModerationLogs.checked = s.enableModerationLogs !== false;
      showAlert('Configurações carregadas', 'success');
    } catch (e) {
      console.error(e);
      showAlert('Erro ao carregar configurações', 'error');
    }
  }

  async function saveSettings() {
    try {
      const payload = {
        nickname: els.nickname.value.trim(),
        statusType: els.statusType.value,
        statusText: els.statusText.value.trim(),
        presenceStatus: els.presenceStatus.value,
        defaultLanguage: els.defaultLanguage.value.trim(),
        timezone: els.timezone.value.trim(),
        prefix: els.prefix.value.trim(),
        ephemeralByDefault: !!els.ephemeralByDefault.checked,
        enableModerationLogs: !!els.enableModerationLogs.checked
      };
      const r = await fetch(`/api/guild/${guildId}/bot-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || 'Falha ao guardar');
      showAlert('Guardado com sucesso. Algumas alterações podem demorar alguns segundos a refletir.', 'success');
    } catch (e) {
      console.error(e);
      showAlert('Erro ao guardar configurações', 'error');
    }
  }

  if (els.btnSave) els.btnSave.addEventListener('click', saveSettings);
  if (els.btnReload) els.btnReload.addEventListener('click', loadSettings);

  // Quick helpers
  const testPresence = async () => {
    try {
      const payload = {
        statusType: 'PLAYING',
        statusText: 'a testar presença',
        presenceStatus: 'online'
      };
      const r = await fetch(`/api/guild/${guildId}/bot-settings`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify(payload) });
      const d = await r.json(); if(!r.ok||!d.success) throw new Error(d.error||'Falha no teste');
      showAlert('Presença atualizada para teste (pode demorar alguns segundos).', 'success');
    } catch(e){ console.error(e); showAlert('Erro ao testar presença', 'error'); }
  };
  const resetNickname = async () => {
    try {
      const payload = { nickname: '' };
      const r = await fetch(`/api/guild/${guildId}/bot-settings`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify(payload) });
      const d = await r.json(); if(!r.ok||!d.success) throw new Error(d.error||'Falha ao resetar');
      showAlert('Apelido resetado para o nome padrão do bot.', 'success');
      await loadSettings();
    } catch(e){ console.error(e); showAlert('Erro ao resetar apelido', 'error'); }
  };
  const btnPresence = qs('#btnTestPresence'); if(btnPresence) btnPresence.addEventListener('click', testPresence);
  const btnReset = qs('#btnResetNick'); if(btnReset) btnReset.addEventListener('click', resetNickname);

  loadSettings();
})();
