const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const RobustWebhookManager = require('../utils/RobustWebhookManager');
const TicketDatabase = require('../utils/TicketDatabase');
const TicketPermissionManager = require('../utils/TicketPermissionManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verificar-integridade')
        .setDescription('🔍 Verifica a integridade de todos os sistemas do bot')
        .addBooleanOption(option =>
            option.setName('detalhado')
                .setDescription('Mostrar informações técnicas detalhadas')
                .setRequired(false)),

    async execute(interaction) {
        // Verificar permissões
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '⛔ **Acesso Negado** | Apenas administradores podem usar este comando.',
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

        try {
            const detalhado = interaction.options.getBoolean('detalhado') || false;
            const results = {};

            // 1. Verificar Sistema de Tickets
            results.tickets = await this.checkTicketSystem(interaction.guildId);

            // 2. Verificar Sistema de Webhooks
            results.webhooks = await this.checkWebhookSystem(interaction.guildId);

            // 3. Verificar Permissões e Auto-detecção
            results.permissions = await this.checkPermissionSystem(interaction.guild);

            // 4. Verificar Base de Dados
            results.database = await this.checkDatabaseSystem(interaction.guildId);

            // 5. Verificar Sistema de Logs
            results.logging = await this.checkLoggingSystem();

            // Criar embed com resultados
            const embed = this.createIntegrityEmbed(results, interaction.guild, detalhado);

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error('Erro na verificação de integridade:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('❌ **ERRO NA VERIFICAÇÃO**')
                .setDescription([
                    '**Falha ao verificar integridade dos sistemas**',
                    '',
                    `\`\`\`js`,
                    `${error.message}`,
                    `\`\`\``,
                    '',
                    '**💡 Tente novamente ou contacte o suporte técnico**'
                ].join('\n'))
                .setTimestamp();

            await interaction.editReply({
                embeds: [errorEmbed]
            });
        }
    },

    async checkTicketSystem(guildId) {
        try {
            const database = new TicketDatabase();
            const tickets = await database.getTickets(guildId);
            const activeTickets = tickets.filter(t => ['open', 'assigned'].includes(t.status));
            
            return {
                status: 'operational',
                totalTickets: tickets.length,
                activeTickets: activeTickets.length,
                closedTickets: tickets.filter(t => t.status === 'closed').length,
                lastActivity: tickets.length > 0 ? Math.max(...tickets.map(t => new Date(t.created_at).getTime())) : null
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    },

    async checkWebhookSystem(guildId) {
        try {
            const webhookManager = new RobustWebhookManager();
            const status = await webhookManager.getStatus(guildId);
            
            let webhookStatus = 'not_configured';
            let testResult = null;

            if (status.configured && status.enabled) {
                // Testar conexão do webhook
                const testResponse = await webhookManager.testWebhookConnection(status.url);
                testResult = testResponse.success;
                webhookStatus = testResponse.success ? 'operational' : 'error';
            } else if (status.configured) {
                webhookStatus = 'disabled';
            }

            return {
                status: webhookStatus,
                configured: status.configured,
                enabled: status.enabled,
                name: status.name,
                types: status.types,
                testResult: testResult,
                created: status.created
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    },

    async checkPermissionSystem(guild) {
        try {
            const permissionManager = new TicketPermissionManager();
            
            // Verificar auto-configuração
            const autoConfigResult = await permissionManager.autoConfigureStaffRoles(guild);
            
            // Verificar se o bot tem permissões necessárias
            const botMember = guild.members.cache.get(guild.client.user.id);
            const hasNecessaryPerms = botMember.permissions.has([
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageRoles,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks
            ]);

            return {
                status: autoConfigResult.success && hasNecessaryPerms ? 'operational' : 'warning',
                autoConfigSuccess: autoConfigResult.success,
                rolesFound: autoConfigResult.rolesFound || 0,
                botPermissions: hasNecessaryPerms,
                message: autoConfigResult.message
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    },

    async checkDatabaseSystem(guildId) {
        try {
            const database = new TicketDatabase();
            
            // Testar operações básicas
            const testRead = await database.getTickets(guildId);
            
            // Verificar estrutura de ficheiros
            const fs = require('fs').promises;
            const path = require('path');
            
            const dataDir = path.join(__dirname, '../data');
            const ticketsFile = path.join(dataDir, 'tickets.json');
            
            let fileExists = false;
            let fileSize = 0;
            
            try {
                const stats = await fs.stat(ticketsFile);
                fileExists = true;
                fileSize = stats.size;
            } catch (e) {
                // Arquivo não existe
            }

            return {
                status: 'operational',
                fileExists: fileExists,
                fileSize: fileSize,
                recordCount: testRead.length,
                readable: true,
                writable: true
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    },

    async checkLoggingSystem() {
        try {
            const logger = require('../utils/logger');
            
            // Testar logging
            logger.info('Sistema de integridade: Teste de logging');
            
            return {
                status: 'operational',
                loggerActive: true,
                logLevel: 'info'
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    },

    createIntegrityEmbed(results, guild, detalhado) {
        const embed = new EmbedBuilder()
            .setTitle('🔍 **VERIFICAÇÃO DE INTEGRIDADE**')
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setTimestamp();

        // Determinar cor geral baseada nos resultados
        const hasErrors = Object.values(results).some(r => r.status === 'error');
        const hasWarnings = Object.values(results).some(r => r.status === 'warning');
        
        if (hasErrors) {
            embed.setColor('#FF6B6B'); // Vermelho - Erro
        } else if (hasWarnings) {
            embed.setColor('#FFA500'); // Laranja - Aviso
        } else {
            embed.setColor('#00D26A'); // Verde - Tudo OK
        }

        const description = [
            `### 🏢 **${guild.name}**`,
            '',
            '### 📊 **ESTADO DOS SISTEMAS**',
            '',
            `🎫 **Sistema de Tickets:** ${this.getStatusEmoji(results.tickets.status)} \`${this.getStatusText(results.tickets.status)}\``,
            `🪝 **Webhooks:** ${this.getStatusEmoji(results.webhooks.status)} \`${this.getStatusText(results.webhooks.status)}\``,
            `🔐 **Permissões:** ${this.getStatusEmoji(results.permissions.status)} \`${this.getStatusText(results.permissions.status)}\``,
            `💾 **Base de Dados:** ${this.getStatusEmoji(results.database.status)} \`${this.getStatusText(results.database.status)}\``,
            `📝 **Sistema de Logs:** ${this.getStatusEmoji(results.logging.status)} \`${this.getStatusText(results.logging.status)}\``,
            ''
        ];

        // Adicionar resumo de tickets
        if (results.tickets.status === 'operational') {
            description.push(
                '### 🎫 **ESTATÍSTICAS DE TICKETS**',
                '',
                `📊 **Total:** \`${results.tickets.totalTickets}\``,
                `🟢 **Ativos:** \`${results.tickets.activeTickets}\``,
                `✅ **Resolvidos:** \`${results.tickets.closedTickets}\``,
                ''
            );
        }

        // Adicionar informações de webhooks
        if (results.webhooks.configured) {
            description.push(
                '### 🪝 **CONFIGURAÇÃO DE WEBHOOKS**',
                '',
                `📝 **Nome:** \`${results.webhooks.name || 'N/A'}\``,
                `⚡ **Estado:** \`${results.webhooks.enabled ? 'Ativado' : 'Desativado'}\``,
                `🧪 **Teste:** ${results.webhooks.testResult ? '✅ Passou' : '❌ Falhou'}`,
                ''
            );
        }

        // Se detalhado, adicionar informações técnicas
        if (detalhado) {
            description.push(
                '### 🔧 **INFORMAÇÕES TÉCNICAS**',
                '',
                `🤖 **Auto-detecção Staff:** ${results.permissions.autoConfigSuccess ? '✅' : '❌'}`,
                `👥 **Cargos Encontrados:** \`${results.permissions.rolesFound}\``,
                `🔑 **Permissões Bot:** ${results.permissions.botPermissions ? '✅' : '❌'}`,
                `📁 **Arquivo BD:** ${results.database.fileExists ? '✅' : '❌'}`,
                `📏 **Tamanho BD:** \`${Math.round(results.database.fileSize / 1024)} KB\``,
                ''
            );
        }

        // Adicionar recomendações se necessário
        const recommendations = this.getRecommendations(results);
        if (recommendations.length > 0) {
            description.push(
                '### 💡 **RECOMENDAÇÕES**',
                '',
                ...recommendations.map(r => `• ${r}`),
                ''
            );
        }

        embed.setDescription(description.join('\n'));

        embed.addFields(
            {
                name: '🎯 Status Geral',
                value: hasErrors ? '`❌ Problemas Detetados`' : hasWarnings ? '`⚠️ Avisos Encontrados`' : '`✅ Todos os Sistemas OK`',
                inline: true
            },
            {
                name: '⏱️ Verificação',
                value: '`Tempo Real`',
                inline: true
            },
            {
                name: '🔄 Próxima Verificação',
                value: '`Manual`',
                inline: true
            }
        );

        embed.setFooter({
            text: detalhado ? 'Verificação detalhada completa' : 'Use detalhado:true para mais informações',
            iconURL: guild.client.user.displayAvatarURL()
        });

        return embed;
    },

    getStatusEmoji(status) {
        switch (status) {
            case 'operational': return '🟢';
            case 'warning': return '🟡';
            case 'error': return '🔴';
            case 'not_configured': return '⚫';
            case 'disabled': return '🟠';
            default: return '❓';
        }
    },

    getStatusText(status) {
        switch (status) {
            case 'operational': return 'OPERACIONAL';
            case 'warning': return 'AVISOS';
            case 'error': return 'ERRO';
            case 'not_configured': return 'NÃO CONFIGURADO';
            case 'disabled': return 'DESATIVADO';
            default: return 'DESCONHECIDO';
        }
    },

    getRecommendations(results) {
        const recommendations = [];

        if (results.webhooks.status === 'not_configured') {
            recommendations.push('Configure webhooks para logs de tickets com `/configurar-logs`');
        }

        if (results.permissions.status === 'warning') {
            recommendations.push('Verifique as permissões do bot e cargos de staff');
        }

        if (results.tickets.activeTickets > 10) {
            recommendations.push('Considere resolver tickets antigos para manter o sistema organizado');
        }

        if (results.database.fileSize > 1024 * 1024) { // 1MB
            recommendations.push('Base de dados grande - considere limpeza de tickets antigos');
        }

        return recommendations;
    }
};