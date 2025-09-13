const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const TicketPermissionManager = require('../utils/TicketPermissionManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-painel-tickets')
        .setDescription('Configurar painel de tickets com auto-detecção de staff')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal onde criar o painel')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return await interaction.reply({
                    content: '❌ Não tens permissão para configurar painéis.',
                    ephemeral: true
                });
            }

            const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
            await interaction.deferReply({ ephemeral: true });

            // Auto-configurar cargos de staff
            const permissionManager = new TicketPermissionManager();
            const autoConfigResult = await permissionManager.autoConfigureStaffRoles(interaction.guild);

            // Criar embed do painel - Design moderno e profissional
            const embed = new EmbedBuilder()
                .setColor('#2C2F33')
                .setTitle('� **CENTRO DE SUPORTE TÉCNICO**')
                .setDescription([
                    '> **Sistema de atendimento profissional disponível 24/7**',
                    '',
                    '### 📊 **DEPARTAMENTOS DISPONÍVEIS**',
                    '',
                    '**🔧 SUPORTE TÉCNICO**',
                    '└ Assistência com configurações, bugs e funcionalidades',
                    '',
                    '**⚠️ REPORTAR INCIDENTES**', 
                    '└ Comunicar problemas críticos e falhas do sistema',
                    '',
                    '**🚨 MODERAÇÃO & SEGURANÇA**',
                    '└ Denúncias, violações e questões disciplinares',
                    '',
                    '### ⚡ **PROCESSO DE ATENDIMENTO**',
                    '',
                    '`1.` Selecione o departamento adequado',
                    '`2.` Canal privado será criado automaticamente',
                    '`3.` Forneça informações detalhadas sobre sua solicitação',
                    '`4.` Nossa equipe responderá no menor tempo possível',
                    '',
                    '### 📋 **INFORMAÇÕES IMPORTANTES**',
                    '',
                    '• **Tempo de resposta:** 15 minutos - 2 horas',
                    '• **Disponibilidade:** Segunda a Domingo',
                    '• **Prioridade:** Crítico > Alto > Normal',
                    '• **Rate limit:** 3 tickets por hora',
                    '',
                    '> ✨ *Sistema com detecção automática de staff ativo*'
                ].join('\n'))
                .setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png') // Substitua por um ícone profissional
                .addFields(
                    {
                        name: '🏢 Servidor',
                        value: `\`${interaction.guild.name}\``,
                        inline: true
                    },
                    {
                        name: '👥 Staff Online',
                        value: `\`${interaction.guild.members.cache.filter(m => !m.user.bot && m.presence?.status !== 'offline').size}\``,
                        inline: true
                    },
                    {
                        name: '⚡ Status',
                        value: '`🟢 OPERACIONAL`',
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `${interaction.guild.name} • Sistema de Suporte v2.0 • Tecnologia YSNM`,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            // Criar botões com design profissional
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket:create:suporte')
                        .setLabel('Suporte Técnico')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('�'),
                    new ButtonBuilder()
                        .setCustomId('ticket:create:bugs')
                        .setLabel('Reportar Incidente')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('⚠️')
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket:create:denuncias')
                        .setLabel('Moderação & Segurança')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🚨')
                );

            // Enviar painel com design profissional
            const message = await targetChannel.send({
                embeds: [embed],
                components: [row1, row2]
            });

            // Resposta de sucesso profissional
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ **SISTEMA DE SUPORTE IMPLEMENTADO**')
                .setDescription('O centro de suporte técnico foi configurado com sucesso')
                .setColor('#00FF7F')
                .addFields(
                    {
                        name: '📍 **Localização do Painel**',
                        value: `${targetChannel}`,
                        inline: false
                    },
                    {
                        name: '� **Detecção Automática**',
                        value: `✅ ${autoConfigResult.detected.length} cargos de staff detectados\n⚙️ ${autoConfigResult.configured.length} cargos configurados`,
                        inline: true
                    },
                    {
                        name: '📊 **Status do Sistema**',
                        value: '🟢 **OPERACIONAL**\n⚡ Pronto para uso',
                        inline: true
                    },
                    {
                        name: '🛠️ **Comandos Administrativos**',
                        value: [
                            '`/diagnostico-tickets` - Verificar sistema',
                            '`/auto-configurar-tickets` - Reconfigurar',
                            '`/configurar-painel-tickets` - Novo painel'
                        ].join('\n'),
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Configurado por ${interaction.user.tag} • ${new Date().toLocaleString('pt-PT')}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png'); // Ícone de sucesso

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Erro ao configurar painel:', error);
            
            const errorMsg = '❌ Erro ao configurar painel de tickets.';
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMsg, ephemeral: true });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: errorMsg });
            }
        }
    }
};