import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '../core/logger.js';

export class MediaHandler {
  constructor() {
    this.tempDir = './temp';
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      logger.info('📁 Created temp directory');
    }
  }

  async downloadMedia(url, filename) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const buffer = Buffer.from(response.data);
      const filePath = path.join(this.tempDir, filename);
      
      fs.writeFileSync(filePath, buffer);
      
      logger.info(`📥 Downloaded media: ${filename} (${buffer.length} bytes)`);
      
      return {
        filePath,
        buffer,
        size: buffer.length,
        mimeType: response.headers['content-type']
      };
    } catch (error) {
      logger.error('❌ Error downloading media:', error.message);
      throw error;
    }
  }

  async processInstagramMedia(media) {
    const processedMedia = [];

    for (const item of media) {
      try {
        if (!item.url) {
          logger.warn('⚠️ Media item missing URL');
          continue;
        }

        const filename = this.generateFilename(item.type, item.url);
        const downloaded = await this.downloadMedia(item.url, filename);

        processedMedia.push({
          ...item,
          localPath: downloaded.filePath,
          buffer: downloaded.buffer,
          size: downloaded.size,
          mimeType: downloaded.mimeType
        });

      } catch (error) {
        logger.error(`❌ Error processing ${item.type}:`, error.message);
      }
    }

    return processedMedia;
  }

  generateFilename(mediaType, url) {
    const timestamp = Date.now();
    const extension = this.getExtensionFromUrl(url) || this.getDefaultExtension(mediaType);
    return `${mediaType}_${timestamp}${extension}`;
  }

  getExtensionFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const extension = path.extname(pathname);
      return extension || null;
    } catch {
      return null;
    }
  }

  getDefaultExtension(mediaType) {
    const extensions = {
      image: '.jpg',
      video: '.mp4',
      voice: '.ogg',
      audio: '.mp3',
      document: '.bin'
    };
    
    return extensions[mediaType] || '.bin';
  }

  getMimeType(mediaType, extension) {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  async convertMedia(inputPath, outputFormat) {
    // Placeholder for media conversion functionality
    // Could integrate with ffmpeg or similar tools
    logger.info(`🔄 Media conversion requested: ${inputPath} -> ${outputFormat}`);
    return inputPath; // Return original for now
  }

  cleanupTempFiles(maxAge = 3600000) { // 1 hour default
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtime.getTime();

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          logger.info(`🗑️ Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('❌ Error cleaning up temp files:', error.message);
    }
  }

  validateMediaFile(filePath, maxSize = 50 * 1024 * 1024) { // 50MB default
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
      }

      const stats = fs.statSync(filePath);
      
      if (stats.size > maxSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`);
      }

      return {
        valid: true,
        size: stats.size,
        modified: stats.mtime
      };
    } catch (error) {
      logger.error('❌ Media validation failed:', error.message);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async getMediaInfo(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const extension = path.extname(filePath);
      const mimeType = this.getMimeType(null, extension);

      return {
        path: filePath,
        size: stats.size,
        extension,
        mimeType,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      logger.error('❌ Error getting media info:', error.message);
      return null;
    }
  }
}

export const mediaHandler = new MediaHandler();

// Cleanup temp files every hour
setInterval(() => {
  mediaHandler.cleanupTempFiles();
}, 3600000);