// Variáveis globais
let quill;
let fieldsCount = 0;

// Guarded redirect helper to prevent redirect loops when auth fails
function safeRedirectToLogin() {
    try {
        if (window.location.pathname === '/login') return;
        if (sessionStorage.getItem('redirectingToLogin')) return;
        sessionStorage.setItem('redirectingToLogin', '1');
        setTimeout(() => sessionStorage.removeItem('redirectingToLogin'), 10000);
        window.location.replace('/login');
    } catch (e) {
        try { window.location.href = '/login'; } catch(_){}
    }
}

// Função para fazer requests autenticados
async function authenticatedFetch(url, options = {}) {
    // Verificar se tem token nos cookies
    const token = document.cookie.split('; ').find(row => row.startsWith('authToken='))?.split('=')[1];
    
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': 'Bearer ' + token
        };
    }
    
    const response = await fetch(url, options);
    
    // Se token expirou, redirecionar para login (defensivo)
    if (response.status === 401) {
        safeRedirectToLogin();
        return null;
    }
    
    return response;
}

// Inicialização
document.addEventListener('DOMContentLoaded', async function() {
    // At page load logging: use debug instead of console.log for developer traces
    console.debug('📄 Página carregada, verificando autenticação...');

    // Verificar se há token
    const hasLocalToken = localStorage.getItem('authToken');
    const hasCookie = document.cookie.includes('authToken');

    console.debug('🔍 Token localStorage:', !!hasLocalToken);
    console.debug('🔍 Cookie presente:', hasCookie);

    // Se não há nenhum token, redirecionar
    if (!hasLocalToken && !hasCookie) {
        console.debug('❌ Sem autenticação, redirecionando...');
        window.location.replace('/login');
        return;
    }

    // Verificar se o token é válido fazendo um request
    try {
        const response = await fetch('/api/channels', { credentials: 'include' });
        if (!response.ok) {
            console.debug('❌ Token inválido, redirecionando...');
            localStorage.clear();
            window.location.replace('/login');
            return;
        }
        console.debug('✅ Autenticação válida');
    } catch (error) {
        console.debug('❌ Erro verificando auth, redirecionando...');
        localStorage.clear();
        window.location.replace('/login');
        return;
    }

    // Se chegou aqui, está autenticado - inicializar página
    initializeQuill();
    setupEventListeners();
    loadChannels();
    loadGuilds();
    loadHistory();
});

// Carregar canais disponíveis
async function loadChannels() {
    try {
        const response = await authenticatedFetch('/api/channels');
        if (!response) return; // Redirecionado para login

        const channels = await response.json();
        
        const channelSelect = document.getElementById('channelSelect');
        
        if (response.ok && channels.length > 0) {
                channelSelect.textContent = '';
                const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'Selecione um canal...';
                channelSelect.appendChild(opt);
            
            // Agrupar canais por categoria
            const groupedChannels = {};
            channels.forEach(channel => {
                const category = channel.parent || 'Sem Categoria';
                if (!groupedChannels[category]) {
                    groupedChannels[category] = [];
                }
                groupedChannels[category].push(channel);
            });
            
            // Adicionar opções agrupadas
            Object.keys(groupedChannels).sort().forEach(category => {
                if (category !== 'Sem Categoria') {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = '📁 ' + category;
                    channelSelect.appendChild(optgroup);
                    
                    groupedChannels[category].forEach(channel => {
                        const option = document.createElement('option');
                        option.value = channel.id;
                        option.textContent = '# ' + channel.name;
                        optgroup.appendChild(option);
                    });
                }
            });
            
            // Adicionar canais sem categoria
            if (groupedChannels['Sem Categoria']) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = '📝 Canais Gerais';
                channelSelect.appendChild(optgroup);
                
                groupedChannels['Sem Categoria'].forEach(channel => {
                    const option = document.createElement('option');
                    option.value = channel.id;
                    option.textContent = '# ' + channel.name;
                    optgroup.appendChild(option);
                });
            }
            
        } else {
                channelSelect.textContent = '';
                const opt2 = document.createElement('option'); opt2.value = ''; opt2.textContent = '❌ Nenhum canal disponível';
                channelSelect.appendChild(opt2);
        }
        
    } catch (error) {
        // Show user notification and keep debug trace
        showNotification('Erro ao carregar canais', 'error');
        console.debug('Erro ao carregar canais:', error);
            const cs = document.getElementById('channelSelect'); if(cs){ cs.textContent=''; const eo = document.createElement('option'); eo.value=''; eo.textContent='Erro ao carregar canais'; cs.appendChild(eo); }
    }
}

// Carregar servidores (guilds) e popular seletor de servidores
let currentServerId = null;
async function loadGuilds() {
    try {
        const resp = await authenticatedFetch('/api/guilds');
        if (!resp) return;
        const data = await resp.json();
        const list = data.guilds || [];
        const serverGrid = document.getElementById('serverGrid');
        const serverSelect = document.getElementById('serverSelect');

        // Prefer populated grid if exists, else try compact select
        if (serverGrid) {
            serverGrid.textContent = '';
            list.forEach(g => {
                const card = document.createElement('div');
                card.className = 'server-card';
                card.setAttribute('data-server-id', g.id);

                // icon container
                const iconWrap = document.createElement('div');
                iconWrap.className = 'server-icon';
                const img = document.createElement('img');
                img.alt = '';
                img.src = g.icon ? ('https://cdn.discordapp.com/icons/' + g.id + '/' + g.icon + '.png') : '/public/img/server-placeholder.png';
                img.addEventListener('error', () => { img.classList.add('hidden'); });
                iconWrap.appendChild(img);

                // name
                const nameEl = document.createElement('div');
                nameEl.className = 'server-name';
                nameEl.textContent = String(g.name || 'Servidor');

                // members
                const membersEl = document.createElement('div');
                membersEl.className = 'server-members';
                membersEl.textContent = String(g.memberCount || g.totalMembers || 'N/A') + ' membros';

                card.appendChild(iconWrap);
                card.appendChild(nameEl);
                card.appendChild(membersEl);

                card.addEventListener('click', () => {
                    document.querySelectorAll('.server-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    currentServerId = g.id;
                    // persist selection server-side and locally
                    try { fetch('/api/session/server', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ guildId: currentServerId }) }).catch(()=>null); } catch(e){}
                    try { localStorage.setItem('currentServerId', currentServerId); } catch(e){}
                    // load server specific data
                    if (typeof loadServerStats === 'function') loadServerStats();
                });
                serverGrid.appendChild(card);
            });
            // auto-select first
            if (list[0]) {
                currentServerId = list[0].id;
                const firstCard = serverGrid.querySelector('.server-card');
                if (firstCard) firstCard.classList.add('selected');
                try { fetch('/api/session/server', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ guildId: currentServerId }) }).catch(()=>null); } catch(e){}
                try { localStorage.setItem('currentServerId', currentServerId); } catch(e){}
            }
        }

        if (serverSelect) {
            serverSelect.textContent = '';
            list.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.name;
                serverSelect.appendChild(opt);
            });
            if (list[0]) serverSelect.value = list[0].id;
            serverSelect.addEventListener('change', (e) => {
                currentServerId = e.target.value;
                try { fetch('/api/session/server', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ guildId: currentServerId }) }).catch(()=>null); } catch(e){}
                try { localStorage.setItem('currentServerId', currentServerId); } catch(e){}
                if (typeof loadServerStats === 'function') loadServerStats();
            });
        }
    } catch (error) {
        console.debug('Erro ao carregar guilds:', error);
    }
}

// Wrapper to load server stats using currentServerId (if present)
async function loadServerStats() {
    const serverId = currentServerId || localStorage.getItem('currentServerId');
    if (!serverId) return;

    try {
    const resp = await authenticatedFetch('/api/server/' + encodeURIComponent(serverId) + '/stats');
        if (!resp) return;
        if (resp.ok) {
            const j = await resp.json();
            if (j && j.success && j.stats) {
                // update known fields used by old dashboard
                const stats = j.stats;
                if (stats.server && stats.server.memberCount) {
                    const el = document.getElementById('memberCount'); if (el) el.textContent = stats.server.memberCount;
                }
                if (stats.channels && typeof stats.channels.total !== 'undefined') { const el = document.getElementById('channelCount'); if (el) el.textContent = stats.channels.total; }
                if (stats.roles && typeof stats.roles.total !== 'undefined') { const el = document.getElementById('roleCount'); if (el) el.textContent = stats.roles.total; }
                if (stats.messages && typeof stats.messages.estimated !== 'undefined') { const el = document.getElementById('messageCount'); if (el) el.textContent = stats.messages.estimated; }
            }
        }
    } catch (e) {
        console.debug('Erro ao carregar stats do servidor:', e);
    }
}

// Logs client: try SSE (no-auth) first; fallback to polling via /api/logs
let logsSse = null;
let logsPollInterval = null;
function startLogsClient() {
    // If already started, ignore
    if (logsSse || logsPollInterval) return;

    try {
        // EventSource does not support Authorization headers. Server allows unauthenticated SSE.
        logsSse = new EventSource('/api/logs/stream');
        logsSse.onmessage = function(e) {
            try {
                const payload = JSON.parse(e.data);
                handleIncomingLog(payload);
            } catch (err) {
                console.debug('SSE parse error', err);
            }
        };
        logsSse.onerror = function(err) {
            console.debug('SSE error, falling back to polling', err);
            if (logsSse) { try { logsSse.close(); } catch(e){} logsSse = null; }
            startLogsPolling();
        };
    } catch (e) {
        console.debug('SSE not available, starting polling', e);
        startLogsPolling();
    }
}

async function startLogsPolling() {
    if (logsPollInterval) return;
    async function pollOnce() {
        try {
            const resp = await authenticatedFetch('/api/logs?limit=30');
            if (!resp) return;
            if (resp.ok) {
                const j = await resp.json();
                if (j && j.logs) {
                    j.logs.forEach(l => handleIncomingLog({ type: 'log', ...l }));
                }
            }
        } catch (e) {
            console.debug('Erro no polling de logs:', e);
        }
    }
    // initial poll
    await pollOnce();
    logsPollInterval = setInterval(pollOnce, 5000);
}

function handleIncomingLog(entry) {
    // Basic append to logs area if present
    try {
        // Build a safe text summary and truncate very long entries to avoid UI overflow
        const text = (() => {
            try {
                const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : new Date().toLocaleString();
                const body = entry.message || JSON.stringify(entry);
                // Normalize whitespace and remove control characters except newline
                let safeBody = String(body).replace(/\s+/g, ' ').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                const full = '[' + ts + '] ' + (entry.level || entry.type || 'info') + ': ' + safeBody;
                // Truncate to 2000 chars to prevent massive blocks in the UI
                return full.length > 2000 ? full.slice(0, 2000) + '… [truncated]' : full;
            } catch (e) { return '[log] ' + String(entry).slice(0, 2000); }
        })();

        const appendTo = (id) => {
            const logsContainer = document.getElementById(id);
            if (!logsContainer) return;
            const div = document.createElement('div');
            div.className = 'log-entry';
            // use textContent to avoid any HTML injection
            div.textContent = text;
            logsContainer.insertBefore(div, logsContainer.firstChild);
            // Trim to 200 entries
            while (logsContainer.childElementCount > 200) logsContainer.removeChild(logsContainer.lastChild);
        };
        appendTo('logsContainer');
        appendTo('moderationLogs');
    } catch (e) {
        // swallow
    }
}

// Start logs client on load
document.addEventListener('DOMContentLoaded', function() {
    startLogsClient();
});

// Expose a simple token modal helper other pages can call
window.showTokenConfigModal = function() {
    try {
        // Reuse the modal logic from dashboard: create simple modal (DOM-only, avoid innerHTML)
        const modal = document.createElement('div'); modal.className = 'modal';
        const modalContent = document.createElement('div'); modalContent.className = 'modal-content';

        // Header
        const h3 = document.createElement('h3');
        const icon = document.createElement('i'); icon.className = 'fas fa-key';
        h3.appendChild(icon);
        h3.appendChild(document.createTextNode(' Configurar Token de Acesso'));
        modalContent.appendChild(h3);

        // current token
        const fg1 = document.createElement('div'); fg1.className = 'form-group';
        const lbl1 = document.createElement('label'); lbl1.textContent = 'Token atual';
        const currentDiv = document.createElement('div'); currentDiv.className = 'current-token';
        const rawToken = localStorage.getItem('authToken');
        const masked = rawToken ? (rawToken.length > 20 ? (rawToken.substring(0,12) + '...' + rawToken.slice(-4)) : rawToken) : 'Nenhum token configurado';
        currentDiv.textContent = masked;
        fg1.appendChild(lbl1); fg1.appendChild(currentDiv);
        modalContent.appendChild(fg1);

        // custom token input
        const fg2 = document.createElement('div'); fg2.className = 'form-group';
        const lbl2 = document.createElement('label'); lbl2.textContent = 'Inserir token personalizado';
        const input = document.createElement('input'); input.id = 'customTokenInputGlobal'; input.className = 'form-control'; input.type = 'password'; input.placeholder = 'Cole o token aqui';
        fg2.appendChild(lbl2); fg2.appendChild(input);
        modalContent.appendChild(fg2);

        // actions
        const actions = document.createElement('div'); actions.className = 'form-actions'; actions.style.gap = '8px';
        const saveBtn = document.createElement('button'); saveBtn.id = 'saveCustomTokenGlobal'; saveBtn.className = 'btn btn-primary'; saveBtn.textContent = 'Guardar token';
    // remove dev/admin preset buttons to avoid accidental token exposure
        const closeBtn = document.createElement('button'); closeBtn.id = 'closeModalBtnGlobal'; closeBtn.className = 'btn btn-light'; closeBtn.textContent = 'Fechar';
        actions.appendChild(saveBtn); actions.appendChild(devBtn); actions.appendChild(adminBtn); actions.appendChild(closeBtn);
        modalContent.appendChild(actions);

    const note = document.createElement('div'); note.className = 'form-group'; const small = document.createElement('small'); small.textContent = 'Nota: Tokens devem ser usados apenas em ambiente de desenvolvimento. Em produção, prefira OAuth2.'; note.appendChild(small); modalContent.appendChild(note);

        modal.appendChild(modalContent);
        modal.classList.add('hidden'); document.body.appendChild(modal);
        requestAnimationFrame(()=>{ modal.classList.remove('hidden'); modal.classList.add('active'); });

        const updateDisplay = () => { const d = modal.querySelector('.current-token'); if (!d) return; const t = localStorage.getItem('authToken'); d.textContent = t ? (t.length>20? t.substring(0,12)+'...'+t.slice(-4): t) : 'Nenhum token configurado'; };
        saveBtn.addEventListener('click', () => { const v = input.value.trim(); if (!v) return; // require confirmation before storing
            if (!confirm('Guardar token localmente? Isto é inseguro em ambientes partilhados.')) return; localStorage.setItem('authToken', v); updateDisplay(); });
        closeBtn.addEventListener('click', ()=>{ modal.classList.remove('active'); modal.classList.add('hidden'); setTimeout(()=>{ if (modal.parentNode) modal.parentNode.removeChild(modal); },200); });
    } catch(e){ console.debug('Erro ao abrir modal global', e); }
};

// Inicializar editor Quill
function initializeQuill() {
    quill = new Quill('#description-editor', {
        theme: 'snow',
        placeholder: 'Digite a descrição do update... Use o editor para formatar o texto como no Discord!',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'header': 1 }, { 'header': 2 }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'script': 'sub'}, { 'script': 'super' }],
                [{ 'color': [] }, { 'background': [] }],
                ['link', 'image'],
                ['clean']
            ]
        }
    });

    // Sincronizar conteúdo do editor com input hidden (sanitize HTML)
    quill.on('text-change', function() {
        try {
            const raw = (quill && quill.root && quill.root.innerHTML) ? quill.root.innerHTML : '';
            let content = '';
            if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                content = window.DOMPurify.sanitize(raw, {ALLOWED_TAGS: ['b','i','u','strong','em','a','p','br','ul','ol','li','code','pre']});
            } else if (window.FrontendHelpers && typeof window.FrontendHelpers.stripHtml === 'function') {
                content = window.FrontendHelpers.stripHtml(raw);
            } else {
                content = stripHtml(raw);
            }
            const descEl = document.getElementById('description'); if (descEl) descEl.value = content;
        } catch(e) {
            const descEl = document.getElementById('description'); if (descEl) descEl.value = '';
        }
        updatePreview();
    });
}

// Configurar event listeners
function setupEventListeners() {
    // Formulário
    document.getElementById('updateForm').addEventListener('submit', handleSubmit);
    
    // Botões
    document.getElementById('previewBtn').addEventListener('click', updatePreview);
    document.getElementById('addField').addEventListener('click', addField);
    
    // Inputs que afetam o preview
    ['title', 'color', 'icon', 'banner'].forEach(id => {
        document.getElementById(id).addEventListener('input', updatePreview);
    });
    
    // Emojis
    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            insertEmoji(this.dataset.emoji);
        });
    });
}

// Inserir emoji no editor
function insertEmoji(emoji) {
    const range = quill.getSelection();
    if (range) {
        quill.insertText(range.index, emoji);
    } else {
        quill.insertText(quill.getLength() - 1, emoji);
    }
}

// Adicionar campo personalizado
function addField() {
    fieldsCount++;
    const container = document.getElementById('fieldsContainer');

    const wrapper = document.createElement('div');
    wrapper.className = 'field-item';
    wrapper.setAttribute('data-field-id', String(fieldsCount));

    const header = document.createElement('div'); header.className = 'field-item-header';
    const h4 = document.createElement('h4');
    const grip = document.createElement('i'); grip.className = 'fas fa-grip-vertical';
    h4.appendChild(grip);
    h4.appendChild(document.createTextNode(' Campo ' + fieldsCount));
    const controls = document.createElement('div'); controls.className = 'field-controls';
    const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'btn btn-danger';
    const delI = document.createElement('i'); delI.className = 'fas fa-trash'; delBtn.appendChild(delI);
    delBtn.addEventListener('click', () => removeField(fieldsCount));
    controls.appendChild(delBtn);
    header.appendChild(h4); header.appendChild(controls);

    const row = document.createElement('div'); row.className = 'field-row';

    const g1 = document.createElement('div'); g1.className = 'form-group';
    const l1 = document.createElement('label'); l1.textContent = 'Nome do Campo';
    const in1 = document.createElement('input'); in1.type = 'text'; in1.name = 'fieldName' + fieldsCount; in1.placeholder = '📋 Novidades'; in1.maxLength = 256;
    in1.addEventListener('change', updatePreview);
    g1.appendChild(l1); g1.appendChild(in1);

    const g2 = document.createElement('div'); g2.className = 'form-group';
    const l2 = document.createElement('label'); l2.textContent = 'Valor do Campo';
    const in2 = document.createElement('input'); in2.type = 'text'; in2.name = 'fieldValue' + fieldsCount; in2.placeholder = '• Funcionalidade X adicionada\n• Bug Y corrigido';
    in2.addEventListener('change', updatePreview);
    g2.appendChild(l2); g2.appendChild(in2);

    const checkboxContainer = document.createElement('div'); checkboxContainer.className = 'checkbox-container';
    const inlineInput = document.createElement('input'); inlineInput.type = 'checkbox'; inlineInput.id = 'fieldInline' + fieldsCount; inlineInput.name = 'fieldInline' + fieldsCount;
    inlineInput.addEventListener('change', updatePreview);
    const inlineLabel = document.createElement('label'); inlineLabel.setAttribute('for', 'fieldInline' + fieldsCount); inlineLabel.textContent = 'Inline';
    checkboxContainer.appendChild(inlineInput); checkboxContainer.appendChild(inlineLabel);

    row.appendChild(g1); row.appendChild(g2); row.appendChild(checkboxContainer);
    wrapper.appendChild(header); wrapper.appendChild(row);
    container.appendChild(wrapper);
    updatePreview();
}

// Remover campo
function removeField(fieldId) {
    const field = document.querySelector('[data-field-id="' + fieldId + '"]');
    if (field) {
        field.remove();
        updatePreview();
    }
}

// Atualizar preview do embed
async function updatePreview() {
    const formData = getFormData();
    
    try {
        const response = await authenticatedFetch('/api/preview-embed', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response) return; // Redirecionado para login
        
        const embedData = await response.json();
        renderEmbedPreview(embedData);
    } catch (error) {
        // replaced console.error with notification + debug
        showNotification('Erro ao gerar preview', 'error');
        console.debug('Erro ao gerar preview:', error);
    }
}

// Renderizar preview do embed
function renderEmbedPreview(embedData) {
    const previewContainer = document.getElementById('embedPreview');
    // Clear previous
    while (previewContainer.firstChild) previewContainer.removeChild(previewContainer.firstChild);

    const embed = document.createElement('div'); embed.className = 'discord-embed';
    const color = embedData.color ? '#' + embedData.color.toString(16).padStart(6, '0') : '#9932CC';
    embed.style.borderLeftColor = color;

    // Thumbnail
        if (embedData.thumbnail && embedData.thumbnail.url) {
        const img = document.createElement('img'); img.className = 'embed-thumbnail'; img.alt = 'Thumbnail';
        img.src = embedData.thumbnail.url; img.addEventListener('error', () => img.classList.add('hidden'));
        embed.appendChild(img);
    }

    // Title
    if (embedData.title) {
    const t = document.createElement('div'); t.className = 'embed-title'; t.textContent = (window.FrontendHelpers && FrontendHelpers.stripHtml) ? FrontendHelpers.stripHtml(String(embedData.title)) : String(embedData.title).replace(/\$\{[^}]*\}/g, '');
        embed.appendChild(t);
    }

    // Description (sanitize by stripping HTML and converting newlines to text + <br>)
    if (embedData.description) {
    const d = document.createElement('div'); d.className = 'embed-description';
    const raw = (window.FrontendHelpers && FrontendHelpers.stripHtml) ? FrontendHelpers.stripHtml(String(embedData.description)) : String(embedData.description).replace(/\$\{[^}]*\}/g, '');
        raw.split('\n').forEach((line, idx) => {
            if (idx) d.appendChild(document.createElement('br'));
            d.appendChild(document.createTextNode(line));
        });
        embed.appendChild(d);
    }

    // Fields
    if (embedData.fields && embedData.fields.length > 0) {
        embedData.fields.forEach(field => {
            if (field.name && field.value) {
                const fwrap = document.createElement('div'); fwrap.className = 'embed-field';
                const fname = document.createElement('div'); fname.className = 'embed-field-name'; fname.textContent = (window.FrontendHelpers && FrontendHelpers.stripHtml) ? FrontendHelpers.stripHtml(String(field.name)) : String(field.name).replace(/\$\{[^}]*\}/g, '');
                const fvalue = document.createElement('div'); fvalue.className = 'embed-field-value';
                const fraw = (window.FrontendHelpers && FrontendHelpers.stripHtml) ? FrontendHelpers.stripHtml(String(field.value)) : String(field.value).replace(/\$\{[^}]*\}/g, '');
                fraw.split('\n').forEach((line, idx) => { if (idx) fvalue.appendChild(document.createElement('br')); fvalue.appendChild(document.createTextNode(line)); });
                fwrap.appendChild(fname); fwrap.appendChild(fvalue);
                embed.appendChild(fwrap);
            }
        });
    }

    // Image
    if (embedData.image && embedData.image.url) {
        const bimg = document.createElement('img'); bimg.className = 'embed-image'; bimg.alt = 'Banner'; bimg.src = embedData.image.url; bimg.addEventListener('error', () => bimg.classList.add('hidden'));
        embed.appendChild(bimg);
    }

    // Footer
    if (embedData.footer) {
        const footer = document.createElement('div'); footer.className = 'embed-footer';
        if (embedData.footer.icon_url) {
            const fimg = document.createElement('img'); fimg.className = 'embed-footer-icon'; fimg.alt = 'Footer Icon'; fimg.src = embedData.footer.icon_url; fimg.addEventListener('error', () => fimg.classList.add('hidden'));
            footer.appendChild(fimg);
        }
        const ftext = document.createElement('span'); ftext.textContent = stripHtml(String(embedData.footer.text || ''));
        footer.appendChild(ftext);
        const fdate = document.createElement('span'); fdate.style.marginLeft = 'auto'; fdate.textContent = new Date(embedData.timestamp).toLocaleString('pt-PT');
        footer.appendChild(fdate);
        embed.appendChild(footer);
    }

    previewContainer.appendChild(embed);
}

// Obter dados do formulário
function getFormData() {
    const formData = {
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        color: document.getElementById('color').value,
        icon: document.getElementById('icon').value,
        banner: document.getElementById('banner').value,
        channelId: document.getElementById('channelSelect').value,
        fields: []
    };
    
    // Campos personalizados
    for (let i = 1; i <= fieldsCount; i++) {
        const nameInput = document.querySelector('input[name="fieldName' + i + '"]');
        const valueInput = document.querySelector('input[name="fieldValue' + i + '"]');
        const inlineInput = document.querySelector('input[name="fieldInline' + i + '"]');
        
        if (nameInput && valueInput && nameInput.value && valueInput.value) {
            formData.fields.push({
                name: nameInput.value,
                value: valueInput.value,
                inline: inlineInput ? inlineInput.checked : false
            });
        }
    }
    
    return formData;
}

// Enviar update
async function handleSubmit(e) {
    e.preventDefault();
    
    const sendBtn = document.getElementById('sendBtn');
        const originalText = sendBtn.textContent;
    
    // Mostrar loading
        sendBtn.textContent = 'Enviando...';
        const spinner = document.createElement('i'); spinner.className = 'fas fa-spinner fa-spin';
        sendBtn.insertBefore(spinner, sendBtn.firstChild);
    sendBtn.disabled = true;
    
    try {
        const formData = getFormData();
        
        if (!formData.title || !formData.description) {
            throw new Error('Título e descrição são obrigatórios!');
        }
        
        if (!formData.channelId) {
            throw new Error('Selecione um canal de destino!');
        }
        
        const response = await authenticatedFetch('/api/send-update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response) return; // Redirecionado para login
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Update enviado com sucesso!', 'success');
            clearForm();
            loadHistory();
        } else {
            throw new Error(result.error || 'Erro ao enviar update');
        }
        
    } catch (error) {
        // Use UI notification for users and keep stack in debug
        showNotification(error.message || 'Erro ao enviar update', 'error');
        console.debug('Erro ao enviar update:', error);
    } finally {
        // Restaurar botão
            sendBtn.textContent = originalText;
        sendBtn.disabled = false;
    }
}

// Limpar formulário
function clearForm() {
    document.getElementById('updateForm').reset();
    quill.setContents([]);
        const fc = document.getElementById('fieldsContainer'); if(fc){ while(fc.firstChild) fc.removeChild(fc.firstChild); }
    fieldsCount = 0;
    document.getElementById('color').value = '#9932CC';
    document.getElementById('channelSelect').selectedIndex = 0;
        const ep = document.getElementById('embedPreview'); if(ep){ while(ep.firstChild) ep.removeChild(ep.firstChild); }
}

// Carregar histórico
async function loadHistory() {
    try {
        const response = await fetch('/api/updates-history');
        const history = await response.json();
        
        const historyContainer = document.getElementById('historyList');
        while (historyContainer.firstChild) historyContainer.removeChild(historyContainer.firstChild);

        if (history.length === 0) {
            const p = document.createElement('p'); p.style.color = 'var(--discord-text-muted)'; p.style.textAlign = 'center'; p.textContent = 'Nenhum update encontrado';
            historyContainer.appendChild(p);
            return;
        }

        history.forEach(item => {
            const hi = document.createElement('div'); hi.className = 'history-item';
            const hh = document.createElement('div'); hh.className = 'history-item-header';
        const htitle = document.createElement('div'); htitle.className = 'history-item-title'; htitle.textContent = (window.FrontendHelpers && FrontendHelpers.stripHtml) ? FrontendHelpers.stripHtml(String(item.title || '')) : String(item.title || '').replace(/\$\{[^}]*\}/g, '');
            const hdate = document.createElement('div'); hdate.className = 'history-item-date'; hdate.textContent = new Date(item.timestamp).toLocaleString('pt-PT');
            hh.appendChild(htitle); hh.appendChild(hdate);
            const ch = document.createElement('div'); ch.className = 'history-item-channel';
            const hash = document.createElement('i'); hash.className = 'fas fa-hashtag';
            ch.appendChild(hash);
            ch.appendChild(document.createTextNode(' ' + ((window.FrontendHelpers && FrontendHelpers.stripHtml) ? FrontendHelpers.stripHtml(String(item.channelName || 'Canal desconhecido')) : String(item.channelName || 'Canal desconhecido').replace(/\$\{[^}]*\}/g, ''))));
            const desc = document.createElement('div'); desc.className = 'history-item-description'; desc.textContent = (window.FrontendHelpers && FrontendHelpers.stripHtml) ? FrontendHelpers.stripHtml(String(item.description || '')) : String(item.description || '').replace(/\$\{[^}]*\}/g, '');
            hi.appendChild(hh); hi.appendChild(ch); hi.appendChild(desc);
            historyContainer.appendChild(hi);
        });
        
    } catch (error) {
        showNotification('Erro ao carregar histórico', 'error');
        console.debug('Erro ao carregar histórico:', error);
    }
}

// Remover HTML tags para preview
function stripHtml(html) {
    const tmp = document.createElement('div');
        tmp.textContent = '';
        // If html contained safe text, append as text node
        tmp.appendChild(document.createTextNode(html));
    return tmp.textContent || tmp.innerText || '';
}

// Mostrar notificação
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification ' + type;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

// Preview inicial
setTimeout(updatePreview, 500);

// Logout
try {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        if (confirm('Tem certeza que deseja terminar a sessão?')) {
            console.debug('🚪 Iniciando logout completo...');
            
            try {
                // Call server logout route which destroys the session (uses GET to match server.js /logout)
                await fetch('/logout', { method: 'GET', credentials: 'include' });
                console.debug('🌐 Called server /logout');
            } catch (error) {
                // non-blocking: continue to clear client state even if server call fails
                console.debug('❌ Falha ao chamar /logout:', error);
            }
            
            // 2. Limpar TODOS os dados locais (independentemente da resposta do servidor)
            try {
                // Limpar localStorage
                localStorage.clear();
                sessionStorage.clear();
                
                // Limpar cookies de todas as formas possiveis
                const cookiesToClear = ['authToken', 'auth_token', 'token'];
                cookiesToClear.forEach(cookieName => {
                    document.cookie = cookieName + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname + ';';
                    document.cookie = cookieName + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    document.cookie = cookieName + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
                });
                
                console.debug('🧹 Todos os dados locais limpos');
                
            } catch (error) {
                showNotification('Erro limpando dados locais', 'error');
                console.debug('❌ Erro limpando dados locais:', error);
            }
            
            // 3. Forçar redirecionamento sem cache
            console.debug('🔄 Forçando redirecionamento para login...');
            
            // Prevenir qualquer cache
            const timestamp = new Date().getTime();
            const loginUrl = '/login?t=' + timestamp;
            
            // Usar replace para não manter historico
            window.location.replace(loginUrl);
        }
    });
} catch (e) {
    // ignore if logout button not present
}
