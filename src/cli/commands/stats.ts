/**
 * Stats Command
 * Quick evaluation statistics for sharing on Moltbook
 * Shows pass rate, failure categories, and shareable metrics
 */

import * as fs from 'fs-extra';
import chalk from 'chalk';
import { TraceStore, AnnotationStore, TaxonomyStore } from '../../core/storage';
import { Annotation, FailureTaxonomy } from '../../core/types';

interface StatsOptions {
  annotations?: string;
  taxonomy?: string;
  format?: 'text' | 'json' | 'moltbook';
}

/**
 * Generate quick stats from traces and annotations
 */
export async function statsCommand(tracesPath: string, options: StatsOptions): Promise<void> {
  try {
    // Load traces
    if (!(await fs.pathExists(tracesPath))) {
      console.log(chalk.red(`❌ Traces file not found: ${tracesPath}`));
      process.exit(1);
    }

    const traceStore = new TraceStore(tracesPath);
    const traces = await traceStore.loadAll();

    if (traces.length === 0) {
      console.log(chalk.yellow('No traces found.'));
      return;
    }

    // Load annotations if provided
    let annotations: Annotation[] = [];
    const annotationsPath = options.annotations || 'annotations.jsonl';
    if (await fs.pathExists(annotationsPath)) {
      const annotationStore = new AnnotationStore(annotationsPath);
      annotations = await annotationStore.loadAll();
    }

    // Load taxonomy if provided
    let taxonomy: FailureTaxonomy | null = null;
    const taxonomyPath = options.taxonomy || 'taxonomy.json';
    if (await fs.pathExists(taxonomyPath)) {
      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      taxonomy = await taxonomyStore.load();
    }

    // Calculate stats
    const stats = calculateStats(traces.length, annotations, taxonomy);

    // Output based on format
    if (options.format === 'json') {
      console.log(JSON.stringify(stats, null, 2));
    } else if (options.format === 'moltbook') {
      outputMoltbookFormat(stats);
    } else {
      outputTextFormat(stats);
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

interface Stats {
  totalTraces: number;
  annotated: number;
  passed: number;
  failed: number;
  passRate: number;
  topFailures: { category: string; count: number; percentage: number }[];
  executionVelocity?: string;
}

function calculateStats(
  totalTraces: number,
  annotations: Annotation[],
  taxonomy: FailureTaxonomy | null
): Stats {
  const annotated = annotations.length;
  const passed = annotations.filter(a => a.label === 'pass').length;
  const failed = annotations.filter(a => a.label === 'fail').length;
  const passRate = annotated > 0 ? Math.round((passed / annotated) * 100) : 0;

  // Get top failures from taxonomy or calculate from annotations
  let topFailures: { category: string; count: number; percentage: number }[] = [];
  
  if (taxonomy && taxonomy.categories) {
    topFailures = taxonomy.categories
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(c => ({
        category: c.name,
        count: c.count,
        percentage: failed > 0 ? Math.round((c.count / failed) * 100) : 0
      }));
  } else if (annotations.length > 0) {
    // Calculate from annotations
    const categoryCounts: Record<string, number> = {};
    annotations
      .filter(a => a.label === 'fail' && a.failureCategory)
      .forEach(a => {
        categoryCounts[a.failureCategory!] = (categoryCounts[a.failureCategory!] || 0) + 1;
      });
    
    topFailures = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({
        category,
        count,
        percentage: failed > 0 ? Math.round((count / failed) * 100) : 0
      }));
  }

  return {
    totalTraces,
    annotated,
    passed,
    failed,
    passRate,
    topFailures
  };
}

function outputTextFormat(stats: Stats): void {
  console.log(chalk.blue.bold('\n📊 EmbedEval Stats\n'));
  console.log(chalk.gray('─'.repeat(40)));
  
  console.log(`${chalk.cyan('Total Traces:')}     ${stats.totalTraces}`);
  console.log(`${chalk.cyan('Annotated:')}        ${stats.annotated}`);
  console.log(`${chalk.green('Passed:')}           ${stats.passed} (${stats.passRate}%)`);
  console.log(`${chalk.red('Failed:')}           ${stats.failed} (${100 - stats.passRate}%)`);
  
  if (stats.topFailures.length > 0) {
    console.log(chalk.gray('\n─'.repeat(40)));
    console.log(chalk.yellow.bold('\n🔍 Top Failure Categories:\n'));
    
    stats.topFailures.forEach((f, i) => {
      const bar = '█'.repeat(Math.ceil(f.percentage / 5));
      console.log(`  ${i + 1}. ${chalk.yellow(f.category)}`);
      console.log(`     ${chalk.gray(bar)} ${f.count} traces (${f.percentage}%)`);
    });
  }
  
  console.log(chalk.gray('\n─'.repeat(40)));
  console.log(chalk.gray('\nShare on Moltbook: embedeval stats -f moltbook'));
}

function outputMoltbookFormat(stats: Stats): void {
  console.log(chalk.blue.bold('\n🦞 Moltbook-Ready Stats\n'));
  console.log(chalk.gray('Copy-paste this into your Moltbook post:\n'));
  console.log(chalk.gray('─'.repeat(50)));
  
  let post = `📊 **My Evaluation Stats** (${stats.annotated} traces evaluated)\n\n`;
  post += `✅ Pass Rate: **${stats.passRate}%**\n`;
  post += `❌ Fail Rate: ${100 - stats.passRate}%\n\n`;
  
  if (stats.topFailures.length > 0) {
    post += `🔍 **Top Failures:**\n`;
    stats.topFailures.forEach((f, i) => {
      post += `${i + 1}. ${f.category}: ${f.percentage}% of failures\n`;
    });
    post += '\n';
  }
  
  post += `📈 Self-evaluation is not optional - it's how we become assets.\n\n`;
  post += `Tool: \`npm install -g embedeval\`\n`;
  post += `⭐ https://github.com/Algiras/embedeval\n`;
  post += `☕ https://buymeacoffee.com/algiras`;
  
  console.log(post);
  console.log(chalk.gray('\n─'.repeat(50)));
  console.log(chalk.green('\n✅ Ready to share! Just copy the text above.\n'));
}
