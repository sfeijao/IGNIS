const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remover-cargo')
        .setDescription('Remove um cargo de um utilizador')
        .addUserOption(option =>
            option.setName('utilizador')
                .setDescription('O utilizador que vai perder o cargo')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('cargo')
                .setDescription('O cargo a ser removido')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    
    async execute(interaction) {
        // Verificar permissões (incluindo owner)
        const config = await storage.getGuildConfig(interaction.guild.id);
        const isOwner = interaction.user.id === '381762006329589760';
        const hasStaffRole = (config.roles?.admin && interaction.member.roles.cache.has(config.roles.admin)) || 
                           (config.roles?.staff && interaction.member.roles.cache.has(config.roles.staff));
        const hasAdminPerm = interaction.member.permissions.has('ManageRoles');
        
        if (!isOwner && !hasStaffRole && !hasAdminPerm) {
            return interaction.reply({ 
                content: '❌ Não tens permissão para usar este comando!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        const targetUser = interaction.options.getUser('utilizador');
        const targetRole = interaction.options.getRole('cargo');
        const targetMember = interaction.guild.members.cache.get(targetUser.id);

        if (!targetMember) {
            return interaction.reply({ 
                content: '❌ Utilizador não encontrado no servidor!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        if (!targetMember.roles.cache.has(targetRole.id)) {
            return interaction.reply({ 
                content: `❌ ${targetUser.tag} não possui o cargo **${targetRole.name}**!`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        try {
            await targetMember.roles.remove(targetRole);
            
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Cargo Removido')
                .setDescription(`Cargo **${targetRole.name}** foi removido de ${targetUser.tag}`)
                .addFields([
                    { name: 'Utilizador', value: `${targetUser.tag}`, inline: true },
                    { name: 'Cargo', value: `${targetRole.name}`, inline: true },
                    { name: 'Staff', value: `${interaction.user.tag}`, inline: true }
                ])
                .setTimestamp()
                .setFooter({ text: 'Sistema de Gestão de Cargos' });

            await interaction.reply({ embeds: [embed] });

            // Enviar mensagem para canal específico de cargos
            const cargoLogsChannel = config.channels?.cargoLogs ? interaction.guild.channels.cache.get(config.channels.cargoLogs) : null;
            if (cargoLogsChannel) {
                cargoLogsChannel.send({ embeds: [embed] });
            }

            // Log para canal de logs geral
            const logsChannel = config.channels?.logs ? interaction.guild.channels.cache.get(config.channels.logs) : null;
            if (logsChannel) {
                logsChannel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Erro ao remover cargo:', error);
            await interaction.reply({ 
                content: '❌ Erro ao remover o cargo. Verifica se o bot tem permissões adequadas.', 
                flags: MessageFlags.Ephemeral 
            });
        }
    },
};
