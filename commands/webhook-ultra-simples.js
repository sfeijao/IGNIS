const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { WebhookClient } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('webhook-ultra-simples')
        .setDescription('🔧 Configurar webhook de forma ULTRA SIMPLES - uma linha, funciona 100%')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('URL do webhook')
                .setRequired(true)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const webhookUrl = interaction.options.getString('url');
            const guildId = interaction.guildId;
            
            // ========================
            // PASSO 1: SALVAR DIRETO NO ARQUIVO
            // ========================
            const configPath = path.join(__dirname, '../config/webhooks.json');
            
            // Ler arquivo atual
            let config;
            try {
                const data = await fs.readFile(configPath, 'utf8');
                config = JSON.parse(data);
            } catch {
                config = { webhooks: {}, logTypes: {}, config: {} };
            }
            
            // Configurar webhook
            if (!config.webhooks) config.webhooks = {};
            config.webhooks[guildId] = {
                enabled: true,
                webhookUrl: webhookUrl,
                name: guildId === '1333820000791691284' ? 'YSNM COMMUNITY' : 'BEANNY',
                updatedAt: new Date().toISOString()
            };
            
            // Salvar arquivo
            await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
            
            // ========================
            // PASSO 2: TESTAR WEBHOOK
            // ========================
            const webhook = new WebhookClient({ url: webhookUrl });
            await webhook.send({
                content: `✅ **TESTE DE WEBHOOK**\n🏷️ **Servidor:** ${interaction.guild.name}\n⏰ **Data:** ${new Date().toLocaleString('pt-BR')}\n\n🎯 **CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!**\nEste webhook está funcionando e configurado para receber logs de tickets.`
            });
            
            // ========================
            // RESPOSTA FINAL
            // ========================
            await interaction.editReply({
                content: `🎉 **WEBHOOK CONFIGURADO COM SUCESSO!**

✅ **Status:** FUNCIONANDO 100%
🔗 **Webhook:** Configurado e testado
📝 **Arquivo:** \`config/webhooks.json\` atualizado
🏷️ **Servidor:** ${interaction.guild.name}

**O que acontece agora:**
• Quando um ticket for fechado, o log será enviado automaticamente
• Inclui informações completas: autor, staff, timestamps, transcript
• Sistema 100% funcional, sem mais comandos necessários

**Para verificar status:** \`/status-logs\``
            });
            
        } catch (error) {
            console.error('❌ Erro no webhook-ultra-simples:', error);
            
            await interaction.editReply({
                content: `❌ **ERRO NA CONFIGURAÇÃO**

**Detalhes do erro:** ${error.message}

**Possíveis causas:**
• URL do webhook inválida
• Webhook foi deletado no Discord
• Permissões insuficientes

**Solução:** Verifique a URL do webhook e tente novamente.`
            });
        }
    }
};