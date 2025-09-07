const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info-servidor')
        .setDescription('Mostra informações detalhadas do servidor'),
    
    async execute(interaction) {
        const guild = interaction.guild;
        
        // Contar membros por status
        const totalMembers = guild.memberCount;
        const verifiedMembers = guild.members.cache.filter(member => 
            member.roles.cache.has(config.roles.verified)).size;
        const unverifiedMembers = guild.members.cache.filter(member => 
            member.roles.cache.has(config.roles.unverified)).size;
        const onlineMembers = guild.members.cache.filter(member => 
            member.presence?.status === 'online').size;
        
        // Contar cargos especiais
        const staffMembers = guild.members.cache.filter(member => 
            member.roles.cache.has(config.roles.staff)).size;
        const adminMembers = guild.members.cache.filter(member => 
            member.roles.cache.has(config.roles.admin)).size;
        const vipMembers = guild.members.cache.filter(member => 
            member.roles.cache.has(config.roles.vip)).size;

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
            .setFooter({ text: `YSNM Community • Sistema de Informações` });

        await interaction.reply({ embeds: [embed] });
    },
};
