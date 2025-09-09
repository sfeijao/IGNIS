const { 
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-logs')
        .setDescription('Configura o webhook para logs de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('adicionar')
                .setDescription('Adiciona ou atualiza o webhook de logs')
                .addStringOption(option =>
                    option
                        .setName('webhook')
                        .setDescription('URL do webhook do Discord')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remover')
                .setDescription('Remove o webhook de logs atual'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('testar')
                .setDescription('Envia uma mensagem de teste para o webhook')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const webhookManager = interaction.client.ticketManager.webhooks;

        try {
            switch (subcommand) {
                case 'adicionar': {
                    const webhookUrl = interaction.options.getString('webhook');

                    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                        return await interaction.editReply({
                            content: '❌ URL de webhook inválida! Certifique-se de copiar a URL completa do webhook.',
                            ephemeral: true
                        });
                    }

                    const success = await webhookManager.addWebhook(
                        interaction.guildId,
                        interaction.guild.name,
                        webhookUrl
                    );

                    if (success) {
                        await interaction.editReply({
                            content: '✅ Webhook de logs configurado com sucesso!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: '❌ Erro ao configurar webhook. Verifique a URL e tente novamente.',
                            ephemeral: true
                        });
                    }
                    break;
                }

                case 'remover': {
                    const success = await webhookManager.removeWebhook(interaction.guildId);

                    if (success) {
                        await interaction.editReply({
                            content: '✅ Webhook de logs removido com sucesso!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: '❌ Erro ao remover webhook.',
                            ephemeral: true
                        });
                    }
                    break;
                }

                case 'testar': {
                    const testEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('🧪 Teste de Webhook')
                        .setDescription('Se você está vendo esta mensagem, o webhook está funcionando corretamente!')
                        .addFields(
                            { name: 'Servidor', value: interaction.guild.name, inline: true },
                            { name: 'Configurado por', value: interaction.user.tag, inline: true }
                        )
                        .setTimestamp();

                    await webhookManager.sendTicketLog(interaction.guildId, 'test', {
                        guild: interaction.guild,
                        author: interaction.user,
                        ticketId: 'TEST-001',
                        category: 'Teste'
                    });

                    await interaction.editReply({
                        content: '✅ Mensagem de teste enviada! Verifique o canal de logs.',
                        ephemeral: true
                    });
                    break;
                }
            }
        } catch (error) {
            console.error('Erro ao executar comando de webhook:', error);
            await interaction.editReply({
                content: '❌ Ocorreu um erro ao processar o comando. Tente novamente mais tarde.',
                ephemeral: true
            });
        }
    }
};
