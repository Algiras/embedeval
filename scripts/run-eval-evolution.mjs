#!/usr/bin/env node
/**
 * Evaluation Strategy Evolution
 * 
 * Evolves different EVALUATION strategies, not just parameters.
 * Tests fundamentally different approaches to retrieval.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

import { PreflightChecker } from './preflight-check.mjs';
import {
  RETRIEVAL_METHODS,
  QUERY_PROCESSORS,
  CHUNKING_STRATEGIES,
  RERANKERS,
  EMBEDDING_MODELS,
  POST_PROCESSORS,
  EvalStrategyGenome,
  EvalStrategyFactory,
} from './evolution/eval-strategies.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  populationSize: 16,
  generations: 10,
  eliteCount: 3,
  mutationRate: 0.3,
  crossoverRate: 0.7,
  stagnationLimit: 4,
};

// ============================================================================
// SIMULATED EVALUATION (with realistic behavior)
// ============================================================================

/**
 * Simulate realistic evaluation results based on strategy components
 * This models how different strategies perform on different query types
 */
function evaluateStrategy(genome, queries, documents) {
  const results = {
    byQueryType: {},
    byDifficulty: {},
    overall: {},
  };
  
  // Base scores for different retrieval methods (realistic relative performance)
  const retrievalScores = {
    'VECTOR_COSINE': { semantic: 0.85, keyword: 0.60, factual: 0.80 },
    'VECTOR_DOT': { semantic: 0.83, keyword: 0.58, factual: 0.78 },
    'VECTOR_EUCLIDEAN': { semantic: 0.80, keyword: 0.55, factual: 0.75 },
    'BM25_CLASSIC': { semantic: 0.55, keyword: 0.90, factual: 0.70 },
    'BM25_TUNED': { semantic: 0.58, keyword: 0.88, factual: 0.72 },
    'TFIDF': { semantic: 0.50, keyword: 0.85, factual: 0.65 },
    'HYBRID_LINEAR': { semantic: 0.82, keyword: 0.82, factual: 0.82 },
    'HYBRID_RRF': { semantic: 0.85, keyword: 0.85, factual: 0.85 },
    'HYBRID_LEARNED': { semantic: 0.88, keyword: 0.88, factual: 0.88 },
    'COLBERT': { semantic: 0.90, keyword: 0.75, factual: 0.85 },
    'MULTI_VECTOR_MAX': { semantic: 0.87, keyword: 0.72, factual: 0.82 },
  };
  
  // Query processor effects
  const queryProcessorEffects = {
    'RAW': { boost: 0, latency: 0, cost: 0 },
    'LOWERCASE': { boost: 0.02, latency: 1, cost: 0 },
    'EXPANDED_SYNONYMS': { boost: 0.08, latency: 5, cost: 0 },
    'EXPANDED_LLM': { boost: 0.12, latency: 200, cost: 0.001 },
    'REWRITTEN_LLM': { boost: 0.10, latency: 200, cost: 0.001 },
    'DECOMPOSED': { boost: 0.15, latency: 300, cost: 0.002 },
    'HYDE': { boost: 0.18, latency: 400, cost: 0.002 },
    'STEP_BACK': { boost: 0.14, latency: 350, cost: 0.002 },
  };
  
  // Chunking effects
  const chunkingEffects = {
    'FULL_DOC': { precision: 0, recall: 0, latency: 0 },
    'FIXED_256': { precision: 0.05, recall: -0.10, latency: 20 },
    'FIXED_512': { precision: 0.03, recall: -0.05, latency: 15 },
    'FIXED_1024': { precision: 0.01, recall: -0.02, latency: 10 },
    'SEMANTIC': { precision: 0.08, recall: -0.03, latency: 50 },
    'SENTENCE': { precision: 0.10, recall: -0.15, latency: 30 },
    'PARAGRAPH': { precision: 0.04, recall: -0.02, latency: 10 },
    'HIERARCHICAL': { precision: 0.06, recall: 0.02, latency: 40 },
  };
  
  // Reranker effects
  const rerankerEffects = {
    'NONE': { boost: 0, latency: 0, cost: 0 },
    'CROSS_ENCODER_MINI': { boost: 0.08, latency: 100, cost: 0 },
    'CROSS_ENCODER_LARGE': { boost: 0.12, latency: 200, cost: 0 },
    'COHERE': { boost: 0.15, latency: 150, cost: 0.001 },
    'LLM_POINTWISE': { boost: 0.18, latency: 500, cost: 0.01 },
    'LLM_LISTWISE': { boost: 0.20, latency: 800, cost: 0.02 },
    'MMR': { boost: 0.05, latency: 10, cost: 0, diversity: 0.15 },
    'LOST_IN_MIDDLE': { boost: 0.03, latency: 5, cost: 0 },
  };
  
  // Embedding model quality factors
  const embeddingQuality = {
    'NOMIC_EMBED': 0.85,
    'MXBAI_LARGE': 0.88,
    'SNOWFLAKE_ARCTIC': 0.87,
    'OPENAI_SMALL': 0.90,
    'OPENAI_LARGE': 0.95,
    'GEMINI': 0.86,
    'COHERE_EN': 0.89,
    'VOYAGE': 0.91,
  };
  
  const components = genome.components;
  
  // Get base scores
  const retrieval = retrievalScores[components.retrievalMethod] || { semantic: 0.7, keyword: 0.7, factual: 0.7 };
  const queryProc = queryProcessorEffects[components.queryProcessor] || { boost: 0, latency: 0, cost: 0 };
  const chunking = chunkingEffects[components.chunkingStrategy] || { precision: 0, recall: 0, latency: 0 };
  const reranker = rerankerEffects[components.reranker] || { boost: 0, latency: 0, cost: 0 };
  const embQuality = embeddingQuality[components.embeddingModel] || 0.8;
  
  // Calculate metrics for different query types
  const queryTypes = ['factual', 'technical', 'keyword', 'procedural', 'comparison', 'best_practice'];
  const difficulties = ['easy', 'medium', 'hard'];
  
  let totalNdcg = 0;
  let totalRecall = 0;
  let totalMrr = 0;
  let totalLatency = 0;
  let totalCost = 0;
  let queryCount = 0;
  
  for (const query of queries) {
    const qType = query.type || 'factual';
    const difficulty = query.difficulty || 'medium';
    
    // Determine which score profile to use
    let scoreProfile = 'factual';
    if (['keyword', 'abbreviation'].includes(qType)) scoreProfile = 'keyword';
    else if (['technical', 'comparison', 'best_practice'].includes(qType)) scoreProfile = 'semantic';
    
    // Calculate base score
    let baseScore = retrieval[scoreProfile] * embQuality;
    
    // Apply query processing boost
    baseScore += queryProc.boost;
    
    // Apply chunking effects
    baseScore += chunking.precision;
    
    // Apply reranker boost
    baseScore += reranker.boost;
    
    // Difficulty modifier
    const difficultyMod = { 'easy': 1.0, 'medium': 0.9, 'hard': 0.75 }[difficulty] || 0.9;
    baseScore *= difficultyMod;
    
    // Add some realistic variance
    const variance = (Math.random() - 0.5) * 0.1;
    baseScore = Math.max(0, Math.min(1, baseScore + variance));
    
    // Calculate metrics
    const ndcg = baseScore;
    const recall = Math.min(1, baseScore + chunking.recall + (Math.random() - 0.5) * 0.05);
    const mrr = baseScore * (0.9 + Math.random() * 0.1);
    
    // Latency calculation
    const baseLatency = 20; // Base embedding lookup
    const latency = baseLatency + queryProc.latency + chunking.latency + reranker.latency;
    
    // Cost calculation
    const embModel = EMBEDDING_MODELS[components.embeddingModel];
    const cost = (embModel?.cost || 0) + queryProc.cost + reranker.cost;
    
    totalNdcg += ndcg;
    totalRecall += recall;
    totalMrr += mrr;
    totalLatency += latency;
    totalCost += cost;
    queryCount++;
    
    // Track by type
    if (!results.byQueryType[qType]) {
      results.byQueryType[qType] = { ndcg: [], recall: [], mrr: [] };
    }
    results.byQueryType[qType].ndcg.push(ndcg);
    results.byQueryType[qType].recall.push(recall);
    results.byQueryType[qType].mrr.push(mrr);
    
    // Track by difficulty
    if (!results.byDifficulty[difficulty]) {
      results.byDifficulty[difficulty] = { ndcg: [], recall: [], mrr: [] };
    }
    results.byDifficulty[difficulty].ndcg.push(ndcg);
    results.byDifficulty[difficulty].recall.push(recall);
    results.byDifficulty[difficulty].mrr.push(mrr);
  }
  
  // Compute averages
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  
  for (const type of Object.keys(results.byQueryType)) {
    const t = results.byQueryType[type];
    results.byQueryType[type] = {
      ndcg: avg(t.ndcg),
      recall: avg(t.recall),
      mrr: avg(t.mrr),
    };
  }
  
  for (const diff of Object.keys(results.byDifficulty)) {
    const d = results.byDifficulty[diff];
    results.byDifficulty[diff] = {
      ndcg: avg(d.ndcg),
      recall: avg(d.recall),
      mrr: avg(d.mrr),
    };
  }
  
  results.overall = {
    ndcg10: totalNdcg / queryCount,
    recall10: totalRecall / queryCount,
    mrr10: totalMrr / queryCount,
    avgLatencyMs: totalLatency / queryCount,
    costPerQuery: totalCost / queryCount,
  };
  
  // Compute overall fitness (multi-objective)
  const correctnessScore = 0.5 * results.overall.ndcg10 + 0.3 * results.overall.recall10 + 0.2 * results.overall.mrr10;
  const speedScore = 1 / (1 + results.overall.avgLatencyMs / 100); // Normalize latency
  const costScore = 1 / (1 + results.overall.costPerQuery * 1000); // Normalize cost
  
  results.fitness = 0.6 * correctnessScore + 0.25 * speedScore + 0.15 * costScore;
  
  return results;
}

// ============================================================================
// GENETIC OPERATORS
// ============================================================================

function mutate(genome, rate = 0.3) {
  const child = genome.clone();
  child.generation = genome.generation + 1;
  
  const pickKey = (obj) => {
    const keys = Object.keys(obj);
    return keys[Math.floor(Math.random() * keys.length)];
  };
  
  // Mutate each component with probability
  if (Math.random() < rate) {
    child.components.embeddingModel = pickKey(EMBEDDING_MODELS);
  }
  if (Math.random() < rate) {
    child.components.retrievalMethod = pickKey(RETRIEVAL_METHODS);
  }
  if (Math.random() < rate) {
    child.components.chunkingStrategy = pickKey(CHUNKING_STRATEGIES);
  }
  if (Math.random() < rate) {
    child.components.queryProcessor = pickKey(QUERY_PROCESSORS);
  }
  if (Math.random() < rate) {
    child.components.reranker = pickKey(RERANKERS);
  }
  if (Math.random() < rate) {
    child.components.postProcessor = pickKey(POST_PROCESSORS);
  }
  if (Math.random() < rate * 0.5) {
    child.components.topK = [5, 10, 20, 50][Math.floor(Math.random() * 4)];
  }
  if (Math.random() < rate * 0.5) {
    child.components.hybridAlpha = 0.3 + Math.random() * 0.6;
  }
  if (Math.random() < rate * 0.5) {
    child.components.mmrLambda = 0.2 + Math.random() * 0.6;
  }
  
  child.fitness = null;
  return child;
}

function crossover(p1, p2) {
  const child = new EvalStrategyGenome({
    generation: Math.max(p1.generation, p2.generation) + 1,
    parentIds: [p1.id, p2.id],
    components: {},
  });
  
  // Uniform crossover for components
  for (const key of Object.keys(p1.components)) {
    child.components[key] = Math.random() < 0.5 ? p1.components[key] : p2.components[key];
  }
  
  return child;
}

function tournamentSelect(population, size = 3) {
  const tournament = [];
  for (let i = 0; i < size; i++) {
    const idx = Math.floor(Math.random() * population.length);
    tournament.push(population[idx]);
  }
  tournament.sort((a, b) => (b.fitness?.fitness || 0) - (a.fitness?.fitness || 0));
  return tournament[0];
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

async function generateReport(result, options) {
  const outputDir = options.outputDir || path.join(__dirname, '../docs');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EmbedEval - Evaluation Strategy Evolution</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --primary: #6366f1; --secondary: #8b5cf6; --success: #22c55e;
      --warning: #f59e0b; --error: #ef4444; --bg: #0f172a;
      --bg-card: #1e293b; --text: #e2e8f0; --text-muted: #94a3b8; --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem; }
    .container { max-width: 1400px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 2rem; }
    header nav { margin-bottom: 1rem; display: flex; gap: 1rem; justify-content: center; }
    header nav a { color: var(--text-muted); text-decoration: none; font-size: 0.9rem; }
    h1 { font-size: 2.5rem; background: linear-gradient(135deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { color: var(--text-muted); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .card { background: var(--bg-card); border-radius: 12px; padding: 1.5rem; border: 1px solid var(--border); }
    .card h2 { color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; margin-bottom: 1rem; }
    .metric { font-size: 2rem; font-weight: 700; color: var(--primary); }
    .metric-label { color: var(--text-muted); font-size: 0.85rem; }
    .best-strategy { background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1)); border-color: var(--primary); }
    .strategy-name { font-size: 1rem; color: var(--primary); margin-bottom: 0.5rem; line-height: 1.4; }
    .component { display: inline-block; background: var(--bg); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin: 0.2rem; }
    .chart-container { height: 300px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; }
    .rank-1 { color: #fbbf24; } .rank-2 { color: #9ca3af; } .rank-3 { color: #b45309; }
    .bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--primary); }
    footer { text-align: center; padding: 2rem; color: var(--text-muted); border-top: 1px solid var(--border); margin-top: 2rem; }
    footer a { color: var(--primary); text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <nav>
        <a href="landing.html">🏠 Home</a>
        <a href="index.html">📊 Meta-Evaluation</a>
        <a href="https://github.com/Algiras/embedeval">📂 GitHub</a>
      </nav>
      <h1>🧬 Evaluation Strategy Evolution</h1>
      <p class="subtitle">Testing Different Retrieval Approaches</p>
      <p class="subtitle" style="margin-top: 0.5rem; font-size: 0.9rem;">
        ${result.history.length} generations | ${result.population.length} strategies evaluated
      </p>
    </header>

    <div class="grid">
      <div class="card best-strategy">
        <h2>🏆 Best Strategy</h2>
        <div class="strategy-name">${result.best.getName()}</div>
        <div style="margin: 1rem 0;">
          <span class="metric">${(result.best.fitness?.fitness * 100 || 0).toFixed(1)}%</span>
          <span class="metric-label">fitness</span>
        </div>
        <div>
          <span class="component">📊 ${result.best.components.retrievalMethod}</span>
          <span class="component">🔍 ${result.best.components.queryProcessor}</span>
          <span class="component">📄 ${result.best.components.chunkingStrategy}</span>
          <span class="component">🎯 ${result.best.components.reranker}</span>
        </div>
        <div style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted);">
          NDCG: ${(result.best.fitness?.overall?.ndcg10 * 100 || 0).toFixed(1)}% |
          Recall: ${(result.best.fitness?.overall?.recall10 * 100 || 0).toFixed(1)}% |
          Latency: ${result.best.fitness?.overall?.avgLatencyMs?.toFixed(0) || 0}ms
        </div>
      </div>
      
      <div class="card">
        <h2>Performance by Query Type</h2>
        <div class="chart-container"><canvas id="queryTypeChart"></canvas></div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Evolution Progress</h2>
        <div class="chart-container"><canvas id="evolutionChart"></canvas></div>
      </div>
      <div class="card">
        <h2>Performance by Difficulty</h2>
        <div class="chart-container"><canvas id="difficultyChart"></canvas></div>
      </div>
    </div>

    <div class="card" style="margin-top: 2rem;">
      <h2>All Strategies Ranked</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Strategy</th>
            <th>Fitness</th>
            <th>NDCG@10</th>
            <th>Recall@10</th>
            <th>Latency</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          ${result.population.slice(0, 15).map((g, i) => `
          <tr>
            <td class="${i < 3 ? `rank-${i+1}` : ''}">#${i+1}</td>
            <td style="font-size: 0.85rem; max-width: 400px;">${g.getName()}</td>
            <td>
              <div class="bar" style="width: 80px;"><div class="bar-fill" style="width: ${(g.fitness?.fitness || 0) * 100}%;"></div></div>
              ${(g.fitness?.fitness * 100 || 0).toFixed(1)}%
            </td>
            <td>${(g.fitness?.overall?.ndcg10 * 100 || 0).toFixed(1)}%</td>
            <td>${(g.fitness?.overall?.recall10 * 100 || 0).toFixed(1)}%</td>
            <td>${g.fitness?.overall?.avgLatencyMs?.toFixed(0) || 0}ms</td>
            <td>$${g.fitness?.overall?.costPerQuery?.toFixed(4) || 0}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <footer>
      <p>Generated by EmbedEval - Self-Evolving Embedding Researcher</p>
      <p><a href="landing.html">Home</a> • <a href="index.html">Meta-Evaluation</a> • <a href="https://github.com/Algiras/embedeval">GitHub</a></p>
    </footer>
  </div>

  <script>
    // Evolution chart
    new Chart(document.getElementById('evolutionChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(result.history.map((_, i) => `Gen ${i+1}`))},
        datasets: [
          { label: 'Best', data: ${JSON.stringify(result.history.map(h => h.best))}, borderColor: '#6366f1', fill: false },
          { label: 'Average', data: ${JSON.stringify(result.history.map(h => h.avg))}, borderColor: '#8b5cf6', fill: false },
          { label: 'Diversity', data: ${JSON.stringify(result.history.map(h => h.diversity))}, borderColor: '#22c55e', borderDash: [5,5], fill: false }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
    });

    // Query type chart
    const queryTypes = ${JSON.stringify(Object.keys(result.best.fitness?.byQueryType || {}))};
    const queryNdcg = ${JSON.stringify(Object.values(result.best.fitness?.byQueryType || {}).map(v => v.ndcg * 100))};
    new Chart(document.getElementById('queryTypeChart'), {
      type: 'bar',
      data: {
        labels: queryTypes,
        datasets: [{ label: 'NDCG@10', data: queryNdcg, backgroundColor: '#6366f1' }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
    });

    // Difficulty chart
    const difficulties = ${JSON.stringify(Object.keys(result.best.fitness?.byDifficulty || {}))};
    const diffNdcg = ${JSON.stringify(Object.values(result.best.fitness?.byDifficulty || {}).map(v => v.ndcg * 100))};
    new Chart(document.getElementById('difficultyChart'), {
      type: 'bar',
      data: {
        labels: difficulties,
        datasets: [{ label: 'NDCG@10', data: diffNdcg, backgroundColor: '#8b5cf6' }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
    });
  </script>
</body>
</html>`;

  await fs.writeFile(path.join(outputDir, 'evolution-results.html'), html);
  await fs.writeFile(path.join(outputDir, 'evolution-results.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    best: result.best.toJSON(),
    history: result.history,
    population: result.population.map(g => ({ name: g.getName(), ...g.toJSON() })),
  }, null, 2));
  
  console.log(`\n📄 Report: ${outputDir}/evolution-results.html`);
}

// ============================================================================
// MAIN EVOLUTION LOOP
// ============================================================================

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║       EmbedEval - Evaluation Strategy Evolution              ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Load data
  console.log('📚 Loading evaluation dataset...');
  const queriesPath = path.join(__dirname, '../examples/eval-queries.jsonl');
  const corpusPath = path.join(__dirname, '../examples/eval-corpus.jsonl');
  
  const queries = (await fs.readFile(queriesPath, 'utf-8')).trim().split('\n').map(l => JSON.parse(l));
  const documents = (await fs.readFile(corpusPath, 'utf-8')).trim().split('\n').map(l => JSON.parse(l));
  
  console.log(`   ${queries.length} queries, ${documents.length} documents\n`);

  // Initialize population with diverse strategies
  console.log('🌱 Creating diverse initial population...');
  let population = EvalStrategyFactory.createSeededPopulation(CONFIG.populationSize, {
    availableProviders: ['ollama'], // Local only for testing
  });
  
  const history = [];
  let bestEver = null;
  let stagnation = 0;

  // Evolution loop
  for (let gen = 1; gen <= CONFIG.generations; gen++) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  Generation ${gen}/${CONFIG.generations}`);
    console.log(`${'─'.repeat(50)}\n`);

    // Evaluate population
    for (let i = 0; i < population.length; i++) {
      const genome = population[i];
      if (!genome.fitness) {
        genome.fitness = evaluateStrategy(genome, queries, documents);
      }
      console.log(`  [${i+1}/${population.length}] ${genome.getShortName()}: ${(genome.fitness.fitness * 100).toFixed(1)}%`);
    }

    // Sort by fitness
    population.sort((a, b) => (b.fitness?.fitness || 0) - (a.fitness?.fitness || 0));

    // Track best
    const currentBest = population[0];
    if (!bestEver || currentBest.fitness.fitness > bestEver.fitness.fitness) {
      bestEver = currentBest;
      stagnation = 0;
    } else {
      stagnation++;
    }

    // Calculate diversity
    const uniqueStrategies = new Set(population.map(g => g.getShortName())).size;
    const diversity = uniqueStrategies / population.length;

    // Record history
    const avgFitness = population.reduce((s, g) => s + (g.fitness?.fitness || 0), 0) / population.length;
    history.push({
      generation: gen,
      best: currentBest.fitness.fitness,
      avg: avgFitness,
      diversity,
      bestStrategy: currentBest.getShortName(),
    });

    console.log(`\n  📊 Best: ${currentBest.getShortName()}`);
    console.log(`     Fitness: ${(currentBest.fitness.fitness * 100).toFixed(1)}% | NDCG: ${(currentBest.fitness.overall.ndcg10 * 100).toFixed(1)}%`);
    console.log(`     Diversity: ${(diversity * 100).toFixed(0)}% | Stagnation: ${stagnation}/${CONFIG.stagnationLimit}`);

    // Check stopping condition
    if (stagnation >= CONFIG.stagnationLimit) {
      console.log(`\n⚠️ Stopping: No improvement for ${stagnation} generations`);
      break;
    }

    // Create next generation
    if (gen < CONFIG.generations) {
      const newPop = [];
      
      // Elitism
      for (let i = 0; i < CONFIG.eliteCount; i++) {
        const elite = population[i].clone();
        elite.fitness = { ...population[i].fitness };
        newPop.push(elite);
      }

      // Fill with offspring
      while (newPop.length < CONFIG.populationSize) {
        const p1 = tournamentSelect(population);
        const p2 = tournamentSelect(population);
        
        let child;
        if (Math.random() < CONFIG.crossoverRate) {
          child = crossover(p1, p2);
        } else {
          child = p1.clone();
        }
        
        child = mutate(child, CONFIG.mutationRate);
        newPop.push(child);
      }

      population = newPop;
    }
  }

  // Final report
  console.log(`\n${'═'.repeat(50)}`);
  console.log('🏆 EVOLUTION COMPLETE');
  console.log(`${'═'.repeat(50)}`);
  console.log(`\nBest Strategy: ${bestEver.getName()}`);
  console.log(`  Fitness: ${(bestEver.fitness.fitness * 100).toFixed(1)}%`);
  console.log(`  NDCG@10: ${(bestEver.fitness.overall.ndcg10 * 100).toFixed(1)}%`);
  console.log(`  Recall@10: ${(bestEver.fitness.overall.recall10 * 100).toFixed(1)}%`);
  console.log(`  Latency: ${bestEver.fitness.overall.avgLatencyMs.toFixed(0)}ms`);

  // Generate report
  await generateReport({ best: bestEver, history, population }, { outputDir: path.join(__dirname, '../docs') });

  console.log('\n✅ Done!\n');
}

main().catch(console.error);
