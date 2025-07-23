import { logger } from './logger.js';

class CommandManager {
  constructor() {
    this.commands = new Map();
    this.categories = new Set();
  }

  registerCommand(commandData) {
    const { name, description, usage, category, handler, aliases = [] } = commandData;
    
    if (!name || !handler) {
      throw new Error('Command must have name and handler');
    }

    const command = {
      name: name.toLowerCase(),
      description: description || 'No description provided',
      usage: usage || `/${name}`,
      category: category || 'General',
      handler,
      aliases: aliases.map(alias => alias.toLowerCase())
    };

    this.commands.set(command.name, command);
    this.categories.add(command.category);

    // Register aliases
    for (const alias of command.aliases) {
      this.commands.set(alias, command);
    }

    logger.info(`📝 Registered command: ${command.name} (${command.category})`);
  }

  registerModule(moduleCommands) {
    if (Array.isArray(moduleCommands)) {
      for (const command of moduleCommands) {
        this.registerCommand(command);
      }
    } else if (moduleCommands.commands && Array.isArray(moduleCommands.commands)) {
      for (const command of moduleCommands.commands) {
        this.registerCommand(command);
      }
    }
  }

  async executeCommand(commandName, message, args = []) {
    const command = this.commands.get(commandName.toLowerCase());
    
    if (!command) {
      return false;
    }

    try {
      await command.handler(message, args);
      return true;
    } catch (error) {
      logger.error(`❌ Error executing command ${commandName}:`, error.message);
      throw error;
    }
  }

  getCommand(name) {
    return this.commands.get(name.toLowerCase());
  }

  getAllCommands() {
    const uniqueCommands = new Map();
    
    for (const [name, command] of this.commands) {
      if (name === command.name) { // Only add main command, not aliases
        uniqueCommands.set(name, command);
      }
    }
    
    return Array.from(uniqueCommands.values());
  }

  getCommandsByCategory() {
    const commandsByCategory = {};
    
    for (const category of this.categories) {
      commandsByCategory[category] = [];
    }
    
    const allCommands = this.getAllCommands();
    for (const command of allCommands) {
      commandsByCategory[command.category].push(command);
    }
    
    return commandsByCategory;
  }

  generateHelpText() {
    const commandsByCategory = this.getCommandsByCategory();
    let helpText = '🤖 <b>Available Commands</b>\n\n';
    
    for (const [category, commands] of Object.entries(commandsByCategory)) {
      if (commands.length === 0) continue;
      
      helpText += `<b>${category}</b>\n`;
      
      for (const command of commands) {
        helpText += `• <code>${command.usage}</code> - ${command.description}\n`;
      }
      
      helpText += '\n';
    }
    
    return helpText.trim();
  }
}

export const commandManager = new CommandManager();