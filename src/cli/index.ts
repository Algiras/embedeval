#!/usr/bin/env node
/**
 * CLI Entry Point - Hamel Husain Style
 * Trace-centric, binary evals, error-analysis-first
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Command } from 'commander';
import chalk from 'chalk';

// Load environment variables
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '.env.local'),
  path.join(__dirname, '../../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

// Import commands
import { collectCommand } from './commands/collect';
import { viewCommand } from './commands/view';
import { annotateCommand } from './commands/annotate';
import { taxonomyCommand } from './commands/taxonomy';
import { addEvalCommand, listEvalsCommand, runEvalCommand, reportEvalCommand } from './commands/eval';
import { initCommand, createCommand } from './commands/generate';
import { exportCommand } from './commands/export';
import { reportCommand } from './commands/report';
import { statsCommand } from './commands/stats';
import { moltbookCommand } from './commands/moltbook';
import { listProviders, benchmarkProviders } from '../utils/llm-providers';
import { assessCommand, compareCommand, recommendCommand, pricingCommand } from './commands/assess';
import { startMCPServer } from '../mcp/server';
import { registerDSLCommands } from './commands/dsl';
import { watchCommand } from './commands/watch';
import { benchmarkCommand } from './commands/benchmark';
import { diffCommand } from './commands/diff';
import { authCommand } from './commands/auth';

const program = new Command();

program
  .name('embedeval')
  .description('Hamel Husain-style evaluation CLI - binary evals, trace-centric, error-analysis-first')
  .version('2.0.5');

// Collect command - Import traces
program
  .command('collect <source>')
  .description('Collect traces from JSONL file, API, or logs')
  .option('-o, --output <file>', 'Output file', 'traces.jsonl')
  .option('-l, --limit <n>', 'Limit number of traces', parseInt)
  .option('--filter <pattern>', 'Filter traces by pattern')
  .action(collectCommand);

// View command - Read-only trace viewer
program
  .command('view <traces>')
  .description('View traces in interactive terminal UI (read-only)')
  .option('-a, --annotations <file>', 'Annotations file to show with traces')
  .option('--filter <category>', 'Filter by failure category')
  .action(viewCommand);

// Annotate command - Interactive annotation
program
  .command('annotate <traces>')
  .description('Interactive trace annotation (binary pass/fail)')
  .requiredOption('-u, --user <email>', 'Annotator email (benevolent dictator)')
  .option('-a, --annotations <file>', 'Annotations output file', 'annotations.jsonl')
  .option('-r, --resume', 'Resume from previous session')
  .action(annotateCommand);

// Taxonomy command - Failure taxonomy management
program
  .command('taxonomy')
  .description('Manage failure taxonomy (build, show, update)')
  .addCommand(
    new Command('build')
      .description('Build taxonomy from annotations')
      .requiredOption('-a, --annotations <file>', 'Annotations file')
      .requiredOption('-u, --user <email>', 'Taxonomy maintainer')
      .option('-o, --output <file>', 'Output file', 'taxonomy.json')
      .action(taxonomyCommand.build)
  )
  .addCommand(
    new Command('show')
      .description('Display taxonomy tree')
      .option('-t, --taxonomy <file>', 'Taxonomy file', 'taxonomy.json')
      .action(taxonomyCommand.show)
  )
  .addCommand(
    new Command('update')
      .description('Update taxonomy with new annotations')
      .option('-t, --taxonomy <file>', 'Taxonomy file', 'taxonomy.json')
      .option('-a, --annotations <file>', 'Annotations file', 'annotations.jsonl')
      .action(taxonomyCommand.update)
  );

// Eval command - Run evaluations
program
  .command('eval')
  .description('Binary evaluation commands (assertions, LLM-as-judge)')
  .addCommand(
    new Command('add')
      .description('Interactive wizard to add new evaluator')
      .option('-f, --file <file>', 'Eval config file', 'evals.yaml')
      .action(addEvalCommand)
  )
  .addCommand(
    new Command('list')
      .description('List all registered evaluators')
      .option('-f, --file <file>', 'Eval config file', 'evals.yaml')
      .action(listEvalsCommand)
  )
  .addCommand(
    new Command('run')
      .argument('<traces>', 'Traces file to evaluate')
      .description('Run evaluators on traces')
      .requiredOption('-c, --config <file>', 'Eval config file')
      .option('-o, --output <file>', 'Results output', 'eval-results.jsonl')
      .option('--stop-on-fail', 'Stop on first failure (cheap evals only)')
      .action((traces, options) => runEvalCommand({ ...options, traces }))
  )
  .addCommand(
    new Command('report')
      .description('Generate evaluation report')
      .requiredOption('-r, --results <file>', 'Results file')
      .option('-f, --format <format>', 'Output format (markdown, html, json)', 'markdown')
      .option('-o, --output <file>', 'Output file')
      .action(reportEvalCommand)
  );

// Generate command - Synthetic data
program
  .command('generate')
  .description('Generate synthetic traces using dimensions')
  .addCommand(
    new Command('init')
      .description('Create dimensions.yaml template')
      .option('-o, --output <file>', 'Output file', 'dimensions.yaml')
      .action(initCommand)
  )
  .addCommand(
    new Command('create')
      .description('Generate synthetic traces')
      .requiredOption('-d, --dimensions <file>', 'Dimensions config file')
      .requiredOption('-n, --count <n>', 'Number of traces to generate', parseInt)
      .option('-o, --output <file>', 'Output file', 'synthetic-traces.jsonl')
      .option('--run-through-system', 'Run queries through actual LLM system')
      .action(createCommand)
  );

// Export command - Export to notebooks
program
  .command('export <traces>')
  .description('Export traces to various formats')
  .option('-f, --format <format>', 'Export format (notebook, markdown, json)', 'notebook')
  .option('-a, --annotations <file>', 'Include annotations')
  .option('-o, --output <file>', 'Output file')
  .option('--results <file>', 'Include evaluation results')
  .action(exportCommand);

// Report command - Simple dashboard
program
  .command('report')
  .description('Generate HTML dashboard from traces and annotations')
  .requiredOption('-t, --traces <file>', 'Traces file')
  .option('-a, --annotations <file>', 'Annotations file')
  .option('-r, --results <file>', 'Evaluation results file')
  .option('-o, --output <file>', 'Output HTML file', 'report.html')
  .action(reportCommand);

// Stats command - Quick metrics for sharing
program
  .command('stats <traces>')
  .description('Quick evaluation stats (great for Moltbook sharing)')
  .option('-a, --annotations <file>', 'Annotations file', 'annotations.jsonl')
  .option('-t, --taxonomy <file>', 'Taxonomy file', 'taxonomy.json')
  .option('-f, --format <format>', 'Output format (text, json, moltbook)', 'text')
  .action(statsCommand);

// Moltbook command - Generate community posts
program
  .command('moltbook')
  .description('Generate Moltbook-formatted posts and comments')
  .requiredOption('--type <type>', 'Content type: post, comment, welcome, stats')
  .option('--traces <file>', 'Traces file for real stats')
  .option('-a, --annotations <file>', 'Annotations file for real stats')
  .option('--topic <topic>', 'Topic for comments: building, testing, automation, quality')
  .action(moltbookCommand);

// Providers command - List and benchmark LLM providers
program
  .command('providers')
  .description('List and benchmark available LLM providers')
  .addCommand(
    new Command('list')
      .description('List available LLM providers and models')
      .action(() => listProviders())
  )
  .addCommand(
    new Command('benchmark')
      .description('Benchmark provider latency')
      .option('-p, --prompt <text>', 'Custom prompt for benchmark', 'Say "PASS" or "FAIL"')
      .action(async (options) => {
        console.log('\n⏱️  Benchmarking providers...\n');
        const results = await benchmarkProviders(options.prompt);
        console.log('Results (sorted by speed):\n');
        for (const r of results) {
          const status = r.success ? '✅' : '❌';
          const latency = `${r.latency}ms`.padStart(6);
          console.log(`  ${status} ${latency}  ${r.provider}/${r.model}${r.error ? ` - ${r.error}` : ''}`);
        }
        console.log('');
      })
  );

// MCP Server command
program
  .command('mcp-server')
  .description('Start MCP server for AI agent integration')
  .action(async () => {
    await startMCPServer();
  });

// DSL commands - High-level eval definition language
registerDSLCommands(program);

// Assess command - Self-assessment for price, speed, quality
program
  .command('assess')
  .description('Self-assessment of evaluation performance (price, speed, quality)')
  .addCommand(
    new Command('run')
      .description('Analyze eval results for performance metrics')
      .requiredOption('-r, --results <file>', 'Eval results file')
      .option('-m, --model <model>', 'Model used (for cost calculation)', 'gemini-2.5-flash')
      .option('-b, --baseline <file>', 'Baseline metrics for drift detection')
      .option('-f, --format <format>', 'Output format (text, json)', 'text')
      .option('-o, --output <file>', 'Output file')
      .action(assessCommand)
  )
  .addCommand(
    new Command('compare')
      .description('Compare two models on price, speed, quality')
      .requiredOption('--results-a <file>', 'Results file for model A')
      .requiredOption('--model-a <model>', 'Model A name')
      .requiredOption('--results-b <file>', 'Results file for model B')
      .requiredOption('--model-b <model>', 'Model B name')
      .option('-f, --format <format>', 'Output format (text, json)', 'text')
      .action((options) => compareCommand({
        resultsA: options.resultsA,
        modelA: options.modelA,
        resultsB: options.resultsB,
        modelB: options.modelB,
        format: options.format,
      }))
  )
  .addCommand(
    new Command('recommend')
      .description('Get model recommendation based on priority')
      .requiredOption('-p, --priority <priority>', 'Priority: quality, speed, cost, balanced')
      .requiredOption('-c, --complexity <complexity>', 'Task complexity: simple, moderate, complex')
      .action((options) => recommendCommand({
        priority: options.priority as any,
        complexity: options.complexity as any,
      }))
  )
  .addCommand(
    new Command('pricing')
      .description('Show model pricing table')
      .action(() => pricingCommand())
  );

// Watch command - Real-time evaluation
program
  .command('watch <traces>')
  .description('Watch traces file and run evals on new traces in real-time')
  .option('--dsl <file>', 'DSL eval file')
  .option('--evals <file>', 'JSON eval config file')
  .option('-o, --output <file>', 'Output results to file')
  .option('-i, --interval <ms>', 'Check interval in milliseconds', '2000')
  .option('--clear', 'Clear terminal on each update')
  .action(watchCommand);

// Benchmark command - Compare eval configs
program
  .command('benchmark <traces>')
  .description('Benchmark multiple eval configs or models side-by-side')
  .option('--dsl <files...>', 'DSL eval files to compare')
  .option('--evals <files...>', 'JSON eval config files to compare')
  .option('-l, --limit <n>', 'Limit number of traces')
  .option('-o, --output <file>', 'Output results to JSON file')
  .action(benchmarkCommand);

// Diff command - Compare results for drift detection
program
  .command('diff <before> <after>')
  .description('Compare two eval result files to detect drift/regression')
  .option('-t, --threshold <percent>', 'Change threshold percentage', '5')
  .option('-f, --format <format>', 'Output format (text, json, github)', 'text')
  .option('-o, --output <file>', 'Output file')
  .action(diffCommand);

// Auth command - Manage provider authentication
program.addCommand(authCommand);

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str)),
});

program.exitOverride();

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error: any) {
    if (error.code === 'commander.help') {
      process.exit(0);
    }
    if (error.code === 'commander.version') {
      process.exit(0);
    }
    console.error(chalk.red('\nError:'), error.message || error);
    process.exit(1);
  }
}

main();
