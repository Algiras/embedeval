/**
 * Eval Command
 * Manage and run evaluations (assertion, regex, code, LLM-as-judge)
 * Binary pass/fail results only
 */

import * as fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { v4 as uuidv4 } from 'uuid';
import { EvalConfig, EvalResult } from '../../core/types';
import { TraceStore } from '../../core/storage';
import { EvalRegistry } from '../../evals/engine';
import { createGeminiJudge } from '../../utils/llm-providers';

const EVALS_FILE = 'evals.json';

interface AddEvalOptions {
  type: 'assertion' | 'regex' | 'code' | 'llm-judge';
  priority?: 'cheap' | 'expensive';
  config: string;
}

interface RunEvalOptions {
  traces: string;
  config?: string;
  filter?: string[];
  stopOnFail?: boolean;
  output?: string;
}

/**
 * Add a new eval configuration
 */
export async function addEvalCommand(
  name: string,
  options: AddEvalOptions
): Promise<void> {
  console.log(chalk.blue.bold('➕ Adding new eval...\n'));

  const spinner = ora('Creating eval config').start();

  try {
    const evalConfig: EvalConfig = {
      id: uuidv4(),
      name,
      description: '',
      type: options.type,
      priority: options.priority || (options.type === 'llm-judge' ? 'expensive' : 'cheap'),
      config: JSON.parse(options.config),
    };

    // Load existing evals
    let evals: EvalConfig[] = [];
    if (await fs.pathExists(EVALS_FILE)) {
      evals = await fs.readJson(EVALS_FILE);
    }

    // Add new eval
    evals.push(evalConfig);
    await fs.writeJson(EVALS_FILE, evals, { spaces: 2 });

    spinner.succeed(`Created eval: ${name}`);
    console.log(chalk.green(`\n✅ Eval added successfully`));
    console.log(chalk.gray(`   ID: ${evalConfig.id}`));
    console.log(chalk.gray(`   Type: ${options.type}`));
    console.log(chalk.gray(`   Priority: ${evalConfig.priority}`));

  } catch (error) {
    spinner.fail('Failed to add eval');
    console.error(chalk.red(error instanceof Error ? error.message : error));
    process.exit(1);
  }
}

/**
 * List all registered evals
 */
export async function listEvalsCommand(): Promise<void> {
  console.log(chalk.blue.bold('📋 Registered Evals\n'));

  try {
    if (!(await fs.pathExists(EVALS_FILE))) {
      console.log(chalk.yellow('No evals registered yet.'));
      console.log(chalk.gray('Run: embedeval eval add <name> --type <type> --config <config>'));
      return;
    }

    const evals: EvalConfig[] = await fs.readJson(EVALS_FILE);

    if (evals.length === 0) {
      console.log(chalk.yellow('No evals registered.'));
      return;
    }

    console.log(chalk.green(`Found ${evals.length} eval(s)\n`));

    for (const evalConfig of evals) {
      const priorityColor = evalConfig.priority === 'cheap' ? chalk.green : chalk.yellow;
      console.log(chalk.white.bold(`${evalConfig.name}`));
      console.log(`  ID: ${evalConfig.id}`);
      console.log(`  Type: ${chalk.cyan(evalConfig.type)}`);
      console.log(`  Priority: ${priorityColor(evalConfig.priority)}`);
      if (evalConfig.description) {
        console.log(`  Description: ${evalConfig.description}`);
      }
      console.log('');
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Run evals on traces
 */
export async function runEvalCommand(options: RunEvalOptions): Promise<void> {
  console.log(chalk.blue.bold('▶️  Running evals...\n'));

  const spinner = ora('Loading traces').start();

  try {
    // Load traces
    const traceStore = new TraceStore(options.traces);
    const traces = await traceStore.loadAll();

    if (traces.length === 0) {
      spinner.fail('No traces found');
      process.exit(1);
    }

    spinner.text = `Loaded ${traces.length} traces, loading evals...`;

    // Load eval configurations
    const evalsPath = options.config || EVALS_FILE;
    if (!(await fs.pathExists(evalsPath))) {
      spinner.fail(`Evals file not found: ${evalsPath}`);
      process.exit(1);
    }

    const evalConfigs: EvalConfig[] = await fs.readJson(evalsPath);

    // Initialize registry with Gemini judge if available
    const judgeFunction = createGeminiJudge();
    if (judgeFunction) {
      spinner.text = 'LLM-as-judge enabled (Gemini)';
    } else {
      spinner.text = 'LLM-as-judge disabled (no GEMINI_API_KEY)';
    }
    
    const registry = new EvalRegistry(judgeFunction);
    for (const evalConfig of evalConfigs) {
      registry.register(evalConfig);
    }

    spinner.text = `Running ${evalConfigs.length} eval(s) on ${traces.length} traces...`;

    // Run evals
    const results: Map<string, EvalResult[]> = new Map();
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < traces.length; i++) {
      const trace = traces[i];
      const traceResults = await registry.runAll(trace, {
        filter: options.filter,
        stopOnFail: options.stopOnFail,
      });

      results.set(trace.id, traceResults);

      // Count passes/fails
      const allPassed = traceResults.every(r => r.passed);
      if (allPassed) passed++;
      else failed++;

      spinner.text = `Processing trace ${i + 1}/${traces.length}...`;
    }

    spinner.succeed(`Evaluated ${traces.length} traces`);

    // Display results
    console.log(chalk.green(`\n✅ Results:`));
    console.log(`  Total traces: ${traces.length}`);
    console.log(chalk.green(`  Passed: ${passed}`));
    console.log(chalk.red(`  Failed: ${failed}`));
    console.log(`  Pass rate: ${((passed / traces.length) * 100).toFixed(1)}%`);

    // Show breakdown by eval
    console.log(chalk.blue('\n📊 Eval breakdown:'));
    const evalStats: Map<string, { passed: number; failed: number }> = new Map();

    for (const [_traceId, traceResults] of results) {
      for (const result of traceResults) {
        const stats = evalStats.get(result.evalId) || { passed: 0, failed: 0 };
        if (result.passed) stats.passed++;
        else stats.failed++;
        evalStats.set(result.evalId, stats);
      }
    }

    for (const [evalId, stats] of evalStats) {
      const evalConfig = evalConfigs.find(e => e.id === evalId);
      const passRate = ((stats.passed / (stats.passed + stats.failed)) * 100).toFixed(1);
      const color = stats.failed === 0 ? chalk.green : chalk.yellow;
      console.log(color(`  ${evalConfig?.name || evalId}: ${stats.passed} pass, ${stats.failed} fail (${passRate}%)`));
    }

    // Save results if output specified
    if (options.output) {
      const outputData = {
        timestamp: new Date().toISOString(),
        traces: traces.length,
        summary: { passed, failed, passRate: passed / traces.length },
        results: Array.from(results.entries()).map(([traceId, evalResults]) => ({
          traceId,
          results: evalResults,
        })),
      };
      await fs.writeJson(options.output, outputData, { spaces: 2 });
      console.log(chalk.gray(`\nResults saved to: ${options.output}`));
    }

  } catch (error) {
    spinner.fail('Failed to run evals');
    console.error(chalk.red(error instanceof Error ? error.message : error));
    process.exit(1);
  }
}

/**
 * Generate eval report
 */
export async function reportEvalCommand(
  evalResultsPath: string
): Promise<void> {
  console.log(chalk.blue.bold('📊 Eval Report\n'));

  const spinner = ora('Loading results').start();

  try {
    if (!(await fs.pathExists(evalResultsPath))) {
      spinner.fail(`Results file not found: ${evalResultsPath}`);
      process.exit(1);
    }

    const results = await fs.readJson(evalResultsPath);
    spinner.succeed('Results loaded');

    console.log(chalk.green(`\n📈 Summary:`));
    console.log(`  Timestamp: ${results.timestamp}`);
    console.log(`  Total traces: ${results.traces}`);
    console.log(chalk.green(`  Passed: ${results.summary.passed}`));
    console.log(chalk.red(`  Failed: ${results.summary.failed}`));
    console.log(`  Pass rate: ${(results.summary.passRate * 100).toFixed(1)}%`);

    // TODO: Detailed per-trace breakdown
    // TODO: Failure analysis by category
    // TODO: Export to different formats

    console.log(chalk.yellow('\n⚠️  Detailed report generation - TODO'));

  } catch (error) {
    spinner.fail('Failed to generate report');
    console.error(chalk.red(error instanceof Error ? error.message : error));
    process.exit(1);
  }
}
