/**
 * Helper functions para gerenciar informações de usuários
 */

/**
 * Obtém o nome de exibição do usuário (nickname do servidor ou username)
 * @param {import('discord.js').User} user - Objeto do usuário
 * @param {import('discord.js').Guild} guild - Objeto do servidor (guild)
 * @returns {string} Nome de exibição do usuário
 */
function getUserDisplayName(user, guild) {
    if (!user) return 'Usuário Desconhecido';
    
    if (guild) {
        try {
            const member = guild.members.cache.get(user.id);
            if (member) {
                // Retorna nickname se existir, senão o username
                return member.displayName;
            }
        } catch (error) {
            // Se erro, usa fallback
        }
    }
    
    // Fallback para username#discriminator ou username
    return user.tag || user.username || 'Usuário Desconhecido';
}

/**
 * Obtém informações completas do usuário formatadas
 * @param {import('discord.js').User} user - Objeto do usuário
 * @param {import('discord.js').Guild} guild - Objeto do servidor (guild)
 * @returns {Object} Objeto com displayName, mention e tag
 */
function getUserInfo(user, guild) {
    if (!user) {
        return {
            displayName: 'Usuário Desconhecido',
            mention: '@Desconhecido',
            tag: 'Desconhecido#0000'
        };
    }
    
    return {
        displayName: getUserDisplayName(user, guild),
        mention: `<@${user.id}>`,
        tag: user.tag || user.username || 'Desconhecido'
    };
}

module.exports = {
    getUserDisplayName,
    getUserInfo
};