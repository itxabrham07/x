import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Bot Configuration
  bot: {
    name: 'Telegram-Instagram Bridge',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },

  // Instagram Configuration
  instagram: {
    username: process.env.INSTAGRAM_USERNAME,
    password: process.env.INSTAGRAM_PASSWORD,
    enabled: process.env.INSTAGRAM_ENABLED === 'true' || true,
    sessionPath: './instagram_session.json',
    reconnectDelay: 5000,
    maxReconnectAttempts: 5
  },

  // Telegram Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    enabled: process.env.TELEGRAM_ENABLED === 'true' || true,
    polling: true,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || null
  },

  // Bridge Configuration
  bridge: {
    enabled: process.env.BRIDGE_ENABLED === 'true' || true,
    autoCreateTopics: true,
    forwardMedia: true,
    forwardText: true,
    maxMediaSize: 50 * 1024 * 1024, // 50MB
    messageTimeout: 30000
  },

  // Database Configuration
  database: {
    enabled: process.env.DATABASE_ENABLED === 'true' || true,
    uri: process.env.MONGODB_URI,
    name: process.env.MONGODB_DB_NAME || 'telegram_instagram_bridge',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info', // debug, info, warn, error
    enableConsole: process.env.LOG_CONSOLE === 'true' || true,
    enableFile: process.env.LOG_FILE === 'true' || true,
    maxFiles: 5,
    maxSize: '10m',
    datePattern: 'YYYY-MM-DD',
    logDir: './logs'
  },

  // Rate Limiting
  rateLimiting: {
    enabled: process.env.RATE_LIMITING_ENABLED === 'true' || true,
    maxCommands: 10,
    windowMs: 60000, // 1 minute
    maxMessages: 50,
    messageWindowMs: 60000
  },

  // Admin Configuration
  admin: {
    users: (process.env.ADMIN_USERS || '').split(',').filter(Boolean),
    enableAdminCommands: true
  }
};

// Validation function
export function validateConfig() {
  const required = [];
  
  if (config.instagram.enabled) {
    if (!config.instagram.username) required.push('INSTAGRAM_USERNAME');
    if (!config.instagram.password) required.push('INSTAGRAM_PASSWORD');
  }
  
  if (config.telegram.enabled) {
    if (!config.telegram.botToken) required.push('TELEGRAM_BOT_TOKEN');
    if (!config.telegram.chatId) required.push('TELEGRAM_CHAT_ID');
  }
  
  if (config.database.enabled) {
    if (!config.database.uri) required.push('MONGODB_URI');
  }
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
}