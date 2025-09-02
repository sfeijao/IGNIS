// Variáveis globais
let quill;
let fieldsCount = 0;

// Função para fazer requests autenticados
async function authenticatedFetch(url, options = {}) {
    // Verificar se tem token nos cookies
    const token = document.cookie.split('; ').find(row => row.startsWith('authToken='))?.split('=')[1];
    
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }
    
    const response = await fetch(url, options);
    
    // Se token expirou, redirecionar para login
    if (response.status === 401) {
        window.location.href = '/login';
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
                    optgroup.label = `📁 ${category}`;
                    channelSelect.appendChild(optgroup);
                    
                    groupedChannels[category].forEach(channel => {
                        const option = document.createElement('option');
                        option.value = channel.id;
                        option.textContent = `# ${channel.name}`;
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
                    option.textContent = `# ${channel.name}`;
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

    // Sincronizar conteúdo do editor com input hidden
    quill.on('text-change', function() {
        const content = quill.root.innerHTML;
        document.getElementById('description').value = content;
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
    const in1 = document.createElement('input'); in1.type = 'text'; in1.name = `fieldName${fieldsCount}`; in1.placeholder = '📋 Novidades'; in1.maxLength = 256;
    in1.addEventListener('change', updatePreview);
    g1.appendChild(l1); g1.appendChild(in1);

    const g2 = document.createElement('div'); g2.className = 'form-group';
    const l2 = document.createElement('label'); l2.textContent = 'Valor do Campo';
    const in2 = document.createElement('input'); in2.type = 'text'; in2.name = `fieldValue${fieldsCount}`; in2.placeholder = '• Funcionalidade X adicionada\n• Bug Y corrigido';
    in2.addEventListener('change', updatePreview);
    g2.appendChild(l2); g2.appendChild(in2);

    const checkboxContainer = document.createElement('div'); checkboxContainer.className = 'checkbox-container';
    const inlineInput = document.createElement('input'); inlineInput.type = 'checkbox'; inlineInput.id = `fieldInline${fieldsCount}`; inlineInput.name = `fieldInline${fieldsCount}`;
    inlineInput.addEventListener('change', updatePreview);
    const inlineLabel = document.createElement('label'); inlineLabel.setAttribute('for', `fieldInline${fieldsCount}`); inlineLabel.textContent = 'Inline';
    checkboxContainer.appendChild(inlineInput); checkboxContainer.appendChild(inlineLabel);

    row.appendChild(g1); row.appendChild(g2); row.appendChild(checkboxContainer);
    wrapper.appendChild(header); wrapper.appendChild(row);
    container.appendChild(wrapper);
    updatePreview();
}

// Remover campo
function removeField(fieldId) {
    const field = document.querySelector(`[data-field-id="${fieldId}"]`);
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
        img.src = embedData.thumbnail.url; img.addEventListener('error', () => img.style.display = 'none');
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
        const bimg = document.createElement('img'); bimg.className = 'embed-image'; bimg.alt = 'Banner'; bimg.src = embedData.image.url; bimg.addEventListener('error', () => bimg.style.display = 'none');
        embed.appendChild(bimg);
    }

    // Footer
    if (embedData.footer) {
        const footer = document.createElement('div'); footer.className = 'embed-footer';
        if (embedData.footer.icon_url) {
            const fimg = document.createElement('img'); fimg.className = 'embed-footer-icon'; fimg.alt = 'Footer Icon'; fimg.src = embedData.footer.icon_url; fimg.addEventListener('error', () => fimg.style.display = 'none');
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
        const nameInput = document.querySelector(`input[name="fieldName${i}"]`);
        const valueInput = document.querySelector(`input[name="fieldValue${i}"]`);
        const inlineInput = document.querySelector(`input[name="fieldInline${i}"]`);
        
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
    notification.className = `notification ${type}`;
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
                // 1. Fazer request para servidor
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                console.debug('🌐 Logout response:', response.status);
                
            } catch (error) {
                showNotification('Erro no logout do servidor', 'error');
                console.debug('❌ Erro no logout do servidor:', error);
            }
            
            // 2. Limpar TODOS os dados locais (independentemente da resposta do servidor)
            try {
                // Limpar localStorage
                localStorage.clear();
                sessionStorage.clear();
                
                // Limpar cookies de todas as formas possiveis
                const cookiesToClear = ['authToken', 'auth_token', 'token'];
                cookiesToClear.forEach(cookieName => {
                    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
                    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
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
            const loginUrl = `/login?t=${timestamp}`;
            
            // Usar replace para não manter historico
            window.location.replace(loginUrl);
        }
    });
} catch (e) {
    // ignore if logout button not present
}
