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

            await interaction.editReply(`✅ **Diagnóstico Completo:**\n\`\`\`${info}\`\`\``);
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
