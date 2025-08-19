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
        // Só enviar updates no Railway (ambiente de produção)
        const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
        if (!isRailway) {
            console.log('🔧 Ambiente local detectado - não enviando mensagem de update');
            return;
        }

        const logsStatePath = path.join(__dirname, '..', 'logs-state.json');
        const changelogPath = path.join(__dirname, '..', 'changelog.json');
        let logsState;
        let changelog;
        
        try {
            logsState = JSON.parse(fs.readFileSync(logsStatePath, 'utf8'));
        } catch (error) {
            logsState = { logsEnabled: true, lastUpdate: null, startupMessages: [] };
        }

        try {
            changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
        } catch (error) {
            changelog = { version: "1.0.0", lastDeployment: null, releases: [] };
        }

        // Se logs estão pausados, não enviar
        if (!logsState.logsEnabled) {
            console.log('⏸️ Logs pausados - não enviando mensagem de startup');
            return;
        }

        const guild = client.guilds.cache.first();
        if (!guild) return;

        // Verificar se é um novo deployment
        const currentDeployTime = new Date().toISOString();
        const isNewDeployment = !changelog.lastDeployment || 
                               new Date(currentDeployTime) - new Date(changelog.lastDeployment) > 60000; // 1 minuto

        // Enviar para canal de updates (só em novos deployments)
        const updatesChannel = guild.channels.cache.get(config.channels.updates);
        if (updatesChannel && isNewDeployment) {
            // Obter a versão mais recente do changelog
            const latestRelease = changelog.releases[changelog.releases.length - 1];
            
            if (latestRelease) {
                const changesText = latestRelease.changes
                    .map(change => `+ ${change}`)
                    .join('\n');

                const updateEmbed = new EmbedBuilder()
                    .setColor('#9932CC')
                    .setTitle('🚀 YSNM Bot - Deploy Realizado')
                    .setDescription('```yaml\n🟢 Nova Versão Implementada\n📊 Sistema Atualizado no Railway\n⚡ Funcionamento Otimizado\n```')
                    .addFields(
                        { name: `📋 Changelog v${latestRelease.version}:`, value: `\`\`\`diff\n${changesText}\`\`\``, inline: false },
                        { name: '🎯 Status', value: '`Operacional`', inline: true },
                        { name: '🏠 Servidor', value: `\`${guild.name}\``, inline: true },
                        { name: '👥 Membros', value: `\`${guild.memberCount}\``, inline: true },
                        { name: '📊 Versão', value: `\`v${latestRelease.version}\``, inline: true },
                        { name: '⚡ Comandos', value: `\`${client.commands.size}\``, inline: true },
                        { name: '📅 Deploy', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'YSNM Bot System • Railway Deploy', iconURL: client.user.displayAvatarURL() });

                await updatesChannel.send({ embeds: [updateEmbed] });
                
                // Atualizar timestamp do último deployment
                changelog.lastDeployment = currentDeployTime;
                fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2));
                
                console.log('🚀 Deploy notification enviado para canal de updates');
            }
        } else if (!isNewDeployment) {
            console.log('🔄 Restart detectado, não é um novo deployment - sem notificação');
        }

        // Sempre enviar para logs (se existir e no Railway)
        const logsChannel = guild.channels.cache.get(config.channels.logs);
        if (logsChannel) {
            const startEmbed = new EmbedBuilder()
                .setColor('#9932CC')
                .setTitle('🟢 YSNM Bot Iniciado')
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
        console.error('❌ Erro ao enviar logs de startup:', error);
    }
}

// Função para atualizar painéis de status (placeholder)
async function updateStatusPanels(client) {
    // Esta função pode ser expandida para atualizar painéis de status automaticamente
    // Por enquanto, apenas um placeholder
}
