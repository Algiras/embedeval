/**
 * Diff Command
 * Compare eval results between two runs to detect drift
 * 
 * Useful for:
 * - Catching regressions after model updates
 * - CI/CD quality gates
 * - A/B testing
 */

import * as fs from 'fs';
import chalk from 'chalk';
import { logger } from '../../utils/logger';

interface DiffOptions {
  threshold?: string;
  format?: 'text' | 'json' | 'github';
  output?: string;
}

interface EvalResult {
  traceId: string;
  passed: boolean;
  results: Array<{
    evalId: string;
    passed: boolean;
    explanation?: string;
  }>;
}

interface ResultsFile {
  results: EvalResult[];
  summary?: {
    passRate: number;
    totalTraces: number;
  };
}

interface DriftResult {
  passRateBefore: number;
  passRateAfter: number;
  passRateChange: number;
  significantDrift: boolean;
  regressions: Array<{
    traceId: string;
    evalId: string;
    wasPass: boolean;
    nowPass: boolean;
    explanation?: string;
  }>;
  improvements: Array<{
    traceId: string;
    evalId: string;
    wasPass: boolean;
    nowPass: boolean;
  }>;
  evalBreakdown: Record<string, {
    before: { passed: number; failed: number };
    after: { passed: number; failed: number };
    change: number;
  }>;
}

/**
 * Compare two result files and detect drift
 */
export async function diffCommand(
  beforeFile: string,
  afterFile: string,
  options: DiffOptions
): Promise<void> {
  const threshold = parseFloat(options.threshold || '5'); // 5% default
  
  // Load before results
  if (!fs.existsSync(beforeFile)) {
    logger.error(`Before file not found: ${beforeFile}`);
    process.exit(1);
  }
  
  // Load after results
  if (!fs.existsSync(afterFile)) {
    logger.error(`After file not found: ${afterFile}`);
    process.exit(1);
  }
  
  let beforeResults: ResultsFile;
  let afterResults: ResultsFile;
  
  try {
    beforeResults = JSON.parse(fs.readFileSync(beforeFile, 'utf-8'));
    afterResults = JSON.parse(fs.readFileSync(afterFile, 'utf-8'));
  } catch (e) {
    logger.error('Failed to parse results files. Ensure they are valid JSON.');
    process.exit(1);
  }
  
  // Calculate pass rates
  const beforePassed = beforeResults.results.filter(r => r.passed).length;
  const afterPassed = afterResults.results.filter(r => r.passed).length;
  
  const beforeTotal = beforeResults.results.length;
  const afterTotal = afterResults.results.length;
  
  const passRateBefore = (beforePassed / beforeTotal) * 100;
  const passRateAfter = (afterPassed / afterTotal) * 100;
  const passRateChange = passRateAfter - passRateBefore;
  
  // Build trace maps
  const beforeMap = new Map<string, EvalResult>();
  const afterMap = new Map<string, EvalResult>();
  
  for (const r of beforeResults.results) {
    beforeMap.set(r.traceId, r);
  }
  for (const r of afterResults.results) {
    afterMap.set(r.traceId, r);
  }
  
  // Find regressions and improvements
  const regressions: DriftResult['regressions'] = [];
  const improvements: DriftResult['improvements'] = [];
  
  // Track per-eval breakdown
  const evalBreakdown: DriftResult['evalBreakdown'] = {};
  
  for (const [traceId, afterResult] of afterMap) {
    const beforeResult = beforeMap.get(traceId);
    if (!beforeResult) continue;
    
    // Compare each eval
    for (const afterEval of afterResult.results) {
      const beforeEval = beforeResult.results.find(e => e.evalId === afterEval.evalId);
      if (!beforeEval) continue;
      
      // Initialize eval breakdown
      if (!evalBreakdown[afterEval.evalId]) {
        evalBreakdown[afterEval.evalId] = {
          before: { passed: 0, failed: 0 },
          after: { passed: 0, failed: 0 },
          change: 0,
        };
      }
      
      // Count
      if (beforeEval.passed) evalBreakdown[afterEval.evalId].before.passed++;
      else evalBreakdown[afterEval.evalId].before.failed++;
      if (afterEval.passed) evalBreakdown[afterEval.evalId].after.passed++;
      else evalBreakdown[afterEval.evalId].after.failed++;
      
      // Check for changes
      if (beforeEval.passed && !afterEval.passed) {
        regressions.push({
          traceId,
          evalId: afterEval.evalId,
          wasPass: true,
          nowPass: false,
          explanation: afterEval.explanation,
        });
      } else if (!beforeEval.passed && afterEval.passed) {
        improvements.push({
          traceId,
          evalId: afterEval.evalId,
          wasPass: false,
          nowPass: true,
        });
      }
    }
  }
  
  // Calculate change percentages for each eval
  for (const evalId of Object.keys(evalBreakdown)) {
    const eb = evalBreakdown[evalId];
    const beforeRate = eb.before.passed / (eb.before.passed + eb.before.failed) * 100;
    const afterRate = eb.after.passed / (eb.after.passed + eb.after.failed) * 100;
    eb.change = afterRate - beforeRate;
  }
  
  const significantDrift = Math.abs(passRateChange) >= threshold;
  
  const result: DriftResult = {
    passRateBefore,
    passRateAfter,
    passRateChange,
    significantDrift,
    regressions,
    improvements,
    evalBreakdown,
  };
  
  // Output based on format
  if (options.format === 'json') {
    const output = JSON.stringify(result, null, 2);
    if (options.output) {
      fs.writeFileSync(options.output, output);
    } else {
      console.log(output);
    }
    return;
  }
  
  if (options.format === 'github') {
    // GitHub Actions compatible output
    outputGitHubFormat(result, threshold);
    return;
  }
  
  // Default text output
  console.log(chalk.bold.cyan('\n═══════════════════════════════════════════'));
  console.log(chalk.bold.cyan('              DRIFT ANALYSIS               '));
  console.log(chalk.bold.cyan('═══════════════════════════════════════════\n'));
  
  console.log(chalk.gray(`Before: ${beforeFile} (${beforeTotal} traces)`));
  console.log(chalk.gray(`After:  ${afterFile} (${afterTotal} traces)`));
  console.log(chalk.gray(`Threshold: ${threshold}%\n`));
  
  // Pass rate summary
  console.log(chalk.bold('Pass Rate:'));
  console.log(`  Before: ${chalk.blue(passRateBefore.toFixed(1) + '%')}`);
  console.log(`  After:  ${chalk.blue(passRateAfter.toFixed(1) + '%')}`);
  
  const changeIcon = passRateChange > 0 ? chalk.green('▲') : passRateChange < 0 ? chalk.red('▼') : chalk.gray('─');
  const changeColor = passRateChange > 0 ? chalk.green : passRateChange < 0 ? chalk.red : chalk.gray;
  console.log(`  Change: ${changeIcon} ${changeColor(passRateChange.toFixed(1) + '%')}`);
  
  if (significantDrift) {
    if (passRateChange < 0) {
      console.log(chalk.bold.red('\n⚠️  SIGNIFICANT REGRESSION DETECTED'));
    } else {
      console.log(chalk.bold.green('\n✨ SIGNIFICANT IMPROVEMENT DETECTED'));
    }
  } else {
    console.log(chalk.gray('\n✓ No significant drift detected'));
  }
  
  // Eval breakdown
  if (Object.keys(evalBreakdown).length > 0) {
    console.log(chalk.bold('\nPer-Eval Breakdown:'));
    for (const [evalId, eb] of Object.entries(evalBreakdown)) {
      const beforeRate = eb.before.passed / (eb.before.passed + eb.before.failed) * 100;
      const afterRate = eb.after.passed / (eb.after.passed + eb.after.failed) * 100;
      const change = eb.change;
      
      const icon = change > 2 ? chalk.green('▲') : change < -2 ? chalk.red('▼') : chalk.gray('─');
      const color = change > 2 ? chalk.green : change < -2 ? chalk.red : chalk.gray;
      
      console.log(`  ${evalId.padEnd(25)} ${beforeRate.toFixed(1).padStart(5)}% → ${afterRate.toFixed(1).padStart(5)}% ${icon} ${color(change.toFixed(1) + '%')}`);
    }
  }
  
  // Regressions
  if (regressions.length > 0) {
    console.log(chalk.bold.red(`\nRegressions (${regressions.length}):`));
    const shown = regressions.slice(0, 10);
    for (const r of shown) {
      console.log(chalk.red(`  ✗ ${r.traceId} → ${r.evalId}`));
      if (r.explanation) {
        console.log(chalk.gray(`    ${r.explanation.substring(0, 80)}...`));
      }
    }
    if (regressions.length > 10) {
      console.log(chalk.gray(`  ... and ${regressions.length - 10} more`));
    }
  }
  
  // Improvements
  if (improvements.length > 0) {
    console.log(chalk.bold.green(`\nImprovements (${improvements.length}):`));
    const shown = improvements.slice(0, 5);
    for (const r of shown) {
      console.log(chalk.green(`  ✓ ${r.traceId} → ${r.evalId}`));
    }
    if (improvements.length > 5) {
      console.log(chalk.gray(`  ... and ${improvements.length - 5} more`));
    }
  }
  
  // Exit code for CI
  if (significantDrift && passRateChange < 0) {
    console.log(chalk.red('\nExiting with code 1 due to regression'));
    process.exit(1);
  }
}

function outputGitHubFormat(result: DriftResult, threshold: number): void {
  // GitHub Actions summary
  console.log('## 📊 EmbedEval Drift Report\n');
  
  const changeEmoji = result.passRateChange > 0 ? '📈' : result.passRateChange < 0 ? '📉' : '➡️';
  
  console.log(`| Metric | Before | After | Change |`);
  console.log(`| ------ | ------ | ----- | ------ |`);
  console.log(`| Pass Rate | ${result.passRateBefore.toFixed(1)}% | ${result.passRateAfter.toFixed(1)}% | ${changeEmoji} ${result.passRateChange.toFixed(1)}% |`);
  console.log(`| Regressions | - | - | ${result.regressions.length} |`);
  console.log(`| Improvements | - | - | ${result.improvements.length} |`);
  console.log('');
  
  if (result.significantDrift) {
    if (result.passRateChange < 0) {
      console.log(`::error::Significant regression detected: ${result.passRateChange.toFixed(1)}% (threshold: ${threshold}%)`);
    } else {
      console.log(`::notice::Significant improvement detected: ${result.passRateChange.toFixed(1)}%`);
    }
  }
  
  if (result.regressions.length > 0) {
    console.log('\n### Regressions\n');
    for (const r of result.regressions.slice(0, 10)) {
      console.log(`- \`${r.traceId}\` → ${r.evalId}`);
    }
  }
}
