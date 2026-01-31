/**
 * Manual Flow - Direct API key entry
 * 
 * For providers that don't support OAuth, allow users to
 * manually enter their API key with optional validation.
 */

import * as readline from 'readline';
import { Credential, ProviderName, PROVIDERS } from '../types.js';
import { logger } from '../../utils/logger.js';

interface ManualFlowOptions {
  validate?: boolean;
  provider: ProviderName;
}

/**
 * Prompt user for API key (hidden input)
 */
async function promptForKey(provider: ProviderName): Promise<string> {
  const config = PROVIDERS[provider];
  
  console.log(`\n🔑 Enter your ${config.displayName} API key`);
  console.log(`   Get your key at: ${config.docsUrl}`);
  console.log(`   (input will be hidden)\n`);

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Handle hidden input
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    let key = '';
    process.stdout.write('API Key: ');

    stdin.on('data', (char) => {
      const c = char.toString();
      
      switch (c) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          if (stdin.isTTY && wasRaw !== undefined) {
            stdin.setRawMode(wasRaw);
          }
          stdin.removeAllListeners('data');
          rl.close();
          console.log(); // New line after input
          resolve(key);
          break;
        case '\u0003': // Ctrl+C
          process.exit(0);
          break;
        case '\u007F': // Backspace
          if (key.length > 0) {
            key = key.slice(0, -1);
            process.stdout.write('\b \b'); // Erase character
          }
          break;
        default:
          key += c;
          process.stdout.write('*'); // Mask character
      }
    });
  });
}

/**
 * Validate API key by making a test request
 */
async function validateKey(provider: ProviderName, apiKey: string): Promise<boolean> {
  const validators: Record<ProviderName, () => Promise<boolean>> = {
    gemini: async () => {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        return response.ok;
      } catch {
        return false;
      }
    },
    
    openai: async () => {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    
    openrouter: async () => {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    
    anthropic: async () => {
      try {
        // Anthropic requires a request to validate
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        // 200 = valid, 401 = invalid, other = might be valid (rate limit, etc)
        return response.status !== 401;
      } catch {
        return false;
      }
    },
    
    ollama: async () => {
      try {
        // For Ollama, the "key" is actually the host URL
        const host = apiKey || 'http://localhost:11434';
        const response = await fetch(`${host}/api/tags`);
        return response.ok;
      } catch {
        return false;
      }
    },
  };

  const validator = validators[provider];
  if (!validator) {
    logger.debug(`No validator for ${provider}, skipping validation`);
    return true;
  }

  return validator();
}

/**
 * Run manual key entry flow
 */
export async function runManualFlow(options: ManualFlowOptions): Promise<Credential> {
  const { provider, validate = true } = options;
  // PROVIDERS[provider] used by promptForKey internally

  // Prompt for key
  const apiKey = await promptForKey(provider);

  if (!apiKey.trim()) {
    throw new Error('API key cannot be empty');
  }

  // Validate if requested
  if (validate) {
    console.log('🔍 Validating API key...');
    const isValid = await validateKey(provider, apiKey.trim());
    
    if (!isValid) {
      console.log('❌ API key validation failed');
      const continueAnyway = await promptYesNo('Save anyway? (y/n): ');
      if (!continueAnyway) {
        throw new Error('Aborted by user');
      }
    } else {
      console.log('✅ API key is valid');
    }
  }

  const now = new Date().toISOString();
  return {
    provider,
    apiKey: apiKey.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Simple yes/no prompt
 */
async function promptYesNo(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

/**
 * Prompt for provider selection
 */
export async function promptForProvider(): Promise<ProviderName> {
  const providers = Object.values(PROVIDERS);
  
  console.log('\n📋 Select a provider:\n');
  providers.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.displayName}`);
  });
  console.log();

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askChoice = () => {
      rl.question('Choice (1-5): ', (answer) => {
        const choice = parseInt(answer, 10);
        if (choice >= 1 && choice <= providers.length) {
          rl.close();
          resolve(providers[choice - 1].name);
        } else {
          console.log('Invalid choice, please try again.');
          askChoice();
        }
      });
    };

    askChoice();
  });
}
