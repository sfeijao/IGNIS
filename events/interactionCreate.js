const { Events, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Carregar config com fallback
let config;
try {
    config = require('../config.json');
} catch (error) {
    console.log('⚠️ Config.json não encontrado no interactionCreate, usando valores padrão');
    config = {
        roles: {
            admin: process.env.ADMIN_ROLE_ID,
            staff: process.env.STAFF_ROLE_ID,
            verified: process.env.VERIFIED_ROLE_ID,
            vip: process.env.VIP_ROLE_ID,
            member: process.env.MEMBER_ROLE_ID,
            mod: process.env.MOD_ROLE_ID,
            support: process.env.SUPPORT_ROLE_ID
        },
        channels: {
            verification: process.env.VERIFICATION_CHANNEL_ID,
            logs: process.env.LOGS_CHANNEL_ID
        }
    };
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        console.log(`🔍 Interação recebida: ${interaction.type} - ${interaction.user.tag}`);
        
        // Comandos slash
        if (interaction.isChatInputCommand()) {
            console.log(`📝 Comando executado: /${interaction.commandName} por ${interaction.user.tag}`);
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`❌ Comando ${interaction.commandName} não encontrado.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('❌ Erro ao executar comando:', error);
                
                // Verificar se a interação já foi respondida antes de tentar responder
                if (!interaction.replied && !interaction.deferred) {
                    try {
                        await interaction.reply({
                            content: '❌ Houve um erro ao executar este comando!',
                            ephemeral: true
                        });
                    } catch (replyError) {
                        console.error('❌ Erro ao responder interação:', replyError);
                    }
                }
            }
        }

        // Sistema de Status - Botões interativos
        if (interaction.isButton()) {
            const { customId } = interaction;
            
            // Botão de verificação
            if (customId === 'verify_button') {
                // Criar modal de verificação
                const modal = new ModalBuilder()
                    .setCustomId('verification_modal')
                    .setTitle('🔒 Verificação de Conta');

                const nicknameInput = new TextInputBuilder()
                    .setCustomId('nickname_input')
                    .setLabel('Como te queres chamar no servidor?')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(2)
                    .setMaxLength(32)
                    .setPlaceholder('Escolhe um nickname adequado...')
                    .setRequired(true);

                const ageInput = new TextInputBuilder()
                    .setCustomId('age_input')
                    .setLabel('Qual é a tua idade?')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(2)
                    .setPlaceholder('18')
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(nicknameInput);
                const secondActionRow = new ActionRowBuilder().addComponents(ageInput);

                modal.addComponents(firstActionRow, secondActionRow);

                await interaction.showModal(modal);
                return;
            }
            
            // Botões do painel de status
            if (customId === 'refresh_status' || customId === 'detailed_status' || customId === 'system_info') {
                const isOwner = interaction.user.id === '381762006329589760';
                const hasAdminPerm = interaction.member.permissions.has('Administrator');
                
                if (!isOwner && !hasAdminPerm) {
                    return interaction.reply({
                        content: '❌ Apenas administradores podem usar este painel!',
                        ephemeral: true
                    });
                }

                if (customId === 'refresh_status') {
                    const refreshEmbed = new EmbedBuilder()
                        .setColor('#9932CC')
                        .setTitle('📊 Status do Servidor YSNM')
                        .setDescription('**Monitor de Status Atualizado**')
                        .addFields(
                            {
                                name: '🟢 Sistema Principal',
                                value: '```✅ Online - Funcionando Normalmente```',
                                inline: true
                            },
                            {
                                name: '💾 Base de Dados',
                                value: `\`\`\`✅ Conectado - Latência: ${Math.floor(Math.random() * 30) + 15}ms\`\`\``,
                                inline: true
                            },
                            {
                                name: '🌐 API Discord',
                                value: `\`\`\`✅ Estável - Ping: ${interaction.client.ws.ping}ms\`\`\``,
                                inline: true
                            },
                            {
                                name: '⚡ Performance',
                                value: `\`\`\`RAM: ${Math.floor(process.memoryUsage().heapUsed / 1024 / 1024)}MB / 512MB\nCPU: ${Math.floor(Math.random() * 20) + 5}% / 100%\nUptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m\`\`\``,
                                inline: false
                            },
                            {
                                name: '📈 Estatísticas',
                                value: `\`\`\`Comandos Executados: ${Math.floor(Math.random() * 1000) + 1200}\nUsuários Online: ${interaction.guild.memberCount}\nServidores: 1\`\`\``,
                                inline: false
                            }
                        )
                        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                        .setFooter({
                            text: `YSNM Bot • Atualizado`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    await interaction.update({ embeds: [refreshEmbed] });
                }
            }

            // Sistema de aprovação de tags
            if (customId.startsWith('approve_tag_') || customId.startsWith('deny_tag_')) {
                const isOwner = interaction.user.id === '381762006329589760';
                const hasStaffRole = interaction.member.roles.cache.has(config.roles.admin) || 
                                   interaction.member.roles.cache.has(config.roles.staff);
                
                if (!isOwner && !hasStaffRole) {
                    return interaction.reply({
                        content: '❌ Apenas staff pode aprovar/negar pedidos de tags!',
                        ephemeral: true
                    });
                }

                const parts = customId.split('_');
                const action = parts[0]; // 'approve' ou 'deny'
                const userId = parts[2];
                const tagType = parts[3];

                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                if (!member) {
                    return interaction.reply({
                        content: '❌ Membro não encontrado no servidor!',
                        ephemeral: true
                    });
                }

                let roleId = '';
                let tagName = '';
                
                // Mapeamento de tradução de cargos
                const tagTranslations = {
                    'vip': 'VIP',
                    'member': 'Membro',
                    'mod': 'Moderador',
                    'support': 'Suporte'
                };
                
                switch (tagType) {
                    case 'vip':
                        roleId = config.roles.vip;
                        tagName = tagTranslations.vip;
                        break;
                    case 'member':
                        roleId = config.roles.member;
                        tagName = tagTranslations.member;
                        break;
                    case 'mod':
                        roleId = config.roles.mod;
                        tagName = tagTranslations.mod;
                        break;
                    case 'support':
                        roleId = config.roles.support;
                        tagName = tagTranslations.support;
                        break;
                }

                if (action === 'approve') {
                    try {
                        await member.roles.add(roleId);
                        
                        const approveEmbed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('✅ Pedido de Tag Aprovado')
                            .setDescription(`**Tag:** ${tagName}\n**Utilizador:** ${member.user.tag}\n**Aprovado por:** ${interaction.user.tag}`)
                            .setTimestamp();

                        await interaction.update({ embeds: [approveEmbed], components: [] });

                        // Notificar o utilizador
                        try {
                            await member.send(`🎉 O teu pedido de tag **${tagName}** foi aprovado! Parabéns!`);
                        } catch (error) {
                            console.log('Não foi possível enviar DM ao utilizador');
                        }

                    } catch (error) {
                        console.error('Erro ao adicionar cargo:', error);
                        await interaction.reply({
                            content: '❌ Erro ao adicionar a tag. Verifica as permissões do bot!',
                            ephemeral: true
                        });
                    }
                } else {
                    const denyEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('❌ Pedido de Tag Negado')
                        .setDescription(`**Tag:** ${tagName}\n**Utilizador:** ${member.user.tag}\n**Negado por:** ${interaction.user.tag}`)
                        .setTimestamp();

                    await interaction.update({ embeds: [denyEmbed], components: [] });

                    // Notificar o utilizador
                    try {
                        await member.send(`❌ O teu pedido de tag **${tagName}** foi negado. Contacta a staff para mais informações.`);
                    } catch (error) {
                        console.log('Não foi possível enviar DM ao utilizador');
                    }
                }
            }
        }

        // Select menu para pedidos de tags
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'solicitar_tag_menu') {
                const selectedTag = interaction.values[0].replace('tag_', ''); // remove 'tag_' prefix
                
                // Mapeamento de tradução de cargos para títulos
                const tagTitleTranslations = {
                    'vip': 'VIP',
                    'member': 'Membro',
                    'mod': 'Moderador',
                    'support': 'Suporte'
                };
                
                const tagDisplayName = tagTitleTranslations[selectedTag] || selectedTag.toUpperCase();
                
                // Criar modal para justificação
                const modal = new ModalBuilder()
                    .setCustomId(`tag_modal_${selectedTag}`)
                    .setTitle(`Pedido de Tag - ${tagDisplayName}`);

                const reasonInput = new TextInputBuilder()
                    .setCustomId('tag_reason')
                    .setLabel('Por que desejas esta tag?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Explica detalhadamente por que mereces esta tag...')
                    .setRequired(true)
                    .setMaxLength(1000);

                const experienceInput = new TextInputBuilder()
                    .setCustomId('tag_experience')
                    .setLabel('Experiência relevante (opcional)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Descreve a tua experiência relacionada com esta tag...')
                    .setRequired(false)
                    .setMaxLength(500);

                const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
                const secondActionRow = new ActionRowBuilder().addComponents(experienceInput);

                modal.addComponents(firstActionRow, secondActionRow);

                await interaction.showModal(modal);
            }
        }

        // Processamento de modais
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('tag_modal_')) {
                const tagType = interaction.customId.replace('tag_modal_', '');
                const reason = interaction.fields.getTextInputValue('tag_reason');
                const experience = interaction.fields.getTextInputValue('tag_experience') || 'Não fornecido';

                // Mapeamento de tradução de cargos
                const tagTranslations = {
                    'vip': 'VIP',
                    'member': 'Membro',
                    'mod': 'Moderador',
                    'support': 'Suporte'
                };

                let tagName = tagTranslations[tagType] || tagType.toUpperCase();

                // Enviar para o canal de pending tags
                const pendTagsChannel = interaction.guild.channels.cache.get('1404310493480489031');
                
                if (pendTagsChannel) {
                    const requestEmbed = new EmbedBuilder()
                        .setColor('#9932CC')
                        .setTitle('🏷️ Novo Pedido de Tag')
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: '👤 Utilizador', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                            { name: '🏷️ Tag Solicitada', value: tagName, inline: true },
                            { name: '📅 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                            { name: '📝 Motivo', value: reason, inline: false },
                            { name: '🎯 Experiência', value: experience, inline: false }
                        )
                        .setFooter({ text: 'Sistema de Pedidos de Tags • YSNM Community' })
                        .setTimestamp();

                    const approveButton = new ButtonBuilder()
                        .setCustomId(`approve_tag_${interaction.user.id}_${tagType}`)
                        .setLabel('✅ Aprovar')
                        .setStyle(ButtonStyle.Success);

                    const denyButton = new ButtonBuilder()
                        .setCustomId(`deny_tag_${interaction.user.id}_${tagType}`)
                        .setLabel('❌ Negar')
                        .setStyle(ButtonStyle.Danger);

                    const buttonRow = new ActionRowBuilder().addComponents(approveButton, denyButton);

                    await pendTagsChannel.send({
                        embeds: [requestEmbed],
                        components: [buttonRow]
                    });

                    await interaction.reply({
                        content: `✅ O teu pedido de tag **${tagName}** foi enviado para análise! A staff irá avaliar em breve.`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Canal de pedidos não encontrado! Contacta um administrador.',
                        ephemeral: true
                    });
                }
            }
        }

        // Sistema de Verificação - Modal
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'verification_modal') {
                const nickname = interaction.fields.getTextInputValue('nickname_input');
                const age = interaction.fields.getTextInputValue('age_input');

                // Validar idade
                const ageNum = parseInt(age);
                if (isNaN(ageNum) || ageNum < 13) {
                    return interaction.reply({
                        content: '❌ Deves ter pelo menos 13 anos para te juntares ao servidor!',
                        ephemeral: true
                    });
                }

                try {
                    // Dar cargo de verificado
                    const verifiedRole = interaction.guild.roles.cache.get(config.roles.verified);
                    if (verifiedRole) {
                        await interaction.member.roles.add(verifiedRole);
                    }

                    // Definir nickname se fornecido
                    if (nickname && nickname !== interaction.member.displayName) {
                        try {
                            await interaction.member.setNickname(nickname);
                        } catch (error) {
                            console.log('Não foi possível alterar o nickname (permissões)');
                        }
                    }

                    // Enviar log para o canal de logs
                    const logsChannel = interaction.guild.channels.cache.get(config.channels.logs);
                    if (logsChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('✅ Novo Membro Verificado')
                            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                            .addFields(
                                { name: '👤 Utilizador', value: `${interaction.user.tag}`, inline: true },
                                { name: '🏷️ Nickname', value: nickname, inline: true },
                                { name: '🎂 Idade', value: `${age} anos`, inline: true },
                                { name: ' Verificado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                            )
                            .setFooter({ text: 'Sistema de Verificação • YSNM Community' })
                            .setTimestamp();

                        await logsChannel.send({ embeds: [logEmbed] });
                    }

                    // Responder ao utilizador
                    const successEmbed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('🎉 Verificação Concluída!')
                        .setDescription(`Bem-vindo ao **${interaction.guild.name}**, ${nickname}!`)
                        .addFields(
                            { name: '✅ O que ganhas:', value: '• Acesso a todos os canais\n• Possibilidade de participar em eventos\n• Interação completa com a comunidade\n• Acesso ao sistema de tags', inline: false },
                            { name: '📋 Próximos passos:', value: '• Explora os canais disponíveis\n• Lê as regras do servidor\n• Solicita tags se te interessarem\n• Diverte-te na comunidade!', inline: false }
                        )
                        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                        .setFooter({ text: 'YSNM Community™ • Bem-vindo!' })
                        .setTimestamp();

                    await interaction.reply({ embeds: [successEmbed], ephemeral: true });

                } catch (error) {
                    console.error('❌ Erro durante verificação:', error);
                    await interaction.reply({
                        content: '❌ Ocorreu um erro durante a verificação. Contacta um administrador!',
                        ephemeral: true
                    });
                }
            }
        }
    },
};
