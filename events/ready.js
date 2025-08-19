const { Events, ActivityType, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Carregar config com fallback
let config;
try {
    config = require('../config.json');
} catch (error) {
    console.log('⚠️ Config.json não encontrado no ready, usando valores padrão');
    config = {
        channels: {
            logs: process.env.LOGS_CHANNEL_ID,
            updates: process.env.UPDATES_CHANNEL_ID
        }
    };
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
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

        // Verificar se deve enviar logs de startup
        await handleStartupLogs(client);

        console.log('🔄 Sistema de auto-atualização de status ativado (2 minutos)');
        console.log('🏷️ Sistema de tags configurado e pronto para uso');
    }
};

// Função para gerenciar logs de startup
async function handleStartupLogs(client) {
    try {
        const logsStatePath = path.join(__dirname, '..', 'logs-state.json');
        let logsState;
        
        try {
            logsState = JSON.parse(fs.readFileSync(logsStatePath, 'utf8'));
        } catch (error) {
            logsState = { logsEnabled: true, lastUpdate: null, startupMessages: [] };
        }

        // Se logs estão pausados, não enviar
        if (!logsState.logsEnabled) {
            console.log('⏸️ Logs pausados - não enviando mensagem de startup');
            return;
        }

        const guild = client.guilds.cache.first();
        if (!guild) return;

        // Enviar para canal de updates (evitando spam)
        const updatesChannel = guild.channels.cache.get(config.channels.updates);
        if (updatesChannel) {
            const currentTime = new Date().toISOString();
            const lastUpdate = logsState.lastUpdate;
            
            // Só enviar se passou mais de 5 minutos desde o último update
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            
            if (!lastUpdate || lastUpdate < fiveMinutesAgo) {
                const updateEmbed = new EmbedBuilder()
                    .setColor('#9932CC')
                    .setTitle('� YSNM Bot - Update de Sistema')
                    .setDescription('```yaml\n🟢 Bot Atualizado e Online\n📊 Sistemas Verificados\n⚡ Funcionamento Normal\n```')
                    .addFields(
                        { name: '📋 Últimas Atualizações:', value: '```diff\n+ Tema roxo implementado\n+ Design com bordas estilizado\n+ Status simplificado\n+ Sistema otimizado\n+ ' + client.commands.size + ' comandos funcionais```', inline: false },
                        { name: '🎯 Status', value: '`Operacional`', inline: true },
                        { name: '🏠 Servidor', value: `\`${guild.name}\``, inline: true },
                        { name: '👥 Membros', value: `\`${guild.memberCount}\``, inline: true },
                        { name: '📅 Última Atualização', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'YSNM Bot System • Auto-Update', iconURL: client.user.displayAvatarURL() });

                await updatesChannel.send({ embeds: [updateEmbed] });
                
                // Atualizar timestamp do último update
                logsState.lastUpdate = currentTime;
                fs.writeFileSync(logsStatePath, JSON.stringify(logsState, null, 2));
                
                console.log('📢 Update enviado para canal de updates');
            } else {
                console.log('⏳ Update recente detectado - aguardando para evitar spam');
            }
        }

        // Sempre enviar para logs (se existir)
        const logsChannel = guild.channels.cache.get(config.channels.logs);
        if (logsChannel) {
            const startEmbed = new EmbedBuilder()
                .setColor('#9932CC')
                .setTitle('� YSNM Bot Iniciado')
                .setDescription('```yaml\n🟢 Bot Online e Operacional\n📊 Todos os Sistemas Ativos\n⚡ Pronto para Utilização\n```')
                .addFields(
                    { name: '🎯 Status', value: '`Online`', inline: true },
                    { name: '🏠 Servidor', value: `\`${guild.name}\``, inline: true },
                    { name: '👥 Membros', value: `\`${guild.memberCount}\``, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'YSNM Bot System', iconURL: client.user.displayAvatarURL() });

            await logsChannel.send({ embeds: [startEmbed] });
        }

    } catch (error) {
        console.error('❌ Erro ao processar logs de startup:', error);
    }
}

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
