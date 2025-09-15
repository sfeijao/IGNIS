#!/usr/bin/env node
// scripts/deploy-commands.js - Sistema unificado de deploy de comandos
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');

class CommandDeployer {
    constructor() {
        this.rest = new REST({ version: '10' }).setToken(config.DISCORD.TOKEN);
        this.commands = [];
        this.errors = [];
    }

    /**
     * Carrega todos os comandos da pasta commands
     */
    loadCommands() {
        console.log('🔍 Carregando comandos...');
        
        const commandsPath = path.join(__dirname, '..', 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            
            try {
                // Limpar cache do require para recarregar comandos
                delete require.cache[require.resolve(filePath)];
                
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    this.commands.push(command.data.toJSON());
                    console.log(`✅ ${command.data.name}`);
                } else {
                    const error = `Comando em ${file} está faltando propriedade "data" ou "execute"`;
                    this.errors.push(error);
                    console.log(`❌ ${file}: ${error}`);
                }
            } catch (error) {
                const errorMsg = `Erro ao carregar ${file}: ${error.message}`;
                this.errors.push(errorMsg);
                console.error(`❌ ${file}:`, error);
            }
        }

        console.log(`\n📦 ${this.commands.length} comandos carregados`);
        if (this.errors.length > 0) {
            console.log(`⚠️ ${this.errors.length} erros encontrados`);
        }
    }

    /**
     * Deploys comandos para o Discord
     * @param {string} scope - 'guild' ou 'global'
     */
    async deployCommands(scope = 'guild') {
        if (this.commands.length === 0) {
            throw new Error('Nenhum comando válido encontrado para deploy');
        }

        console.log(`\n🚀 Iniciando deploy ${scope === 'guild' ? 'no servidor' : 'global'}...`);

        try {
            const route = scope === 'guild' 
                ? Routes.applicationGuildCommands(config.DISCORD.CLIENT_ID, config.DISCORD.GUILD_ID)
                : Routes.applicationCommands(config.DISCORD.CLIENT_ID);

            const startTime = Date.now();
            
            const data = await this.rest.put(route, { 
                body: this.commands 
            });

            const deployTime = Date.now() - startTime;

            console.log(`✅ ${data.length} comandos registrados com sucesso em ${deployTime}ms`);
            
            logger.info('Comandos deployados', {
                scope,
                commandCount: data.length,
                deployTime,
                commands: this.commands.map(cmd => cmd.name)
            });

            return data;
        } catch (error) {
            console.error('❌ Erro no deploy:', error);
            
            logger.error('Erro no deploy de comandos', {
                scope,
                error: error.message,
                commandCount: this.commands.length
            });

            throw error;
        }
    }

    /**
     * Lista comandos atualmente registrados
     * @param {string} scope - 'guild' ou 'global'
     */
    async listCommands(scope = 'guild') {
        try {
            const route = scope === 'guild' 
                ? Routes.applicationGuildCommands(config.DISCORD.CLIENT_ID, config.DISCORD.GUILD_ID)
                : Routes.applicationCommands(config.DISCORD.CLIENT_ID);

            const commands = await this.rest.get(route);
            
            console.log(`\n📋 Comandos registrados (${scope}):`);
            commands.forEach((cmd, index) => {
                console.log(`${index + 1}. ${cmd.name} - ${cmd.description}`);
            });

            return commands;
        } catch (error) {
            console.error(`❌ Erro ao listar comandos ${scope}:`, error);
            throw error;
        }
    }

    /**
     * Remove todos os comandos
     * @param {string} scope - 'guild' ou 'global'
     */
    async clearCommands(scope = 'guild') {
        try {
            const route = scope === 'guild' 
                ? Routes.applicationGuildCommands(config.DISCORD.CLIENT_ID, config.DISCORD.GUILD_ID)
                : Routes.applicationCommands(config.DISCORD.CLIENT_ID);

            await this.rest.put(route, { body: [] });
            
            console.log(`✅ Todos os comandos ${scope} foram removidos`);
            
            logger.info('Comandos removidos', { scope });
        } catch (error) {
            console.error(`❌ Erro ao remover comandos ${scope}:`, error);
            throw error;
        }
    }

    /**
     * Validar configuração antes do deploy
     */
    validateConfig() {
        const errors = [];

        if (!config.DISCORD.TOKEN) {
            errors.push('DISCORD_TOKEN não configurado');
        }

        if (!config.DISCORD.CLIENT_ID) {
            errors.push('CLIENT_ID não configurado');
        }

        if (!config.DISCORD.GUILD_ID) {
            errors.push('GUILD_ID não configurado');
        }

        if (errors.length > 0) {
            throw new Error(`Configuração inválida: ${errors.join(', ')}`);
        }
    }

    /**
     * Executa deploy completo
     */
    async run(options = {}) {
        const {
            scope = 'guild',
            list = false,
            clear = false
        } = options;

        try {
            console.log('🎯 IGNIS Bot - Deploy de Comandos');
            console.log('=====================================');
            
            // Validar configuração
            this.validateConfig();
            console.log('✅ Configuração validada');

            // Listar comandos existentes se solicitado
            if (list) {
                await this.listCommands(scope);
                return;
            }

            // Limpar comandos se solicitado
            if (clear) {
                await this.clearCommands(scope);
                return;
            }

            // Deploy normal
            this.loadCommands();
            
            if (this.errors.length > 0) {
                console.log('\n⚠️ Avisos encontrados:');
                this.errors.forEach(error => console.log(`  - ${error}`));
                console.log('');
            }

            const result = await this.deployCommands(scope);
            
            console.log('\n🎉 Deploy concluído com sucesso!');
            console.log('=====================================');
            
            return result;
        } catch (error) {
            console.error('\n❌ Deploy falhou:', error.message);
            process.exit(1);
        }
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const args = process.argv.slice(2);
    
    const options = {
        scope: args.includes('--global') ? 'global' : 'guild',
        list: args.includes('--list'),
        clear: args.includes('--clear')
    };

    const deployer = new CommandDeployer();
    deployer.run(options);
}

module.exports = CommandDeployer;
