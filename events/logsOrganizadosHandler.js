const { Events, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');
const logger = require('../utils/logger');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        // Apenas processar select menus de configuração de logs
        if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('select_log_channel_')) return;

        try {
            const servidorOrigem = interaction.customId.split('_')[3]; // select_log_channel_ignis -> ignis
            const canalSelecionado = interaction.values[0];

            await interaction.deferUpdate();

            // Buscar informações do canal
            const logServer = await interaction.client.guilds.fetch('1408278468822565075');
            const canal = await logServer.channels.fetch(canalSelecionado);

            if (!canal) {
                return await interaction.editReply({
                    content: '❌ Canal não encontrado!',
                    embeds: [],
                    components: []
                });
            }

            // Buscar webhooks existentes no canal
            const webhooks = await canal.fetchWebhooks();
            const webhook = webhooks.first();

            if (!webhook) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF9800)
                    .setTitle('⚠️ Webhook Não Encontrado')
                    .setDescription(
                        `O canal **${canal.name}** não tem nenhum webhook configurado.\n\n` +
                        `📋 **Como resolver:**\n` +
                        `1. Vá para as configurações do canal **${canal.name}**\n` +
                        `2. Clique em **Integrações**\n` +
                        `3. Clique em **Criar Webhook**\n` +
                        `4. Configure o webhook\n` +
                        `5. Execute este comando novamente\n\n` +
                        `🔄 **Ou** posso criar um webhook automaticamente para você.`
                    )
                    .addFields(
                        { name: '📋 Canal Selecionado', value: `#${canal.name}`, inline: true },
                        { name: '📁 Categoria', value: canal.parent?.name || 'Sem categoria', inline: true }
                    )
                    .setFooter({ text: 'Webhook necessário para enviar logs cross-server' })
                    .setTimestamp();

                // Tentar criar webhook automaticamente
                try {
                    const novoWebhook = await canal.createWebhook({
                        name: `IGNIS Logs - ${servidorOrigem.toUpperCase()}`,
                        avatar: 'https://cdn.discordapp.com/avatars/1404584949285388339/3c28165b10ffdde42c3f76692513ca25.webp',
                        reason: `Configuração automática de logs para ${servidorOrigem.toUpperCase()}`
                    });

                    await this.salvarConfiguracao(interaction, servidorOrigem, canal, novoWebhook);

                } catch (webhookError) {
                    logger.warn(`Erro ao criar webhook automaticamente: ${webhookError.message}`);
                    return await interaction.editReply({
                        embeds: [embed],
                        components: []
                    });
                }
            } else {
                // Webhook já existe, usar ele
                await this.salvarConfiguracao(interaction, servidorOrigem, canal, webhook);
            }

        } catch (error) {
            logger.error('Erro ao processar seleção de canal de logs:', error);
            await interaction.editReply({
                content: `❌ Erro ao configurar: ${error.message}`,
                embeds: [],
                components: []
            });
        }
    },

    async salvarConfiguracao(interaction, servidorOrigem, canal, webhook) {
        try {
            // Salvar configuração
            const config = await storage.getGuildConfig(interaction.guild.id) || {};

            if (!config.logsOrganizados) config.logsOrganizados = {};

            config.logsOrganizados[servidorOrigem] = {
                canalId: canal.id,
                canalNome: canal.name,
                categoria: canal.parent?.name || null,
                webhookUrl: webhook.url,
                webhookId: webhook.id,
                configuradoEm: new Date().toISOString(),
                configuradoPor: interaction.user.id
            };

            // Persistir corretamente: usar updateGuildConfig para salvar a chave logsOrganizados
            try {
                if (typeof storage.updateGuildConfig === 'function') {
                    await storage.updateGuildConfig(interaction.guild.id, { logsOrganizados: config.logsOrganizados });
                } else if (typeof storage.setGuildConfig === 'function') {
                    await storage.setGuildConfig(interaction.guild.id, 'logsOrganizados', config.logsOrganizados);
                }
            } catch (persistErr) {
                logger.warn('Falha ao persistir logsOrganizados:', persistErr?.message || persistErr);
            }

            // Testar webhook
            await webhook.send({
                embeds: [{
                    title: '✅ Logs Configurados!',
                    description: `Sistema de logs para **${servidorOrigem.toUpperCase()}** configurado com sucesso!`,
                    color: 0x4CAF50,
                    fields: [
                        { name: '📋 Canal', value: `#${canal.name}`, inline: true },
                        { name: '📁 Categoria', value: canal.parent?.name || 'Sem categoria', inline: true },
                        { name: '👤 Configurado por', value: `<@${interaction.user.id}>`, inline: true }
                    ],
                    timestamp: new Date(),
                    footer: { text: 'IGNIS Logs Organizados - Sistema Ativo' }
                }]
            });

            const successEmbed = new EmbedBuilder()
                .setColor(0x4CAF50)
                .setTitle('🎉 Logs Configurados com Sucesso!')
                .setDescription(
                    `Sistema de logs para **${servidorOrigem.toUpperCase()}** foi configurado!\n\n` +
                    `📋 **Canal**: #${canal.name}\n` +
                    `📁 **Categoria**: ${canal.parent?.name || 'Sem categoria'}\n` +
                    `🔗 **Webhook**: ✅ Configurado e testado\n\n` +
                    `🎯 **Próximo passo**: Os tickets criados no servidor **${servidorOrigem.toUpperCase()}** ` +
                    `agora serão logados automaticamente no canal **#${canal.name}**.`
                )
                .addFields(
                    { name: '⚙️ Status', value: '✅ Ativo', inline: true },
                    { name: '🕒 Configurado em', value: new Date().toLocaleString('pt-BR'), inline: true }
                )
                .setFooter({ text: 'Sistema de Logs Organizados IGNIS' })
                .setTimestamp();

            await interaction.editReply({
                embeds: [successEmbed],
                components: []
            });

            logger.info(`✅ Logs configurados: ${servidorOrigem.toUpperCase()} -> #${canal.name} por ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Erro ao salvar configuração de logs:', error);
            throw error;
        }
    }
};
