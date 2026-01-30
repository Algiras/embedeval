/**
 * Adaptive Evolution Engine
 * 
 * Evolves different strategies for different data types:
 * - Learns which strategies work best for which query/document types
 * - Supports conditional strategy routing
 * - Builds a portfolio of optimized strategies per data profile
 * 
 * @module evolution/adaptive-evolution
 */

import { v4 as uuidv4 } from 'uuid';
import {
  StrategyGenes,
  DataTypeProfile,
  AdvancedGenomeFactory,
  mutateAdvanced,
} from './advanced-genome';
import { TestCase, Document } from '../core/types';
import { logger } from '../utils/logger';

// ============================================================================
// DATA TYPE CLASSIFICATION
// ============================================================================

/**
 * Query type classifier - determines what kind of query this is
 */
export class QueryClassifier {
  /**
   * Classify a query into a type
   */
  static classify(query: string): DataTypeProfile['queryType'] {
    const lower = query.toLowerCase();
    
    // Code queries
    if (/\b(function|class|method|code|implement|bug|error|exception|api|import|export)\b/.test(lower)) {
      return 'code';
    }
    
    // Procedural queries (how to)
    if (/^(how|what steps|how do|how can|how to)\b/.test(lower)) {
      return 'procedural';
    }
    
    // Analytical queries (why, compare, analyze)
    if (/^(why|compare|analyze|what is the difference|explain why|what causes)\b/.test(lower)) {
      return 'analytical';
    }
    
    // Creative queries
    if (/\b(create|design|suggest|recommend|brainstorm|ideas for)\b/.test(lower)) {
      return 'creative';
    }
    
    // Conversational
    if (/^(what do you think|can you|would you|tell me)\b/.test(lower)) {
      return 'conversational';
    }
    
    // Default to factual
    return 'factual';
  }
  
  /**
   * Estimate query complexity
   */
  static estimateComplexity(query: string): DataTypeProfile['complexity'] {
    const words = query.split(/\s+/).length;
    const hasMultipleParts = /\b(and|or|also|additionally|furthermore)\b/.test(query.toLowerCase());
    const hasConditional = /\b(if|when|unless|provided|assuming)\b/.test(query.toLowerCase());
    
    if (words > 30 || (hasMultipleParts && hasConditional)) {
      return 'complex';
    }
    if (words > 15 || hasMultipleParts || hasConditional) {
      return 'moderate';
    }
    return 'simple';
  }
  
  /**
   * Full profile classification
   */
  static getProfile(query: string, document?: Document): DataTypeProfile {
    return {
      queryType: this.classify(query),
      documentType: document ? this.classifyDocument(document.content) : 'mixed',
      complexity: this.estimateComplexity(query),
    };
  }
  
  /**
   * Classify document type
   */
  static classifyDocument(content: string): DataTypeProfile['documentType'] {
    const lower = content.toLowerCase();
    
    // Code
    if (/\b(function|class|def |import |export |const |let |var )\b/.test(content)) {
      return 'code';
    }
    
    // Structured (tables, lists, JSON-like)
    if (/(\|.*\||\d\.\s|-\s\[|\{.*:.*\})/.test(content)) {
      return 'structured';
    }
    
    // Technical (contains technical terms)
    if (/\b(algorithm|implementation|architecture|system|component|module|interface)\b/.test(lower)) {
      return 'technical';
    }
    
    // Narrative (story-like, first person)
    if (/\b(I |we |story|chapter|once upon|journey|experience)\b/.test(content)) {
      return 'narrative';
    }
    
    return 'mixed';
  }
}

// ============================================================================
// ADAPTIVE GENOME
// ============================================================================

/**
 * Adaptive Strategy Genome - Contains optimized strategies for each data type
 */
export interface AdaptiveGenome {
  id: string;
  name: string;
  version: string;
  
  // Strategy portfolio - one optimized strategy per query type
  strategyPortfolio: Map<DataTypeProfile['queryType'], StrategyGenes>;
  
  // Default fallback strategy
  defaultStrategy: StrategyGenes;
  
  // Router model (optional - for learned routing)
  routerEnabled: boolean;
  routerWeights?: Record<string, number>;
  
  // Fitness per type
  fitnessPerType: Map<DataTypeProfile['queryType'], number>;
  overallFitness?: number;
  
  // Evolution metadata
  generation: number;
  parentIds?: string[];
  createdAt: string;
}

/**
 * Create adaptive genome
 */
export function createAdaptiveGenome(
  generation: number = 0,
  options: { availableProviders?: string[] } = {}
): AdaptiveGenome {
  const { availableProviders = ['ollama'] } = options;
  
  const queryTypes: DataTypeProfile['queryType'][] = [
    'factual', 'analytical', 'procedural', 'conversational', 'code', 'creative'
  ];
  
  const portfolio = new Map<DataTypeProfile['queryType'], StrategyGenes>();
  
  // Create specialized strategies for each type
  for (const qType of queryTypes) {
    portfolio.set(qType, createOptimalStrategyForType(qType, availableProviders));
  }
  
  return {
    id: uuidv4(),
    name: `Adaptive-Gen${generation}`,
    version: '2.0',
    strategyPortfolio: portfolio,
    defaultStrategy: portfolio.get('factual')!,
    routerEnabled: true,
    fitnessPerType: new Map(),
    generation,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create optimal strategy for a query type based on research
 */
function createOptimalStrategyForType(
  queryType: DataTypeProfile['queryType'],
  availableProviders: string[]
): StrategyGenes {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  
  const base: StrategyGenes = {
    architecture: 'NAIVE',
    embeddingProvider: pick(availableProviders) as any,
    embeddingModel: 'nomic-embed-text',
    embeddingStrategy: 'DENSE_SINGLE',
    chunkingStrategy: 'NONE',
    queryStrategy: 'RAW',
    retrievalMethod: 'COSINE',
    retrievalK: 10,
    rerankingMethod: 'NONE',
    postProcessing: [],
  };
  
  // Customize based on query type
  switch (queryType) {
    case 'factual':
      // Factual: BM25 hybrid is good for fact lookup
      return {
        ...base,
        queryStrategy: 'EXPANDED',
        retrievalMethod: 'HYBRID_RRF',
        retrievalK: 10,
        rerankingMethod: 'NONE',
        postProcessing: ['SCORE_THRESHOLD'],
        scoreThreshold: 0.3,
      };
      
    case 'analytical':
      // Analytical: Need more context, multi-hop helps
      return {
        ...base,
        architecture: 'MULTI_HOP',
        queryStrategy: 'DECOMPOSED',
        chunkingStrategy: 'SEMANTIC',
        chunkSize: 1024,
        retrievalMethod: 'COSINE',
        retrievalK: 20,
        rerankingMethod: 'LLM_LISTWISE',
        maxHops: 2,
        postProcessing: ['CONTEXT_EXPANSION'],
      };
      
    case 'procedural':
      // Procedural: Step by step, needs structure
      return {
        ...base,
        queryStrategy: 'STEP_BACK',
        chunkingStrategy: 'PARAGRAPH',
        retrievalMethod: 'HYBRID_LINEAR',
        retrievalK: 15,
        hybridAlpha: 0.6,
        rerankingMethod: 'POSITIONAL',
        postProcessing: ['REORDER'],
      };
      
    case 'code':
      // Code: Needs exact matching + semantic
      return {
        ...base,
        queryStrategy: 'RAW',
        chunkingStrategy: 'CODE_FUNCTIONS',
        retrievalMethod: 'HYBRID_RRF',
        retrievalK: 20,
        rerankingMethod: 'CROSS_ENCODER',
        rerankingTopK: 10,
        postProcessing: ['SCORE_THRESHOLD'],
        scoreThreshold: 0.4,
      };
      
    case 'conversational':
      // Conversational: Context matters, diversity helps
      return {
        ...base,
        queryStrategy: 'REWRITTEN',
        chunkingStrategy: 'SENTENCE',
        retrievalMethod: 'COSINE',
        retrievalK: 15,
        rerankingMethod: 'MMR',
        mmrLambda: 0.6,
        postProcessing: [],
      };
      
    case 'creative':
      // Creative: Need diverse, broad results
      return {
        ...base,
        architecture: 'ADAPTIVE',
        queryStrategy: 'MULTI_QUERY',
        queryExpansionCount: 5,
        chunkingStrategy: 'SEMANTIC',
        retrievalMethod: 'HYBRID_RRF',
        retrievalK: 30,
        rerankingMethod: 'MMR',
        mmrLambda: 0.4, // More diversity
        postProcessing: ['DEDUPLICATION'],
      };
      
    default:
      return base;
  }
}

// ============================================================================
// ADAPTIVE EVOLUTION ENGINE
// ============================================================================

export interface AdaptiveEvolutionConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteCount: number;
  
  // Data type weights (how important is each type)
  typeWeights?: Record<DataTypeProfile['queryType'], number>;
  
  // Provider constraints
  availableProviders: string[];
  maxCostPerQuery?: number;
}

const DEFAULT_CONFIG: AdaptiveEvolutionConfig = {
  populationSize: 12,
  generations: 10,
  mutationRate: 0.25,
  crossoverRate: 0.7,
  eliteCount: 2,
  availableProviders: ['ollama'],
};

/**
 * Adaptive Evolution Engine
 */
export class AdaptiveEvolutionEngine {
  private config: AdaptiveEvolutionConfig;
  private population: AdaptiveGenome[] = [];
  private bestEver: AdaptiveGenome | null = null;
  
  constructor(config: Partial<AdaptiveEvolutionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Initialize population
   */
  async initialize(): Promise<void> {
    logger.info('Initializing adaptive population...');
    
    this.population = [];
    
    // Add baseline adaptive genomes
    for (let i = 0; i < Math.min(4, this.config.populationSize); i++) {
      this.population.push(createAdaptiveGenome(0, {
        availableProviders: this.config.availableProviders,
      }));
    }
    
    // Fill with random
    while (this.population.length < this.config.populationSize) {
      this.population.push(createAdaptiveGenome(0, {
        availableProviders: this.config.availableProviders,
      }));
    }
    
    logger.info(`Initialized ${this.population.length} adaptive genomes`);
  }
  
  /**
   * Evaluate a genome on test cases, grouped by query type
   */
  async evaluateGenome(
    genome: AdaptiveGenome,
    testCases: TestCase[],
    documents: Document[],
    evaluateFn: (strategy: StrategyGenes, cases: TestCase[], docs: Document[]) => Promise<number>
  ): Promise<void> {
    // Group test cases by query type
    const byType = new Map<DataTypeProfile['queryType'], TestCase[]>();
    
    for (const tc of testCases) {
      const qType = QueryClassifier.classify(tc.query);
      if (!byType.has(qType)) {
        byType.set(qType, []);
      }
      byType.get(qType)!.push(tc);
    }
    
    // Evaluate each type separately
    let totalFitness = 0;
    let totalWeight = 0;
    
    for (const [qType, cases] of byType) {
      if (cases.length === 0) continue;
      
      // Get strategy for this type
      const strategy = genome.strategyPortfolio.get(qType) || genome.defaultStrategy;
      
      // Evaluate
      const fitness = await evaluateFn(strategy, cases, documents);
      genome.fitnessPerType.set(qType, fitness);
      
      // Weight
      const weight = this.config.typeWeights?.[qType] || 1;
      totalFitness += fitness * weight * cases.length;
      totalWeight += weight * cases.length;
    }
    
    genome.overallFitness = totalWeight > 0 ? totalFitness / totalWeight : 0;
    
    // Update best
    if (!this.bestEver || genome.overallFitness > (this.bestEver.overallFitness || 0)) {
      this.bestEver = genome;
    }
  }
  
  /**
   * Run evolution
   */
  async evolve(
    testCases: TestCase[],
    documents: Document[],
    evaluateFn: (strategy: StrategyGenes, cases: TestCase[], docs: Document[]) => Promise<number>,
    options?: {
      onGenerationComplete?: (gen: number, best: AdaptiveGenome) => void;
    }
  ): Promise<AdaptiveEvolutionResult> {
    await this.initialize();
    
    const history: GenerationHistory[] = [];
    
    // Evaluate initial population
    logger.info('Evaluating initial population...');
    for (const genome of this.population) {
      await this.evaluateGenome(genome, testCases, documents, evaluateFn);
    }
    
    history.push(this.recordGeneration(0));
    
    // Evolution loop
    for (let gen = 1; gen <= this.config.generations; gen++) {
      logger.info(`\n=== Adaptive Generation ${gen}/${this.config.generations} ===`);
      
      // Sort by fitness
      this.population.sort((a, b) => (b.overallFitness || 0) - (a.overallFitness || 0));
      
      // Selection
      const elite = this.population.slice(0, this.config.eliteCount);
      const selected = this.selectParents();
      
      // Create offspring
      const offspring: AdaptiveGenome[] = [];
      
      while (offspring.length < this.config.populationSize - elite.length) {
        const p1 = selected[Math.floor(Math.random() * selected.length)];
        const p2 = selected[Math.floor(Math.random() * selected.length)];
        
        if (Math.random() < this.config.crossoverRate) {
          const child = this.crossover(p1, p2);
          offspring.push(child);
        } else {
          offspring.push(this.mutate(p1));
        }
      }
      
      // Mutate offspring
      for (let i = 0; i < offspring.length; i++) {
        if (Math.random() < this.config.mutationRate) {
          offspring[i] = this.mutate(offspring[i]);
        }
      }
      
      // New population
      this.population = [...elite, ...offspring];
      
      // Evaluate
      for (const genome of this.population) {
        if (genome.overallFitness === undefined) {
          await this.evaluateGenome(genome, testCases, documents, evaluateFn);
        }
      }
      
      history.push(this.recordGeneration(gen));
      
      // Callback
      if (options?.onGenerationComplete) {
        options.onGenerationComplete(gen, this.bestEver!);
      }
      
      logger.info(`Best: ${this.bestEver?.name} (${((this.bestEver?.overallFitness || 0) * 100).toFixed(1)}%)`);
    }
    
    return {
      bestGenome: this.bestEver!,
      history,
      finalPopulation: this.population,
    };
  }
  
  /**
   * Select parents using tournament selection
   */
  private selectParents(): AdaptiveGenome[] {
    const selected: AdaptiveGenome[] = [];
    const targetSize = Math.floor(this.config.populationSize / 2);
    
    while (selected.length < targetSize) {
      const tournament = [];
      for (let i = 0; i < 3; i++) {
        tournament.push(this.population[Math.floor(Math.random() * this.population.length)]);
      }
      tournament.sort((a, b) => (b.overallFitness || 0) - (a.overallFitness || 0));
      selected.push(tournament[0]);
    }
    
    return selected;
  }
  
  /**
   * Crossover two adaptive genomes
   */
  private crossover(p1: AdaptiveGenome, p2: AdaptiveGenome): AdaptiveGenome {
    const child: AdaptiveGenome = {
      id: uuidv4(),
      name: `Adaptive-Cross-Gen${Math.max(p1.generation, p2.generation) + 1}`,
      version: '2.0',
      strategyPortfolio: new Map(),
      defaultStrategy: Math.random() < 0.5 ? { ...p1.defaultStrategy } : { ...p2.defaultStrategy },
      routerEnabled: true,
      fitnessPerType: new Map(),
      generation: Math.max(p1.generation, p2.generation) + 1,
      parentIds: [p1.id, p2.id],
      createdAt: new Date().toISOString(),
    };
    
    // Crossover portfolio strategies
    const allTypes = new Set([...p1.strategyPortfolio.keys(), ...p2.strategyPortfolio.keys()]);
    for (const qType of allTypes) {
      const s1 = p1.strategyPortfolio.get(qType);
      const s2 = p2.strategyPortfolio.get(qType);
      
      if (s1 && s2) {
        // Both parents have this type - crossover
        child.strategyPortfolio.set(qType, Math.random() < 0.5 ? { ...s1 } : { ...s2 });
      } else if (s1) {
        child.strategyPortfolio.set(qType, { ...s1 });
      } else if (s2) {
        child.strategyPortfolio.set(qType, { ...s2 });
      }
    }
    
    return child;
  }
  
  /**
   * Mutate an adaptive genome
   */
  private mutate(genome: AdaptiveGenome): AdaptiveGenome {
    const mutated: AdaptiveGenome = {
      ...genome,
      id: uuidv4(),
      name: `Adaptive-Mutate-Gen${genome.generation + 1}`,
      strategyPortfolio: new Map(genome.strategyPortfolio),
      fitnessPerType: new Map(),
      overallFitness: undefined,
      generation: genome.generation + 1,
      parentIds: [genome.id],
      createdAt: new Date().toISOString(),
    };
    
    // Mutate random strategies in portfolio
    for (const [qType, strategy] of mutated.strategyPortfolio) {
      if (Math.random() < this.config.mutationRate) {
        // Create a temp genome for mutation
        const tempGenome = AdvancedGenomeFactory.createFromTemplate('temp', strategy, 0);
        const mutatedTemp = mutateAdvanced(tempGenome, this.config.mutationRate, {
          availableProviders: this.config.availableProviders,
        });
        mutated.strategyPortfolio.set(qType, mutatedTemp.defaultStrategy);
      }
    }
    
    return mutated;
  }
  
  /**
   * Record generation history
   */
  private recordGeneration(gen: number): GenerationHistory {
    const fitnesses = this.population
      .map(g => g.overallFitness || 0)
      .filter(f => f > 0);
    
    return {
      generation: gen,
      bestFitness: Math.max(...fitnesses, 0),
      avgFitness: fitnesses.length > 0 ? fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length : 0,
      bestPerType: this.bestEver ? Object.fromEntries(this.bestEver.fitnessPerType) : {},
    };
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface GenerationHistory {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  bestPerType: Record<string, number>;
}

interface AdaptiveEvolutionResult {
  bestGenome: AdaptiveGenome;
  history: GenerationHistory[];
  finalPopulation: AdaptiveGenome[];
}

// Types and classes are already exported at their definitions
