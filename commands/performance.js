const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('performance')
        .setDescription('📊 Monitor de performance em tempo real (apenas administradores)')
        .addBooleanOption(option =>
            option.setName('detalhado')
                .setDescription('Mostrar informações detalhadas de performance')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Verificar se é administrador
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.editReply({
                    content: '❌ Apenas administradores podem ver a performance do sistema!'
                });
            }

            const detalhado = interaction.options.getBoolean('detalhado') || false;
            const client = interaction.client;

            // 🤖 Informações básicas do bot
            const uptime = process.uptime();
            const uptimeHours = Math.floor(uptime / 3600);
            const uptimeMinutes = Math.floor((uptime % 3600) / 60);
            const uptimeSeconds = Math.floor(uptime % 60);

            // 💾 Uso de memória
            const memoryUsage = process.memoryUsage();
            const memoryUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            const memoryTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
            const memoryRSS = Math.round(memoryUsage.rss / 1024 / 1024);

            // 🌐 Informações do sistema
            const totalMemory = Math.round(os.totalmem() / 1024 / 1024 / 1024);
            const freeMemory = Math.round(os.freemem() / 1024 / 1024 / 1024);
            const usedMemory = totalMemory - freeMemory;
            const memoryPercent = Math.round((usedMemory / totalMemory) * 100);

            // ⚡ CPU Load Average (apenas Unix-like systems)
            let cpuLoad = 'N/A';
            try {
                const loadAvg = os.loadavg();
                cpuLoad = `${loadAvg[0].toFixed(2)}, ${loadAvg[1].toFixed(2)}, ${loadAvg[2].toFixed(2)}`;
            } catch (error) {
                cpuLoad = 'Windows (não disponível)';
            }

            // 📊 Estatísticas do Discord
            const ping = client.ws.ping;
            const guilds = client.guilds.cache.size;
            const users = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
            const channels = client.channels.cache.size;

            // 🔥 Performance Status
            const getPerformanceStatus = () => {
                const issues = [];
                
                if (memoryUsed > 400) issues.push('🔴 Alto uso de memória');
                else if (memoryUsed > 200) issues.push('🟡 Uso moderado de memória');
                else issues.push('🟢 Uso normal de memória');

                if (ping > 500) issues.push('🔴 Latência alta');
                else if (ping > 200) issues.push('🟡 Latência moderada');
                else issues.push('🟢 Latência baixa');

                if (uptime < 300) issues.push('🟡 Bot recém iniciado');
                else issues.push('🟢 Bot estável');

                return issues;
            };

            const performanceStatus = getPerformanceStatus();

            // 📊 Embed principal
            const performanceEmbed = new EmbedBuilder()
                .setColor(memoryUsed > 300 ? '#FF6B6B' : ping > 300 ? '#FFE66D' : '#4ECDC4')
                .setTitle('📊 Monitor de Performance YSNM')
                .setDescription('**Status em tempo real do sistema**')
                .addFields(
                    {
                        name: '🤖 Bot Statistics',
                        value: `\`\`\`
Uptime: ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s
Ping: ${ping}ms
Servidores: ${guilds}
Usuários: ${users}
Canais: ${channels}
\`\`\``,
                        inline: true
                    },
                    {
                        name: '💾 Memória do Bot',
                        value: `\`\`\`
Usado: ${memoryUsed}MB
Total: ${memoryTotal}MB
RSS: ${memoryRSS}MB
Eficiência: ${Math.round((memoryUsed/memoryTotal)*100)}%
\`\`\``,
                        inline: true
                    },
                    {
                        name: '🖥️ Sistema',
                        value: `\`\`\`
RAM Total: ${totalMemory}GB
RAM Livre: ${freeMemory}GB
RAM Usada: ${usedMemory}GB (${memoryPercent}%)
CPU Load: ${cpuLoad}
\`\`\``,
                        inline: false
                    },
                    {
                        name: '🔥 Status de Performance',
                        value: performanceStatus.join('\n'),
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Monitoramento solicitado por ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            // Se detalhado, adicionar mais informações
            if (detalhado) {
                const detailedEmbed = new EmbedBuilder()
                    .setColor('#9932CC')
                    .setTitle('🔧 Informações Detalhadas do Sistema')
                    .addFields(
                        {
                            name: '🖥️ Sistema Operacional',
                            value: `\`\`\`
Plataforma: ${os.platform()}
Arquitetura: ${os.arch()}
Release: ${os.release()}
Hostname: ${os.hostname()}
\`\`\``,
                            inline: true
                        },
                        {
                            name: '⚙️ Node.js',
                            value: `\`\`\`
Versão: ${process.version}
PID: ${process.pid}
Plataforma: ${process.platform}
Arquitetura: ${process.arch}
\`\`\``,
                            inline: true
                        },
                        {
                            name: '🔧 CPU Information',
                            value: `\`\`\`
Modelo: ${os.cpus()[0].model.substring(0, 40)}...
Cores: ${os.cpus().length}
Velocidade: ${os.cpus()[0].speed}MHz
\`\`\``,
                            inline: false
                        },
                        {
                            name: '📊 Métricas Avançadas',
                            value: `\`\`\`
External Memory: ${Math.round(memoryUsage.external / 1024 / 1024)}MB
Array Buffers: ${Math.round(memoryUsage.arrayBuffers / 1024 / 1024)}MB
Network Interfaces: ${Object.keys(os.networkInterfaces()).length}
Uptime Sistema: ${Math.floor(os.uptime() / 3600)}h
\`\`\``,
                            inline: false
                        }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [performanceEmbed, detailedEmbed] });
            } else {
                await interaction.editReply({ embeds: [performanceEmbed] });
            }

            // Adicionar recomendações se necessário
            const recommendations = [];
            if (memoryUsed > 400) {
                recommendations.push('💡 **Recomendação:** Considere reiniciar o bot devido ao alto uso de memória');
            }
            if (ping > 500) {
                recommendations.push('💡 **Recomendação:** Verifique a conexão de internet - latência muito alta');
            }
            if (memoryPercent > 85) {
                recommendations.push('💡 **Recomendação:** Sistema com pouca memória livre disponível');
            }

            if (recommendations.length > 0) {
                await interaction.followUp({
                    content: '⚠️ **Alertas de Performance:**\n' + recommendations.join('\n'),
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Erro no comando performance:', error);
            await interaction.editReply({
                content: '❌ Erro ao obter informações de performance: ' + error.message
            });
        }
    }
};
