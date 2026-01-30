#!/usr/bin/env node

/**
 * EmbedEval CLI Entry Point
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';

// Try to load .env from multiple locations (in order of priority)
const envPaths = [
  path.join(process.cwd(), '.env'),           // Current working directory
  path.join(process.cwd(), '.env.local'),     // Local overrides
  path.join(__dirname, '../../.env'),         // Project root
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

import { Command } from 'commander';
import chalk from 'chalk';
import { abTestCommand } from './commands/ab-test';
import { humanEvalCommand } from './commands/human-eval';
import { dashboardCommand } from './commands/dashboard';
import { providersCommand } from './commands/providers';
import { huggingfaceCommand } from './commands/huggingface';
import { strategyCommand } from './commands/strategy';
import { logger } from '../utils/logger';

const program = new Command();

program
  .name('embedeval')
  .description('CLI-based embedding evaluation system with A/B testing')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose logging', () => logger.setLevel('debug'));

// A/B Test command
program
  .command('ab-test')
  .description('Run A/B test comparing multiple embedding models')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-n, --name <name>', 'Test name', 'A/B Test')
  .option('-d, --dataset <path>', 'Dataset file path (JSONL)')
  .option('--corpus <path>', 'Corpus file path (JSONL)')
  .option('-o, --output <path>', 'Output directory')
  .option('--variants <variants>', 'Comma-separated list of provider:model pairs')
  .option('--strategies <strategies>', 'Comma-separated list of strategies (baseline,hybrid-bm25,llm-reranked)', 'baseline')
  .option('--metrics <metrics>', 'Comma-separated list of metrics', 'ndcg@10,recall@10,mrr@10')
  .option('--concurrency <n>', 'Number of concurrent workers', '5')
  .action(abTestCommand);

// Human Eval command
program
  .command('human-eval')
  .description('Interactive human evaluation wizard')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-d, --dataset <path>', 'Dataset file path')
  .option('-s, --session <name>', 'Session name')
  .option('--provider <provider>', 'Provider to evaluate')
  .option('--model <model>', 'Model to evaluate')
  .option('--notes', 'Enable note-taking', true)
  .action(humanEvalCommand);

// Dashboard command
program
  .command('dashboard')
  .description('Generate HTML dashboard from test results')
  .option('-r, --results <path>', 'Results JSON file path')
  .option('-t, --test-id <id>', 'Test ID to generate dashboard for')
  .option('-o, --output <path>', 'Output HTML file path')
  .option('--format <format>', 'Output format (html, json, csv)', 'html')
  .action(dashboardCommand);

// Providers command
program
  .command('providers')
  .description('Manage embedding providers')
  .option('--list', 'List available providers')
  .option('--test <provider>', 'Test provider connectivity')
  .option('--base-url <url>', 'Custom base URL for testing')
  .option('--api-key <key>', 'API key for testing')
  .action(providersCommand);

// Hugging Face command
program
  .command('huggingface')
  .description('Search and browse Hugging Face embedding models')
  .alias('hf')
  .option('-s, --search <query>', 'Search query', 'sentence-transformers')
  .option('-l, --limit <n>', 'Number of results', '20')
  .option('-m, --model <id>', 'Model ID to get info for')
  .option('--info', 'Show detailed model info')
  .action(huggingfaceCommand);

// Strategy command
program
  .command('strategy')
  .description('List and test retrieval strategies')
  .alias('strategies')
  .option('--list', 'List available strategies')
  .option('--test <strategy>', 'Test a strategy configuration')
  .action(strategyCommand);

// Error handling
program.on('command:*', () => {
  console.error(chalk.red(`Invalid command: ${program.args.join(' ')}`));
  console.log(chalk.yellow('See --help for a list of available commands.'));
  process.exit(1);
});

// Parse arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
