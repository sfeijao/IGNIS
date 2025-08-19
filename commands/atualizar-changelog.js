const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('atualizar-changelog')
        .setDescription('Atualiza o changelog para o próximo deploy')
        .addStringOption(option =>
            option.setName('versao')
                .setDescription('Nova versão (ex: 1.0.1)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mudancas')
                .setDescription('Lista de mudanças separadas por vírgula')
                .setRequired(true)),
    
    async execute(interaction) {
        // Verificar se é o owner
        if (interaction.user.id !== '381762006329589760') {
            return interaction.reply({ 
                content: '❌ Apenas o owner pode usar este comando!', 
                ephemeral: true 
            });
        }

        const newVersion = interaction.options.getString('versao');
        const changes = interaction.options.getString('mudancas')
            .split(',')
            .map(change => change.trim());

        try {
            const changelogPath = path.join(__dirname, '..', 'changelog.json');
            let changelog;
            
            try {
                changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
            } catch (error) {
                changelog = { version: "1.0.0", lastDeployment: null, releases: [] };
            }

            // Criar novo release
            const newRelease = {
                version: newVersion,
                date: new Date().toISOString().split('T')[0],
                changes: changes
            };

            // Adicionar ao changelog
            changelog.releases.push(newRelease);
            changelog.version = newVersion;

            // Salvar arquivo
            fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2));

            const embed = new EmbedBuilder()
                .setColor('#9932CC')
                .setTitle('✅ Changelog Atualizado')
                .setDescription(`Versão **v${newVersion}** preparada para o próximo deploy!`)
                .addFields(
                    { name: '📋 Mudanças:', value: changes.map(change => `• ${change}`).join('\n'), inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'YSNM Bot System' });

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('❌ Erro ao atualizar changelog:', error);
            await interaction.reply({
                content: '❌ Erro ao atualizar o changelog!',
                ephemeral: true
            });
        }
    },
};
