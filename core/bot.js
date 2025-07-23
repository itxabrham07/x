
import { IgApiClient } from 'instagram-private-api';
import { withRealtime } from 'instagram_mqtt';
import fs from 'fs';
import tough from 'tough-cookie';

class InstagramBot {
  constructor() {
    this.ig = withRealtime(new IgApiClient());
    this.messageHandlers = [];
    this.isRunning = false;
    this.lastMessageCheck = new Date(Date.now() - 60000); // Start 1 minute ago
  }

  log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`[${level}] ${message}`, ...args);
  }

  async login() {
    try {
      const username = process.env.INSTAGRAM_USERNAME;
      const password = process.env.INSTAGRAM_PASSWORD;

      if (!username) {
        throw new Error('❌ INSTAGRAM_USERNAME is missing');
      }

      this.ig.state.generateDevice(username);

      // Try to load cookies first
      try {
        await this.loadCookiesFromJson('./cookies.json');
        await this.ig.account.currentUser();
        this.log('INFO', '✅ Logged in using saved cookies');
      } catch (error) {
        if (!password) {
          throw new Error('❌ INSTAGRAM_PASSWORD is required for fresh login');
        }
        this.log('INFO', '🔑 Attempting fresh login...');
        await this.ig.account.login(username, password);
        this.log('INFO', '✅ Fresh login successful');
      }

      // Register handlers BEFORE connecting
      this.registerRealtimeHandlers();

      // Connect to realtime
      await this.ig.realtime.connect({
        irisData: await this.ig.feed.directInbox().request(),
      });

      const user = await this.ig.account.currentUser();
      this.log('INFO', `✅ Connected as @${user.username} (ID: ${user.pk})`);

      this.isRunning = true;
      this.log('INFO', '🚀 Instagram bot is now running and listening for messages');

    } catch (error) {
      this.log('ERROR', '❌ Failed to initialize bot:', error.message);
      throw error;
    }
  }

  async loadCookiesFromJson(path = './cookies.json') {
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

    this.log('INFO', `🍪 Loaded ${cookies.length} cookies from file`);
  }

  registerRealtimeHandlers() {
    this.log('INFO', '📡 Registering real-time event handlers...');

    // Main message handler - this is the key one for direct messages
    this.ig.realtime.on('message', async (data) => {
      try {
        this.log('INFO', '📨 [Realtime] Message event received');
        
        if (!data.message) {
          this.log('WARN', '⚠️ No message in event data');
          return;
        }

        if (!this.isNewMessage(data.message)) {
          this.log('WARN', '⚠️ Message filtered as old');
          return;
        }

        this.log('INFO', '✅ Processing new message...');
        await this.handleMessage(data.message, data);

      } catch (err) {
        this.log('ERROR', '❌ Error in message handler:', err.message);
      }
    });

    // Direct events handler
    this.ig.realtime.on('direct', async (data) => {
      try {
        this.log('INFO', '📨 [Realtime] Direct event received');
        
        if (data.message) {
          if (!this.isNewMessage(data.message)) {
            this.log('WARN', '⚠️ Direct message filtered as old');
            return;
          }

          this.log('INFO', '✅ Processing new direct message...');
          await this.handleMessage(data.message, data);
        }

      } catch (err) {
        this.log('ERROR', '❌ Error in direct handler:', err.message);
      }
    });

    // Debug all received events
    this.ig.realtime.on('receive', (topic, messages) => {
      // Safely convert topic to string for checking
      const topicStr = String(topic || '');
      if (topicStr.includes('direct') || topicStr.includes('message')) {
        this.log('INFO', `📥 [Realtime] Received: ${topicStr}`);
      }
    });

    // Error handling
    this.ig.realtime.on('error', (err) => {
      this.log('ERROR', '🚨 Realtime error:', err.message || err);
    });

    this.ig.realtime.on('close', () => {
      this.log('WARN', '🔌 Realtime connection closed');
    });
  }

  isNewMessage(message) {
    try {
      // Instagram timestamps are in microseconds
      const messageTime = new Date(parseInt(message.timestamp) / 1000);
      
      this.log('INFO', `⏰ Message time: ${messageTime.toISOString()}, Last check: ${this.lastMessageCheck.toISOString()}`);

      const isNew = messageTime > this.lastMessageCheck;
      
      if (isNew) {
        this.lastMessageCheck = messageTime;
        this.log('INFO', '✅ Message is new');
      } else {
        this.log('WARN', '❌ Message is old');
      }

      return isNew;
    } catch (error) {
      this.log('ERROR', '❌ Error checking message timestamp:', error.message);
      return true; // Default to processing
    }
  }

  async handleMessage(message, eventData) {
    try {
      // Try to find sender info from different possible locations
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
        type: message.item_type
      };

      this.log('INFO', `💬 New message from @${processedMessage.senderUsername}: ${processedMessage.text}`);

      // Execute message handlers
      for (const handler of this.messageHandlers) {
        try {
          await handler(processedMessage);
        } catch (handlerError) {
          this.log('ERROR', '❌ Message handler error:', handlerError.message);
        }
      }

    } catch (error) {
      this.log('ERROR', '❌ Error handling message:', error.message);
    }
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
    this.log('INFO', `📝 Added message handler (total: ${this.messageHandlers.length})`);
  }

  async sendMessage(threadId, text) {
    try {
      await this.ig.entity.directThread(threadId).broadcastText(text);
      this.log('INFO', `📤 Sent message to thread ${threadId}: ${text}`);
      return true;
    } catch (error) {
      this.log('ERROR', '❌ Error sending message:', error.message);
      throw error;
    }
  }

  async disconnect() {
    this.log('INFO', '🔌 Disconnecting from Instagram...');
    this.isRunning = false;
    
    try {
      if (this.ig.realtime) {
        await this.ig.realtime.disconnect();
      }
      this.log('INFO', '✅ Disconnected successfully');
    } catch (error) {
      this.log('WARN', '⚠️ Error during disconnect:', error.message);
    }
  }
}

// Main execution
async function main() {
  const bot = new InstagramBot();
  
  // Add message handler with ping command
  bot.onMessage(async (message) => {
    console.log('🔔 MESSAGE HANDLER TRIGGERED:', {
      from: message.senderUsername,
      text: message.text,
      timestamp: message.timestamp,
      threadId: message.threadId
    });
    
    // Handle ping command
    if (message.text.toLowerCase().trim() === 'ping') {
      console.log('🏓 Responding to ping...');
      await bot.sendMessage(message.threadId, '🤖 Pong! Bot is working perfectly!');
    }
    
    // Handle test command
    if (message.text.toLowerCase().includes('test')) {
      console.log('🧪 Responding to test...');
      await bot.sendMessage(message.threadId, '✅ Bot is working! Send "ping" for a quick response.');
    }
  });
  
  try {
    await bot.login();
    
    console.log('🚀 Bot is running. Send "ping" or "test" to verify...');
    
    // Heartbeat every 30 seconds
    setInterval(() => {
      console.log(`💓 Bot heartbeat - Running: ${bot.isRunning}, Last check: ${bot.lastMessageCheck.toISOString()}`);
    }, 30000);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n👋 Shutting down...');
      await bot.disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Bot failed to start:', error.message);
    process.exit(1);
  }
}

main();
