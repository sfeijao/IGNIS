// utils/logger.js - Sistema de logging estruturado
const fs = require('fs');
const path = require('path');

class StructuredLogger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };
        
        // Criar diretório de logs se não existir
        this.logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    shouldLog(level) {
        return this.logLevels[level] <= this.logLevels[this.logLevel];
    }

    formatLog(level, message, metadata = {}) {
        return {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message,
            ...metadata,
            pid: process.pid,
            environment: process.env.NODE_ENV || 'development'
        };
    }

    writeToFile(logEntry) {
        const logLine = JSON.stringify(logEntry) + '\n';
        const fileName = `app-${new Date().toISOString().split('T')[0]}.log`;
        const filePath = path.join(this.logsDir, fileName);
        
        fs.appendFileSync(filePath, logLine);

        if (logEntry.level === 'ERROR') {
            const errorFileName = `error-${new Date().toISOString().split('T')[0]}.log`;
            const errorFilePath = path.join(this.logsDir, errorFileName);
            fs.appendFileSync(errorFilePath, logLine);
        }
    }

    outputToConsole(logEntry) {
        const colors = {
            ERROR: '\x1b[31m',
            WARN: '\x1b[33m',
            INFO: '\x1b[36m',
            DEBUG: '\x1b[35m',
            TRACE: '\x1b[37m'
        };
        
        const reset = '\x1b[0m';
        const color = colors[logEntry.level] || reset;
        
        const timestamp = new Date(logEntry.timestamp).toLocaleTimeString('pt-PT');
        console.log(`${color}[${timestamp}] ${logEntry.level}${reset} ${logEntry.message}`);
        
        if (process.env.NODE_ENV !== 'production' && Object.keys(logEntry).length > 5) {
            const metadata = { ...logEntry };
            delete metadata.timestamp;
            delete metadata.level;
            delete metadata.message;
            delete metadata.pid;
            delete metadata.environment;
            
            if (Object.keys(metadata).length > 0) {
                console.log(`${color}  Metadata:${reset}`, metadata);
            }
        }
    }

    log(level, message, metadata = {}) {
        if (!this.shouldLog(level)) return;

        const logEntry = this.formatLog(level, message, metadata);
        
        this.outputToConsole(logEntry);
        
        if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
            this.writeToFile(logEntry);
        }
    }

    error(message, metadata = {}) {
        this.log('error', message, metadata);
    }

    warn(message, metadata = {}) {
        this.log('warn', message, metadata);
    }

    info(message, metadata = {}) {
        this.log('info', message, metadata);
    }

    debug(message, metadata = {}) {
        this.log('debug', message, metadata);
    }

    trace(message, metadata = {}) {
        this.log('trace', message, metadata);
    }

    command(commandName, interaction, success = true) {
        const metadata = {
            commandName,
            userId: interaction.user.id,
            username: interaction.user.username,
            guildId: interaction.guild?.id,
            guildName: interaction.guild?.name,
            success,
            type: 'command'
        };

        if (success) {
            this.info(`Comando executado: ${commandName}`, metadata);
        } else {
            this.warn(`Comando falhou: ${commandName}`, metadata);
        }
    }

    interaction(type, customId, interaction, success = true) {
        const metadata = {
            interactionType: type,
            customId,
            userId: interaction.user.id,
            username: interaction.user.username,
            guildId: interaction.guild?.id,
            success,
            type: 'interaction'
        };

        if (success) {
            this.info(`Interação processada: ${type}`, metadata);
        } else {
            this.warn(`Interação falhou: ${type}`, metadata);
        }
    }

    database(operation, table, success = true, metadata = {}) {
        const logData = {
            operation,
            table,
            success,
            type: 'database',
            ...metadata
        };

        if (success) {
            this.debug(`Database ${operation}: ${table}`, logData);
        } else {
            this.error(`Database ${operation} failed: ${table}`, logData);
        }
    }

    api(method, endpoint, statusCode, responseTime, metadata = {}) {
        const logData = {
            method,
            endpoint,
            statusCode,
            responseTime: `${responseTime}ms`,
            type: 'api',
            ...metadata
        };

        const message = `${method} ${endpoint} - ${statusCode} (${responseTime}ms)`;
        
        if (statusCode >= 500) {
            this.error(message, logData);
        } else if (statusCode >= 400) {
            this.warn(message, logData);
        } else {
            this.info(message, logData);
        }
    }

    cleanupOldLogs(daysToKeep = 30) {
        try {
            const files = fs.readdirSync(this.logsDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            files.forEach(file => {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logsDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        fs.unlinkSync(filePath);
                        this.info(`Log file cleanup: ${file} deleted`);
                    }
                }
            });
        } catch (error) {
            this.error('Erro na limpeza de logs antigos', { error: error.message });
        }
    }
}

const logger = new StructuredLogger();

setInterval(() => {
    logger.cleanupOldLogs();
}, 24 * 60 * 60 * 1000);

module.exports = logger;
