const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs-sistema')
        .setDescription('🔍 Ver logs recentes do sistema (apenas administradores)')
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de logs para visualizar')
                .setRequired(false)
                .addChoices(
                    { name: '📊 Geral', value: 'general' },
                    { name: '⚠️ Erros', value: 'error' },
                    { name: '🎫 Tickets', value: 'tickets' },
                    { name: '💬 Comandos', value: 'commands' },
                    { name: '🔐 Autenticação', value: 'auth' },
                    { name: '💾 Base de Dados', value: 'database' }
                )
        )
        .addIntegerOption(option =>
            option.setName('linhas')
                .setDescription('Número de linhas para mostrar (max 50)')
                .setRequired(false)
                .setMinValue(5)
                .setMaxValue(50)
        )
        .addStringOption(option =>
            option.setName('buscar')
                .setDescription('Termo para buscar nos logs')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Verificar se é administrador
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.editReply({
                    content: '❌ Apenas administradores podem ver os logs do sistema!'
                });
            }

            const tipo = interaction.options.getString('tipo') || 'general';
            const linhas = interaction.options.getInteger('linhas') || 20;
            const buscar = interaction.options.getString('buscar');

            // Tentar importar o logger
            let logs = [];
            try {
                const logger = require('../utils/logger');
                
                if (buscar) {
                    logs = logger.searchLogs(tipo, buscar, linhas);
                } else {
                    logs = logger.getRecentLogs(tipo, linhas);
                }
            } catch (error) {
                // Fallback se o logger não existir
                console.log('Logger não encontrado, usando logs básicos');
                logs = [
                    { 
                        timestamp: new Date().toISOString(), 
                        level: 'INFO', 
                        message: 'Sistema de logs não configurado - usando fallback básico' 
                    }
                ];
            }

            if (logs.length === 0) {
                return await interaction.editReply({
                    content: `📋 Nenhum log encontrado para o tipo **${tipo}**${buscar ? ` com termo "${buscar}"` : ''}.`
                });
            }

            // Formatear logs para exibição
            const formatLog = (log) => {
                const time = new Date(log.timestamp).toLocaleString('pt-PT');
                const level = log.level || 'INFO';
                const message = log.message || 'Sem mensagem';
                
                const levelEmojis = {
                    'ERROR': '❌',
                    'WARN': '⚠️',
                    'INFO': 'ℹ️',
                    'DEBUG': '🔧',
                    'SUCCESS': '✅'
                };
                
                const emoji = levelEmojis[level.toUpperCase()] || 'ℹ️';
                return `${emoji} \`${time}\` **${level}**: ${message}`;
            };

            // Dividir logs em embeds (max 10 logs por embed devido ao limite de caracteres)
            const embedsToSend = [];
            const logsPerEmbed = 10;
            
            for (let i = 0; i < logs.length; i += logsPerEmbed) {
                const logBatch = logs.slice(i, i + logsPerEmbed);
                
                const embed = new EmbedBuilder()
                    .setColor('#9932CC')
                    .setTitle(`🔍 Logs do Sistema - ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`)
                    .setDescription(
                        buscar ? 
                        `**🔎 Busca:** "${buscar}"\n**📊 Resultados:** ${logs.length}\n**📋 Mostrando:** ${i + 1}-${Math.min(i + logsPerEmbed, logs.length)}` :
                        `**📊 Total:** ${logs.length} logs\n**📋 Mostrando:** ${i + 1}-${Math.min(i + logsPerEmbed, logs.length)} (últimos ${linhas})`
                    )
                    .addFields({
                        name: `📋 Logs ${i + 1}-${Math.min(i + logsPerEmbed, logs.length)}`,
                        value: logBatch.map(formatLog).join('\n\n').substring(0, 1000) + 
                               (logBatch.map(formatLog).join('\n\n').length > 1000 ? '\n...' : ''),
                        inline: false
                    })
                    .setFooter({ 
                        text: `Página ${Math.floor(i / logsPerEmbed) + 1}/${Math.ceil(logs.length / logsPerEmbed)} | Solicitado por ${interaction.user.tag}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                embedsToSend.push(embed);
            }

            // Enviar primeiro embed
            await interaction.editReply({ embeds: [embedsToSend[0]] });

            // Enviar embeds adicionais se houver
            for (let i = 1; i < embedsToSend.length && i < 3; i++) { // Limite de 3 embeds para não sobrecarregar
                await interaction.followUp({ embeds: [embedsToSend[i]], ephemeral: true });
            }

            if (embedsToSend.length > 3) {
                await interaction.followUp({ 
                    content: `⚠️ **Nota:** Apenas os primeiros 3 grupos de logs foram mostrados. Total de ${embedsToSend.length} grupos disponíveis.`, 
                    ephemeral: true 
                });
            }

        } catch (error) {
            console.error('Erro no comando logs-sistema:', error);
            await interaction.editReply({
                content: '❌ Erro ao buscar logs do sistema: ' + error.message
            });
        }
    }
};
