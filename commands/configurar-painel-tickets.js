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

            // Verificar e configurar cargo de staff
            let staffRole = interaction.guild.roles.cache.find(r => r.name === 'Staff');
            if (!staffRole) {
                // Criar cargo de staff se não existir
                staffRole = await interaction.guild.roles.create({
                    name: 'Staff',
                    color: '#2ecc71',
                    reason: 'Cargo automático para sistema de tickets',
                    permissions: []
                });
            }

            // Salvar configurações no banco de dados
            try {
                const storage = require('../utils/storage');
                await storage.updateGuildConfig(interaction.guild.id, {
                    ticketStaffRoleId: staffRole.id,
                    ticketChannelId: targetChannel.id
                });
            } catch (error) {
                console.error('Erro ao salvar configurações:', error);
                return await interaction.editReply({
                    content: '❌ Erro ao salvar configurações. Tente novamente.',
                    ephemeral: true
                });
            }

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
                content: `✅ **Painel de tickets configurado com sucesso!**
                
**📋 Detalhes da Configuração:**
• **Canal do Painel**: ${targetChannel}
• **Cargo Staff**: ${staffRole}
• **ID da Mensagem**: \`${message.id}\`
• **ID do Cargo Staff**: \`${staffRole.id}\`
• **3 categorias** de suporte disponíveis

**✨ Sistema Configurado:**
• Painel de tickets criado
• Cargo de staff configurado
• Permissões verificadas
• Base de dados atualizada
• Sistema ativo e pronto para usar

**📝 Próximos Passos:**
1. Adicione o cargo ${staffRole} aos membros da equipe
2. Teste criando um ticket
3. Verifique se a equipe recebe as notificações

Use \`/configurar-painel-tickets\` novamente se precisar reconfigurar.`
            });

            const logger = require('../utils/logger');
            logger.info(`✅ Painel de tickets criado por ${interaction.user.tag} em ${targetChannel.name}`);

        } catch (error) {
            logger.error('❌ Erro ao criar painel de tickets:', { error });
            
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
                logger.error('❌ Erro ao responder interação:', { error: responseError });
            }
        }
    },
};
