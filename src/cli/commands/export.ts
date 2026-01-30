/**
 * Export Command
 * Export traces and results to various formats
 * - notebook: Jupyter notebook
 * - markdown: Markdown report
 * - json: JSON data dump
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { Trace, Annotation, EvalResult } from '../../core/types';
import { TraceStore, AnnotationStore } from '../../core/storage';

interface ExportOptions {
  traces: string;
  annotations?: string;
  evals?: string;
  format: 'notebook' | 'markdown' | 'json';
  output: string;
  limit?: number;
}

/**
 * Export traces to specified format
 */
export async function exportCommand(options: ExportOptions): Promise<void> {
  console.log(chalk.blue.bold('📤 Exporting traces...\n'));

  const spinner = ora('Loading traces').start();

  try {
    // Validate traces file exists
    if (!(await fs.pathExists(options.traces))) {
      spinner.fail(`Traces file not found: ${options.traces}`);
      process.exit(1);
    }

    // Load traces
    const traceStore = new TraceStore(options.traces);
    let traces = await traceStore.loadAll();

    if (traces.length === 0) {
      spinner.fail('No traces found');
      process.exit(1);
    }

    spinner.text = `Loaded ${traces.length} traces`;

    // Load annotations if provided
    let annotations: Annotation[] = [];
    if (options.annotations) {
      if (await fs.pathExists(options.annotations)) {
        const annotationStore = new AnnotationStore(options.annotations);
        annotations = await annotationStore.loadAll();
        spinner.text = `Loaded ${traces.length} traces, ${annotations.length} annotations`;
      }
    }

    // Load eval results if provided
    let evalResults: Record<string, EvalResult[]> = {};
    if (options.evals) {
      if (await fs.pathExists(options.evals)) {
        const evalsData = await fs.readJson(options.evals);
        if (evalsData.results) {
          for (const item of evalsData.results) {
            evalResults[item.traceId] = item.results;
          }
        }
        spinner.text = `Loaded ${traces.length} traces with eval results`;
      }
    }

    // Apply limit if specified
    if (options.limit && traces.length > options.limit) {
      traces = traces.slice(0, options.limit);
    }

    spinner.text = `Exporting to ${options.format}...`;

    // Export based on format
    switch (options.format) {
      case 'notebook':
        await exportToNotebook(traces, annotations, evalResults, options);
        break;
      case 'markdown':
        await exportToMarkdown(traces, annotations, evalResults, options);
        break;
      case 'json':
        await exportToJson(traces, annotations, evalResults, options);
        break;
      default:
        spinner.fail(`Unknown format: ${options.format}`);
        process.exit(1);
    }

    spinner.succeed(`Exported ${traces.length} traces to ${options.format}`);
    console.log(chalk.green(`\n✅ Export complete`));
    console.log(chalk.gray(`   Format: ${options.format}`));
    console.log(chalk.gray(`   Output: ${path.resolve(options.output)}`));

  } catch (error) {
    spinner.fail('Failed to export traces');
    console.error(chalk.red(error instanceof Error ? error.message : error));
    process.exit(1);
  }
}

/**
 * Export to Jupyter notebook format
 */
async function exportToNotebook(
  traces: Trace[],
  annotations: Annotation[],
  evalResults: Record<string, EvalResult[]>,
  options: ExportOptions
): Promise<void> {
  const cells: Array<{ cell_type: string; source: string[]; metadata?: Record<string, unknown> }> = [];

  // Add title cell
  cells.push({
    cell_type: 'markdown',
    source: ['# EmbedEval Trace Analysis\n', `Exported: ${new Date().toISOString()}\n`, `Traces: ${traces.length}\n`],
    metadata: {},
  });

  // Add setup cell
  cells.push({
    cell_type: 'code',
    source: [
      'import json\n',
      'import pandas as pd\n',
      'import matplotlib.pyplot as plt\n',
      'from collections import Counter\n',
      '%matplotlib inline\n',
    ],
    metadata: {},
  });

  // Add data loading cell
  const traceData = traces.map(t => ({
    id: t.id,
    timestamp: t.timestamp,
    query: t.query,
    response: t.response,
    query_length: t.query.length,
    response_length: t.response.length,
    provider: t.metadata.provider,
    model: t.metadata.model,
    latency: t.metadata.latency,
  }));

  cells.push({
    cell_type: 'code',
    source: [
      '# Load trace data\n',
      `traces = ${JSON.stringify(traceData, null, 2)}\n`,
      'df = pd.DataFrame(traces)\n',
      'df.head()\n',
    ],
    metadata: {},
  });

  // Add analysis cells
  cells.push({
    cell_type: 'markdown',
    source: ['## Summary Statistics\n'],
    metadata: {},
  });

  cells.push({
    cell_type: 'code',
    source: [
      '# Basic statistics\n',
      'print(f"Total traces: {len(df)}")\n',
      'print(f"Unique providers: {df["provider"].nunique()}")\n',
      'print(f"Avg query length: {df["query_length"].mean():.1f} chars")\n',
      'print(f"Avg response length: {df["response_length"].mean():.1f} chars")\n',
      'print(f"Avg latency: {df["latency"].mean():.1f} ms")\n',
    ],
    metadata: {},
  });

  // Add trace details cells
  cells.push({
    cell_type: 'markdown',
    source: ['## Sample Traces\n'],
    metadata: {},
  });

  for (let i = 0; i < Math.min(traces.length, 5); i++) {
    const trace = traces[i];
    const annotation = annotations.find(a => a.traceId === trace.id);
    const evals = evalResults[trace.id];

    cells.push({
      cell_type: 'markdown',
      source: [
        `### Trace ${i + 1}: ${trace.id}\n`,
        `**Provider:** ${trace.metadata.provider} | **Model:** ${trace.metadata.model}\n`,
        `**Latency:** ${trace.metadata.latency}ms\n`,
        annotation ? `**Status:** ${annotation.label.toUpperCase()}\n` : '',
        annotation?.failureCategory ? `**Category:** ${annotation.failureCategory}\n` : '',
      ],
      metadata: {},
    });

    cells.push({
      cell_type: 'markdown',
      source: ['**Query:**\n', '```\n', trace.query.substring(0, 500), trace.query.length > 500 ? '...' : '', '\n```\n'],
      metadata: {},
    });

    cells.push({
      cell_type: 'markdown',
      source: ['**Response:**\n', '```\n', trace.response.substring(0, 500), trace.response.length > 500 ? '...' : '', '\n```\n'],
      metadata: {},
    });

    if (evals && evals.length > 0) {
      cells.push({
        cell_type: 'markdown',
        source: [
          '**Eval Results:**\n',
          ...evals.map(e => `- ${e.evalId}: ${e.passed ? 'PASS' : 'FAIL'} (${e.latency}ms)\n`),
        ],
        metadata: {},
      });
    }
  }

  // Create notebook structure
  const notebook = {
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
        version: '3.8.0',
      },
    },
    nbformat: 4,
    nbformat_minor: 4,
    cells,
  };

  await fs.writeFile(options.output, JSON.stringify(notebook, null, 2), 'utf-8');
}

/**
 * Export to Markdown format
 */
async function exportToMarkdown(
  traces: Trace[],
  annotations: Annotation[],
  evalResults: Record<string, EvalResult[]>,
  options: ExportOptions
): Promise<void> {
  const lines: string[] = [];

  // Header
  lines.push('# EmbedEval Trace Report\n');
  lines.push(`**Generated:** ${new Date().toISOString()}\n`);
  lines.push(`**Total Traces:** ${traces.length}\n`);
  lines.push('---\n');

  // Summary statistics
  lines.push('## Summary\n');
  const providers = new Set(traces.map(t => t.metadata.provider));
  const models = new Set(traces.map(t => t.metadata.model));
  const avgLatency = traces.reduce((sum, t) => sum + t.metadata.latency, 0) / traces.length;

  lines.push(`- **Unique Providers:** ${providers.size}\n`);
  lines.push(`- **Unique Models:** ${models.size}\n`);
  lines.push(`- **Average Latency:** ${avgLatency.toFixed(1)}ms\n`);
  lines.push('\n');

  // Provider breakdown
  lines.push('### By Provider\n');
  const providerCounts: Record<string, number> = {};
  for (const trace of traces) {
    providerCounts[trace.metadata.provider] = (providerCounts[trace.metadata.provider] || 0) + 1;
  }
  for (const [provider, count] of Object.entries(providerCounts)) {
    lines.push(`- ${provider}: ${count}\n`);
  }
  lines.push('\n');

  // Traces
  lines.push('## Traces\n');
  for (let i = 0; i < traces.length; i++) {
    const trace = traces[i];
    const annotation = annotations.find(a => a.traceId === trace.id);
    const evals = evalResults[trace.id];

    lines.push(`### Trace ${i + 1}\n`);
    lines.push(`**ID:** \`${trace.id}\`\n`);
    lines.push(`**Timestamp:** ${trace.timestamp}\n`);
    lines.push(`**Provider:** ${trace.metadata.provider}\n`);
    lines.push(`**Model:** ${trace.metadata.model}\n`);
    lines.push(`**Latency:** ${trace.metadata.latency}ms\n`);

    if (annotation) {
      const statusIcon = annotation.label === 'pass' ? '✅' : '❌';
      lines.push(`**Status:** ${statusIcon} ${annotation.label.toUpperCase()}\n`);
      if (annotation.failureCategory) {
        lines.push(`**Category:** ${annotation.failureCategory}\n`);
      }
      if (annotation.notes) {
        lines.push(`**Notes:** ${annotation.notes}\n`);
      }
    }

    if (evals && evals.length > 0) {
      lines.push('\n**Eval Results:**\n');
      for (const evalResult of evals) {
        const icon = evalResult.passed ? '✅' : '❌';
        lines.push(`- ${icon} ${evalResult.evalId} (${evalResult.latency}ms)\n`);
        if (evalResult.explanation) {
          lines.push(`  - ${evalResult.explanation}\n`);
        }
      }
    }

    lines.push('\n**Query:**\n');
    lines.push('```\n');
    lines.push(trace.query);
    lines.push('\n```\n');

    lines.push('\n**Response:**\n');
    lines.push('```\n');
    lines.push(trace.response);
    lines.push('\n```\n');

    lines.push('---\n');
  }

  await fs.writeFile(options.output, lines.join(''), 'utf-8');
}

/**
 * Export to JSON format
 */
async function exportToJson(
  traces: Trace[],
  annotations: Annotation[],
  evalResults: Record<string, EvalResult[]>,
  options: ExportOptions
): Promise<void> {
  const data = {
    metadata: {
      exportedAt: new Date().toISOString(),
      totalTraces: traces.length,
      totalAnnotations: annotations.length,
      format: 'embedeval-export',
      version: '1.0',
    },
    traces: traces.map(trace => {
      const annotation = annotations.find(a => a.traceId === trace.id);
      const evals = evalResults[trace.id];

      return {
        ...trace,
        annotation: annotation || null,
        evalResults: evals || [],
      };
    }),
  };

  await fs.writeFile(options.output, JSON.stringify(data, null, 2), 'utf-8');
}
