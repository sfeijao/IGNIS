// Modern YSNM Dashboard JavaScript - HorizonUI Inspired

// Guarded redirect helper to prevent redirect loops when auth fails
function safeRedirectToLogin() {
    try {
        if (window.location.pathname === '/login') return;
        if (sessionStorage.getItem('redirectingToLogin')) return;
        sessionStorage.setItem('redirectingToLogin', '1');
        // allow another redirect attempt after 10s
        setTimeout(() => sessionStorage.removeItem('redirectingToLogin'), 10000);
        window.location.replace('/login');
    } catch (e) {
        // if anything fails, fallback to a simple assignment (best effort)
        try { window.location.href = '/login'; } catch(_){}
    }
}
class YSNMDashboard {
    constructor() {
        this.quill = null;
        this.fieldsCount = 0;
        this.socket = null;
        this.init();
    }

    async init() {
    console.debug('🚀 Inicializando YSNM Modern Dashboard...');
        
        // Verificar autenticação
        if (!(await this.checkAuth())) {
            return;
        }

        // Inicializar componentes
        this.initializeQuill();
        this.setupEventListeners();
        this.loadChannels();
        this.initializeSocketIO();
        this.setupRealTimePreview();
        this.addModernAnimations();
        
    console.debug('✨ Dashboard inicializado com sucesso!');
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/channels', { credentials: 'include' });
            if (!response.ok) {
                console.debug('❌ Não autenticado, redirecionando...');
                safeRedirectToLogin();
                return false;
            }
            return true;
        } catch (error) {
            console.debug('❌ Erro na autenticação:', error);
            safeRedirectToLogin();
            return false;
        }
    }

    initializeQuill() {
        const toolbarOptions = [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['blockquote', 'code-block'],
            ['link', 'image'],
            ['clean']
        ];

            this.quill = new Quill('#description-editor', {
                theme: 'snow',
                modules: {
                    toolbar: toolbarOptions
                },
                placeholder: '✨ Escreve aqui a descrição incrível do teu update...\n\nPodes usar:\n• **Negrito** para destacar\n• *Itálico* para ênfase\n• `Código` para comandos\n• [Links](https://exemplo.com)\n• E muito mais! 🚀'
            });

        // Atualizar preview em tempo real
        this.quill.on('text-change', () => {
            this.updatePreview();
        });
    }

    setupEventListeners() {
        // Logout button com confirmação moderna
        document.getElementById('logoutBtn')?.addEventListener('click', this.handleLogout.bind(this));
        
        // Form submission
        document.getElementById('updateForm')?.addEventListener('submit', this.handleSubmit.bind(this));
        
        // Add field button
        document.getElementById('addField')?.addEventListener('click', this.addField.bind(this));
        
        // Emoji buttons
        document.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', this.insertEmoji.bind(this));
        });
        
        // Real-time input updates
        ['title', 'color', 'icon', 'banner'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', this.updatePreview.bind(this));
            }
        });

        // Channel select change
        document.getElementById('channelSelect')?.addEventListener('change', this.updatePreview.bind(this));
    }

    async loadChannels() {
        try {
            const response = await fetch('/api/channels', { credentials: 'include' });
            if (!response.ok) return;
            
            const channels = await response.json();
            const channelSelect = document.getElementById('channelSelect');
            
            if (channels.length > 0) {
                // add a safe placeholder option
                const placeholderOpt = document.createElement('option');
                placeholderOpt.value = '';
                placeholderOpt.textContent = '🎯 Seleciona o canal perfeito...';
                channelSelect.appendChild(placeholderOpt);
                
                // Agrupar por categoria
                const grouped = this.groupChannelsByCategory(channels);
                
                Object.keys(grouped).sort().forEach(category => {
                    if (category !== 'Sem Categoria') {
                        const optgroup = document.createElement('optgroup');
                        optgroup.label = '📁 ' + category;
                        channelSelect.appendChild(optgroup);
                        
                        grouped[category].forEach(channel => {
                            const option = document.createElement('option');
                            option.value = channel.id;
                            option.textContent = '# ' + channel.name;
                            optgroup.appendChild(option);
                        });
                    }
                });
                
                // Canais sem categoria
                if (grouped['Sem Categoria']) {
                    grouped['Sem Categoria'].forEach(channel => {
                        const option = document.createElement('option');
                        option.value = channel.id;
                        option.textContent = '# ' + channel.name;
                        channelSelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            // User-friendly notification + debug trace
            this.showNotification('Erro ao carregar canais', 'error');
            console.debug('Erro carregando canais:', error);
        }
    }

    groupChannelsByCategory(channels) {
        const grouped = {};
        channels.forEach(channel => {
            const category = channel.parent || 'Sem Categoria';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(channel);
        });
        return grouped;
    }

    updatePreview() {
        const title = document.getElementById('title').value || '🚀 Título do Update Aparece Aqui';
        const color = document.getElementById('color').value || '#4318FF';
        const banner = document.getElementById('banner').value;
        const description = this.quill.getContents();
        
        // Atualizar título
        document.getElementById('previewTitle').textContent = title;
        
        // Atualizar cor do border
        const previewEmbed = document.getElementById('previewEmbed');
        previewEmbed.style.borderLeftColor = color;
        
        // Atualizar descrição
            const previewDesc = document.getElementById('previewDescription');
            const htmlContent = this.quill.root.innerHTML;
            // Prefer DOMPurify if available
            let safeHtml;
            try {
                if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                    safeHtml = window.DOMPurify.sanitize(htmlContent, {ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp|data):|[^\s]*$)/i});
                } else if (window.FrontendHelpers && typeof window.FrontendHelpers.stripHtml === 'function') {
                    safeHtml = window.FrontendHelpers.stripHtml(htmlContent);
                } else {
                    safeHtml = this.sanitizeHtmlForPreview(htmlContent);
                }
            } catch (purgeErr) {
                console.warn('DOMPurify sanitize failed, falling back to basic sanitizer', purgeErr);
                if (window.FrontendHelpers && typeof window.FrontendHelpers.stripHtml === 'function') {
                    safeHtml = window.FrontendHelpers.stripHtml(htmlContent);
                } else {
                    safeHtml = this.sanitizeHtmlForPreview(htmlContent);
                }
            }

            // Parse sanitized HTML in an inert template, sanitize attributes on parsed nodes, then attach
            // Parse sanitized HTML into a detached DOM using DOMParser (inert)
            const parser = new DOMParser();
            const doc = parser.parseFromString('<div>' + (safeHtml || '') + '</div>', 'text/html');
            const fragment = document.createDocumentFragment();
            const container = doc.body.firstElementChild || doc.body;

            // Clean attributes on parsed elements before insertion
            const walkerTmp = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null, false);
            while (walkerTmp.nextNode()) {
                const el = walkerTmp.currentNode;
                [...el.attributes].forEach(attr => {
                    const name = attr.name.toLowerCase();
                    const val = String(attr.value || '');
                    if (name.startsWith('on')) el.removeAttribute(attr.name);
                    if (val.includes('${') || val.toLowerCase().includes('%24%7b')) el.removeAttribute(attr.name);
                    if ((name === 'href' || name === 'src') && val.toLowerCase().startsWith('javascript:')) el.removeAttribute(attr.name);
                });
            }

            // Move cleaned nodes into a DocumentFragment
            Array.from(container.childNodes).forEach(n => fragment.appendChild(n.cloneNode(true)));

            // Replace content safely (no innerHTML on the live DOM)
            while (previewDesc.firstChild) previewDesc.removeChild(previewDesc.firstChild);
            previewDesc.appendChild(fragment);
        
        // Atualizar banner
        const previewBanner = document.getElementById('previewBanner');
        const bannerImg = previewBanner.querySelector('img');
        if (banner && banner.trim()) {
            bannerImg.src = banner;
            previewBanner.classList.remove('hidden');
        } else {
            previewBanner.classList.add('hidden');
        }
        
        // Atualizar contadores
        this.updateCounters();
        
        // Atualizar campos customizados
        this.updatePreviewFields();
        }

    sanitizeHtmlForPreview(html) {
        if (!html || typeof html !== 'string') return '';
        // Remove unresolved template placeholders like ${...} and encoded %24%7B
        html = html.replace(/\$\{[^}]*\}/g, '');
        html = html.replace(/%24%7B/gi, '');
        // Remove event handler attributes like onclick, onerror, onmouseover etc.
        html = html.replace(/\s+on[a-zA-Z]+\s*=\s*"[^"]*"/g, '');
        html = html.replace(/\s+on[a-zA-Z]+\s*=\s*'[^']*'/g, '');
        // Remove javascript: URLs
        html = html.replace(/href\s*=\s*"javascript:[^\"]*"/gi, '');
        html = html.replace(/src\s*=\s*"javascript:[^\"]*"/gi, '');
        return html;
    }

    updateCounters() {
        const title = document.getElementById('title').value;
        const description = this.quill.getText();
        
        document.getElementById('titleCount').textContent = title.length;
        document.getElementById('descCount').textContent = description.length;
        document.getElementById('fieldsCount').textContent = this.fieldsCount;
        
        // Cores dos contadores
        const titleCounter = document.getElementById('titleCount');
        const descCounter = document.getElementById('descCount');
        
        titleCounter.style.color = title.length > 200 ? '#EE5D50' : title.length > 150 ? '#FFB547' : '#01B574';
        descCounter.style.color = description.length > 3000 ? '#EE5D50' : description.length > 2000 ? '#FFB547' : '#01B574';
    }

    addField() {
        if (this.fieldsCount >= 25) {
            this.showNotification('Máximo de 25 campos atingido!', 'warning');
            return;
        }

        this.fieldsCount++;
        const fieldsContainer = document.getElementById('fieldsContainer');

        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field-item fade-in';

        // header
        const header = document.createElement('div'); header.className = 'field-header';
    const h4 = document.createElement('h4');
    h4.className = 'flex-row';
        const icon = document.createElement('i'); icon.className = 'fas fa-tag';
        const titleText = document.createTextNode(' Campo ' + this.fieldsCount);
        h4.appendChild(icon); h4.appendChild(titleText);

    const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'btn-remove';
    removeBtn.style.marginLeft = '8px';
    const trashIcon = document.createElement('i'); trashIcon.className = 'fas fa-trash';
    removeBtn.appendChild(trashIcon);
        removeBtn.addEventListener('click', () => { this.removeField(removeBtn); });

        header.appendChild(h4); header.appendChild(removeBtn);

        // inputs container
        const inputs = document.createElement('div'); inputs.className = 'field-inputs';

        const makeFormGroup = (labelText, inputEl) => {
            const g = document.createElement('div'); g.className = 'form-group';
            const label = document.createElement('label');
            const labelIcon = document.createElement('i');
            // small heuristic to match previous icons
            labelIcon.className = labelText.includes('Nome') ? 'fas fa-heading' : 'fas fa-align-left';
            label.appendChild(labelIcon);
            label.appendChild(document.createTextNode(' ' + labelText));
            g.appendChild(label);
            g.appendChild(inputEl);
            return g;
        };

        const nameInput = document.createElement('input');
        nameInput.type = 'text'; nameInput.placeholder = 'Ex: Nova Feature'; nameInput.className = 'field-name';
        nameInput.addEventListener('change', () => this.updatePreview());

        const valueTextarea = document.createElement('textarea');
        valueTextarea.placeholder = 'Descrição da nova feature...'; valueTextarea.className = 'field-value'; valueTextarea.rows = 3;
        valueTextarea.addEventListener('change', () => this.updatePreview());

        const inlineWrapper = document.createElement('div'); inlineWrapper.className = 'form-group';
        const inlineLabel = document.createElement('label');
        const inlineInput = document.createElement('input'); inlineInput.type = 'checkbox'; inlineInput.className = 'field-inline';
        inlineInput.style.marginRight = '6px';
        inlineLabel.appendChild(inlineInput); inlineLabel.appendChild(document.createTextNode(' Inline (lado a lado)'));
        inlineWrapper.appendChild(inlineLabel);

        inputs.appendChild(makeFormGroup('Nome do Campo', nameInput));
        inputs.appendChild(makeFormGroup('Valor do Campo', valueTextarea));
        inputs.appendChild(inlineWrapper);

        fieldDiv.appendChild(header);
        fieldDiv.appendChild(inputs);

        fieldsContainer.appendChild(fieldDiv);
        this.updatePreview();
    }

    removeField(button) {
        const fieldItem = button.closest('.field-item');
        fieldItem.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            fieldItem.remove();
            this.fieldsCount--;
            this.updatePreview();
        }, 300);
    }

    updatePreviewFields() {
        const previewFields = document.getElementById('previewFields');
        const fieldItems = document.querySelectorAll('.field-item');

        // Clear current fields
        while (previewFields.firstChild) previewFields.removeChild(previewFields.firstChild);

        if (fieldItems.length === 0) return;

        fieldItems.forEach((item, index) => {
            const name = item.querySelector('.field-name').value || ('Campo ' + (index + 1));
            const value = item.querySelector('.field-value').value || 'Valor do campo...';
            const inline = item.querySelector('.field-inline').checked;

            const fieldWrap = document.createElement('div');
            fieldWrap.className = 'embed-field' + (inline ? ' inline' : '');

            const nameDiv = document.createElement('div'); nameDiv.className = 'embed-field-name'; nameDiv.textContent = name;
            const valueDiv = document.createElement('div'); valueDiv.className = 'embed-field-value'; valueDiv.textContent = value;

            fieldWrap.appendChild(nameDiv);
            fieldWrap.appendChild(valueDiv);
            previewFields.appendChild(fieldWrap);
        });
    }

    insertEmoji(event) {
        const emoji = event.target.dataset.emoji;
        if (emoji && this.quill) {
            const range = this.quill.getSelection(true);
            this.quill.insertText(range.index, emoji);
            this.quill.setSelection(range.index + emoji.length);
            
            // Animação do botão
            event.target.style.transform = 'scale(1.3)';
            setTimeout(() => {
                event.target.style.transform = '';
            }, 200);
        }
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);
        // Sanitize description from Quill before sending to server
            try {
            const rawHtml = (this.quill && this.quill.root && this.quill.root.innerHTML) ? this.quill.root.innerHTML : '';
            if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                data.description = window.DOMPurify.sanitize(rawHtml, {ALLOWED_TAGS: ['b','i','u','strong','em','a','p','br','ul','ol','li','code','pre']});
            } else if (window.FrontendHelpers && typeof window.FrontendHelpers.stripHtml === 'function') {
                data.description = window.FrontendHelpers.stripHtml(rawHtml);
            } else {
                // fallback to the dashboard's sanitizer
                data.description = this.sanitizeHtmlForPreview(rawHtml);
            }
        } catch (e) {
            console.debug('Erro ao sanitizar descrição:', e);
            const fallbackRaw = this.quill && this.quill.root ? this.quill.root.innerHTML : '';
            if (window.FrontendHelpers && typeof window.FrontendHelpers.stripHtml === 'function') {
                data.description = window.FrontendHelpers.stripHtml(fallbackRaw);
            } else {
                data.description = this.sanitizeHtmlForPreview(fallbackRaw);
            }
        }
        
        // Adicionar campos customizados
        const fields = [];
        document.querySelectorAll('.field-item').forEach(item => {
            const name = item.querySelector('.field-name').value;
            const value = item.querySelector('.field-value').value;
            const inline = item.querySelector('.field-inline').checked;
            
            if (name && value) {
                fields.push({ name, value, inline });
            }
        });
        data.fields = fields;

        this.showLoadingOverlay(true);

        try {
            const response = await fetch('/api/send-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showSuccessModal();
                this.resetForm();
            } else {
                let error = await response.text();
                error = String(error || '').replace(/\s+/g, ' ').slice(0, 500);
                this.showNotification('Erro: ' + error, 'error');
            }
        } catch (error) {
            this.showNotification('Erro ao enviar update', 'error');
            console.debug('Erro enviando update:', error);
        } finally {
            this.showLoadingOverlay(false);
        }
    }

    showLoadingOverlay(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
            overlay.classList.add('hidden');
        }
    }

    showSuccessModal() {
        const modal = document.getElementById('successModal');
    modal.classList.add('active');
    modal.classList.add('fade-in');
    }

    resetForm() {
        document.getElementById('updateForm').reset();
        this.quill.setContents([]);
        const fc = document.getElementById('fieldsContainer'); if (fc) { while (fc.firstChild) fc.removeChild(fc.firstChild); }
        this.fieldsCount = 0;
        this.updatePreview();
    }

    handleLogout() {
        if (confirm('🚀 Tens a certeza que queres fazer logout?')) {
            localStorage.clear();
            document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            safeRedirectToLogin();
        }
    }

    // Expose a helper to safely read an auth token from cookie/localStorage
    static getAuthToken() {
        try {
            // cookie
            const cookieToken = document.cookie?.split('; ').find(row => row.startsWith('authToken='))?.split('=')[1];
            if (cookieToken) return cookieToken;
            // localStorage
            const localToken = localStorage.getItem('authToken') || localStorage.getItem('productionToken');
            if (localToken) return localToken;
            // development or file protocol: do not auto-insert
            if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return null;
            // production markers
            const urlParams = new URLSearchParams(window.location.search);
            const prodToken = urlParams.get('token');
            if (window.location.hostname.includes('railway.app') && prodToken) return '***present***';
            return '';
        } catch (e) { return ''; }
    }

    // Small helper to update embed preview (keeps parity with old inline functions)
    updateEmbedPreviewLight() {
        try {
            const preview = document.getElementById('previewEmbed');
            const previewTitle = document.getElementById('previewTitle');
            const previewDesc = document.getElementById('previewDescription');
            const embedTitle = document.getElementById('embedTitle');
            const title = document.getElementById('title')?.value || '';
            const color = document.getElementById('color')?.value || '#4318FF';
            const description = this.quill ? this.quill.root.innerHTML : '';

            if (previewTitle) previewTitle.textContent = title;
            if (preview) preview.style.setProperty('--embed-color', color);
            if (embedTitle) embedTitle.style.setProperty('--title-color', color);

            // update description safely using existing sanitizer logic
            if (previewDesc) {
                const safe = (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') ? window.DOMPurify.sanitize(description) : this.sanitizeHtmlForPreview(description);
                // Use DOMParser to parse sanitized HTML in an inert document, then move cleaned nodes
                while (previewDesc.firstChild) previewDesc.removeChild(previewDesc.firstChild);
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString('<div>' + (safe || '') + '</div>', 'text/html');
                    const container = doc.body.firstElementChild || doc.body;
                    const fragment = document.createDocumentFragment();
                    Array.from(container.childNodes).forEach(n => fragment.appendChild(n.cloneNode(true)));
                    previewDesc.appendChild(fragment);
                } catch (parseErr) {
                    // fallback: create a text node to avoid inserting raw HTML
                    previewDesc.appendChild(document.createTextNode(String(safe || '')));
                }
            }
        } catch (e) { console.debug('updateEmbedPreviewLight failed', e); }
    }

    sendEmbedMock() {
        alert('Embed enviado com sucesso! (Funcionalidade simulada)');
    }

    // Simple logs helpers used by UI
    addLogEntry(containerSelector, action, user, reason) {
        try {
            const container = document.querySelector(containerSelector);
            if (!container) return;
            const newLog = document.createElement('div');
            const time = document.createElement('span');
            const msg = document.createElement('span');
            const currentTime = new Date().toLocaleTimeString();
            const actionNames = { 'warn': 'Aviso', 'timeout': 'Timeout', 'kick': 'Expulsão', 'ban': 'Banimento', 'error': 'Erro' };
            const icon = action === 'error' ? '❌' : 'ℹ️';
            newLog.className = 'log-entry ' + (action === 'error' ? 'error' : 'info');
            time.className = 'log-time'; time.textContent = '[' + currentTime + '] ';
            msg.className = 'log-message'; msg.textContent = icon + ' ' + (actionNames[action] || action) + ' - ' + user + ': ' + (reason || '');
            newLog.appendChild(time); newLog.appendChild(msg);
            container.insertBefore(newLog, container.firstChild);
            while (container.children.length > 50) container.removeChild(container.lastChild);
        } catch (e) { console.debug('addLogEntry failed', e); }
    }

    showNotification(message, type = 'info') {
        // Criar notificação moderna (DOM-safe)
        const notification = document.createElement('div');
    notification.className = 'notification notification-' + type + ' slide-up';

        const icon = document.createElement('i');
    icon.className = 'fas fa-' + (type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle');
        const span = document.createElement('span'); span.textContent = message;

        notification.appendChild(icon);
        notification.appendChild(span);
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    setupRealTimePreview() {
        // Preview atualiza em tempo real
        setInterval(() => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('pt-PT', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const footer = document.getElementById('previewFooter');
            if (!footer) return;
            // Clear and construct DOM-safe footer
            while (footer.firstChild) footer.removeChild(footer.firstChild);
            const img = document.createElement('img');
            img.src = 'https://cdn.discordapp.com/icons/1333825066928214053/a_8c5e2b5b5f4d3c2a1e0f9b8d7c6e5a4b.gif';
            img.alt = 'Bot Icon';
            const span = document.createElement('span'); span.textContent = 'YSNM Bot • ' + timeString;
            footer.appendChild(img); footer.appendChild(span);
        }, 1000);
    }

    addModernAnimations() {
        // Animações de entrada para elementos
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                }
            });
        });

        document.querySelectorAll('.update-form-container, .preview-container').forEach(el => {
            observer.observe(el);
        });
    }

    initializeSocketIO() {
        try {
            this.socket = io();
            this.socket.on('connect', () => {
                console.debug('🔌 Socket.IO conectado');
            });
        } catch (error) {
            console.debug('⚠️ Socket.IO não disponível');
        }
    }

    // Update token displays across the page (legacy UI hook)
    updateTokenDisplay() {
        try {
            const els = document.querySelectorAll('.current-token');
            els.forEach(d => {
                const t = getAuthToken();
                d.textContent = t ? (t.length > 20 ? t.substring(0, 12) + '...' + t.slice(-4) : t) : 'Nenhum token configurado';
            });
        } catch (e) { /* no-op */ }
    }

    // --- Ticket management methods moved here from dashboard.html ---
    async updateTicketSeverity(modal) {
        const ticketId = modal.querySelector('#manage-ticket-id')?.value?.trim();
        const selectedSeverity = modal.querySelector('[data-severity].selected');
        if (!ticketId || !/^\d+$/.test(ticketId)) {
            this.showMessage('ID do ticket deve ser um número válido', 'error');
            return;
        }
        if (!selectedSeverity) {
            this.showMessage('Selecione uma gravidade', 'error');
            return;
        }
        const severity = selectedSeverity.dataset.severity;
        try {
            const response = await fetch('/api/tickets/' + encodeURIComponent(ticketId) + '/severity', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (getAuthToken() || '') },
                body: JSON.stringify({ severity: severity })
            });
            if (response.ok) {
                this.showMessage('Gravidade do ticket atualizada!', 'success');
                document.body.removeChild(modal);
            } else {
                const error = await response.json().catch(() => ({}));
                this.showMessage('Erro: ' + (error.error || ''), 'error');
            }
        } catch (error) {
            console.error('Error updating ticket severity:', error);
            this.showMessage('Erro ao atualizar gravidade', 'error');
        }
    }

    async deleteTicket(modal) {
        const ticketId = modal.querySelector('#manage-ticket-id')?.value?.trim();
        if (!ticketId) return this.showMessage('ID do ticket é obrigatório', 'error');
        if (!/^\d+$/.test(ticketId)) return this.showMessage('ID do ticket deve ser um número válido', 'error');
        try {
            const response = await fetch('/api/tickets/' + encodeURIComponent(ticketId), {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + (getAuthToken() || '') }
            });
            if (response.ok) {
                this.showMessage('Ticket eliminado com sucesso!', 'success');
                document.body.removeChild(modal);
                this.refreshTickets();
            } else {
                const error = await response.json().catch(() => ({}));
                this.showMessage('Erro: ' + (error.error || ''), 'error');
            }
        } catch (error) {
            console.error('Error deleting ticket:', error);
            this.showMessage('Erro ao eliminar ticket', 'error');
        }
    }

    async refreshTickets() {
        try {
            const response = await fetch('/api/tickets', { headers: { 'Authorization': 'Bearer ' + (getAuthToken() || '') } });
            if (response.ok) {
                const data = await response.json().catch(() => ([]));
                const tickets = data.tickets || data || [];
                if (Array.isArray(tickets)) {
                    this.updateTicketsDisplay(tickets);
                    this.showMessage('Tickets atualizados!', 'success');
                } else {
                    this.updateTicketsDisplay([]);
                    this.showMessage('Nenhum ticket encontrado', 'info');
                }
            } else {
                console.error('Response not ok:', response.status, response.statusText);
                this.showMessage('Erro ao carregar tickets', 'error');
            }
        } catch (error) {
            console.error('Error refreshing tickets:', error);
            this.showMessage('Erro ao atualizar tickets', 'error');
        }
    }

    updateTicketsDisplay(tickets) {
        const ticketsList = document.querySelector('.tickets-list');
        if (!ticketsList) return;
        if (!Array.isArray(tickets)) { tickets = []; }
        if (tickets.length === 0) {
            while (ticketsList.firstChild) ticketsList.removeChild(ticketsList.firstChild);
            const emptyDiv = document.createElement('div');
            emptyDiv.style.textAlign = 'center';
            emptyDiv.style.padding = 'var(--space-xl)';
            emptyDiv.style.color = 'var(--text-secondary)';
            const icon = document.createElement('i'); icon.className = 'fas fa-ticket-alt'; icon.style.fontSize = '3rem'; icon.style.marginBottom = 'var(--space-md)'; icon.style.opacity = '0.5';
            const messageDiv = document.createElement('div'); messageDiv.textContent = 'Nenhum ticket encontrado';
            emptyDiv.appendChild(icon); emptyDiv.appendChild(messageDiv); ticketsList.appendChild(emptyDiv); return;
        }
        while (ticketsList.firstChild) ticketsList.removeChild(ticketsList.firstChild);
        const severityEmoji = { 'low': '\ud83d\udfe2', 'normal': '\ud83d\udfe1', 'high': '\ud83d\udd34', 'critical': '\ud83d\udfe3' };
        const statusColor = { 'open': '#10B981', 'pending': '#F59E0B', 'closed': '#6B7280' };
        tickets.forEach(ticket => {
            const item = document.createElement('div'); item.className = 'ticket-item';
            const header = document.createElement('div'); header.className = 'ticket-header';
            const title = document.createElement('span'); title.className = 'ticket-title'; title.textContent = (severityEmoji[ticket.severity] || '\ud83d\udfe1') + ' ' + (ticket.title || '');
            const status = document.createElement('span'); status.className = 'ticket-status'; status.style.background = statusColor[ticket.status] || '#6B7280'; status.textContent = ticket.status || '';
            header.appendChild(title); header.appendChild(status);
            const meta = document.createElement('div'); meta.className = 'ticket-meta';
            const idSpan = document.createElement('span'); idSpan.textContent = 'ID: ' + (ticket.id || '');
            const bySpan = document.createElement('span'); bySpan.textContent = 'Por: ' + (ticket.created_by || 'Desconhecido');
            const dateSpan = document.createElement('span'); dateSpan.textContent = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '';
            const sevSpan = document.createElement('span'); sevSpan.textContent = 'Gravidade: ' + (ticket.severity || '');
            meta.appendChild(idSpan); meta.appendChild(bySpan); meta.appendChild(dateSpan); meta.appendChild(sevSpan);
            item.appendChild(header); item.appendChild(meta); ticketsList.appendChild(item);
        });
    }
}

// Função global para fechar modal
function closeModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('fade-in');
        modal.classList.add('hidden');
    }
}

// Adicionar estilos CSS para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
    }
    
    @keyframes slideDown {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(100%); opacity: 0; }
    }
    
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--bg-card);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: var(--radius-md);
        padding: var(--space-lg);
        color: var(--text-white);
        display: flex;
        align-items: center;
        gap: var(--space-md);
        box-shadow: var(--shadow-primary);
        z-index: 10000;
        max-width: 400px;
    }
    
    .notification-error { border-left: 4px solid #EE5D50; }
    .notification-warning { border-left: 4px solid #FFB547; }
    .notification-info { border-left: 4px solid #4318FF; }
    
    .field-item {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        margin-bottom: var(--space-lg);
    }
    
    .field-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-lg);
    }
    
    .field-header h4 {
        color: var(--text-white);
        font-size: 1rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: var(--space-sm);
    }
    
    .btn-remove {
        background: var(--gradient-danger);
        border: none;
        color: white;
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-size: 0.8rem;
        transition: all 0.3s ease;
    }
    
    .btn-remove:hover {
        transform: scale(1.05);
    }
    
    .field-inputs {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
    }
    
    .embed-field.inline {
        display: inline-block;
        width: calc(50% - var(--space-sm));
        margin-right: var(--space-md);
        vertical-align: top;
    }
`;
document.head.appendChild(style);

// --- Legacy helpers (moved from dashboard.html) ---
function promptForToken(){
    const token = prompt('Insira o token de acesso para Railway:');
    if (token && token.trim()){
        if (!confirm('Guardar este token no armazenamento local? Isto é inseguro em ambientes partilhados.')) return;
        localStorage.setItem('productionToken', token.trim());
        alert('Token armazenado como productionToken. Use a opção de sessão para ativar.');
    }
}

function redirectToOAuth(){
    // Use absolute path to ensure redirect always goes to the server root
    window.location.href = '/auth/discord';
}

function setProductionToken(){
    const tokenInput = document.getElementById('prodToken');
    const token = tokenInput && tokenInput.value && tokenInput.value.trim();
    if (token){
        if (!confirm('Guardar este token no armazenamento local? Isto é inseguro em ambientes partilhados.')) return;
        localStorage.setItem('productionToken', token);
        if (tokenInput) tokenInput.value = '';
        alert('Token guardado como productionToken. Por favor ative sessão manualmente se necessário.');
    }
}

function initSmallUI(){
    try{
        if (typeof createDebuggerWidget === 'function') createDebuggerWidget();
        if (window.sanitizeTemplatePlaceholders) window.sanitizeTemplatePlaceholders();
        if (window.attachImageFallbacks) window.attachImageFallbacks();
        if (typeof YSNMDashboard === 'function') { if (!window.dashboard) window.dashboard = new YSNMDashboard(); }
    }catch(e){ console.debug && console.debug('Init error', e); }
}

// Global lightweight wrapper for backward compatibility
function updateEmbedPreview(){ try{ if (window.dashboard && typeof window.dashboard.updateEmbedPreviewLight === 'function') return window.dashboard.updateEmbedPreviewLight(); }catch(e){} }

// Expose small globals
window.promptForToken = promptForToken;
window.redirectToOAuth = redirectToOAuth;
window.setProductionToken = setProductionToken;
window.initSmallUI = initSmallUI;
window.updateEmbedPreview = updateEmbedPreview;

// --- Simple-test page helpers ---
window.testeBasico = function(){
    const resultado = document.getElementById('resultado1');
    if (!resultado) return;
    resultado.className = 'result';
    resultado.textContent = 'Executando teste básico...';
    try {
        const a = 2, b = 3;
        const soma = a + b;
        resultado.textContent += '\n✅ Funções: 2 + 3 = ' + soma;
        const elemento = document.querySelector('.test-page');
        resultado.textContent += '\n✅ DOM: ' + (elemento ? 'Sim' : 'Não');
        resultado.textContent += '\n✅ Fetch API: ' + (typeof fetch === 'function' ? 'Disponível' : 'Não disponível');
        resultado.className = 'result success';
    } catch (e) {
        resultado.className = 'result error';
        resultado.textContent = '❌ ERRO: ' + (e.message || e);
    }
};

window.testeAPI = async function(){
    const resultado = document.getElementById('resultado2'); if (!resultado) return;
    resultado.className = 'result'; resultado.textContent = 'Testando APIs...';
    try {
        const r1 = await fetch('/api/user'); resultado.textContent += '\n/api/user: ' + r1.status;
        const j1 = await r1.json().catch(()=>null); resultado.textContent += '\n/api/user resp: ' + JSON.stringify(j1);
        const r2 = await fetch('/api/guilds'); resultado.textContent += '\n/api/guilds: ' + r2.status;
        const j2 = await r2.json().catch(()=>null); resultado.textContent += '\n/api/guilds resp: ' + JSON.stringify(j2);
        resultado.className = 'result success';
    } catch (e) {
        resultado.className = 'result error'; resultado.textContent += '\n❌ ERRO API: ' + (e.message || e);
    }
};

window.testeCompleto = async function(){
    const resultado = document.getElementById('resultado3'); if (!resultado) return;
    resultado.className = 'result'; resultado.textContent = 'Executando teste completo...';
    try {
        const [r1, r2] = await Promise.all([fetch('/api/user'), fetch('/api/guilds')]);
        resultado.textContent += '\nResponses: ' + r1.status + ', ' + r2.status;
        const j1 = await r1.json().catch(()=>null);
        const j2 = await r2.json().catch(()=>null);
        resultado.textContent += '\nUser success: ' + (j1 && j1.success) + ' Guilds success: ' + (j2 && j2.success);
        resultado.className = 'result success';
    } catch (e) {
        resultado.className = 'result error'; resultado.textContent += '\n❌ ERRO COMPLETO: ' + (e.message || e);
    }
};

// Inicializar dashboard quando página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new YSNMDashboard();
});

// Backwards-compatible global proxy functions (some pages still call these)
function updateEmbedPreview() {
    try { if (window.dashboard && typeof window.dashboard.updateEmbedPreviewLight === 'function') window.dashboard.updateEmbedPreviewLight(); } catch(e) { console.debug('updateEmbedPreview proxy failed', e); }
}

function sendEmbed() {
    try { if (window.dashboard && typeof window.dashboard.sendEmbedMock === 'function') window.dashboard.sendEmbedMock(); } catch(e) { console.debug('sendEmbed proxy failed', e); }
}

function refreshLogs() { try { if (window.dashboard && typeof window.dashboard.addLogEntry === 'function') window.dashboard.addLogEntry('#logs', 'info', 'system', 'refresh'); } catch(e) { console.debug('refreshLogs proxy failed', e); } }

function clearLogs() { try { const container = document.querySelector('#logs'); if (!container) return; while(container.firstChild) container.removeChild(container.firstChild); } catch(e) { console.debug('clearLogs proxy failed', e); } }

function getAuthToken(){ try { if (window.dashboard && typeof window.dashboard.constructor.getAuthToken === 'function') return window.dashboard.constructor.getAuthToken(); return null; } catch(e){ return null; } }
