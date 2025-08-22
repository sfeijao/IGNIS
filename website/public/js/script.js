// Modern YSNM Dashboard JavaScript - HorizonUI Inspired
class YSNMDashboard {
    constructor() {
        this.quill = null;
        this.fieldsCount = 0;
        this.socket = null;
        this.init();
    }

    async init() {
        console.log('🚀 Inicializando YSNM Modern Dashboard...');
        
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
        
        console.log('✨ Dashboard inicializado com sucesso!');
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/channels', { credentials: 'include' });
            if (!response.ok) {
                console.log('❌ Não autenticado, redirecionando...');
                window.location.replace('/login');
                return false;
            }
            return true;
        } catch (error) {
            console.log('❌ Erro na autenticação:', error);
            window.location.replace('/login');
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
                channelSelect.innerHTML = '<option value="">🎯 Seleciona o canal perfeito...</option>';
                
                // Agrupar por categoria
                const grouped = this.groupChannelsByCategory(channels);
                
                Object.keys(grouped).sort().forEach(category => {
                    if (category !== 'Sem Categoria') {
                        const optgroup = document.createElement('optgroup');
                        optgroup.label = `📁 ${category}`;
                        channelSelect.appendChild(optgroup);
                        
                        grouped[category].forEach(channel => {
                            const option = document.createElement('option');
                            option.value = channel.id;
                            option.textContent = `# ${channel.name}`;
                            optgroup.appendChild(option);
                        });
                    }
                });
                
                // Canais sem categoria
                if (grouped['Sem Categoria']) {
                    grouped['Sem Categoria'].forEach(channel => {
                        const option = document.createElement('option');
                        option.value = channel.id;
                        option.textContent = `# ${channel.name}`;
                        channelSelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Erro carregando canais:', error);
            this.showNotification('Erro ao carregar canais', 'error');
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
        if (htmlContent.trim() === '<p><br></p>' || htmlContent.trim() === '') {
            previewDesc.innerHTML = `
                <p>A descrição do teu update será mostrada aqui em tempo real enquanto escreves...</p>
                <p>✨ <strong>Dica:</strong> Usa formatação Markdown para deixar o texto mais atrativo!</p>
            `;
        } else {
            previewDesc.innerHTML = htmlContent;
        }
        
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
        fieldDiv.innerHTML = `
            <div class="field-header">
                <h4><i class="fas fa-tag"></i> Campo ${this.fieldsCount}</h4>
                <button type="button" class="btn-remove" onclick="dashboard.removeField(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="field-inputs">
                <div class="form-group">
                    <label><i class="fas fa-heading"></i> Nome do Campo</label>
                    <input type="text" placeholder="Ex: Nova Feature" class="field-name" onchange="dashboard.updatePreview()">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-align-left"></i> Valor do Campo</label>
                    <textarea placeholder="Descrição da nova feature..." class="field-value" rows="3" onchange="dashboard.updatePreview()"></textarea>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" class="field-inline"> Inline (lado a lado)
                    </label>
                </div>
            </div>
        `;
        
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
        
        if (fieldItems.length === 0) {
            previewFields.innerHTML = '';
            return;
        }

        let fieldsHTML = '';
        fieldItems.forEach((item, index) => {
            const name = item.querySelector('.field-name').value || `Campo ${index + 1}`;
            const value = item.querySelector('.field-value').value || 'Valor do campo...';
            const inline = item.querySelector('.field-inline').checked;
            
            fieldsHTML += `
                <div class="embed-field ${inline ? 'inline' : ''}">
                    <div class="embed-field-name">${name}</div>
                    <div class="embed-field-value">${value}</div>
                </div>
            `;
        });
        
        previewFields.innerHTML = fieldsHTML;
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
        data.description = this.quill.root.innerHTML;
        
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
                const error = await response.text();
                this.showNotification(`Erro: ${error}`, 'error');
            }
        } catch (error) {
            console.error('Erro enviando update:', error);
            this.showNotification('Erro ao enviar update', 'error');
        } finally {
            this.showLoadingOverlay(false);
        }
    }

    showLoadingOverlay(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
            overlay.classList.add('hidden');
        }
    }

    showSuccessModal() {
        const modal = document.getElementById('successModal');
        modal.style.display = 'flex';
        modal.classList.add('fade-in');
    }

    resetForm() {
        document.getElementById('updateForm').reset();
        this.quill.setContents([]);
        document.getElementById('fieldsContainer').innerHTML = '';
        this.fieldsCount = 0;
        this.updatePreview();
    }

    handleLogout() {
        if (confirm('🚀 Tens a certeza que queres fazer logout?')) {
            localStorage.clear();
            document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            window.location.href = '/login';
        }
    }

    showNotification(message, type = 'info') {
        // Criar notificação moderna
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} slide-up`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
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
            document.getElementById('previewFooter').innerHTML = `
                <img src="https://cdn.discordapp.com/icons/1333825066928214053/a_8c5e2b5b5f4d3c2a1e0f9b8d7c6e5a4b.gif" alt="Bot Icon">
                <span>YSNM Bot • ${timeString}</span>
            `;
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
                console.log('🔌 Socket.IO conectado');
            });
        } catch (error) {
            console.log('⚠️ Socket.IO não disponível');
        }
    }
}

// Função global para fechar modal
function closeModal() {
    const modal = document.getElementById('successModal');
    modal.style.display = 'none';
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

// Inicializar dashboard quando página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new YSNMDashboard();
});
