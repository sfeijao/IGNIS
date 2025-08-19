const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Comandos slash
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`Comando ${interaction.commandName} não encontrado.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('Erro ao executar comando:', error);
                
                const errorMessage = {
                    content: '❌ Houve um erro ao executar este comando!',
                    ephemeral: true
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }

        // Botões específicos para gestão de tags (staff)
        if (interaction.isButton()) {
            const { customId } = interaction;
            
            if (customId === 'add_tag_staff' || customId === 'remove_tag_staff' || customId === 'manage_roles_staff') {
                // Verificar se é staff
                if (!interaction.member.roles.cache.has(config.roles.admin) && 
                    !interaction.member.roles.cache.has(config.roles.staff) &&
                    !interaction.member.roles.cache.has(config.roles.owner)) {
                    return interaction.reply({ 
                        content: '❌ Apenas staff pode usar este painel!', 
                        ephemeral: true 
                    });
                }

                let title = '';
                let description = '';
                
                switch (customId) {
                    case 'add_tag_staff':
                        title = '✅ Adicionar Tag';
                        description = 'Para adicionar uma tag, usa o comando:\n`/dar-cargo @utilizador cargo`';
                        break;
                    case 'remove_tag_staff':
                        title = '❌ Remover Tag';
                        description = 'Para remover uma tag, usa o comando:\n`/remover-cargo @utilizador cargo`';
                        break;
                    case 'manage_roles_staff':
                        title = '⚙️ Gerir Cargos';
                        description = 'Painel de gestão avançada de cargos:\n• Use `/listar-cargos` para ver todos\n• Use `/criar-cargo` para criar novos\n• Use `/eliminar-cargo` para remover';
                        break;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setTitle(title)
                    .setDescription(description)
                    .setTimestamp()
                    .setFooter({ text: 'Painel Staff • YSNM Community' });

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }

        // Select menu para pedidos de tags
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'tag_request_select') {
                const selectedTag = interaction.values[0];
                const guild = interaction.guild;
                const member = interaction.member;
                
                // Verificar se está verificado
                if (!member.roles.cache.has(config.roles.verified)) {
                    return interaction.reply({ 
                        content: '❌ Precisas estar verificado para solicitar tags!', 
                        ephemeral: true 
                    });
                }

                let roleId = '';
                let tagName = '';
                
                switch (selectedTag) {
                    case 'vip_tag':
                        roleId = config.roles.vip;
                        tagName = 'VIP';
                        break;
                    case 'member_tag':
                        roleId = config.roles.member;
                        tagName = 'Member';
                        break;
                    case 'mod_tag':
                        roleId = config.roles.mod;
                        tagName = 'Mod';
                        break;
                    case 'support_tag':
                        roleId = config.roles.support;
                        tagName = 'Support';
                        break;
                }

                // Para cargos especiais (mod, support), enviar pedido para staff
                if (selectedTag === 'mod_tag' || selectedTag === 'support_tag') {
                    const solicitarChannel = guild.channels.cache.get(config.channels.solicitarTag);
                    if (solicitarChannel) {
                        const requestEmbed = new EmbedBuilder()
                            .setColor(0xffff00)
                            .setTitle('🏷️ Pedido de Tag Especial')
                            .setDescription(`**Utilizador:** ${member.user.tag}\n**Tag Solicitada:** ${tagName}\n**Razão:** Tag administrativa especial`)
                            .addFields([
                                { name: 'ID do Utilizador', value: member.user.id, inline: true },
                                { name: 'Nickname', value: member.displayName, inline: true },
                                { name: 'Data do Pedido', value: new Date().toLocaleString('pt-PT'), inline: true }
                            ])
                            .setTimestamp()
                            .setFooter({ text: 'Pedido aguarda aprovação da staff' });

                        await solicitarChannel.send({ embeds: [requestEmbed] });
                        
                        await interaction.reply({ 
                            content: `✅ Pedido de tag **${tagName}** enviado para a staff! Aguarda aprovação.`, 
                            ephemeral: true 
                        });
                    } else {
                        await interaction.reply({ 
                            content: '❌ Canal de solicitações não configurado. Contacta a administração.', 
                            ephemeral: true 
                        });
                    }
                } else {
                    // Para tags básicas, atribuir diretamente
                    const role = guild.roles.cache.get(roleId);
                    if (!role) {
                        return interaction.reply({ 
                            content: '❌ Cargo não encontrado!', 
                            ephemeral: true 
                        });
                    }

                    if (member.roles.cache.has(roleId)) {
                        await member.roles.remove(role);
                        await interaction.reply({ 
                            content: `✅ Tag **${tagName}** removida!`, 
                            ephemeral: true 
                        });
                    } else {
                        await member.roles.add(role);
                        await interaction.reply({ 
                            content: `✅ Tag **${tagName}** adicionada!`, 
                            ephemeral: true 
                        });
                    }
                }
            }
        }
    },
};
