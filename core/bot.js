import { logger } from './logger.js';
import { config, validateConfig } from '../config.js';
import { database } from '../utils/database.js';
import { telegramBot } from './telegram.js';
import { instagramBot } from './instagram.js';
import { moduleManager } from './module-manager.js';
import { messageHandler } from './message-handler.js';
import { rateLimiter } from './rate-limiter.js';

class Bot {
  constructor() {
    this.isRunning = false;
    this.startTime = new Date();
    this.modules = new Map();
  }

  async initialize() {
    try {
      logger.info('🚀 Initializing Telegram-Instagram Bridge Bot...');

      // Validate configuration
      validateConfig();
      logger.info('✅ Configuration validated');

      // Initialize database if enabled
      if (config.database.enabled) {
        await database.connect();
        logger.info('✅ Database connected');
      }

      // Initialize rate limiter
      rateLimiter.initialize();
      logger.info('✅ Rate limiter initialized');

      // Initialize Telegram bot if enabled
      if (config.telegram.enabled) {
        await telegramBot.initialize();
        logger.info('✅ Telegram bot initialized');
      }

      // Initialize Instagram bot if enabled
      if (config.instagram.enabled) {
        await instagramBot.initialize();
        logger.info('✅ Instagram bot initialized');
      }

      // Initialize module manager
      await moduleManager.initialize();
      logger.info('✅ Module manager initialized');

      // Initialize message handler
      await messageHandler.initialize();
      logger.info('✅ Message handler initialized');

      // Load modules
      await this.loadModules();
      logger.info('✅ Modules loaded');

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      this.isRunning = true;
      logger.info('🎉 Bot is now running!');

      // Send startup notification
      await this.sendStartupNotification();

    } catch (error) {
      logger.error('❌ Failed to initialize bot:', error);
      process.exit(1);
    }
  }

  async loadModules() {
    try {
      // Load core module
      const coreModule = await import('../modules/core.js');
      await moduleManager.loadModule('core', coreModule);

      // Load bridge module if enabled
      if (config.bridge.enabled) {
        try {
          const bridgeModule = await import('../bridge/bridge.js');
          await moduleManager.loadModule('bridge', bridgeModule);
          logger.info('🌉 Bridge module loaded successfully');
        } catch (error) {
          logger.error('❌ Failed to load bridge module:', error);
          logger.warn('⚠️ Bot will continue without bridge functionality');
        }
      } else {
        logger.info('🌉 Bridge module disabled in configuration');
      }

      logger.info(`📦 Loaded ${moduleManager.getModuleCount()} modules`);
    } catch (error) {
      logger.error('❌ Error loading modules:', error);
      throw error;
    }
  }

  async sendStartupNotification() {
    if (!config.telegram.enabled || !telegramBot.isConnected()) {
      return;
    }

    try {
      const uptime = this.getUptime();
      const moduleCount = moduleManager.getModuleCount();
      
      const message = `🚀 <b>Bot Started Successfully</b>\n\n` +
        `⏰ Started: ${this.startTime.toLocaleString()}\n` +
        `📦 Modules: ${moduleCount}\n` +
        `📱 Instagram: ${config.instagram.enabled ? '✅' : '❌'}\n` +
        `💬 Telegram: ${config.telegram.enabled ? '✅' : '❌'}\n` +
        `🌉 Bridge: ${config.bridge.enabled ? '✅' : '❌'}\n` +
        `🗄️ Database: ${config.database.enabled ? '✅' : '❌'}\n\n` +
        `Use /help to see available commands`;

      await telegramBot.sendMessage(config.telegram.chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
      logger.error('❌ Failed to send startup notification:', error);
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`📴 Received ${signal}, shutting down gracefully...`);
      
      try {
        // Send shutdown notification
        if (config.telegram.enabled && telegramBot.isConnected()) {
          await telegramBot.sendMessage(
            config.telegram.chatId,
            '📴 <b>Bot Shutting Down</b>\n\nGraceful shutdown initiated...',
            { parse_mode: 'HTML' }
          );
        }

        // Stop modules
        await moduleManager.stopAllModules();
        
        // Disconnect services
        if (instagramBot) await instagramBot.disconnect();
        if (telegramBot) await telegramBot.disconnect();
        if (database) await database.disconnect();
        
        logger.info('👋 Bot shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  getUptime() {
    const uptime = Date.now() - this.startTime.getTime();
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: this.getUptime(),
      modules: moduleManager.getModuleCount(),
      telegram: config.telegram.enabled && telegramBot.isConnected(),
      instagram: config.instagram.enabled && instagramBot.isConnected(),
      bridge: config.bridge.enabled,
      database: config.database.enabled && database.isConnected
    };
  }
}

export const bot = new Bot();