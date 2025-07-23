import { IgApiClient } from 'instagram-private-api';
import { withRealtime } from 'instagram_mqtt';
import fs from 'fs';
import tough from 'tough-cookie';
import { config } from './config.js';
import { logger } from './logger.js';
import { database } from './database.js';

class InstagramBot {
  constructor() {
    this.ig = withRealtime(new IgApiClient());
    this.messageHandlers = [];
    this.isRunning = false;
    this.lastMessageCheck = new Date(Date.now() - 60000);
    this.currentUser = null;
  }

  async login() {
    try {
      const { username, password } = config.instagram;

      if (!username) {
        throw new Error('❌ INSTAGRAM_USERNAME is missing');
      }

      this.ig.state.generateDevice(username);

      // Try to load cookies first
      try {
        await this.loadCookiesFromJson('./cookies.json');
        this.currentUser = await this.ig.account.currentUser();
        logger.info('✅ Logged in using saved cookies');
      } catch (error) {
        if (!password) {
          throw new Error('❌ INSTAGRAM_PASSWORD is required for fresh login');
        }
        logger.info('🔑 Attempting fresh login...');
        await this.ig.account.login(username, password);
        this.currentUser = await this.ig.account.currentUser();
        logger.info('✅ Fresh login successful');
        
        // Save cookies for next time
        await this.saveCookiesToJson('./cookies.json');
      }

      // Register handlers BEFORE connecting
      this.registerRealtimeHandlers();

      // Connect to realtime
      await this.ig.realtime.connect({
        irisData: await this.ig.feed.directInbox().request(),
      });

      logger.info(`✅ Connected as @${this.currentUser.username} (ID: ${this.currentUser.pk})`);

      this.isRunning = true;
      logger.info('🚀 Instagram bot is now running and listening for messages');

    } catch (error) {
      logger.error('❌ Failed to initialize Instagram bot:', error.message);
      throw error;
    }
  }

  async loadCookiesFromJson(path = './cookies.json') {
    if (!fs.existsSync(path)) {
      throw new Error('Cookies file not found');
    }

    const raw = fs.readFileSync(path, 'utf-8');
    const cookies = JSON.parse(raw);

    for (const cookie of cookies) {
      const toughCookie = new tough.Cookie({
        key: cookie.name,
        value: cookie.value,
        domain: cookie.domain.replace(/^\./, ''),
        path: cookie.path || '/',
        secure: cookie.secure !== false,
        httpOnly: cookie.httpOnly !== false,
      });

      await this.ig.state.cookieJar.setCookie(
        toughCookie.toString(),
        `https://${toughCookie.domain}${toughCookie.path}`
      );
    }

    logger.info(`🍪 Loaded ${cookies.length} cookies from file`);
  }

  async saveCookiesToJson(path = './cookies.json') {
    try {
      const cookies = await this.ig.state.cookieJar.getCookies('https://instagram.com');
      const cookieData = cookies.map(cookie => ({
        name: cookie.key,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly
      }));

      fs.writeFileSync(path, JSON.stringify(cookieData, null, 2));
      logger.info(`🍪 Saved ${cookieData.length} cookies to file`);
    } catch (error) {
      logger.warn('⚠️ Failed to save cookies:', error.message);
    }
  }

  registerRealtimeHandlers() {
    logger.info('📡 Registering real-time event handlers...');

    this.ig.realtime.on('message', async (data) => {
      try {
        if (!data.message || !this.isNewMessage(data.message)) {
          return;
        }

        await this.handleMessage(data.message, data);
      } catch (err) {
        logger.error('❌ Error in message handler:', err.message);
      }
    });

    this.ig.realtime.on('direct', async (data) => {
      try {
        if (data.message && this.isNewMessage(data.message)) {
          await this.handleMessage(data.message, data);
        }
      } catch (err) {
        logger.error('❌ Error in direct handler:', err.message);
      }
    });

    this.ig.realtime.on('error', (err) => {
      logger.error('🚨 Realtime error:', err.message || err);
    });

    this.ig.realtime.on('close', () => {
      logger.warn('🔌 Realtime connection closed');
    });
  }

  isNewMessage(message) {
    try {
      const messageTime = new Date(parseInt(message.timestamp) / 1000);
      const isNew = messageTime > this.lastMessageCheck;
      
      if (isNew) {
        this.lastMessageCheck = messageTime;
      }

      return isNew;
    } catch (error) {
      logger.error('❌ Error checking message timestamp:', error.message);
      return true;
    }
  }

  async handleMessage(message, eventData) {
    try {
      // Skip messages from self
      if (message.user_id?.toString() === this.currentUser?.pk?.toString()) {
        return;
      }

      let sender = null;
      if (eventData.thread && eventData.thread.users) {
        sender = eventData.thread.users.find(u => u.pk?.toString() === message.user_id?.toString());
      }
      
      const processedMessage = {
        id: message.item_id,
        text: message.text || '',
        sender: message.user_id,
        senderUsername: sender?.username || `user_${message.user_id}`,
        timestamp: new Date(parseInt(message.timestamp) / 1000),
        threadId: eventData.thread?.thread_id || message.thread_id || 'unknown',
        threadTitle: eventData.thread?.thread_title || 'Direct Message',
        type: message.item_type,
        media: this.extractMediaFromMessage(message)
      };

      logger.info(`💬 New message from @${processedMessage.senderUsername}: ${processedMessage.text || '[Media]'}`);

      // Save to database
      await database.saveMessage({
        platform: 'instagram',
        messageId: processedMessage.id,
        threadId: processedMessage.threadId,
        sender: processedMessage.senderUsername,
        content: processedMessage.text,
        mediaType: processedMessage.type,
        originalData: message
      });

      // Execute message handlers
      for (const handler of this.messageHandlers) {
        try {
          await handler(processedMessage);
        } catch (handlerError) {
          logger.error('❌ Message handler error:', handlerError.message);
        }
      }

    } catch (error) {
      logger.error('❌ Error handling message:', error.message);
    }
  }

  extractMediaFromMessage(message) {
    const media = [];
    
    if (message.media) {
      if (message.media.image_versions2) {
        media.push({
          type: 'image',
          url: message.media.image_versions2.candidates[0]?.url
        });
      }
      
      if (message.media.video_versions) {
        media.push({
          type: 'video',
          url: message.media.video_versions[0]?.url
        });
      }
    }
    
    if (message.voice_media) {
      media.push({
        type: 'voice',
        url: message.voice_media.media?.audio?.audio_src
      });
    }

    return media;
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
    logger.info(`📝 Added message handler (total: ${this.messageHandlers.length})`);
  }

  async sendMessage(threadId, text) {
    try {
      await this.ig.entity.directThread(threadId).broadcastText(text);
      logger.info(`📤 Sent message to Instagram thread ${threadId}: ${text}`);
      return true;
    } catch (error) {
      logger.error('❌ Error sending Instagram message:', error.message);
      throw error;
    }
  }

  async sendMedia(threadId, mediaUrl, mediaType) {
    try {
      const thread = this.ig.entity.directThread(threadId);
      
      // Download media first
      const response = await fetch(mediaUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      if (mediaType === 'image') {
        await thread.broadcastPhoto({ file: buffer });
      } else if (mediaType === 'video') {
        await thread.broadcastVideo({ video: buffer });
      }
      
      logger.info(`📤 Sent ${mediaType} to Instagram thread ${threadId}`);
      return true;
    } catch (error) {
      logger.error(`❌ Error sending ${mediaType} to Instagram:`, error.message);
      throw error;
    }
  }

  async getUserInfo(userId) {
    try {
      const user = await this.ig.user.info(userId);
      return {
        id: user.pk,
        username: user.username,
        fullName: user.full_name,
        profilePicUrl: user.profile_pic_url
      };
    } catch (error) {
      logger.error('❌ Error getting user info:', error.message);
      return null;
    }
  }

  async disconnect() {
    logger.info('🔌 Disconnecting from Instagram...');
    this.isRunning = false;
    
    try {
      if (this.ig.realtime) {
        await this.ig.realtime.disconnect();
      }
      logger.info('✅ Instagram disconnected successfully');
    } catch (error) {
      logger.warn('⚠️ Error during Instagram disconnect:', error.message);
    }
  }
}

export const instagramBot = new InstagramBot();