const { SlashCommandBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forcar-comandos-agressivo')
        .setDescription('Força o re-registro AGRESSIVO de comandos (limpa cache do Discord)')
        .setDefaultMemberPermissions('0'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Verificar se o usuário é administrador
            if (!interaction.member.permissions.has('Administrator')) {
                return await interaction.editReply({
                    content: '❌ Apenas administradores podem usar este comando.'
                });
            }

            logger.info(`🔥 FORÇANDO RE-REGISTRO AGRESSIVO solicitado por ${interaction.user.tag}`);

            const config = require('../utils/config');
            const rest = new REST({ version: '9' }).setToken(config.DISCORD.TOKEN);

            await interaction.editReply({ content: '🔄 **Passo 1/4:** Limpando comandos globais existentes...' });

            // PASSO 1: LIMPAR TODOS OS COMANDOS GLOBAIS
            try {
                await rest.put(Routes.applicationCommands(config.DISCORD.CLIENT_ID), { body: [] });
                logger.info('🗑️ Comandos globais limpos');
            } catch (error) {
                logger.error('Erro ao limpar comandos globais:', error);
            }

            await interaction.editReply({ content: '🔄 **Passo 2/4:** Limpando comandos de cada servidor...' });

            // PASSO 2: LIMPAR COMANDOS DE CADA SERVIDOR
            const guilds = ['1333820000791691284', '1283603691538088027', '1408278468822565075'];
            for (const guildId of guilds) {
                try {
                    await rest.put(Routes.applicationGuildCommands(config.DISCORD.CLIENT_ID, guildId), { body: [] });
                    logger.info(`🗑️ Comandos limpos do servidor ${guildId}`);
                } catch (error) {
                    logger.error(`Erro ao limpar comandos do servidor ${guildId}:`, error);
                }
            }

            await interaction.editReply({ content: '🔄 **Passo 3/4:** Aguardando cache do Discord (5 segundos)...' });
            await new Promise(resolve => setTimeout(resolve, 5000));

            await interaction.editReply({ content: '🔄 **Passo 4/4:** Re-registrando comandos globalmente...' });

            // PASSO 3: RE-REGISTRAR COMANDOS
            const fs = require('fs');
            const path = require('path');
            const commands = [];
            const commandsPath = path.join(__dirname);
            const commandFiles = fs.readdirSync(commandsPath).filter(file => 
                file.endsWith('.js') && 
                file !== 'forcar-comandos-agressivo.js' &&
                file !== 'forcar-registro-comandos.js'
            );

            for (const file of commandFiles) {
                try {
                    const filePath = path.join(commandsPath, file);
                    delete require.cache[require.resolve(filePath)];
                    const command = require(filePath);
                    
                    if (command.data && command.data.name) {
                        commands.push(command.data.toJSON());
                        logger.info(`✅ Comando preparado: ${command.data.name}`);
                    }
                } catch (error) {
                    logger.error(`Erro ao carregar comando ${file}:`, error);
                }
            }

            // REGISTRAR GLOBALMENTE
            await rest.put(Routes.applicationCommands(config.DISCORD.CLIENT_ID), { body: commands });
            logger.info(`🌍 ${commands.length} comandos re-registrados GLOBALMENTE`);

            // REGISTRAR EM CADA SERVIDOR TAMBÉM (redundância)
            for (const guildId of guilds) {
                try {
                    await rest.put(Routes.applicationGuildCommands(config.DISCORD.CLIENT_ID, guildId), { body: commands });
                    logger.info(`🏠 ${commands.length} comandos registrados no servidor ${guildId}`);
                } catch (error) {
                    logger.error(`Erro ao registrar no servidor ${guildId}:`, error);
                }
            }

            await interaction.editReply({ 
                content: `✅ **RE-REGISTRO AGRESSIVO CONCLUÍDO!**\n\n` +
                        `🧹 **Limpeza:** Comandos antigos removidos\n` +
                        `🌍 **Global:** ${commands.length} comandos registrados\n` +
                        `🏠 **Servidores:** Registrados em todos os 3 servidores\n\n` +
                        `⏰ **Aguarde:** Comandos aparecerão em 1-5 minutos`
            });

        } catch (error) {
            logger.error('❌ Erro no re-registro agressivo:', error);
            await interaction.editReply({ content: `❌ Erro: ${error.message}` });
        }
    },
};