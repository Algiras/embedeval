/**
 * Benchmark Command
 * Compare different LLM models or eval configurations side-by-side
 * 
 * Useful for:
 * - Comparing different judge models (gemini-flash vs gpt-4o-mini)
 * - Comparing DSL configs
 * - Finding the best price/quality tradeoff
 */

import * as fs from 'fs';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import { EvalRegistry } from '../../evals/engine';
import { compile } from '../../dsl';
import { EvalConfig, Trace } from '../../core/types';
// Cost estimation uses estimates, not MODEL_PRICING

interface BenchmarkOptions {
  dsl?: string[];
  evals?: string[];
  output?: string;
  limit?: string;
  model?: string[];
}

interface BenchmarkResult {
  name: string;
  traces: number;
  passed: number;
  failed: number;
  passRate: string;
  avgLatency: number;
  totalCost: number;
  costPerPass: number;
  score: number;
}

/**
 * Run benchmark comparing multiple eval configs
 */
export async function benchmarkCommand(tracesFile: string, options: BenchmarkOptions): Promise<void> {
  // Load traces
  if (!fs.existsSync(tracesFile)) {
    logger.error(`Traces file not found: ${tracesFile}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(tracesFile, 'utf-8');
  let traces: Trace[] = content
    .trim()
    .split('\n')
    .filter(l => l.trim())
    .map(l => JSON.parse(l));
  
  // Apply limit
  if (options.limit) {
    traces = traces.slice(0, parseInt(options.limit));
  }
  
  if (traces.length === 0) {
    logger.error('No traces to benchmark');
    process.exit(1);
  }
  
  logger.info(`Benchmarking with ${traces.length} traces`);
  
  // Collect configs to benchmark
  const configs: Array<{ name: string; evals: EvalConfig[] }> = [];
  
  // Load DSL files
  if (options.dsl && options.dsl.length > 0) {
    for (const dslFile of options.dsl) {
      if (!fs.existsSync(dslFile)) {
        logger.warn(`DSL file not found: ${dslFile}`);
        continue;
      }
      const dslContent = fs.readFileSync(dslFile, 'utf-8');
      const evalConfigs = compile(dslContent);
      configs.push({ name: dslFile, evals: evalConfigs });
    }
  }
  
  // Load JSON configs
  if (options.evals && options.evals.length > 0) {
    for (const evalFile of options.evals) {
      if (!fs.existsSync(evalFile)) {
        logger.warn(`Eval config not found: ${evalFile}`);
        continue;
      }
      const evalContent = fs.readFileSync(evalFile, 'utf-8');
      const evalConfigs = JSON.parse(evalContent);
      configs.push({ name: evalFile, evals: evalConfigs });
    }
  }
  
  if (configs.length === 0) {
    logger.error('No eval configs provided. Use --dsl or --evals');
    process.exit(1);
  }
  
  console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold.cyan('                    BENCHMARK RESULTS                        '));
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════\n'));
  
  const results: BenchmarkResult[] = [];
  
  // Run each config
  for (const config of configs) {
    console.log(chalk.bold(`\n📊 Running: ${config.name}`));
    console.log(chalk.gray(`   ${config.evals.length} evals to run...`));
    
    const registry = new EvalRegistry();
    for (const evalConfig of config.evals) {
      registry.register(evalConfig);
    }
    
    let passed = 0;
    let failed = 0;
    let totalLatency = 0;
    let totalCost = 0;
    
    const startTime = Date.now();
    
    for (let i = 0; i < traces.length; i++) {
      const trace = traces[i];
      const evalResults = await registry.runAll(trace);
      
      const tracePassed = evalResults.every(r => r.passed);
      if (tracePassed) {
        passed++;
      } else {
        failed++;
      }
      
      // Sum latencies
      for (const r of evalResults) {
        totalLatency += r.latency || 0;
      }
      
      // Estimate cost (rough)
      const llmJudgeCount = config.evals.filter(e => e.type === 'llm-judge').length;
      totalCost += llmJudgeCount * 0.00002; // ~$0.02 per 1000 calls
      
      // Progress
      process.stdout.write(`\r   Progress: ${i + 1}/${traces.length}`);
    }
    
    const totalTime = Date.now() - startTime;
    
    console.log(''); // New line after progress
    
    const passRate = ((passed / traces.length) * 100).toFixed(1);
    const avgLatency = totalLatency / (traces.length * config.evals.length);
    const costPerPass = passed > 0 ? totalCost / passed : 0;
    
    // Calculate score (0-100)
    // Higher is better: quality * speed * cost efficiency
    const qualityScore = passed / traces.length;
    const speedScore = Math.min(1, 500 / avgLatency); // 500ms baseline
    const costScore = Math.min(1, 0.001 / (costPerPass + 0.0001)); // $0.001 per pass baseline
    const score = Math.round((qualityScore * 0.6 + speedScore * 0.25 + costScore * 0.15) * 100);
    
    results.push({
      name: config.name,
      traces: traces.length,
      passed,
      failed,
      passRate: passRate + '%',
      avgLatency: Math.round(avgLatency),
      totalCost,
      costPerPass,
      score,
    });
    
    console.log(chalk.gray(`   ✓ Completed in ${(totalTime / 1000).toFixed(1)}s`));
  }
  
  // Sort by score
  results.sort((a, b) => b.score - a.score);
  
  // Display comparison table
  console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold.cyan('                    COMPARISON TABLE                         '));
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════\n'));
  
  // Header
  console.log(chalk.bold(
    '  Rank  │ Config'.padEnd(35) + '│ Pass Rate │ Avg Latency │ Cost/Pass │ Score'
  ));
  console.log(chalk.gray('────────┼───────────────────────────────┼───────────┼─────────────┼───────────┼──────'));
  
  // Rows
  results.forEach((r, i) => {
    const rank = i === 0 ? chalk.yellow('🥇 1') : i === 1 ? chalk.gray('🥈 2') : i === 2 ? chalk.gray('🥉 3') : `   ${i + 1}`;
    const name = r.name.length > 25 ? '...' + r.name.slice(-22) : r.name;
    const passRate = r.passRate.padStart(7);
    const latency = `${r.avgLatency}ms`.padStart(9);
    const cost = `$${r.costPerPass.toFixed(4)}`.padStart(8);
    const score = r.score >= 70 ? chalk.green(r.score.toString()) : r.score >= 50 ? chalk.yellow(r.score.toString()) : chalk.red(r.score.toString());
    
    console.log(
      `  ${rank}  │ ${name.padEnd(28)} │ ${passRate} │ ${latency} │ ${cost} │  ${score}`
    );
  });
  
  // Winner
  if (results.length > 1) {
    const winner = results[0];
    console.log(chalk.bold.green(`\n🏆 Winner: ${winner.name}`));
    console.log(chalk.gray(`   Pass Rate: ${winner.passRate}, Avg Latency: ${winner.avgLatency}ms, Score: ${winner.score}/100`));
  }
  
  // Recommendations
  console.log(chalk.bold('\n📋 Recommendations:'));
  
  const bestQuality = results.reduce((a, b) => parseFloat(a.passRate) > parseFloat(b.passRate) ? a : b);
  const bestSpeed = results.reduce((a, b) => a.avgLatency < b.avgLatency ? a : b);
  const bestCost = results.reduce((a, b) => a.costPerPass < b.costPerPass ? a : b);
  
  if (bestQuality !== results[0]) {
    console.log(chalk.gray(`   Best Quality: ${bestQuality.name} (${bestQuality.passRate})`));
  }
  if (bestSpeed !== results[0]) {
    console.log(chalk.gray(`   Best Speed: ${bestSpeed.name} (${bestSpeed.avgLatency}ms)`));
  }
  if (bestCost !== results[0]) {
    console.log(chalk.gray(`   Best Cost: ${bestCost.name} ($${bestCost.costPerPass.toFixed(4)}/pass)`));
  }
  
  // Save results
  if (options.output) {
    const output = {
      timestamp: new Date().toISOString(),
      tracesFile,
      traceCount: traces.length,
      results,
      winner: results[0],
    };
    fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
    logger.success(`Results saved to: ${options.output}`);
  }
}
