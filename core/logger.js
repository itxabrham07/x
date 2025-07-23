import winston from 'winston';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Ensure log directory exists
if (config.logging.enableFile && !fs.existsSync(config.logging.logDir)) {
  fs.mkdirSync(config.logging.logDir, { recursive: true });
}

// Custom format for console
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} [${level.toUpperCase()}]: ${stack || message} ${metaStr}`;
});

// Custom format for file
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  json()
);

// Create transports array
const transports = [];

// Console transport
if (config.logging.enableConsole) {
  transports.push(
    new winston.transports.Console({
      level: config.logging.level,
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        consoleFormat
      )
    })
  );
}

// File transports
if (config.logging.enableFile) {
  // Error log
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles
    })
  );

  // Combined log
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.logDir, 'combined.log'),
      format: fileFormat,
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles
    })
  );

  // Debug log (only if debug level)
  if (config.logging.level === 'debug') {
    transports.push(
      new winston.transports.File({
        filename: path.join(config.logging.logDir, 'debug.log'),
        level: 'debug',
        format: fileFormat,
        maxsize: config.logging.maxSize,
        maxFiles: config.logging.maxFiles
      })
    );
  }
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  silent: !config.logging.debug && config.logging.level === 'debug' ? true : false,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true })
  ),
  transports,
  exitOnError: false
});

// Add stream for Morgan HTTP logging if needed
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Dynamic log level changing
export function setLogLevel(level) {
  logger.level = level;
  config.logging.level = level;
  logger.silent = !config.logging.debug && level === 'debug' ? true : false;
  logger.info(`📊 Log level changed to: ${level}`);
}

// Debug control
export function setDebugMode(enabled) {
  config.logging.debug = enabled;
  if (enabled) {
    logger.level = 'debug';
    logger.silent = false;
  } else {
    logger.level = 'info';
    logger.silent = false;
  }
  logger.info(`🐛 Debug mode ${enabled ? 'enabled' : 'disabled'}`);
}

// Log system info on startup
logger.info(`🚀 Logger initialized - Level: ${config.logging.level}, Debug: ${config.logging.debug}, Console: ${config.logging.enableConsole}, File: ${config.logging.enableFile}`);