const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ajuda')
        .setDescription('Mostra este menu'),
    
    async execute(interaction) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#9932CC')
                .setTitle('🤖 IGNIS Bot - Comandos')
                .setDescription('Comandos disponíveis para o bot\n\n' +
                    '**Comandos Básicos:**\n' +
                    '`/ping` - Testa resposta do bot\n' +
                    '`/ajuda` - Mostra este menu\n' +
                    '`/info-servidor` - Informações do servidor\n\n' +
                    '**Comandos de Configuração (Admin apenas):**\n' +
                    '`/configurar-verificacao` - Configura o sistema de verificação\n' +
                    '`/configurar-tags` - Configura o sistema de tags\n' +
                    '`/configurar-status` - Configura mensagem de status\n\n' +
                    '**Sistema de Tags:**\n' +
                    '`/solicitar-tag` - Solicita uma tag especial\n' +
                    '`/dar-cargo` - Adiciona cargo a utilizador (Staff)\n' +
                    '`/remover-cargo` - Remove cargo de utilizador (Staff)\n\n' +
                    '**Funcionalidades Automáticas:**\n' +
                    '• Sistema de verificação com botão\n' +
                    '• Logs automáticos de verificação\n' +
                    '• Status em tempo real\n' +
                    '• Gestão de cargos por botões')
                .setTimestamp()
                .setFooter({ text: 'IGNIS Bot • IGNIS COMMUNITY' });

            await interaction.reply({ embeds: [embed] });
                const logger = require('../utils/logger');
                logger.info(`✅ Ajuda executada por ${interaction.user.tag}`, { userId: interaction.user.id });
        } catch (error) {
                const logger = require('../utils/logger');
                logger.error('❌ Erro no comando ajuda:', { error: error.message || error });
            await interaction.reply({ content: '❌ Erro interno!', ephemeral: true });
        }
    },
};
