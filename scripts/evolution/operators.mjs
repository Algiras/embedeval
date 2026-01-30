/**
 * Genetic Operators
 * 
 * Mutation, crossover, and selection operators for strategy genomes.
 */

import crypto from 'crypto';
import { 
  StrategyGenome, 
  PIPELINE_STAGES, 
  EMBEDDING_PROVIDERS,
  RERANKER_MODELS,
  QUERY_EXPANDERS,
  CHUNKING_STRATEGIES,
  FUSION_METHODS,
} from './genome.mjs';

// ============================================================================
// MUTATION OPERATORS
// ============================================================================

/**
 * Mutate a genome with various mutation types
 */
export function mutate(genome, options = {}) {
  const {
    mutationRate = 0.2,
    pipelineMutationRate = 0.15,
    parameterMutationRate = 0.25,
  } = options;
  
  const mutated = genome.clone();
  mutated.generation = genome.generation + 1;
  
  // Pipeline mutations
  if (Math.random() < pipelineMutationRate) {
    mutatePipeline(mutated);
  }
  
  // Gene mutations
  if (Math.random() < mutationRate) {
    mutateEmbedding(mutated);
  }
  
  if (Math.random() < mutationRate) {
    mutateQueryExpansion(mutated);
  }
  
  if (Math.random() < mutationRate) {
    mutateRetrieval(mutated);
  }
  
  if (Math.random() < mutationRate) {
    mutateReranking(mutated);
  }
  
  if (Math.random() < parameterMutationRate) {
    mutateParameters(mutated);
  }
  
  return mutated;
}

/**
 * Mutate the pipeline structure
 */
function mutatePipeline(genome) {
  const mutationType = Math.random();
  
  if (mutationType < 0.25 && genome.pipeline.length > 1) {
    // Remove a random stage (but keep at least one retrieval)
    const retrievalStages = genome.pipeline.filter(s => s.includes('retrieve'));
    if (retrievalStages.length > 1 || !genome.pipeline[genome.pipeline.length - 1].includes('retrieve')) {
      const idx = Math.floor(Math.random() * genome.pipeline.length);
      if (!genome.pipeline[idx].includes('retrieve') || retrievalStages.length > 1) {
        genome.pipeline.splice(idx, 1);
      }
    }
  } else if (mutationType < 0.5) {
    // Add a new stage
    const possibleStages = [
      'rerank_mmr', 'rerank_ce', 
      'filter_diversity', 'filter_threshold',
      'query_expand_syn',
    ];
    const newStage = possibleStages[Math.floor(Math.random() * possibleStages.length)];
    
    // Find appropriate position
    if (newStage.includes('query')) {
      genome.pipeline.unshift(newStage);
    } else if (newStage.includes('rerank') || newStage.includes('filter')) {
      genome.pipeline.push(newStage);
    } else {
      const pos = Math.floor(Math.random() * genome.pipeline.length);
      genome.pipeline.splice(pos, 0, newStage);
    }
  } else if (mutationType < 0.75 && genome.pipeline.length >= 2) {
    // Swap two stages
    const i = Math.floor(Math.random() * genome.pipeline.length);
    let j = Math.floor(Math.random() * genome.pipeline.length);
    while (j === i) j = Math.floor(Math.random() * genome.pipeline.length);
    [genome.pipeline[i], genome.pipeline[j]] = [genome.pipeline[j], genome.pipeline[i]];
  } else {
    // Replace a stage
    const idx = Math.floor(Math.random() * genome.pipeline.length);
    const currentStage = genome.pipeline[idx];
    
    let replacements;
    if (currentStage.includes('retrieve')) {
      replacements = ['embed_retrieve', 'bm25_retrieve', 'hybrid_retrieve'];
    } else if (currentStage.includes('rerank')) {
      replacements = ['rerank_mmr', 'rerank_ce', 'rerank_llm'];
    } else if (currentStage.includes('query')) {
      replacements = ['query_expand_llm', 'query_expand_syn', 'query_rewrite_llm'];
    } else if (currentStage.includes('fusion')) {
      replacements = ['fusion_rrf', 'fusion_weighted'];
    } else {
      replacements = ['filter_diversity', 'filter_threshold', 'filter_dedup'];
    }
    
    genome.pipeline[idx] = replacements[Math.floor(Math.random() * replacements.length)];
  }
}

/**
 * Mutate embedding configuration
 */
function mutateEmbedding(genome) {
  const providers = Object.keys(EMBEDDING_PROVIDERS);
  genome.genes.primaryEmbedding = providers[Math.floor(Math.random() * providers.length)];
  
  // 20% chance to add/remove secondary embedding
  if (Math.random() < 0.2) {
    genome.genes.secondaryEmbedding = genome.genes.secondaryEmbedding 
      ? null 
      : providers[Math.floor(Math.random() * providers.length)];
  }
}

/**
 * Mutate query expansion
 */
function mutateQueryExpansion(genome) {
  const expanders = Object.keys(QUERY_EXPANDERS);
  genome.genes.queryExpander = expanders[Math.floor(Math.random() * expanders.length)];
  
  if (genome.genes.queryExpander !== 'NONE') {
    genome.genes.queryExpandCount = Math.floor(Math.random() * 5) + 1;
    
    // Update pipeline if needed
    if (!genome.pipeline.some(s => s.includes('query'))) {
      genome.pipeline.unshift('query_expand_llm');
    }
  }
}

/**
 * Mutate retrieval configuration
 */
function mutateRetrieval(genome) {
  const mutationType = Math.random();
  
  if (mutationType < 0.33) {
    // Change retrieval method
    const methods = ['embed_retrieve', 'bm25_retrieve', 'hybrid_retrieve'];
    const currentIdx = genome.pipeline.findIndex(s => s.includes('retrieve'));
    if (currentIdx !== -1) {
      genome.pipeline[currentIdx] = methods[Math.floor(Math.random() * methods.length)];
    }
  } else if (mutationType < 0.66) {
    // Toggle multi-stage retrieval
    genome.genes.useMultiStage = !genome.genes.useMultiStage;
    if (genome.genes.useMultiStage) {
      genome.genes.stage1K = [500, 1000, 2000][Math.floor(Math.random() * 3)];
      genome.genes.stage1Method = Math.random() < 0.5 ? 'bm25' : 'embed';
    }
  } else {
    // Change fusion method
    const fusions = Object.keys(FUSION_METHODS);
    genome.genes.fusionMethod = fusions[Math.floor(Math.random() * fusions.length)];
    genome.genes.hybridAlpha = Math.random();
  }
}

/**
 * Mutate reranking configuration
 */
function mutateReranking(genome) {
  const rerankers = Object.keys(RERANKER_MODELS);
  genome.genes.reranker = rerankers[Math.floor(Math.random() * rerankers.length)];
  
  if (genome.genes.reranker !== 'NONE') {
    genome.genes.rerankK = [20, 50, 100, 200][Math.floor(Math.random() * 4)];
    
    // Ensure reranking stage in pipeline
    if (!genome.pipeline.some(s => s.includes('rerank'))) {
      genome.pipeline.push('rerank_ce');
    }
  }
}

/**
 * Mutate numerical parameters
 */
function mutateParameters(genome) {
  // Gaussian mutation for numerical parameters
  const gaussianMutate = (value, stdDev, min, max) => {
    const delta = (Math.random() - 0.5) * 2 * stdDev;
    return Math.max(min, Math.min(max, value + delta));
  };
  
  // K values
  genome.genes.initialK = Math.round(gaussianMutate(genome.genes.initialK, 50, 10, 1000));
  genome.genes.finalK = Math.round(gaussianMutate(genome.genes.finalK, 5, 1, 100));
  genome.genes.rerankK = Math.round(gaussianMutate(genome.genes.rerankK, 20, 10, 500));
  
  // BM25 parameters
  genome.genes.bm25K1 = gaussianMutate(genome.genes.bm25K1, 0.3, 0.5, 3.0);
  genome.genes.bm25B = gaussianMutate(genome.genes.bm25B, 0.1, 0.0, 1.0);
  
  // Weights and thresholds
  genome.genes.hybridAlpha = gaussianMutate(genome.genes.hybridAlpha, 0.1, 0.0, 1.0);
  genome.genes.mmrLambda = gaussianMutate(genome.genes.mmrLambda, 0.1, 0.0, 1.0);
  genome.genes.scoreThreshold = gaussianMutate(genome.genes.scoreThreshold, 0.05, 0.0, 0.5);
  genome.genes.diversityThreshold = gaussianMutate(genome.genes.diversityThreshold, 0.1, 0.3, 1.0);
  
  // Ensure finalK <= initialK
  if (genome.genes.finalK > genome.genes.initialK) {
    genome.genes.finalK = genome.genes.initialK;
  }
}

// ============================================================================
// CROSSOVER OPERATORS
// ============================================================================

/**
 * Uniform crossover - each gene randomly from either parent
 */
export function uniformCrossover(parent1, parent2) {
  const child = new StrategyGenome({
    generation: Math.max(parent1.generation, parent2.generation) + 1,
    parentIds: [parent1.id, parent2.id],
  });
  
  // Pipeline crossover - take structure from one parent
  child.pipeline = Math.random() < 0.5 
    ? [...parent1.pipeline] 
    : [...parent2.pipeline];
  
  // Gene crossover - each gene randomly from either parent
  const genes1 = parent1.genes;
  const genes2 = parent2.genes;
  
  for (const key of Object.keys(genes1)) {
    child.genes[key] = Math.random() < 0.5 ? genes1[key] : genes2[key];
  }
  
  return child;
}

/**
 * Single-point crossover for pipeline
 */
export function singlePointCrossover(parent1, parent2) {
  const child = new StrategyGenome({
    generation: Math.max(parent1.generation, parent2.generation) + 1,
    parentIds: [parent1.id, parent2.id],
  });
  
  // Pipeline single-point crossover
  const minLen = Math.min(parent1.pipeline.length, parent2.pipeline.length);
  const crossPoint = Math.floor(Math.random() * minLen);
  
  child.pipeline = [
    ...parent1.pipeline.slice(0, crossPoint),
    ...parent2.pipeline.slice(crossPoint),
  ];
  
  // Gene crossover based on groups
  const groups = {
    embedding: ['primaryEmbedding', 'secondaryEmbedding', 'embeddingDimReduction'],
    query: ['queryExpander', 'queryExpandCount'],
    retrieval: ['initialK', 'finalK', 'bm25K1', 'bm25B', 'useMultiStage', 'stage1Method', 'stage1K'],
    fusion: ['fusionMethod', 'hybridAlpha'],
    reranking: ['reranker', 'rerankK', 'mmrLambda'],
    filtering: ['scoreThreshold', 'diversityThreshold', 'chunking'],
  };
  
  for (const [groupName, keys] of Object.entries(groups)) {
    const sourceParent = Math.random() < 0.5 ? parent1 : parent2;
    for (const key of keys) {
      child.genes[key] = sourceParent.genes[key];
    }
  }
  
  return child;
}

/**
 * Blend crossover for numerical parameters
 */
export function blendCrossover(parent1, parent2, alpha = 0.5) {
  const child = uniformCrossover(parent1, parent2);
  
  // Blend numerical genes
  const numericalGenes = [
    'initialK', 'finalK', 'rerankK', 'stage1K',
    'bm25K1', 'bm25B', 'hybridAlpha', 'mmrLambda',
    'scoreThreshold', 'diversityThreshold', 'queryExpandCount',
  ];
  
  for (const key of numericalGenes) {
    const v1 = parent1.genes[key];
    const v2 = parent2.genes[key];
    
    if (typeof v1 === 'number' && typeof v2 === 'number') {
      const range = Math.abs(v2 - v1);
      const min = Math.min(v1, v2) - alpha * range;
      const max = Math.max(v1, v2) + alpha * range;
      child.genes[key] = min + Math.random() * (max - min);
      
      // Round integer parameters
      if (['initialK', 'finalK', 'rerankK', 'stage1K', 'queryExpandCount'].includes(key)) {
        child.genes[key] = Math.round(child.genes[key]);
      }
    }
  }
  
  return child;
}

// ============================================================================
// SELECTION OPERATORS
// ============================================================================

/**
 * Tournament selection
 */
export function tournamentSelect(population, fitnessKey = 'overall', tournamentSize = 3) {
  const tournament = [];
  
  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    tournament.push(population[idx]);
  }
  
  tournament.sort((a, b) => {
    const fa = a.fitness?.[fitnessKey] ?? 0;
    const fb = b.fitness?.[fitnessKey] ?? 0;
    return fb - fa;
  });
  
  return tournament[0];
}

/**
 * Roulette wheel selection (fitness proportionate)
 */
export function rouletteSelect(population, fitnessKey = 'overall') {
  const totalFitness = population.reduce((sum, g) => sum + (g.fitness?.[fitnessKey] ?? 0), 0);
  
  if (totalFitness === 0) {
    return population[Math.floor(Math.random() * population.length)];
  }
  
  let random = Math.random() * totalFitness;
  
  for (const genome of population) {
    random -= (genome.fitness?.[fitnessKey] ?? 0);
    if (random <= 0) return genome;
  }
  
  return population[population.length - 1];
}

/**
 * Rank-based selection
 */
export function rankSelect(population, fitnessKey = 'overall') {
  const sorted = [...population].sort((a, b) => {
    const fa = a.fitness?.[fitnessKey] ?? 0;
    const fb = b.fitness?.[fitnessKey] ?? 0;
    return fb - fa;
  });
  
  // Assign ranks (higher rank = better)
  const n = sorted.length;
  const totalRank = (n * (n + 1)) / 2;
  
  let random = Math.random() * totalRank;
  
  for (let i = 0; i < n; i++) {
    random -= (n - i); // Higher ranked genomes have higher probability
    if (random <= 0) return sorted[i];
  }
  
  return sorted[n - 1];
}

/**
 * NSGA-II style selection for multi-objective optimization
 */
export function nsgaSelect(population, fitnessKeys = ['correctness', 'speed', 'cost']) {
  // Calculate Pareto fronts
  const fronts = calculateParetoFronts(population, fitnessKeys);
  
  // Select from fronts, preferring earlier fronts
  let selected = [];
  let frontIdx = 0;
  
  while (selected.length < 2 && frontIdx < fronts.length) {
    const front = fronts[frontIdx];
    
    if (selected.length + front.length <= 2) {
      selected = selected.concat(front);
    } else {
      // Calculate crowding distance and select
      const remaining = 2 - selected.length;
      const withCrowding = calculateCrowdingDistance(front, fitnessKeys);
      withCrowding.sort((a, b) => b.crowding - a.crowding);
      selected = selected.concat(withCrowding.slice(0, remaining).map(w => w.genome));
    }
    
    frontIdx++;
  }
  
  return selected.length > 0 ? selected[0] : population[0];
}

/**
 * Calculate Pareto fronts
 */
function calculateParetoFronts(population, fitnessKeys) {
  const dominated = new Set();
  const fronts = [[]];
  
  for (let i = 0; i < population.length; i++) {
    for (let j = 0; j < population.length; j++) {
      if (i === j) continue;
      if (dominates(population[j], population[i], fitnessKeys)) {
        dominated.add(i);
        break;
      }
    }
    
    if (!dominated.has(i)) {
      fronts[0].push(population[i]);
    }
  }
  
  // Build remaining fronts (simplified)
  const remaining = population.filter((_, i) => dominated.has(i));
  if (remaining.length > 0) {
    fronts.push(remaining);
  }
  
  return fronts;
}

/**
 * Check if genome a dominates genome b
 */
function dominates(a, b, fitnessKeys) {
  let dominated = true;
  let strictlyBetter = false;
  
  for (const key of fitnessKeys) {
    const fa = a.fitness?.[key] ?? 0;
    const fb = b.fitness?.[key] ?? 0;
    
    if (fa < fb) dominated = false;
    if (fa > fb) strictlyBetter = true;
  }
  
  return dominated && strictlyBetter;
}

/**
 * Calculate crowding distance for diversity preservation
 */
function calculateCrowdingDistance(front, fitnessKeys) {
  const withCrowding = front.map(g => ({ genome: g, crowding: 0 }));
  
  for (const key of fitnessKeys) {
    // Sort by this objective
    withCrowding.sort((a, b) => {
      const fa = a.genome.fitness?.[key] ?? 0;
      const fb = b.genome.fitness?.[key] ?? 0;
      return fa - fb;
    });
    
    // Boundary points get infinite distance
    withCrowding[0].crowding = Infinity;
    withCrowding[withCrowding.length - 1].crowding = Infinity;
    
    // Calculate distance for middle points
    const minF = withCrowding[0].genome.fitness?.[key] ?? 0;
    const maxF = withCrowding[withCrowding.length - 1].genome.fitness?.[key] ?? 0;
    const range = maxF - minF || 1;
    
    for (let i = 1; i < withCrowding.length - 1; i++) {
      const prev = withCrowding[i - 1].genome.fitness?.[key] ?? 0;
      const next = withCrowding[i + 1].genome.fitness?.[key] ?? 0;
      withCrowding[i].crowding += (next - prev) / range;
    }
  }
  
  return withCrowding;
}

// ============================================================================
// DIVERSITY OPERATORS
// ============================================================================

/**
 * Calculate genetic distance between two genomes
 */
export function geneticDistance(g1, g2) {
  let distance = 0;
  
  // Pipeline distance (Jaccard distance)
  const set1 = new Set(g1.pipeline);
  const set2 = new Set(g2.pipeline);
  const union = new Set([...set1, ...set2]);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  distance += 1 - (intersection.size / union.size);
  
  // Gene distance
  const categoricalGenes = [
    'primaryEmbedding', 'secondaryEmbedding', 'queryExpander',
    'chunking', 'fusionMethod', 'reranker', 'stage1Method',
  ];
  
  for (const key of categoricalGenes) {
    if (g1.genes[key] !== g2.genes[key]) distance += 0.1;
  }
  
  // Numerical gene distance (normalized)
  const numericalRanges = {
    initialK: [10, 1000],
    finalK: [1, 100],
    hybridAlpha: [0, 1],
    mmrLambda: [0, 1],
    bm25K1: [0.5, 3],
    bm25B: [0, 1],
  };
  
  for (const [key, [min, max]] of Object.entries(numericalRanges)) {
    const v1 = (g1.genes[key] - min) / (max - min);
    const v2 = (g2.genes[key] - min) / (max - min);
    distance += Math.abs(v1 - v2) * 0.05;
  }
  
  return distance;
}

/**
 * Calculate population diversity
 */
export function calculateDiversity(population) {
  if (population.length < 2) return 0;
  
  let totalDistance = 0;
  let count = 0;
  
  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      totalDistance += geneticDistance(population[i], population[j]);
      count++;
    }
  }
  
  return totalDistance / count;
}

/**
 * Apply diversity pressure - penalize similar genomes
 */
export function applyDiversityPressure(population, threshold = 0.1) {
  const penalties = new Map();
  
  for (let i = 0; i < population.length; i++) {
    let penalty = 0;
    
    for (let j = 0; j < population.length; j++) {
      if (i === j) continue;
      
      const distance = geneticDistance(population[i], population[j]);
      if (distance < threshold) {
        penalty += (threshold - distance) / threshold;
      }
    }
    
    penalties.set(population[i].id, penalty);
  }
  
  return penalties;
}

export default {
  mutate,
  uniformCrossover,
  singlePointCrossover,
  blendCrossover,
  tournamentSelect,
  rouletteSelect,
  rankSelect,
  nsgaSelect,
  geneticDistance,
  calculateDiversity,
  applyDiversityPressure,
};
