const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const storage = require('../utils/storage');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-logs-organizados')
        .setDescription('Configura logs usando canais e categorias existentes (sistema organizado)')
        .addStringOption(option =>
            option.setName('servidor-origem')
                .setDescription('Qual servidor será monitorado (YSNM ou BEANNY)')
                .setRequired(true)
                .addChoices(
                    { name: 'YSNM', value: 'ysnm' },
                    { name: 'BEANNY', value: 'beanny' }
                )
        )
        .addStringOption(option =>
            option.setName('acao')
                .setDescription('O que você quer fazer')
                .setRequired(false)
                .addChoices(
                    { name: 'Configurar', value: 'config' },
                    { name: 'Listar Canais Disponíveis', value: 'list' },
                    { name: 'Ver Status Atual', value: 'status' },
                    { name: 'Resetar', value: 'reset' }
                )
        ),

    async execute(interaction) {
        try {
            // Verificar se é administrador
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: '❌ Apenas administradores podem configurar logs.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const servidorOrigem = interaction.options.getString('servidor-origem');
            const acao = interaction.options.getString('acao') || 'config';

            // Mapear servidores
            const servidorMap = {
                'ysnm': '1333820000791691284', // YSNM COMMUNITY
                'beanny': '1283603691538088027'  // BEANNY
            };

            const logServerId = '1408278468822565075'; // Servidor LOGS
            const logServer = await interaction.client.guilds.fetch(logServerId);

            if (!logServer) {
                return await interaction.editReply({
                    content: '❌ Servidor LOGS não encontrado!'
                });
            }

            switch (acao) {
                case 'list':
                    await this.listarCanaisDisponiveis(interaction, logServer, servidorOrigem);
                    break;
                    
                case 'status':
                    await this.mostrarStatus(interaction, servidorOrigem);
                    break;
                    
                case 'reset':
                    await this.resetarConfiguracao(interaction, servidorOrigem);
                    break;
                    
                case 'config':
                default:
                    await this.configurarLogs(interaction, logServer, servidorOrigem, servidorMap[servidorOrigem]);
                    break;
            }

        } catch (error) {
            logger.error('❌ Erro no comando configurar-logs-organizados:', error);
            
            const errorMessage = `❌ Erro: ${error.message}`;
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.editReply({ content: errorMessage });
            }
        }
    },

    async listarCanaisDisponiveis(interaction, logServer, servidorOrigem) {
        // Buscar categorias relevantes
        const categorias = logServer.channels.cache.filter(c => 
            c.type === 4 && // Category type
            (c.name.toUpperCase().includes(servidorOrigem.toUpperCase()) || 
             c.name.toUpperCase().includes('LOG'))
        );

        if (categorias.size === 0) {
            return await interaction.editReply({
                content: '❌ Nenhuma categoria relevante encontrada no servidor LOGS.'
            });
        }

        let description = `📋 **Canais disponíveis para logs do servidor ${servidorOrigem.toUpperCase()}:**\n\n`;

        categorias.forEach(categoria => {
            description += `📁 **${categoria.name}**\n`;
            
            const canaisNaCategoria = logServer.channels.cache.filter(c => 
                c.type === 0 && // Text channel
                c.parentId === categoria.id
            );

            if (canaisNaCategoria.size > 0) {
                canaisNaCategoria.forEach(canal => {
                    description += `   └ 📋 ${canal.name} (ID: \`${canal.id}\`)\n`;
                });
            } else {
                description += `   └ ❌ Nenhum canal de texto nesta categoria\n`;
            }
            description += '\n';
        });

        description += `\n💡 **Para configurar:**\n\`/configurar-logs-organizados servidor-origem:${servidorOrigem} acao:config\``;

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🏗️ Canais Disponíveis para Logs')
            .setDescription(description)
            .setFooter({ text: 'Use os IDs dos canais para configuração manual' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async mostrarStatus(interaction, servidorOrigem) {
        const config = await storage.getGuildConfig(interaction.guild.id);
        const logsConfig = config?.logsOrganizados?.[servidorOrigem];

        const embed = new EmbedBuilder()
            .setColor(logsConfig ? 0x4CAF50 : 0xF44336)
            .setTitle(`📊 Status dos Logs - ${servidorOrigem.toUpperCase()}`)
            .addFields(
                { 
                    name: '⚙️ Status', 
                    value: logsConfig ? '✅ Configurado' : '❌ Não configurado', 
                    inline: true 
                },
                { 
                    name: '📋 Canal', 
                    value: logsConfig?.canalId ? `<#${logsConfig.canalId}>` : '❌ Não definido', 
                    inline: true 
                },
                { 
                    name: '🔗 Webhook', 
                    value: logsConfig?.webhookUrl ? '✅ Configurado' : '❌ Não definido', 
                    inline: true 
                }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async resetarConfiguracao(interaction, servidorOrigem) {
        const config = await storage.getGuildConfig(interaction.guild.id) || {};
        
        if (!config.logsOrganizados) config.logsOrganizados = {};
        delete config.logsOrganizados[servidorOrigem];

        await storage.setGuildConfig(interaction.guild.id, config);

        const embed = new EmbedBuilder()
            .setColor(0xFF9800)
            .setTitle('🔄 Configuração Resetada')
            .setDescription(`Configuração de logs para **${servidorOrigem.toUpperCase()}** foi resetada.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async configurarLogs(interaction, logServer, servidorOrigem, servidorOrigemId) {
        // Buscar canais relevantes para o servidor
        const canaisRelevantes = logServer.channels.cache.filter(c => {
            if (c.type !== 0) return false; // Apenas canais de texto
            
            const categoria = c.parent;
            if (!categoria) return false;
            
            return categoria.name.toUpperCase().includes(servidorOrigem.toUpperCase());
        });

        if (canaisRelevantes.size === 0) {
            return await interaction.editReply({
                content: `❌ Nenhum canal encontrado na categoria ${servidorOrigem.toUpperCase()}.\n\n` +
                        `💡 **Dica**: Use \`/configurar-logs-organizados servidor-origem:${servidorOrigem} acao:list\` para ver todos os canais disponíveis.`
            });
        }

        // Criar menu de seleção
        const options = canaisRelevantes.map(canal => ({
            label: canal.name,
            value: canal.id,
            description: `Categoria: ${canal.parent?.name || 'Sem categoria'}`,
            emoji: '📋'
        })).slice(0, 25); // Limit to Discord's max

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_log_channel_${servidorOrigem}`)
            .setPlaceholder(`Escolha o canal para logs de ${servidorOrigem.toUpperCase()}`)
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`🎯 Configurar Logs - ${servidorOrigem.toUpperCase()}`)
            .setDescription(
                `📋 **Escolha o canal** onde os logs do servidor **${servidorOrigem.toUpperCase()}** devem ser enviados.\n\n` +
                `🔍 **Canais encontrados**: ${canaisRelevantes.size}\n` +
                `📁 **Categoria**: ${servidorOrigem.toUpperCase()}\n\n` +
                `⚠️ **Importante**: Certifique-se de que o canal escolhido já tem um webhook configurado!`
            )
            .setFooter({ text: 'Selecione o canal no menu abaixo' })
            .setTimestamp();

        await interaction.editReply({ 
            embeds: [embed], 
            components: [row] 
        });
    }
};
