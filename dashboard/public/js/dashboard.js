// IGNIS Dashboard - Modern JavaScript
class IGNISDashboard {
    constructor() {
        this.currentGuild = null;
        this.user = null;
        this.guilds = [];
        
        this.init();
    }
    
    async init() {
        // ========================================
// IGNIS Dashboard - Sistema de Tickets Avançado
// Desenvolvido para gestão completa de tickets Discord
// ========================================

// Note: Arquivos como sharebx.js, css.js são de extensões do navegador, não nosso código

console.log('🚀 Inicializando IGNIS Dashboard...');
        
        try {
            await this.loadUser();
            await this.loadGuilds();
            this.setupEventListeners();
            console.log('✅ Dashboard inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao inicializar dashboard:', error);
            this.showError('Erro ao carregar dashboard');
        }
    }
    
    async loadUser() {
        try {
            const response = await fetch('/api/user');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.user = data.user;
                this.updateUserDisplay();
            } else {
                throw new Error('Usuário não autenticado');
            }
        } catch (error) {
            console.error('Erro ao carregar usuário:', error);
            window.location.href = '/login';
        }
    }
    
    async loadGuilds() {
        try {
            const response = await fetch('/api/guilds');
            let data = null;
            const ct = response.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                try { data = await response.json(); } catch (_) { data = null; }
            }

            if (!response.ok) {
                if (response.status === 401) {
                    this.showError('Sessão expirada. Redirecionando para login...');
                    setTimeout(() => window.location.href = '/login', 800);
                    return;
                }
                throw new Error(data?.error || `HTTP ${response.status}`);
            }

            if (!data?.success) {
                throw new Error(data?.error || 'Erro ao carregar servidores');
            }

            this.guilds = data.guilds || [];
            this.displayGuilds();
        } catch (error) {
            console.error('Erro ao carregar servidores:', error);
            this.showError('Erro ao carregar servidores');
            const serverGrid = document.getElementById('serverGrid');
            if (serverGrid) {
                serverGrid.innerHTML = `
                    <div class="no-servers glass-card">
                        <div class="no-servers-content">
                            <div class="no-servers-icon"><i class="fas fa-exclamation-triangle"></i></div>
                            <h3>Erro ao carregar servidores</h3>
                            <p>Tente atualizar a página. Se o problema persistir, faça login novamente.</p>
                            <a href="/login" class="btn btn-primary">Entrar novamente</a>
                        </div>
                    </div>
                `;
            }
        }
    }
    
    updateUserDisplay() {
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        
        if (userName && this.user) {
            userName.textContent = this.user.username;
        }
        
        if (userAvatar && this.user?.avatar) {
            userAvatar.src = this.user.avatar;
        }
    }
    
    displayGuilds() {
        const serverGrid = document.getElementById('serverGrid');
        
        if (!serverGrid) return;
        
        if (this.guilds.length === 0) {
            serverGrid.innerHTML = this.createNoServersMessage();
            return;
        }
        
        const serversHtml = this.guilds.map(guild => this.createServerCard(guild)).join('');
        serverGrid.innerHTML = serversHtml;
        
        // Add click events to server cards
        this.attachServerCardEvents();
        
        // Add fade-in animation
        setTimeout(() => {
            const cards = serverGrid.querySelectorAll('.server-card');
            cards.forEach((card, index) => {
                setTimeout(() => card.classList.add('fade-in'), index * 100);
            });
        }, 100);
    }
    
    createServerCard(guild) {
        const iconUrl = guild.icon 
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
            : null;
        
        return `
            <div class="server-card glass-card" data-guild-id="${guild.id}">
                <div class="server-info">
                    <div class="server-icon">
                        ${iconUrl 
                            ? `<img src="${iconUrl}" alt="${guild.name}">`
                            : guild.name.charAt(0).toUpperCase()
                        }
                    </div>
                    <div class="server-details">
                        <h3>${this.escapeHtml(guild.name)}</h3>
                        <div class="server-stats">
                            <span><i class="fas fa-users"></i> ${guild.memberCount || 0} membros</span>
                            <span class="server-status ${guild.botPresent ? 'online' : 'offline'}">
                                <i class="fas fa-circle"></i>
                                ${guild.botPresent ? 'Bot Online' : 'Bot Offline'}
                            </span>
                        </div>
                        <div class="mt-8">
                            <button class="btn btn-primary btn-sm" data-create-panel>
                                <i class="fas fa-plus"></i> Criar Painel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    createNoServersMessage() {
        return `
            <div class="no-servers glass-card">
                <div class="no-servers-content">
                    <div class="no-servers-icon">
                        <i class="fas fa-server"></i>
                    </div>
                    <h3>Nenhum servidor encontrado</h3>
                    <p>Você não tem acesso de administrador em nenhum servidor onde o IGNIS Bot esteja instalado.</p>
                    <a href="https://discord.com/api/oauth2/authorize?client_id=${window.BOT_CLIENT_ID || 'YOUR_BOT_ID'}&permissions=8&scope=bot" 
                       class="btn btn-primary" target="_blank" rel="noopener">
                        <i class="fab fa-discord"></i>
                        Adicionar Bot ao Servidor
                    </a>
                </div>
            </div>
        `;
    }
    
    attachServerCardEvents() {
        const serverCards = document.querySelectorAll('.server-card[data-guild-id]');
        
        serverCards.forEach(card => {
            card.addEventListener('click', () => {
                const guildId = card.dataset.guildId;
                this.selectGuild(guildId, card);
            });
            // Create Panel shortcut (stop click bubbling)
            const btn = card.querySelector('[data-create-panel]');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const guildId = card.dataset.guildId;
                    this.currentGuild = guildId;
                    window.location.href = `/panels.html?guildId=${encodeURIComponent(guildId)}#create`;
                });
            }
        });
    }
    
    async selectGuild(guildId, cardElement) {
        try {
            // Update UI
            document.querySelectorAll('.server-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            if (cardElement) {
                cardElement.classList.add('selected');
            }
            
            this.currentGuild = guildId;
            
            // Hide server selection and show dashboard
            const serverSelection = document.getElementById('serverSelection');
            const dashboardContent = document.getElementById('dashboardContent');
            
            if (serverSelection) {
                serverSelection.style.display = 'none';
            }
            
            if (dashboardContent) {
                dashboardContent.classList.remove('hidden');
                dashboardContent.classList.add('fade-in');
            }
            
            // Load guild data
            await this.loadGuildData(guildId);
            await this.loadGuildTickets(guildId);
            
        } catch (error) {
            console.error('Erro ao selecionar servidor:', error);
            this.showError('Erro ao carregar dados do servidor');
        }
    }

    // Open Moderation Center page
    openModeration() {
        const guildId = this.currentGuild;
        if (!guildId) {
            this.showError('Selecione um servidor primeiro');
            return;
        }
        window.location.href = `/moderation.html?guildId=${encodeURIComponent(guildId)}`;
    }
    
    async loadGuildData(guildId) {
        try {
            const response = await fetch(`/api/guild/${guildId}/stats`);
            const data = await response.json();
            
            if (data.success && data.stats) {
                this.updateStatsDisplay(data.stats);
            } else {
                this.updateStatsDisplay({});
            }
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
            this.updateStatsDisplay({});
        }
    }
    
    async loadGuildTickets(guildId) {
        try {
            const response = await fetch(`/api/guild/${guildId}/tickets`);
            const data = await response.json();
            
            if (data.success) {
                this.displayTickets(data.tickets || []);
            } else {
                this.displayTickets([]);
            }
        } catch (error) {
            console.error('Erro ao carregar tickets:', error);
            this.displayTickets([]);
        }
    }
    
    updateStatsDisplay(stats) {
        const statElements = {
            memberCount: stats.memberCount || 0,
            channelCount: stats.channelCount || 0,
            roleCount: stats.roleCount || 0,
            boosterCount: stats.boosterCount || 0
        };
        
        Object.entries(statElements).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                this.animateNumber(element, value);
            }
        });
    }
    
    displayTickets(tickets) {
        const ticketsList = document.getElementById('ticketsList');
        
        if (!ticketsList) return;
        
        if (tickets.length === 0) {
            ticketsList.innerHTML = `
                <div class="no-tickets">
                    <div class="no-tickets-content">
                        <i class="fas fa-ticket-alt"></i>
                        <h4>Nenhum ticket encontrado</h4>
                        <p>Este servidor ainda não possui tickets criados.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        const recentTickets = tickets.slice(0, 5);
        const ticketsHtml = recentTickets.map(ticket => this.createTicketCard(ticket)).join('');
        
        ticketsList.innerHTML = `
            <div class="tickets-header">
                <h4><i class="fas fa-clock"></i> Tickets Recentes</h4>
                <button class="btn btn-glass btn-sm" onclick="viewAllTickets()">Ver Todos</button>
            </div>
            <div class="tickets-list">${ticketsHtml}</div>
        `;
    }
    
    createTicketCard(ticket) {
        const statusColors = {
            open: '#10B981',
            claimed: '#F59E0B',
            assigned: '#F59E0B',
            closed: '#6B7280',
            pending: '#8B5CF6'
        };
        
        const priorityEmojis = {
            urgent: '🔴',
            high: '🟠',
            normal: '🟡',
            low: '🟢'
        };
        
        const createdDate = new Date(ticket.created_at).toLocaleDateString('pt-PT');
        
        return `
            <div class="ticket-card">
                <div class="ticket-header">
                    <div class="ticket-info">
                        <span class="ticket-id">#${ticket.id}</span>
                        <span class="ticket-priority">${priorityEmojis[ticket.priority] || '🟡'}</span>
                    </div>
                    <div class="ticket-badges-row">
                        <span class="ticket-status" style="background-color: ${statusColors[ticket.status] || '#6B7280'}">
                            ${this.formatTicketStatus ? this.formatTicketStatus(ticket.status) : (ticket.status || 'desconhecido')}
                        </span>
                        ${ticket.locked ? `<span class="ticket-lock" title="Bloqueado"><i class="fas fa-lock"></i></span>` : ''}
                    </div>
                </div>
                <div class="ticket-content">
                    <h5>${this.escapeHtml(ticket.subject)}</h5>
                    <p>${this.escapeHtml(ticket.description?.substring(0, 100) || '')}${ticket.description?.length > 100 ? '...' : ''}</p>
                </div>
                <div class="ticket-meta">
                    <span><i class="fas fa-user"></i> <@${ticket.user_id}></span>
                    <span><i class="fas fa-calendar"></i> ${createdDate}</span>
                </div>
            </div>
        `;
    }
    
    animateNumber(element, targetValue) {
        const startValue = parseInt(element.textContent) || 0;
        const duration = 1000;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentValue = Math.round(startValue + (targetValue - startValue) * this.easeOutCubic(progress));
            element.textContent = currentValue.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    setupEventListeners() {
        // Add any global event listeners here
        window.addEventListener('beforeunload', () => {
            console.log('Dashboard fechando...');
        });
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} slide-up`;
        
        const icon = type === 'error' ? 'fas fa-exclamation-circle' : 
                    type === 'success' ? 'fas fa-check-circle' : 'fas fa-info-circle';
        
        notification.innerHTML = `
            <i class="${icon}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
    
    // Advanced Ticket System Functions
    async loadAdvancedTickets() {
        if (!this.currentGuild) return;
        
        const ticketsContainer = document.getElementById('ticketsList');
        if (!ticketsContainer) return;
        
        try {
            ticketsContainer.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    Carregando tickets avançados...
                </div>
            `;
            
            const response = await fetch(`/api/guild/${this.currentGuild}/tickets`);
            const data = await response.json();
            
            if (data.success) {
                this.renderAdvancedTickets(data.tickets, data.stats);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Erro ao carregar tickets:', error);
            ticketsContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    Erro ao carregar tickets: ${error.message}
                </div>
            `;
        }
    }
    
    renderAdvancedTickets(tickets, stats) {
        const ticketsContainer = document.getElementById('ticketsList');
        this._allTickets = tickets || [];
        // Read persisted view state
        const persisted = JSON.parse(localStorage.getItem('ignis_ticket_view') || '{}');
    this._filter = persisted.filter || { status: 'all', locked: 'all' };
        this._sort = persisted.sort || { by: 'created_at', dir: 'desc' };
        const filtered = this.applyTicketFilters(this._allTickets);
        const sorted = this.applyTicketSort(filtered);
        
        if (tickets.length === 0) {
            ticketsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-ticket-alt"></i>
                    </div>
                    <h3>Nenhum ticket encontrado</h3>
                    <p>Este servidor ainda não possui tickets criados.</p>
                </div>
            `;
            return;
        }
        
        const controls = this.createAdvancedTicketControls();
        const ticketCards = sorted.map(ticket => this.createAdvancedTicketCard(ticket)).join('');
        const statsHtml = this.createAdvancedTicketStats(stats);
        
        ticketsContainer.innerHTML = `
            ${statsHtml}
            ${controls}
            <div class="tickets-grid">
                ${ticketCards}
            </div>
        `;
        this.attachControlHandlers();
    }

    createAdvancedTicketControls() {
        const status = (this._filter?.status) || 'all';
        const locked = (this._filter?.locked) || 'all';
        const sortBy = (this._sort?.by) || 'created_at';
        const dir = (this._sort?.dir) || 'desc';
        return `
            <div class="ticket-controls">
                <div class="controls-row">
                    <div class="control">
                        <label>Estado</label>
                        <select id="ctl-status">
                            <option value="all" ${status==='all'?'selected':''}>Todos</option>
                            <option value="open" ${status==='open'?'selected':''}>Abertos</option>
                            <option value="claimed" ${status==='claimed'?'selected':''}>Reclamados</option>
                            <option value="closed" ${status==='closed'?'selected':''}>Fechados</option>
                            <option value="pending" ${status==='pending'?'selected':''}>Pendentes</option>
                        </select>
                    </div>
                    <div class="control">
                        <label>Bloqueado</label>
                        <select id="ctl-locked">
                            <option value="all" ${locked==='all'?'selected':''}>Todos</option>
                            <option value="yes" ${locked==='yes'?'selected':''}>Sim</option>
                            <option value="no" ${locked==='no'?'selected':''}>Não</option>
                        </select>
                    </div>
                    <div class="control">
                        <label>Ordenar por</label>
                        <select id="ctl-sort-by">
                            <option value="created_at" ${sortBy==='created_at'?'selected':''}>Data criação</option>
                            <option value="priority" ${sortBy==='priority'?'selected':''}>Prioridade</option>
                            <option value="status" ${sortBy==='status'?'selected':''}>Estado</option>
                        </select>
                    </div>
                    <div class="control">
                        <label>Direção</label>
                        <select id="ctl-sort-dir">
                            <option value="desc" ${dir==='desc'?'selected':''}>Desc</option>
                            <option value="asc" ${dir==='asc'?'selected':''}>Asc</option>
                        </select>
                    </div>
                    <div class="control" style="align-self:flex-end;">
                        <button class="btn btn-glass" id="ctl-apply">Aplicar</button>
                    </div>
                </div>
                <div class="chips-row">
                    <button class="chip" data-chip="status" data-value="open">Abertos</button>
                    <button class="chip" data-chip="status" data-value="claimed">Reclamados</button>
                    <button class="chip" data-chip="status" data-value="closed">Fechados</button>
                    <button class="chip" data-chip="locked" data-value="yes"><i class="fas fa-lock"></i> Bloqueados</button>
                    <button class="chip" data-chip="reset" data-value="all">Limpar</button>
                </div>
            </div>
        `;
    }

    applyTicketFilters(list){
        let out = Array.isArray(list) ? list.slice() : [];
        const f = this._filter || {};
        // Support multi-select status: status can be 'all' | string | string[]
        if (f.status && f.status !== 'all') {
            const statuses = Array.isArray(f.status) ? f.status : [f.status];
            const set = new Set(statuses.map(s => String(s).toLowerCase()));
            out = out.filter(t => set.has(String(t.status||'').toLowerCase()));
        }
        if (f.locked && f.locked !== 'all') {
            const wanted = f.locked === 'yes';
            out = out.filter(t => !!t.locked === wanted);
        }
        return out;
    }

    applyTicketSort(list){
        const by = (this._sort?.by) || 'created_at';
        const dir = (this._sort?.dir) || 'desc';
        const mul = dir === 'asc' ? 1 : -1;
        const priorityRank = { urgent: 4, high: 3, normal: 2, low: 1 };
        const statusRank = { open: 3, claimed: 2, pending: 1, closed: 0 };
        const arr = list.slice();
        arr.sort((a,b)=>{
            if (by === 'priority') {
                const pa = priorityRank[(a.priority||'normal')] || 0;
                const pb = priorityRank[(b.priority||'normal')] || 0;
                return (pa - pb) * mul;
            } else if (by === 'status') {
                const sa = statusRank[(a.status||'open')] || 0;
                const sb = statusRank[(b.status||'open')] || 0;
                return (sa - sb) * mul;
            }
            // created_at default
            return ((new Date(a.created_at)) - (new Date(b.created_at))) * mul;
        });
        return arr;
    }

    attachControlHandlers(){
        const btn = document.getElementById('ctl-apply');
        if (!btn) return;
        btn.addEventListener('click', ()=>{
            const status = document.getElementById('ctl-status')?.value || 'all';
            const locked = document.getElementById('ctl-locked')?.value || 'all';
            const by = document.getElementById('ctl-sort-by')?.value || 'created_at';
            const dir = document.getElementById('ctl-sort-dir')?.value || 'desc';
            this._filter = { status, locked };
            this._sort = { by, dir };
            localStorage.setItem('ignis_ticket_view', JSON.stringify({ filter: this._filter, sort: this._sort }));
            const filtered = this.applyTicketFilters(this._allTickets||[]);
            const sorted = this.applyTicketSort(filtered);
            const listEl = document.querySelector('#ticketsList .tickets-grid');
            if (listEl) listEl.innerHTML = sorted.map(t=>this.createAdvancedTicketCard(t)).join('');
            this.updateActiveChips();
        });
        // Chips handlers
        const chips = Array.from(document.querySelectorAll('.ticket-controls .chip'));
        chips.forEach(ch => ch.addEventListener('click', (e)=>{
            const type = ch.getAttribute('data-chip');
            const val = ch.getAttribute('data-value');
            if (type === 'reset') {
                this._filter = { status:'all', locked:'all' };
            } else if (type === 'status') {
                // Toggle in a multi-select array
                let cur = this._filter?.status || 'all';
                let arr = Array.isArray(cur) ? cur.slice() : (cur==='all'?[]:[cur]);
                if (arr.includes(val)) arr = arr.filter(v=>v!==val); else arr.push(val);
                this._filter = { ...this._filter, status: arr.length?arr:'all' };
            } else if (type === 'locked') {
                // Toggle locked yes/no tri-state
                const cur = this._filter?.locked || 'all';
                const next = cur === 'yes' ? 'all' : 'yes';
                this._filter = { ...this._filter, locked: next };
            }
            localStorage.setItem('ignis_ticket_view', JSON.stringify({ filter: this._filter, sort: this._sort }));
            // Reflect to selects
            const selStatus = document.getElementById('ctl-status');
            const selLocked = document.getElementById('ctl-locked');
            if (selStatus) selStatus.value = Array.isArray(this._filter.status)?'all':(this._filter.status || 'all');
            if (selLocked) selLocked.value = this._filter.locked || 'all';
            const filtered = this.applyTicketFilters(this._allTickets||[]);
            const sorted = this.applyTicketSort(filtered);
            const listEl = document.querySelector('#ticketsList .tickets-grid');
            if (listEl) listEl.innerHTML = sorted.map(t=>this.createAdvancedTicketCard(t)).join('');
            this.updateActiveChips();
        }));
        this.updateActiveChips();
    }

    updateActiveChips(){
        const chips = Array.from(document.querySelectorAll('.ticket-controls .chip'));
        chips.forEach(ch => {
            const type = ch.getAttribute('data-chip');
            const val = ch.getAttribute('data-value');
            let active = false;
            if (type === 'status') {
                const cur = this._filter?.status;
                active = Array.isArray(cur) ? cur.includes(val) : cur === val;
            }
            if (type === 'locked') active = (this._filter?.locked) === val;
            if (type === 'reset') active = (this._filter?.status) === 'all' && (this._filter?.locked) === 'all';
            ch.classList.toggle('active', !!active);
        });
    }
    
    createAdvancedTicketStats(stats) {
        return `
            <div class="ticket-stats-grid">
                <div class="stat-card">
                    <div class="stat-icon total">
                        <i class="fas fa-ticket-alt"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${stats.total}</div>
                        <div class="stat-label">Total</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon open">
                        <i class="fas fa-unlock"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${stats.open}</div>
                        <div class="stat-label">Abertos</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon claimed">
                        <i class="fas fa-hand-paper"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${stats.claimed}</div>
                        <div class="stat-label">Reclamados</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon closed">
                        <i class="fas fa-lock"></i>
                    </div>
                    <div class="stat-content">
                        <div class="stat-value">${stats.closed}</div>
                        <div class="stat-label">Fechados</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    createAdvancedTicketCard(ticket) {
        const statusClass = this.getTicketStatusClass(ticket.status);
        const statusIcon = this.getTicketStatusIcon(ticket.status);
        
        return `
            <div class="ticket-card advanced ${statusClass}" onclick="dashboard.openAdvancedTicketModal('${ticket.id}')">
                <div class="ticket-header">
                    <div class="ticket-id">#${ticket.id}</div>
                    <div class="ticket-badges-row">
                        <div class="ticket-status">
                            <i class="fas ${statusIcon}"></i>
                            ${this.formatTicketStatus(ticket.status)}
                        </div>
                        ${ticket.locked ? `<span class="ticket-locked"><i class="fas fa-lock"></i> Bloqueado</span>` : ''}
                    </div>
                </div>
                
                <div class="ticket-info">
                    <div class="ticket-category">
                        <i class="fas fa-tag"></i>
                        ${ticket.category || 'Geral'}
                    </div>
                    <div class="ticket-time">
                        <i class="fas fa-clock"></i>
                        ${ticket.timeAgo}
                    </div>
                </div>
                
                <div class="ticket-description">
                    ${ticket.description || 'Sem descrição'}
                </div>
                
                <div class="ticket-footer">
                    <div class="ticket-owner">
                        <img src="${ticket.ownerAvatar || '/default-avatar.svg'}" alt="Avatar" class="user-avatar-small">
                        <span>${ticket.ownerTag}</span>
                    </div>
                    ${ticket.claimedByTag ? `
                        <div class="ticket-claimed">
                            <img src="${ticket.claimedByAvatar || '/default-avatar.svg'}" alt="Avatar" class="user-avatar-small">
                            <span>Reclamado por ${ticket.claimedByTag}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="ticket-actions">
                    ${this.getAdvancedTicketActions(ticket)}
                    <a class="btn btn-sm btn-glass" href="/dashboard/ticket.html?guildId=${this.currentGuild}&ticketId=${ticket.id}" onclick="event.stopPropagation();">Ver</a>
                </div>
            </div>
        `;
    }
    
    getTicketStatusClass(status) {
        const classes = {
            'open': 'status-open',
            'claimed': 'status-claimed',
            'closed': 'status-closed',
            'pending': 'status-pending'
        };
        return classes[status] || 'status-unknown';
    }
    
    getTicketStatusIcon(status) {
        const icons = {
            'open': 'fa-unlock',
            'claimed': 'fa-hand-paper',
            'closed': 'fa-lock',
            'pending': 'fa-clock'
        };
        return icons[status] || 'fa-question';
    }
    
    formatTicketStatus(status) {
        const labels = {
            'open': 'Aberto',
            'claimed': 'Reclamado',
            'closed': 'Fechado',
            'pending': 'Pendente'
        };
        return labels[status] || status;
    }
    
    getAdvancedTicketActions(ticket) {
        let actions = [];
        
        if (ticket.status === 'open') {
            actions.push(`
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); dashboard.claimAdvancedTicket('${ticket.id}')">
                    <i class="fas fa-hand-paper"></i>
                    Reclamar
                </button>
            `);
        }
        
        if (['open', 'claimed'].includes(ticket.status)) {
            actions.push(`
                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); dashboard.closeAdvancedTicket('${ticket.id}')">
                    <i class="fas fa-times"></i>
                    Fechar
                </button>
            `);
        }
        
        if (ticket.status === 'closed') {
            actions.push(`
                <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); dashboard.reopenAdvancedTicket('${ticket.id}')">
                    <i class="fas fa-redo"></i>
                    Reabrir
                </button>
            `);
        }
        
        return actions.join('');
    }
    
    async openAdvancedTicketModal(ticketId) {
        try {
            const response = await fetch(`/api/guild/${this.currentGuild}/tickets/${ticketId}`);
            const data = await response.json();
            
            if (data.success) {
                this.showAdvancedTicketDetails(data.ticket);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes do ticket:', error);
            this.showError('Erro ao carregar detalhes do ticket');
        }
    }
    
    showAdvancedTicketDetails(ticket) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content ticket-modal">
                <div class="modal-header">
                    <h2>
                        <i class="fas fa-ticket-alt"></i>
                        Ticket #${ticket.id}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="ticket-details-grid">
                        <div class="ticket-info-panel">
                            <div class="info-card">
                                <h3>Informações do Ticket</h3>
                                <div class="info-grid">
                                    <div class="info-item">
                                        <label>Status</label>
                                        <span class="ticket-status ${this.getTicketStatusClass(ticket.status)}">
                                            <i class="fas ${this.getTicketStatusIcon(ticket.status)}"></i>
                                            ${this.formatTicketStatus(ticket.status)}
                                        </span>
                                    </div>
                                    <div class="info-item">
                                        <label>Bloqueado</label>
                                        <span>${ticket.locked ? 'Sim' : 'Não'}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Categoria</label>
                                        <span>${ticket.category || 'Geral'}</span>
                                    </div>
                                    <div class="info-item">
                                        <label>Criado por</label>
                                        <div class="user-info">
                                            <img src="${ticket.ownerAvatar || '/default-avatar.svg'}" alt="Avatar" class="user-avatar-small">
                                            <span>${ticket.ownerTag}</span>
                                        </div>
                                    </div>
                                    <div class="info-item">
                                        <label>Criado em</label>
                                        <span>${new Date(ticket.created_at).toLocaleString('pt-PT')}</span>
                                    </div>
                                    ${ticket.claimedByTag ? `
                                        <div class="info-item">
                                            <label>Reclamado por</label>
                                            <div class="user-info">
                                                <img src="${ticket.claimedByAvatar || '/default-avatar.svg'}" alt="Avatar" class="user-avatar-small">
                                                <span>${ticket.claimedByTag}</span>
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            
                            <div class="actions-card">
                                <h3>Ações</h3>
                                <div class="action-buttons">
                                    ${this.getModalAdvancedTicketActions(ticket)}
                                </div>
                            </div>
                        </div>
                        
                        <div class="ticket-messages-panel">
                            <div class="messages-card">
                                <h3>Histórico de Mensagens</h3>
                                <div class="messages-container">
                                    ${this.renderAdvancedTicketMessages(ticket.messages)}
                                </div>
                            </div>

                            <div class="logs-card">
                                <div class="logs-header">
                                    <h3>Histórico de Ações</h3>
                                    <div class="logs-toolbar">
                                        <label for="logs-limit">Limite</label>
                                        <select id="logs-limit">
                                            <option value="50">50</option>
                                            <option value="100">100</option>
                                            <option value="200" selected>200</option>
                                            <option value="500">500</option>
                                        </select>
                                        <button class="btn btn-glass btn-sm" id="logs-refresh"><i class="fas fa-sync"></i> Atualizar</button>
                                        <div class="flex-spacer"></div>
                                        <button class="btn btn-glass btn-sm" id="logs-show-more"><i class="fas fa-plus"></i> Mostrar mais</button>
                                        <button class="btn btn-glass btn-sm" id="logs-export-json"><i class="fas fa-file-code"></i> Export JSON</button>
                                        <button class="btn btn-glass btn-sm" id="logs-export-csv"><i class="fas fa-file-csv"></i> Export CSV</button>
                                    </div>
                                </div>
                                <div class="logs-container">
                                    <div class="loading"><div class="loading-spinner"></div> A carregar histórico...</div>
                                </div>
                            </div>
                            
                            <div class="add-note-card">
                                <h3>Adicionar Nota</h3>
                                <div class="note-form">
                                    <textarea id="ticketNote" placeholder="Adicionar uma nota interna..."></textarea>
                                    <button class="btn btn-primary" onclick="dashboard.addAdvancedTicketNote('${ticket.id}')">
                                        <i class="fas fa-plus"></i>
                                        Adicionar Nota
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        // Fetch logs asynchronously and wire toolbar
        const sel = document.querySelector('.modal-overlay #logs-limit');
        const refresh = document.querySelector('.modal-overlay #logs-refresh');
        const showMore = document.querySelector('.modal-overlay #logs-show-more');
        const btnJson = document.querySelector('.modal-overlay #logs-export-json');
        const btnCsv = document.querySelector('.modal-overlay #logs-export-csv');
        const getLimit = () => parseInt(sel?.value || '200', 10) || 200;
        this._logsPageState = this._logsPageState || {}; // { [ticketId]: { offset, limit, hasMore } }
        this._logsPageState[ticket.id] = { offset: 0, limit: getLimit(), hasMore: true };
        this.loadTicketLogs(ticket.id, getLimit(), 0, true).catch(console.error);
        refresh?.addEventListener('click', ()=> {
            this._logsPageState[ticket.id] = { offset: 0, limit: getLimit(), hasMore: true };
            this.loadTicketLogs(ticket.id, getLimit(), 0, true)
        });
        showMore?.addEventListener('click', ()=>{
            const st = this._logsPageState[ticket.id] || { offset: 0, limit: getLimit() };
            const nextOffset = (st.offset||0) + (st.limit||getLimit());
            this.loadTicketLogs(ticket.id, st.limit||getLimit(), nextOffset, false);
        });
        btnJson?.addEventListener('click', ()=> this.exportTicketLogsJSON(ticket.id));
        btnCsv?.addEventListener('click', ()=> this.exportTicketLogsCSV(ticket.id));
    }

    async loadTicketLogs(ticketId, limit=200, offset=0, replace=true){
        try {
            const res = await fetch(`/api/guild/${this.currentGuild}/tickets/${ticketId}/logs?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`);
            const data = await res.json();
            const box = document.querySelector('.modal-overlay .logs-container');
            if (!box) return;
            if (!data.success) {
                box.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> Erro a carregar logs</div>`;
                return;
            }
            this._ticketLogsCache = this._ticketLogsCache || {};
            const prev = replace ? [] : (this._ticketLogsCache[ticketId] || []);
            const combined = [...prev, ...(data.logs || [])];
            this._ticketLogsCache[ticketId] = combined;
            box.innerHTML = this.renderTicketLogs(combined);
            // update pager state
            const st = this._logsPageState?.[ticketId] || { offset: 0, limit };
            this._logsPageState[ticketId] = { ...st, offset, limit, hasMore: (data.logs||[]).length >= (st.limit||limit) };
        } catch (e) {
            const box = document.querySelector('.modal-overlay .logs-container');
            if (box) box.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> Erro a carregar logs</div>`;
        }
    }

    renderTicketLogs(logs){
        if (!logs.length) return '<div class="no-messages">Sem ações registadas</div>';
        const label = (a)=>({
            'claim':'Reclamado', 'release':'Libertado', 'finalize':'Finalizado', 'resolve':'Resolvido',
            'reopen':'Reaberto', 'lock':'Bloqueado', 'unlock':'Desbloqueado', 'priority':'Prioridade',
            'note':'Nota', 'member:add':'Membro adicionado', 'member:remove':'Membro removido', 'rename':'Renomeado'
        })[a] || a;
        return `
            <div class="timeline">
                ${logs.map(l=>`
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                            <div class="timeline-header">
                                <span class="tl-action">${label(l.action)}</span>
                                <span class="tl-time">${new Date(l.timestamp).toLocaleString('pt-PT')}</span>
                            </div>
                            <div class="tl-meta">
                                ${l.actorAvatar ? `<img src="${l.actorAvatar}" class="user-avatar-small"/>` : ''}
                                <span>${l.actorTag || (l.actor_id || '')}</span>
                            </div>
                            ${l.message ? `<div class="tl-msg">${this.escapeHtml(l.message)}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Export helpers
    async exportTicketLogsJSON(ticketId){
        // Prefer server-side export for large sets
        const a = document.createElement('a');
        a.href = `/api/guild/${this.currentGuild}/tickets/${ticketId}/logs/export?format=json&all=true&limit=1000`;
        a.download = `ticket-${ticketId}-logs.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    async exportTicketLogsCSV(ticketId){
        const a = document.createElement('a');
        a.href = `/api/guild/${this.currentGuild}/tickets/${ticketId}/logs/export?format=csv&all=true&limit=1000`;
        a.download = `ticket-${ticketId}-logs.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    async ensureLogs(ticketId){
        this._ticketLogsCache = this._ticketLogsCache || {};
        if (!this._ticketLogsCache[ticketId]) {
            await this.loadTicketLogs(ticketId, 200);
        }
        return this._ticketLogsCache[ticketId] || [];
    }
    
    getModalAdvancedTicketActions(ticket) {
        let actions = [];
        
        if (ticket.status === 'open') {
            actions.push(`
                <button class="btn btn-primary" onclick="dashboard.claimAdvancedTicket('${ticket.id}', true)">
                    <i class="fas fa-hand-paper"></i>
                    Reclamar Ticket
                </button>
            `);
        }
        
        if (['open', 'claimed'].includes(ticket.status)) {
            actions.push(`
                <button class="btn btn-danger" onclick="dashboard.closeAdvancedTicket('${ticket.id}', true)">
                    <i class="fas fa-times"></i>
                    Fechar Ticket
                </button>
            `);
        }
        
        if (ticket.status === 'closed') {
            actions.push(`
                <button class="btn btn-success" onclick="dashboard.reopenAdvancedTicket('${ticket.id}', true)">
                    <i class="fas fa-redo"></i>
                    Reabrir Ticket
                </button>
            `);
        }
        
        return actions.join('');
    }
    
    renderAdvancedTicketMessages(messages) {
        if (!messages || messages.length === 0) {
            return '<div class="no-messages">Nenhuma mensagem encontrada</div>';
        }
        
        return messages.map(msg => `
            <div class="message-item">
                <div class="message-header">
                    <img src="${msg.author.avatar || '/default-avatar.svg'}" alt="Avatar" class="user-avatar-small">
                    <span class="message-author">${msg.author.username}#${msg.author.discriminator}</span>
                    <span class="message-time">${new Date(msg.timestamp).toLocaleString('pt-PT')}</span>
                </div>
                <div class="message-content">${msg.content || '<em>Mensagem vazia</em>'}</div>
                ${msg.embeds.length > 0 ? `
                    <div class="message-embeds">
                        ${msg.embeds.map(embed => `
                            <div class="embed-item">
                                ${embed.title ? `<div class="embed-title">${embed.title}</div>` : ''}
                                ${embed.description ? `<div class="embed-description">${embed.description}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }
    
    async claimAdvancedTicket(ticketId, fromModal = false) {
        try {
            const response = await fetch(`/api/guild/${this.currentGuild}/tickets/${ticketId}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'claim' })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Ticket reclamado com sucesso!');
                if (fromModal) {
                    document.querySelector('.modal-overlay')?.remove();
                }
                await this.loadAdvancedTickets();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Erro ao reclamar ticket:', error);
            this.showError('Erro ao reclamar ticket: ' + error.message);
        }
    }
    
    async closeAdvancedTicket(ticketId, fromModal = false) {
        const reason = prompt('Motivo do fechamento (opcional):');
        
        try {
            const response = await fetch(`/api/guild/${this.currentGuild}/tickets/${ticketId}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    action: 'close',
                    data: { reason: reason || 'Fechado via dashboard' }
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Ticket fechado com sucesso!');
                if (fromModal) {
                    document.querySelector('.modal-overlay')?.remove();
                }
                await this.loadAdvancedTickets();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Erro ao fechar ticket:', error);
            this.showError('Erro ao fechar ticket: ' + error.message);
        }
    }
    
    async reopenAdvancedTicket(ticketId, fromModal = false) {
        try {
            const response = await fetch(`/api/guild/${this.currentGuild}/tickets/${ticketId}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'reopen' })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Ticket reaberto com sucesso!');
                if (fromModal) {
                    document.querySelector('.modal-overlay')?.remove();
                }
                await this.loadAdvancedTickets();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Erro ao reabrir ticket:', error);
            this.showError('Erro ao reabrir ticket: ' + error.message);
        }
    }
    
    async addAdvancedTicketNote(ticketId) {
        const noteContent = document.getElementById('ticketNote').value.trim();
        
        if (!noteContent) {
            this.showError('Por favor, digite uma nota');
            return;
        }
        
        try {
            const response = await fetch(`/api/guild/${this.currentGuild}/tickets/${ticketId}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    action: 'addNote',
                    data: { content: noteContent }
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Nota adicionada com sucesso!');
                document.getElementById('ticketNote').value = '';
                // Refresh ticket details
                this.openAdvancedTicketModal(ticketId);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Erro ao adicionar nota:', error);
            this.showError('Erro ao adicionar nota: ' + error.message);
        }
    }
    
    showTicketStatistics() {
        if (!this.currentGuild) {
            this.showError('Selecione um servidor primeiro');
            return;
        }
        
        // Carregar estatísticas reais do sistema de tickets
        this.loadAdvancedTickets().then(() => {
            this.showNotification('Estatísticas de tickets carregadas com sucesso!', 'success');
        }).catch(error => {
            console.error('Erro ao carregar estatísticas:', error);
            this.showError('Erro ao carregar estatísticas de tickets');
        });
    }
}

// --- Bootstrap and global navigation helpers ---
(function(){
    // Create a single instance and expose it
    const dash = new IGNISDashboard();
    window.dashboard = dash;

    function requireGuild(){
        const gid = dash?.currentGuild;
        if (!gid) {
            try { alert('Selecione um servidor primeiro'); } catch {}
            return null;
        }
        return gid;
    }

    // Tickets panel actions
    window.configureTickets = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/tickets-config.html?guildId=${encodeURIComponent(gid)}`;
    };
    window.viewTickets = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/tickets.html?guildId=${encodeURIComponent(gid)}`;
    };
    window.viewPanels = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/panels.html?guildId=${encodeURIComponent(gid)}`;
    };
    window.ticketStats = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/tickets.html?guildId=${encodeURIComponent(gid)}#stats`;
    };

    // Moderation and settings actions
    window.configureVerification = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/verification.html?guildId=${encodeURIComponent(gid)}`;
    };
    window.manageRoles = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/roles.html?guildId=${encodeURIComponent(gid)}`;
    };
    window.viewLogs = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/logs.html?guildId=${encodeURIComponent(gid)}`;
    };
    window.openModeration = function(){
        if (dash && typeof dash.openModeration === 'function') return dash.openModeration();
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/moderation.html?guildId=${encodeURIComponent(gid)}`;
    };
    window.botSettings = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/bot-settings.html?guildId=${encodeURIComponent(gid)}`;
    };
    window.openWebhooks = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/webhooks.html?guildId=${encodeURIComponent(gid)}`;
    };
    window.openConfigs = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/configs.html?guildId=${encodeURIComponent(gid)}`;
    };

    // Advanced tools
    window.serverDiagnostics = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/diagnostics.html?guildId=${encodeURIComponent(gid)}`;
    };
    window.backupData = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/diagnostics.html?guildId=${encodeURIComponent(gid)}#backup`;
    };
    window.botPerformance = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/performance.html?guildId=${encodeURIComponent(gid)}`;
    };
    window.customCommands = function(){
        const gid = requireGuild(); if (!gid) return;
        window.location.href = `/commands.html?guildId=${encodeURIComponent(gid)}`;
    };
})();

function viewTickets() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.loadAdvancedTickets();
}

function configureVerification() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/verification.html?guildId=${gid}`;
}

function manageTags() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/tags.html?guildId=${gid}`;
}

function manageRoles() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/roles.html?guildId=${gid}`;
}

function viewLogs() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/logs.html?guildId=${gid}`;
}

function openModeration() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/moderation.html?guildId=${gid}`;
}

function botSettings() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/bot-settings.html?guildId=${gid}`;
}

function serverDiagnostics() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/diagnostics.html?guildId=${gid}`;
}

function backupData() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/backup.html?guildId=${gid}`;
}

function botPerformance() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/performance.html?guildId=${gid}`;
}

function customCommands() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/commands.html?guildId=${gid}`;
}

function viewAllTickets() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    // Usar a função de tickets avançados já implementada
    dashboard.loadAdvancedTickets();
}

function viewPanels() {
    try {
        const guildId = (typeof dashboard !== 'undefined') ? dashboard.currentGuild : null;
        if (!guildId) return alert('Selecione um servidor primeiro.');
        window.location.href = `/panels.html?guildId=${encodeURIComponent(guildId)}`;
    } catch (e) {
        console.error(e);
        alert('Erro ao abrir gestão de painéis');
    }
}

function configureTickets() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/tickets-config.html?guildId=${gid}`;
}

// Additional CSS for notifications and ticket cards
const additionalStyles = `
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--glass-bg);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-md);
        padding: var(--space-lg);
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: var(--space-md);
        box-shadow: var(--glass-shadow);
        z-index: 10000;
        max-width: 400px;
        min-width: 250px;
    }
    
    .notification-error {
        border-left: 4px solid #EF4444;
    }
    
    .notification-success {
        border-left: 4px solid #10B981;
    }
    
    .notification-info {
        border-left: 4px solid var(--primary);
    }
    
    .no-servers, .no-tickets {
        padding: var(--space-2xl);
        text-align: center;
        color: var(--text-secondary);
    }
    
    .no-servers-content, .no-tickets-content {
        max-width: 400px;
        margin: 0 auto;
    }
    
    .no-servers-icon, .no-tickets-content i {
        font-size: 3rem;
        margin-bottom: var(--space-lg);
        opacity: 0.5;
        color: var(--primary);
    }
    
    .tickets-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-lg);
        padding-bottom: var(--space-md);
        border-bottom: 1px solid var(--glass-border);
    }
    
    .tickets-header h4 {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin: 0;
        color: var(--text-primary);
    }
    
    .ticket-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-md);
        padding: var(--space-lg);
        margin-bottom: var(--space-md);
        transition: all var(--transition-fast);
    }
    
    .ticket-card:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: var(--primary);
        transform: translateX(4px);
    }
    
    .ticket-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-md);
    }

    .ticket-badges-row {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }
    
    .ticket-info {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
    }
    
    .ticket-id {
        font-weight: 600;
        color: var(--primary);
    }
    
    .ticket-status {
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--radius-sm);
        font-size: 0.8rem;
        font-weight: 600;
        color: white;
        text-transform: uppercase;
    }

    .ticket-lock, .ticket-locked {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(239, 68, 68, 0.15);
        color: #FCA5A5;
        border: 1px solid rgba(239, 68, 68, 0.25);
    }
    
    .ticket-content h5 {
        margin: 0 0 var(--space-sm) 0;
        color: var(--text-primary);
    }
    
    .ticket-content p {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.9rem;
    }
    
    .ticket-meta {
        display: flex;
        gap: var(--space-lg);
        margin-top: var(--space-md);
        font-size: 0.8rem;
        color: var(--text-muted);
    }
    
    .ticket-meta span {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
    }
    
    .server-status.online {
        color: #10B981;
    }
    
    .server-status.offline {
        color: #EF4444;
    }
    
    .btn-sm {
        padding: var(--space-xs) var(--space-sm);
        font-size: 0.8rem;
    }

    .ticket-controls { margin: var(--space-md) 0 var(--space-lg) 0; }
    .controls-row { display:flex; gap: var(--space-md); flex-wrap: wrap; align-items: flex-end; }
    .control label { display:block; font-size:.85rem; color: var(--text-secondary); margin-bottom: 6px; }
    .control select { background: rgba(255,255,255,0.06); color: var(--text-primary); border:1px solid var(--glass-border); border-radius: 8px; padding: 8px 10px; min-width: 160px; }

    .logs-card { margin-top: var(--space-lg); }
    .logs-header { display:flex; align-items:center; justify-content: space-between; margin-bottom: var(--space-sm); }
    .logs-toolbar { display:flex; gap: 8px; align-items: center; }
    .logs-toolbar select { background: rgba(255,255,255,0.06); color: var(--text-primary); border:1px solid var(--glass-border); border-radius: 8px; padding: 6px 8px; }
    .flex-spacer { flex: 1 1 auto; }
    .timeline { position: relative; margin-left: 10px; }
    .timeline:before { content: ''; position: absolute; left: 8px; top: 0; bottom: 0; width: 2px; background: var(--glass-border); }
    .timeline-item { position: relative; padding-left: 24px; margin-bottom: 14px; }
    .timeline-dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: var(--primary); left: 4px; top: 8px; }
    .timeline-header { display:flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .tl-action { font-weight: 600; color: var(--text-primary); }
    .tl-time { font-size: .85rem; color: var(--text-muted); }
    .tl-meta { display:flex; align-items:center; gap: 8px; color: var(--text-secondary); margin-bottom: 4px; }
    .tl-msg { color: var(--text-primary); opacity:.9; }
    .loading { display:flex; align-items:center; gap:8px; color: var(--text-secondary); }
    .loading-spinner { width:14px; height:14px; border:2px solid var(--glass-border); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .chips-row { display:flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .chip { background: rgba(255,255,255,0.06); color: var(--text-primary); border:1px solid var(--glass-border); border-radius: 999px; padding: 6px 10px; cursor: pointer; }
    .chip.active { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.35); color: #BFDBFE; }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new IGNISDashboard();
});

// Global functions for ticket system
window.configureTickets = () => {
    if (!dashboard.currentGuild) {
        dashboard.showError('Selecione um servidor primeiro');
        return;
    }
    const gid = encodeURIComponent(dashboard.currentGuild);
    window.location.href = `/tickets-config.html?guildId=${gid}`;
};

window.viewTickets = () => {
    if (!dashboard.currentGuild) {
        dashboard.showError('Selecione um servidor primeiro');
        return;
    }
    dashboard.loadAdvancedTickets();
};

window.ticketStats = () => {
    if (!dashboard.currentGuild) {
        dashboard.showError('Selecione um servidor primeiro');
        return;
    }
    dashboard.showTicketStatistics();
};

window.openWebhooks = () => {
    if (!dashboard.currentGuild) {
        dashboard.showError('Selecione um servidor primeiro');
        return;
    }
    window.location.href = `/webhooks.html?guildId=${encodeURIComponent(dashboard.currentGuild)}`;
};

window.openConfigs = () => {
    if (!dashboard.currentGuild) {
        dashboard.showError('Selecione um servidor primeiro');
        return;
    }
    window.location.href = `/configs.html?guildId=${encodeURIComponent(dashboard.currentGuild)}`;
};

window.createPanelShortcut = () => {
    if (!dashboard.currentGuild) {
        dashboard.showError('Selecione um servidor primeiro');
        return;
    }
    window.location.href = `/panels.html?guildId=${encodeURIComponent(dashboard.currentGuild)}#create`;
};

// Open tickets list page
window.openTicketsList = () => {
    if (!dashboard.currentGuild) {
        dashboard.showError('Selecione um servidor primeiro');
        return;
    }
    window.location.href = `/tickets.html?guildId=${encodeURIComponent(dashboard.currentGuild)}`;
};

// Export for global access
window.IGNISDashboard = IGNISDashboard;
