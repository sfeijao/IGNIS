const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-debug')
        .setDescription('Comando de teste para debugging'),

    async execute(interaction) {
        console.log(`🧪 Comando test-debug executado por ${interaction.user.tag}`);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🧪 Teste de Funcionamento')
            .setDescription('✅ O bot está funcionando corretamente!')
            .addFields(
                { name: '👤 Utilizador', value: interaction.user.tag, inline: true },
                { name: '🌐 Servidor', value: interaction.guild.name, inline: true },
                { name: '📅 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        console.log('✅ Resposta enviada com sucesso');
    },
};
