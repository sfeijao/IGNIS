// YSNM Dashboard - Modern JavaScript
class YSNMDashboard {
    constructor() {
        this.currentGuild = null;
        this.user = null;
        this.guilds = [];
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Inicializando YSNM Dashboard...');
        
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
            const data = await response.json();
            
            if (data.success) {
                this.guilds = data.guilds || [];
                this.displayGuilds();
            } else {
                throw new Error('Erro ao carregar servidores');
            }
        } catch (error) {
            console.error('Erro ao carregar servidores:', error);
            this.showError('Erro ao carregar servidores');
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
                    <p>Você não tem acesso de administrador em nenhum servidor onde o YSNM Bot esteja instalado.</p>
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
            assigned: '#F59E0B',
            closed: '#6B7280'
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
                    <span class="ticket-status" style="background-color: ${statusColors[ticket.status]}">
                        ${ticket.status}
                    </span>
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
}

// Control panel functions
function configureTickets() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Configuração de tickets em desenvolvimento', 'info');
}

function viewTickets() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Visualização de tickets em desenvolvimento', 'info');
}

function ticketStats() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Estatísticas de tickets em desenvolvimento', 'info');
}

function configureVerification() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Configuração de verificação em desenvolvimento', 'info');
}

function manageTags() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Gestão de tags em desenvolvimento', 'info');
}

function viewLogs() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Visualização de logs em desenvolvimento', 'info');
}

function botSettings() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Configurações do bot em desenvolvimento', 'info');
}

function serverDiagnostics() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Diagnóstico do servidor em desenvolvimento', 'info');
}

function backupData() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Backup de dados em desenvolvimento', 'info');
}

function botPerformance() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Performance do bot em desenvolvimento', 'info');
}

function customCommands() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Comandos personalizados em desenvolvimento', 'info');
}

function viewAllTickets() {
    if (!dashboard.currentGuild) {
        dashboard.showError('Nenhum servidor selecionado');
        return;
    }
    
    dashboard.showNotification('Visualização completa de tickets em desenvolvimento', 'info');
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
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new YSNMDashboard();
});

// Export for global access
window.YSNMDashboard = YSNMDashboard;
