import { logger } from '../core/logger.js';

export class MessageFormatter {
  static formatInstagramMessage(message) {
    let formatted = `📱 <b>@${message.senderUsername}</b>\n`;
    
    if (message.text) {
      formatted += this.escapeHtml(message.text);
    }
    
    if (message.media && message.media.length > 0) {
      const mediaTypes = message.media.map(m => m.type).join(', ');
      formatted += `\n📎 Media: ${mediaTypes}`;
    }
    
    return formatted;
  }

  static formatTelegramMessage(message) {
    let formatted = `💬 <b>@${message.sender}</b>\n`;
    
    if (message.text) {
      formatted += this.escapeHtml(message.text);
    }
    
    if (message.media && message.media.length > 0) {
      const mediaTypes = message.media.map(m => m.type).join(', ');
      formatted += `\n📎 Media: ${mediaTypes}`;
    }
    
    return formatted;
  }

  static escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return `0:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  static truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - 3) + '...';
  }

  static formatTimestamp(date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  }
}

export class StatusFormatter {
  static formatBotStatus(instagramStatus, telegramStatus, databaseStatus) {
    const getStatusEmoji = (status) => status ? '✅' : '❌';
    const getStatusText = (status) => status ? 'Connected' : 'Disconnected';
    
    return `🤖 <b>Bot Status</b>\n\n` +
      `📱 Instagram: ${getStatusEmoji(instagramStatus)} ${getStatusText(instagramStatus)}\n` +
      `💬 Telegram: ${getStatusEmoji(telegramStatus)} ${getStatusText(telegramStatus)}\n` +
      `🗄️ Database: ${getStatusEmoji(databaseStatus)} ${getStatusText(databaseStatus)}`;
  }

  static formatSystemInfo() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return `<b>System Information</b>\n` +
      `🖥️ Platform: ${process.platform}\n` +
      `🟢 Node.js: ${process.version}\n` +
      `💾 Memory: ${Math.round(memUsage.rss / 1024 / 1024)}MB\n` +
      `⏱️ Uptime: ${this.formatUptime(uptime)}`;
  }

  static formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}