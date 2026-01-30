/**
 * Providers CLI Command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { testProvider, createProvider } from '../../providers';
import { logger } from '../../utils/logger';

interface ProvidersOptions {
  list?: boolean;
  test?: string;
  baseUrl?: string;
  apiKey?: string;
}

const AVAILABLE_PROVIDERS = [
  { type: 'ollama', name: 'Ollama', description: 'Local embedding models via Ollama' },
  { type: 'openai', name: 'OpenAI', description: 'OpenAI API (and compatible APIs like OpenRouter)' },
  { type: 'google', name: 'Google', description: 'Google Gemini Embedding API' },
  { type: 'huggingface', name: 'Hugging Face', description: 'Hugging Face Hub embedding models' },
];

export async function providersCommand(options: ProvidersOptions, command: Command): Promise<void> {
  try {
    if (options.list) {
      console.log(chalk.bold('\nAvailable Providers:\n'));
      
      for (const provider of AVAILABLE_PROVIDERS) {
        console.log(chalk.cyan(`${provider.name} (${provider.type})`));
        console.log(`  ${provider.description}\n`);
      }

      console.log(chalk.gray('Environment Variables:'));
      console.log('  OPENAI_API_KEY      - OpenAI API key');
      console.log('  GEMINI_API_KEY      - Google Gemini API key');
      console.log('  HUGGINGFACE_API_KEY - Hugging Face API key (optional, for Inference API)');
      console.log('  OLLAMA_HOST         - Ollama host URL (default: http://localhost:11434)');
      console.log('  REDIS_URL           - Redis URL for BullMQ (default: redis://localhost:6379)\n');

      return;
    }

    if (options.test) {
      console.log(chalk.blue(`\nTesting provider: ${options.test}\n`));

      let config: any;
      
      switch (options.test) {
        case 'ollama':
          config = {
            type: 'ollama',
            baseUrl: options.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434',
            model: 'nomic-embed-text',
          };
          break;
        
        case 'openai':
          const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
          if (!apiKey) {
            throw new Error('OpenAI API key required. Set OPENAI_API_KEY or use --api-key');
          }
          config = {
            type: 'openai',
            apiKey,
            baseUrl: options.baseUrl,
            model: 'text-embedding-3-small',
          };
          break;
        
        case 'google':
          const geminiKey = options.apiKey || process.env.GEMINI_API_KEY;
          if (!geminiKey) {
            throw new Error('Gemini API key required. Set GEMINI_API_KEY or use --api-key');
          }
          config = {
            type: 'google',
            apiKey: geminiKey,
            model: 'embedding-001',
          };
          break;
        
        case 'huggingface':
          const hfKey = options.apiKey || process.env.HUGGINGFACE_API_KEY;
          config = {
            type: 'huggingface',
            model: 'sentence-transformers/all-MiniLM-L6-v2',
            apiKey: hfKey,
            useInferenceAPI: !!hfKey,
          };
          break;
        
        default:
          throw new Error(`Unknown provider: ${options.test}`);
      }

      const result = await testProvider(config);

      if (result.success) {
        console.log(chalk.green('✓ Provider connection successful\n'));
        console.log(`Model: ${result.modelInfo!.name}`);
        console.log(`Dimensions: ${result.modelInfo!.dimensions}`);
        console.log(`Max Tokens: ${result.modelInfo!.maxTokens}\n`);
      } else {
        console.log(chalk.red('✗ Provider connection failed\n'));
        console.log(`Error: ${result.error}\n`);
        process.exit(1);
      }

      return;
    }

    // Default: show help
    console.log(chalk.yellow('Use --list to see available providers or --test <provider> to test connectivity\n'));

  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
