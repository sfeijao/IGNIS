const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup-database')
        .setDescription('💾 Criar backup da base de dados (apenas administradores)')
        .addBooleanOption(option =>
            option.setName('download')
                .setDescription('Enviar arquivo de backup para download')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Verificar se é administrador ou owner
            const isOwner = interaction.user.id === '381762006329589760';
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            
            if (!isOwner && !isAdmin) {
                return await interaction.editReply({
                    content: '❌ Apenas administradores podem criar backups da base de dados!'
                });
            }

            const downloadFile = interaction.options.getBoolean('download') || false;

            // Paths da base de dados
            const dbPath = path.join(__dirname, '../website/database/ysnm_dashboard.db');
            const backupDir = path.join(__dirname, '../backups');
            
            // Criar diretório de backups se não existir
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            // Verificar se a base de dados existe
            if (!fs.existsSync(dbPath)) {
                return await interaction.editReply({
                    content: '❌ Base de dados não encontrada! Certifique-se de que o bot foi inicializado corretamente.'
                });
            }

            // Obter informações da base de dados
            const dbStats = fs.statSync(dbPath);
            const dbSize = Math.round(dbStats.size / 1024); // KB
            const dbModified = dbStats.mtime.toLocaleString('pt-PT');

            // Criar nome do backup com timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
            const dateStr = timestamp[0];
            const timeStr = timestamp[1].split('.')[0];
            const backupFileName = `ysnm_backup_${dateStr}_${timeStr}.db`;
            const backupPath = path.join(backupDir, backupFileName);

            // Criar backup (copiar arquivo)
            try {
                fs.copyFileSync(dbPath, backupPath);
            } catch (error) {
                return await interaction.editReply({
                    content: `❌ Erro ao criar backup: ${error.message}`
                });
            }

            // Verificar se backup foi criado
            if (!fs.existsSync(backupPath)) {
                return await interaction.editReply({
                    content: '❌ Falha ao criar arquivo de backup!'
                });
            }

            const backupStats = fs.statSync(backupPath);
            const backupSize = Math.round(backupStats.size / 1024); // KB

            // Obter informações sobre backups existentes
            const backupFiles = fs.readdirSync(backupDir).filter(file => file.endsWith('.db'));
            const totalBackups = backupFiles.length;

            // Limpar backups antigos (manter apenas os últimos 10)
            if (totalBackups > 10) {
                const sortedBackups = backupFiles
                    .map(file => ({
                        name: file,
                        path: path.join(backupDir, file),
                        mtime: fs.statSync(path.join(backupDir, file)).mtime
                    }))
                    .sort((a, b) => b.mtime - a.mtime);

                // Deletar backups mais antigos
                const toDelete = sortedBackups.slice(10);
                let deletedCount = 0;
                
                for (const backup of toDelete) {
                    try {
                        fs.unlinkSync(backup.path);
                        deletedCount++;
                    } catch (error) {
                        console.error(`Erro ao deletar backup antigo ${backup.name}:`, error);
                    }
                }
            }

            // Criar embed de confirmação
            const backupEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('💾 Backup da Base de Dados Criado')
                .setDescription('**Backup criado com sucesso!**')
                .addFields(
                    {
                        name: '📁 Arquivo de Backup',
                        value: `\`\`\`
Nome: ${backupFileName}
Tamanho: ${backupSize} KB
Criado: ${new Date().toLocaleString('pt-PT')}
\`\`\``,
                        inline: false
                    },
                    {
                        name: '💾 Base de Dados Original',
                        value: `\`\`\`
Tamanho: ${dbSize} KB
Modificado: ${dbModified}
Status: ✅ Íntegro
\`\`\``,
                        inline: true
                    },
                    {
                        name: '📊 Gestão de Backups',
                        value: `\`\`\`
Total de Backups: ${backupFiles.length}
Backups Antigos Removidos: ${totalBackups > 10 ? totalBackups - 10 : 0}
Localização: ./backups/
\`\`\``,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: `Backup criado por ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            // Preparar resposta
            const responseOptions = { embeds: [backupEmbed] };

            // Se solicitado download, anexar arquivo
            if (downloadFile) {
                try {
                    // Verificar tamanho do arquivo (Discord tem limite de 25MB para bots)
                    if (backupSize > 24 * 1024) { // 24MB
                        await interaction.editReply({
                            embeds: [backupEmbed],
                            content: '⚠️ **Backup criado mas não enviado:** Arquivo muito grande para Discord (>24MB)'
                        });
                    } else {
                        const attachment = new AttachmentBuilder(backupPath, { 
                            name: backupFileName,
                            description: 'Backup da base de dados YSNM'
                        });
                        
                        responseOptions.files = [attachment];
                        
                        await interaction.editReply(responseOptions);
                        
                        // Remover o arquivo temporário após envio
                        setTimeout(() => {
                            try {
                                if (fs.existsSync(backupPath)) {
                                    // Apenas remover se não é o último backup
                                    const currentBackups = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
                                    if (currentBackups.length > 1) {
                                        // Não remover, manter backup no servidor
                                        console.log(`📁 Backup ${backupFileName} mantido no servidor`);
                                    }
                                }
                            } catch (error) {
                                console.error('Erro ao gerenciar arquivo de backup:', error);
                            }
                        }, 30000); // 30 segundos
                    }
                } catch (error) {
                    console.error('Erro ao anexar backup:', error);
                    await interaction.editReply({
                        embeds: [backupEmbed],
                        content: '⚠️ **Backup criado mas erro ao enviar arquivo:** ' + error.message
                    });
                }
            } else {
                await interaction.editReply(responseOptions);
            }

            // Log da operação
            console.log(`💾 Backup criado: ${backupFileName} por ${interaction.user.tag}`);

        } catch (error) {
            console.error('Erro no comando backup-database:', error);
            await interaction.editReply({
                content: '❌ Erro ao criar backup da base de dados: ' + error.message
            });
        }
    }
};
