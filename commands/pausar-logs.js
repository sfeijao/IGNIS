const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pausar-logs')
        .setDescription('Pausa ou despausa o envio de logs de startup do bot')
        .setDefaultMemberPermissions('0'),

    async execute(interaction) {
        // Verificar permissões (apenas owner)
        const isOwner = interaction.user.id === '381762006329589760';
        
        if (!isOwner) {
            return interaction.reply({ 
                content: '❌ Apenas o owner pode controlar os logs do bot!', 
                ephemeral: true 
            });
        }

        try {
            // Ler estado atual dos logs
            const logsStatePath = path.join(__dirname, '..', 'logs-state.json');
            let logsState;
            
            try {
                logsState = JSON.parse(fs.readFileSync(logsStatePath, 'utf8'));
            } catch (error) {
                logsState = { logsEnabled: true, lastUpdate: null, startupMessages: [] };
            }

            // Alternar estado
            logsState.logsEnabled = !logsState.logsEnabled;
            logsState.lastUpdate = new Date().toISOString();

            // Salvar novo estado
            fs.writeFileSync(logsStatePath, JSON.stringify(logsState, null, 2));

            const statusText = logsState.logsEnabled ? 'ativados' : 'pausados';
            const statusEmoji = logsState.logsEnabled ? '✅' : '⏸️';

            const embed = new EmbedBuilder()
                .setColor(logsState.logsEnabled ? '#00ff00' : '#ff9900')
                .setTitle(`${statusEmoji} Logs ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`)
                .setDescription(`Os logs de startup do bot foram **${statusText}**.\n\n` +
                    `**Estado atual:** ${logsState.logsEnabled ? 'Envio ativo' : 'Envio pausado'}\n` +
                    `**Alterado em:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                    `**Por:** ${interaction.user.tag}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            console.log(`🔧 Logs ${statusText} por ${interaction.user.tag}`);

        } catch (error) {
            console.error('❌ Erro ao alterar estado dos logs:', error);
            await interaction.reply({ 
                content: '❌ Erro ao alterar estado dos logs!', 
                ephemeral: true 
            });
        }
    },
};
