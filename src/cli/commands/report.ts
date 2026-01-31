/**
 * Report Command
 * Generate HTML dashboard for trace analysis and evaluation results
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { Trace, Annotation, EvalResult, FailureTaxonomy } from '../../core/types';
import { TraceStore, AnnotationStore, TaxonomyStore } from '../../core/storage';

interface ReportOptions {
  traces: string;
  annotations?: string;
  taxonomy?: string;
  evals?: string;
  output: string;
  title?: string;
}

/**
 * Generate HTML dashboard
 */
export async function reportCommand(options: ReportOptions): Promise<void> {
  console.log(chalk.blue.bold('📊 Generating HTML dashboard...\n'));

  const spinner = ora('Loading data').start();

  try {
    // Load traces
    if (!(await fs.pathExists(options.traces))) {
      spinner.fail(`Traces file not found: ${options.traces}`);
      process.exit(1);
    }

    const traceStore = new TraceStore(options.traces);
    const traces = await traceStore.loadAll();

    if (traces.length === 0) {
      spinner.fail('No traces found');
      process.exit(1);
    }

    spinner.text = `Loaded ${traces.length} traces`;

    // Load annotations
    let annotations: Annotation[] = [];
    if (options.annotations && await fs.pathExists(options.annotations)) {
      const annotationStore = new AnnotationStore(options.annotations);
      annotations = await annotationStore.loadAll();
      spinner.text = `Loaded ${traces.length} traces, ${annotations.length} annotations`;
    }

    // Load taxonomy
    let taxonomy: FailureTaxonomy | null = null;
    if (options.taxonomy && await fs.pathExists(options.taxonomy)) {
      const taxonomyStore = new TaxonomyStore(options.taxonomy);
      taxonomy = await taxonomyStore.load();
      spinner.text = `Loaded ${traces.length} traces, taxonomy data`;
    }

    // Load eval results
    let evalResults: Record<string, EvalResult[]> = {};
    let evalStats: { totalEvals: number; passed: number; failed: number } = { totalEvals: 0, passed: 0, failed: 0 };
    if (options.evals && await fs.pathExists(options.evals)) {
      const evalsData = await fs.readJson(options.evals);
      if (evalsData.results) {
        for (const item of evalsData.results) {
          evalResults[item.traceId] = item.results;
          evalStats.totalEvals += item.results.length;
          for (const result of item.results) {
            if (result.passed) evalStats.passed++;
            else evalStats.failed++;
          }
        }
      }
      spinner.text = `Loaded ${traces.length} traces with evaluation data`;
    }

    spinner.text = 'Generating HTML dashboard...';

    // Calculate statistics
    const stats = calculateStats(traces, annotations, taxonomy, evalStats);

    // Generate HTML
    const html = generateDashboardHTML(stats, options);

    // Write output
    await fs.ensureDir(path.dirname(options.output));
    await fs.writeFile(options.output, html, 'utf-8');

    spinner.succeed(`Generated dashboard with ${traces.length} traces`);
    console.log(chalk.green(`\n✅ Dashboard saved`));
    console.log(chalk.gray(`   Output: ${path.resolve(options.output)}`));
    console.log(chalk.blue(`\n📖 Open the file in your browser to view the dashboard`));

  } catch (error) {
    spinner.fail('Failed to generate report');
    console.error(chalk.red(error instanceof Error ? error.message : error));
    process.exit(1);
  }
}

interface DashboardStats {
  totalTraces: number;
  totalAnnotations: number;
  passRate: number;
  totalPassed: number;
  totalFailed: number;
  byCategory: Record<string, number>;
  byProvider: Record<string, number>;
  avgLatency: number;
  totalEvals: number;
  evalPassRate: number;
  taxonomy?: FailureTaxonomy;
}

function calculateStats(
  traces: Trace[],
  annotations: Annotation[],
  taxonomy: FailureTaxonomy | null,
  evalStats: { totalEvals: number; passed: number; failed: number }
): DashboardStats {
  const totalPassed = annotations.filter(a => a.label === 'pass').length;
  const totalFailed = annotations.filter(a => a.label === 'fail').length;

  const byCategory: Record<string, number> = {};
  for (const annotation of annotations) {
    if (annotation.failureCategory) {
      byCategory[annotation.failureCategory] = (byCategory[annotation.failureCategory] || 0) + 1;
    }
  }

  const byProvider: Record<string, number> = {};
  for (const trace of traces) {
    const provider = trace.metadata?.provider ?? 'unknown';
    byProvider[provider] = (byProvider[provider] || 0) + 1;
  }

  const avgLatency = traces.reduce((sum, t) => sum + (t.metadata?.latency ?? 0), 0) / traces.length;

  return {
    totalTraces: traces.length,
    totalAnnotations: annotations.length,
    passRate: annotations.length > 0 ? (totalPassed / annotations.length) * 100 : 0,
    totalPassed,
    totalFailed,
    byCategory,
    byProvider,
    avgLatency,
    totalEvals: evalStats.totalEvals,
    evalPassRate: evalStats.totalEvals > 0 ? (evalStats.passed / evalStats.totalEvals) * 100 : 0,
    taxonomy: taxonomy || undefined,
  };
}

function generateDashboardHTML(stats: DashboardStats, options: ReportOptions): string {
  const title = options.title || 'EmbedEval Dashboard';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      margin: -20px -20px 30px;
      border-radius: 0 0 20px 20px;
    }

    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    .subtitle {
      opacity: 0.9;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .metric-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .metric-label {
      font-size: 0.9em;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-value {
      font-size: 2em;
      font-weight: bold;
      color: #667eea;
      margin: 10px 0;
    }

    .metric-value.success {
      color: #22c55e;
    }

    .metric-value.error {
      color: #ef4444;
    }

    .section {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }

    .section h2 {
      color: #333;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }

    .chart-placeholder {
      background: #f8f9fa;
      border: 2px dashed #ddd;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      color: #666;
    }

    .category-list {
      list-style: none;
    }

    .category-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      border-bottom: 1px solid #eee;
    }

    .category-item:last-child {
      border-bottom: none;
    }

    .category-count {
      background: #ef4444;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.9em;
    }

    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 0.9em;
    }

    .timestamp {
      color: #999;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 ${title}</h1>
      <p class="subtitle">Trace Analysis & Evaluation Dashboard</p>
      <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
    </header>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Total Traces</div>
        <div class="metric-value">${stats.totalTraces.toLocaleString()}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Annotated</div>
        <div class="metric-value">${stats.totalAnnotations.toLocaleString()}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Pass Rate</div>
        <div class="metric-value ${stats.passRate >= 80 ? 'success' : stats.passRate >= 50 ? '' : 'error'}">${stats.passRate.toFixed(1)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Latency</div>
        <div class="metric-value">${stats.avgLatency.toFixed(0)}ms</div>
      </div>
      ${stats.totalEvals > 0 ? `
      <div class="metric-card">
        <div class="metric-label">Eval Runs</div>
        <div class="metric-value">${stats.totalEvals.toLocaleString()}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Eval Pass Rate</div>
        <div class="metric-value ${stats.evalPassRate >= 80 ? 'success' : stats.evalPassRate >= 50 ? '' : 'error'}">${stats.evalPassRate.toFixed(1)}%</div>
      </div>
      ` : ''}
    </div>

    <div class="section">
      <h2>📈 Pass/Fail Distribution</h2>
      <div class="chart-placeholder">
        <p>Pass: ${stats.totalPassed} | Fail: ${stats.totalFailed}</p>
        <p style="margin-top: 10px; font-size: 0.9em;">Interactive charts coming soon</p>
      </div>
    </div>

    ${Object.keys(stats.byCategory).length > 0 ? `
    <div class="section">
      <h2>🏷️ Failure Categories</h2>
      <ul class="category-list">
        ${Object.entries(stats.byCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([category, count]) => `
            <li class="category-item">
              <span>${category}</span>
              <span class="category-count">${count}</span>
            </li>
          `).join('')}
      </ul>
    </div>
    ` : ''}

    ${Object.keys(stats.byProvider).length > 0 ? `
    <div class="section">
      <h2>🔌 Provider Distribution</h2>
      <ul class="category-list">
        ${Object.entries(stats.byProvider)
          .sort((a, b) => b[1] - a[1])
          .map(([provider, count]) => `
            <li class="category-item">
              <span>${provider}</span>
              <span class="category-count" style="background: #667eea;">${count}</span>
            </li>
          `).join('')}
      </ul>
    </div>
    ` : ''}

    ${stats.taxonomy ? `
    <div class="section">
      <h2>📚 Taxonomy</h2>
      <p><strong>Version:</strong> ${stats.taxonomy.version}</p>
      <p><strong>Last Updated:</strong> ${stats.taxonomy.lastUpdated}</p>
      <p><strong>Annotator:</strong> ${stats.taxonomy.annotator}</p>
      <p style="margin-top: 15px;"><strong>Categories:</strong> ${stats.taxonomy.categories.length}</p>
    </div>
    ` : ''}

    <div class="section">
      <h2>ℹ️ About</h2>
      <p>This dashboard provides an overview of your trace analysis and evaluation results.</p>
      <p style="margin-top: 10px;">
        <strong>EmbedEval</strong> - Binary evals, trace-centric, error-analysis-first.
      </p>
      <p class="timestamp" style="margin-top: 20px;">
        TODO: Interactive filtering, detailed trace viewer, trend analysis, and more visualizations coming soon.
      </p>
    </div>

    <footer class="footer">
      <p>Generated by EmbedEval</p>
    </footer>
  </div>
</body>
</html>`;
}
