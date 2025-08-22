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
                .setColor('#9932CC')
                .setTitle('🎫 SISTEMA DE SUPORTE 🎫')
                .setDescription(`**Bem-vindo ao sistema de suporte da YSNM Community!**\n\n` +
                    `Precisas de ajuda? Cria um ticket e a nossa equipa irá ajudar-te rapidamente.\n\n` +
                    `**🎯 Categorias Disponíveis:**\n` +
                    `🛠️ **Suporte Técnico** - Problemas com bots, comandos ou funcionalidades\n` +
                    `🚨 **Reportar Problema** - Bugs, erros ou comportamentos inesperados\n` +
                    `💡 **Sugestão** - Ideias para melhorar o servidor\n\n` +
                    `**📋 Como funciona:**\n` +
                    `1️⃣ Clica no botão da categoria apropriada\n` +
                    `2️⃣ Preenche o formulário com detalhes\n` +
                    `3️⃣ Um canal privado será criado para ti\n` +
                    `4️⃣ A nossa equipa irá responder rapidamente\n\n` +
                    `**⚠️ Regras importantes:**\n` +
                    `• Só podes ter 1 ticket aberto de cada vez\n` +
                    `• Usa a categoria correta para o teu problema\n` +
                    `• Sê claro e detalhado na descrição\n` +
                    `• Respeita a equipa de suporte\n\n` +
                    `✨ **Sistema ativo e pronto para usar!**`)
                .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }))
                .setFooter({ 
                    text: 'YSNM COMMUNITY™ • Sistema de Suporte Técnico • 2025'
                })
                .setTimestamp();

            // Criar botões
            const row = new ActionRowBuilder()
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

            // Enviar painel no canal especificado
            const message = await targetChannel.send({
                embeds: [embed],
                components: [row]
            });

            // Responder ao comando
            await interaction.editReply({
                content: `✅ **Painel de tickets criado com sucesso!**
                
**📋 Detalhes:**
• **Canal**: ${targetChannel}
• **ID da Mensagem**: \`${message.id}\`
• **3 categorias** de suporte disponíveis
• **Sistema ativo** e pronto para usar

Os utilizadores agora podem clicar nos botões para criar tickets automaticamente!`
            });

            console.log(`✅ Painel de tickets criado por ${interaction.user.tag} em ${targetChannel.name}`);

        } catch (error) {
            console.error('❌ Erro ao criar painel de tickets:', error);
            
            // Verifica se a interação ainda pode ser respondida
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Erro ao criar painel de tickets.',
                        ephemeral: true
                    });
                } else if (interaction.deferred) {
                    await interaction.editReply({
                        content: '❌ Erro ao criar painel de tickets.'
                    });
                }
            } catch (responseError) {
                console.error('❌ Erro ao responder interação:', responseError);
            }
        }
    },
};
