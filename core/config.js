import dotenv from 'dotenv';
dotenv.config();

export const config = {
  instagram: {
    username: process.env.INSTAGRAM_USERNAME,
    password: process.env.INSTAGRAM_PASSWORD,
    useMongoSession: true
  },
  
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    enabled: true,
    forwardMessages: true,
    forwardMedia: true
  },
  
  mongo: {
    uri: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB_NAME || 'telegram_instagram_bridge'
  },
  
  app: {
    logLevel: process.env.LOG_LEVEL || 'info',
    environment: process.env.ENVIRONMENT || 'development'
  }
};

// Validate required configuration
export function validateConfig() {
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
}