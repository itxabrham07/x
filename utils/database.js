import { MongoClient } from 'mongodb';
import { logger } from '../core/logger.js';
import { config } from '../config.js';

class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  async connect() {
    if (!config.database.enabled) {
      logger.warn('📊 Database is disabled in configuration');
      return;
    }

    try {
      logger.info('📊 Connecting to MongoDB...');
      
      this.client = new MongoClient(config.database.uri, config.database.options);
      await this.client.connect();
      
      this.db = this.client.db(config.database.name);
      this.isConnected = true;
      
      // Create indexes
      await this.createIndexes();
      
      logger.info(`📊 Connected to MongoDB database: ${config.database.name}`);
    } catch (error) {
      logger.error('📊 Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      // Thread mappings collection
      const threadMappings = this.db.collection('thread_mappings');
      await threadMappings.createIndex({ instagram_thread_id: 1 }, { unique: true });
      await threadMappings.createIndex({ telegram_topic_id: 1 }, { unique: true });
      await threadMappings.createIndex({ created_at: 1 });
      
      // Messages collection
      const messages = this.db.collection('messages');
      await messages.createIndex({ message_id: 1, platform: 1 }, { unique: true });
      await messages.createIndex({ thread_id: 1 });
      await messages.createIndex({ timestamp: 1 });
      
      // Users collection
      const users = this.db.collection('users');
      await users.createIndex({ instagram_user_id: 1 }, { unique: true });
      await users.createIndex({ username: 1 });
      
      logger.debug('📊 Database indexes created successfully');
    } catch (error) {
      logger.error('📊 Error creating database indexes:', error);
    }
  }

  getCollection(name) {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected');
    }
    return this.db.collection(name);
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info('📊 Disconnected from MongoDB');
    }
  }

  // Thread mapping methods
  async saveThreadMapping(instagramThreadId, telegramTopicId, username) {
    const collection = this.getCollection('thread_mappings');
    const mapping = {
      instagram_thread_id: instagramThreadId,
      telegram_topic_id: telegramTopicId,
      username: username,
      created_at: new Date(),
      last_activity: new Date(),
      message_count: 0
    };
    
    await collection.insertOne(mapping);
    logger.debug(`📊 Saved thread mapping: ${instagramThreadId} -> ${telegramTopicId}`);
    return mapping;
  }

  async getThreadMapping(instagramThreadId) {
    const collection = this.getCollection('thread_mappings');
    return await collection.findOne({ instagram_thread_id: instagramThreadId });
  }

  async getThreadMappingByTopic(telegramTopicId) {
    const collection = this.getCollection('thread_mappings');
    return await collection.findOne({ telegram_topic_id: telegramTopicId });
  }

  async updateThreadActivity(instagramThreadId) {
    const collection = this.getCollection('thread_mappings');
    await collection.updateOne(
      { instagram_thread_id: instagramThreadId },
      { 
        $set: { last_activity: new Date() },
        $inc: { message_count: 1 }
      }
    );
  }

  async getAllThreadMappings() {
    const collection = this.getCollection('thread_mappings');
    return await collection.find({}).sort({ last_activity: -1 }).toArray();
  }

  // Message methods
  async saveMessage(messageData) {
    const collection = this.getCollection('messages');
    const message = {
      ...messageData,
      timestamp: new Date(),
      processed: true
    };
    
    await collection.insertOne(message);
    logger.debug(`📊 Saved message: ${messageData.message_id} from ${messageData.platform}`);
    return message;
  }

  async getMessageHistory(threadId, limit = 50) {
    const collection = this.getCollection('messages');
    return await collection
      .find({ thread_id: threadId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  // User methods
  async saveUser(userData) {
    const collection = this.getCollection('users');
    const user = {
      ...userData,
      created_at: new Date(),
      last_seen: new Date()
    };
    
    await collection.replaceOne(
      { instagram_user_id: userData.instagram_user_id },
      user,
      { upsert: true }
    );
    
    logger.debug(`📊 Saved user: ${userData.username}`);
    return user;
  }

  async getUser(instagramUserId) {
    const collection = this.getCollection('users');
    return await collection.findOne({ instagram_user_id: instagramUserId });
  }

  // Stats methods
  async getStats() {
    const threadMappings = await this.getCollection('thread_mappings').countDocuments();
    const messages = await this.getCollection('messages').countDocuments();
    const users = await this.getCollection('users').countDocuments();
    
    return {
      thread_mappings: threadMappings,
      messages: messages,
      users: users,
      database_name: config.database.name,
      connected: this.isConnected
    };
  }
}

export const database = new Database();