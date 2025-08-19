const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        console.log(`🔍 Interação: ${interaction.type} - ${interaction.user.tag}`);
        
        if (interaction.isChatInputCommand()) {
            console.log(`📝 Comando: /${interaction.commandName}`);
            
            const command = interaction.client.commands.get(interaction.commandName);
            
            if (!command) {
                console.error(`❌ Comando ${interaction.commandName} não encontrado`);
                return;
            }

            try {
                console.log(`⚡ Executando comando: ${interaction.commandName}`);
                await command.execute(interaction);
                console.log(`✅ Comando ${interaction.commandName} executado com sucesso`);
            } catch (error) {
                console.error(`❌ Erro no comando ${interaction.commandName}:`, error);
                
                const errorResponse = { content: '❌ Erro!', ephemeral: true };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorResponse).catch(console.error);
                } else {
                    await interaction.reply(errorResponse).catch(console.error);
                }
            }
        }
    },
};
