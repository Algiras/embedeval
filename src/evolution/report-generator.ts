/**
 * Evolution Report Generator
 * 
 * Generates interactive HTML reports for GitHub Pages showing:
 * - Evolution progress across generations
 * - Best strategies and their configurations
 * - Model and method comparisons
 * - LLM judge evaluations
 * 
 * @module evolution/report-generator
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { EvolutionResult, StrategyGenome, LLMJudgeResult } from '../core/types';
import { logger } from '../utils/logger';

export interface ReportOptions {
  outputDir: string;
  title?: string;
  includeJson?: boolean;
  linkToGitHub?: string;
}

export interface ReportData {
  evolutionResult: EvolutionResult;
  llmJudgeResults?: LLMJudgeResult[];
  modelComparison?: Record<string, number>;
  methodComparison?: Record<string, number>;
  queryCount?: number;
  docCount?: number;
  datasetName?: string;
}

/**
 * Generate evolution report for GitHub Pages
 */
export async function generateEvolutionReport(
  data: ReportData,
  options: ReportOptions
): Promise<string> {
  const {
    evolutionResult,
    llmJudgeResults,
    modelComparison = {},
    methodComparison = {},
    queryCount = 0,
    docCount = 0,
    datasetName = 'Custom Dataset',
  } = data;

  const { outputDir, title = 'Evolution Results', includeJson = true, linkToGitHub } = options;

  await fs.ensureDir(outputDir);

  const best = evolutionResult.bestGenome;
  const history = evolutionResult.generations;

  // Calculate LLM judge aggregate if available
  let llmJudgeAggregate = null;
  if (llmJudgeResults && llmJudgeResults.length > 0) {
    const sum = llmJudgeResults.reduce((acc, r) => ({
      overall: acc.overall + r.judgment.overallScore,
      relevance: acc.relevance + r.judgment.relevanceScore,
      completeness: acc.completeness + r.judgment.completenessScore,
    }), { overall: 0, relevance: 0, completeness: 0 });

    llmJudgeAggregate = {
      avgOverall: sum.overall / llmJudgeResults.length,
      avgRelevance: sum.relevance / llmJudgeResults.length,
      avgCompleteness: sum.completeness / llmJudgeResults.length,
      sampleCount: llmJudgeResults.length,
    };
  }

  const html = generateHTML({
    title,
    evolutionId: evolutionResult.evolutionId,
    timestamp: evolutionResult.timestamp,
    best,
    history,
    improvement: evolutionResult.improvementOverBaseline,
    totalEvaluations: evolutionResult.totalEvaluations,
    deployed: evolutionResult.deployed,
    modelComparison,
    methodComparison,
    llmJudgeAggregate,
    queryCount,
    docCount,
    datasetName,
    linkToGitHub,
  });

  const htmlPath = path.join(outputDir, 'evolution-results.html');
  await fs.writeFile(htmlPath, html);
  logger.info(`Report generated: ${htmlPath}`);

  if (includeJson) {
    const jsonPath = path.join(outputDir, 'evolution-results.json');
    await fs.writeJson(jsonPath, {
      ...evolutionResult,
      llmJudgeAggregate,
      modelComparison,
      methodComparison,
      datasetName,
    }, { spaces: 2 });
    logger.info(`JSON saved: ${jsonPath}`);
  }

  return htmlPath;
}

/**
 * Generate HTML content
 */
function generateHTML(data: {
  title: string;
  evolutionId: string;
  timestamp: string;
  best: StrategyGenome;
  history: any[];
  improvement: number;
  totalEvaluations: number;
  deployed: boolean;
  modelComparison: Record<string, number>;
  methodComparison: Record<string, number>;
  llmJudgeAggregate: any;
  queryCount: number;
  docCount: number;
  datasetName: string;
  linkToGitHub?: string;
}): string {
  const {
    title,
    evolutionId,
    timestamp,
    best,
    history,
    improvement,
    totalEvaluations,
    deployed,
    modelComparison,
    methodComparison,
    llmJudgeAggregate,
    queryCount,
    docCount,
    datasetName,
    linkToGitHub,
  } = data;

  const genes = best.genes;
  const fitnessDetails = best.fitnessDetails || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EmbedEval - ${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --primary: #6366f1; --secondary: #8b5cf6; --success: #22c55e;
      --warning: #f59e0b; --error: #ef4444; --bg: #0f172a;
      --bg-card: #1e293b; --text: #e2e8f0; --text-muted: #94a3b8; --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem; }
    .container { max-width: 1400px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 2rem; }
    header nav { margin-bottom: 1rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    header nav a { color: var(--text-muted); text-decoration: none; font-size: 0.9rem; transition: color 0.2s; }
    header nav a:hover { color: var(--primary); }
    h1 { font-size: 2.5rem; background: linear-gradient(135deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .subtitle { color: var(--text-muted); }
    .info-bar { background: rgba(99, 102, 241, 0.1); border-left: 4px solid var(--primary); padding: 1rem; margin: 1rem 0 2rem; border-radius: 0 8px 8px 0; display: flex; flex-wrap: wrap; gap: 2rem; }
    .info-bar strong { color: var(--primary); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .card { background: var(--bg-card); border-radius: 12px; padding: 1.5rem; border: 1px solid var(--border); }
    .card h2 { color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .metric { font-size: 2.5rem; font-weight: 700; color: var(--primary); }
    .metric-label { color: var(--text-muted); font-size: 0.85rem; }
    .best-card { background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15)); border-color: var(--primary); }
    .strategy-name { font-size: 1.1rem; color: var(--primary); margin-bottom: 0.75rem; line-height: 1.4; }
    .gene { display: inline-block; background: var(--bg); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.8rem; margin: 0.2rem; border: 1px solid var(--border); }
    .gene-highlight { background: rgba(99, 102, 241, 0.2); border-color: var(--primary); }
    .chart-container { height: 280px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; }
    tr:hover { background: rgba(99, 102, 241, 0.05); }
    .rank-1 { color: #fbbf24; font-weight: 600; } 
    .rank-2 { color: #9ca3af; font-weight: 600; } 
    .rank-3 { color: #b45309; font-weight: 600; }
    .bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; min-width: 60px; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); transition: width 0.3s; }
    .llm-judge { border: 2px solid var(--secondary); }
    .badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .badge-success { background: rgba(34, 197, 94, 0.2); color: var(--success); }
    .badge-primary { background: rgba(99, 102, 241, 0.2); color: var(--primary); }
    footer { text-align: center; padding: 2rem; color: var(--text-muted); border-top: 1px solid var(--border); margin-top: 2rem; font-size: 0.9rem; }
    footer a { color: var(--primary); text-decoration: none; }
    @media (max-width: 768px) {
      body { padding: 1rem; }
      h1 { font-size: 1.8rem; }
      .metric { font-size: 2rem; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <nav>
        <a href="landing.html">🏠 Home</a>
        <a href="index.html">📊 Meta-Evaluation</a>
        ${linkToGitHub ? `<a href="${linkToGitHub}">📂 GitHub</a>` : ''}
      </nav>
      <h1>🧬 ${title}</h1>
      <p class="subtitle">Self-Evolving Embedding Strategy Discovery</p>
      <p class="subtitle" style="margin-top: 0.5rem; font-size: 0.9rem;">
        ${history.length} generations | ${totalEvaluations} evaluations | ${new Date(timestamp).toLocaleDateString()}
      </p>
    </header>

    <div class="info-bar">
      <div><strong>📊 Dataset:</strong> ${datasetName}</div>
      <div><strong>🔢 Queries:</strong> ${queryCount}</div>
      <div><strong>📄 Documents:</strong> ${docCount}</div>
      <div><strong>📈 Improvement:</strong> ${(improvement * 100).toFixed(1)}%</div>
      ${deployed ? '<div><span class="badge badge-success">✓ Deployed</span></div>' : ''}
    </div>

    <div class="grid">
      <div class="card best-card">
        <h2>🏆 Best Evolved Strategy</h2>
        <div class="strategy-name">${best.name}</div>
        <div style="margin: 1rem 0;">
          <span class="metric">${((best.fitness || 0) * 100).toFixed(1)}%</span>
          <span class="metric-label">fitness</span>
        </div>
        <div style="margin-bottom: 1rem;">
          <span class="gene gene-highlight">🤖 ${genes.embeddingProvider}/${genes.embeddingModel}</span>
          <span class="gene">🔍 ${genes.retrievalMethod}</span>
          <span class="gene">📝 ${genes.queryProcessor || 'raw'}</span>
          ${genes.rerankingMethod !== 'none' ? `<span class="gene">🎯 ${genes.rerankingMethod}</span>` : ''}
          <span class="gene">k${genes.retrievalK}</span>
        </div>
        ${fitnessDetails.correctness ? `
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          Correctness: ${(fitnessDetails.correctness * 100).toFixed(1)}% |
          Speed: ${(fitnessDetails.speed * 100).toFixed(1)}% |
          Cost: ${(fitnessDetails.cost * 100).toFixed(1)}%
          ${fitnessDetails.llmJudgeScore ? `| LLM Judge: ${(fitnessDetails.llmJudgeScore * 100).toFixed(1)}%` : ''}
        </div>` : ''}
      </div>

      <div class="card">
        <h2>📈 Evolution Progress</h2>
        <div class="chart-container"><canvas id="evolutionChart"></canvas></div>
      </div>
    </div>

    ${llmJudgeAggregate ? `
    <div class="grid">
      <div class="card llm-judge">
        <h2>🤖 LLM-as-a-Judge Evaluation</h2>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
          <div>
            <div class="metric" style="font-size: 1.8rem;">${(llmJudgeAggregate.avgOverall * 100).toFixed(0)}%</div>
            <div class="metric-label">Overall</div>
          </div>
          <div>
            <div class="metric" style="font-size: 1.8rem; color: var(--secondary);">${(llmJudgeAggregate.avgRelevance * 100).toFixed(0)}%</div>
            <div class="metric-label">Relevance</div>
          </div>
          <div>
            <div class="metric" style="font-size: 1.8rem; color: var(--success);">${(llmJudgeAggregate.avgCompleteness * 100).toFixed(0)}%</div>
            <div class="metric-label">Completeness</div>
          </div>
        </div>
        <div style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted);">
          Based on ${llmJudgeAggregate.sampleCount} query evaluations
        </div>
      </div>
      <div class="card">
        <h2>🎯 Method Comparison</h2>
        <div class="chart-container"><canvas id="methodChart"></canvas></div>
      </div>
    </div>` : `
    <div class="grid">
      <div class="card">
        <h2>🤖 Model Comparison</h2>
        <div class="chart-container"><canvas id="modelChart"></canvas></div>
      </div>
      <div class="card">
        <h2>🎯 Method Comparison</h2>
        <div class="chart-container"><canvas id="methodChart"></canvas></div>
      </div>
    </div>`}

    <div class="card" style="margin-top: 2rem;">
      <h2>📊 Generation History</h2>
      <table>
        <thead>
          <tr>
            <th>Gen</th>
            <th>Best Strategy</th>
            <th>Best Fitness</th>
            <th>Avg Fitness</th>
            <th>Diversity</th>
          </tr>
        </thead>
        <tbody>
          ${history.slice(-10).reverse().map((gen, i) => `
          <tr>
            <td class="${i === 0 ? 'rank-1' : ''}">${gen.generation}</td>
            <td style="font-size: 0.85rem;">${gen.population?.[0]?.name || 'N/A'}</td>
            <td>
              <div class="bar"><div class="bar-fill" style="width: ${gen.bestFitness * 100}%;"></div></div>
              ${(gen.bestFitness * 100).toFixed(1)}%
            </td>
            <td>${(gen.avgFitness * 100).toFixed(1)}%</td>
            <td>${(gen.diversity * 100).toFixed(0)}%</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <footer>
      <p>Generated by <strong>EmbedEval</strong> - Self-Evolving Embedding Researcher</p>
      <p style="margin-top: 0.5rem;">
        <a href="landing.html">Home</a> • 
        <a href="index.html">Meta-Evaluation</a>
        ${linkToGitHub ? ` • <a href="${linkToGitHub}">GitHub</a>` : ''}
      </p>
      <p style="margin-top: 0.5rem; font-size: 0.8rem;">Evolution ID: ${evolutionId}</p>
    </footer>
  </div>

  <script>
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    };

    // Evolution progress chart
    new Chart(document.getElementById('evolutionChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(history.map((_, i) => `Gen ${i}`))},
        datasets: [
          { label: 'Best', data: ${JSON.stringify(history.map(h => (h.bestFitness * 100).toFixed(1)))}, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.3 },
          { label: 'Average', data: ${JSON.stringify(history.map(h => (h.avgFitness * 100).toFixed(1)))}, borderColor: '#8b5cf6', borderDash: [5,5], fill: false, tension: 0.3 }
        ]
      },
      options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, title: { display: true, text: 'Fitness %', color: '#94a3b8' } } } }
    });

    // Model comparison chart
    ${Object.keys(modelComparison).length > 0 ? `
    new Chart(document.getElementById('modelChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(Object.keys(modelComparison))},
        datasets: [{ label: 'Avg Fitness %', data: ${JSON.stringify(Object.values(modelComparison).map(v => (v * 100).toFixed(1)))}, backgroundColor: '#6366f1' }]
      },
      options: { ...chartOptions, indexAxis: 'y', scales: { x: { ...chartOptions.scales.x, max: 100 }, y: chartOptions.scales.y } }
    });` : ''}

    // Method comparison chart
    ${Object.keys(methodComparison).length > 0 ? `
    new Chart(document.getElementById('methodChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(Object.keys(methodComparison))},
        datasets: [{ label: 'Avg Fitness %', data: ${JSON.stringify(Object.values(methodComparison).map(v => (v * 100).toFixed(1)))}, backgroundColor: '#8b5cf6' }]
      },
      options: { ...chartOptions, scales: { x: chartOptions.scales.x, y: { ...chartOptions.scales.y, max: 100 } } }
    });` : ''}
  </script>
</body>
</html>`;
}

/**
 * Update landing page with evolution link
 */
export async function updateLandingPage(
  outputDir: string,
  evolutionResult: EvolutionResult
): Promise<void> {
  const landingPath = path.join(outputDir, 'landing.html');
  
  if (!await fs.pathExists(landingPath)) {
    logger.warn('Landing page not found, skipping update');
    return;
  }

  let content = await fs.readFile(landingPath, 'utf-8');
  
  // Check if evolution link already exists
  if (content.includes('evolution-results.html')) {
    logger.debug('Evolution link already exists in landing page');
    return;
  }

  // Add evolution card to features section (simplified approach - would need proper HTML parsing in production)
  const evolutionCard = `
        <div class="feature-card">
          <div class="feature-icon">🧬</div>
          <h3>Evolution Results</h3>
          <p>Best strategy: ${evolutionResult.bestGenome.name}</p>
          <p>Fitness: ${((evolutionResult.bestGenome.fitness || 0) * 100).toFixed(1)}%</p>
          <a href="evolution-results.html" class="btn">View Results →</a>
        </div>`;

  // Try to inject before closing features section
  const featuresEndRegex = /<\/section>\s*<section/i;
  if (featuresEndRegex.test(content)) {
    content = content.replace(featuresEndRegex, `${evolutionCard}\n      </section>\n      <section`);
    await fs.writeFile(landingPath, content);
    logger.info('Updated landing page with evolution link');
  }
}
