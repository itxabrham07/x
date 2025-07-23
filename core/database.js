import { MongoClient } from 'mongodb';
import { config } from './config.js';
import { logger } from './logger.js';

class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new MongoClient(config.mongo.uri);
      await this.client.connect();
      this.db = this.client.db(config.mongo.dbName);
      this.isConnected = true;
      
      // Create indexes
      await this.createIndexes();
      
      logger.info('✅ Connected to MongoDB');
    } catch (error) {
      logger.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      // Thread mappings index
      await this.db.collection('thread_mappings').createIndex(
        { instagramThreadId: 1 }, 
        { unique: true }
      );
      
      // Messages index
      await this.db.collection('messages').createIndex(
        { timestamp: -1 }
      );
      
      logger.info('📊 Database indexes created');
    } catch (error) {
      logger.warn('⚠️ Error creating indexes:', error.message);
    }
  }

  async saveThreadMapping(instagramThreadId, telegramThreadId, instagramUsername) {
    try {
      const mapping = {
        instagramThreadId,
        telegramThreadId,
        instagramUsername,
        createdAt: new Date(),
        lastActivity: new Date()
      };

      await this.db.collection('thread_mappings').replaceOne(
        { instagramThreadId },
        mapping,
        { upsert: true }
      );

      logger.info(`💾 Saved thread mapping: IG(${instagramThreadId}) ↔ TG(${telegramThreadId})`);
    } catch (error) {
      logger.error('❌ Error saving thread mapping:', error);
      throw error;
    }
  }

  async getThreadMapping(instagramThreadId) {
    try {
      const mapping = await this.db.collection('thread_mappings').findOne({
        instagramThreadId
      });
      return mapping;
    } catch (error) {
      logger.error('❌ Error getting thread mapping:', error);
      return null;
    }
  }

  async getThreadMappingByTelegram(telegramThreadId) {
    try {
      const mapping = await this.db.collection('thread_mappings').findOne({
        telegramThreadId
      });
      return mapping;
    } catch (error) {
      logger.error('❌ Error getting thread mapping by Telegram ID:', error);
      return null;
    }
  }

  async saveMessage(messageData) {
    try {
      const message = {
        ...messageData,
        timestamp: new Date(),
        processed: true
      };

      await this.db.collection('messages').insertOne(message);
    } catch (error) {
      logger.error('❌ Error saving message:', error);
    }
  }

  async updateThreadActivity(instagramThreadId) {
    try {
      await this.db.collection('thread_mappings').updateOne(
        { instagramThreadId },
        { $set: { lastActivity: new Date() } }
      );
    } catch (error) {
      logger.error('❌ Error updating thread activity:', error);
    }
  }

  async getAllMappings() {
    try {
      return await this.db.collection('thread_mappings').find({}).toArray();
    } catch (error) {
      logger.error('❌ Error getting all mappings:', error);
      return [];
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info('🔌 Disconnected from MongoDB');
    }
  }
}

export const database = new Database();