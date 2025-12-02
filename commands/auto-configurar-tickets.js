const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const TicketPermissionManager = require('../utils/TicketPermissionManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('auto-configurar-tickets')
        .setDescription('Configura automaticamente os cargos de staff para o sistema de tickets')
        .addBooleanOption(option =>
            option.setName('forcar')
                .setDescription('Forçar reconfiguração mesmo se já existirem cargos configurados')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const forcar = interaction.options.getBoolean('forcar') || false;
            const permissionManager = new TicketPermissionManager();
            
            // Verificar configuração atual
            const currentConfig = permissionManager.getConfig();
            
            if (currentConfig.staffRoles.length > 0 && !forcar) {
                const suggestions = await permissionManager.suggestStaffRoles(interaction.guild);
                
                if (suggestions.suggestions.length === 0) {
                    return await interaction.editReply({
                        content: '✅ **Sistema já configurado!**\n\n' +
                                `• **Cargos configurados:** ${suggestions.alreadyConfigured.length}\n` +
                                `• **Novos detectados:** ${suggestions.suggestions.length}\n\n` +
                                '💡 Use `forcar: True` se quiseres reconfigurar tudo novamente.'
                    });
                }
            }

            // Auto-configurar
            const result = await permissionManager.autoConfigureStaffRoles(interaction.guild);

            // Criar embed de resultado
            const embed = new EmbedBuilder()
                .setTitle('✅ Auto-configuração Concluída')
                .setDescription('Cargos de staff configurados automaticamente para o sistema de tickets')
                .setColor(0x00ff00)
                .setTimestamp();

            if (result.detected.length > 0) {
                // Separar por tipo de detecção
                const permissionRoles = result.detected.filter(r => r.reason === 'permissions');
                const nameRoles = result.detected.filter(r => r.reason === 'name');

                if (permissionRoles.length > 0) {
                    embed.addFields({
                        name: '🛡️ Configurados por Permissões',
                        value: permissionRoles.map(role => 
                            `• **${role.name}**\n  Permissões: ${role.permissions.join(', ')}`
                        ).join('\n'),
                        inline: false
                    });
                }

                if (nameRoles.length > 0) {
                    embed.addFields({
                        name: '📝 Configurados por Nome',
                        value: nameRoles.map(role => 
                            `• **${role.name}** (padrão: ${role.matchedPattern})`
                        ).join('\n'),
                        inline: false
                    });
                }
            }

            // Estatísticas
            embed.addFields({
                name: '📊 Resumo',
                value: [
                    `• **Total detectado:** ${result.detected.length}`,
                    `• **Total configurado:** ${result.configured.length}`,
                    `• **Cargos ativos:** ${result.total}`,
                    `• **Servidor:** ${interaction.guild.name}`
                ].join('\n'),
                inline: false
            });

            // Instruções
            let instructions = '**Próximos Passos:**\n';
            instructions += '• Use `/configurar-painel-tickets` para criar o painel\n';
            instructions += '• O sistema está pronto para usar! 🎫';

            embed.addFields({
                name: '📋 Instruções',
                value: instructions,
                inline: false
            });

            if (result.detected.length === 0) {
                embed.setColor(0xffaa00)
                    .setTitle('⚠️ Nenhum Cargo Detectado')
                    .setDescription('Não foram encontrados cargos de staff neste servidor.')
                    .addFields({
                        name: '💡 Sugestões',
                        value: [
                            '• Certifica-te que os cargos têm permissões adequadas',
                            '• Usa nomes comuns como "Staff", "Moderador", "Admin"',
                            '• Configura manualmente com `/configurar-painel-tickets`'
                        ].join('\n'),
                        inline: false
                    });
            }

            embed.setFooter({ 
                text: `Auto-configuração executada por ${interaction.user.tag}`
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Erro na auto-configuração:', error);
            await interaction.editReply({
                content: '❌ **Erro na Auto-configuração**\n\n' +
                        'Não foi possível configurar automaticamente os cargos de staff.\n' +
                        'Contacta um administrador ou configura manualmente.'
            });
        }
    }
};