import { logger } from '../core/logger.js';

export class MessageValidator {
  static isValidInstagramMessage(message) {
    if (!message) {
      logger.warn('❌ Invalid message: null or undefined');
      return false;
    }

    if (!message.id) {
      logger.warn('❌ Invalid message: missing ID');
      return false;
    }

    if (!message.sender && !message.senderUsername) {
      logger.warn('❌ Invalid message: missing sender information');
      return false;
    }

    if (!message.threadId) {
      logger.warn('❌ Invalid message: missing thread ID');
      return false;
    }

    return true;
  }

  static isValidTelegramMessage(message) {
    if (!message) {
      logger.warn('❌ Invalid message: null or undefined');
      return false;
    }

    if (!message.id) {
      logger.warn('❌ Invalid message: missing ID');
      return false;
    }

    if (!message.sender && !message.senderId) {
      logger.warn('❌ Invalid message: missing sender information');
      return false;
    }

    if (!message.chatId) {
      logger.warn('❌ Invalid message: missing chat ID');
      return false;
    }

    return true;
  }

  static isCommand(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }

    return text.startsWith('/') || text.startsWith('.');
  }

  static parseCommand(text) {
    if (!this.isCommand(text)) {
      return null;
    }

    const parts = text.slice(1).split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    return { command, args };
  }

  static isValidMediaType(mediaType) {
    const validTypes = ['photo', 'video', 'voice', 'document', 'sticker', 'image'];
    return validTypes.includes(mediaType);
  }

  static isValidFileSize(fileSize, maxSize = 50 * 1024 * 1024) { // 50MB default
    return fileSize && fileSize <= maxSize;
  }

  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static sanitizeUsername(username) {
    if (!username || typeof username !== 'string') {
      return 'unknown_user';
    }

    // Remove @ symbol if present
    username = username.replace(/^@/, '');
    
    // Replace invalid characters with underscores
    username = username.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // Ensure it's not empty
    if (username.length === 0) {
      return 'unknown_user';
    }

    // Limit length
    if (username.length > 32) {
      username = username.substring(0, 32);
    }

    return username;
  }

  static isRecentMessage(timestamp, maxAgeMinutes = 5) {
    if (!timestamp) {
      return false;
    }

    const messageTime = new Date(timestamp);
    const now = new Date();
    const ageMinutes = (now - messageTime) / (1000 * 60);

    return ageMinutes <= maxAgeMinutes;
  }
}

export class ConfigValidator {
  static validateEnvironmentVariables() {
    const required = [
      'INSTAGRAM_USERNAME',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_CHAT_ID',
      'MONGODB_URI'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate formats
    if (!this.isValidTelegramToken(process.env.TELEGRAM_BOT_TOKEN)) {
      throw new Error('Invalid Telegram bot token format');
    }

    if (!this.isValidChatId(process.env.TELEGRAM_CHAT_ID)) {
      throw new Error('Invalid Telegram chat ID format');
    }

    if (!this.isValidMongoUri(process.env.MONGODB_URI)) {
      throw new Error('Invalid MongoDB URI format');
    }

    return true;
  }

  static isValidTelegramToken(token) {
    // Telegram bot tokens follow the format: 123456789:ABCdefGHIjklMNOpqrSTUvwxyz
    const tokenRegex = /^\d{8,10}:[A-Za-z0-9_-]{35}$/;
    return tokenRegex.test(token);
  }

  static isValidChatId(chatId) {
    // Chat IDs can be positive or negative integers
    const chatIdRegex = /^-?\d+$/;
    return chatIdRegex.test(chatId);
  }

  static isValidMongoUri(uri) {
    // Basic MongoDB URI validation
    return uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
  }
}