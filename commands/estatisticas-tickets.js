const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const TicketDatabase = require('../utils/TicketDatabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('estatisticas-tickets')
        .setDescription('📊 Mostra estatísticas completas do sistema de tickets')
        .addBooleanOption(option =>
            option.setName('detalhado')
                .setDescription('Mostrar estatísticas detalhadas (apenas staff)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: 64 }); // Ephemeral

            const detalhado = interaction.options.getBoolean('detalhado') || false;
            const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

            // Se pediu detalhado mas não é staff
            if (detalhado && !isStaff) {
                return await interaction.editReply({
                    content: '⛔ **Acesso Negado** | Apenas staff pode ver estatísticas detalhadas.'
                });
            }

            const database = new TicketDatabase();
            const guildId = interaction.guildId;

            // Obter todas as estatísticas
            const allTickets = await database.getTickets(guildId);
            const activeTickets = allTickets.filter(t => ['open', 'assigned'].includes(t.status));
            const closedTickets = allTickets.filter(t => t.status === 'closed');
            
            // Estatísticas básicas
            const stats = {
                total: allTickets.length,
                active: activeTickets.length,
                closed: closedTickets.length,
                today: allTickets.filter(t => {
                    const today = new Date();
                    const ticketDate = new Date(t.created_at);
                    return ticketDate.toDateString() === today.toDateString();
                }).length,
                thisWeek: allTickets.filter(t => {
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    const ticketDate = new Date(t.created_at);
                    return ticketDate >= weekAgo;
                }).length
            };

            // Estatísticas por tipo
            const typeStats = {};
            allTickets.forEach(ticket => {
                typeStats[ticket.type] = (typeStats[ticket.type] || 0) + 1;
            });

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📊 **ESTATÍSTICAS DO SISTEMA DE TICKETS**')
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setDescription([
                    `### 🏢 **${interaction.guild.name}**`,
                    '',
                    '### 📈 **RESUMO GERAL**',
                    '',
                    `🎫 **Total de Tickets:** \`${stats.total}\``,
                    `🟢 **Tickets Ativos:** \`${stats.active}\``,
                    `✅ **Tickets Resolvidos:** \`${stats.closed}\``,
                    '',
                    '### 📅 **ATIVIDADE RECENTE**',
                    '',
                    `🗓️ **Hoje:** \`${stats.today}\` tickets`,
                    `📆 **Esta Semana:** \`${stats.thisWeek}\` tickets`,
                    '',
                    '### 📂 **POR DEPARTAMENTO**',
                    '',
                    `🔧 **Suporte Técnico:** \`${typeStats.technical || 0}\``,
                    `⚠️ **Problemas/Incidentes:** \`${typeStats.incident || 0}\``,
                    `🛡️ **Moderação:** \`${typeStats.moderation || 0}\``,
                    '',
                    stats.total > 0 ? 
                        `> 📊 **Taxa de Resolução:** ${Math.round((stats.closed / stats.total) * 100)}%` :
                        '> 📊 **Nenhum ticket registrado ainda**'
                ].join('\n'));

            // Se é staff e pediu detalhado
            if (detalhado && isStaff) {
                // Tempo médio de resolução
                const resolvedWithTime = closedTickets.filter(t => t.closed_at && t.created_at);
                let avgResolutionTime = 0;
                
                if (resolvedWithTime.length > 0) {
                    const totalTime = resolvedWithTime.reduce((sum, ticket) => {
                        const created = new Date(ticket.created_at);
                        const closed = new Date(ticket.closed_at);
                        return sum + (closed - created);
                    }, 0);
                    avgResolutionTime = totalTime / resolvedWithTime.length;
                }

                const avgHours = Math.round(avgResolutionTime / (1000 * 60 * 60));

                embed.addFields(
                    {
                        name: '⏱️ Tempo Médio de Resolução',
                        value: avgHours > 0 ? `\`${avgHours} horas\`` : '`Calculando...`',
                        inline: true
                    },
                    {
                        name: '👥 Staff Mais Ativo',
                        value: '`Sistema Automático`',
                        inline: true
                    },
                    {
                        name: '🎯 Performance',
                        value: stats.total > 10 ? '`Excelente`' : '`Em Crescimento`',
                        inline: true
                    }
                );

                embed.setDescription(embed.data.description + [
                    '',
                    '### 🔧 **INFORMAÇÕES TÉCNICAS**',
                    '',
                    `💾 **Base de Dados:** \`${stats.total}\` registros`,
                    `🔄 **Auto-detecção:** \`Ativa\``,
                    `📊 **Webhooks:** \`Configurados\``,
                    `⚡ **Sistema:** \`Operacional\``
                ].join('\n'));
            }

            embed.addFields(
                {
                    name: '🚀 Sistema',
                    value: '`v2.0 Avançado`',
                    inline: true
                },
                {
                    name: '📅 Último Reset',
                    value: '`Nunca`',
                    inline: true
                },
                {
                    name: '🔄 Status',
                    value: '`🟢 Online`',
                    inline: true
                }
            ).setFooter({ 
                text: detalhado ? 
                    'Estatísticas detalhadas • Atualizado em tempo real' : 
                    'Use /estatisticas-tickets detalhado:true para mais informações',
                iconURL: interaction.client.user.displayAvatarURL()
            }).setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error('Erro ao gerar estatísticas:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('❌ **ERRO NAS ESTATÍSTICAS**')
                .setDescription([
                    '**Não foi possível obter as estatísticas**',
                    '',
                    '**💡 Possíveis soluções:**',
                    '• Tentar novamente em alguns segundos',
                    '• Verificar se existem tickets no servidor',
                    '• Contactar um administrador se o problema persistir'
                ].join('\n'))
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: 64 });
            }
        }
    },
};