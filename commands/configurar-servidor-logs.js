const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-servidor-logs')
        .setDescription('Configura o servidor de logs para tickets arquivados (apenas para administradores)')
        .addStringOption(option =>
            option.setName('servidor-id')
                .setDescription('ID do servidor onde arquivar tickets')
                .setRequired(false)
        )
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal específico para logs (opcional)')
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
                    ephemeral: true
                });
            }

            const serverId = interaction.options.getString('servidor-id');
            const channel = interaction.options.getChannel('canal');
            const reset = interaction.options.getBoolean('resetar');

            // Carregar configuração atual
            const configPath = path.join(__dirname, '..', 'config.json');
            let config;
            
            try {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (error) {
                return await interaction.reply({
                    content: '❌ Erro ao carregar configuração.',
                    ephemeral: true
                });
            }

            // Inicializar ticketSystem se não existir
            if (!config.ticketSystem) {
                config.ticketSystem = {
                    logServerId: null,
                    logChannelId: null,
                    deleteInsteadOfArchive: true
                };
            }

            await interaction.deferReply({ ephemeral: true });

            // Se for para resetar
            if (reset === true) {
                config.ticketSystem.logServerId = null;
                config.ticketSystem.logChannelId = null;
                
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                
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
            if (channel) {
                if (channel.guildId !== serverId) {
                    return await interaction.editReply({
                        content: '❌ O canal especificado não pertence ao servidor de logs configurado.'
                    });
                }
                config.ticketSystem.logChannelId = channel.id;
            } else {
                config.ticketSystem.logChannelId = null; // Será criado automaticamente
            }

            // Salvar configuração
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            // Criar embed de confirmação
            const successEmbed = new EmbedBuilder()
                .setColor(0x4CAF50)
                .setTitle('✅ Servidor de Logs Configurado')
                .setDescription(`Tickets arquivados serão enviados para **${targetServer.name}**`)
                .addFields(
                    { name: '🖥️ Servidor', value: `${targetServer.name} (${serverId})`, inline: false },
                    { 
                        name: '📋 Canal', 
                        value: channel ? `${channel.name} (${channel.id})` : 'Será criado automaticamente: `📋-tickets-arquivados`', 
                        inline: false 
                    },
                    { name: '📋 Status', value: '✅ Ativo', inline: false },
                    { name: '⚙️ Comportamento', value: 'Ao fechar tickets:\n• **Sim** = Arquiva no servidor de logs\n• **Não** = Elimina permanentemente', inline: false }
                )
                .setFooter({ text: 'Sistema de Tickets YSNM - Configuração Aplicada' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            console.log(`⚙️ Servidor de logs configurado: ${targetServer.name} (${serverId}) por ${interaction.user.tag}`);

        } catch (error) {
            console.error('❌ Erro no comando configurar-servidor-logs:', error);
            
            const errorMessage = '❌ Erro ao configurar servidor de logs.';
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.editReply({ content: errorMessage });
            }
        }
    },
};
