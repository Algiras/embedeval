/**
 * Self-Assessment CLI Command
 * 
 * Enables agents to evaluate their own performance:
 * - Price: Token costs, API costs
 * - Speed: Latency percentiles
 * - Quality: Pass rates, calibration
 */

import * as fs from 'fs-extra';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import {
  generateSelfAssessment,
  formatSelfAssessment,
  compareModels,
  recommendModel,
  MODEL_PRICING,
} from '../../evals/metrics';

interface AssessOptions {
  results: string;
  model?: string;
  baseline?: string;
  format?: 'text' | 'json';
  output?: string;
}

interface CompareOptions {
  resultsA: string;
  modelA: string;
  resultsB: string;
  modelB: string;
  format?: 'text' | 'json';
}

interface RecommendOptions {
  priority: 'quality' | 'speed' | 'cost' | 'balanced';
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Run self-assessment on evaluation results
 */
export async function assessCommand(options: AssessOptions): Promise<void> {
  try {
    // Load results
    if (!await fs.pathExists(options.results)) {
      logger.error(`Results file not found: ${options.results}`);
      process.exit(1);
    }
    
    const resultsData = await fs.readJson(options.results);
    
    // Extract results array
    let results: Array<{
      evalId: string;
      passed: boolean;
      latency: number;
      inputTokens?: number;
      outputTokens?: number;
    }> = [];
    
    // Handle both direct array and { results: [...] } format
    if (Array.isArray(resultsData)) {
      results = resultsData;
    } else if (resultsData.results) {
      // Flatten nested results
      for (const trace of resultsData.results) {
        if (trace.results) {
          results.push(...trace.results);
        }
      }
    }
    
    if (results.length === 0) {
      logger.error('No results found in file');
      process.exit(1);
    }
    
    // Detect model from results or use provided
    const model = options.model || 'gemini-2.5-flash';
    
    // Load baseline if provided
    let baseline: { passRate: number; avgLatency: number; avgCost: number } | undefined;
    if (options.baseline && await fs.pathExists(options.baseline)) {
      baseline = await fs.readJson(options.baseline);
    }
    
    // Generate report
    const report = generateSelfAssessment(model, results, baseline);
    
    // Output
    if (options.format === 'json') {
      const output = JSON.stringify(report, null, 2);
      if (options.output) {
        await fs.writeJson(options.output, report, { spaces: 2 });
        console.log(chalk.green(`Report saved to ${options.output}`));
      } else {
        console.log(output);
      }
    } else {
      const output = formatSelfAssessment(report);
      if (options.output) {
        await fs.writeFile(options.output, output);
        console.log(chalk.green(`Report saved to ${options.output}`));
      } else {
        console.log(output);
      }
    }
    
  } catch (error) {
    logger.error('Assessment failed:', error);
    process.exit(1);
  }
}

/**
 * Compare two models
 */
export async function compareCommand(options: CompareOptions): Promise<void> {
  try {
    // Load results
    const resultsA = await fs.readJson(options.resultsA);
    const resultsB = await fs.readJson(options.resultsB);
    
    // Extract and flatten results
    const extractResults = (data: any) => {
      if (Array.isArray(data)) return data;
      if (data.results) {
        const flat: any[] = [];
        for (const trace of data.results) {
          if (trace.results) flat.push(...trace.results);
        }
        return flat;
      }
      return [];
    };
    
    const flatA = extractResults(resultsA);
    const flatB = extractResults(resultsB);
    
    // Compare
    const comparison = compareModels(options.modelA, flatA, options.modelB, flatB);
    
    if (options.format === 'json') {
      console.log(JSON.stringify(comparison, null, 2));
    } else {
      console.log('');
      console.log(chalk.bold('═══════════════════════════════════════════════'));
      console.log(chalk.bold('              MODEL COMPARISON                  '));
      console.log(chalk.bold('═══════════════════════════════════════════════'));
      console.log('');
      console.log(`  Model A: ${chalk.cyan(comparison.modelA)}`);
      console.log(`  Model B: ${chalk.cyan(comparison.modelB)}`);
      console.log('');
      console.log(chalk.bold('  QUALITY:'));
      console.log(`    Pass Rate A: ${(comparison.passRateA * 100).toFixed(1)}%`);
      console.log(`    Pass Rate B: ${(comparison.passRateB * 100).toFixed(1)}%`);
      console.log(`    Winner: ${comparison.qualityWinner === 'tie' ? chalk.yellow('TIE') : chalk.green(comparison.qualityWinner)}`);
      console.log('');
      console.log(chalk.bold('  SPEED:'));
      console.log(`    Avg Latency A: ${comparison.avgLatencyA.toFixed(0)}ms`);
      console.log(`    Avg Latency B: ${comparison.avgLatencyB.toFixed(0)}ms`);
      console.log(`    Winner: ${comparison.speedWinner === 'tie' ? chalk.yellow('TIE') : chalk.green(comparison.speedWinner)}`);
      console.log('');
      console.log(chalk.bold('  COST:'));
      console.log(`    Total Cost A: $${comparison.totalCostA.toFixed(6)}`);
      console.log(`    Total Cost B: $${comparison.totalCostB.toFixed(6)}`);
      console.log(`    Winner: ${comparison.costWinner === 'tie' ? chalk.yellow('TIE') : chalk.green(comparison.costWinner)}`);
      console.log('');
      console.log(chalk.bold('  RECOMMENDATION:'));
      console.log(`    ${chalk.green(comparison.recommendation === 'A' ? comparison.modelA : comparison.recommendation === 'B' ? comparison.modelB : 'Depends on priority')}`);
      console.log(`    ${comparison.reasoning}`);
      console.log('');
      console.log('═══════════════════════════════════════════════');
      console.log('');
    }
    
  } catch (error) {
    logger.error('Comparison failed:', error);
    process.exit(1);
  }
}

/**
 * Recommend a model
 */
export function recommendCommand(options: RecommendOptions): void {
  const rec = recommendModel(options.priority, options.complexity);
  
  console.log('');
  console.log(chalk.bold('Model Recommendation'));
  console.log('');
  console.log(`  Priority: ${chalk.cyan(options.priority)}`);
  console.log(`  Complexity: ${chalk.cyan(options.complexity)}`);
  console.log('');
  console.log(`  ${chalk.green('→')} ${chalk.bold(rec.model)}`);
  console.log(`    ${rec.reason}`);
  
  if (rec.tradeoffs.length > 0) {
    console.log('');
    console.log('  Tradeoffs:');
    for (const t of rec.tradeoffs) {
      console.log(`    • ${t}`);
    }
  }
  
  // Show pricing
  const pricing = MODEL_PRICING[rec.model];
  if (pricing) {
    console.log('');
    console.log('  Pricing:');
    console.log(`    Input:  $${pricing.inputPer1k.toFixed(6)}/1k tokens`);
    console.log(`    Output: $${pricing.outputPer1k.toFixed(6)}/1k tokens`);
  }
  
  console.log('');
}

/**
 * List available models and pricing
 */
export function pricingCommand(): void {
  console.log('');
  console.log(chalk.bold('═══════════════════════════════════════════════════════════════'));
  console.log(chalk.bold('                      MODEL PRICING                            '));
  console.log(chalk.bold('═══════════════════════════════════════════════════════════════'));
  console.log('');
  
  const categories = {
    'Gemini 3 Series': ['gemini-3-pro', 'gemini-3-flash'],
    'Gemini 2.5 Series': ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
    'Gemini 2.0 (Legacy)': ['gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    'OpenAI': ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    'Anthropic': ['anthropic/claude-3.5-sonnet', 'anthropic/claude-3-haiku'],
    'Embeddings': ['text-embedding-004', 'text-embedding-3-small'],
  };
  
  for (const [category, models] of Object.entries(categories)) {
    console.log(chalk.bold(`  ${category}:`));
    for (const model of models) {
      const pricing = MODEL_PRICING[model];
      if (pricing) {
        const input = `$${pricing.inputPer1k.toFixed(6)}`.padEnd(12);
        const output = `$${pricing.outputPer1k.toFixed(6)}`.padEnd(12);
        console.log(`    ${model.padEnd(35)} ${chalk.dim('in:')} ${input} ${chalk.dim('out:')} ${output}`);
      }
    }
    console.log('');
  }
  
  console.log(chalk.dim('  Prices are per 1,000 tokens in USD'));
  console.log('');
}
