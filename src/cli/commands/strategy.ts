/**
 * Strategy CLI Command
 * List and test available strategies
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { PREDEFINED_STRATEGIES, StrategyRegistry } from '../../strategies/registry';
import { logger } from '../../utils/logger';

interface StrategyOptions {
  list?: boolean;
  test?: string;
  dataset?: string;
  corpus?: string;
  query?: string;
}

export async function strategyCommand(options: StrategyOptions, command: Command): Promise<void> {
  try {
    if (options.list) {
      console.log(chalk.bold('\n📋 Available Strategies:\n'));
      
      for (const [key, strategy] of Object.entries(PREDEFINED_STRATEGIES)) {
        console.log(chalk.cyan(`${key}`));
        console.log(`  ${strategy.description}`);
        console.log(chalk.gray(`  Stages: ${strategy.stages.map(s => s.name || s.type).join(' → ')}`));
        console.log('');
      }

      console.log(chalk.bold('\n🔧 Available Stage Types:\n'));
      const stages = StrategyRegistry.listAvailable();
      stages.forEach(stage => {
        console.log(`  • ${stage}`);
      });
      console.log('');

      console.log(chalk.gray('Usage in config.yaml:'));
      console.log(chalk.gray('  variants:'));
      console.log(chalk.gray('    - id: variant-1'));
      console.log(chalk.gray('      name: "Semantic Chunks"'));
      console.log(chalk.gray('      strategy: semantic-chunks'));
      console.log(chalk.gray('      provider:'));
      console.log(chalk.gray('        type: openai'));
      console.log(chalk.gray('        model: text-embedding-3-small'));
      console.log('');

      return;
    }

    if (options.test) {
      console.log(chalk.blue(`\n🧪 Testing strategy: ${options.test}\n`));
      
      const strategy = PREDEFINED_STRATEGIES[options.test];
      if (!strategy) {
        throw new Error(`Unknown strategy: ${options.test}`);
      }

      console.log(chalk.bold('Strategy Configuration:'));
      console.log(`  Name: ${strategy.name}`);
      console.log(`  Description: ${strategy.description}`);
      console.log(`  Stages:`);
      
      strategy.stages.forEach((stage, index) => {
        const status = stage.enabled !== false ? chalk.green('✓') : chalk.gray('○');
        console.log(`    ${index + 1}. ${status} ${stage.type}${stage.name ? `:${stage.name}` : ''}`);
        if (Object.keys(stage.config).length > 0) {
          console.log(`       Config: ${JSON.stringify(stage.config)}`);
        }
      });

      console.log(chalk.green('\n✓ Strategy configuration is valid\n'));
      return;
    }

    // Default: show help
    console.log(chalk.yellow('Use --list to see available strategies or --test <strategy> to validate\n'));

  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
