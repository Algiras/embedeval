/**
 * Evolution Runner Script
 * 
 * Runs a limited-cycle genetic evolution to find the best embedding strategy,
 * then generates a GitHub Pages report with findings.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Types
interface StrategyGenome {
  id: string;
  name: string;
  genes: {
    chunkingMethod: 'none' | 'fixed' | 'semantic' | 'sliding';
    chunkSize?: number;
    chunkOverlap?: number;
    retrievalMethod: 'cosine' | 'bm25' | 'hybrid';
    retrievalK: number;
    hybridWeights?: [number, number];
    rerankingMethod: 'none' | 'llm' | 'mmr' | 'cross-encoder';
    rerankingTopK?: number;
    mmrLambda?: number;
  };
  fitness?: number;
  generation: number;
  createdAt: string;
}

interface EvaluationResult {
  genome: StrategyGenome;
  metrics: {
    ndcg5: number;
    ndcg10: number;
    recall5: number;
    recall10: number;
    mrr10: number;
  };
  latency: number;
}

interface EvolutionReport {
  evolutionId: string;
  timestamp: string;
  config: {
    provider: string;
    model: string;
    populationSize: number;
    generations: number;
    mutationRate: number;
  };
  generations: Array<{
    generation: number;
    bestFitness: number;
    avgFitness: number;
    bestGenome: string;
  }>;
  finalResults: EvaluationResult[];
  bestGenome: StrategyGenome;
  improvementOverBaseline: number;
  insights: string[];
}

// Configuration
const CONFIG = {
  populationSize: 8,
  generations: 5,
  mutationRate: 0.25,
  eliteCount: 2,
};

// Ollama embedding function
async function getEmbedding(text: string): Promise<number[]> {
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
function cosineSimilarity(a: number[], b: number[]): number {
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
function bm25Score(query: string, doc: string, k1 = 1.2, b = 0.75): number {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const docTerms = doc.toLowerCase().split(/\s+/);
  const avgDocLen = 100; // Approximate
  
  let score = 0;
  for (const term of queryTerms) {
    const tf = docTerms.filter(t => t === term).length;
    const idf = Math.log((10 + 1) / (1 + 1)); // Simplified IDF
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docTerms.length / avgDocLen));
    score += idf * tfNorm;
  }
  
  return score;
}

// Calculate NDCG
function calculateNDCG(retrieved: string[], relevant: string[], k: number): number {
  const dcg = retrieved.slice(0, k).reduce((sum, docId, i) => {
    const rel = relevant.includes(docId) ? 1 : 0;
    return sum + rel / Math.log2(i + 2);
  }, 0);
  
  const idealRanking = [...relevant].slice(0, k);
  const idcg = idealRanking.reduce((sum, _, i) => sum + 1 / Math.log2(i + 2), 0);
  
  return idcg > 0 ? dcg / idcg : 0;
}

// Calculate Recall
function calculateRecall(retrieved: string[], relevant: string[], k: number): number {
  const retrievedSet = new Set(retrieved.slice(0, k));
  const found = relevant.filter(d => retrievedSet.has(d)).length;
  return relevant.length > 0 ? found / relevant.length : 0;
}

// Calculate MRR
function calculateMRR(retrieved: string[], relevant: string[], k: number): number {
  for (let i = 0; i < Math.min(retrieved.length, k); i++) {
    if (relevant.includes(retrieved[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

// Gene definitions
const GENE_OPTIONS = {
  chunkingMethod: ['none', 'fixed', 'semantic'] as const,
  chunkSize: [256, 384, 512, 768],
  chunkOverlap: [0, 25, 50],
  retrievalMethod: ['cosine', 'bm25', 'hybrid'] as const,
  retrievalK: [5, 10, 20, 50],
  hybridWeights: [[0.3, 0.7], [0.5, 0.5], [0.7, 0.3]] as [number, number][],
  rerankingMethod: ['none', 'mmr'] as const,
  mmrLambda: [0.3, 0.5, 0.7],
};

// Create random genome
function createRandomGenome(generation: number): StrategyGenome {
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  
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

// Create baseline genome
function createBaselineGenome(): StrategyGenome {
  return {
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
  };
}

// Create seeded genomes
function createSeededGenomes(): StrategyGenome[] {
  return [
    createBaselineGenome(),
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
function mutate(genome: StrategyGenome, rate: number): StrategyGenome {
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
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
function crossover(p1: StrategyGenome, p2: StrategyGenome): StrategyGenome {
  const genes: any = {};
  const keys = Object.keys(p1.genes) as (keyof typeof p1.genes)[];
  
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
function generateName(genome: StrategyGenome): string {
  const parts: string[] = [];
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
async function evaluateGenome(
  genome: StrategyGenome,
  queries: any[],
  documents: any[],
  docEmbeddings: Map<string, number[]>
): Promise<EvaluationResult> {
  const startTime = Date.now();
  const results: { queryId: string; retrieved: string[]; relevant: string[] }[] = [];
  
  for (const query of queries) {
    // Get query embedding
    const queryEmbedding = await getEmbedding(query.query);
    
    // Score documents
    const scores: { id: string; score: number }[] = [];
    
    for (const doc of documents) {
      let score = 0;
      const docEmbedding = docEmbeddings.get(doc.id)!;
      
      if (genome.genes.retrievalMethod === 'cosine') {
        score = cosineSimilarity(queryEmbedding, docEmbedding);
      } else if (genome.genes.retrievalMethod === 'bm25') {
        score = bm25Score(query.query, doc.content);
      } else if (genome.genes.retrievalMethod === 'hybrid') {
        const [embWeight, bm25Weight] = genome.genes.hybridWeights || [0.5, 0.5];
        const embScore = cosineSimilarity(queryEmbedding, docEmbedding);
        const bm25ScoreVal = bm25Score(query.query, doc.content);
        score = embWeight * embScore + bm25Weight * (bm25ScoreVal / 10); // Normalize BM25
      }
      
      scores.push({ id: doc.id, score });
    }
    
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    // Apply MMR if enabled
    let retrieved = scores.map(s => s.id);
    if (genome.genes.rerankingMethod === 'mmr' && genome.genes.mmrLambda) {
      const lambda = genome.genes.mmrLambda;
      const k = genome.genes.retrievalK;
      const reranked: string[] = [];
      const candidates = [...scores];
      
      while (reranked.length < k && candidates.length > 0) {
        let bestIdx = 0;
        let bestScore = -Infinity;
        
        for (let i = 0; i < candidates.length; i++) {
          const relevance = candidates[i].score;
          let maxSim = 0;
          
          for (const selected of reranked) {
            const sim = cosineSimilarity(
              docEmbeddings.get(candidates[i].id)!,
              docEmbeddings.get(selected)!
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
  
  // Calculate metrics
  const metrics = {
    ndcg5: results.reduce((sum, r) => sum + calculateNDCG(r.retrieved, r.relevant, 5), 0) / results.length,
    ndcg10: results.reduce((sum, r) => sum + calculateNDCG(r.retrieved, r.relevant, 10), 0) / results.length,
    recall5: results.reduce((sum, r) => sum + calculateRecall(r.retrieved, r.relevant, 5), 0) / results.length,
    recall10: results.reduce((sum, r) => sum + calculateRecall(r.retrieved, r.relevant, 10), 0) / results.length,
    mrr10: results.reduce((sum, r) => sum + calculateMRR(r.retrieved, r.relevant, 10), 0) / results.length,
  };
  
  const latency = Date.now() - startTime;
  
  // Calculate fitness
  genome.fitness = 0.4 * metrics.ndcg10 + 0.3 * metrics.recall10 + 0.3 * metrics.mrr10;
  genome.name = generateName(genome);
  
  return { genome, metrics, latency };
}

// Main evolution function
async function runEvolution(): Promise<EvolutionReport> {
  console.log('🧬 Starting Genetic Evolution for Embedding Strategies\n');
  console.log(`Configuration:`);
  console.log(`  Population: ${CONFIG.populationSize}`);
  console.log(`  Generations: ${CONFIG.generations}`);
  console.log(`  Mutation Rate: ${CONFIG.mutationRate}`);
  console.log(`  Elite Count: ${CONFIG.eliteCount}\n`);
  
  const evolutionId = uuidv4().slice(0, 8);
  const report: EvolutionReport = {
    evolutionId,
    timestamp: new Date().toISOString(),
    config: {
      provider: 'ollama',
      model: 'nomic-embed-text',
      populationSize: CONFIG.populationSize,
      generations: CONFIG.generations,
      mutationRate: CONFIG.mutationRate,
    },
    generations: [],
    finalResults: [],
    bestGenome: null as any,
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
  
  console.log(`  Queries: ${queries.length}`);
  console.log(`  Documents: ${documents.length}\n`);
  
  // Pre-compute document embeddings
  console.log('🔢 Computing document embeddings...');
  const docEmbeddings = new Map<string, number[]>();
  for (const doc of documents) {
    const embedding = await getEmbedding(doc.content);
    docEmbeddings.set(doc.id, embedding);
    process.stdout.write('.');
  }
  console.log(' Done!\n');
  
  // Initialize population
  console.log('🌱 Initializing population...');
  let population: StrategyGenome[] = [
    ...createSeededGenomes(),
    ...Array(CONFIG.populationSize - 3).fill(null).map(() => createRandomGenome(0)),
  ];
  
  // Evolution loop
  let bestEver: StrategyGenome | null = null;
  let baselineFitness = 0;
  
  for (let gen = 0; gen < CONFIG.generations; gen++) {
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  Generation ${gen + 1}/${CONFIG.generations}`);
    console.log(`═══════════════════════════════════════════\n`);
    
    // Evaluate population
    const results: EvaluationResult[] = [];
    for (let i = 0; i < population.length; i++) {
      const genome = population[i];
      console.log(`  Evaluating [${i + 1}/${population.length}]: ${generateName(genome)}`);
      
      const result = await evaluateGenome(genome, queries, documents, docEmbeddings);
      results.push(result);
      
      console.log(`    Fitness: ${result.genome.fitness?.toFixed(4)} | NDCG@10: ${result.metrics.ndcg10.toFixed(4)} | Recall@10: ${result.metrics.recall10.toFixed(4)}`);
      
      // Track baseline
      if (genome.name === 'baseline') {
        baselineFitness = result.genome.fitness!;
      }
      
      // Track best ever
      if (!bestEver || result.genome.fitness! > bestEver.fitness!) {
        bestEver = { ...result.genome };
      }
    }
    
    // Sort by fitness
    results.sort((a, b) => b.genome.fitness! - a.genome.fitness!);
    
    // Record generation stats
    const avgFitness = results.reduce((sum, r) => sum + r.genome.fitness!, 0) / results.length;
    report.generations.push({
      generation: gen + 1,
      bestFitness: results[0].genome.fitness!,
      avgFitness,
      bestGenome: results[0].genome.name,
    });
    
    console.log(`\n  📊 Generation ${gen + 1} Summary:`);
    console.log(`     Best: ${results[0].genome.name} (${results[0].genome.fitness?.toFixed(4)})`);
    console.log(`     Avg:  ${avgFitness.toFixed(4)}`);
    
    // Store final results on last generation
    if (gen === CONFIG.generations - 1) {
      report.finalResults = results;
    }
    
    // Selection and reproduction (skip on last gen)
    if (gen < CONFIG.generations - 1) {
      // Elite preservation
      const elite = results.slice(0, CONFIG.eliteCount).map(r => r.genome);
      
      // Tournament selection and reproduction
      const newPopulation: StrategyGenome[] = [...elite];
      
      while (newPopulation.length < CONFIG.populationSize) {
        // Tournament selection
        const tournament = results
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .sort((a, b) => b.genome.fitness! - a.genome.fitness!);
        
        const parent1 = tournament[0].genome;
        const parent2 = tournament[1]?.genome || parent1;
        
        // Crossover and mutation
        let child = crossover(parent1, parent2);
        child = mutate(child, CONFIG.mutationRate);
        child.fitness = undefined;
        
        newPopulation.push(child);
      }
      
      population = newPopulation;
    }
  }
  
  // Final report
  report.bestGenome = bestEver!;
  report.improvementOverBaseline = baselineFitness > 0 
    ? (bestEver!.fitness! - baselineFitness) / baselineFitness 
    : 0;
  
  // Generate insights
  report.insights = [
    `Best strategy: ${bestEver!.name} with fitness ${bestEver!.fitness?.toFixed(4)}`,
    `Improvement over baseline: ${(report.improvementOverBaseline * 100).toFixed(1)}%`,
    bestEver!.genes.retrievalMethod === 'hybrid' 
      ? 'Hybrid retrieval (embedding + BM25) provides best results' 
      : `${bestEver!.genes.retrievalMethod} retrieval performed best`,
    bestEver!.genes.rerankingMethod !== 'none'
      ? `${bestEver!.genes.rerankingMethod} reranking improved results`
      : 'No reranking needed for this dataset',
  ];
  
  console.log('\n\n🏆 EVOLUTION COMPLETE!\n');
  console.log(`Best Genome: ${bestEver!.name}`);
  console.log(`Fitness: ${bestEver!.fitness?.toFixed(4)}`);
  console.log(`Improvement: ${(report.improvementOverBaseline * 100).toFixed(1)}% over baseline`);
  
  return report;
}

// Generate GitHub Pages HTML report
async function generateReport(report: EvolutionReport): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EmbedEval Evolution Results</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --primary: #6366f1;
      --secondary: #8b5cf6;
      --success: #22c55e;
      --warning: #f59e0b;
      --bg: #0f172a;
      --bg-card: #1e293b;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid #334155;
    }
    
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    
    .subtitle {
      color: var(--text-muted);
      font-size: 1.1rem;
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .card {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 1.5rem;
      border: 1px solid #334155;
    }
    
    .card h2 {
      font-size: 1.1rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .metric {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--primary);
    }
    
    .metric-label {
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    
    .improvement {
      color: var(--success);
      font-size: 1.2rem;
    }
    
    .best-genome {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
      border: 1px solid var(--primary);
    }
    
    .genome-name {
      font-family: monospace;
      font-size: 1.2rem;
      color: var(--primary);
      word-break: break-all;
    }
    
    .genes-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      margin-top: 1rem;
    }
    
    .gene {
      padding: 0.5rem;
      background: rgba(0,0,0,0.2);
      border-radius: 6px;
    }
    
    .gene-name {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    
    .gene-value {
      font-family: monospace;
      color: var(--text);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #334155;
    }
    
    th {
      color: var(--text-muted);
      font-weight: 500;
      text-transform: uppercase;
      font-size: 0.8rem;
    }
    
    tr:hover {
      background: rgba(99, 102, 241, 0.05);
    }
    
    .rank-1 { color: #fbbf24; }
    .rank-2 { color: #9ca3af; }
    .rank-3 { color: #b45309; }
    
    .chart-container {
      position: relative;
      height: 300px;
      margin-top: 1rem;
    }
    
    .insights {
      list-style: none;
    }
    
    .insights li {
      padding: 0.75rem 0;
      border-bottom: 1px solid #334155;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .insights li:last-child {
      border-bottom: none;
    }
    
    .insights li::before {
      content: '💡';
    }
    
    footer {
      text-align: center;
      padding: 2rem;
      color: var(--text-muted);
      font-size: 0.9rem;
      border-top: 1px solid #334155;
      margin-top: 2rem;
    }
    
    @media (max-width: 768px) {
      .container { padding: 1rem; }
      h1 { font-size: 1.8rem; }
      .metric { font-size: 2rem; }
      .genes-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🧬 EmbedEval Evolution Results</h1>
      <p class="subtitle">Genetic Algorithm Strategy Optimization</p>
      <p class="subtitle" style="margin-top: 0.5rem;">
        Evolution ID: ${report.evolutionId} | ${new Date(report.timestamp).toLocaleString()}
      </p>
    </header>
    
    <div class="grid">
      <div class="card">
        <h2>Configuration</h2>
        <div class="genes-grid">
          <div class="gene">
            <div class="gene-name">Provider</div>
            <div class="gene-value">${report.config.provider}</div>
          </div>
          <div class="gene">
            <div class="gene-name">Model</div>
            <div class="gene-value">${report.config.model}</div>
          </div>
          <div class="gene">
            <div class="gene-name">Population</div>
            <div class="gene-value">${report.config.populationSize}</div>
          </div>
          <div class="gene">
            <div class="gene-name">Generations</div>
            <div class="gene-value">${report.config.generations}</div>
          </div>
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
        <div class="gene">
          <div class="gene-name">Chunking</div>
          <div class="gene-value">${report.bestGenome.genes.chunkingMethod}${report.bestGenome.genes.chunkSize ? ` (${report.bestGenome.genes.chunkSize})` : ''}</div>
        </div>
        <div class="gene">
          <div class="gene-name">Retrieval</div>
          <div class="gene-value">${report.bestGenome.genes.retrievalMethod} (k=${report.bestGenome.genes.retrievalK})</div>
        </div>
        <div class="gene">
          <div class="gene-name">Hybrid Weights</div>
          <div class="gene-value">${report.bestGenome.genes.hybridWeights ? report.bestGenome.genes.hybridWeights.join(' / ') : 'N/A'}</div>
        </div>
        <div class="gene">
          <div class="gene-name">Reranking</div>
          <div class="gene-value">${report.bestGenome.genes.rerankingMethod}${report.bestGenome.genes.mmrLambda ? ` (λ=${report.bestGenome.genes.mmrLambda})` : ''}</div>
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
        <h2>Key Insights</h2>
        <ul class="insights">
          ${report.insights.map(insight => `<li>${insight}</li>`).join('\n          ')}
        </ul>
      </div>
    </div>
    
    <div class="card" style="margin-top: 2rem;">
      <h2>Final Population Results</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Strategy</th>
            <th>Fitness</th>
            <th>NDCG@10</th>
            <th>Recall@10</th>
            <th>MRR@10</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          ${report.finalResults.slice(0, 10).map((r, i) => `
          <tr>
            <td class="${i < 3 ? `rank-${i + 1}` : ''}">#${i + 1}</td>
            <td style="font-family: monospace; font-size: 0.85rem;">${r.genome.name}</td>
            <td><strong>${r.genome.fitness?.toFixed(4)}</strong></td>
            <td>${r.metrics.ndcg10.toFixed(4)}</td>
            <td>${r.metrics.recall10.toFixed(4)}</td>
            <td>${r.metrics.mrr10.toFixed(4)}</td>
            <td>${r.latency}ms</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    
    <footer>
      <p>Generated by EmbedEval - Self-Evolving Embedding Researcher</p>
      <p style="margin-top: 0.5rem;">
        <a href="https://github.com/Algiras/embedeval" style="color: var(--primary);">GitHub</a>
      </p>
    </footer>
  </div>
  
  <script>
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(report.generations.map(g => `Gen ${g.generation}`))},
        datasets: [
          {
            label: 'Best Fitness',
            data: ${JSON.stringify(report.generations.map(g => g.bestFitness))},
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Average Fitness',
            data: ${JSON.stringify(report.generations.map(g => g.avgFitness))},
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            fill: true,
            tension: 0.3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8' }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
          },
          x: {
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });
  </script>
</body>
</html>`;

  const outputPath = path.join(__dirname, '../docs/evolution-results.html');
  await fs.writeFile(outputPath, html);
  console.log(`\n📄 Report generated: ${outputPath}`);
  
  // Also save JSON data
  const jsonPath = path.join(__dirname, '../docs/evolution-results.json');
  await fs.writeJson(jsonPath, report, { spaces: 2 });
  console.log(`📊 Data saved: ${jsonPath}`);
}

// Run
async function main() {
  try {
    const report = await runEvolution();
    await generateReport(report);
    console.log('\n✅ Evolution complete! Check docs/evolution-results.html');
  } catch (error) {
    console.error('❌ Evolution failed:', error);
    process.exit(1);
  }
}

main();
