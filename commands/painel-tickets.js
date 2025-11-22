const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { TicketPanelBuilder } = require('../utils/TicketPanelBuilder');
const logger = require('../utils/logger');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('painel-tickets')
        .setDescription('🎫 Criar painel de tickets (simples ou avançado)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('simples')
                .setDescription('Criar painel simples (1 botão + menu de categorias)')
                .addChannelOption(option =>
                    option
                        .setName('canal')
                        .setDescription('Canal onde o painel será enviado')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('titulo')
                        .setDescription('Título do painel')
                        .setMaxLength(256)
                )
                .addStringOption(option =>
                    option
                        .setName('descricao')
                        .setDescription('Descrição do painel')
                        .setMaxLength(2000)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('avancado')
                .setDescription('Criar painel avançado (botões individuais por categoria)')
                .addChannelOption(option =>
                    option
                        .setName('canal')
                        .setDescription('Canal onde o painel será enviado')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('categorias')
                        .setDescription('Categorias separadas por vírgula (ex: support,technical,vip)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('titulo')
                        .setDescription('Título do painel')
                        .setMaxLength(256)
                )
                .addStringOption(option =>
                    option
                        .setName('descricao')
                        .setDescription('Descrição do painel')
                        .setMaxLength(2000)
                )
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const subcommand = interaction.options.getSubcommand();
            const canal = interaction.options.getChannel('canal');
            const titulo = interaction.options.getString('titulo');
            const descricao = interaction.options.getString('descricao');

            // Verificar permissões no canal
            const botMember = await interaction.guild.members.fetchMe();
            const permissions = canal.permissionsFor(botMember);
            
            if (!permissions.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])) {
                return await interaction.editReply({
                    content: `❌ Não tenho permissões suficientes no canal ${canal}.\n` +
                             `Necessito de: \`Ver Canal\` e \`Enviar Mensagens\``
                });
            }

            // Criar configuração do painel
            const panelConfig = {
                title: titulo || (subcommand === 'simples' ? '🎫 Sistema de Suporte' : '🎫 Abrir Ticket'),
                description: descricao || 'Selecione uma categoria para abrir um ticket.',
                color: 0x5865F2,
                guildId: interaction.guild.id,
                channelId: canal.id
            };

            let message;

            if (subcommand === 'simples') {
                // Painel Simples
                logger.info(`[TicketPanel] Criando painel simples no canal ${canal.id}`);
                
                const { embed, button } = await TicketPanelBuilder.createSimplePanel(panelConfig);
                
                message = await canal.send({
                    embeds: [embed],
                    components: [button]
                });

                // Salvar configuração do painel
                await storage.saveTicketPanel(interaction.guild.id, {
                    type: 'simple',
                    channelId: canal.id,
                    messageId: message.id,
                    config: panelConfig,
                    createdBy: interaction.user.id,
                    createdAt: new Date().toISOString()
                });

                await interaction.editReply({
                    content: `✅ **Painel Simples criado com sucesso!**\n\n` +
                             `📍 Canal: ${canal}\n` +
                             `🔗 [Ir para o painel](${message.url})\n\n` +
                             `**Funcionamento:**\n` +
                             `• Usuários clicam no botão "Abrir Ticket"\n` +
                             `• Aparecem as categorias disponíveis\n` +
                             `• Selecionam a categoria desejada\n` +
                             `• Ticket é criado automaticamente`
                });

            } else if (subcommand === 'avancado') {
                // Painel Avançado
                const categoriasInput = interaction.options.getString('categorias');
                const categorias = categoriasInput.split(',').map(c => c.trim().toLowerCase());

                // Validar categorias
                const categoriasValidas = ['support', 'technical', 'incident', 'general', 'vip', 'moderation', 'account', 'billing', 'partnership'];
                const categoriasInvalidas = categorias.filter(c => !categoriasValidas.includes(c));

                if (categoriasInvalidas.length > 0) {
                    return await interaction.editReply({
                        content: `❌ **Categorias inválidas:** ${categoriasInvalidas.join(', ')}\n\n` +
                                 `**Categorias válidas:**\n${categoriasValidas.join(', ')}\n\n` +
                                 `**Exemplo:** \`support,technical,vip\``
                    });
                }

                logger.info(`[TicketPanel] Criando painel avançado com categorias: ${categorias.join(', ')}`);

                const { embed, rows } = await TicketPanelBuilder.createAdvancedPanel(panelConfig, categorias);

                message = await canal.send({
                    embeds: [embed],
                    components: rows
                });

                // Salvar configuração do painel
                await storage.saveTicketPanel(interaction.guild.id, {
                    type: 'advanced',
                    categories: categorias,
                    channelId: canal.id,
                    messageId: message.id,
                    config: panelConfig,
                    createdBy: interaction.user.id,
                    createdAt: new Date().toISOString()
                });

                await interaction.editReply({
                    content: `✅ **Painel Avançado criado com sucesso!**\n\n` +
                             `📍 Canal: ${canal}\n` +
                             `🔗 [Ir para o painel](${message.url})\n` +
                             `🏷️ Categorias: ${categorias.map(c => `\`${c}\``).join(', ')}\n\n` +
                             `**Funcionamento:**\n` +
                             `• Usuários clicam diretamente no botão da categoria desejada\n` +
                             `• Ticket é criado automaticamente naquela categoria\n` +
                             `• Mais rápido e direto que o painel simples`
                });
            }

            logger.info(`[TicketPanel] Painel ${subcommand} criado com sucesso`, {
                guildId: interaction.guild.id,
                channelId: canal.id,
                messageId: message.id,
                userId: interaction.user.id
            });

        } catch (error) {
            logger.error('[TicketPanel] Erro ao criar painel:', error);

            const errorMessage = error.message || 'Erro desconhecido';
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: `❌ **Erro ao criar painel de tickets**\n\n` +
                             `**Detalhes:** ${errorMessage}\n\n` +
                             `Contacta um administrador se o problema persistir.`
                });
            } else {
                await interaction.reply({
                    content: `❌ Erro ao criar painel: ${errorMessage}`,
                    ephemeral: true
                });
            }
        }
    }
};
