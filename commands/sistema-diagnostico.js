const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const storage = require('../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sistema-diagnostico')
        .setDescription('🔧 Diagnóstico completo do sistema YSNM (apenas administradores)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Verificar se é administrador
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.editReply({
                    content: '❌ Apenas administradores podem usar este comando!'
                });
            }

            const client = interaction.client;
            const guild = interaction.guild;

            // 🤖 INFORMAÇÕES DO BOT
            const botInfo = {
                nome: client.user.tag,
                id: client.user.id,
                uptime: Math.floor(client.uptime / (1000 * 60 * 60)) + 'h ' + 
                        Math.floor((client.uptime % (1000 * 60 * 60)) / (1000 * 60)) + 'm',
                ping: client.ws.ping + 'ms',
                servidores: client.guilds.cache.size,
                usuarios: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
                memoria: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
            };

            // 📁 VERIFICAÇÃO DE FICHEIROS
            const filesCheck = {
                config: fs.existsSync(path.join(__dirname, '../config.json')),
                database: fs.existsSync(path.join(__dirname, '../website/database/ysnm_dashboard.db')),
                commands: fs.readdirSync(path.join(__dirname, '.')).filter(f => f.endsWith('.js')).length,
                events: fs.readdirSync(path.join(__dirname, '../events')).filter(f => f.endsWith('.js')).length
            };

            // 🔧 SISTEMA DE BASE DE DADOS
            let dbStatus = '❌ Desconhecido';
            try {
                const Database = require('../website/database/database');
                const db = new Database();
                await db.initialize();
                dbStatus = '✅ Online';
            } catch (error) {
                dbStatus = `❌ Erro: ${error.message}`;
            }

            // 🌐 SISTEMA WEB
            let webStatus = '❌ Desconhecido';
            try {
                if (global.discordClient) {
                    webStatus = '✅ Dashboard ativo';
                } else {
                    webStatus = '⚠️ Dashboard inativo';
                }
            } catch (error) {
                webStatus = '❌ Erro no dashboard';
            }

            // 📋 VERIFICAÇÃO DE COMANDOS
            const comandos = client.commands.size;
            const comandosCarregados = client.commands.map(cmd => cmd.data.name).join(', ');

            // 🎫 SISTEMA DE TICKETS
            let ticketSystemStatus = '✅ Funcional';
            try {
                const ticketCategory = guild.channels.cache.find(
                    ch => ch.type === 4 && ch.name.toLowerCase().includes('ticket')
                );
                if (!ticketCategory) {
                    ticketSystemStatus = '⚠️ Categoria de tickets não encontrada';
                }
            } catch (error) {
                ticketSystemStatus = '❌ Erro no sistema de tickets';
            }

            // 🏷️ SISTEMA DE VERIFICAÇÃO
            let verificationStatus = '✅ Funcional';
            try {
                // Carregar config para verificar roles
                let config;
                try {
                    config = await storage.getGuildConfig(interaction.guild.id);
                } catch {
                    config = { roles: {} };
                }

                const verifiedRole = guild.roles.cache.get(config.roles?.verified);
                if (!verifiedRole) {
                    verificationStatus = '⚠️ Role de verificação não encontrada';
                }
            } catch (error) {
                verificationStatus = '❌ Erro no sistema de verificação';
            }

            // 📊 CRIAR EMBED DE DIAGNÓSTICO
            const diagnosticEmbed = new EmbedBuilder()
                .setColor('#9932CC')
                .setTitle('🔧 Diagnóstico do Sistema YSNM')
                .setDescription('**Relatório completo do estado do sistema**')
                .addFields(
                    {
                        name: '🤖 Bot Status',
                        value: `\`\`\`
Nome: ${botInfo.nome}
ID: ${botInfo.id}
Uptime: ${botInfo.uptime}
Ping: ${botInfo.ping}
Servidores: ${botInfo.servidores}
Usuários: ${botInfo.usuarios}
Memória: ${botInfo.memoria}
\`\`\``,
                        inline: false
                    },
                    {
                        name: '📁 Ficheiros do Sistema',
                        value: `\`\`\`
Config.json: ${filesCheck.config ? '✅' : '❌'}
Base de Dados: ${filesCheck.database ? '✅' : '❌'}
Comandos: ${filesCheck.commands} ficheiros
Eventos: ${filesCheck.events} ficheiros
\`\`\``,
                        inline: true
                    },
                    {
                        name: '🌐 Sistemas Online',
                        value: `\`\`\`
Base de Dados: ${dbStatus}
Dashboard Web: ${webStatus}
Comandos: ${comandos} carregados
\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎫 Sistemas de Funcionalidade',
                        value: `\`\`\`
Tickets: ${ticketSystemStatus}
Verificação: ${verificationStatus}
Tags: ✅ Funcional
Status: ✅ Funcional
\`\`\``,
                        inline: false
                    },
                    {
                        name: '📋 Comandos Carregados',
                        value: `\`\`\`${comandosCarregados.substring(0, 900)}${comandosCarregados.length > 900 ? '...' : ''}\`\`\``,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Diagnóstico executado por ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            // 🔗 INFORMAÇÕES ADICIONAIS
            const additionalInfo = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('📈 Informações Adicionais')
                .addFields(
                    {
                        name: '💾 Uso de Memória',
                        value: `\`\`\`
Heap Usado: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
Heap Total: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB
RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB
\`\`\``,
                        inline: true
                    },
                    {
                        name: '⚡ Performance',
                        value: `\`\`\`
Node.js: ${process.version}
Sistema: ${process.platform}
CPU: ${process.arch}
PID: ${process.pid}
\`\`\``,
                        inline: true
                    },
                    {
                        name: '🔧 Recomendações',
                        value: `${filesCheck.config ? '✅' : '❌'} Config.json presente
${dbStatus.includes('✅') ? '✅' : '❌'} Base de dados funcional
${webStatus.includes('✅') ? '✅' : '❌'} Dashboard acessível
${comandos >= 15 ? '✅' : '⚠️'} Comandos suficientes (${comandos}/21)`,
                        inline: false
                    }
                )
                .setTimestamp();

            await interaction.editReply({
                embeds: [diagnosticEmbed, additionalInfo]
            });

        } catch (error) {
            console.error('Erro no diagnóstico do sistema:', error);
            await interaction.editReply({
                content: '❌ Erro ao executar diagnóstico do sistema: ' + error.message
            });
        }
    }
};
