import { IgApiClient } from 'instagram-private-api';
import { logger } from './logger.js';
import { config } from '../config.js';
import { messageHandler } from './message-handler.js';
import fs from 'fs';

class InstagramBot {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.instagram.maxReconnectAttempts;
    this.reconnectDelay = config.instagram.reconnectDelay;
  }

  async initialize() {
    if (!config.instagram.enabled) {
      logger.warn('📱 Instagram bot is disabled in configuration');
      return;
    }

    try {
      logger.info('📱 Initializing Instagram bot...');
      
      this.client = new IgApiClient();
      this.client.state.generateDevice(config.instagram.username);

      // Load session if exists
      await this.loadSession();

      // Login
      await this.login();

      // Setup message listening
      this.setupMessageListener();

      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      logger.info('📱 Instagram bot initialized successfully');
    } catch (error) {
      logger.error('📱 Failed to initialize Instagram bot:', error);
      throw error;
    }
  }

  async loadSession() {
    try {
      if (fs.existsSync(config.instagram.sessionPath)) {
        const sessionData = fs.readFileSync(config.instagram.sessionPath, 'utf8');
        await this.client.state.deserialize(sessionData);
        logger.debug('📱 Instagram session loaded from file');
      }
    } catch (error) {
      logger.warn('📱 Failed to load Instagram session:', error);
    }
  }

  async saveSession() {
    try {
      const sessionData = await this.client.state.serialize();
      delete sessionData.constants;
      fs.writeFileSync(config.instagram.sessionPath, JSON.stringify(sessionData));
      logger.debug('📱 Instagram session saved to file');
    } catch (error) {
      logger.error('📱 Failed to save Instagram session:', error);
    }
  }

  async login() {
    try {
      logger.info('📱 Logging into Instagram...');
      
      await this.client.account.login(config.instagram.username, config.instagram.password);
      
      // Save session after successful login
      await this.saveSession();
      
      logger.info(`📱 Successfully logged into Instagram as @${config.instagram.username}`);
    } catch (error) {
      logger.error('📱 Instagram login failed:', error);
      throw error;
    }
  }

  setupMessageListener() {
    try {
      // This is a simplified version - you'll need to implement proper MQTT listening
      // or use Instagram's realtime API for message listening
      logger.info('📱 Setting up Instagram message listener...');
      
      // Placeholder for message listening setup
      // In a real implementation, you'd set up MQTT or polling for new messages
      
      logger.info('📱 Instagram message listener setup complete');
    } catch (error) {
      logger.error('📱 Failed to setup Instagram message listener:', error);
    }
  }

  async sendMessage(threadId, text, mediaPath = null) {
    if (!this.isConnected) {
      throw new Error('Instagram bot not connected');
    }

    try {
      const thread = this.client.entity.directThread(threadId);
      
      if (mediaPath) {
        // Send media message
        await thread.broadcastPhoto({ file: fs.readFileSync(mediaPath) });
        logger.debug(`📱 Sent media message to Instagram thread ${threadId}`);
      } else {
        // Send text message
        await thread.broadcastText(text);
        logger.debug(`📱 Sent text message to Instagram thread ${threadId}`);
      }
    } catch (error) {
      logger.error(`📱 Failed to send message to Instagram thread ${threadId}:`, error);
      throw error;
    }
  }

  async getThreadInfo(threadId) {
    if (!this.isConnected) {
      throw new Error('Instagram bot not connected');
    }

    try {
      const thread = await this.client.entity.directThread(threadId).info();
      return {
        id: thread.thread_id,
        title: thread.thread_title,
        users: thread.users.map(user => ({
          id: user.pk,
          username: user.username,
          full_name: user.full_name
        }))
      };
    } catch (error) {
      logger.error(`📱 Failed to get Instagram thread info ${threadId}:`, error);
      throw error;
    }
  }

  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('📱 Max reconnection attempts reached for Instagram');
      return false;
    }

    this.reconnectAttempts++;
    logger.info(`📱 Attempting to reconnect to Instagram (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    try {
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
      await this.initialize();
      return true;
    } catch (error) {
      logger.error(`📱 Instagram reconnection attempt ${this.reconnectAttempts} failed:`, error);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      this.isConnected = false;
      logger.info('📱 Instagram bot disconnected');
    }
  }

  isConnected() {
    return this.isConnected;
  }
}

export const instagramBot = new InstagramBot();