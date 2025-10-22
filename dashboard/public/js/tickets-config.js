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
  theme: document.getElementById('theme'),
  embedColor: document.getElementById('embedColor'),
    panelChannel: document.getElementById('panelChannel'),
    ticketsCategory: document.getElementById('ticketsCategory'),
    logsChannel: document.getElementById('logsChannel'),
    newCategoryName: document.getElementById('newCategoryName'),
    btnCreateCategory: document.getElementById('btnCreateCategory'),
    accessRoles: document.getElementById('accessRoles'),
    save: document.getElementById('btnSave'),
    btnPreview: document.getElementById('btnPreview'),
    btnPublish: document.getElementById('btnPublish'),
    userName: document.getElementById('userName'),
    userAvatar: document.getElementById('userAvatar'),
  };

  function notify(msg, type='info') {
    const div = document.createElement('div');
    div.className = `notification notification-${type} slide-up`;
    div.innerHTML = `<i class="fas ${type==='error'?'fa-exclamation-circle': type==='success'? 'fa-check-circle':'fa-info-circle'}"></i><span>${msg}</span>`;
    document.body.appendChild(div);
    setTimeout(() => { div.style.animation = 'slideDown 0.3s ease-in'; setTimeout(() => div.remove(), 300); }, 3000);
  }

  async function api(path, opts) {
    // Prefer shared cached fetch helper if available
    if (window.IGNISFetch && window.IGNISFetch.fetchJsonCached && (!opts || (opts.method||'GET') === 'GET')){
      const out = await window.IGNISFetch.fetchJsonCached(path, { ttlMs: 60_000 });
      if (!out.ok) throw new Error(out.json?.error || `HTTP ${out.status||''}`);
      return out.json;
    } else {
      const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...opts });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    }
  }

  async function loadUser(){
    try {
      const d = await api('/api/user');
      if (d?.success && d.user){
        if (els.userName) els.userName.textContent = d.user.username || 'Utilizador';
        if (els.userAvatar && d.user.avatar) els.userAvatar.src = d.user.avatar;
      }
    } catch {}
  }

  async function load() {
    if (!guildId) return notify('guildId em falta', 'error');
    try {
      // Load pickers in parallel
      const [channelsRes, categoriesRes, rolesRes] = await Promise.allSettled([
        api(`/api/guild/${guildId}/channels`),
        api(`/api/guild/${guildId}/categories`),
        api(`/api/guild/${guildId}/roles`)
      ]);
      const channels = channelsRes.status==='fulfilled' ? (channelsRes.value.channels||[]) : [];
      const categories = categoriesRes.status==='fulfilled' ? (categoriesRes.value.categories||[]) : [];
      const roles = rolesRes.status==='fulfilled' ? (rolesRes.value.roles||[]) : [];
      if (els.panelChannel) {
        els.panelChannel.innerHTML = `<option value="">— Selecionar canal —</option>` + channels.map(c=>`<option value="${c.id}">${(c.name||c.id)}</option>`).join('');
      }
      if (els.ticketsCategory) {
        els.ticketsCategory.innerHTML = `<option value="">— Sem categoria —</option>` + categories.map(c=>`<option value="${c.id}">${(c.name||c.id)}</option>`).join('');
      }
      if (els.logsChannel) {
        els.logsChannel.innerHTML = `<option value="">— Sem logs —</option>` + channels.map(c=>`<option value="${c.id}">${(c.name||c.id)}</option>`).join('');
      }
      if (els.accessRoles) {
        els.accessRoles.innerHTML = roles.map(r=>`<option value="${r.id}">${(r.name||r.id)}</option>`).join('');
        // Enhance multiselect UI for better usability
        if (window.IGNISMultiselect) {
          window.IGNISMultiselect.enhance(els.accessRoles, { searchPlaceholder: 'Pesquisar cargos…' });
        }
      }
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
      // New fields
      if (els.panelChannel) els.panelChannel.value = t.panelChannelId || '';
      if (els.ticketsCategory) els.ticketsCategory.value = t.ticketsCategoryId || '';
      if (els.logsChannel) els.logsChannel.value = t.logsChannelId || '';
      if (els.accessRoles && Array.isArray(t.accessRoleIds)) {
        for (const opt of els.accessRoles.options) { opt.selected = t.accessRoleIds.includes(opt.value); }
        if (window.IGNISMultiselect) window.IGNISMultiselect.refresh(els.accessRoles);
      }
    } catch (e) { console.error(e); notify(e.message, 'error'); }
  }

  async function save() {
    try {
      // Basic validation
      if (els.accessRoles && Array.from(els.accessRoles.selectedOptions||[]).length === 0) {
        notify('Seleciona pelo menos um cargo com acesso aos tickets', 'error');
        return;
      }
      // Stricter validation as requested: require category and logs channel
      if (!els.ticketsCategory?.value) {
        notify('Seleciona a categoria para os tickets', 'error');
        return;
      }
      if (!els.logsChannel?.value) {
        notify('Seleciona o canal de logs para os tickets', 'error');
        return;
      }
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
          })(),
          panelChannelId: els.panelChannel?.value || '',
          ticketsCategoryId: els.ticketsCategory?.value || '',
          logsChannelId: els.logsChannel?.value || '',
          accessRoleIds: (()=>{
            if (!els.accessRoles) return [];
            return Array.from(els.accessRoles.selectedOptions || []).map(o=>o.value);
          })()
        }
      };
      await api(`/api/guild/${guildId}/tickets/config`, { method: 'POST', body: JSON.stringify(payload) });
      notify('Configurações guardadas', 'success');
    } catch (e) { console.error(e); notify(e.message, 'error'); }
  }

  if (els.save) els.save.addEventListener('click', save);
  // Rich preview: mirror server-side tickets panel embed structure
  function buildTicketsPanelModel(template, guildName){
    const t = template || 'classic';
    const model = { title: '', description: '', fields: [], rows: [] };
    if (t === 'compact') {
      model.title = '🎫 Tickets • Compacto';
      model.description = 'Escolhe abaixo e abre um ticket privado.';
      model.rows = [
        [
          { label: 'Suporte', emoji: '🎫', style: 'primary' },
          { label: 'Problema', emoji: '⚠️', style: 'danger' },
        ]
      ];
    } else if (t === 'minimal') {
      model.title = '🎫 Abrir ticket';
      model.description = 'Carrega num botão para abrir um ticket.';
      model.rows = [[ { label: 'Abrir Ticket', emoji: '🎟️', style: 'primary' } ]];
    } else if (t === 'premium') {
      model.title = '🎫 Centro de Suporte • Premium';
      model.description = 'Serviço prioritário, acompanhamento dedicado e histórico guardado.';
      model.fields = [
        { name: '• Resposta express', value: 'Prioridade máxima' },
        { name: '• Privado & seguro', value: 'Só tu e equipa' },
        { name: '• Transcript', value: 'Disponível a pedido' },
      ];
      model.rows = [
        [
          { label: 'VIP / Premium', emoji: '👑', style: 'success' },
          { label: 'Suporte Técnico', emoji: '🔧', style: 'primary' },
          { label: 'Reportar Problema', emoji: '⚠️', style: 'danger' },
        ],
        [
          { label: 'Moderação & Segurança', emoji: '🛡️', style: 'secondary' },
          { label: 'Dúvidas Gerais', emoji: '💬', style: 'secondary' },
        ]
      ];
    } else {
      // classic
      model.title = '🎫 Centro de Suporte';
      model.description = 'Escolhe o departamento abaixo para abrir um ticket privado com a equipa.';
      model.fields = [
        { name: '• Resposta rápida', value: 'Tempo médio: minutos' },
        { name: '• Canal privado', value: 'Visível só para ti e staff' },
        { name: '• Histórico guardado', value: 'Transcript disponível' },
      ];
      model.rows = [
        [
          { label: 'Suporte Técnico', emoji: '🔧', style: 'primary' },
          { label: 'Reportar Problema', emoji: '⚠️', style: 'danger' },
          { label: 'Moderação & Segurança', emoji: '🛡️', style: 'secondary' },
        ],
        [
          { label: 'Dúvidas Gerais', emoji: '💬', style: 'secondary' },
          { label: 'Suporte de Conta', emoji: '🧾', style: 'secondary' },
        ]
      ];
    }
    return model;
  }
  function openPreview(){
    const tmpl = els.defaultTemplate?.value || 'classic';
    const model = buildTicketsPanelModel(tmpl, 'Servidor');
    const parseColor = (s)=>{ if (!s) return null; const t = String(s).trim(); return /^#?[0-9a-fA-F]{6}$/.test(t) ? `#${t.replace('#','')}` : null; };
    const theme = (els.theme?.value === 'light') ? 'light' : 'dark';
    const resolved = parseColor(els.embedColor?.value) || (theme === 'light' ? '#60A5FA' : '#7C3AED');
    const css = `.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:10000}.modal{background:rgba(17,24,39,.98);border:1px solid rgba(255,255,255,.08);border-radius:12px;max-width:760px;width:92%;padding:16px;color:#e5e7eb}.modal h3{margin:0 0 8px}.embed{border-left:4px solid ${resolved};background:rgba(255,255,255,.02);padding:12px;border-radius:8px}.embed-title{font-weight:700;margin-bottom:6px}.embed-desc{white-space:pre-wrap;opacity:.95;margin-bottom:8px}.embed-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:8px}.embed-field{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);padding:8px;border-radius:6px}.buttons{display:flex;flex-wrap:wrap;gap:8px}.btnx{border-radius:6px;padding:8px 10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);cursor:default}.btnx.primary{background:#3B82F6;color:#fff;border-color:#2563EB}.btnx.secondary{background:#374151;color:#e5e7eb;border-color:#4B5563}.btnx.danger{background:#DC2626;color:#fff;border-color:#B91C1C}.btnx.success{background:#16A34A;color:#fff;border-color:#15803D}.actions{display:flex;justify-content:flex-end;margin-top:12px}`;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const overlay = document.createElement('div'); overlay.className='modal-overlay';
    const fieldsHtml = (model.fields||[]).map(f=>`<div class="embed-field"><div class="text-secondary" style="opacity:.8">${f.name}</div><div>${f.value}</div></div>`).join('');
    const rowsHtml = (model.rows||[]).map(r=>`<div class="buttons">${r.map(b=>`<div class="btnx ${b.style}">${b.emoji?b.emoji+' ':''}${b.label}</div>`).join('')}</div>`).join('');
    overlay.innerHTML = `<div class="modal"><h3>Pré-visualização do Painel • ${tmpl}</h3><div class="embed"><div class="embed-title">${model.title}</div><div class="embed-desc">${model.description}</div>${fieldsHtml?`<div class="embed-fields">${fieldsHtml}</div>`:''}${rowsHtml}</div><div class="actions"><button class="btn btn-glass" id="pvClose">Fechar</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#pvClose')?.addEventListener('click', ()=> overlay.remove());
  }
  async function publish(){
    try {
      const ch = els.panelChannel?.value || '';
      if (!ch) { notify('Seleciona o canal do painel', 'error'); return; }
      // Also enforce required config before publishing
      if (!els.ticketsCategory?.value) { notify('Seleciona a categoria para os tickets', 'error'); return; }
      if (!els.logsChannel?.value) { notify('Seleciona o canal de logs para os tickets', 'error'); return; }
  const template = els.defaultTemplate?.value || 'classic';
  const theme = (els.theme?.value === 'light') ? 'light' : 'dark';
  const colorStr = (els.embedColor?.value || '').trim();
  const hasColor = /^#?[0-9a-fA-F]{6}$/.test(colorStr);
  const body = { type:'tickets', channel_id: ch, template, theme };
  if (hasColor){ body.options = { color: colorStr.startsWith('#') ? colorStr : `#${colorStr}` }; }
  const res = await fetch(`/api/guild/${guildId}/panels/create`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const json = await res.json().catch(()=>({}));
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      notify('Painel publicado/atualizado', 'success');
    } catch(e){ console.error(e); notify(e.message||'Erro ao publicar', 'error'); }
  }
  if (els.btnPreview) els.btnPreview.addEventListener('click', openPreview);
  if (els.btnPublish) els.btnPublish.addEventListener('click', publish);
  if (els.btnCreateCategory) els.btnCreateCategory.addEventListener('click', async ()=>{
    try {
      const name = (els.newCategoryName?.value||'').trim();
      if (!name) { notify('Indica um nome para a categoria', 'error'); return; }
      const res = await api(`/api/guild/${guildId}/categories/create`, { method:'POST', body: JSON.stringify({ name }) });
      const cat = res.category;
      // Refresh categories dropdown
      try {
        const cats = await api(`/api/guild/${guildId}/categories`);
        if (els.ticketsCategory) {
          els.ticketsCategory.innerHTML = `<option value="">— Sem categoria —</option>` + (cats.categories||[]).map(c=>`<option value="${c.id}">${(c.name||c.id)}</option>`).join('');
          els.ticketsCategory.value = cat?.id || '';
        }
      } catch {}
      notify('Categoria criada', 'success');
    } catch (e) { console.error(e); notify(e.message||'Falha ao criar categoria', 'error'); }
  });
  // Load user info (fixes header showing "Carregando...") and then page data
  loadUser().then(load).catch(load);
})();
