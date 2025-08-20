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
    console.log('📄 Página carregada, verificando autenticação...');
    
    // Verificar se há token
    const hasLocalToken = localStorage.getItem('authToken');
    const hasCookie = document.cookie.includes('authToken');
    
    console.log('🔍 Token localStorage:', !!hasLocalToken);
    console.log('🔍 Cookie presente:', hasCookie);
    
    // Se não há nenhum token, redirecionar
    if (!hasLocalToken && !hasCookie) {
        console.log('❌ Sem autenticação, redirecionando...');
        window.location.replace('/login');
        return;
    }
    
    // Verificar se o token é válido fazendo um request
    try {
        const response = await fetch('/api/channels', { credentials: 'include' });
        if (!response.ok) {
            console.log('❌ Token inválido, redirecionando...');
            localStorage.clear();
            window.location.replace('/login');
            return;
        }
        console.log('✅ Autenticação válida');
    } catch (error) {
        console.log('❌ Erro verificando auth, redirecionando...');
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
            channelSelect.innerHTML = '<option value="">Selecione um canal...</option>';
            
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
            channelSelect.innerHTML = '<option value="">❌ Nenhum canal disponível</option>';
        }
        
    } catch (error) {
        console.error('Erro ao carregar canais:', error);
        document.getElementById('channelSelect').innerHTML = '<option value="">❌ Erro ao carregar canais</option>';
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
    
    const fieldHtml = `
        <div class="field-item" data-field-id="${fieldsCount}">
            <div class="field-item-header">
                <h4><i class="fas fa-grip-vertical"></i> Campo ${fieldsCount}</h4>
                <div class="field-controls">
                    <button type="button" class="btn btn-danger" onclick="removeField(${fieldsCount})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="field-row">
                <div class="form-group">
                    <label>Nome do Campo</label>
                    <input type="text" name="fieldName${fieldsCount}" placeholder="📋 Novidades" maxlength="256" onchange="updatePreview()">
                </div>
                <div class="form-group">
                    <label>Valor do Campo</label>
                    <input type="text" name="fieldValue${fieldsCount}" placeholder="• Funcionalidade X adicionada\\n• Bug Y corrigido" onchange="updatePreview()">
                </div>
                <div class="checkbox-container">
                    <input type="checkbox" id="fieldInline${fieldsCount}" name="fieldInline${fieldsCount}" onchange="updatePreview()">
                    <label for="fieldInline${fieldsCount}">Inline</label>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', fieldHtml);
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
        console.error('Erro ao gerar preview:', error);
    }
}

// Renderizar preview do embed
function renderEmbedPreview(embedData) {
    const previewContainer = document.getElementById('embedPreview');
    
    let html = `
        <div class="discord-embed" style="border-left-color: ${embedData.color ? '#' + embedData.color.toString(16).padStart(6, '0') : '#9932CC'}">
    `;
    
    // Thumbnail
    if (embedData.thumbnail) {
        html += `<img src="${embedData.thumbnail.url}" alt="Thumbnail" class="embed-thumbnail" onerror="this.style.display='none'">`;
    }
    
    // Título
    if (embedData.title) {
        html += `<div class="embed-title">${embedData.title}</div>`;
    }
    
    // Descrição
    if (embedData.description) {
        html += `<div class="embed-description">${embedData.description}</div>`;
    }
    
    // Campos
    if (embedData.fields && embedData.fields.length > 0) {
        embedData.fields.forEach(field => {
            if (field.name && field.value) {
                html += `
                    <div class="embed-field">
                        <div class="embed-field-name">${field.name}</div>
                        <div class="embed-field-value">${field.value.replace(/\\n/g, '<br>')}</div>
                    </div>
                `;
            }
        });
    }
    
    // Imagem
    if (embedData.image) {
        html += `<img src="${embedData.image.url}" alt="Banner" class="embed-image" onerror="this.style.display='none'">`;
    }
    
    // Footer
    if (embedData.footer) {
        html += `
            <div class="embed-footer">
                ${embedData.footer.icon_url ? `<img src="${embedData.footer.icon_url}" alt="Footer Icon" class="embed-footer-icon">` : ''}
                <span>${embedData.footer.text}</span>
                <span style="margin-left: auto;">${new Date(embedData.timestamp).toLocaleString('pt-PT')}</span>
            </div>
        `;
    }
    
    html += '</div>';
    previewContainer.innerHTML = html;
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
    const originalText = sendBtn.innerHTML;
    
    // Mostrar loading
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
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
        console.error('Erro:', error);
        showNotification(error.message, 'error');
    } finally {
        // Restaurar botão
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
    }
}

// Limpar formulário
function clearForm() {
    document.getElementById('updateForm').reset();
    quill.setContents([]);
    document.getElementById('fieldsContainer').innerHTML = '';
    fieldsCount = 0;
    document.getElementById('color').value = '#9932CC';
    document.getElementById('channelSelect').selectedIndex = 0;
    document.getElementById('embedPreview').innerHTML = '';
}

// Carregar histórico
async function loadHistory() {
    try {
        const response = await fetch('/api/updates-history');
        const history = await response.json();
        
        const historyContainer = document.getElementById('historyList');
        
        if (history.length === 0) {
            historyContainer.innerHTML = '<p style="color: var(--discord-text-muted); text-align: center;">Nenhum update encontrado</p>';
            return;
        }
        
        historyContainer.innerHTML = history.map(item => `
            <div class="history-item">
                <div class="history-item-header">
                    <div class="history-item-title">${item.title}</div>
                    <div class="history-item-date">${new Date(item.timestamp).toLocaleString('pt-PT')}</div>
                </div>
                <div class="history-item-channel">
                    <i class="fas fa-hashtag"></i> ${item.channelName || 'Canal desconhecido'}
                </div>
                <div class="history-item-description">${stripHtml(item.description)}</div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
}

// Remover HTML tags para preview
function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
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
document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja terminar a sessão?')) {
        console.log('🚪 Iniciando logout completo...');
        
        try {
            // 1. Fazer request para servidor
            const response = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('🌐 Logout response:', response.status);
            
        } catch (error) {
            console.error('❌ Erro no logout do servidor:', error);
        }
        
        // 2. Limpar TODOS os dados locais (independentemente da resposta do servidor)
        try {
            // Limpar localStorage
            localStorage.clear();
            sessionStorage.clear();
            
            // Limpar cookies de todas as formas possíveis
            const cookiesToClear = ['authToken', 'auth_token', 'token'];
            cookiesToClear.forEach(cookieName => {
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
            });
            
            console.log('🧹 Todos os dados locais limpos');
            
        } catch (error) {
            console.error('❌ Erro limpando dados locais:', error);
        }
        
        // 3. Forçar redirecionamento sem cache
        console.log('🔄 Forçando redirecionamento para login...');
        
        // Prevenir qualquer cache
        const timestamp = new Date().getTime();
        const loginUrl = `/login?t=${timestamp}`;
        
        // Usar replace para não manter histórico
        window.location.replace(loginUrl);
    }
});
