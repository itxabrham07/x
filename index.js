import { config, validateConfig } from './core/config.js';
import { logger } from './core/logger.js';
import { database } from './core/database.js';
import { instagramBot } from './core/instagram.js';
import { telegramBot } from './core/telegram.js';
import { commandManager } from './core/commands.js';
import { bridgeModule } from './modules/bridge.js';
import { commands as coreCommands } from './modules/core.js';
import { commands as bridgeCommands } from './modules/bridge.js';
import { MessageValidator } from './helpers/validators.js';

class BridgeBot {
  constructor() {
    this.isRunning = false;
    this.startTime = new Date();
  }

  async initialize() {
    try {
      logger.info('🚀 Starting Telegram-Instagram Bridge Bot...');

      // Validate configuration
      validateConfig();
      logger.info('✅ Configuration validated');

      // Connect to database
      await database.connect();
      logger.info('✅ Database connected');

      // Initialize Telegram bot
      await telegramBot.initialize();
      logger.info('✅ Telegram bot initialized');

      // Initialize Instagram bot
      await instagramBot.login();
      logger.info('✅ Instagram bot connected');

      // Register commands
      this.registerCommands();
      logger.info('✅ Commands registered');

      // Initialize bridge module
      await bridgeModule.initialize();
      logger.info('✅ Bridge module initialized');

      // Set up command handling
      this.setupCommandHandling();
      logger.info('✅ Command handling setup');

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      this.isRunning = true;
      logger.info('🎉 Bridge bot is now running!');

      // Send startup notification
      await this.sendStartupNotification();

    } catch (error) {
      logger.error('❌ Failed to initialize bridge bot:', error.message);
      process.exit(1);
    }
  }

  registerCommands() {
    // Register core commands
    commandManager.registerModule(coreCommands);
    
    // Register bridge commands
    commandManager.registerModule(bridgeCommands);

    logger.info(`📝 Registered ${commandManager.getAllCommands().length} commands`);
  }

  setupCommandHandling() {
    telegramBot.onMessage(async (message) => {
      try {
        // Skip non-command messages for command processing
        if (!MessageValidator.isCommand(message.text)) {
          return;
        }

        const parsed = MessageValidator.parseCommand(message.text);
        if (!parsed) {
          return;
        }

        const { command, args } = parsed;
        
        logger.info(`🔧 Executing command: ${command} with args: [${args.join(', ')}]`);

        const executed = await commandManager.executeCommand(command, message, args);
        
        if (!executed) {
          await telegramBot.sendMessage(message.chatId, 
            `❌ Unknown command: ${command}\nUse /help to see available commands.`, {
            message_thread_id: message.threadId
          });
        }

      } catch (error) {
        logger.error('❌ Error handling command:', error.message);
        
        await telegramBot.sendMessage(message.chatId, 
          `❌ Error executing command: ${error.message}`, {
          message_thread_id: message.threadId
        });
      }
    });
  }

  async sendStartupNotification() {
    try {
      const uptime = this.getUptime();
      const startupMessage = `🚀 <b>Bridge Bot Started</b>\n\n` +
        `⏰ Started at: ${this.startTime.toLocaleString()}\n` +
        `📱 Instagram: ✅ Connected\n` +
        `💬 Telegram: ✅ Connected\n` +
        `🗄️ Database: ✅ Connected\n\n` +
        `🤖 Bot is ready to bridge messages!\n` +
        `Use /help to see available commands.`;

      await telegramBot.sendMessage(config.telegram.chatId, startupMessage);
    } catch (error) {
      logger.warn('⚠️ Could not send startup notification:', error.message);
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`📴 Received ${signal}, shutting down gracefully...`);
      
      try {
        // Send shutdown notification
        await telegramBot.sendMessage(config.telegram.chatId, 
          `📴 Bridge bot is shutting down...`);
        
        // Disconnect services
        await instagramBot.disconnect();
        await telegramBot.stop();
        await database.disconnect();
        
        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error.message);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('🚨 Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  getUptime() {
    const uptime = Date.now() - this.startTime.getTime();
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Health check endpoint for monitoring
  getHealthStatus() {
    return {
      status: this.isRunning ? 'healthy' : 'unhealthy',
      uptime: this.getUptime(),
      services: {
        instagram: instagramBot.isRunning,
        telegram: telegramBot.isRunning,
        database: database.isConnected
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Start the bot
const bridgeBot = new BridgeBot();
bridgeBot.initialize().catch((error) => {
  logger.error('❌ Fatal error:', error);
  process.exit(1);
});

// Export for testing or external monitoring
export { bridgeBot };