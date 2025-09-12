const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { WebhookClient } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status-real')
        .setDescription('🔍 Ver o status REAL do sistema de logs - sem mentiras, direto do arquivo'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const guildId = interaction.guildId;
            const configPath = path.join(__dirname, '../config/webhooks.json');
            
            // ========================
            // LER ARQUIVO DIRETO
            // ========================
            let config;
            let fileExists = false;
            
            try {
                const data = await fs.readFile(configPath, 'utf8');
                config = JSON.parse(data);
                fileExists = true;
            } catch (error) {
                config = null;
            }
            
            // ========================
            // VERIFICAR CONFIGURAÇÃO
            // ========================
            let webhookConfigured = false;
            let webhookUrl = null;
            let webhookWorking = false;
            
            if (config && config.webhooks && config.webhooks[guildId]) {
                const guildConfig = config.webhooks[guildId];
                if (guildConfig.enabled && guildConfig.webhookUrl && !guildConfig.webhookUrl.includes('SEU_WEBHOOK_URL')) {
                    webhookConfigured = true;
                    webhookUrl = guildConfig.webhookUrl;
                }
            }
            
            // ========================
            // TESTAR WEBHOOK
            // ========================
            if (webhookConfigured) {
                try {
                    const webhook = new WebhookClient({ url: webhookUrl });
                    await webhook.send({
                        content: `🔍 **TESTE DE STATUS**\n⏰ ${new Date().toLocaleString('pt-BR')}\n✅ Webhook funcionando perfeitamente!`
                    });
                    webhookWorking = true;
                } catch (error) {
                    webhookWorking = false;
                }
            }
            
            // ========================
            // RESPOSTA HONESTA
            // ========================
            const statusEmoji = webhookWorking ? '🟢' : '🔴';
            const statusText = webhookWorking ? 'FUNCIONANDO 100%' : 'NÃO CONFIGURADO OU COM PROBLEMA';
            
            await interaction.editReply({
                content: `${statusEmoji} **STATUS REAL DO SISTEMA**

**📁 Arquivo de Configuração:**
${fileExists ? '✅ Existe' : '❌ Não existe'} - \`config/webhooks.json\`

**🔗 Webhook para este servidor:**
${webhookConfigured ? '✅ Configurado' : '❌ Não configurado'}

**🧪 Teste do Webhook:**
${webhookWorking ? '✅ FUNCIONANDO' : '❌ NÃO FUNCIONA'}

**📊 Status Final:**
**${statusText}**

${webhookWorking ? 
`🎯 **TUDO FUNCIONANDO!**
Quando você fechar um ticket, o log será enviado automaticamente.` : 
`❌ **PRECISA CONFIGURAR!**
Use: \`/webhook-ultra-simples url:SUA_URL_DO_WEBHOOK\``}

**Detalhes técnicos:**
• Guild ID: \`${guildId}\`
• Arquivo config: ${fileExists ? 'OK' : 'FALTANDO'}
• Webhook URL: ${webhookUrl ? '✅ Definida' : '❌ Não definida'}
• Teste webhook: ${webhookWorking ? '✅ Passou' : '❌ Falhou'}`
            });
            
        } catch (error) {
            console.error('❌ Erro no status-real:', error);
            
            await interaction.editReply({
                content: `❌ **ERRO AO VERIFICAR STATUS**

**Erro:** ${error.message}

Este erro indica um problema técnico no sistema.`
            });
        }
    }
};