const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dar-cargo')
        .setDescription('Adiciona um cargo a um utilizador')
        .addUserOption(option =>
            option.setName('utilizador')
                .setDescription('O utilizador que vai receber o cargo')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('cargo')
                .setDescription('O cargo a ser adicionado')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    
    async execute(interaction) {
        // Verificar permissões
        if (!interaction.member.roles.cache.has(config.roles.admin) && 
            !interaction.member.roles.cache.has(config.roles.staff) &&
            !interaction.member.roles.cache.has(config.roles.owner)) {
            return interaction.reply({ 
                content: '❌ Não tens permissão para usar este comando!', 
                ephemeral: true 
            });
        }

        const targetUser = interaction.options.getUser('utilizador');
        const targetRole = interaction.options.getRole('cargo');
        const targetMember = interaction.guild.members.cache.get(targetUser.id);

        if (!targetMember) {
            return interaction.reply({ 
                content: '❌ Utilizador não encontrado no servidor!', 
                ephemeral: true 
            });
        }

        if (targetMember.roles.cache.has(targetRole.id)) {
            return interaction.reply({ 
                content: `❌ ${targetUser.tag} já possui o cargo **${targetRole.name}**!`, 
                ephemeral: true 
            });
        }

        try {
            await targetMember.roles.add(targetRole);
            
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('✅ Cargo Adicionado')
                .setDescription(`Cargo **${targetRole.name}** foi adicionado a ${targetUser.tag}`)
                .addFields([
                    { name: 'Utilizador', value: `${targetUser.tag}`, inline: true },
                    { name: 'Cargo', value: `${targetRole.name}`, inline: true },
                    { name: 'Staff', value: `${interaction.user.tag}`, inline: true }
                ])
                .setTimestamp()
                .setFooter({ text: 'Sistema de Gestão de Cargos' });

            await interaction.reply({ embeds: [embed] });

            // Enviar mensagem para canal específico de cargos
            const cargoLogsChannel = interaction.guild.channels.cache.get(config.channels.cargoLogs);
            if (cargoLogsChannel) {
                cargoLogsChannel.send({ embeds: [embed] });
            }

            // Log para canal de logs geral
            const logsChannel = interaction.guild.channels.cache.get(config.channels.logs);
            if (logsChannel) {
                logsChannel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Erro ao adicionar cargo:', error);
            await interaction.reply({ 
                content: '❌ Erro ao adicionar o cargo. Verifica se o bot tem permissões adequadas.', 
                ephemeral: true 
            });
        }
    },
};
