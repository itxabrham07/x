import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';
import { logger } from './logger.js';
import { database } from './database.js';
import axios from 'axios';
import FormData from 'form-data';

class TelegramBotManager {
  constructor() {
    this.bot = null;
    this.messageHandlers = [];
    this.isRunning = false;
    this.startTime = new Date();
  }

  async initialize() {
    try {
      this.bot = new TelegramBot(config.telegram.botToken, { polling: true });
      
      // Register event handlers
      this.registerHandlers();
      
      this.isRunning = true;
      logger.info('✅ Telegram bot initialized and polling started');
      
    } catch (error) {
      logger.error('❌ Failed to initialize Telegram bot:', error.message);
      throw error;
    }
  }

  registerHandlers() {
    // Handle all messages
    this.bot.on('message', async (msg) => {
      try {
        // Skip messages not from the configured chat
        if (msg.chat.id.toString() !== config.telegram.chatId.toString()) {
          return;
        }

        // Skip old messages (older than 1 minute)
        const messageAge = Date.now() - (msg.date * 1000);
        if (messageAge > 60000) {
          return;
        }

        const processedMessage = {
          id: msg.message_id,
          text: msg.text || msg.caption || '',
          sender: msg.from.username || msg.from.first_name,
          senderId: msg.from.id,
          timestamp: new Date(msg.date * 1000),
          chatId: msg.chat.id,
          threadId: msg.message_thread_id || null,
          replyToMessage: msg.reply_to_message,
          media: this.extractMediaFromMessage(msg),
          originalMessage: msg
        };

        logger.info(`📨 Telegram message from @${processedMessage.sender}: ${processedMessage.text || '[Media]'}`);

        // Save to database
        await database.saveMessage({
          platform: 'telegram',
          messageId: processedMessage.id,
          threadId: processedMessage.threadId,
          sender: processedMessage.sender,
          content: processedMessage.text,
          originalData: msg
        });

        // Execute message handlers
        for (const handler of this.messageHandlers) {
          try {
            await handler(processedMessage);
          } catch (handlerError) {
            logger.error('❌ Telegram message handler error:', handlerError.message);
          }
        }

      } catch (error) {
        logger.error('❌ Error handling Telegram message:', error.message);
      }
    });

    // Handle polling errors
    this.bot.on('polling_error', (error) => {
      logger.error('🚨 Telegram polling error:', error.message);
    });

    // Handle webhook errors
    this.bot.on('webhook_error', (error) => {
      logger.error('🚨 Telegram webhook error:', error.message);
    });
  }

  extractMediaFromMessage(msg) {
    const media = [];
    
    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1]; // Get highest resolution
      media.push({
        type: 'photo',
        fileId: photo.file_id,
        fileSize: photo.file_size
      });
    }
    
    if (msg.video) {
      media.push({
        type: 'video',
        fileId: msg.video.file_id,
        fileSize: msg.video.file_size,
        duration: msg.video.duration
      });
    }
    
    if (msg.voice) {
      media.push({
        type: 'voice',
        fileId: msg.voice.file_id,
        fileSize: msg.voice.file_size,
        duration: msg.voice.duration
      });
    }
    
    if (msg.document) {
      media.push({
        type: 'document',
        fileId: msg.document.file_id,
        fileSize: msg.document.file_size,
        fileName: msg.document.file_name,
        mimeType: msg.document.mime_type
      });
    }
    
    if (msg.sticker) {
      media.push({
        type: 'sticker',
        fileId: msg.sticker.file_id,
        emoji: msg.sticker.emoji
      });
    }

    return media;
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
    logger.info(`📝 Added Telegram message handler (total: ${this.messageHandlers.length})`);
  }

  async createForumTopic(chatId, name) {
    try {
      const topic = await this.bot.createForumTopic(chatId, name);
      logger.info(`📋 Created forum topic: ${name} (ID: ${topic.message_thread_id})`);
      return topic.message_thread_id;
    } catch (error) {
      logger.error('❌ Error creating forum topic:', error.message);
      throw error;
    }
  }

  async sendMessage(chatId, text, options = {}) {
    try {
      const message = await this.bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });
      logger.info(`📤 Sent Telegram message to ${chatId}: ${text.substring(0, 50)}...`);
      return message;
    } catch (error) {
      logger.error('❌ Error sending Telegram message:', error.message);
      throw error;
    }
  }

  async sendPhoto(chatId, photo, options = {}) {
    try {
      const message = await this.bot.sendPhoto(chatId, photo, options);
      logger.info(`📤 Sent photo to Telegram chat ${chatId}`);
      return message;
    } catch (error) {
      logger.error('❌ Error sending photo to Telegram:', error.message);
      throw error;
    }
  }

  async sendVideo(chatId, video, options = {}) {
    try {
      const message = await this.bot.sendVideo(chatId, video, options);
      logger.info(`📤 Sent video to Telegram chat ${chatId}`);
      return message;
    } catch (error) {
      logger.error('❌ Error sending video to Telegram:', error.message);
      throw error;
    }
  }

  async sendVoice(chatId, voice, options = {}) {
    try {
      const message = await this.bot.sendVoice(chatId, voice, options);
      logger.info(`📤 Sent voice message to Telegram chat ${chatId}`);
      return message;
    } catch (error) {
      logger.error('❌ Error sending voice to Telegram:', error.message);
      throw error;
    }
  }

  async getFile(fileId) {
    try {
      const file = await this.bot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
      return { file, fileUrl };
    } catch (error) {
      logger.error('❌ Error getting Telegram file:', error.message);
      throw error;
    }
  }

  async downloadFile(fileUrl) {
    try {
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      logger.error('❌ Error downloading file:', error.message);
      throw error;
    }
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

  async stop() {
    logger.info('🔌 Stopping Telegram bot...');
    this.isRunning = false;
    
    try {
      await this.bot.stopPolling();
      logger.info('✅ Telegram bot stopped successfully');
    } catch (error) {
      logger.warn('⚠️ Error stopping Telegram bot:', error.message);
    }
  }
}

export const telegramBot = new TelegramBotManager();
