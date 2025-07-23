# Telegram-Instagram Bridge Bot

A powerful bi-directional bridge that connects Telegram and Instagram direct messages with full media support and modular architecture.

## 🌟 Features

### 🔁 Bi-directional Message Bridge
- **Automatic Thread Mapping**: Creates Telegram forum topics for each Instagram conversation
- **Real-time Sync**: Instant message forwarding in both directions
- **Media Support**: Images, videos, voice notes, documents, and stickers
- **User-friendly Names**: Uses Instagram usernames (not IDs) for topic names

### 🧩 Modular Architecture
- **Core System**: Authentication, configuration, logging, database management
- **Bridge Module**: Handles message forwarding and thread management
- **Command System**: Extensible command framework with auto-registration
- **Helper Utilities**: Formatters, validators, media handlers

### 📖 Auto-loaded Help System
- **Dynamic Help**: Automatically generates help from all registered commands
- **Categorized Commands**: Organized by functionality (Core, Bridge, etc.)
- **Rich Formatting**: HTML-formatted help with usage examples

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB database
- Instagram account
- Telegram bot token
- Telegram group with forum topics enabled

### Installation

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd telegram-instagram-bridge
npm install
```

2. **Configure environment variables**:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Required Environment Variables**:
```env
# Instagram Credentials
INSTAGRAM_USERNAME=your_instagram_username
INSTAGRAM_PASSWORD=your_instagram_password

# Telegram Bot Configuration  
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_group_id

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
MONGODB_DB_NAME=telegram_instagram_bridge

# Application Configuration
LOG_LEVEL=info
ENVIRONMENT=development
```

4. **Start the bot**:
```bash
npm start
```

## 📋 Available Commands

### Core Commands
- `/ping` - Test bot responsiveness
- `/status` - Show bot status and system info
- `/logs` - Show recent log entries
- `/restart` - Restart the bot
- `/uptime` - Show bot uptime
- `/mode [debug|normal]` - Change operation mode
- `/help` - Show all available commands

### Bridge Commands
- `/bridge` - Show bridge status
- `/toggle` - Toggle bridge on/off
- `/threads` - List active thread mappings

## 🏗️ Architecture

### Directory Structure
```
├── core/                 # Core system components
│   ├── config.js        # Configuration management
│   ├── logger.js        # Logging system
│   ├── database.js      # MongoDB operations
│   ├── instagram.js     # Instagram bot client
│   ├── telegram.js      # Telegram bot client
│   └── commands.js      # Command management system
├── modules/             # Feature modules
│   ├── bridge.js        # Message bridging logic
│   └── core.js          # Core commands
├── helpers/             # Utility functions
│   ├── formatters.js    # Message formatting
│   ├── validators.js    # Input validation
│   └── media.js         # Media handling
└── index.js             # Main application entry
```

### Core Components

#### Instagram Bot (`core/instagram.js`)
- Real-time message listening via Instagram MQTT
- Media extraction and processing
- Session management with cookie persistence
- Automatic reconnection handling

#### Telegram Bot (`core/telegram.js`)
- Forum topic management
- Multi-media message handling
- File download and processing
- Polling-based message reception

#### Database (`core/database.js`)
- Thread mapping storage
- Message history tracking
- Automatic indexing
- Connection management

#### Command System (`core/commands.js`)
- Dynamic command registration
- Category-based organization
- Alias support
- Auto-generated help

## 🔄 How It Works

### Instagram → Telegram Flow
1. Instagram message received via real-time connection
2. Check for existing thread mapping in database
3. If new conversation, create Telegram forum topic
4. Store mapping: Instagram Thread ID ↔ Telegram Topic ID
5. Forward message with proper formatting and media

### Telegram → Instagram Flow
1. Telegram message received in forum topic
2. Look up Instagram thread ID from topic mapping
3. Forward message to Instagram direct thread
4. Handle media conversion and upload

### Thread Management
- **Automatic Creation**: New Instagram conversations create Telegram topics
- **Persistent Mapping**: Database stores all thread relationships
- **Activity Tracking**: Last activity timestamps for cleanup
- **User-friendly Names**: Topics named with Instagram usernames

## 🛠️ Configuration

### Instagram Setup
1. Use a dedicated Instagram account for the bot
2. Enable two-factor authentication is recommended
3. The bot will save session cookies for persistent login

### Telegram Setup
1. Create a bot via [@BotFather](https://t.me/botfather)
2. Create a group and enable forum topics
3. Add the bot to the group with admin permissions
4. Get the group chat ID (negative number for groups)

### MongoDB Setup
1. Create a MongoDB Atlas cluster or local instance
2. Create a database for the bot
3. The bot will automatically create required collections and indexes

## 📊 Monitoring & Logging

### Logging System
- **Structured Logging**: Winston-based logging with multiple transports
- **Log Levels**: Debug, info, warn, error with configurable levels
- **File Rotation**: Automatic log file management
- **Console Output**: Colorized console logging for development

### Health Monitoring
- **Status Commands**: Real-time status via `/status` command
- **Uptime Tracking**: Bot and system uptime monitoring
- **Connection Status**: Instagram, Telegram, and database connectivity
- **Memory Usage**: System resource monitoring

## 🔧 Development

### Adding New Commands
```javascript
// In any module file
export const commands = [
  {
    name: 'mycommand',
    description: 'My custom command',
    usage: '/mycommand [args]',
    category: 'Custom',
    aliases: ['mc'],
    handler: async (message, args) => {
      // Command logic here
    }
  }
];
```

### Adding New Modules
1. Create module file in `/modules/`
2. Export commands array
3. Import and register in `index.js`
4. Commands automatically appear in help

### Media Handling
The bot includes comprehensive media handling:
- **Download Management**: Temporary file handling
- **Format Conversion**: Extensible conversion system
- **Size Validation**: Configurable file size limits
- **Cleanup**: Automatic temporary file cleanup

## 🚨 Error Handling

### Graceful Shutdown
- **Signal Handling**: Proper SIGINT/SIGTERM handling
- **Resource Cleanup**: Database and connection cleanup
- **Notification**: Shutdown notifications to Telegram

### Error Recovery
- **Automatic Reconnection**: Instagram and database reconnection
- **Message Queuing**: Failed message retry logic
- **Logging**: Comprehensive error logging and tracking

## 📈 Performance

### Optimizations
- **Connection Pooling**: Efficient database connections
- **Media Caching**: Temporary media file management
- **Memory Management**: Automatic cleanup and monitoring
- **Rate Limiting**: Respect platform API limits

### Scalability
- **Modular Design**: Easy to extend and modify
- **Database Indexing**: Optimized queries
- **Async Processing**: Non-blocking message handling

## 🔒 Security

### Best Practices
- **Environment Variables**: Secure credential storage
- **Input Validation**: Comprehensive message validation
- **Error Sanitization**: Safe error message handling
- **Session Management**: Secure Instagram session handling

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the logs using `/logs` command
2. Verify configuration with `/status` command
3. Review the troubleshooting section
4. Open an issue on GitHub

---

**Note**: This bot is for educational and personal use. Ensure compliance with Instagram's Terms of Service and Telegram's Bot API terms.