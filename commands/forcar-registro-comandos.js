const { SlashCommandBuilder } = require('discord.js');
const { REST, Routes } = require('discord.js');
const config = require('../utils/config');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forcar-registro-comandos')
        .setDescription('Força o re-registro de todos os comandos slash (apenas para administradores)'),

    async execute(interaction) {
        try {
            // Verificar se o usuário é administrador
            if (!interaction.member.permissions.has('Administrator')) {
                return await interaction.reply({
                    content: '❌ Apenas administradores podem forçar o registro de comandos.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            logger.info(`🔄 Forçando re-registro de comandos solicitado por ${interaction.user.tag}`);

            // Carregar todos os comandos
            const commands = [];
            const commandsPath = path.join(__dirname, '..');
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    const commandData = command.data.toJSON();
                    commands.push(commandData);
                    logger.info(`📝 Comando preparado: ${commandData.name}`);
                }
            }

            // Limpar comandos existentes primeiro
            const rest = new REST({ version: '10' }).setToken(config.DISCORD.TOKEN);
            
            logger.info('🧹 Limpando comandos existentes...');
            await rest.put(Routes.applicationCommands(config.DISCORD.CLIENT_ID), { body: [] });
            
            // Aguardar um pouco
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Re-registrar todos os comandos
            logger.info('📝 Re-registrando comandos...');
            await rest.put(Routes.applicationCommands(config.DISCORD.CLIENT_ID), { body: commands });

            await interaction.editReply({
                content: `✅ **Comandos re-registrados com sucesso!**\n\n` +
                        `📊 **Total de comandos**: ${commands.length}\n\n` +
                        `⏰ **Nota**: Pode levar até 1 hora para os comandos aparecerem em todos os servidores devido ao cache do Discord.\n\n` +
                        `🔄 **Para atualização imediata**: Saia e entre novamente no servidor ou reinicie o Discord.`,
            });

            logger.info(`✅ ${commands.length} comandos re-registrados com sucesso!`);

        } catch (error) {
            logger.error('❌ Erro ao forçar registro de comandos:', error);
            
            const errorMessage = `❌ Erro ao re-registrar comandos: ${error.message}`;
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.editReply({ content: errorMessage });
            }
        }
    },
};
