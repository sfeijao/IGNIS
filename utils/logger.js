// utils/logger.js - Winston-based rotating logger
const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const level = process.env.LOG_LEVEL || 'info';

const logger = createLogger({
    level,
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(info => {
                    const ts = new Date(info.timestamp).toLocaleTimeString('pt-PT');
                    return `[${ts}] ${info.level}: ${info.message} ${info.stack || ''}`;
                })
            )
        }),
        new DailyRotateFile({
            filename: path.join(logsDir, 'app-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d',
            level: 'info'
        }),
        new DailyRotateFile({
            filename: path.join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '90d',
            level: 'error'
        })
    ],
    exitOnError: false
});

// Maintain compatibility with previous StructuredLogger API
module.exports = {
    error: (msg, meta = {}) => logger.error(msg, meta),
    warn: (msg, meta = {}) => logger.warn(msg, meta),
    info: (msg, meta = {}) => logger.info(msg, meta),
    debug: (msg, meta = {}) => logger.debug(msg, meta),
    trace: (msg, meta = {}) => logger.debug(msg, meta),
    command: (commandName, interaction, success = true) => {
        const metadata = {
            commandName,
            userId: interaction?.user?.id,
            username: interaction?.user?.username,
            guildId: interaction?.guild?.id,
            guildName: interaction?.guild?.name,
            success,
            type: 'command'
        };
        if (success) module.exports.info(`Comando executado: ${commandName}`, metadata);
        else module.exports.warn(`Comando falhou: ${commandName}`, metadata);
    },
    interaction: (typeName, customId, interaction, success = true) => {
        const metadata = {
            interactionType: typeName,
            customId,
            userId: interaction?.user?.id,
            username: interaction?.user?.username,
            guildId: interaction?.guild?.id,
            success,
            type: 'interaction'
        };
        if (success) module.exports.info(`Interação processada: ${typeName}`, metadata);
        else module.exports.warn(`Interação falhou: ${typeName}`, metadata);
    },
    database: (operation, table, success = true, metadata = {}) => {
        const logData = { operation, table, success, type: 'database', ...metadata };
        if (success) module.exports.debug(`Database ${operation}: ${table}`, logData);
        else module.exports.error(`Database ${operation} failed: ${table}`, logData);
    },
    api: (method, endpoint, statusCode, responseTime, metadata = {}) => {
        const logData = { method, endpoint, statusCode, responseTime: `${responseTime}ms`, type: 'api', ...metadata };
        const message = `${method} ${endpoint} - ${statusCode} (${responseTime}ms)`;
        if (statusCode >= 500) module.exports.error(message, logData);
        else if (statusCode >= 400) module.exports.warn(message, logData);
        else module.exports.info(message, logData);
    },
    cleanupOldLogs: (daysToKeep = 30) => {
        try {
            const files = fs.readdirSync(logsDir);
            const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
            files.forEach(file => {
                if (!file.endsWith('.gz') && file.endsWith('.log')) {
                    const p = path.join(logsDir, file);
                    const stats = fs.statSync(p);
                    if (stats.mtimeMs < cutoff) fs.unlinkSync(p);
                }
            });
            module.exports.info('Log cleanup completed', { daysToKeep });
        } catch (e) {
            module.exports.error('Error cleaning logs', { error: e.message });
        }
    }
};
