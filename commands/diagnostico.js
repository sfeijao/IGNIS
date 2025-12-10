const logger = require('../utils/logger');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('diagnostico')
        .setDescription('Diagnóstico completo do bot'),

    async execute(interaction) {
        try {
            console.log('🩺 Iniciando diagnóstico...');

            // Resposta imediata
            await interaction.reply('🔄 Executando diagnóstico...');

            // Informações detalhadas
            const info = [
                `🤖 Bot: ${interaction.client.user.tag}`,
                `🆔 ID: ${interaction.client.user.id}`,
                `🏓 Ping: ${interaction.client.ws.ping}ms`,
                `🌐 Servidor: ${interaction.guild.name}`,
                `👤 Utilizador: ${interaction.user.tag}`,
                `📅 Hora: ${new Date().toLocaleString()}`,
                `💾 Comandos: ${interaction.client.commands.size}`,
                `🔧 Node: ${process.version}`,
                `⚡ Memória: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
            ].join('\n');

            // Webhooks carregados (tipos)
            let webhookInfo = '';
            try {
                const wm = interaction.client.webhooks;
                if (wm && typeof wm.getAllLoaded === 'function') {
                    const all = wm.getAllLoaded();
                    const lines = Object.entries(all).map(([gid, types]) => `• ${gid}${gid === interaction.guild.id ? ' (este servidor)' : ''}: ${types.join(', ') || '—'}`);
                    webhookInfo = lines.length ? `\n🔗 Webhooks carregados:\n${lines.join('\n')}` : '';
                }
            } catch (e) { logger.debug('Caught error:', e?.message || e); }

            // Roteamento efetivo (config)
            let routingInfo = '';
            try {
                const storage = require('../utils/storage');
                const cfg = await storage.getGuildConfig(interaction.guild.id);
                const routing = cfg?.webhookRouting || { create: 'tickets', close: 'tickets', update: 'updates', claim: 'updates' };
                routingInfo = `\n🧭 Routing: create→${routing.create}, close→${routing.close}, update→${routing.update}, claim→${routing.claim}`;
            } catch (e) { logger.debug('Caught error:', e?.message || e); }

            await interaction.editReply(`✅ **Diagnóstico Completo:**\n\`\`\`${info}\`\`\`${webhookInfo}${routingInfo}`);
            console.log('✅ Diagnóstico concluído');

        } catch (error) {
            logger.error('❌ Erro no diagnóstico:', error);
            try {
                await interaction.reply('❌ Erro no diagnóstico!');
            } catch (e) {
                logger.error('❌ Erro crítico:', e);
            }
        }
    },
};
