const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const TicketPermissionManager = require('../utils/TicketPermissionManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('painel-tickets-avancado')
        .setDescription('🚀 Cria um painel de tickets moderno e avançado com múltiplas categorias')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal onde será enviado o painel (padrão: canal atual)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('estilo')
                .setDescription('Estilo do painel')
                .addChoices(
                    { name: '🎯 Corporativo', value: 'corporate' },
                    { name: '🎮 Gaming', value: 'gaming' },
                    { name: '💎 Premium', value: 'premium' },
                    { name: '🌟 Moderno', value: 'modern' }
                )
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
            const style = interaction.options.getString('estilo') || 'modern';
            
            await interaction.deferReply({ ephemeral: true });

            // Auto-configurar permissões
            const permissionManager = new TicketPermissionManager();
            await permissionManager.autoConfigureStaffRoles(interaction.guild);

            // Configurações de estilo
            const styles = {
                corporate: {
                    color: '#2B2D31',
                    title: '🏢 CENTRAL DE ATENDIMENTO EMPRESARIAL',
                    description: 'Sistema profissional de gestão de solicitações',
                    categories: [
                        { id: 'support', name: 'Suporte Técnico', emoji: '💻', desc: 'Problemas técnicos e configurações' },
                        { id: 'billing', name: 'Financeiro', emoji: '💰', desc: 'Questões de pagamento e faturação' },
                        { id: 'feedback', name: 'Feedback', emoji: '📝', desc: 'Sugestões e melhorias' },
                        { id: 'partnership', name: 'Parcerias', emoji: '🤝', desc: 'Propostas comerciais' }
                    ]
                },
                gaming: {
                    color: '#5865F2',
                    title: '🎮 CENTRAL DE SUPORTE GAMER',
                    description: 'Sistema épico para resolução de questões',
                    categories: [
                        { id: 'bug', name: 'Report Bug', emoji: '🐛', desc: 'Bugs e glitches encontrados' },
                        { id: 'appeal', name: 'Recurso', emoji: '⚖️', desc: 'Contestar punições' },
                        { id: 'general', name: 'Ajuda Geral', emoji: '❓', desc: 'Dúvidas e suporte geral' },
                        { id: 'staff', name: 'Candidatura Staff', emoji: '👑', desc: 'Aplicar para equipe' }
                    ]
                },
                premium: {
                    color: '#FFD700',
                    title: '💎 ATENDIMENTO PREMIUM VIP',
                    description: 'Experiência exclusiva de atendimento personalizado',
                    categories: [
                        { id: 'vip', name: 'Suporte VIP', emoji: '👑', desc: 'Atendimento prioritário exclusivo' },
                        { id: 'premium', name: 'Premium Support', emoji: '💎', desc: 'Suporte para membros premium' },
                        { id: 'urgent', name: 'Urgente', emoji: '🚨', desc: 'Problemas críticos' },
                        { id: 'private', name: 'Privado', emoji: '🔒', desc: 'Questões confidenciais' }
                    ]
                },
                modern: {
                    color: '#00D4AA',
                    title: '🌟 HELP DESK MODERNO',
                    description: 'Interface intuitiva para todas as suas necessidades',
                    categories: [
                        { id: 'technical', name: 'Técnico', emoji: '🔧', desc: 'Suporte técnico especializado' },
                        { id: 'account', name: 'Conta', emoji: '👤', desc: 'Problemas de conta e perfil' },
                        { id: 'report', name: 'Denúncia', emoji: '🚫', desc: 'Reportar usuários ou conteúdo' },
                        { id: 'suggestion', name: 'Sugestão', emoji: '💡', desc: 'Ideias e melhorias' }
                    ]
                }
            };

            const currentStyle = styles[style];

            // Embed principal super moderno
            const mainEmbed = new EmbedBuilder()
                .setColor(currentStyle.color)
                .setTitle(currentStyle.title)
                .setDescription([
                    `### ${currentStyle.description}`,
                    '',
                    '### 📋 **DEPARTAMENTOS DISPONÍVEIS**',
                    '',
                    ...currentStyle.categories.map(cat => 
                        `${cat.emoji} **${cat.name}**\\n└ *${cat.desc}*`
                    ),
                    '',
                    '### 🚀 **COMO FUNCIONAR**',
                    '```',
                    '1️⃣ Selecione uma categoria no menu abaixo',
                    '2️⃣ Preencha o formulário com detalhes',
                    '3️⃣ Aguarde nossa equipe especializada',
                    '4️⃣ Receba suporte personalizado e rápido',
                    '```',
                    '',
                    '### 📊 **INFORMAÇÕES DO SISTEMA**',
                    `🏢 **Servidor:** \`${interaction.guild.name}\``,
                    `👥 **Staff Online:** \`${interaction.guild.members.cache.filter(m => !m.user.bot && m.presence?.status !== 'offline').size}\``,
                    `🟢 **Status:** \`OPERACIONAL\``,
                    `⚡ **Tempo Resposta:** \`< 15 min\``,
                    '',
                    '> 💡 **Sistema monitorado 24/7 com IA avançada**'
                ].join('\\n'))
                .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 512 }))
                .setImage('https://via.placeholder.com/800x200/2B2D31/FFFFFF?text=IGNIS+TICKET+SYSTEM')
                .setFooter({ 
                    text: `${interaction.guild.name} • IGNIS Ticket System v3.0 • Powered by Advanced AI`,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            // Menu de seleção moderno
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_category_select')
                .setPlaceholder('🎯 Selecione uma categoria de atendimento...')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(
                    currentStyle.categories.map(cat => ({
                        label: cat.name,
                        description: cat.desc,
                        value: `ticket_${cat.id}`,
                        emoji: cat.emoji
                    }))
                );

            // Botões de ação rápida
            const quickActions = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_emergency')
                        .setLabel('EMERGÊNCIA')
                        .setEmoji('🚨')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('ticket_status_check')
                        .setLabel('STATUS SISTEMA')
                        .setEmoji('📊')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('ticket_my_tickets')
                        .setLabel('MEUS TICKETS')
                        .setEmoji('📋')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('ticket_faq')
                        .setLabel('FAQ')
                        .setEmoji('❓')
                        .setStyle(ButtonStyle.Success)
                );

            // Enviar painel
            const message = await targetChannel.send({
                embeds: [mainEmbed],
                components: [
                    new ActionRowBuilder().addComponents(selectMenu),
                    quickActions
                ]
            });

            // Embed de sucesso
            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Painel Avançado Criado!')
                .setDescription([
                    `🎯 **Painel enviado em:** ${targetChannel}`,
                    `🎨 **Estilo aplicado:** ${style}`,
                    `🔧 **Funcionalidades:**`,
                    '• Menu de categorias interativo',
                    '• Botões de ação rápida',
                    '• Sistema de emergência',
                    '• Verificação de status',
                    '• FAQ integrado',
                    '',
                    `📝 **ID da Mensagem:** \`${message.id}\``
                ].join('\\n'))
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Erro ao criar painel avançado:', error);
            await interaction.editReply({
                content: '❌ **Erro:** Não foi possível criar o painel avançado. Verifique as permissões do bot.'
            });
        }
    }
};