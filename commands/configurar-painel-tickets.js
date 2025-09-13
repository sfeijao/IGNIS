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

            // Criar embed do painel
            const embed = new EmbedBuilder()
                .setColor('#9932CC')
                .setTitle('🎫 SISTEMA DE SUPORTE')
                .setDescription([
                    '**Bem-vindo ao sistema de suporte!**',
                    '',
                    '**🎯 Categorias:**',
                    '🛠️ **Suporte** - Ajuda geral',
                    '🐛 **Bugs** - Reportar problemas',
                    '🚨 **Denúncias** - Reportar utilizadores',
                    '',
                    '**📋 Como usar:**',
                    '1️⃣ Clica numa categoria',
                    '2️⃣ Descreve o problema',
                    '3️⃣ Aguarda resposta da equipa',
                    '',
                    '✨ **Sistema com auto-detecção ativo!**'
                ].join('\n'))
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setTimestamp();

            // Criar botões
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket:create:suporte')
                        .setLabel('Suporte')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🛠️'),
                    new ButtonBuilder()
                        .setCustomId('ticket:create:bugs')
                        .setLabel('Bugs')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🐛'),
                    new ButtonBuilder()
                        .setCustomId('ticket:create:denuncias')
                        .setLabel('Denúncias')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🚨')
                );

            // Enviar painel
            const message = await targetChannel.send({
                embeds: [embed],
                components: [row]
            });

            // Resposta de sucesso
            const responseText = [
                '✅ **Painel configurado!**',
                '',
                `📍 **Canal:** ${targetChannel}`,
                `🛡️ **Staff detectados:** ${autoConfigResult.detected.length}`,
                `⚙️ **Cargos configurados:** ${autoConfigResult.configured.length}`,
                '',
                '**Comandos úteis:**',
                '• `/diagnostico-tickets` - Ver detalhes',
                '• `/auto-configurar-tickets` - Reconfigurar',
                '',
                '🚀 **Sistema pronto para usar!**'
            ].join('\n');

            await interaction.editReply({ content: responseText });

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