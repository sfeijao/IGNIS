const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { EMBED_COLORS, EMOJIS } = require('../constants/ui');
const TicketPermissionManager = require('../utils/TicketPermissionManager');
const visualAssets = require('../assets/visual-assets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-painel-tickets')
        .setDescription('🎯 Publica um painel de tickets moderno e integrado ao novo sistema')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal onde será enviado o painel (padrão: canal atual)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('tema')
                .setDescription('Tema do painel')
                .addChoices(
                    { name: 'Escuro', value: 'dark' },
                    { name: 'Claro', value: 'light' }
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            // Verificar permissões
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: `${EMOJIS.ERROR} Precisas de permissão de Administrador para usar este comando.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
            const theme = interaction.options.getString('tema') || 'dark';
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Auto-configurar cargos de staff
            const permissionManager = new TicketPermissionManager();
            const autoConfigResult = await permissionManager.autoConfigureStaffRoles(interaction.guild);

            // Novo design enxuto e consistente com o resto do bot
            const color = theme === 'light' ? EMBED_COLORS.INFO : EMBED_COLORS.PRIMARY;
            const header = new EmbedBuilder()
                .setColor(color)
                .setTitle(`${EMOJIS.TICKET} Centro de Suporte`)
                .setDescription([
                    'Escolhe o departamento abaixo para abrir um ticket privado com a equipa.',
                    '',
                    '• Resposta rápida • Canal privado • Histórico guardado'
                ].join('\n'))
                .setThumbnail(visualAssets.realImages.supportIcon)
                .setImage(visualAssets.realImages.supportBanner)
                .addFields(
                    { name: 'Servidor', value: `**${interaction.guild.name}**`, inline: true },
                    { name: 'Staff Online', value: `${interaction.guild.members.cache.filter(m => !m.user.bot && m.presence?.status !== 'offline').size}`, inline: true },
                    { name: 'Status', value: 'OPERACIONAL', inline: true },
                )
                .setFooter({ text: 'IGNIS • Sistema de Tickets unificado', iconURL: interaction.client.user.displayAvatarURL() });

            // Criar botões com design premium moderno
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket:create:technical')
                    .setLabel('Suporte Técnico')
                    .setEmoji('🔧')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('ticket:create:incident')
                    .setLabel('Reportar Problema')
                    .setEmoji('⚠️')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket:create:moderation')
                    .setLabel('Moderação & Segurança')
                    .setEmoji('🛡️')
                    .setStyle(ButtonStyle.Secondary)
            );

            // Segunda linha opcional com categorias comunitárias
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket:create:general')
                    .setLabel('Dúvidas Gerais')
                    .setEmoji('💬')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ticket:create:account')
                    .setLabel('Suporte de Conta')
                    .setEmoji('🧾')
                    .setStyle(ButtonStyle.Secondary)
            );

            // Enviar painel no canal especificado
            const message = await targetChannel.send({ embeds: [header], components: [row1, row2] });

            // Embed de confirmação profissional
            const confirmEmbed = new EmbedBuilder()
                .setColor(EMBED_COLORS.SUCCESS)
                .setTitle(`${EMOJIS.SUCCESS} Painel enviado`)
                .setDescription([
                    `Canal: ${targetChannel}`,
                    `Mensagem: \`${message.id}\``,
                    '',
                    autoConfigResult.success
                        ? `${EMOJIS.SUCCESS} Staff auto-configurado: \`${autoConfigResult.rolesFound}\``
                        : `${EMOJIS.WARNING} ${autoConfigResult.message || 'Verifica as permissões/cargos de staff'}`
                ].join('\n'))
                .setFooter({ text: 'Usa os botões para criar tickets', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [confirmEmbed] });

        } catch (error) {
            console.error('Erro ao configurar painel de tickets:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('❌ **ERRO NA CONFIGURAÇÃO**')
                .setThumbnail(visualAssets.realImages.errorIcon) // Ícone real
                .setDescription([
                    '**Falha ao configurar o sistema de tickets**',
                    '',
                    `\`\`\`js`,
                    `${error.message}`,
                    `\`\`\``,
                    '',
                    '**💡 Possíveis soluções:**',
                    '• Verificar permissões do bot no canal',
                    '• Tentar novamente em alguns segundos',
                    '• Usar `/diagnostico` para análise detalhada'
                ].join('\n'))
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }
        }
    },
};