/**
 * Evolution Runner Script (ES Module)
 * 
 * Runs a limited-cycle genetic evolution to find the best embedding strategy,
 * then generates a GitHub Pages report with findings.
 * 
 * Features preflight checks to validate prerequisites before running.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { PreflightChecker } from './preflight-check.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const CONFIG = {
  populationSize: 8,
  generations: 5,
  mutationRate: 0.25,
  eliteCount: 2,
};

// UUID generator
function uuidv4() {
  return crypto.randomUUID();
}

// Ollama embedding function
async function getEmbedding(text) {
  const response = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text,
    }),
  });
  
  const data = await response.json();
  return data.embedding;
}

// Cosine similarity
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// BM25 scoring (simplified)
function bm25Score(query, doc, k1 = 1.2, b = 0.75) {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const docTerms = doc.toLowerCase().split(/\s+/);
  const avgDocLen = 100;
  
  let score = 0;
  for (const term of queryTerms) {
    const tf = docTerms.filter(t => t === term).length;
    const idf = Math.log((10 + 1) / (1 + 1));
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docTerms.length / avgDocLen));
    score += idf * tfNorm;
  }
  
  return score;
}

// Calculate NDCG
function calculateNDCG(retrieved, relevant, k) {
  const dcg = retrieved.slice(0, k).reduce((sum, docId, i) => {
    const rel = relevant.includes(docId) ? 1 : 0;
    return sum + rel / Math.log2(i + 2);
  }, 0);
  
  const idealRanking = [...relevant].slice(0, k);
  const idcg = idealRanking.reduce((sum, _, i) => sum + 1 / Math.log2(i + 2), 0);
  
  return idcg > 0 ? dcg / idcg : 0;
}

// Calculate Recall
function calculateRecall(retrieved, relevant, k) {
  const retrievedSet = new Set(retrieved.slice(0, k));
  const found = relevant.filter(d => retrievedSet.has(d)).length;
  return relevant.length > 0 ? found / relevant.length : 0;
}

// Calculate MRR
function calculateMRR(retrieved, relevant, k) {
  for (let i = 0; i < Math.min(retrieved.length, k); i++) {
    if (relevant.includes(retrieved[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

// Gene definitions
const GENE_OPTIONS = {
  chunkingMethod: ['none', 'fixed', 'semantic'],
  chunkSize: [256, 384, 512, 768],
  chunkOverlap: [0, 25, 50],
  retrievalMethod: ['cosine', 'bm25', 'hybrid'],
  retrievalK: [5, 10, 20, 50],
  hybridWeights: [[0.3, 0.7], [0.5, 0.5], [0.7, 0.3]],
  rerankingMethod: ['none', 'mmr'],
  mmrLambda: [0.3, 0.5, 0.7],
};

// Create random genome
function createRandomGenome(generation) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  return {
    id: uuidv4(),
    name: '',
    genes: {
      chunkingMethod: pick(GENE_OPTIONS.chunkingMethod),
      chunkSize: pick(GENE_OPTIONS.chunkSize),
      chunkOverlap: pick(GENE_OPTIONS.chunkOverlap),
      retrievalMethod: pick(GENE_OPTIONS.retrievalMethod),
      retrievalK: pick(GENE_OPTIONS.retrievalK),
      hybridWeights: pick(GENE_OPTIONS.hybridWeights),
      rerankingMethod: pick(GENE_OPTIONS.rerankingMethod),
      mmrLambda: pick(GENE_OPTIONS.mmrLambda),
    },
    generation,
    createdAt: new Date().toISOString(),
  };
}

// Create seeded genomes
function createSeededGenomes() {
  return [
    {
      id: uuidv4(),
      name: 'baseline',
      genes: {
        chunkingMethod: 'none',
        retrievalMethod: 'cosine',
        retrievalK: 10,
        rerankingMethod: 'none',
      },
      generation: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      name: 'hybrid-bm25',
      genes: {
        chunkingMethod: 'none',
        retrievalMethod: 'hybrid',
        retrievalK: 20,
        hybridWeights: [0.6, 0.4],
        rerankingMethod: 'none',
      },
      generation: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      name: 'mmr-reranked',
      genes: {
        chunkingMethod: 'none',
        retrievalMethod: 'cosine',
        retrievalK: 20,
        rerankingMethod: 'mmr',
        mmrLambda: 0.5,
      },
      generation: 0,
      createdAt: new Date().toISOString(),
    },
  ];
}

// Mutate genome
function mutate(genome, rate) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const newGenes = { ...genome.genes };
  
  if (Math.random() < rate) newGenes.chunkingMethod = pick(GENE_OPTIONS.chunkingMethod);
  if (Math.random() < rate) newGenes.chunkSize = pick(GENE_OPTIONS.chunkSize);
  if (Math.random() < rate) newGenes.retrievalMethod = pick(GENE_OPTIONS.retrievalMethod);
  if (Math.random() < rate) newGenes.retrievalK = pick(GENE_OPTIONS.retrievalK);
  if (Math.random() < rate) newGenes.hybridWeights = pick(GENE_OPTIONS.hybridWeights);
  if (Math.random() < rate) newGenes.rerankingMethod = pick(GENE_OPTIONS.rerankingMethod);
  if (Math.random() < rate) newGenes.mmrLambda = pick(GENE_OPTIONS.mmrLambda);
  
  return {
    id: uuidv4(),
    name: '',
    genes: newGenes,
    generation: genome.generation + 1,
    createdAt: new Date().toISOString(),
  };
}

// Crossover
function crossover(p1, p2) {
  const genes = {};
  const keys = Object.keys(p1.genes);
  
  for (const key of keys) {
    genes[key] = Math.random() < 0.5 ? p1.genes[key] : p2.genes[key];
  }
  
  return {
    id: uuidv4(),
    name: '',
    genes,
    generation: Math.max(p1.generation, p2.generation) + 1,
    createdAt: new Date().toISOString(),
  };
}

// Generate genome name
function generateName(genome) {
  const parts = [];
  const g = genome.genes;
  
  if (g.chunkingMethod !== 'none') parts.push(`${g.chunkingMethod}-${g.chunkSize}`);
  parts.push(g.retrievalMethod);
  if (g.retrievalMethod === 'hybrid' && g.hybridWeights) {
    parts.push(`w${(g.hybridWeights[0] * 100).toFixed(0)}`);
  }
  parts.push(`k${g.retrievalK}`);
  if (g.rerankingMethod !== 'none') {
    parts.push(g.rerankingMethod);
    if (g.rerankingMethod === 'mmr') parts.push(`λ${g.mmrLambda}`);
  }
  
  return parts.join('-') || 'baseline';
}

// Evaluate genome
async function evaluateGenome(genome, queries, documents, docEmbeddings) {
  const startTime = Date.now();
  const results = [];
  
  for (const query of queries) {
    const queryEmbedding = await getEmbedding(query.query);
    const scores = [];
    
    for (const doc of documents) {
      let score = 0;
      const docEmbedding = docEmbeddings.get(doc.id);
      
      if (genome.genes.retrievalMethod === 'cosine') {
        score = cosineSimilarity(queryEmbedding, docEmbedding);
      } else if (genome.genes.retrievalMethod === 'bm25') {
        score = bm25Score(query.query, doc.content);
      } else if (genome.genes.retrievalMethod === 'hybrid') {
        const [embWeight, bm25Weight] = genome.genes.hybridWeights || [0.5, 0.5];
        const embScore = cosineSimilarity(queryEmbedding, docEmbedding);
        const bm25ScoreVal = bm25Score(query.query, doc.content);
        score = embWeight * embScore + bm25Weight * (bm25ScoreVal / 10);
      }
      
      scores.push({ id: doc.id, score });
    }
    
    scores.sort((a, b) => b.score - a.score);
    
    let retrieved = scores.map(s => s.id);
    if (genome.genes.rerankingMethod === 'mmr' && genome.genes.mmrLambda) {
      const lambda = genome.genes.mmrLambda;
      const k = genome.genes.retrievalK;
      const reranked = [];
      const candidates = [...scores];
      
      while (reranked.length < k && candidates.length > 0) {
        let bestIdx = 0;
        let bestScore = -Infinity;
        
        for (let i = 0; i < candidates.length; i++) {
          const relevance = candidates[i].score;
          let maxSim = 0;
          
          for (const selected of reranked) {
            const sim = cosineSimilarity(
              docEmbeddings.get(candidates[i].id),
              docEmbeddings.get(selected)
            );
            maxSim = Math.max(maxSim, sim);
          }
          
          const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
          if (mmrScore > bestScore) {
            bestScore = mmrScore;
            bestIdx = i;
          }
        }
        
        reranked.push(candidates[bestIdx].id);
        candidates.splice(bestIdx, 1);
      }
      
      retrieved = reranked;
    }
    
    results.push({
      queryId: query.id,
      retrieved: retrieved.slice(0, genome.genes.retrievalK),
      relevant: query.relevantDocs,
    });
  }
  
  const metrics = {
    ndcg5: results.reduce((sum, r) => sum + calculateNDCG(r.retrieved, r.relevant, 5), 0) / results.length,
    ndcg10: results.reduce((sum, r) => sum + calculateNDCG(r.retrieved, r.relevant, 10), 0) / results.length,
    recall5: results.reduce((sum, r) => sum + calculateRecall(r.retrieved, r.relevant, 5), 0) / results.length,
    recall10: results.reduce((sum, r) => sum + calculateRecall(r.retrieved, r.relevant, 10), 0) / results.length,
    mrr10: results.reduce((sum, r) => sum + calculateMRR(r.retrieved, r.relevant, 10), 0) / results.length,
  };
  
  const latency = Date.now() - startTime;
  genome.fitness = 0.4 * metrics.ndcg10 + 0.3 * metrics.recall10 + 0.3 * metrics.mrr10;
  genome.name = generateName(genome);
  
  return { genome, metrics, latency };
}

// Generate HTML report
async function generateReport(report) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EmbedEval Evolution Results</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root { --primary: #6366f1; --secondary: #8b5cf6; --success: #22c55e; --bg: #0f172a; --bg-card: #1e293b; --text: #e2e8f0; --text-muted: #94a3b8; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header { text-align: center; margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 1px solid #334155; }
    h1 { font-size: 2.5rem; background: linear-gradient(135deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; }
    .subtitle { color: var(--text-muted); font-size: 1.1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .card { background: var(--bg-card); border-radius: 12px; padding: 1.5rem; border: 1px solid #334155; }
    .card h2 { font-size: 1.1rem; color: var(--text-muted); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric { font-size: 2.5rem; font-weight: 700; color: var(--primary); }
    .metric-label { color: var(--text-muted); font-size: 0.9rem; }
    .improvement { color: var(--success); font-size: 1.2rem; }
    .best-genome { background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1)); border: 1px solid var(--primary); }
    .genome-name { font-family: monospace; font-size: 1.2rem; color: var(--primary); word-break: break-all; }
    .genes-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-top: 1rem; }
    .gene { padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 6px; }
    .gene-name { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; }
    .gene-value { font-family: monospace; color: var(--text); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #334155; }
    th { color: var(--text-muted); font-weight: 500; text-transform: uppercase; font-size: 0.8rem; }
    tr:hover { background: rgba(99, 102, 241, 0.05); }
    .rank-1 { color: #fbbf24; } .rank-2 { color: #9ca3af; } .rank-3 { color: #b45309; }
    .chart-container { position: relative; height: 300px; margin-top: 1rem; }
    .insights { list-style: none; }
    .insights li { padding: 0.75rem 0; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 0.75rem; }
    .insights li:last-child { border-bottom: none; }
    .insights li::before { content: '💡'; }
    footer { text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem; border-top: 1px solid #334155; margin-top: 2rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🧬 EmbedEval Evolution Results</h1>
      <p class="subtitle">Genetic Algorithm Strategy Optimization</p>
      <p class="subtitle" style="margin-top: 0.5rem;">Evolution ID: ${report.evolutionId} | ${new Date(report.timestamp).toLocaleString()}</p>
    </header>
    
    <div class="grid">
      <div class="card">
        <h2>Configuration</h2>
        <div class="genes-grid">
          <div class="gene"><div class="gene-name">Provider</div><div class="gene-value">${report.config.provider}</div></div>
          <div class="gene"><div class="gene-name">Model</div><div class="gene-value">${report.config.model}</div></div>
          <div class="gene"><div class="gene-name">Population</div><div class="gene-value">${report.config.populationSize}</div></div>
          <div class="gene"><div class="gene-name">Generations</div><div class="gene-value">${report.config.generations}</div></div>
        </div>
      </div>
      <div class="card">
        <h2>Improvement</h2>
        <div class="metric improvement">+${(report.improvementOverBaseline * 100).toFixed(1)}%</div>
        <div class="metric-label">over baseline strategy</div>
      </div>
    </div>
    
    <div class="card best-genome" style="margin-bottom: 2rem;">
      <h2>🏆 Best Evolved Strategy</h2>
      <div class="genome-name">${report.bestGenome.name}</div>
      <div style="margin-top: 0.5rem;">
        <span class="metric" style="font-size: 1.5rem;">${report.bestGenome.fitness?.toFixed(4)}</span>
        <span class="metric-label">fitness score</span>
      </div>
      <div class="genes-grid">
        <div class="gene"><div class="gene-name">Chunking</div><div class="gene-value">${report.bestGenome.genes.chunkingMethod}${report.bestGenome.genes.chunkSize ? ` (${report.bestGenome.genes.chunkSize})` : ''}</div></div>
        <div class="gene"><div class="gene-name">Retrieval</div><div class="gene-value">${report.bestGenome.genes.retrievalMethod} (k=${report.bestGenome.genes.retrievalK})</div></div>
        <div class="gene"><div class="gene-name">Hybrid Weights</div><div class="gene-value">${report.bestGenome.genes.hybridWeights ? report.bestGenome.genes.hybridWeights.join(' / ') : 'N/A'}</div></div>
        <div class="gene"><div class="gene-name">Reranking</div><div class="gene-value">${report.bestGenome.genes.rerankingMethod}${report.bestGenome.genes.mmrLambda ? ` (λ=${report.bestGenome.genes.mmrLambda})` : ''}</div></div>
      </div>
    </div>
    
    <div class="grid">
      <div class="card">
        <h2>Evolution Progress</h2>
        <div class="chart-container"><canvas id="evolutionChart"></canvas></div>
      </div>
      <div class="card">
        <h2>Key Insights</h2>
        <ul class="insights">${report.insights.map(i => `<li>${i}</li>`).join('')}</ul>
      </div>
    </div>
    
    <div class="card" style="margin-top: 2rem;">
      <h2>Final Population Results</h2>
      <table>
        <thead><tr><th>Rank</th><th>Strategy</th><th>Fitness</th><th>NDCG@10</th><th>Recall@10</th><th>MRR@10</th><th>Latency</th></tr></thead>
        <tbody>${report.finalResults.slice(0, 10).map((r, i) => `<tr><td class="${i < 3 ? `rank-${i + 1}` : ''}">#${i + 1}</td><td style="font-family: monospace; font-size: 0.85rem;">${r.genome.name}</td><td><strong>${r.genome.fitness?.toFixed(4)}</strong></td><td>${r.metrics.ndcg10.toFixed(4)}</td><td>${r.metrics.recall10.toFixed(4)}</td><td>${r.metrics.mrr10.toFixed(4)}</td><td>${r.latency}ms</td></tr>`).join('')}</tbody>
      </table>
    </div>
    
    <footer><p>Generated by EmbedEval - Self-Evolving Embedding Researcher</p><p style="margin-top: 0.5rem;"><a href="https://github.com/Algiras/embedeval" style="color: var(--primary);">GitHub</a></p></footer>
  </div>
  
  <script>
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(report.generations.map(g => `Gen ${g.generation}`))},
        datasets: [
          { label: 'Best Fitness', data: ${JSON.stringify(report.generations.map(g => g.bestFitness))}, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', fill: true, tension: 0.3 },
          { label: 'Average Fitness', data: ${JSON.stringify(report.generations.map(g => g.avgFitness))}, borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', fill: true, tension: 0.3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { y: { beginAtZero: false, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }, x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } } } }
    });
  </script>
</body>
</html>`;

  const outputPath = path.join(__dirname, '../docs/evolution-results.html');
  await fs.writeFile(outputPath, html);
  console.log(`\n📄 Report generated: ${outputPath}`);
  
  const jsonPath = path.join(__dirname, '../docs/evolution-results.json');
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
  console.log(`📊 Data saved: ${jsonPath}`);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    skipPreflight: false,
    provider: 'ollama',
    model: 'nomic-embed-text',
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--skip-preflight') {
      options.skipPreflight = true;
    } else if (args[i] === '--provider' && args[i + 1]) {
      options.provider = args[++i];
    } else if (args[i] === '--model' && args[i + 1]) {
      options.model = args[++i];
    } else if (args[i] === '--population' && args[i + 1]) {
      CONFIG.populationSize = parseInt(args[++i]);
    } else if (args[i] === '--generations' && args[i + 1]) {
      CONFIG.generations = parseInt(args[++i]);
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
EmbedEval Evolution Runner

Usage: node scripts/run-evolution.mjs [options]

Options:
  --skip-preflight     Skip prerequisite checks
  --provider <name>    Embedding provider (ollama, gemini, openai)
  --model <name>       Model name (default: nomic-embed-text)
  --population <n>     Population size (default: 8)
  --generations <n>    Number of generations (default: 5)
  -h, --help           Show this help message

Examples:
  node scripts/run-evolution.mjs
  node scripts/run-evolution.mjs --provider ollama --model nomic-embed-text
  node scripts/run-evolution.mjs --generations 10 --population 16
`);
      process.exit(0);
    }
  }
  
  return options;
}

// Main
async function main() {
  const options = parseArgs();
  
  // Run preflight checks unless skipped
  if (!options.skipPreflight) {
    const checker = new PreflightChecker({
      provider: options.provider,
      model: options.model,
    });
    
    const passed = await checker.runAll();
    
    if (!passed) {
      console.log('\n💡 Tip: Fix the issues above and run again, or use --skip-preflight to bypass checks.\n');
      process.exit(1);
    }
  }
  
  console.log('🧬 Starting Genetic Evolution for Embedding Strategies\n');
  console.log(`Configuration: Population=${CONFIG.populationSize}, Generations=${CONFIG.generations}, Mutation=${CONFIG.mutationRate}\n`);
  
  const evolutionId = uuidv4().slice(0, 8);
  const report = {
    evolutionId,
    timestamp: new Date().toISOString(),
    config: { provider: 'ollama', model: 'nomic-embed-text', populationSize: CONFIG.populationSize, generations: CONFIG.generations, mutationRate: CONFIG.mutationRate },
    generations: [],
    finalResults: [],
    bestGenome: null,
    improvementOverBaseline: 0,
    insights: [],
  };
  
  // Load data
  console.log('📚 Loading data...');
  const queriesPath = path.join(__dirname, '../examples/sample-queries.jsonl');
  const corpusPath = path.join(__dirname, '../examples/sample-corpus.jsonl');
  
  const queriesContent = await fs.readFile(queriesPath, 'utf-8');
  const corpusContent = await fs.readFile(corpusPath, 'utf-8');
  
  const queries = queriesContent.trim().split('\n').map(line => JSON.parse(line));
  const documents = corpusContent.trim().split('\n').map(line => JSON.parse(line));
  console.log(`  Queries: ${queries.length}, Documents: ${documents.length}\n`);
  
  // Pre-compute embeddings
  console.log('🔢 Computing document embeddings...');
  const docEmbeddings = new Map();
  for (const doc of documents) {
    const embedding = await getEmbedding(doc.content);
    docEmbeddings.set(doc.id, embedding);
    process.stdout.write('.');
  }
  console.log(' Done!\n');
  
  // Initialize population
  let population = [...createSeededGenomes(), ...Array(CONFIG.populationSize - 3).fill(null).map(() => createRandomGenome(0))];
  let bestEver = null;
  let baselineFitness = 0;
  
  // Evolution loop
  for (let gen = 0; gen < CONFIG.generations; gen++) {
    console.log(`\n═══ Generation ${gen + 1}/${CONFIG.generations} ═══\n`);
    
    const results = [];
    for (let i = 0; i < population.length; i++) {
      const genome = population[i];
      console.log(`  [${i + 1}/${population.length}] ${generateName(genome)}`);
      
      const result = await evaluateGenome(genome, queries, documents, docEmbeddings);
      results.push(result);
      
      console.log(`    Fitness: ${result.genome.fitness?.toFixed(4)} | NDCG@10: ${result.metrics.ndcg10.toFixed(4)}`);
      
      if (genome.name === 'baseline') baselineFitness = result.genome.fitness;
      if (!bestEver || result.genome.fitness > bestEver.fitness) bestEver = { ...result.genome };
    }
    
    results.sort((a, b) => b.genome.fitness - a.genome.fitness);
    
    const avgFitness = results.reduce((sum, r) => sum + r.genome.fitness, 0) / results.length;
    report.generations.push({ generation: gen + 1, bestFitness: results[0].genome.fitness, avgFitness, bestGenome: results[0].genome.name });
    
    console.log(`\n  📊 Best: ${results[0].genome.name} (${results[0].genome.fitness?.toFixed(4)}), Avg: ${avgFitness.toFixed(4)}`);
    
    if (gen === CONFIG.generations - 1) report.finalResults = results;
    
    if (gen < CONFIG.generations - 1) {
      const elite = results.slice(0, CONFIG.eliteCount).map(r => r.genome);
      const newPop = [...elite];
      
      while (newPop.length < CONFIG.populationSize) {
        const tournament = results.sort(() => Math.random() - 0.5).slice(0, 3).sort((a, b) => b.genome.fitness - a.genome.fitness);
        let child = crossover(tournament[0].genome, tournament[1]?.genome || tournament[0].genome);
        child = mutate(child, CONFIG.mutationRate);
        child.fitness = undefined;
        newPop.push(child);
      }
      
      population = newPop;
    }
  }
  
  report.bestGenome = bestEver;
  report.improvementOverBaseline = baselineFitness > 0 ? (bestEver.fitness - baselineFitness) / baselineFitness : 0;
  report.insights = [
    `Best strategy: ${bestEver.name} with fitness ${bestEver.fitness?.toFixed(4)}`,
    `Improvement over baseline: ${(report.improvementOverBaseline * 100).toFixed(1)}%`,
    bestEver.genes.retrievalMethod === 'hybrid' ? 'Hybrid retrieval provides best results' : `${bestEver.genes.retrievalMethod} retrieval performed best`,
    bestEver.genes.rerankingMethod !== 'none' ? `${bestEver.genes.rerankingMethod} reranking improved results` : 'No reranking needed',
  ];
  
  console.log('\n\n🏆 EVOLUTION COMPLETE!');
  console.log(`Best: ${bestEver.name} (${bestEver.fitness?.toFixed(4)})`);
  console.log(`Improvement: ${(report.improvementOverBaseline * 100).toFixed(1)}% over baseline\n`);
  
  await generateReport(report);
  console.log('\n✅ Done! Open docs/evolution-results.html');
}

main().catch(console.error);
