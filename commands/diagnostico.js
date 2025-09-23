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
            } catch {}

            await interaction.editReply(`✅ **Diagnóstico Completo:**\n\`\`\`${info}\`\`\`${webhookInfo}`);
            console.log('✅ Diagnóstico concluído');
            
        } catch (error) {
            console.error('❌ Erro no diagnóstico:', error);
            try {
                await interaction.reply('❌ Erro no diagnóstico!');
            } catch (e) {
                console.error('❌ Erro crítico:', e);
            }
        }
    },
};
