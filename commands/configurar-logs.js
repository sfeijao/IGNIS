const { 
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const RobustWebhookManager = require('../utils/RobustWebhookManager');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurar-logs')
        .setDescription('Sistema robusto de configuração de webhooks para logs')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('adicionar')
                .setDescription('Configura webhook para logs (testado automaticamente)')
                .addStringOption(option =>
                    option
                        .setName('webhook')
                        .setDescription('URL do webhook do Discord')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('tipos')
                        .setDescription('Tipos de logs (padrão: apenas fechamentos)')
                        .addChoices(
                            { name: 'Apenas fechamentos', value: 'close' },
                            { name: 'Criação e fechamentos', value: 'create,close' },
                            { name: 'Todos (criar, assumir, fechar)', value: 'create,claim,close' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Mostra configuração atual e testa conexão'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('testar')
                .setDescription('Envia mensagem de teste'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remover')
                .setDescription('Remove configuração de webhook')),

    async execute(interaction) {
        const webhookManager = new RobustWebhookManager();
        
        try {
            await interaction.deferReply({ flags: 64 }); // MessageFlags.Ephemeral
        } catch (error) {
            logger.error('Erro no defer:', error);
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'adicionar': {
                    const webhookUrl = interaction.options.getString('webhook');
                    const tiposOption = interaction.options.getString('tipos') || 'close';
                    
                    let tipos = ['ticket_close']; // Padrão
                    if (tiposOption === 'create,close') {
                        tipos = ['ticket_create', 'ticket_close'];
                    } else if (tiposOption === 'create,claim,close') {
                        tipos = ['ticket_create', 'ticket_claim', 'ticket_close'];
                    }

                    await interaction.editReply({
                        content: '🔄 **Configurando webhook...**\n\n• Validando URL...\n• Testando conexão...\n• Salvando configuração...'
                    });

                    const result = await webhookManager.setWebhook(
                        interaction.guildId,
                        interaction.guild.name,
                        webhookUrl,
                        tipos
                    );

                    if (result.success) {
                        const tiposTexto = tipos.map(t => t.replace('ticket_', '')).join(', ');
                        await interaction.editReply({
                            content: `✅ **Webhook configurado com sucesso!**\n\n📋 **Detalhes:**\n• **Servidor:** ${interaction.guild.name}\n• **Tipos de log:** ${tiposTexto}\n• **Status:** Ativo e testado\n• **Persistência:** Automática (sobrevive a redeploys)\n\n🎯 **Pronto para usar!** Os logs serão enviados automaticamente.`
                        });
                    } else {
                        await interaction.editReply({
                            content: `❌ **Erro ao configurar webhook**\n\n🚫 **Motivo:** ${result.error}\n\n💡 **Dicas:**\n• Verifique se a URL está correta\n• Certifique-se que o webhook existe\n• Teste com outro webhook se necessário`
                        });
                    }
                    break;
                }

                case 'status': {
                    await interaction.editReply({
                        content: '🔍 **Verificando configuração...**'
                    });

                    const status = await webhookManager.getStatus(interaction.guildId);
                    
                    if (status.configured && status.enabled) {
                        const tiposTexto = status.types.map(t => t.replace('ticket_', '')).join(', ');
                        const urlMask = status.url ? `${status.url.substring(0, 50)}...` : 'N/A';
                        
                        await interaction.editReply({
                            content: `✅ **Webhook Configurado e Ativo**\n\n📋 **Configuração Atual:**\n• **Nome:** ${status.name}\n• **URL:** \`${urlMask}\`\n• **Tipos:** ${tiposTexto}\n• **Criado:** <t:${Math.floor(new Date(status.created).getTime() / 1000)}:R>\n\n🟢 **Status:** Funcionando corretamente\n\n💡 Use \`/configurar-logs testar\` para enviar mensagem de teste.`
                        });
                    } else if (status.configured) {
                        await interaction.editReply({
                            content: `⚠️ **Webhook Configurado mas Inativo**\n\n❌ **Problema detectado**\n• Webhook existe mas não está funcionando\n• Pode ter sido removido do Discord\n\n🔧 **Solução:** Reconfigure com \`/configurar-logs adicionar\``
                        });
                    } else {
                        await interaction.editReply({
                            content: `❌ **Webhook Não Configurado**\n\n📝 **Para configurar:**\n1. Crie um webhook no canal de logs\n2. Use \`/configurar-logs adicionar webhook:[URL]\`\n\n💡 **Dica:** O sistema testará automaticamente se o webhook funciona.`
                        });
                    }
                    break;
                }

                case 'testar': {
                    await interaction.editReply({
                        content: '🧪 **Enviando mensagem de teste...**'
                    });

                    const testData = {
                        sequentialId: 999,
                        channelId: interaction.channelId,
                        guild: interaction.guild,
                        author: { 
                            id: '123456789',
                            username: 'TestUser',
                            tag: 'TestUser#1234'
                        },
                        closedBy: interaction.user,
                        transcript: 'Esta é uma transcrição de teste para verificar se o webhook está funcionando corretamente.'
                    };

                    const result = await webhookManager.sendLog(interaction.guildId, 'ticket_close', testData);

                    if (result.success) {
                        await interaction.editReply({
                            content: '✅ **Teste enviado com sucesso!**\n\n🎯 Verifique seu canal de logs para ver a mensagem de teste.\n\n💡 Se não apareceu, verifique se o webhook ainda existe no Discord.'
                        });
                    } else if (result.reason === 'not_configured') {
                        await interaction.editReply({
                            content: '❌ **Webhook não configurado**\n\n� Configure primeiro com `/configurar-logs adicionar`'
                        });
                    } else {
                        await interaction.editReply({
                            content: `❌ **Erro no teste**\n\n🚫 **Problema:** ${result.error || result.reason}\n\n🔧 **Solução:** Reconfigure o webhook`
                        });
                    }
                    break;
                }

                case 'remover': {
                    const result = await webhookManager.removeWebhook(interaction.guildId);
                    
                    if (result.success) {
                        await interaction.editReply({
                            content: '✅ **Webhook removido com sucesso!**\n\nOs logs não serão mais enviados até configurar novamente.'
                        });
                    } else {
                        await interaction.editReply({
                            content: `❌ **Erro:** ${result.error}`
                        });
                    }
                    break;
                }
            }
        } catch (error) {
            logger.error('Erro no comando configurar-logs:', error);
            try {
                await interaction.editReply({
                    content: `❌ **Erro interno**\n\n🚫 ${error.message}\n\n🔧 Tente novamente ou contate o suporte.`
                });
            } catch (replyError) {
                logger.error('Erro ao responder erro:', replyError);
            }
        }
    }
};
