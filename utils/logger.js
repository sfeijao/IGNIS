const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logsDir = path.join(__dirname, '../logs');
        this.createLogsDirectory();
    }

    createLogsDirectory() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    getLogFileName(type = 'general') {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return path.join(this.logsDir, `${type}-${date}.log`);
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data: data || undefined
        };
        return JSON.stringify(logEntry) + '\n';
    }

    writeLog(type, level, message, data = null) {
        try {
            const logFile = this.getLogFileName(type);
            const formattedMessage = this.formatMessage(level, message, data);
            
            fs.appendFileSync(logFile, formattedMessage);
            
            // Also log to console with colors
            const colors = {
                'ERROR': '\x1b[31m',   // Red
                'WARN': '\x1b[33m',    // Yellow
                'INFO': '\x1b[36m',    // Cyan
                'DEBUG': '\x1b[35m',   // Magenta
                'SUCCESS': '\x1b[32m'  // Green
            };
            
            const color = colors[level.toUpperCase()] || '\x1b[0m';
            const reset = '\x1b[0m';
            
            console.log(`${color}[${level.toUpperCase()}] ${message}${reset}${data ? ` | Data: ${JSON.stringify(data)}` : ''}`);
        } catch (error) {
            console.error('❌ Erro ao escrever log:', error);
        }
    }

    // Métodos específicos
    error(message, data = null, type = 'error') {
        this.writeLog(type, 'ERROR', message, data);
    }

    warn(message, data = null, type = 'general') {
        this.writeLog(type, 'WARN', message, data);
    }

    info(message, data = null, type = 'general') {
        this.writeLog(type, 'INFO', message, data);
    }

    debug(message, data = null, type = 'debug') {
        this.writeLog(type, 'DEBUG', message, data);
    }

    success(message, data = null, type = 'general') {
        this.writeLog(type, 'SUCCESS', message, data);
    }

    // Logs específicos para sistemas
    command(commandName, userId, guildId, success = true, error = null) {
        this.writeLog('commands', success ? 'INFO' : 'ERROR', 
            `Command ${commandName} executed by ${userId} in guild ${guildId}`, 
            { commandName, userId, guildId, success, error });
    }

    ticket(action, ticketId, userId, guildId, data = {}) {
        this.writeLog('tickets', 'INFO', 
            `Ticket ${action}: ${ticketId} by ${userId} in guild ${guildId}`, 
            { action, ticketId, userId, guildId, ...data });
    }

    interaction(interactionType, userId, guildId, success = true, error = null) {
        this.writeLog('interactions', success ? 'INFO' : 'ERROR', 
            `Interaction ${interactionType} by ${userId} in guild ${guildId}`, 
            { interactionType, userId, guildId, success, error });
    }

    auth(action, userId, ip = null, success = true, error = null) {
        this.writeLog('auth', success ? 'INFO' : 'WARN', 
            `Auth ${action} for user ${userId}`, 
            { action, userId, ip, success, error });
    }

    database(action, table = null, success = true, error = null) {
        this.writeLog('database', success ? 'DEBUG' : 'ERROR', 
            `Database ${action}${table ? ` on table ${table}` : ''}`, 
            { action, table, success, error });
    }

    // Limpar logs antigos (manter apenas últimos 30 dias)
    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logsDir);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            files.forEach(file => {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logsDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.birthtime < thirtyDaysAgo) {
                        fs.unlinkSync(filePath);
                        this.info(`Deleted old log file: ${file}`, null, 'system');
                    }
                }
            });
        } catch (error) {
            this.error('Failed to clean old logs', error, 'system');
        }
    }

    // Obter logs recentes
    getRecentLogs(type = 'general', lines = 100) {
        try {
            const logFile = this.getLogFileName(type);
            
            if (!fs.existsSync(logFile)) {
                return [];
            }

            const content = fs.readFileSync(logFile, 'utf8');
            const logLines = content.trim().split('\n').filter(line => line.length > 0);
            
            // Retornar últimas N linhas
            const recentLines = logLines.slice(-lines);
            
            return recentLines.map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return { timestamp: new Date().toISOString(), level: 'INFO', message: line };
                }
            });
        } catch (error) {
            this.error('Failed to read recent logs', error, 'system');
            return [];
        }
    }

    // Buscar logs por critério
    searchLogs(type = 'general', searchTerm, maxResults = 50) {
        try {
            const logFile = this.getLogFileName(type);
            
            if (!fs.existsSync(logFile)) {
                return [];
            }

            const content = fs.readFileSync(logFile, 'utf8');
            const logLines = content.trim().split('\n').filter(line => line.length > 0);
            
            const matchingLogs = [];
            
            for (const line of logLines) {
                try {
                    const log = JSON.parse(line);
                    const logString = JSON.stringify(log).toLowerCase();
                    
                    if (logString.includes(searchTerm.toLowerCase())) {
                        matchingLogs.push(log);
                        
                        if (matchingLogs.length >= maxResults) {
                            break;
                        }
                    }
                } catch {
                    // Skip invalid JSON lines
                }
            }
            
            return matchingLogs;
        } catch (error) {
            this.error('Failed to search logs', error, 'system');
            return [];
        }
    }
}

// Singleton instance
const logger = new Logger();

// Limpar logs antigos na inicialização
logger.cleanOldLogs();

// Agendar limpeza diária
setInterval(() => {
    logger.cleanOldLogs();
}, 24 * 60 * 60 * 1000); // 24 horas

module.exports = logger;
