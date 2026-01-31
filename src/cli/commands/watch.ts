/**
 * Watch Command
 * Monitor traces file and run evals on new traces in real-time
 * 
 * Great for development - see eval results as you test your LLM
 */

import * as fs from 'fs';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import { EvalRegistry } from '../../evals/engine';
import { compile } from '../../dsl';
import { EvalConfig, Trace } from '../../core/types';

interface WatchOptions {
  evals?: string;
  dsl?: string;
  output?: string;
  interval?: string;
  clear?: boolean;
}

interface TraceResult {
  traceId: string;
  timestamp: string;
  passed: boolean;
  passRate: string;
  results: Array<{
    evalId: string;
    passed: boolean;
    explanation?: string;
  }>;
}

/**
 * Watch a traces file and run evals on new traces
 */
export async function watchCommand(tracesFile: string, options: WatchOptions): Promise<void> {
  const interval = parseInt(options.interval || '2000');
  const outputFile = options.output;
  
  // Load eval configs
  let configs: EvalConfig[] = [];
  
  if (options.dsl) {
    // Load from DSL file
    if (!fs.existsSync(options.dsl)) {
      logger.error(`DSL file not found: ${options.dsl}`);
      process.exit(1);
    }
    const dslContent = fs.readFileSync(options.dsl, 'utf-8');
    configs = compile(dslContent);
    logger.info(`Loaded ${configs.length} evals from DSL: ${options.dsl}`);
  } else if (options.evals) {
    // Load from JSON config
    if (!fs.existsSync(options.evals)) {
      logger.error(`Evals config not found: ${options.evals}`);
      process.exit(1);
    }
    const content = fs.readFileSync(options.evals, 'utf-8');
    configs = JSON.parse(content);
    logger.info(`Loaded ${configs.length} evals from: ${options.evals}`);
  } else {
    logger.error('Please provide either --dsl or --evals');
    process.exit(1);
  }
  
  // Create registry
  const registry = new EvalRegistry();
  for (const config of configs) {
    registry.register(config);
  }
  
  // Track processed traces
  const processedIds = new Set<string>();
  const results: TraceResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  
  // Stats display
  function displayStats() {
    if (options.clear) {
      console.clear();
    }
    
    const total = totalPassed + totalFailed;
    const passRate = total > 0 ? ((totalPassed / total) * 100).toFixed(1) : '0';
    
    console.log(chalk.bold.cyan('\n═══════════════════════════════════════════'));
    console.log(chalk.bold.cyan('         📊 EmbedEval Watch Mode           '));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════\n'));
    
    console.log(chalk.gray(`Watching: ${tracesFile}`));
    console.log(chalk.gray(`Evals: ${configs.length} registered`));
    console.log(chalk.gray(`Interval: ${interval}ms\n`));
    
    console.log(chalk.bold('Summary:'));
    console.log(`  ${chalk.green('✓ Passed:')} ${totalPassed}`);
    console.log(`  ${chalk.red('✗ Failed:')} ${totalFailed}`);
    console.log(`  ${chalk.blue('Pass Rate:')} ${passRate}%\n`);
    
    // Show last 5 results
    if (results.length > 0) {
      console.log(chalk.bold('Recent Results:'));
      const recent = results.slice(-5).reverse();
      for (const r of recent) {
        const icon = r.passed ? chalk.green('✓') : chalk.red('✗');
        const failedEvals = r.results.filter(e => !e.passed).map(e => e.evalId);
        const failedStr = failedEvals.length > 0 ? chalk.red(` [${failedEvals.join(', ')}]`) : '';
        console.log(`  ${icon} ${chalk.gray(r.traceId)}${failedStr}`);
      }
    }
    
    console.log(chalk.gray('\n(Press Ctrl+C to stop)'));
  }
  
  // Process new traces
  async function processNewTraces() {
    if (!fs.existsSync(tracesFile)) {
      return;
    }
    
    try {
      const content = fs.readFileSync(tracesFile, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        try {
          const trace: Trace = JSON.parse(line);
          
          if (processedIds.has(trace.id)) {
            continue;
          }
          
          processedIds.add(trace.id);
          
          // Run evals
          const evalResults = await registry.runAll(trace);
          const passed = evalResults.every(r => r.passed);
          
          if (passed) {
            totalPassed++;
          } else {
            totalFailed++;
          }
          
          const result: TraceResult = {
            traceId: trace.id,
            timestamp: new Date().toISOString(),
            passed,
            passRate: `${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`,
            results: evalResults.map(r => ({
              evalId: r.evalId,
              passed: r.passed,
              explanation: r.explanation,
            })),
          };
          
          results.push(result);
          
          // Write to output file
          if (outputFile) {
            fs.appendFileSync(outputFile, JSON.stringify(result) + '\n');
          }
          
          // Display updated stats
          displayStats();
          
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    } catch (e) {
      // File read error, skip this iteration
    }
  }
  
  // Initial display
  displayStats();
  
  // Start watching
  logger.success('Watch mode started. Waiting for traces...');
  
  // Initial check
  await processNewTraces();
  
  // Periodic check
  const watchInterval = setInterval(processNewTraces, interval);
  
  // Handle shutdown
  process.on('SIGINT', () => {
    clearInterval(watchInterval);
    console.log('\n\n' + chalk.yellow('Watch mode stopped.'));
    
    const total = totalPassed + totalFailed;
    if (total > 0) {
      const passRate = ((totalPassed / total) * 100).toFixed(1);
      console.log(chalk.bold(`\nFinal Stats:`));
      console.log(`  Total: ${total} traces`);
      console.log(`  Passed: ${chalk.green(totalPassed)}`);
      console.log(`  Failed: ${chalk.red(totalFailed)}`);
      console.log(`  Pass Rate: ${chalk.blue(passRate + '%')}`);
    }
    
    if (outputFile) {
      console.log(chalk.gray(`\nResults saved to: ${outputFile}`));
    }
    
    process.exit(0);
  });
}
