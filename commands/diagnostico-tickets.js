const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const TicketPermissionManager = require('../utils/TicketPermissionManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('diagnostico-tickets')
        .setDescription('Mostra informações de diagnóstico do sistema de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const permissionManager = new TicketPermissionManager();
            
            // Auto-detectar cargos
            const detectedRoles = permissionManager.autoDetectStaffRoles(interaction.guild);
            const suggestions = await permissionManager.suggestStaffRoles(interaction.guild);
            const config = permissionManager.getConfig();

            // Criar embed de diagnóstico
            const embed = new EmbedBuilder()
                .setTitle('🔍 Diagnóstico do Sistema de Tickets')
                .setDescription('Informações sobre detecção automática de cargos de staff')
                .setColor(0x00ff00)
                .setTimestamp();

            // Cargos detectados por permissões
            const permissionRoles = detectedRoles.filter(r => r.reason === 'permissions');
            if (permissionRoles.length > 0) {
                embed.addFields({
                    name: '🛡️ Cargos Detectados por Permissões',
                    value: permissionRoles.map(role => 
                        `• **${role.name}** (${role.id})\n  Permissões: ${role.permissions.join(', ')}`
                    ).join('\n') || 'Nenhum',
                    inline: false
                });
            }

            // Cargos detectados por nome
            const nameRoles = detectedRoles.filter(r => r.reason === 'name');
            if (nameRoles.length > 0) {
                embed.addFields({
                    name: '📝 Cargos Detectados por Nome',
                    value: nameRoles.map(role => 
                        `• **${role.name}** (${role.id})\n  Padrão: ${role.matchedPattern}`
                    ).join('\n') || 'Nenhum',
                    inline: false
                });
            }

            // Cargos já configurados
            if (suggestions.alreadyConfigured.length > 0) {
                embed.addFields({
                    name: '✅ Cargos Já Configurados',
                    value: suggestions.alreadyConfigured.map(role => 
                        `• **${role.name}** (${role.id})`
                    ).join('\n'),
                    inline: false
                });
            }

            // Sugestões de novos cargos
            if (suggestions.suggestions.length > 0) {
                embed.addFields({
                    name: '💡 Sugestões de Configuração',
                    value: suggestions.suggestions.map(role => 
                        `• **${role.name}** (${role.id}) - ${role.reason}`
                    ).join('\n'),
                    inline: false
                });
            }

            // Estatísticas
            embed.addFields({
                name: '📊 Estatísticas',
                value: [
                    `• **Total detectado:** ${detectedRoles.length}`,
                    `• **Por permissões:** ${permissionRoles.length}`,
                    `• **Por nome:** ${nameRoles.length}`,
                    `• **Já configurados:** ${suggestions.alreadyConfigured.length}`,
                    `• **Sugestões:** ${suggestions.suggestions.length}`
                ].join('\n'),
                inline: false
            });

            // Configuração atual
            const currentConfig = [
                `• **Rate Limiting:** ${config.rateLimiting.enabled ? 'Ativo' : 'Inativo'}`,
                `• **Max por hora:** ${config.rateLimiting.maxTicketsPerHour}`,
                `• **Max por dia:** ${config.rateLimiting.maxTicketsPerDay}`,
                `• **Cooldown:** ${config.rateLimiting.cooldownMinutes} min`,
                `• **Categorias:** ${Object.keys(config.categories).length}`
            ].join('\n');

            embed.addFields({
                name: '⚙️ Configuração Atual',
                value: currentConfig,
                inline: false
            });

            // Botões de ação
            const actionText = suggestions.suggestions.length > 0 
                ? '\n\n💡 **Ação Recomendada:** Execute `/auto-configurar-tickets` para aplicar automaticamente os cargos detectados.'
                : '\n\n✅ **Status:** Todos os cargos de staff detectados já estão configurados.';

            embed.setFooter({ 
                text: 'Sistema de Auto-detecção de Cargos' + actionText
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erro no diagnóstico de tickets:', error);
            await interaction.editReply({
                content: '❌ Erro ao executar diagnóstico. Contacta um administrador.'
            });
        }
    }
};