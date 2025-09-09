const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const storage = require('../utils/storage');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-servidor-logs')
        .setDescription('Configura o servidor de logs para tickets arquivados (apenas para administradores)')
        .addStringOption(option =>
            option.setName('servidor-id')
                .setDescription('ID do servidor onde arquivar tickets')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('canal-id')
                .setDescription('ID do canal específico para logs (opcional - será criado automaticamente se não fornecido)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('resetar')
                .setDescription('Resetar configuração (usar false para desativar servidor de logs)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Verificar se o usuário é administrador
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: '❌ Apenas administradores podem configurar o servidor de logs.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const serverId = interaction.options.getString('servidor-id');
            const channelId = interaction.options.getString('canal-id');
            const reset = interaction.options.getBoolean('resetar');

            // Se tem serverId, vamos verificar se o bot tem acesso ao servidor
            if (serverId) {
                const targetGuild = await interaction.client.guilds.fetch(serverId).catch(() => null);
                if (!targetGuild) {
                    return await interaction.reply({
                        content: '❌ Não foi possível encontrar o servidor com o ID fornecido. Verifique se o bot está presente no servidor.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                // Se tem channelId, vamos verificar se o canal existe no servidor de logs
                if (channelId) {
                    const targetChannel = await targetGuild.channels.fetch(channelId).catch(() => null);
                    if (!targetChannel) {
                        return await interaction.reply({
                            content: '❌ Não foi possível encontrar o canal com o ID fornecido no servidor de logs.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const webhookManager = interaction.client.webhooks;
                    if (!webhookManager) {
                        return await interaction.reply({
                            content: '❌ Sistema de webhooks não está inicializado.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const success = await webhookManager.verifyAndSetupWebhook(targetGuild, targetChannel);
                    if (!success) {
                        return await interaction.reply({
                            content: '❌ Não foi possível configurar o webhook no canal selecionado. Verifique se o bot tem permissões adequadas no servidor de logs.',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                } else {
                    // Se não tem canal específico, vamos configurar o webhook automaticamente depois
                    const webhookManager = interaction.client.webhooks;
                    if (!webhookManager) {
                        return await interaction.reply({
                            content: '❌ Sistema de webhooks não está inicializado.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // Tentar configurar webhook no canal de sistema ou criar um novo
                    const success = await webhookManager.verifyAndSetupWebhook(targetGuild, null);
                    if (!success) {
                        return await interaction.reply({
                            content: '❌ Não foi possível configurar o webhook no servidor de logs. Verifique se o bot tem permissões adequadas.',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Carregar configuração atual
            let config = await storage.getGuildConfig(interaction.guild.id);
            
            // Inicializar config se não existir
            if (!config) {
                const defaultConfig = {
                    ticketSystem: {
                        logServerId: null,
                        logChannelId: null,
                        deleteInsteadOfArchive: true
                    }
                };
                await storage.setGuildConfig(interaction.guild.id, defaultConfig);
                config = defaultConfig;
            }

            // Inicializar ticketSystem se não existir
            if (!config.ticketSystem) {
                config.ticketSystem = {
                    logServerId: null,
                    logChannelId: null,
                    deleteInsteadOfArchive: true
                };
                await storage.setGuildConfig(interaction.guild.id, config);
            }

            // Se for para resetar
            if (reset === true) {
                config.ticketSystem.logServerId = null;
                config.ticketSystem.logChannelId = null;
                
                await storage.setGuildConfig(interaction.guild.id, config);
                
                const resetEmbed = new EmbedBuilder()
                    .setColor(0x9E9E9E)
                    .setTitle('🔄 Configuração Resetada')
                    .setDescription('A configuração do servidor de logs foi resetada.')
                    .addFields(
                        { name: '📋 Status', value: 'Tickets serão arquivados localmente', inline: false }
                    )
                    .setFooter({ text: 'Sistema de Tickets YSNM - Configuração' })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [resetEmbed] });
            }

            // Se não foi fornecido servidor ID, mostrar configuração atual
            if (!serverId) {
                const currentConfig = config.ticketSystem;
                const logServer = currentConfig.logServerId ? 
                    interaction.client.guilds.cache.get(currentConfig.logServerId) : null;
                const logChannel = currentConfig.logChannelId ? 
                    interaction.client.channels.cache.get(currentConfig.logChannelId) : null;

                const statusEmbed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle('⚙️ Configuração Atual do Servidor de Logs')
                    .addFields(
                        { 
                            name: '🖥️ Servidor de Logs', 
                            value: logServer ? `${logServer.name} (${logServer.id})` : '❌ Não configurado', 
                            inline: false 
                        },
                        { 
                            name: '📋 Canal de Logs', 
                            value: logChannel ? `${logChannel.name} (${logChannel.id})` : '❌ Não configurado', 
                            inline: false 
                        },
                        { 
                            name: '📋 Status', 
                            value: currentConfig.logServerId ? '✅ Ativo' : '❌ Inativo (arquivo local)', 
                            inline: false 
                        }
                    )
                    .setFooter({ text: 'Use /configurar-servidor-logs servidor-id:<ID> para configurar' })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [statusEmbed] });
            }

            // Verificar se o servidor existe e o bot está nele
            const targetServer = interaction.client.guilds.cache.get(serverId);
            if (!targetServer) {
                return await interaction.editReply({
                    content: `❌ Servidor com ID \`${serverId}\` não encontrado ou o bot não está nele.`
                });
            }

            // Verificar se o bot tem permissões no servidor
            const botMember = targetServer.members.cache.get(interaction.client.user.id);
            if (!botMember || !botMember.permissions.has(['SendMessages', 'ManageChannels'])) {
                return await interaction.editReply({
                    content: `❌ O bot não tem permissões suficientes no servidor **${targetServer.name}**.`
                });
            }

            // Configurar servidor de logs
            config.ticketSystem.logServerId = serverId;
            
            // Se foi especificado um canal, usar esse canal
            if (channelId) {
                const targetChannel = await targetServer.channels.fetch(channelId).catch(() => null);
                if (!targetChannel) {
                    return await interaction.editReply({
                        content: '❌ Canal especificado não encontrado no servidor de logs.'
                    });
                }
                config.ticketSystem.logChannelId = channelId;
            } else {
                config.ticketSystem.logChannelId = null; // Será criado automaticamente
            }

            // Salvar configuração
            await storage.setGuildConfig(interaction.guild.id, config);

            // Criar embed de confirmação
            const successEmbed = new EmbedBuilder()
                .setColor(0x4CAF50)
                .setTitle('✅ Servidor de Logs Configurado')
                .setDescription(`Tickets arquivados serão enviados para **${targetServer.name}**`)
                .addFields(
                    { name: '🖥️ Servidor', value: `${targetServer.name} (${serverId})`, inline: false },
                    { 
                        name: '📋 Canal', 
                        value: channelId ? `<#${channelId}> (${channelId})` : 'Será criado automaticamente: `📋-tickets-arquivados`', 
                        inline: false 
                    },
                    { name: '📋 Status', value: '✅ Ativo', inline: false },
                    { name: '⚙️ Comportamento', value: 'Ao fechar tickets:\n• **Sim** = Arquiva no servidor de logs\n• **Não** = Elimina permanentemente', inline: false }
                )
                .setFooter({ text: 'Sistema de Tickets YSNM - Configuração Aplicada' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            logger.info(`⚙️ Servidor de logs configurado: ${targetServer.name} (${serverId}) por ${interaction.user.tag}`);

        } catch (error) {
            logger.error('❌ Erro no comando configurar-servidor-logs:', { 
                error: error.message, 
                stack: error.stack,
                guildId: interaction.guild?.id,
                userId: interaction.user?.id
            });
            
            const errorMessage = `❌ Erro ao configurar servidor de logs: ${error.message}`;
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.editReply({ content: errorMessage });
            }
        }
    },
};
