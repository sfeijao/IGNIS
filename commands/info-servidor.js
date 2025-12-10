const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../utils/storage');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info-servidor')
        .setDescription('Mostra informações detalhadas do servidor'),

    async execute(interaction) {
        try {
        const guild = interaction.guild;

        // Obter configuração do servidor
        let config = {};
        try {
            config = await storage.getGuildConfig(guild.id) || {};
        } catch (e) {
            logger.debug('[info-servidor] Erro ao obter config:', e);
        }

        // Contar membros por status
        const totalMembers = guild.memberCount;
        const verifiedMembers = config.roles?.verified
            ? guild.members.cache.filter(member => member.roles.cache.has(config.roles.verified)).size
            : 0;
        const unverifiedMembers = config.roles?.unverified
            ? guild.members.cache.filter(member => member.roles.cache.has(config.roles.unverified)).size
            : 0;
        const onlineMembers = guild.members.cache.filter(member =>
            member.presence?.status === 'online').size;

        // Contar cargos especiais
        const staffMembers = config.roles?.staff
            ? guild.members.cache.filter(member => member.roles.cache.has(config.roles.staff)).size
            : 0;
        const adminMembers = config.roles?.admin
            ? guild.members.cache.filter(member => member.roles.cache.has(config.roles.admin)).size
            : 0;
        const vipMembers = config.roles?.vip
            ? guild.members.cache.filter(member => member.roles.cache.has(config.roles.vip)).size
            : 0;

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📊 Informações do ${guild.name}`)
            .setDescription('Estatísticas detalhadas do servidor')
            .setThumbnail(guild.iconURL())
            .addFields([
                { name: '👥 Total de Membros', value: `${totalMembers}`, inline: true },
                { name: '✅ Verificados', value: `${verifiedMembers}`, inline: true },
                { name: '❌ Não Verificados', value: `${unverifiedMembers}`, inline: true },
                { name: '🟢 Online', value: `${onlineMembers}`, inline: true },
                { name: '👑 Staff', value: `${staffMembers}`, inline: true },
                { name: '🛡️ Admins', value: `${adminMembers}`, inline: true },
                { name: '⭐ VIP', value: `${vipMembers}`, inline: true },
                { name: '📅 Criado em', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
                { name: '🆔 ID do Servidor', value: `${guild.id}`, inline: true },
                { name: '👨‍💼 Dono', value: `<@${guild.ownerId}>`, inline: true },
                { name: '💬 Canais', value: `${guild.channels.cache.size}`, inline: true },
                { name: '🏷️ Cargos', value: `${guild.roles.cache.size}`, inline: true }
            ])
            .setTimestamp()
            .setFooter({ text: `IGNIS Community • Sistema de Informações` });

        await interaction.reply({ embeds: [embed] });
        } catch (error) {
            logger.error('[info-servidor] Erro:', error);
            const errorReply = {
                content: `❌ Erro ao obter informações do servidor: ${error.message}`,
                flags: MessageFlags.Ephemeral
            };
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorReply).catch(() => {});
            } else {
                await interaction.reply(errorReply).catch(() => {});
            }
        }
    },
};
