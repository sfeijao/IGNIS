const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const TicketPermissionManager = require('../utils/TicketPermissionManager');
const visualAssets = require('../assets/visual-assets');

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
                    flags: 64 // MessageFlags.Ephemeral
                });
            }

            const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
            await interaction.deferReply({ flags: 64 }); // MessageFlags.Ephemeral

            // Auto-configurar cargos de staff
            const permissionManager = new TicketPermissionManager();
            const autoConfigResult = await permissionManager.autoConfigureStaffRoles(interaction.guild);

            // Criar embed do painel - Design brasileiro profissional
            const embed = new EmbedBuilder()
                .setColor('#1E1F22') // Discord dark
                .setTitle('🎯 **CENTRAL DE ATENDIMENTO**')
                .setImage(visualAssets.realImages.supportBanner) // Banner real
                .setThumbnail(visualAssets.realImages.supportIcon) // Ícone real
                .setDescription([
                    '### 🏢 **DEPARTAMENTOS DISPONÍVEIS**',
                    '',
                    '🔧 **SUPORTE TÉCNICO**',
                    '└ *Configurações, bugs e problemas técnicos*',
                    '',
                    '⚠️ **REPORTAR PROBLEMAS**', 
                    '└ *Falhas críticas e incidentes graves*',
                    '',
                    '🛡️ **MODERAÇÃO E SEGURANÇA**',
                    '└ *Denúncias, violações e questões disciplinares*',
                    '',
                    '� **Como funciona:**',
                    '• Clique no botão do departamento desejado',
                    '• Um canal privado será criado automaticamente',
                    '• Nossa equipe será notificada instantaneamente',
                    '• Tempo médio de resposta: **15 minutos**'
                ].join('\n'))
                .addFields(
                    {
                        name: '🏢 Servidor',
                        value: `\`${interaction.guild.name}\``,
                        inline: true
                    },
                    {
                        name: '�‍💼 Staff Disponível',
                        value: `\`${interaction.guild.members.cache.filter(m => !m.user.bot && m.presence?.status !== 'offline').size} membros\``,
                        inline: true
                    },
                    {
                        name: '🟢 Status do Sistema',
                        value: '`ONLINE`',
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `${interaction.guild.name} • Sistema de Tickets v2.0 • Powered by YSNM`,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            // Criar botões com design brasileiro
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket_technical')
                        .setLabel('SUPORTE TÉCNICO')
                        .setEmoji('🔧')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('create_ticket_incident')
                        .setLabel('REPORTAR PROBLEMA')
                        .setEmoji('⚠️')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('create_ticket_moderation')
                        .setLabel('MODERAÇÃO')
                        .setEmoji('🛡️')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Segunda linha com botões informativos
            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_status')
                        .setLabel('Status do Sistema')
                        .setEmoji('📊')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('ticket_info')
                        .setLabel('Informações')
                        .setEmoji('💼')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Enviar painel no canal especificado
            const message = await targetChannel.send({
                embeds: [embed],
                components: [row1, row2]
            });

            // Embed de confirmação profissional
            const confirmEmbed = new EmbedBuilder()
                .setColor('#00D26A') // Verde sucesso
                .setTitle('✅ **PAINEL CONFIGURADO COM SUCESSO!**')
                .setThumbnail(visualAssets.realImages.successIcon) // Ícone real
                .setImage(visualAssets.realImages.successBanner) // Banner real
                .setDescription([
                    '### 🎯 **SISTEMA INSTALADO**',
                    '',
                    `**📍 Canal:** ${targetChannel}`,
                    `**🆔 ID da Mensagem:** \`${message.id}\``,
                    '',
                    '### 🔄 **CONFIGURAÇÃO AUTOMÁTICA**',
                    '',
                    autoConfigResult.success ? 
                        `✅ **Cargos de Staff Detectados:** \`${autoConfigResult.rolesFound}\`` :
                        `⚠️ **Aviso:** ${autoConfigResult.message}`,
                    '',
                    '### ⚡ **RECURSOS ATIVADOS**',
                    '',
                    '• **🤖 Detecção Automática** de staff',
                    '• **🔒 Canais Privados** seguros',
                    '• **📊 Estatísticas** em tempo real',
                    '• **⚡ Resposta Rápida** garantida',
                    '',
                    '### � **PRÓXIMOS PASSOS**',
                    '',
                    '1. 🧪 Teste criando um ticket',
                    '2. ⚙️ Configure categorias personalizadas',
                    '3. 📝 Monitore com `/logs-sistema`',
                    '4. 🔍 Verifique com `/diagnostico`'
                ].join('\n'))
                .addFields(
                    {
                        name: '🎨 Nível de Design',
                        value: '`Profissional Brasileiro`',
                        inline: true
                    },
                    {
                        name: '🚀 Versão',
                        value: '`v2.0 Avançado`',
                        inline: true
                    },
                    {
                        name: '⏱️ Tempo de Instalação',
                        value: '`< 3 segundos`',
                        inline: true
                    }
                )
                .setFooter({ 
                    text: 'Sistema configurado e testado • Pronto para uso',
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
                await interaction.reply({ embeds: [errorEmbed], flags: 64 }); // MessageFlags.Ephemeral
            }
        }
    },
};