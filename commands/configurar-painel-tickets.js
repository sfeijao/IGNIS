const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-painel-tickets')
        .setDescription('Configurar painel de tickets no canal atual')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal onde criar o painel (deixar vazio para canal atual)')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            // Verificar permissões
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return await interaction.reply({
                    content: '❌ Não tens permissão para configurar painéis de tickets.',
                    ephemeral: true
                });
            }

            const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
            
            await interaction.deferReply({ ephemeral: true });

            // Criar embed do painel
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎫 Sistema de Tickets - YSNM')
                .setDescription(`
**Precisa de ajuda? Cria um ticket!**

Seleciona a categoria que melhor descreve o teu problema e um ticket será criado automaticamente.

📋 **Como funciona:**
• Clica num botão abaixo
• Preenche o formulário que aparece
• Um canal privado será criado para ti
• A nossa equipa irá ajudar-te o mais rápido possível

⚠️ **Regras:**
• Só podes ter 1 ticket aberto de cada vez
• Usa a categoria correta para o teu problema
• Sê claro e detalhado na descrição
• Respeita a equipa de suporte
                `)
                .addFields(
                    { 
                        name: '🛠️ Suporte Técnico', 
                        value: 'Problemas com bots, comandos ou funcionalidades', 
                        inline: true 
                    },
                    { 
                        name: '🚨 Reportar Problema', 
                        value: 'Bugs, erros ou comportamentos inesperados', 
                        inline: true 
                    },
                    { 
                        name: '💡 Sugestão', 
                        value: 'Ideias para melhorar o servidor', 
                        inline: true 
                    },
                    { 
                        name: '👤 Moderação', 
                        value: 'Questões relacionadas com moderação', 
                        inline: true 
                    },
                    { 
                        name: '📝 Geral', 
                        value: 'Outras questões ou dúvidas', 
                        inline: true 
                    },
                    { 
                        name: '📊 Status', 
                        value: 'Sistema ativo e funcional', 
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: 'Sistema de Tickets YSNM • Clica num botão para começar',
                    iconURL: interaction.guild.iconURL()
                })
                .setTimestamp()
                .setThumbnail(interaction.guild.iconURL());

            // Criar botões
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_create_suporte')
                        .setLabel('Suporte Técnico')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🛠️'),
                    new ButtonBuilder()
                        .setCustomId('ticket_create_problema')
                        .setLabel('Reportar Problema')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🚨'),
                    new ButtonBuilder()
                        .setCustomId('ticket_create_sugestao')
                        .setLabel('Sugestão')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('💡')
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_create_moderacao')
                        .setLabel('Moderação')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('👤'),
                    new ButtonBuilder()
                        .setCustomId('ticket_create_geral')
                        .setLabel('Geral')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📝')
                );

            // Enviar painel no canal especificado
            const message = await targetChannel.send({
                embeds: [embed],
                components: [row1, row2]
            });

            // Responder ao comando
            await interaction.editReply({
                content: `✅ Painel de tickets criado com sucesso em ${targetChannel}!
                
**📋 Informações:**
• **Canal**: ${targetChannel}
• **ID da Mensagem**: \`${message.id}\`
• **5 categorias** de tickets disponíveis
• **Sistema ativo** e pronto para usar

Os utilizadores agora podem clicar nos botões para criar tickets automaticamente!`
            });

            console.log(`✅ Painel de tickets criado por ${interaction.user.tag} em ${targetChannel.name}`);

        } catch (error) {
            console.error('❌ Erro ao criar painel de tickets:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Erro ao criar painel de tickets.',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: '❌ Erro ao criar painel de tickets.'
                });
            }
        }
    },
};
