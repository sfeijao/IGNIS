const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Testa resposta do bot'),
    
    async execute(interaction) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🏓 Pong!')
                .setDescription(`Latência: \`${Date.now() - interaction.createdTimestamp}ms\`\nAPI: \`${Math.round(interaction.client.ws.ping)}ms\``)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            console.log(`✅ Ping executado por ${interaction.user.tag}`);
        } catch (error) {
            console.error('❌ Erro no comando ping:', error);
            await interaction.reply({ content: '❌ Erro interno!', ephemeral: true });
        }
    },
};
