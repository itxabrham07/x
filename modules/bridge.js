import { instagramBot } from '../core/instagram.js';
import { telegramBot } from '../core/telegram.js';
import { database } from '../core/database.js';
import { logger } from '../core/logger.js';
import { config } from '../core/config.js';

class BridgeModule {
  constructor() {
    this.isActive = true;
  }

  async initialize() {
    logger.info('🌉 Initializing bridge module...');
    
    // Handle Instagram messages
    instagramBot.onMessage(async (message) => {
      if (this.isActive) {
        await this.handleInstagramMessage(message);
      }
    });

    // Handle Telegram messages
    telegramBot.onMessage(async (message) => {
      if (this.isActive && message.threadId) {
        await this.handleTelegramMessage(message);
      }
    });

    logger.info('✅ Bridge module initialized');
  }

  async handleInstagramMessage(message) {
    try {
      logger.info(`🔄 Processing Instagram message from @${message.senderUsername}`);

      // Get or create thread mapping
      let mapping = await database.getThreadMapping(message.threadId);
      
      if (!mapping) {
        // Create new forum topic in Telegram
        const topicName = `@${message.senderUsername}`;
        const telegramThreadId = await telegramBot.createForumTopic(
          config.telegram.chatId,
          topicName
        );

        // Save mapping
        await database.saveThreadMapping(
          message.threadId,
          telegramThreadId,
          message.senderUsername
        );

        mapping = {
          instagramThreadId: message.threadId,
          telegramThreadId,
          instagramUsername: message.senderUsername
        };

        // Send welcome message
        await telegramBot.sendMessage(
          config.telegram.chatId,
          `🆕 <b>New Instagram conversation</b>\n` +
          `👤 User: @${message.senderUsername}\n` +
          `🔗 Thread ID: ${message.threadId}`,
          { message_thread_id: telegramThreadId }
        );
      }

      // Update thread activity
      await database.updateThreadActivity(message.threadId);

      // Forward message to Telegram
      await this.forwardToTelegram(message, mapping.telegramThreadId);

    } catch (error) {
      logger.error('❌ Error handling Instagram message:', error.message);
    }
  }

  async handleTelegramMessage(message) {
    try {
      // Skip bot commands
      if (message.text.startsWith('/') || message.text.startsWith('.')) {
        return;
      }

      logger.info(`🔄 Processing Telegram message from @${message.sender}`);

      // Get thread mapping
      const mapping = await database.getThreadMappingByTelegram(message.threadId);
      
      if (!mapping) {
        await telegramBot.sendMessage(
          config.telegram.chatId,
          '❌ No Instagram thread mapping found for this topic.',
          { message_thread_id: message.threadId }
        );
        return;
      }

      // Forward message to Instagram
      await this.forwardToInstagram(message, mapping.instagramThreadId);

    } catch (error) {
      logger.error('❌ Error handling Telegram message:', error.message);
    }
  }

  async forwardToTelegram(instagramMessage, telegramThreadId) {
    try {
      const chatId = config.telegram.chatId;
      
      // Format message header
      const header = `📱 <b>@${instagramMessage.senderUsername}</b>`;
      
      // Handle text messages
      if (instagramMessage.text) {
        const fullMessage = `${header}\n${instagramMessage.text}`;
        await telegramBot.sendMessage(chatId, fullMessage, {
          message_thread_id: telegramThreadId
        });
      }

      // Handle media
      if (instagramMessage.media && instagramMessage.media.length > 0) {
        for (const media of instagramMessage.media) {
          try {
            const caption = instagramMessage.text ? `${header}\n${instagramMessage.text}` : header;
            
            if (media.type === 'image') {
              await telegramBot.sendPhoto(chatId, media.url, {
                caption,
                message_thread_id: telegramThreadId,
                parse_mode: 'HTML'
              });
            } else if (media.type === 'video') {
              await telegramBot.sendVideo(chatId, media.url, {
                caption,
                message_thread_id: telegramThreadId,
                parse_mode: 'HTML'
              });
            } else if (media.type === 'voice') {
              await telegramBot.sendVoice(chatId, media.url, {
                caption,
                message_thread_id: telegramThreadId,
                parse_mode: 'HTML'
              });
            }
          } catch (mediaError) {
            logger.error(`❌ Error forwarding ${media.type}:`, mediaError.message);
            await telegramBot.sendMessage(chatId, 
              `${header}\n❌ Failed to forward ${media.type}`, {
              message_thread_id: telegramThreadId
            });
          }
        }
      }

      logger.info(`✅ Forwarded Instagram message to Telegram thread ${telegramThreadId}`);

    } catch (error) {
      logger.error('❌ Error forwarding to Telegram:', error.message);
    }
  }

  async forwardToInstagram(telegramMessage, instagramThreadId) {
    try {
      // Handle text messages
      if (telegramMessage.text) {
        await instagramBot.sendMessage(instagramThreadId, telegramMessage.text);
      }

      // Handle media
      if (telegramMessage.media && telegramMessage.media.length > 0) {
        for (const media of telegramMessage.media) {
          try {
            const { fileUrl } = await telegramBot.getFile(media.fileId);
            
            if (media.type === 'photo') {
              await instagramBot.sendMedia(instagramThreadId, fileUrl, 'image');
            } else if (media.type === 'video') {
              await instagramBot.sendMedia(instagramThreadId, fileUrl, 'video');
            }
            // Note: Instagram doesn't support voice messages in the same way
            
          } catch (mediaError) {
            logger.error(`❌ Error forwarding ${media.type} to Instagram:`, mediaError.message);
            await instagramBot.sendMessage(instagramThreadId, 
              `❌ Failed to forward ${media.type} from Telegram`);
          }
        }
      }

      logger.info(`✅ Forwarded Telegram message to Instagram thread ${instagramThreadId}`);

    } catch (error) {
      logger.error('❌ Error forwarding to Instagram:', error.message);
    }
  }

  // Command handlers
  async handleStatusCommand(message, args) {
    const mappings = await database.getAllMappings();
    const activeThreads = mappings.length;
    
    const statusText = `🌉 <b>Bridge Status</b>\n\n` +
      `🔄 Status: ${this.isActive ? '✅ Active' : '❌ Inactive'}\n` +
      `📱 Instagram: ${instagramBot.isRunning ? '✅ Connected' : '❌ Disconnected'}\n` +
      `💬 Telegram: ${telegramBot.isRunning ? '✅ Connected' : '❌ Disconnected'}\n` +
      `🔗 Active Threads: ${activeThreads}\n` +
      `⏱️ Uptime: ${telegramBot.getUptime()}`;

    await telegramBot.sendMessage(message.chatId, statusText, {
      message_thread_id: message.threadId
    });
  }

  async handleToggleCommand(message, args) {
    this.isActive = !this.isActive;
    const status = this.isActive ? 'enabled' : 'disabled';
    
    await telegramBot.sendMessage(message.chatId, 
      `🌉 Bridge ${status}`, {
      message_thread_id: message.threadId
    });
  }

  async handleThreadsCommand(message, args) {
    const mappings = await database.getAllMappings();
    
    if (mappings.length === 0) {
      await telegramBot.sendMessage(message.chatId, 
        '📭 No active thread mappings found.', {
        message_thread_id: message.threadId
      });
      return;
    }

    let threadsText = '🔗 <b>Active Thread Mappings</b>\n\n';
    
    for (const mapping of mappings) {
      const lastActivity = new Date(mapping.lastActivity).toLocaleString();
      threadsText += `👤 @${mapping.instagramUsername}\n`;
      threadsText += `📱 IG Thread: ${mapping.instagramThreadId}\n`;
      threadsText += `💬 TG Thread: ${mapping.telegramThreadId}\n`;
      threadsText += `⏰ Last Activity: ${lastActivity}\n\n`;
    }

    await telegramBot.sendMessage(message.chatId, threadsText, {
      message_thread_id: message.threadId
    });
  }
}

// Export commands
export const commands = [
  {
    name: 'bridge',
    description: 'Show bridge status',
    usage: '/bridge',
    category: 'Bridge',
    handler: async (message, args) => {
      await bridgeModule.handleStatusCommand(message, args);
    }
  },
  {
    name: 'toggle',
    description: 'Toggle bridge on/off',
    usage: '/toggle',
    category: 'Bridge',
    handler: async (message, args) => {
      await bridgeModule.handleToggleCommand(message, args);
    }
  },
  {
    name: 'threads',
    description: 'List active thread mappings',
    usage: '/threads',
    category: 'Bridge',
    handler: async (message, args) => {
      await bridgeModule.handleThreadsCommand(message, args);
    }
  }
];

export const bridgeModule = new BridgeModule();