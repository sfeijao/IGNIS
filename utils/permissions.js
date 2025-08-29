// utils/permissions.js - Sistema de verificação de permissões seguro
const config = require('./config');

/**
 * Verifica se um membro tem algum dos cargos especificados
 * @param {GuildMember} member - Membro do Discord
 * @param {string[]} roleIds - Array de IDs de cargos
 * @returns {boolean}
 */
function hasAnyRole(member, roleIds = []) {
    if (!member || !member.roles || !roleIds.length) return false;
    return roleIds.filter(id => id).some(id => member.roles.cache.has(id));
}

/**
 * Verifica se um membro tem cargo específico
 * @param {GuildMember} member - Membro do Discord
 * @param {string} roleId - ID do cargo
 * @returns {boolean}
 */
function hasRole(member, roleId) {
    if (!member || !member.roles || !roleId) return false;
    return member.roles.cache.has(roleId);
}

/**
 * Verifica se é owner/admin/staff
 * @param {GuildMember} member - Membro do Discord
 * @returns {boolean}
 */
function isStaff(member) {
    const staffRoles = [
        config.ROLES.OWNER,
        config.ROLES.ADMIN,
        config.ROLES.STAFF
    ].filter(Boolean);
    
    return hasAnyRole(member, staffRoles);
}

/**
 * Verifica se é admin ou owner
 * @param {GuildMember} member - Membro do Discord
 * @returns {boolean}
 */
function isAdmin(member) {
    const adminRoles = [
        config.ROLES.OWNER,
        config.ROLES.ADMIN
    ].filter(Boolean);
    
    return hasAnyRole(member, adminRoles);
}

/**
 * Verifica se é owner
 * @param {GuildMember} member - Membro do Discord
 * @returns {boolean}
 */
function isOwner(member) {
    return hasRole(member, config.ROLES.OWNER);
}

/**
 * Middleware para verificar permissão de staff
 * @param {Interaction} interaction - Interação do Discord
 * @returns {Promise<void>}
 * @throws {Error} NoPermission
 */
async function requireStaff(interaction) {
    if (!isStaff(interaction.member)) {
        await interaction.reply({
            content: '❌ Precisas de permissão de **Staff** para usar este comando.',
            ephemeral: true
        });
        throw new Error('NoPermission');
    }
}

/**
 * Middleware para verificar permissão de admin
 * @param {Interaction} interaction - Interação do Discord
 * @returns {Promise<void>}
 * @throws {Error} NoPermission
 */
async function requireAdmin(interaction) {
    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            content: '❌ Precisas de permissão de **Administrador** para usar este comando.',
            ephemeral: true
        });
        throw new Error('NoPermission');
    }
}

/**
 * Middleware para verificar permissão de owner
 * @param {Interaction} interaction - Interação do Discord
 * @returns {Promise<void>}
 * @throws {Error} NoPermission
 */
async function requireOwner(interaction) {
    if (!isOwner(interaction.member)) {
        await interaction.reply({
            content: '❌ Apenas o **Owner** do servidor pode usar este comando.',
            ephemeral: true
        });
        throw new Error('NoPermission');
    }
}

/**
 * Verifica permissões baseadas no tipo de cargo necessário
 * @param {string} role - Tipo de cargo ('STAFF', 'ADMIN', 'OWNER')
 * @returns {Function} Middleware function
 */
function requireRole(role) {
    switch (role.toUpperCase()) {
        case 'STAFF':
            return requireStaff;
        case 'ADMIN':
            return requireAdmin;
        case 'OWNER':
            return requireOwner;
        default:
            throw new Error(`Tipo de cargo inválido: ${role}`);
    }
}

/**
 * Middleware Express para verificar permissões em rotas web
 * @param {string} role - Tipo de cargo necessário
 * @returns {Function} Express middleware
 */
function requireWebRole(role) {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ 
                    error: 'Não autenticado',
                    message: 'Faça login com Discord para continuar' 
                });
            }

            // Verificar se o usuário tem o cargo no Discord
            // Aqui você pode fazer uma chamada à API do Discord ou verificar via bot
            // Por enquanto, assumindo que req.user tem as roles
            const userRoles = req.user.roles || [];
            
            let hasPermission = false;
            
            switch (role.toUpperCase()) {
                case 'STAFF':
                    hasPermission = userRoles.some(roleId => 
                        [config.ROLES.OWNER, config.ROLES.ADMIN, config.ROLES.STAFF].includes(roleId)
                    );
                    break;
                case 'ADMIN':
                    hasPermission = userRoles.some(roleId => 
                        [config.ROLES.OWNER, config.ROLES.ADMIN].includes(roleId)
                    );
                    break;
                case 'OWNER':
                    hasPermission = userRoles.includes(config.ROLES.OWNER);
                    break;
            }

            if (!hasPermission) {
                return res.status(403).json({ 
                    error: 'Permissão insuficiente',
                    message: `Precisas de permissão de ${role} para aceder a este recurso` 
                });
            }

            next();
        } catch (error) {
            const logger = require('./logger');
            logger.error('Erro na verificação de permissões:', { error });
            return res.status(500).json({ 
                error: 'Erro interno',
                message: 'Erro ao verificar permissões' 
            });
        }
    };
}

module.exports = {
    hasAnyRole,
    hasRole,
    isStaff,
    isAdmin,
    isOwner,
    requireStaff,
    requireAdmin,
    requireOwner,
    requireRole,
    requireWebRole
};
