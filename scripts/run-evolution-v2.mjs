#!/usr/bin/env node
/**
 * Evolution Runner v2 - Comprehensive Strategy Evolution
 * 
 * Evolves retrieval strategies across ALL possible permutations:
 * - Pipeline stage ordering (reranking before/after, BM25 positions)
 * - Multiple embedding engines
 * - Query expansion strategies
 * - Multi-objective optimization (correctness, speed, cost)
 * - Environment-aware evolution
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { PreflightChecker } from './preflight-check.mjs';
import { EvolutionEngine, ENVIRONMENTS } from './evolution/engine.mjs';
import { GenomeFactory } from './evolution/genome.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    // Evolution parameters
    populationSize: 20,
    generations: 10,
    eliteCount: 3,
    
    // Environment
    environment: 'default',
    
    // Objectives
    objectives: ['correctness', 'speed', 'cost'],
    correctnessWeight: 0.5,
    speedWeight: 0.25,
    costWeight: 0.25,
    
    // Data
    queriesPath: null,
    corpusPath: null,
    
    // Output
    outputDir: null,
    
    // Misc
    skipPreflight: false,
    verbose: true,
    checkpoint: null, // Resume from checkpoint
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    
    switch (arg) {
      case '--population':
      case '-p':
        options.populationSize = parseInt(next);
        i++;
        break;
      case '--generations':
      case '-g':
        options.generations = parseInt(next);
        i++;
        break;
      case '--elite':
        options.eliteCount = parseInt(next);
        i++;
        break;
      case '--environment':
      case '-e':
        options.environment = next;
        i++;
        break;
      case '--queries':
        options.queriesPath = next;
        i++;
        break;
      case '--corpus':
        options.corpusPath = next;
        i++;
        break;
      case '--output':
      case '-o':
        options.outputDir = next;
        i++;
        break;
      case '--correctness-weight':
        options.correctnessWeight = parseFloat(next);
        i++;
        break;
      case '--speed-weight':
        options.speedWeight = parseFloat(next);
        i++;
        break;
      case '--cost-weight':
        options.costWeight = parseFloat(next);
        i++;
        break;
      case '--skip-preflight':
        options.skipPreflight = true;
        break;
      case '--quiet':
      case '-q':
        options.verbose = false;
        break;
      case '--checkpoint':
        options.checkpoint = next;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }
  
  return options;
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         EmbedEval Evolution v2 - Strategy Optimizer          ║
╚══════════════════════════════════════════════════════════════╝

USAGE:
  node scripts/run-evolution-v2.mjs [options]

EVOLUTION PARAMETERS:
  -p, --population <n>     Population size (default: 20)
  -g, --generations <n>    Number of generations (default: 10)
  --elite <n>              Elite count to preserve (default: 3)

ENVIRONMENT:
  -e, --environment <env>  Evolution environment:
                           • default     - All providers, no constraints
                           • local-only  - Ollama only, zero cost
                           • cost-optimized - Low cost, relaxed latency
                           • speed-optimized - Low latency, local models
                           • quality-optimized - Best quality, any cost

OBJECTIVES:
  --correctness-weight <w>  Weight for retrieval quality (default: 0.5)
  --speed-weight <w>        Weight for latency (default: 0.25)
  --cost-weight <w>         Weight for API costs (default: 0.25)

DATA:
  --queries <path>          Path to queries JSONL file
  --corpus <path>           Path to corpus JSONL file

OUTPUT:
  -o, --output <dir>        Output directory for results

MISC:
  --skip-preflight          Skip prerequisite checks
  --checkpoint <path>       Resume from checkpoint file
  -q, --quiet               Suppress verbose output
  -h, --help                Show this help message

EXAMPLES:
  # Basic evolution with defaults
  node scripts/run-evolution-v2.mjs

  # Local-only, cost-free evolution
  node scripts/run-evolution-v2.mjs -e local-only -g 15

  # Quality-focused evolution
  node scripts/run-evolution-v2.mjs --correctness-weight 0.8 --speed-weight 0.1 --cost-weight 0.1

  # Fast iteration
  node scripts/run-evolution-v2.mjs -p 10 -g 5 -e local-only
`);
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

async function generateReport(result, options) {
  const outputDir = options.outputDir || path.join(__dirname, '../docs');
  
  // Generate HTML report
  const html = generateHTML(result, options);
  await fs.writeFile(path.join(outputDir, 'evolution-results.html'), html);
  
  // Generate JSON data
  const jsonData = {
    evolutionId: crypto.randomUUID().slice(0, 8),
    timestamp: new Date().toISOString(),
    config: {
      populationSize: options.populationSize,
      generations: options.generations,
      environment: options.environment,
      objectives: options.objectives,
      weights: {
        correctness: options.correctnessWeight,
        speed: options.speedWeight,
        cost: options.costWeight,
      },
    },
    bestGenome: result.bestGenome?.toJSON(),
    paretoFront: result.paretoFront?.map(g => g.toJSON()),
    history: result.history,
    finalPopulation: result.finalPopulation.slice(0, 10).map(g => ({
      name: g.getName(),
      pipeline: g.pipeline,
      genes: g.genes,
      fitness: g.fitness,
    })),
    duration: result.duration,
  };
  
  await fs.writeFile(
    path.join(outputDir, 'evolution-results.json'),
    JSON.stringify(jsonData, null, 2)
  );
  
  console.log(`\n📄 Report saved to: ${outputDir}/evolution-results.html`);
  console.log(`📊 Data saved to: ${outputDir}/evolution-results.json`);
}

function generateHTML(result, options) {
  const best = result.bestGenome;
  const history = result.history;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EmbedEval Evolution Results v2</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --primary: #6366f1;
      --secondary: #8b5cf6;
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
      --bg: #0f172a;
      --bg-card: #1e293b;
      --bg-hover: #334155;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 3rem; }
    h1 { 
      font-size: 2.5rem;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .subtitle { color: var(--text-muted); font-size: 1.1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .card { background: var(--bg-card); border-radius: 12px; padding: 1.5rem; border: 1px solid var(--border); }
    .card h2 { color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; }
    .metric { font-size: 2.5rem; font-weight: 700; color: var(--primary); }
    .metric-small { font-size: 1.5rem; }
    .metric-label { color: var(--text-muted); font-size: 0.9rem; }
    .best-genome { 
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
      border: 1px solid var(--primary);
    }
    .genome-name { font-family: monospace; font-size: 1.1rem; color: var(--primary); word-break: break-all; }
    .pipeline { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
    .stage { 
      background: var(--bg-hover);
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-family: monospace;
    }
    .stage::before { content: '→ '; color: var(--text-muted); }
    .stage:first-child::before { content: ''; }
    .genes-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-top: 1rem; }
    .gene { padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 6px; }
    .gene-name { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; }
    .gene-value { font-family: monospace; color: var(--text); }
    .chart-container { height: 300px; margin-top: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; }
    tr:hover { background: rgba(99, 102, 241, 0.05); }
    .rank-1 { color: #fbbf24; }
    .rank-2 { color: #9ca3af; }
    .rank-3 { color: #b45309; }
    .fitness-bar { 
      height: 8px; 
      background: var(--bg-hover);
      border-radius: 4px;
      overflow: hidden;
    }
    .fitness-bar-fill { 
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      transition: width 0.3s;
    }
    .objectives { display: flex; gap: 2rem; margin-top: 1rem; }
    .objective { text-align: center; }
    .objective-value { font-size: 1.5rem; font-weight: 600; }
    .objective-label { font-size: 0.8rem; color: var(--text-muted); }
    footer { text-align: center; padding: 2rem; color: var(--text-muted); border-top: 1px solid var(--border); margin-top: 2rem; }
    footer a { color: var(--primary); text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <nav style="margin-bottom: 1rem; display: flex; gap: 1rem; justify-content: center;">
        <a href="landing.html" style="color: var(--text-muted); text-decoration: none; font-size: 0.9rem;">🏠 Home</a>
        <a href="index.html" style="color: var(--text-muted); text-decoration: none; font-size: 0.9rem;">📊 Meta-Evaluation</a>
        <a href="https://github.com/Algiras/embedeval" style="color: var(--text-muted); text-decoration: none; font-size: 0.9rem;">📂 GitHub</a>
      </nav>
      <h1>🧬 Evolution Results v2</h1>
      <p class="subtitle">Multi-Objective Strategy Optimization</p>
      <p class="subtitle" style="margin-top: 0.5rem; font-size: 0.9rem;">
        Environment: ${options.environment} | 
        Generations: ${history.length} | 
        Duration: ${result.duration.toFixed(1)}s
      </p>
    </header>

    <div class="grid">
      <div class="card">
        <h2>Configuration</h2>
        <div class="genes-grid">
          <div class="gene">
            <div class="gene-name">Population</div>
            <div class="gene-value">${options.populationSize}</div>
          </div>
          <div class="gene">
            <div class="gene-name">Generations</div>
            <div class="gene-value">${history.length}</div>
          </div>
          <div class="gene">
            <div class="gene-name">Correctness ↔</div>
            <div class="gene-value">${(options.correctnessWeight * 100).toFixed(0)}%</div>
          </div>
          <div class="gene">
            <div class="gene-name">Speed ↔</div>
            <div class="gene-value">${(options.speedWeight * 100).toFixed(0)}%</div>
          </div>
          <div class="gene">
            <div class="gene-name">Cost ↔</div>
            <div class="gene-value">${(options.costWeight * 100).toFixed(0)}%</div>
          </div>
          <div class="gene">
            <div class="gene-name">Environment</div>
            <div class="gene-value">${options.environment}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Multi-Objective Scores</h2>
        <div class="objectives">
          <div class="objective">
            <div class="objective-value" style="color: var(--success);">${(best?.fitness?.correctness?.ndcg10 * 100 || 0).toFixed(1)}%</div>
            <div class="objective-label">NDCG@10</div>
          </div>
          <div class="objective">
            <div class="objective-value" style="color: var(--warning);">${best?.fitness?.speed?.avgLatencyMs?.toFixed(0) || 0}ms</div>
            <div class="objective-label">Latency</div>
          </div>
          <div class="objective">
            <div class="objective-value" style="color: var(--primary);">$${best?.fitness?.cost?.costPerQuery?.toFixed(5) || 0}</div>
            <div class="objective-label">Cost/Query</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card best-genome" style="margin-bottom: 2rem;">
      <h2>🏆 Best Evolved Strategy</h2>
      <div class="genome-name">${best?.getName() || 'N/A'}</div>
      <div style="margin-top: 0.5rem;">
        <span class="metric metric-small">${best?.fitness?.overall?.toFixed(4) || 0}</span>
        <span class="metric-label">fitness score</span>
      </div>
      
      <h3 style="margin-top: 1.5rem; font-size: 0.9rem; color: var(--text-muted);">Pipeline Stages</h3>
      <div class="pipeline">
        ${(best?.pipeline || []).map(s => `<span class="stage">${s}</span>`).join('')}
      </div>
      
      <div class="genes-grid" style="margin-top: 1.5rem;">
        <div class="gene">
          <div class="gene-name">Embedding</div>
          <div class="gene-value">${best?.genes?.primaryEmbedding || 'N/A'}</div>
        </div>
        <div class="gene">
          <div class="gene-name">Query Expander</div>
          <div class="gene-value">${best?.genes?.queryExpander || 'NONE'}</div>
        </div>
        <div class="gene">
          <div class="gene-name">Fusion Method</div>
          <div class="gene-value">${best?.genes?.fusionMethod || 'NONE'}</div>
        </div>
        <div class="gene">
          <div class="gene-name">Reranker</div>
          <div class="gene-value">${best?.genes?.reranker || 'NONE'}</div>
        </div>
        <div class="gene">
          <div class="gene-name">Initial K</div>
          <div class="gene-value">${best?.genes?.initialK || 100}</div>
        </div>
        <div class="gene">
          <div class="gene-name">Final K</div>
          <div class="gene-value">${best?.genes?.finalK || 10}</div>
        </div>
        <div class="gene">
          <div class="gene-name">Hybrid Alpha</div>
          <div class="gene-value">${best?.genes?.hybridAlpha?.toFixed(2) || 0.5}</div>
        </div>
        <div class="gene">
          <div class="gene-name">MMR Lambda</div>
          <div class="gene-value">${best?.genes?.mmrLambda?.toFixed(2) || 0.5}</div>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Evolution Progress</h2>
        <div class="chart-container">
          <canvas id="evolutionChart"></canvas>
        </div>
      </div>

      <div class="card">
        <h2>Multi-Objective Progress</h2>
        <div class="chart-container">
          <canvas id="objectivesChart"></canvas>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 2rem;">
      <h2>Top Evolved Strategies</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Strategy</th>
            <th>Fitness</th>
            <th>NDCG@10</th>
            <th>Latency</th>
            <th>Cost</th>
            <th>Pipeline</th>
          </tr>
        </thead>
        <tbody>
          ${result.finalPopulation.slice(0, 10).map((g, i) => `
          <tr>
            <td class="${i < 3 ? `rank-${i + 1}` : ''}">#${i + 1}</td>
            <td style="font-family: monospace; font-size: 0.85rem;">${g.getName()}</td>
            <td>
              <div class="fitness-bar" style="width: 60px;">
                <div class="fitness-bar-fill" style="width: ${(g.fitness?.overall || 0) * 100}%;"></div>
              </div>
              <span style="font-size: 0.8rem;">${g.fitness?.overall?.toFixed(4) || 0}</span>
            </td>
            <td>${((g.fitness?.correctness?.ndcg10 || 0) * 100).toFixed(1)}%</td>
            <td>${g.fitness?.speed?.avgLatencyMs?.toFixed(0) || 0}ms</td>
            <td>$${g.fitness?.cost?.costPerQuery?.toFixed(5) || 0}</td>
            <td style="font-size: 0.75rem; color: var(--text-muted);">${g.pipeline.slice(0, 3).join(' → ')}${g.pipeline.length > 3 ? '...' : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <footer>
      <p>Generated by EmbedEval v2 - Self-Evolving Embedding Researcher</p>
      <p style="margin-top: 0.5rem;">
        <a href="landing.html">Home</a> • 
        <a href="index.html">Meta-Evaluation</a> • 
        <a href="https://github.com/Algiras/embedeval">GitHub</a>
      </p>
    </footer>
  </div>

  <script>
    // Evolution progress chart
    const ctx1 = document.getElementById('evolutionChart').getContext('2d');
    new Chart(ctx1, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(history.map((_, i) => `Gen ${i + 1}`))},
        datasets: [
          {
            label: 'Best Fitness',
            data: ${JSON.stringify(history.map(h => h.bestFitness))},
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Avg Fitness',
            data: ${JSON.stringify(history.map(h => h.avgFitness))},
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Diversity',
            data: ${JSON.stringify(history.map(h => h.diversity))},
            borderColor: '#22c55e',
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          y: { beginAtZero: false, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
          x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
        }
      }
    });

    // Objectives chart (radar)
    const ctx2 = document.getElementById('objectivesChart').getContext('2d');
    new Chart(ctx2, {
      type: 'radar',
      data: {
        labels: ['NDCG@10', 'Recall@10', 'MRR@10', 'Speed', 'Cost Efficiency'],
        datasets: [{
          label: 'Best Strategy',
          data: [
            ${(best?.fitness?.correctness?.ndcg10 || 0) * 100},
            ${(best?.fitness?.correctness?.recall10 || 0) * 100},
            ${(best?.fitness?.correctness?.mrr10 || 0) * 100},
            ${Math.min(100, 100 - (best?.fitness?.speed?.avgLatencyMs || 0) / 50)},
            ${Math.min(100, 100 - (best?.fitness?.cost?.costPerQuery || 0) * 10000)},
          ],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          r: {
            angleLines: { color: '#334155' },
            grid: { color: '#334155' },
            pointLabels: { color: '#94a3b8' },
            ticks: { color: '#94a3b8', backdropColor: 'transparent' }
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = parseArgs();
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         EmbedEval Evolution v2 - Strategy Optimizer          ║
╚══════════════════════════════════════════════════════════════╝
`);
  
  // Run preflight checks
  if (!options.skipPreflight) {
    const checker = new PreflightChecker({
      provider: 'ollama',
      model: 'nomic-embed-text',
    });
    
    const passed = await checker.runAll();
    if (!passed) {
      console.log('\n💡 Fix the issues above and run again.\n');
      process.exit(1);
    }
  }
  
  // Load data
  const queriesPath = options.queriesPath || path.join(__dirname, '../examples/sample-queries.jsonl');
  const corpusPath = options.corpusPath || path.join(__dirname, '../examples/sample-corpus.jsonl');
  
  console.log('📚 Loading data...');
  const queriesContent = await fs.readFile(queriesPath, 'utf-8');
  const corpusContent = await fs.readFile(corpusPath, 'utf-8');
  
  const queries = queriesContent.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
  const documents = corpusContent.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
  
  console.log(`  Queries: ${queries.length}`);
  console.log(`  Documents: ${documents.length}`);
  
  // Initialize evolution engine
  const engine = new EvolutionEngine({
    populationSize: options.populationSize,
    maxGenerations: options.generations,
    eliteCount: options.eliteCount,
    environment: options.environment,
    objectiveWeights: {
      correctness: options.correctnessWeight,
      speed: options.speedWeight,
      cost: options.costWeight,
    },
    verbose: options.verbose,
    checkpointDir: path.join(__dirname, '../.evolution'),
  });
  
  await engine.initialize(queries, documents);
  
  // Load checkpoint if provided
  if (options.checkpoint) {
    await engine.loadCheckpoint(options.checkpoint);
  }
  
  // Run evolution
  const result = await engine.evolve();
  
  // Get Pareto front
  result.paretoFront = engine.getParetoFront();
  
  // Generate report
  await generateReport(result, options);
  
  console.log('\n✅ Evolution complete!\n');
}

main().catch(err => {
  console.error('❌ Evolution failed:', err);
  process.exit(1);
});
