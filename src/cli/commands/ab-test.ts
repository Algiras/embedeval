/**
 * A/B Test CLI Command
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { Command } from 'commander';
import { EnhancedABTestingEngine } from '../../core/ab-testing/enhanced-engine';
import { loadConfig, toABTestConfig, loadDataset } from '../../utils/config';
import { logger } from '../../utils/logger';
import { EvalConfig } from '../../core/types';

interface ABTestOptions {
  config?: string;
  name: string;
  dataset?: string;
  corpus?: string;
  output?: string;
  variants?: string;
  strategies?: string;
  metrics: string;
  concurrency: string;
}

export async function abTestCommand(options: ABTestOptions, _command: Command): Promise<void> {
  const spinner = ora('Initializing A/B test...').start();

  try {
    // Load configuration
    let config;
    if (options.config) {
      config = await loadConfig(options.config);
    } else {
      // Build config from CLI options
      if (!options.variants) {
        throw new Error('Must provide either --config or --variants');
      }

      const variantPairs = options.variants.split(',');
      const strategies = options.strategies?.split(',') || ['baseline'];
      
      // Create variants with different strategies
      const variants = [];
      let variantId = 0;
      
      for (const strategy of strategies) {
        for (const pair of variantPairs) {
          const [type, model] = pair.split(':');
          variants.push({
            id: `variant-${variantId++}`,
            name: `${type}-${model}-${strategy}`,
            provider: {
              type,
              model,
              ...(type === 'ollama' ? { baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434' } : {}),
              ...(type === 'openai' ? { apiKey: process.env.OPENAI_API_KEY } : {}),
              ...(type === 'google' ? { apiKey: process.env.GEMINI_API_KEY } : {}),
              ...(type === 'huggingface' ? { apiKey: process.env.HUGGINGFACE_API_KEY } : {}),
            },
            strategy,
          });
        }
      }

      config = {
        providers: [], // Will be populated from variants
        strategies: strategies.map(s => ({ name: s, pipeline: [s] })),
        variants,
        dataset: options.dataset!,
        corpus: options.corpus,
        metrics: options.metrics.split(','),
        output: {
          json: options.output || './results',
        },
      } as EvalConfig;
    }

    // Load dataset
    spinner.text = 'Loading dataset...';
    const testCases = await loadDataset(config.dataset);
    
    // Load corpus if provided
    let documents: any[] = [];
    if (config.corpus) {
      spinner.text = 'Loading corpus...';
      documents = await loadDataset(config.corpus);
    }

    // Create A/B test config
    const abConfig = (config as any).variants ? {
      id: `test-${Date.now()}`,
      name: options.name,
      variants: (config as any).variants,
      dataset: config.dataset,
      corpus: config.corpus,
      metrics: config.metrics,
      output: config.output,
    } : toABTestConfig(config, options.name);

    spinner.succeed(`Loaded ${testCases.length} test cases${documents.length > 0 ? ` and ${documents.length} documents` : ''}`);

    // Initialize engine
    const engine = new EnhancedABTestingEngine(abConfig);
    const testId = engine.getTestId();

    console.log(chalk.blue(`\nTest ID: ${testId}`));
    console.log(chalk.blue(`Variants: ${abConfig.variants.length}`));
    console.log(chalk.blue(`Strategies: ${[...new Set(abConfig.variants.map((v: any) => v.strategy))].join(', ')}`));
    console.log(chalk.blue(`Queries: ${testCases.length}\n`));

    // Run test
    const result = await engine.run(
      testCases,
      documents,
      (variantId, completed, total) => {
        const variant = abConfig.variants.find((v: any) => v.id === variantId);
        const progress = Math.round((completed / total) * 100);
        process.stdout.write(`\r${variant?.name}: ${completed}/${total} (${progress}%)`);
      }
    );

    console.log('\n');

    // Display results
    displayResults(result);

    // Save results
    const outputDir = options.output || path.join(process.cwd(), '.embedeval', 'runs', testId);
    await fs.ensureDir(outputDir);

    const resultsPath = path.join(outputDir, 'results.json');
    await fs.writeJson(resultsPath, result, { spaces: 2 });

    console.log(chalk.green(`\n✓ Results saved to: ${resultsPath}`));

    await engine.close();

  } catch (error) {
    spinner.fail('A/B test failed');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function displayResults(result: any): void {
  console.log(chalk.bold('\n=== Results ===\n'));

  // Display variant metrics
  console.log(chalk.bold('Variant Performance:'));
  console.log('─'.repeat(80));
  
  for (const variant of result.variants) {
    console.log(chalk.cyan(`\n${variant.variantName} (${variant.provider}/${variant.model})`));
    if (variant.strategy) {
      console.log(chalk.gray(`  Strategy: ${variant.strategy}`));
    }
    console.log(`  NDCG@10:    ${variant.metrics.ndcg10?.toFixed(4) || 'N/A'}`);
    console.log(`  Recall@10:  ${variant.metrics.recall10?.toFixed(4) || 'N/A'}`);
    console.log(`  MRR@10:     ${variant.metrics.mrr10?.toFixed(4) || 'N/A'}`);
    console.log(`  MAP@10:     ${variant.metrics.map10?.toFixed(4) || 'N/A'}`);
    console.log(`  Avg Latency: ${variant.usage.avgLatency?.toFixed(0)}ms`);
    console.log(`  Failed:     ${variant.failedQueries.length} queries`);
  }

  // Display efficiency analysis
  if (result.efficiency) {
    console.log(chalk.bold('\n\nEfficiency Analysis:'));
    console.log('─'.repeat(80));
    console.log(`  Best Quality: ${result.efficiency.bestQuality}`);
    console.log(`  Cheapest:     ${result.efficiency.cheapest}`);
    console.log(`  Fastest:      ${result.efficiency.fastest}`);
  }
}
