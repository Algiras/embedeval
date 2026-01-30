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
import { evalCommand } from './commands/eval';
import { generateCommand } from './commands/generate';
import { exportCommand } from './commands/export';
import { reportCommand } from './commands/report';

const program = new Command();

program
  .name('embedeval')
  .description('Hamel Husain-style evaluation CLI - binary evals, trace-centric, error-analysis-first')
  .version('2.0.0');

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
      .action(evalCommand.add)
  )
  .addCommand(
    new Command('list')
      .description('List all registered evaluators')
      .option('-f, --file <file>', 'Eval config file', 'evals.yaml')
      .action(evalCommand.list)
  )
  .addCommand(
    new Command('run <traces>')
      .description('Run evaluators on traces')
      .requiredOption('-c, --config <file>', 'Eval config file')
      .option('-o, --output <file>', 'Results output', 'eval-results.jsonl')
      .option('--stop-on-fail', 'Stop on first failure (cheap evals only)')
      .action(evalCommand.run)
  )
  .addCommand(
    new Command('report')
      .description('Generate evaluation report')
      .requiredOption('-r, --results <file>', 'Results file')
      .option('-f, --format <format>', 'Output format (markdown, html, json)', 'markdown')
      .option('-o, --output <file>', 'Output file')
      .action(evalCommand.report)
  );

// Generate command - Synthetic data
program
  .command('generate')
  .description('Generate synthetic traces using dimensions')
  .addCommand(
    new Command('init')
      .description('Create dimensions.yaml template')
      .option('-o, --output <file>', 'Output file', 'dimensions.yaml')
      .action(generateCommand.init)
  )
  .addCommand(
    new Command('create')
      .description('Generate synthetic traces')
      .requiredOption('-d, --dimensions <file>', 'Dimensions config file')
      .requiredOption('-n, --count <n>', 'Number of traces to generate', parseInt)
      .option('-o, --output <file>', 'Output file', 'synthetic-traces.jsonl')
      .option('--run-through-system', 'Run queries through actual LLM system')
      .action(generateCommand.create)
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
