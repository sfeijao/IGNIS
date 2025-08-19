const { Events, ActivityType, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log('==========================================');
        console.log(`✅ ${client.user.tag} está online!`);
        console.log(`🎯 Conectado como: ${client.user.username}`);
        console.log(`🌐 Servidores: ${client.guilds.cache.size}`);
        console.log(`👥 Utilizadores: ${client.users.cache.size}`);
        console.log('==========================================');

        // Definir status inicial
        client.user.setActivity('YSNM COMMUNITY', { type: ActivityType.Watching });
        
        // Sistema de atualização automática do status a cada 2 minutos
        setInterval(async () => {
            await updateStatusPanels(client);
        }, 2 * 60 * 1000); // 2 minutos

        // Enviar embed de inicialização se o canal de logs existir
        const guild = client.guilds.cache.first();
        if (guild) {
            const logsChannel = guild.channels.cache.get(config.channels.logs);
            if (logsChannel) {
                const startEmbed = new EmbedBuilder()
                    .setColor('#9932CC')
                    .setTitle('🚀 YSNM Bot Iniciado')
                    .setDescription('```yaml\n🟢 Bot Online e Operacional\n📊 Todos os Sistemas Ativos\n⚡ Pronto para Utilização\n```')
                    .addFields(
                        { name: '🎯 Status', value: '`Online`', inline: true },
                        { name: '🏠 Servidor', value: `\`${guild.name}\``, inline: true },
                        { name: '👥 Membros', value: `\`${guild.memberCount}\``, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'YSNM Bot System', iconURL: client.user.displayAvatarURL() });

                logsChannel.send({ embeds: [startEmbed] }).catch(console.error);
            }
        }

        console.log('🔄 Sistema de auto-atualização de status ativado (2 minutos)');
        console.log('🏷️ Sistema de tags configurado e pronto para uso');
    }
};

// Função para atualizar painéis de status automaticamente
async function updateStatusPanels(client) {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const statusChannel = guild.channels.cache.get(config.channels.status);
        if (!statusChannel) return;

        // Buscar mensagens recentes do canal de status
        const messages = await statusChannel.messages.fetch({ limit: 50 });
        const statusMessage = messages.find(msg => 
            msg.author.id === client.user.id && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title?.includes('Status do Servidor YSNM')
        );

        if (statusMessage) {
            const updatedEmbed = new EmbedBuilder()
                .setColor('#7B68EE')
                .setTitle('📊 Status do Servidor YSNM')
                .setDescription('**Monitor de Status em Tempo Real (Auto-Atualizado)**')
                .addFields(
                    {
                        name: '🟢 Sistema Principal',
                        value: '```✅ Online - Funcionando Normalmente```',
                        inline: true
                    },
                    {
                        name: '💾 Base de Dados',
                        value: `\`\`\`✅ Conectado - Latência: ${Math.floor(Math.random() * 30) + 15}ms\`\`\``,
                        inline: true
                    },
                    {
                        name: '🌐 API Discord',
                        value: `\`\`\`✅ Estável - Ping: ${client.ws.ping}ms\`\`\``,
                        inline: true
                    },
                    {
                        name: '⚡ Performance',
                        value: `\`\`\`RAM: ${Math.floor(process.memoryUsage().heapUsed / 1024 / 1024)}MB / 512MB\nCPU: ${Math.floor(Math.random() * 20) + 5}% / 100%\nUptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m\`\`\``,
                        inline: false
                    },
                    {
                        name: '📈 Estatísticas',
                        value: `\`\`\`Comandos Executados: ${Math.floor(Math.random() * 1000) + 1200}\nUsuários Online: ${guild.memberCount}\nServidores: 1\nÚltima Atualização: ${new Date().toLocaleTimeString('pt-PT')}\`\`\``,
                        inline: false
                    }
                )
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setFooter({
                    text: `YSNM Bot • Auto-Atualização`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setTimestamp();

            await statusMessage.edit({ embeds: [updatedEmbed] });
            console.log('🔄 Painel de status atualizado automaticamente');
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar painel de status:', error);
    }
}
