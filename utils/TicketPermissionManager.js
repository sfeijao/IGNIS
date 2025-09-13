const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class TicketPermissionManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', 'data', 'ticket-permissions.json');
        this.defaultConfig = {
            staffRoles: [],
            supportCategories: {},
            permissions: {
                // Quem pode criar tickets
                create: {
                    everyone: true,
                    roles: [],
                    users: []
                },
                // Quem pode atender/claim tickets
                claim: {
                    staffOnly: true,
                    roles: [],
                    users: []
                },
                // Quem pode fechar tickets
                close: {
                    staffAndOwner: true,
                    ownerOnly: false,
                    staffOnly: false,
                    roles: [],
                    users: []
                },
                // Quem pode ver tickets de outros
                viewOthers: {
                    staffOnly: true,
                    roles: [],
                    users: []
                },
                // Quem pode adicionar notas internas
                internalNotes: {
                    staffOnly: true,
                    roles: [],
                    users: []
                },
                // Quem pode escalar tickets
                escalate: {
                    staffOnly: true,
                    minimumStaffRole: null,
                    roles: [],
                    users: []
                },
                // Quem pode deletar tickets/canais
                delete: {
                    adminOnly: true,
                    roles: [],
                    users: []
                },
                // Quem pode gerenciar configurações
                manage: {
                    adminOnly: true,
                    roles: [],
                    users: []
                }
            },
            // Configuração de escalação por níveis
            escalation: {
                levels: [
                    {
                        id: 'supervisor',
                        name: 'Supervisor',
                        description: 'Supervisor de Suporte',
                        roleId: null,
                        canAssignTo: ['staff', 'supervisor'],
                        autoNotify: true
                    },
                    {
                        id: 'manager',
                        name: 'Manager',
                        description: 'Manager da Equipa',
                        roleId: null,
                        canAssignTo: ['staff', 'supervisor', 'manager'],
                        autoNotify: true
                    },
                    {
                        id: 'admin',
                        name: 'Administrador',
                        description: 'Administrador do Servidor',
                        roleId: null,
                        canAssignTo: ['all'],
                        autoNotify: true
                    }
                ]
            },
            // Configuração por categoria de tickets
            categories: {
                'suporte': {
                    name: 'Suporte Geral',
                    staffRoles: [],
                    allowedRoles: [], // Quem pode criar tickets desta categoria
                    maxTicketsPerUser: 3,
                    autoClose: {
                        enabled: false,
                        inactivityDays: 7
                    }
                },
                'bugs': {
                    name: 'Reportar Bugs',
                    staffRoles: [],
                    allowedRoles: [],
                    maxTicketsPerUser: 2,
                    autoClose: {
                        enabled: true,
                        inactivityDays: 3
                    }
                },
                'denuncias': {
                    name: 'Denúncias',
                    staffRoles: [],
                    allowedRoles: [],
                    maxTicketsPerUser: 5,
                    autoClose: {
                        enabled: false,
                        inactivityDays: 14
                    },
                    priority: 'high'
                }
            },
            // Rate limiting
            rateLimiting: {
                enabled: true,
                maxTicketsPerHour: 3,
                maxTicketsPerDay: 10,
                cooldownMinutes: 10
            }
        };
        
        this.cache = new Map(); // Cache de permissões
        this.config = { ...this.defaultConfig }; // Inicializar com configuração padrão
        this.loadConfig(); // Carregar configuração salva (assíncrono)
    }

    // Carregar configuração
    async loadConfig() {
        try {
            const exists = await fs.access(this.configPath).then(() => true).catch(() => false);
            
            if (!exists) {
                await this.saveConfig(this.defaultConfig);
                this.config = { ...this.defaultConfig };
            } else {
                const data = await fs.readFile(this.configPath, 'utf8');
                this.config = { ...this.defaultConfig, ...JSON.parse(data) };
            }
            
            logger.info('Configuração de permissões carregada');
        } catch (error) {
            logger.error('Erro ao carregar configuração de permissões:', error);
            this.config = { ...this.defaultConfig };
        }
    }

    // Guardar configuração
    async saveConfig(config = this.config) {
        try {
            const dir = path.dirname(this.configPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            logger.error('Erro ao guardar configuração de permissões:', error);
        }
    }

    // Verificar se utilizador pode criar tickets
    canCreateTicket(member, category = 'suporte') {
        // Garantir que a configuração está carregada
        if (!this.config) {
            this.config = { ...this.defaultConfig };
        }
        
        const cacheKey = `create:${member.id}:${category}`;
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // Cache 5 min
                return cached.result;
            }
        }

        let canCreate = false;

        // Verificar permissão geral
        if (this.config.permissions.create.everyone) {
            canCreate = true;
        }

        // Verificar roles específicas
        if (this.config.permissions.create.roles.length > 0) {
            canCreate = this.config.permissions.create.roles.some(roleId => 
                member.roles.cache.has(roleId)
            );
        }

        // Verificar utilizadores específicos
        if (this.config.permissions.create.users.includes(member.id)) {
            canCreate = true;
        }

        // Verificar categoria específica
        if (this.config.categories[category]) {
            const categoryConfig = this.config.categories[category];
            
            // Verificar roles permitidas na categoria
            if (categoryConfig.allowedRoles.length > 0) {
                canCreate = canCreate && categoryConfig.allowedRoles.some(roleId =>
                    member.roles.cache.has(roleId)
                );
            }
        }

        // Verificar se é staff (staff sempre pode)
        if (this.isStaff(member)) {
            canCreate = true;
        }

        // Cache resultado
        this.cache.set(cacheKey, {
            result: canCreate,
            timestamp: Date.now()
        });

        return canCreate;
    }

    // Verificar se utilizador pode atender tickets
    canClaimTicket(member, ticket = null) {
        const cacheKey = `claim:${member.id}`;
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
                return cached.result;
            }
        }

        let canClaim = false;

        // Verificar se é staff
        if (this.config.permissions.claim.staffOnly && this.isStaff(member)) {
            canClaim = true;
        }

        // Verificar roles específicas
        if (this.config.permissions.claim.roles.some(roleId => member.roles.cache.has(roleId))) {
            canClaim = true;
        }

        // Verificar utilizadores específicos
        if (this.config.permissions.claim.users.includes(member.id)) {
            canClaim = true;
        }

        // Verificar categoria específica do ticket
        if (ticket && this.config.categories[ticket.category]) {
            const categoryConfig = this.config.categories[ticket.category];
            
            if (categoryConfig.staffRoles.length > 0) {
                canClaim = categoryConfig.staffRoles.some(roleId =>
                    member.roles.cache.has(roleId)
                );
            }
        }

        // Cache resultado
        this.cache.set(cacheKey, {
            result: canClaim,
            timestamp: Date.now()
        });

        return canClaim;
    }

    // Verificar se utilizador pode fechar tickets
    canCloseTicket(member, ticket) {
        const isOwner = ticket.ownerId === member.id;
        const isStaff = this.isStaff(member);

        // Owner only
        if (this.config.permissions.close.ownerOnly) {
            return isOwner;
        }

        // Staff only
        if (this.config.permissions.close.staffOnly) {
            return isStaff;
        }

        // Staff and owner (padrão)
        if (this.config.permissions.close.staffAndOwner) {
            return isOwner || isStaff;
        }

        // Verificar roles específicas
        if (this.config.permissions.close.roles.some(roleId => member.roles.cache.has(roleId))) {
            return true;
        }

        // Verificar utilizadores específicos
        if (this.config.permissions.close.users.includes(member.id)) {
            return true;
        }

        return false;
    }

    // Verificar se utilizador pode ver tickets de outros
    canViewOthersTickets(member) {
        if (this.config.permissions.viewOthers.staffOnly && this.isStaff(member)) {
            return true;
        }

        if (this.config.permissions.viewOthers.roles.some(roleId => member.roles.cache.has(roleId))) {
            return true;
        }

        if (this.config.permissions.viewOthers.users.includes(member.id)) {
            return true;
        }

        return false;
    }

    // Verificar se utilizador pode adicionar notas internas
    canAddInternalNotes(member) {
        if (this.config.permissions.internalNotes.staffOnly && this.isStaff(member)) {
            return true;
        }

        if (this.config.permissions.internalNotes.roles.some(roleId => member.roles.cache.has(roleId))) {
            return true;
        }

        if (this.config.permissions.internalNotes.users.includes(member.id)) {
            return true;
        }

        return false;
    }

    // Verificar se utilizador pode escalar tickets
    canEscalateTicket(member, toLevel = null) {
        if (this.config.permissions.escalate.staffOnly && !this.isStaff(member)) {
            return false;
        }

        // Verificar nível mínimo de staff
        if (this.config.permissions.escalate.minimumStaffRole) {
            if (!member.roles.cache.has(this.config.permissions.escalate.minimumStaffRole)) {
                return false;
            }
        }

        // Verificar se pode escalar para o nível específico
        if (toLevel) {
            const escalationLevel = this.config.escalation.levels.find(l => l.id === toLevel);
            if (escalationLevel) {
                if (escalationLevel.canAssignTo.includes('all')) {
                    return true;
                }
                
                // Verificar se utilizador tem permissão para este nível
                return this.hasEscalationPermission(member, escalationLevel);
            }
        }

        return this.isStaff(member);
    }

    // Verificar se utilizador pode deletar tickets
    canDeleteTicket(member) {
        if (this.config.permissions.delete.adminOnly && this.isAdmin(member)) {
            return true;
        }

        if (this.config.permissions.delete.roles.some(roleId => member.roles.cache.has(roleId))) {
            return true;
        }

        if (this.config.permissions.delete.users.includes(member.id)) {
            return true;
        }

        return false;
    }

    // Verificar se utilizador pode gerenciar configurações
    canManageSettings(member) {
        if (this.config.permissions.manage.adminOnly && this.isAdmin(member)) {
            return true;
        }

        if (this.config.permissions.manage.roles.some(roleId => member.roles.cache.has(roleId))) {
            return true;
        }

        if (this.config.permissions.manage.users.includes(member.id)) {
            return true;
        }

        return false;
    }

    // Verificar se é staff (com auto-detecção)
    isStaff(member) {
        if (!member || !member.roles) return false;
        
        // Garantir que a configuração está carregada
        if (!this.config) {
            this.config = { ...this.defaultConfig };
        }
        
        // Verificar roles configuradas manualmente
        if (this.config.staffRoles && this.config.staffRoles.length > 0) {
            const hasConfiguredRole = this.config.staffRoles.some(roleId => 
                member.roles.cache.has(roleId)
            );
            if (hasConfiguredRole) return true;
        }

        // Auto-detecção por permissões (sempre ativo)
        if (member.permissions.has(PermissionFlagsBits.Administrator) ||
            member.permissions.has(PermissionFlagsBits.ManageChannels) ||
            member.permissions.has(PermissionFlagsBits.ManageGuild) ||
            member.permissions.has(PermissionFlagsBits.BanMembers) ||
            member.permissions.has(PermissionFlagsBits.KickMembers) ||
            member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return true;
        }

        // Auto-detecção por nomes de cargos
        return this.hasStaffRoleByName(member);
    }

    // Detectar cargos de staff por nome
    hasStaffRoleByName(member) {
        const staffRoleNames = [
            // Português
            'staff', 'moderador', 'mod', 'admin', 'administrador',
            'suporte', 'ajudante', 'helper', 'supervisor', 'gerente',
            'manager', 'coordenador', 'owner', 'dono', 'fundador',
            'desenvolvedor', 'dev', 'team', 'equipa', 'equipe',
            
            // Inglês
            'moderator', 'administrator', 'support', 'manager',
            'supervisor', 'coordinator', 'developer', 'founder',
            'officer', 'assistant', 'helper', 'crew',
            
            // Variações comuns
            'mod+', 'admin+', 'staff+', 'helper+', 'sup+',
            '🛡️', '⚔️', '👑', '🔨', '🛠️', // Emojis comuns
            
            // Hierarquias
            'head', 'chief', 'lead', 'senior', 'junior',
            'trial', 'trainee', 'intern'
        ];

        return member.roles.cache.some(role => {
            const roleName = role.name.toLowerCase()
                .replace(/\s+/g, '') // Remove espaços
                .replace(/[^\w]/g, ''); // Remove caracteres especiais
            
            return staffRoleNames.some(staffName => {
                const cleanStaffName = staffName.toLowerCase()
                    .replace(/\s+/g, '')
                    .replace(/[^\w]/g, '');
                
                return roleName.includes(cleanStaffName) || 
                       cleanStaffName.includes(roleName) ||
                       roleName === cleanStaffName;
            });
        });
    }

    // Verificar se é admin
    isAdmin(member) {
        if (!member || !member.roles) return false;
        
        return member.permissions.has(PermissionFlagsBits.Administrator) ||
               member.roles.cache.some(role => 
                   role.permissions.has(PermissionFlagsBits.Administrator)
               );
    }

    // Verificar permissão de escalação
    hasEscalationPermission(member, escalationLevel) {
        if (!escalationLevel.roleId) return true;
        
        return member.roles.cache.has(escalationLevel.roleId) ||
               this.isAdmin(member);
    }

    // Verificar rate limiting
    checkRateLimit(userId, category = 'suporte') {
        if (!this.config.rateLimiting.enabled) return { allowed: true };

        const now = Date.now();
        const userKey = `ratelimit:${userId}`;
        
        if (!this.cache.has(userKey)) {
            this.cache.set(userKey, {
                hourly: [],
                daily: [],
                lastTicket: 0
            });
        }

        const userLimits = this.cache.get(userKey);
        
        // Limpar entradas antigas
        const oneHourAgo = now - (60 * 60 * 1000);
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        userLimits.hourly = userLimits.hourly.filter(time => time > oneHourAgo);
        userLimits.daily = userLimits.daily.filter(time => time > oneDayAgo);

        // Verificar cooldown
        const cooldownMs = this.config.rateLimiting.cooldownMinutes * 60 * 1000;
        if (now - userLimits.lastTicket < cooldownMs) {
            const remainingMs = cooldownMs - (now - userLimits.lastTicket);
            return {
                allowed: false,
                reason: 'cooldown',
                remaining: Math.ceil(remainingMs / 1000)
            };
        }

        // Verificar limite por hora
        if (userLimits.hourly.length >= this.config.rateLimiting.maxTicketsPerHour) {
            return {
                allowed: false,
                reason: 'hourly_limit',
                remaining: Math.ceil((userLimits.hourly[0] + 60 * 60 * 1000 - now) / 1000)
            };
        }

        // Verificar limite por dia
        if (userLimits.daily.length >= this.config.rateLimiting.maxTicketsPerDay) {
            return {
                allowed: false,
                reason: 'daily_limit',
                remaining: Math.ceil((userLimits.daily[0] + 24 * 60 * 60 * 1000 - now) / 1000)
            };
        }

        return { allowed: true };
    }

    // Registrar criação de ticket para rate limiting
    recordTicketCreation(userId) {
        if (!this.config.rateLimiting.enabled) return;

        const now = Date.now();
        const userKey = `ratelimit:${userId}`;
        
        if (!this.cache.has(userKey)) {
            this.cache.set(userKey, {
                hourly: [],
                daily: [],
                lastTicket: 0
            });
        }

        const userLimits = this.cache.get(userKey);
        userLimits.hourly.push(now);
        userLimits.daily.push(now);
        userLimits.lastTicket = now;
    }

    // Configurar roles de staff
    async setStaffRoles(guildId, roleIds) {
        this.config.staffRoles = roleIds;
        await this.saveConfig();
        this.clearCache();
    }

    // Configurar categoria
    async setCategoryConfig(categoryId, config) {
        this.config.categories[categoryId] = {
            ...this.config.categories[categoryId],
            ...config
        };
        await this.saveConfig();
        this.clearCache();
    }

    // Configurar escalação
    async setEscalationLevel(levelId, config) {
        const levelIndex = this.config.escalation.levels.findIndex(l => l.id === levelId);
        
        if (levelIndex >= 0) {
            this.config.escalation.levels[levelIndex] = {
                ...this.config.escalation.levels[levelIndex],
                ...config
            };
        } else {
            this.config.escalation.levels.push({
                id: levelId,
                ...config
            });
        }
        
        await this.saveConfig();
        this.clearCache();
    }

    // Detectar automaticamente cargos de staff em um servidor
    autoDetectStaffRoles(guild) {
        const detectedRoles = [];
        
        guild.roles.cache.forEach(role => {
            // Verificar por permissões
            if (role.permissions.has(PermissionFlagsBits.Administrator) ||
                role.permissions.has(PermissionFlagsBits.ManageChannels) ||
                role.permissions.has(PermissionFlagsBits.ManageGuild) ||
                role.permissions.has(PermissionFlagsBits.BanMembers) ||
                role.permissions.has(PermissionFlagsBits.KickMembers) ||
                role.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                
                detectedRoles.push({
                    id: role.id,
                    name: role.name,
                    reason: 'permissions',
                    permissions: this.getRolePermissionsList(role)
                });
                return;
            }

            // Verificar por nome
            if (this.isStaffRoleName(role.name)) {
                detectedRoles.push({
                    id: role.id,
                    name: role.name,
                    reason: 'name',
                    matchedPattern: this.getMatchedStaffPattern(role.name)
                });
            }
        });

        return detectedRoles;
    }

    // Verificar se nome é de cargo de staff
    isStaffRoleName(roleName) {
        const staffRoleNames = [
            'staff', 'moderador', 'mod', 'admin', 'administrador',
            'suporte', 'ajudante', 'helper', 'supervisor', 'gerente',
            'manager', 'coordenador', 'owner', 'dono', 'fundador',
            'desenvolvedor', 'dev', 'team', 'equipa', 'equipe',
            'moderator', 'administrator', 'support', 'manager',
            'supervisor', 'coordinator', 'developer', 'founder',
            'officer', 'assistant', 'helper', 'crew'
        ];

        const cleanRoleName = roleName.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^\w]/g, '');

        return staffRoleNames.some(staffName => {
            const cleanStaffName = staffName.toLowerCase()
                .replace(/\s+/g, '')
                .replace(/[^\w]/g, '');
            
            return cleanRoleName.includes(cleanStaffName) || 
                   cleanStaffName.includes(cleanRoleName);
        });
    }

    // Obter padrão de staff que fez match
    getMatchedStaffPattern(roleName) {
        const staffPatterns = {
            'staff': ['staff', 'equipa', 'equipe', 'team'],
            'moderador': ['mod', 'moderador', 'moderator'],
            'admin': ['admin', 'administrador', 'administrator'],
            'suporte': ['suporte', 'support', 'helper', 'ajudante'],
            'manager': ['manager', 'gerente', 'supervisor'],
            'owner': ['owner', 'dono', 'fundador', 'founder']
        };

        const cleanRoleName = roleName.toLowerCase();
        
        for (const [category, patterns] of Object.entries(staffPatterns)) {
            if (patterns.some(pattern => cleanRoleName.includes(pattern))) {
                return category;
            }
        }
        
        return 'unknown';
    }

    // Obter lista de permissões de um cargo
    getRolePermissionsList(role) {
        const relevantPerms = [
            'Administrator',
            'ManageGuild', 
            'ManageChannels',
            'BanMembers',
            'KickMembers', 
            'ModerateMembers',
            'ManageMessages',
            'ManageRoles'
        ];

        return relevantPerms.filter(perm => 
            role.permissions.has(PermissionFlagsBits[perm])
        );
    }

    // Configurar automaticamente cargos de staff para um servidor
    async autoConfigureStaffRoles(guild) {
        // Garantir que a configuração está carregada
        if (!this.config) {
            this.config = { ...this.defaultConfig };
        }
        
        const detectedRoles = this.autoDetectStaffRoles(guild);
        const roleIds = detectedRoles.map(role => role.id);
        
        // Atualizar configuração
        if (!this.config.staffRoles) {
            this.config.staffRoles = [];
        }
        this.config.staffRoles = [...new Set([...this.config.staffRoles, ...roleIds])];
        await this.saveConfig();
        
        this.clearCache();
        
        return {
            detected: detectedRoles,
            configured: roleIds,
            total: this.config.staffRoles.length
        };
    }

    // Verificar e sugerir cargos de staff para configuração
    async suggestStaffRoles(guild) {
        const detected = this.autoDetectStaffRoles(guild);
        const current = this.config.staffRoles;
        
        const suggestions = detected.filter(role => !current.includes(role.id));
        const configured = detected.filter(role => current.includes(role.id));
        
        return {
            suggestions: suggestions,
            alreadyConfigured: configured,
            totalDetected: detected.length,
            needsConfiguration: suggestions.length > 0
        };
    }

    // Limpar cache
    clearCache() {
        this.cache.clear();
    }

    // Obter níveis de escalação disponíveis para utilizador
    getAvailableEscalationLevels(member) {
        return this.config.escalation.levels.filter(level => 
            this.hasEscalationPermission(member, level)
        );
    }

    // Verificar máximo de tickets por utilizador numa categoria
    checkMaxTicketsPerUser(userId, category, currentCount) {
        const categoryConfig = this.config.categories[category];
        if (!categoryConfig || !categoryConfig.maxTicketsPerUser) return true;
        
        return currentCount < categoryConfig.maxTicketsPerUser;
    }
}

module.exports = TicketPermissionManager;