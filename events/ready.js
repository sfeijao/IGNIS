const { Events, ActivityType } = require('discord.js');
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
        
        // Enviar embed de inicialização se o canal de logs existir
        const guild = client.guilds.cache.first();
        if (guild) {
            const logsChannel = guild.channels.cache.get(config.channels.logs);
            if (logsChannel) {
                const startEmbed = {
                    color: 0x9932CC,
                    title: '� YSNM Bot Iniciado',
                    description: '```yaml\n🟢 Bot Online e Operacional\n📊 Todos os Sistemas Ativos\n⚡ Pronto para Utilização\n```',
                    fields: [
                        { name: '🎯 Status', value: '`Online`', inline: true },
                        { name: '🏠 Servidor', value: `\`${guild.name}\``, inline: true },
                        { name: '👥 Membros', value: `\`${guild.memberCount}\``, inline: true }
                    ],
                    timestamp: new Date(),
                    footer: { 
                        text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
                    }
                };
                
                logsChannel.send({ embeds: [startEmbed] }).catch(console.error);
            }

            // Enviar mensagem resumida de atualizações
            const updatesChannel = guild.channels.cache.get(config.channels.updates);
            if (updatesChannel) {
                const updateEmbed = {
                    color: 0x8B5FBF,
                    title: '🔄 YSNM Bot Reiniciado',
                    description: '```yaml\n📋 Últimas Atualizações:\n✅ Tema roxo implementado\n🎨 Design com bordas estilizado\n📝 Status simplificado\n⚡ Sistema otimizado\n🤖 9 comandos funcionais\n```',
                    timestamp: new Date(),
                    footer: { 
                        text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
                    }
                };
                
                updatesChannel.send({ embeds: [updateEmbed] }).catch(console.error);
            }
        }
    },
};
