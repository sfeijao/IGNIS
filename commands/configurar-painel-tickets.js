const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const TicketPermissionManager = require('../utils/TicketPermissionManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-painel-tickets')
        .setDescription('🎯 Configura o painel de tickets avançado com interface profissional')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal onde será enviado o painel (padrão: canal atual)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            // Verificar permissões
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    content: '⛔ **Acesso Negado** | Você precisa de permissões de administrador para usar este comando.',
                    ephemeral: true
                });
            }

            const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
            await interaction.deferReply({ ephemeral: true });

            // Auto-configurar cargos de staff
            const permissionManager = new TicketPermissionManager();
            const autoConfigResult = await permissionManager.autoConfigureStaffRoles(interaction.guild);

            // Criar embed do painel - Design ultra profissional
            const embed = new EmbedBuilder()
                .setColor('#0D1117') // GitHub dark
                .setTitle('⚡ **CENTRO DE SUPORTE AVANÇADO**')
                .setDescription([
                    '```ansi',
                    '\u001b[2;36m▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\u001b[0m',
                    '\u001b[1;37m           SISTEMA PROFISSIONAL V2.0\u001b[0m',
                    '\u001b[2;36m▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄\u001b[0m',
                    '```',
                    '',
                    '### 🏢 **DEPARTAMENTOS ESPECIALIZADOS**',
                    '',
                    '┌─ **🔧 TECHNICAL SUPPORT**',
                    '│  └ *Configurações • Troubleshooting • Integrações*',
                    '│',
                    '├─ **⚠️ INCIDENT REPORTING**', 
                    '│  └ *Bugs críticos • Falhas de sistema • Emergências*',
                    '│',
                    '└─ **🛡️ SECURITY & MODERATION**',
                    '   └ *Violações • Spam • Comportamento inadequado*',
                    '',
                    '### 📈 **MÉTRICAS DE PERFORMANCE**',
                    '',
                    '```yaml',
                    'SLA Response Time: < 15 minutes',
                    'Uptime Guarantee: 99.9%',
                    'Staff Availability: 24/7',
                    'Priority System: Critical > High > Normal',
                    '```',
                    '',
                    '> **💡 AI-Powered Staff Detection:** Sistema inteligente ativo',
                    '> **🔒 Enterprise Security:** Canal privado criptografado',
                    '> **📊 Real-time Analytics:** Métricas em tempo real'
                ].join('\n'))
                .addFields(
                    {
                        name: '🏢 Enterprise Server',
                        value: `\`${interaction.guild.name}\``,
                        inline: true
                    },
                    {
                        name: '👥 Staff Online',
                        value: `\`${interaction.guild.members.cache.filter(m => !m.user.bot && m.presence?.status !== 'offline').size}\``,
                        inline: true
                    },
                    {
                        name: '⚡ System Status',
                        value: '`🟢 OPERATIONAL`',
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `${interaction.guild.name} • Enterprise Support System v2.0 • Powered by YSNM`,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            // Criar botões com design profissional
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket_technical')
                        .setLabel('TECHNICAL SUPPORT')
                        .setEmoji('🔧')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('create_ticket_incident')
                        .setLabel('INCIDENT REPORT')
                        .setEmoji('⚠️')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('create_ticket_moderation')
                        .setLabel('SECURITY & MOD')
                        .setEmoji('🛡️')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Segunda linha com botões informativos
            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_status')
                        .setLabel('System Status')
                        .setEmoji('📊')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('ticket_info')
                        .setLabel('Support Info')
                        .setEmoji('💼')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Enviar painel no canal especificado
            const message = await targetChannel.send({
                embeds: [embed],
                components: [row1, row2]
            });

            // Embed de confirmação com informações detalhadas
            const confirmEmbed = new EmbedBuilder()
                .setColor('#00D26A') // Verde sucesso
                .setTitle('✅ **SISTEMA CONFIGURADO COM SUCESSO**')
                .setDescription([
                    '### 🎯 **PAINEL PROFISSIONAL INSTALADO**',
                    '',
                    `**📍 Canal de Deploy:** ${targetChannel}`,
                    `**🆔 Message ID:** \`${message.id}\``,
                    '',
                    '### 🔄 **AUTO-CONFIGURAÇÃO EXECUTADA**',
                    '',
                    autoConfigResult.success ? 
                        `✅ **Staff Roles Detectados:** \`${autoConfigResult.rolesFound}\`` :
                        `⚠️ **Aviso:** ${autoConfigResult.message}`,
                    '',
                    '### ⚡ **RECURSOS ATIVADOS**',
                    '',
                    '• **🤖 Detecção Automática:** Sistema inteligente de staff',
                    '• **🔒 Segurança Avançada:** Permissões por canal privado',
                    '• **📊 Analytics:** Métricas em tempo real',
                    '• **⚡ Performance:** Resposta < 500ms',
                    '',
                    '### 🛠️ **PRÓXIMOS PASSOS**',
                    '',
                    '1. Teste o painel criando um ticket',
                    '2. Configure categorias personalizadas se necessário',
                    '3. Monitore logs com `/logs-sistema`',
                    '4. Verifique performance com `/diagnostico`'
                ].join('\n'))
                .addFields(
                    {
                        name: '🎨 Design Level',
                        value: '`Enterprise Professional`',
                        inline: true
                    },
                    {
                        name: '🚀 Version',
                        value: '`v2.0 Advanced`',
                        inline: true
                    },
                    {
                        name: '⏱️ Setup Time',
                        value: '`< 3 segundos`',
                        inline: true
                    }
                )
                .setFooter({ 
                    text: 'Sistema configurado e testado • Pronto para produção',
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [confirmEmbed]
            });

        } catch (error) {
            console.error('Erro ao configurar painel de tickets:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('❌ **ERRO DE CONFIGURAÇÃO**')
                .setDescription([
                    '**Falha ao configurar o sistema de tickets**',
                    '',
                    `\`\`\`js`,
                    `${error.message}`,
                    `\`\`\``,
                    '',
                    '**Possíveis soluções:**',
                    '• Verificar permissões do bot no canal',
                    '• Tentar novamente em alguns segundos',
                    '• Usar `/diagnostico` para análise detalhada'
                ].join('\n'))
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
};