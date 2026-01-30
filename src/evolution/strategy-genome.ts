/**
 * Strategy Genome - Genetic representation of retrieval strategies
 * 
 * Represents strategies as evolvable genomes with:
 * - Genes for each configurable parameter
 * - Mutation operators for random changes
 * - Crossover operators for combining parents
 * - Fitness tracking
 * 
 * @module evolution/strategy-genome
 */

import { v4 as uuidv4 } from 'uuid';
import { StrategyGenome } from '../core/types';
import { logger } from '../utils/logger';

/**
 * Gene definitions with valid ranges and mutation strategies
 */
export const GENE_DEFINITIONS = {
  // Chunking genes
  chunkingMethod: {
    type: 'categorical' as const,
    values: ['none', 'fixed', 'semantic', 'sliding'] as const,
    default: 'none',
  },
  chunkSize: {
    type: 'numeric' as const,
    min: 128,
    max: 1024,
    step: 64,
    default: 512,
  },
  chunkOverlap: {
    type: 'numeric' as const,
    min: 0,
    max: 50,
    step: 10,
    default: 0,
  },
  
  // Retrieval genes
  retrievalMethod: {
    type: 'categorical' as const,
    values: ['cosine', 'bm25', 'hybrid'] as const,
    default: 'cosine',
  },
  retrievalK: {
    type: 'numeric' as const,
    min: 10,
    max: 100,
    step: 10,
    default: 10,
  },
  hybridEmbeddingWeight: {
    type: 'numeric' as const,
    min: 0.1,
    max: 0.9,
    step: 0.1,
    default: 0.5,
  },
  hybridBm25Weight: {
    type: 'numeric' as const,
    min: 0.1,
    max: 0.9,
    step: 0.1,
    default: 0.5,
  },
  
  // Reranking genes
  rerankingMethod: {
    type: 'categorical' as const,
    values: ['none', 'llm', 'mmr', 'cross-encoder'] as const,
    default: 'none',
  },
  rerankingTopK: {
    type: 'numeric' as const,
    min: 5,
    max: 20,
    step: 5,
    default: 10,
  },
  mmrLambda: {
    type: 'numeric' as const,
    min: 0.1,
    max: 0.9,
    step: 0.1,
    default: 0.5,
  },
};

/**
 * Create a random genome
 */
export function createRandomGenome(generation: number = 0): StrategyGenome {
  const genes = {
    chunkingMethod: randomCategorical(GENE_DEFINITIONS.chunkingMethod.values),
    chunkSize: randomNumeric(GENE_DEFINITIONS.chunkSize),
    chunkOverlap: randomNumeric(GENE_DEFINITIONS.chunkOverlap),
    retrievalMethod: randomCategorical(GENE_DEFINITIONS.retrievalMethod.values),
    retrievalK: randomNumeric(GENE_DEFINITIONS.retrievalK),
    hybridWeights: [
      randomNumeric(GENE_DEFINITIONS.hybridEmbeddingWeight),
      randomNumeric(GENE_DEFINITIONS.hybridBm25Weight),
    ] as [number, number],
    rerankingMethod: randomCategorical(GENE_DEFINITIONS.rerankingMethod.values),
    rerankingTopK: randomNumeric(GENE_DEFINITIONS.rerankingTopK),
    mmrLambda: randomNumeric(GENE_DEFINITIONS.mmrLambda),
  };

  // Normalize hybrid weights to sum to 1
  if (genes.retrievalMethod === 'hybrid') {
    const sum = genes.hybridWeights[0] + genes.hybridWeights[1];
    genes.hybridWeights = [
      genes.hybridWeights[0] / sum,
      genes.hybridWeights[1] / sum,
    ];
  }

  return {
    id: uuidv4(),
    name: generateGenomeName(genes),
    genes,
    generation,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create genome from predefined strategy
 */
export function createGenomeFromStrategy(strategyName: string, generation: number = 0): StrategyGenome {
  const presets: Record<string, Partial<StrategyGenome['genes']>> = {
    'baseline': {
      chunkingMethod: 'none',
      retrievalMethod: 'cosine',
      retrievalK: 10,
      rerankingMethod: 'none',
    },
    'fixed-chunks': {
      chunkingMethod: 'fixed',
      chunkSize: 512,
      chunkOverlap: 50,
      retrievalMethod: 'cosine',
      retrievalK: 10,
      rerankingMethod: 'none',
    },
    'semantic-chunks': {
      chunkingMethod: 'semantic',
      chunkSize: 512,
      chunkOverlap: 50,
      retrievalMethod: 'cosine',
      retrievalK: 10,
      rerankingMethod: 'none',
    },
    'hybrid-bm25': {
      chunkingMethod: 'none',
      retrievalMethod: 'hybrid',
      retrievalK: 100,
      hybridWeights: [0.6, 0.4],
      rerankingMethod: 'none',
    },
    'llm-reranked': {
      chunkingMethod: 'none',
      retrievalMethod: 'cosine',
      retrievalK: 50,
      rerankingMethod: 'llm',
      rerankingTopK: 10,
    },
    'mmr-diversity': {
      chunkingMethod: 'none',
      retrievalMethod: 'cosine',
      retrievalK: 50,
      rerankingMethod: 'mmr',
      rerankingTopK: 10,
      mmrLambda: 0.5,
    },
    'full-pipeline': {
      chunkingMethod: 'semantic',
      chunkSize: 512,
      chunkOverlap: 50,
      retrievalMethod: 'hybrid',
      retrievalK: 100,
      hybridWeights: [0.6, 0.4],
      rerankingMethod: 'llm',
      rerankingTopK: 10,
    },
  };

  const preset = presets[strategyName] || presets['baseline'];
  
  const genes: StrategyGenome['genes'] = {
    chunkingMethod: preset.chunkingMethod || 'none',
    chunkSize: preset.chunkSize,
    chunkOverlap: preset.chunkOverlap,
    retrievalMethod: preset.retrievalMethod || 'cosine',
    retrievalK: preset.retrievalK || 10,
    hybridWeights: preset.hybridWeights,
    rerankingMethod: preset.rerankingMethod || 'none',
    rerankingTopK: preset.rerankingTopK,
    mmrLambda: preset.mmrLambda,
  };

  return {
    id: uuidv4(),
    name: strategyName,
    genes,
    generation,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Mutate a genome
 */
export function mutate(genome: StrategyGenome, mutationRate: number = 0.2): StrategyGenome {
  const mutated: StrategyGenome = {
    ...genome,
    id: uuidv4(),
    genes: { ...genome.genes },
    generation: genome.generation + 1,
    parents: undefined,
    mutations: [],
    fitness: undefined,
    createdAt: new Date().toISOString(),
  };

  const mutations: string[] = [];

  // Mutate each gene with probability = mutationRate
  if (Math.random() < mutationRate) {
    mutated.genes.chunkingMethod = mutateGene(
      mutated.genes.chunkingMethod,
      GENE_DEFINITIONS.chunkingMethod
    );
    mutations.push('chunkingMethod');
  }

  if (mutated.genes.chunkingMethod !== 'none' && Math.random() < mutationRate) {
    mutated.genes.chunkSize = mutateGene(
      mutated.genes.chunkSize || 512,
      GENE_DEFINITIONS.chunkSize
    );
    mutations.push('chunkSize');
  }

  if (mutated.genes.chunkingMethod !== 'none' && Math.random() < mutationRate) {
    mutated.genes.chunkOverlap = mutateGene(
      mutated.genes.chunkOverlap || 0,
      GENE_DEFINITIONS.chunkOverlap
    );
    mutations.push('chunkOverlap');
  }

  if (Math.random() < mutationRate) {
    mutated.genes.retrievalMethod = mutateGene(
      mutated.genes.retrievalMethod,
      GENE_DEFINITIONS.retrievalMethod
    );
    mutations.push('retrievalMethod');
  }

  if (Math.random() < mutationRate) {
    mutated.genes.retrievalK = mutateGene(
      mutated.genes.retrievalK,
      GENE_DEFINITIONS.retrievalK
    );
    mutations.push('retrievalK');
  }

  if (mutated.genes.retrievalMethod === 'hybrid' && Math.random() < mutationRate) {
    const newWeight = mutateGene(
      mutated.genes.hybridWeights?.[0] || 0.5,
      GENE_DEFINITIONS.hybridEmbeddingWeight
    );
    mutated.genes.hybridWeights = [newWeight, 1 - newWeight];
    mutations.push('hybridWeights');
  }

  if (Math.random() < mutationRate) {
    mutated.genes.rerankingMethod = mutateGene(
      mutated.genes.rerankingMethod,
      GENE_DEFINITIONS.rerankingMethod
    );
    mutations.push('rerankingMethod');
  }

  if (mutated.genes.rerankingMethod !== 'none' && Math.random() < mutationRate) {
    mutated.genes.rerankingTopK = mutateGene(
      mutated.genes.rerankingTopK || 10,
      GENE_DEFINITIONS.rerankingTopK
    );
    mutations.push('rerankingTopK');
  }

  if (mutated.genes.rerankingMethod === 'mmr' && Math.random() < mutationRate) {
    mutated.genes.mmrLambda = mutateGene(
      mutated.genes.mmrLambda || 0.5,
      GENE_DEFINITIONS.mmrLambda
    );
    mutations.push('mmrLambda');
  }

  mutated.mutations = mutations;
  mutated.name = generateGenomeName(mutated.genes);

  if (mutations.length > 0) {
    logger.debug(`Mutated genome: ${mutations.join(', ')}`);
  }

  return mutated;
}

/**
 * Crossover two parent genomes
 */
export function crossover(parent1: StrategyGenome, parent2: StrategyGenome): [StrategyGenome, StrategyGenome] {
  const child1Genes: StrategyGenome['genes'] = { ...parent1.genes };
  const child2Genes: StrategyGenome['genes'] = { ...parent2.genes };

  // Uniform crossover - randomly swap each gene
  const geneKeys = [
    'chunkingMethod', 'chunkSize', 'chunkOverlap',
    'retrievalMethod', 'retrievalK', 'hybridWeights',
    'rerankingMethod', 'rerankingTopK', 'mmrLambda'
  ] as const;

  for (const key of geneKeys) {
    if (Math.random() < 0.5) {
      const temp = (child1Genes as any)[key];
      (child1Genes as any)[key] = (child2Genes as any)[key];
      (child2Genes as any)[key] = temp;
    }
  }

  const generation = Math.max(parent1.generation, parent2.generation) + 1;

  const child1: StrategyGenome = {
    id: uuidv4(),
    name: generateGenomeName(child1Genes),
    genes: child1Genes,
    generation,
    parents: [parent1.id, parent2.id],
    createdAt: new Date().toISOString(),
  };

  const child2: StrategyGenome = {
    id: uuidv4(),
    name: generateGenomeName(child2Genes),
    genes: child2Genes,
    generation,
    parents: [parent1.id, parent2.id],
    createdAt: new Date().toISOString(),
  };

  logger.debug(`Crossover: ${parent1.name} x ${parent2.name} -> ${child1.name}, ${child2.name}`);

  return [child1, child2];
}

/**
 * Convert genome to strategy configuration
 */
export function genomeToStrategy(genome: StrategyGenome): {
  name: string;
  stages: Array<{ type: string; name: string; config: any; enabled: boolean }>;
} {
  const stages: Array<{ type: string; name: string; config: any; enabled: boolean }> = [];

  // Add chunking stage if enabled
  if (genome.genes.chunkingMethod !== 'none') {
    stages.push({
      type: 'chunking',
      name: genome.genes.chunkingMethod,
      config: {
        size: genome.genes.chunkSize || 512,
        overlap: genome.genes.chunkOverlap || 0,
      },
      enabled: true,
    });
  }

  // Add BM25 if hybrid
  if (genome.genes.retrievalMethod === 'bm25' || genome.genes.retrievalMethod === 'hybrid') {
    stages.push({
      type: 'bm25',
      name: 'bm25',
      config: {
        k: genome.genes.retrievalK,
        k1: 1.2,
        b: 0.75,
      },
      enabled: true,
    });
  }

  // Add embedding stage
  stages.push({
    type: 'embedding',
    name: 'embedding',
    config: {},
    enabled: true,
  });

  // Add retrieval stage
  if (genome.genes.retrievalMethod !== 'bm25') {
    stages.push({
      type: 'retrieval',
      name: 'retrieval',
      config: {
        k: genome.genes.retrievalK,
        metric: 'cosine',
      },
      enabled: true,
    });
  }

  // Add fusion if hybrid
  if (genome.genes.retrievalMethod === 'hybrid') {
    stages.push({
      type: 'fusion',
      name: 'rrf',
      config: {
        k: 60,
        topK: genome.genes.rerankingMethod === 'none' ? 10 : genome.genes.rerankingTopK || 20,
        weights: genome.genes.hybridWeights,
      },
      enabled: true,
    });
  }

  // Add reranking stage if enabled
  if (genome.genes.rerankingMethod !== 'none') {
    stages.push({
      type: 'reranking',
      name: genome.genes.rerankingMethod,
      config: {
        topK: genome.genes.rerankingTopK || 10,
        lambda: genome.genes.mmrLambda,
      },
      enabled: true,
    });
  }

  return {
    name: genome.name,
    stages,
  };
}

/**
 * Calculate genetic distance between two genomes
 */
export function geneticDistance(g1: StrategyGenome, g2: StrategyGenome): number {
  let distance = 0;
  let comparisons = 0;

  // Categorical genes - 0 if same, 1 if different
  if (g1.genes.chunkingMethod !== g2.genes.chunkingMethod) distance += 1;
  if (g1.genes.retrievalMethod !== g2.genes.retrievalMethod) distance += 1;
  if (g1.genes.rerankingMethod !== g2.genes.rerankingMethod) distance += 1;
  comparisons += 3;

  // Numeric genes - normalized difference
  const numericGenes = [
    ['chunkSize', GENE_DEFINITIONS.chunkSize],
    ['chunkOverlap', GENE_DEFINITIONS.chunkOverlap],
    ['retrievalK', GENE_DEFINITIONS.retrievalK],
    ['rerankingTopK', GENE_DEFINITIONS.rerankingTopK],
    ['mmrLambda', GENE_DEFINITIONS.mmrLambda],
  ] as const;

  for (const [key, def] of numericGenes) {
    const v1 = (g1.genes as any)[key] || (def as any).default;
    const v2 = (g2.genes as any)[key] || (def as any).default;
    const range = (def as any).max - (def as any).min;
    distance += Math.abs(v1 - v2) / range;
    comparisons++;
  }

  return distance / comparisons;
}

/**
 * Calculate population diversity
 */
export function calculateDiversity(population: StrategyGenome[]): number {
  if (population.length < 2) return 0;

  let totalDistance = 0;
  let comparisons = 0;

  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      totalDistance += geneticDistance(population[i], population[j]);
      comparisons++;
    }
  }

  return totalDistance / comparisons;
}

// ============================================================================
// Helper Functions
// ============================================================================

function randomCategorical<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function randomNumeric(def: { min: number; max: number; step: number }): number {
  const steps = Math.floor((def.max - def.min) / def.step);
  const randomSteps = Math.floor(Math.random() * (steps + 1));
  return def.min + randomSteps * def.step;
}

function mutateGene<T>(value: T, def: any): T {
  if (def.type === 'categorical') {
    // Pick a different value
    const others = def.values.filter((v: T) => v !== value);
    return others[Math.floor(Math.random() * others.length)];
  } else {
    // Gaussian mutation
    const sigma = (def.max - def.min) * 0.2;  // 20% of range
    const mutated = (value as number) + gaussianRandom() * sigma;
    // Clamp and snap to step
    const clamped = Math.max(def.min, Math.min(def.max, mutated));
    const snapped = Math.round((clamped - def.min) / def.step) * def.step + def.min;
    return snapped as T;
  }
}

function gaussianRandom(): number {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateGenomeName(genes: StrategyGenome['genes']): string {
  const parts: string[] = [];
  
  if (genes.chunkingMethod !== 'none') {
    parts.push(`${genes.chunkingMethod}-${genes.chunkSize}`);
  }
  
  parts.push(genes.retrievalMethod);
  
  if (genes.retrievalMethod === 'hybrid' && genes.hybridWeights) {
    parts.push(`w${(genes.hybridWeights[0] * 100).toFixed(0)}`);
  }
  
  if (genes.rerankingMethod !== 'none') {
    parts.push(genes.rerankingMethod);
    if (genes.rerankingMethod === 'mmr') {
      parts.push(`λ${(genes.mmrLambda || 0.5).toFixed(1)}`);
    }
  }
  
  return parts.join('-') || 'baseline';
}
