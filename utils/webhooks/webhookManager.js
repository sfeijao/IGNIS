const { WebhookClient, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

class WebhookManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', '..', 'config', 'webhooks.json');
        this.webhooks = new Map();
        this.init();
    }

    async init() {
        try {
            // Ensure config directory exists
            const configDir = path.dirname(this.configPath);
            await fs.mkdir(configDir, { recursive: true });

            // Try to read existing config
            let config;
            try {
                const data = await fs.readFile(this.configPath, 'utf8');
                config = JSON.parse(data);
            } catch (err) {
                // Create default config if doesn't exist
                config = { webhooks: {} };
                await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
            }

            // Initialize webhooks
            for (const [guildId, info] of Object.entries(config.webhooks)) {
                if (info.enabled && info.webhook_url) {
                    this.webhooks.set(guildId, {
                        name: info.name,
                        webhook: new WebhookClient({ url: info.webhook_url })
                    });
                }
            }
        } catch (error) {
            logger.error('Error initializing webhook manager:', error);
        }
    }

    async saveConfig() {
        const config = {
            webhooks: {}
        };

        for (const [guildId, info] of this.webhooks) {
            if (info.webhook?.url) {
                config.webhooks[guildId] = {
                    name: info.name,
                    webhook_url: info.webhook.url,
                    enabled: true
                };
            }
        }

        await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    }

    async verifyAndSetupWebhook(guild, channel) {
        try {
            // Verifica se já existe um webhook válido
            const existingInfo = this.webhooks.get(guild.id);
            if (existingInfo?.webhook?.url) {
                try {
                    // Tenta enviar uma mensagem de teste
                    await existingInfo.webhook.send({
                        content: '🔄 Verificando conexão do webhook...'
                    });
                    logger.info(`Webhook existente verificado para ${guild.name}`);
                    return true;
                } catch (error) {
                    logger.warn(`Webhook existente inválido para ${guild.name}, recriando...`);
                }
            }

            // Se não tem canal específico, usa o sistema
            if (!channel) {
                channel = guild.systemChannel;
            }

            if (!channel) {
                logger.error(`Não foi possível encontrar um canal válido em ${guild.name}`);
                return false;
            }

            // Cria um novo webhook
            const webhook = await channel.createWebhook({
                name: 'YSNM Logs',
                avatar: 'https://cdn.discordapp.com/avatars/1404584949285388339/3c28165b10ffdde42c3f76692513ca25.webp',
                reason: 'Configuração automática do sistema de logs'
            });

            // Registra o webhook
            this.webhooks.set(guild.id, {
                name: guild.name,
                webhook: new WebhookClient({ url: webhook.url })
            });

            await this.saveConfig();
            logger.info(`Webhook configurado com sucesso para ${guild.name}`);
            return true;
        } catch (error) {
            logger.error(`Erro ao configurar webhook para ${guild.name}:`, error);
            return false;
        }
    }

    async sendTicketLog(guildId, type, data) {
        const webhookInfo = this.webhooks.get(guildId);
        if (!webhookInfo || !webhookInfo.webhook?.url) {
            logger.debug(`Webhook não configurado para o servidor ${guildId}. Ticket log não enviado.`);
            return;
        }

        try {
            const embed = new EmbedBuilder()
                .setColor(this.getColorForType(type));

            switch (type) {
                case 'create':
                    embed
                        .setTitle('📩 Ticket Aberto')
                        .setDescription(`Ticket criado por ${data.author.tag}`)
                        .addFields(
                            { name: '🆔 ID do Ticket', value: data.ticketId, inline: true },
                            { name: '📁 Categoria', value: data.category || 'N/A', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: `ID do Usuário: ${data.author.id}` });
                    
                    if (data.author.avatarURL) {
                        embed.setThumbnail(data.author.avatarURL());
                    }
                    break;

                case 'close':
                    embed
                        .setTitle('🔒 Ticket Encerrado')
                        .setDescription(`Ticket encerrado por ${data.closedBy.tag}`)
                        .addFields(
                            { name: '🆔 ID do Ticket', value: data.ticketId, inline: true },
                            { name: '⏱️ Duração', value: data.duration || 'N/A', inline: true },
                            { name: '📝 Motivo', value: data.reason || 'Não especificado' }
                        )
                        .setTimestamp();
                    break;

                case 'update':
                    embed
                        .setTitle('📝 Ticket Atualizado')
                        .setDescription(`Ticket atualizado por ${data.updatedBy.tag}`)
                        .addFields(
                            { name: '🆔 ID do Ticket', value: data.ticketId, inline: true },
                            { name: '📊 Status', value: data.status, inline: true }
                        )
                        .setTimestamp();
                    break;
            }

            // Send webhook message
            const payload = {
                embeds: [embed],
                username: `${webhookInfo.name} Tickets`,
                avatarURL: data.guild?.iconURL?.() || undefined
            };

            // Add transcript file if available
            if (data.files && data.files.length > 0) {
                payload.files = data.files;
            }

            await webhookInfo.webhook.send(payload);
        } catch (error) {
            logger.error(`Error sending webhook for guild ${guildId}:`, error);
        }
    }

    getColorForType(type) {
        switch (type) {
            case 'create': return 0x00FF00;  // Verde
            case 'close': return 0xFF0000;   // Vermelho
            case 'update': return 0xFFFF00;  // Amarelo
            default: return 0x7289DA;        // Discord Blurple
        }
    }

    async addWebhook(guildId, name, webhookUrl) {
        try {
            // Validate webhook URL
            if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
                throw new Error('Invalid webhook URL');
            }

            // Create webhook client
            const webhook = new WebhookClient({ url: webhookUrl });
            this.webhooks.set(guildId, { name, webhook });

            // Save configuration
            await this.saveConfig();
            return true;
        } catch (error) {
            logger.error('Error adding webhook:', error);
            return false;
        }
    }

    async removeWebhook(guildId) {
        try {
            const webhook = this.webhooks.get(guildId);
            if (webhook) {
                this.webhooks.delete(guildId);
                await this.saveConfig();
            }
            return true;
        } catch (error) {
            logger.error('Error removing webhook:', error);
            return false;
        }
    }

    // Método para configurar webhook automaticamente para um servidor
    async setupForGuild(guild) {
        try {
            logger.info(`Configurando webhook para o servidor ${guild.name} (${guild.id})`);
            
            // Verificar se já existe um webhook válido
            const existingInfo = this.webhooks.get(guild.id);
            if (existingInfo?.webhook?.url) {
                try {
                    // Tentar usar o webhook existente
                    await existingInfo.webhook.send({
                        embeds: [{
                            title: '✅ Webhook Verificado',
                            description: 'Sistema de logs cross-server está ativo!',
                            color: 0x4CAF50,
                            timestamp: new Date()
                        }]
                    });
                    logger.info(`Webhook existente verificado para ${guild.name}`);
                    return true;
                } catch (error) {
                    logger.warn(`Webhook existente inválido para ${guild.name}, recriando...`);
                }
            }

            // Procurar um canal apropriado
            let channel = null;
            
            // 1. Procurar por um canal de logs específico
            channel = guild.channels.cache.find(c => 
                c.name.includes('log') && c.type === 0 && 
                c.permissionsFor(guild.members.me)?.has(['SendMessages', 'ManageWebhooks'])
            );

            // 2. Se não encontrou, procurar canal de tickets
            if (!channel) {
                channel = guild.channels.cache.find(c => 
                    (c.name.includes('ticket') || c.name.includes('arquivo')) && c.type === 0 && 
                    c.permissionsFor(guild.members.me)?.has(['SendMessages', 'ManageWebhooks'])
                );
            }

            // 3. Se não encontrou, usar canal sistema
            if (!channel) {
                channel = guild.systemChannel;
            }

            // 4. Se ainda não tem canal, criar um
            if (!channel) {
                try {
                    channel = await guild.channels.create({
                        name: '📋-tickets-logs',
                        type: 0,
                        topic: 'Canal automático para logs de tickets cross-server',
                        reason: 'Configuração automática do sistema de webhooks'
                    });
                    logger.info(`Canal de logs criado: ${channel.name} no servidor ${guild.name}`);
                } catch (createError) {
                    logger.error(`Erro ao criar canal de logs no servidor ${guild.name}:`, createError);
                    return false;
                }
            }

            if (!channel) {
                logger.error(`Não foi possível encontrar ou criar um canal válido em ${guild.name}`);
                return false;
            }

            // Criar o webhook
            const webhook = await channel.createWebhook({
                name: 'YSNM Cross-Server Logs',
                avatar: 'https://cdn.discordapp.com/avatars/1404584949285388339/3c28165b10ffdde42c3f76692513ca25.webp',
                reason: 'Configuração automática do sistema de logs cross-server'
            });

            // Registrar o webhook
            this.webhooks.set(guild.id, {
                name: guild.name,
                webhook: new WebhookClient({ url: webhook.url })
            });

            await this.saveConfig();

            // Enviar mensagem de confirmação
            await webhook.send({
                embeds: [{
                    title: '🎉 Webhook Configurado!',
                    description: `Sistema de logs cross-server ativo no canal ${channel.name}`,
                    color: 0x4CAF50,
                    fields: [
                        { name: '📋 Canal', value: `<#${channel.id}>`, inline: true },
                        { name: '🖥️ Servidor', value: guild.name, inline: true }
                    ],
                    timestamp: new Date(),
                    footer: { text: 'YSNM Cross-Server Logging System' }
                }]
            });

            logger.info(`✅ Webhook configurado com sucesso para ${guild.name} no canal ${channel.name}`);
            return true;
        } catch (error) {
            logger.error(`❌ Erro ao configurar webhook para ${guild.name}:`, error);
            return false;
        }
    }
}

module.exports = WebhookManager;
