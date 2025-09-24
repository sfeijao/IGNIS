(function(){
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guildId');
  const els = {
    catSupport: document.getElementById('catSupport'),
    catReport: document.getElementById('catReport'),
    catPartner: document.getElementById('catPartner'),
    catStaff: document.getElementById('catStaff'),
    typeDm: document.getElementById('typeDm'),
    typeChannel: document.getElementById('typeChannel'),
    typeForm: document.getElementById('typeForm'),
    autoAssign: document.getElementById('autoAssign'),
    slaMinutes: document.getElementById('slaMinutes'),
    welcomeMsg: document.getElementById('welcomeMsg'),
    closeReason: document.getElementById('closeReason'),
    closeTranscript: document.getElementById('closeTranscript'),
    defaultTemplate: document.getElementById('defaultTemplate'),
    save: document.getElementById('btnSave'),
  };
  
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
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  async function load() {
    if (!guildId) return notify('guildId em falta', 'error');
    try {
      const d = await api(`/api/guild/${guildId}/tickets/config`);
      const cfg = (d.config || {});
      const t = (cfg.tickets || {});
      (els.catSupport || {}).checked = !!t.categories?.support;
      (els.catReport || {}).checked = !!t.categories?.report;
      (els.catPartner || {}).checked = !!t.categories?.partner;
      (els.catStaff || {}).checked = !!t.categories?.staff;
      (els.typeDm || {}).checked = !!t.types?.dm;
      (els.typeChannel || {}).checked = !!t.types?.channel;
      (els.typeForm || {}).checked = !!t.types?.form;
      if (els.autoAssign) els.autoAssign.value = t.autoAssign || 'first';
      if (els.slaMinutes) els.slaMinutes.value = t.slaMinutes || 15;
      if (els.welcomeMsg) els.welcomeMsg.value = t.welcomeMsg || 'Olá {user}, obrigado por abrir o ticket #{ticket_id}! Explique-nos o seu problema.';
      (els.closeReason || {}).checked = !!t.closeReason;
      (els.closeTranscript || {}).checked = !!t.closeTranscript;
      if (els.defaultTemplate) {
        const allowed = ['classic','compact','premium','minimal'];
        els.defaultTemplate.value = allowed.includes(t.defaultTemplate) ? t.defaultTemplate : 'classic';
      }
    } catch (e) { console.error(e); notify(e.message, 'error'); }
  }

  async function save() {
    try {
      const payload = {
        tickets: {
          categories: {
            support: !!els.catSupport?.checked,
            report: !!els.catReport?.checked,
            partner: !!els.catPartner?.checked,
            staff: !!els.catStaff?.checked
          },
          types: {
            dm: !!els.typeDm?.checked,
            channel: !!els.typeChannel?.checked,
            form: !!els.typeForm?.checked
          },
          autoAssign: els.autoAssign?.value || 'first',
          slaMinutes: Math.max(1, Math.min(1440, parseInt(els.slaMinutes?.value || '15', 10))),
          welcomeMsg: els.welcomeMsg?.value || '',
          closeReason: !!els.closeReason?.checked,
          closeTranscript: !!els.closeTranscript?.checked,
          defaultTemplate: (() => {
            const v = els.defaultTemplate?.value || 'classic';
            return ['classic','compact','premium','minimal'].includes(v) ? v : 'classic';
          })()
        }
      };
      await api(`/api/guild/${guildId}/tickets/config`, { method: 'POST', body: JSON.stringify(payload) });
      notify('Configurações guardadas', 'success');
    } catch (e) { console.error(e); notify(e.message, 'error'); }
  }

  if (els.save) els.save.addEventListener('click', save);
  load();
})();
