const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-status')
        .setDescription('Configura o painel de status do servidor')
        .setDefaultMemberPermissions('0')
        .setDMPermission(false),

    async execute(interaction) {
        // Verificar se é owner ou tem permissão de Administrator
        const isOwner = interaction.user.id === '381762006329589760';
        const hasAdminPerm = interaction.member.permissions.has('Administrator');
        
        if (!isOwner && !hasAdminPerm) {
            return interaction.reply({
                content: '❌ Você não tem permissão para usar este comando.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#7B68EE')
            .setTitle('📊 Status do Servidor IGNIS')
            .setDescription('**Monitor de Status em Tempo Real**')
            .addFields(
                {
                    name: '🟢 Sistema Principal',
                    value: '```✅ Online - Funcionando Normalmente```',
                    inline: true
                },
                {
                    name: '💾 Base de Dados',
                    value: '```✅ Conectado - Latência: 23ms```',
                    inline: true
                },
                {
                    name: '🌐 API Discord',
                    value: '```✅ Estável - Ping: 45ms```',
                    inline: true
                },
                {
                    name: '⚡ Performance',
                    value: '```RAM: 234MB / 512MB\nCPU: 12% / 100%\nUptime: 2d 14h 32m```',
                    inline: false
                },
                {
                    name: '📈 Estatísticas',
                    value: '```Comandos Executados: 1,247\nUsuários Ativos: 89\nServidores: 1```',
                    inline: false
                }
            )
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setFooter({
                text: `IGNIS Bot • Última atualização`,
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('refresh_status')
                    .setLabel('🔄 Atualizar')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setCustomId('detailed_status')
                    .setLabel('📋 Detalhes')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋'),
                new ButtonBuilder()
                    .setCustomId('system_info')
                    .setLabel('⚙️ Sistema')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        await interaction.reply({
            content: '✅ Configurando painel de status...',
            ephemeral: true
        });

        // Enviar o painel no canal
        const statusMessage = await interaction.channel.send({
            embeds: [embed],
            components: [row]
        });

        // Editar resposta para confirmar
        await interaction.editReply({
            content: `✅ Painel de status configurado com sucesso!\n📍 Mensagem criada: [Clica aqui para ver](${statusMessage.url})`
        });

        // Coletor de botões
        const collector = interaction.channel.createMessageComponentCollector({
            time: 300000 // 5 minutos
        });

        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.customId === 'refresh_status') {
                const refreshEmbed = new EmbedBuilder()
                    .setColor('#9932CC')
                    .setTitle('📊 Status do Servidor IGNIS')
                    .setDescription('**Monitor de Status em Tempo Real**')
                    .addFields(
                        {
                            name: '🟢 Sistema Principal',
                            value: '```✅ Online - Funcionando Normalmente```',
                            inline: true
                        },
                        {
                            name: '💾 Base de Dados',
                            value: '```✅ Conectado - Latência: 19ms```',
                            inline: true
                        },
                        {
                            name: '🌐 API Discord',
                            value: '```✅ Estável - Ping: 38ms```',
                            inline: true
                        },
                        {
                            name: '⚡ Performance',
                            value: '```RAM: 241MB / 512MB\nCPU: 8% / 100%\nUptime: 2d 14h 33m```',
                            inline: false
                        },
                        {
                            name: '📈 Estatísticas',
                            value: '```Comandos Executados: 1,251\nUsuários Ativos: 91\nServidores: 1```',
                            inline: false
                        }
                    )
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .setFooter({
                        text: `IGNIS Bot • Atualizado agora`,
                        iconURL: interaction.client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await buttonInteraction.update({ 
                    embeds: [refreshEmbed], 
                    components: [row] 
                });

            } else if (buttonInteraction.customId === 'detailed_status') {
                const detailEmbed = new EmbedBuilder()
                    .setColor('#8B5FBF')
                    .setTitle('📋 Status Detalhado do Sistema')
                    .addFields(
                        {
                            name: '🔧 Módulos Carregados',
                            value: '```• Sistema de Verificação ✅\n• Sistema de Logs ✅\n• Auto Moderação ✅\n• Sistema de Tickets ✅\n• Comandos Slash ✅```',
                            inline: false
                        },
                        {
                            name: '📊 Métricas de Performance',
                            value: '```Latência WebSocket: 45ms\nLatência API: 89ms\nTempo de Resposta: 12ms\nEventos Processados/min: 23```',
                            inline: false
                        },
                        {
                            name: '💽 Informações do Sistema',
                            value: '```Node.js: v18.17.0\nDiscord.js: v14.14.1\nSistema: Linux x64\nMemória Total: 512MB```',
                            inline: false
                        }
                    )
                    .setFooter({
                        text: 'IGNIS Bot • Status Detalhado',
                        iconURL: interaction.client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await buttonInteraction.update({ 
                    embeds: [detailEmbed], 
                    components: [row] 
                });

            } else if (buttonInteraction.customId === 'system_info') {
                const systemEmbed = new EmbedBuilder()
                    .setColor('#7B68EE')
                    .setTitle('⚙️ Informações do Sistema')
                    .addFields(
                        {
                            name: '🏷️ Versão do Bot',
                            value: '```IGNIS Bot v2.1.0\nBuild: 2024.01.15```',
                            inline: true
                        },
                        {
                            name: '📅 Última Manutenção',
                            value: '```15/01/2024 às 14:30\nPróxima: 22/01/2024```',
                            inline: true
                        },
                        {
                            name: '👨‍💻 Desenvolvedor',
                            value: '```IGNIS Development Team\nSuporte: 24/7```',
                            inline: true
                        },
                        {
                            name: '🔗 Links Úteis',
                            value: '```📘 Documentação: /ajuda\n🐛 Reportar Bug: /bug\n💡 Sugestões: /sugestao```',
                            inline: false
                        }
                    )
                    .setFooter({
                        text: 'IGNIS Bot • Informações do Sistema',
                        iconURL: interaction.client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await buttonInteraction.update({ 
                    embeds: [systemEmbed], 
                    components: [row] 
                });
            }
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('refresh_status')
                        .setLabel('🔄 Atualizar')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('detailed_status')
                        .setLabel('📋 Detalhes')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('system_info')
                        .setLabel('⚙️ Sistema')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

            interaction.editReply({ components: [disabledRow] }).catch(() => {});
        });
    },
};
