// Legacy config file - use .env instead
// This file is kept for backward compatibility
console.warn('⚠️ Using legacy config.js - please migrate to .env file');

export const config = {
  instagram: {
    username: 'itxrey',
    password: 'your_instagram_password',
    useMongoSession: true
  },
  
  telegram: {
    botToken: '7580382614:AAH30PW6TFmgRzbC7HUXIHQ35GpndbJOIEI',
    chatId: '-1002710686896',
    enabled: true,
    forwardMessages: true,
    forwardMedia: true
  },
  
  mongo: {
    uri: 'mongodb+srv://itxelijah07:ivp8FYGsbVfjQOkj@cluster0.wh25x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    dbName: 'hyper_insta',
  },

  admin: {
    users: ['itxrey', 'iarshman']
  },
  
  app: {
    logLevel: 'info',
    environment: 'development'
  }
};