const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('limpar-tickets-arquivados')
        .setDescription('Remove tickets arquivados antigos (apenas para administradores)')
        .addIntegerOption(option =>
            option.setName('dias')
                .setDescription('Remover tickets arquivados há mais de X dias (padrão: 30)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(365)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Verificar se o usuário é administrador
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: '❌ Apenas administradores podem usar este comando.',
                    ephemeral: true
                });
            }

            const days = interaction.options.getInteger('dias') || 30;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            await interaction.deferReply({ ephemeral: true });

            // Buscar categoria de tickets arquivados
            const archivedCategory = interaction.guild.channels.cache.find(
                channel => channel.type === 4 && channel.name.toLowerCase().includes('arquivados')
            );

            if (!archivedCategory) {
                return await interaction.editReply({
                    content: '❌ Categoria de tickets arquivados não encontrada.'
                });
            }

            // Buscar canais arquivados antigos
            const archivedChannels = archivedCategory.children.cache.filter(channel => {
                return channel.name.startsWith('arquivado-') && 
                       channel.createdAt < cutoffDate;
            });

            if (archivedChannels.size === 0) {
                return await interaction.editReply({
                    content: `✅ Não há tickets arquivados com mais de ${days} dias para remover.`
                });
            }

            // Criar embed de confirmação
            const confirmEmbed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle('⚠️ Confirmação de Limpeza')
                .setDescription(`Foram encontrados **${archivedChannels.size}** tickets arquivados com mais de ${days} dias.`)
                .addFields(
                    { name: '📁 Canais a remover', value: archivedChannels.map(c => `• ${c.name}`).slice(0, 10).join('\n') + (archivedChannels.size > 10 ? `\n• ... e mais ${archivedChannels.size - 10} canais` : ''), inline: false },
                    { name: '⚠️ Aviso', value: 'Esta ação é **irreversível**. Os canais serão permanentemente deletados.', inline: false }
                )
                .setFooter({ text: 'Sistema de Tickets YSNM - Limpeza' })
                .setTimestamp();

            await interaction.editReply({
                embeds: [confirmEmbed],
                content: `❓ Deseja realmente remover ${archivedChannels.size} tickets arquivados?\n\n**Digite "CONFIRMAR" para continuar ou "CANCELAR" para abortar.**`
            });

            // Aguardar confirmação do usuário
            const filter = (response) => response.author.id === interaction.user.id;
            
            try {
                const collected = await interaction.channel.awaitMessages({
                    filter,
                    max: 1,
                    time: 30000,
                    errors: ['time']
                });

                const response = collected.first().content.toUpperCase();

                if (response === 'CONFIRMAR') {
                    let deletedCount = 0;
                    let errors = 0;

                    const progressEmbed = new EmbedBuilder()
                        .setColor(0xFFEB3B)
                        .setTitle('🔄 Removendo Tickets Arquivados')
                        .setDescription('Processando...')
                        .setFooter({ text: 'Sistema de Tickets YSNM' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [progressEmbed], content: null });

                    // Deletar canais um por um
                    for (const channel of archivedChannels.values()) {
                        try {
                            await channel.delete('Limpeza automática de tickets arquivados');
                            deletedCount++;
                            
                            // Atualizar progresso a cada 5 deletions
                            if (deletedCount % 5 === 0) {
                                progressEmbed.setDescription(`Removidos: ${deletedCount}/${archivedChannels.size}`);
                                await interaction.editReply({ embeds: [progressEmbed] });
                            }
                        } catch (error) {
                            console.error(`Erro ao deletar canal ${channel.name}:`, error);
                            errors++;
                        }
                    }

                    // Resultado final
                    const resultEmbed = new EmbedBuilder()
                        .setColor(deletedCount > 0 ? 0x4CAF50 : 0xFF6B6B)
                        .setTitle('✅ Limpeza Concluída')
                        .addFields(
                            { name: '🗑️ Tickets Removidos', value: deletedCount.toString(), inline: true },
                            { name: '❌ Erros', value: errors.toString(), inline: true },
                            { name: '📅 Critério', value: `Mais de ${days} dias`, inline: true }
                        )
                        .setFooter({ text: 'Sistema de Tickets YSNM - Limpeza Concluída' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [resultEmbed] });

                } else if (response === 'CANCELAR') {
                    const cancelEmbed = new EmbedBuilder()
                        .setColor(0x9E9E9E)
                        .setTitle('❌ Operação Cancelada')
                        .setDescription('A limpeza de tickets arquivados foi cancelada.')
                        .setFooter({ text: 'Sistema de Tickets YSNM' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [cancelEmbed], content: null });
                } else {
                    await interaction.editReply({
                        content: '❌ Resposta inválida. Operação cancelada.'
                    });
                }

            } catch (timeoutError) {
                await interaction.editReply({
                    content: '⏰ Tempo esgotado. Operação cancelada.'
                });
            }

        } catch (error) {
            console.error('❌ Erro no comando limpar-tickets-arquivados:', error);
            
            const errorMessage = '❌ Erro ao executar comando de limpeza.';
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.editReply({ content: errorMessage });
            }
        }
    },
};
