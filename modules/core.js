import { telegramBot } from '../core/telegram.js';
import { instagramBot } from '../core/instagram.js';
import { database } from '../core/database.js';
import { logger } from '../core/logger.js';
import { commandManager } from '../core/commands.js';
import fs from 'fs';
import os from 'os';

class CoreModule {
  constructor() {
    this.startTime = new Date();
  }

  async handlePingCommand(message, args) {
    const startTime = Date.now();
    const response = await telegramBot.sendMessage(message.chatId, '🏓 Pong!', {
      message_thread_id: message.threadId
    });
    const endTime = Date.now();
    const latency = endTime - startTime;

    // Edit message to show latency
    await telegramBot.bot.editMessageText(
      `🏓 Pong! (${latency}ms)`,
      {
        chat_id: message.chatId,
        message_id: response.message_id
      }
    );
  }

  async handleStatusCommand(message, args) {
    const uptime = this.getUptime();
    const memUsage = process.memoryUsage();
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024),
      freeMemory: Math.round(os.freemem() / 1024 / 1024)
    };

    const statusText = `🤖 <b>Bot Status</b>\n\n` +
      `⏱️ Uptime: ${uptime}\n` +
      `📱 Instagram: ${instagramBot.isRunning ? '✅ Connected' : '❌ Disconnected'}\n` +
      `💬 Telegram: ${telegramBot.isRunning ? '✅ Connected' : '❌ Disconnected'}\n` +
      `🗄️ Database: ${database.isConnected ? '✅ Connected' : '❌ Disconnected'}\n\n` +
      `<b>System Info</b>\n` +
      `🖥️ Platform: ${systemInfo.platform} (${systemInfo.arch})\n` +
      `🟢 Node.js: ${systemInfo.nodeVersion}\n` +
      `💾 Memory: ${Math.round(memUsage.rss / 1024 / 1024)}MB / ${systemInfo.totalMemory}MB\n` +
      `🆓 Free Memory: ${systemInfo.freeMemory}MB`;

    await telegramBot.sendMessage(message.chatId, statusText, {
      message_thread_id: message.threadId
    });
  }

  async handleLogsCommand(message, args) {
    try {
      const logFile = 'logs/combined.log';
      
      if (!fs.existsSync(logFile)) {
        await telegramBot.sendMessage(message.chatId, '❌ Log file not found.', {
          message_thread_id: message.threadId
        });
        return;
      }

      const logs = fs.readFileSync(logFile, 'utf8');
      const recentLogs = logs.split('\n').slice(-20).join('\n');
      
      if (recentLogs.length > 4000) {
        // Send as file if too long
        await telegramBot.bot.sendDocument(message.chatId, logFile, {
          caption: '📋 Recent logs (as file)',
          message_thread_id: message.threadId
        });
      } else {
        await telegramBot.sendMessage(message.chatId, 
          `📋 <b>Recent Logs</b>\n\n<pre>${recentLogs}</pre>`, {
          message_thread_id: message.threadId
        });
      }
    } catch (error) {
      logger.error('❌ Error reading logs:', error.message);
      await telegramBot.sendMessage(message.chatId, '❌ Error reading logs.', {
        message_thread_id: message.threadId
      });
    }
  }

  async handleRestartCommand(message, args) {
    await telegramBot.sendMessage(message.chatId, '🔄 Restarting bot...', {
      message_thread_id: message.threadId
    });

    logger.info('🔄 Bot restart requested');
    
    // Graceful shutdown
    setTimeout(async () => {
      await instagramBot.disconnect();
      await telegramBot.stop();
      await database.disconnect();
      process.exit(0);
    }, 1000);
  }

  async handleUptimeCommand(message, args) {
    const uptime = this.getUptime();
    const processUptime = this.formatDuration(process.uptime() * 1000);
    
    await telegramBot.sendMessage(message.chatId, 
      `⏱️ <b>Uptime</b>\n\n` +
      `🤖 Bot: ${uptime}\n` +
      `⚙️ Process: ${processUptime}`, {
      message_thread_id: message.threadId
    });
  }

  async handleModeCommand(message, args) {
    const mode = args[0];
    
    if (!mode) {
      await telegramBot.sendMessage(message.chatId, 
        '🔧 Current mode: Production\n\n' +
        'Available modes:\n' +
        '• <code>/mode debug</code> - Enable debug logging\n' +
        '• <code>/mode normal</code> - Normal operation', {
        message_thread_id: message.threadId
      });
      return;
    }

    switch (mode.toLowerCase()) {
      case 'debug':
        logger.level = 'debug';
        await telegramBot.sendMessage(message.chatId, '🐛 Debug mode enabled', {
          message_thread_id: message.threadId
        });
        break;
      case 'normal':
        logger.level = 'info';
        await telegramBot.sendMessage(message.chatId, '✅ Normal mode enabled', {
          message_thread_id: message.threadId
        });
        break;
      default:
        await telegramBot.sendMessage(message.chatId, '❌ Invalid mode. Use: debug, normal', {
          message_thread_id: message.threadId
        });
    }
  }

  async handleHelpCommand(message, args) {
    const helpText = commandManager.generateHelpText();
    await telegramBot.sendMessage(message.chatId, helpText, {
      message_thread_id: message.threadId
    });
  }

  getUptime() {
    return this.formatDuration(Date.now() - this.startTime.getTime());
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

// Export commands
export const commands = [
  {
    name: 'ping',
    description: 'Test bot responsiveness',
    usage: '/ping',
    category: 'Core',
    aliases: ['p'],
    handler: async (message, args) => {
      await coreModule.handlePingCommand(message, args);
    }
  },
  {
    name: 'status',
    description: 'Show bot status and system info',
    usage: '/status',
    category: 'Core',
    handler: async (message, args) => {
      await coreModule.handleStatusCommand(message, args);
    }
  },
  {
    name: 'logs',
    description: 'Show recent log entries',
    usage: '/logs',
    category: 'Core',
    handler: async (message, args) => {
      await coreModule.handleLogsCommand(message, args);
    }
  },
  {
    name: 'restart',
    description: 'Restart the bot',
    usage: '/restart',
    category: 'Core',
    handler: async (message, args) => {
      await coreModule.handleRestartCommand(message, args);
    }
  },
  {
    name: 'uptime',
    description: 'Show bot uptime',
    usage: '/uptime',
    category: 'Core',
    handler: async (message, args) => {
      await coreModule.handleUptimeCommand(message, args);
    }
  },
  {
    name: 'mode',
    description: 'Change bot operation mode',
    usage: '/mode [debug|normal]',
    category: 'Core',
    handler: async (message, args) => {
      await coreModule.handleModeCommand(message, args);
    }
  },
  {
    name: 'help',
    description: 'Show available commands',
    usage: '/help',
    category: 'Core',
    aliases: ['h'],
    handler: async (message, args) => {
      await coreModule.handleHelpCommand(message, args);
    }
  }
];

export const coreModule = new CoreModule();