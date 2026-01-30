/**
 * Evolution Engine - Genetic Algorithm for Strategy Optimization
 * 
 * Implements a complete genetic algorithm to evolve retrieval strategies:
 * - Population initialization (random + seeded)
 * - Fitness evaluation via A/B testing
 * - Selection methods (tournament, elitist, roulette)
 * - Crossover and mutation operators
 * - Elitism preservation
 * - Diversity maintenance
 * 
 * @module evolution/evolution-engine
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  StrategyGenome,
  EvolutionConfig,
  EvolutionResult,
  GenerationResult,
  TestCase,
  Document,
  ProviderConfig,
} from '../core/types';
import {
  createRandomGenome,
  createGenomeFromStrategy,
  mutate,
  crossover,
  genomeToStrategy,
  calculateDiversity,
} from './strategy-genome';
import { KnowledgeBase } from './knowledge-base';
import { logger } from '../utils/logger';

/**
 * Default evolution configuration
 */
const DEFAULT_CONFIG: EvolutionConfig = {
  populationSize: 20,
  generations: 10,
  mutationRate: 0.2,
  crossoverRate: 0.8,
  selectionMethod: 'tournament',
  tournamentSize: 3,
  eliteCount: 2,
  fitnessMetric: 'ndcg10',
  fitnessWeights: {
    ndcg10: 0.5,
    recall10: 0.3,
    mrr10: 0.2,
  },
  constraints: {
    maxLatencyMs: 1000,
    maxCostPerQuery: 0.01,
  },
  autoDeployEnabled: false,
  autoDeployThreshold: 0.8,
};

/**
 * Evolution Engine - Main class for genetic algorithm optimization
 */
export class EvolutionEngine {
  private config: EvolutionConfig;
  private kb: KnowledgeBase;
  private evolutionId: string;
  private population: StrategyGenome[] = [];
  private generationResults: GenerationResult[] = [];
  private bestEver: StrategyGenome | null = null;
  private evaluationCache: Map<string, number> = new Map();

  constructor(
    private providerConfig: ProviderConfig,
    private testCases: TestCase[],
    private documents: Document[],
    config: Partial<EvolutionConfig> = {},
    knowledgeBase?: KnowledgeBase,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.kb = knowledgeBase || new KnowledgeBase();
    this.evolutionId = uuidv4();
  }

  /**
   * Run the full evolution process
   */
  async evolve(options?: {
    seedStrategies?: string[];
    onGenerationComplete?: (gen: number, best: StrategyGenome) => void;
  }): Promise<EvolutionResult> {
    logger.info(`Starting evolution: ${this.evolutionId}`);
    logger.info(`Population: ${this.config.populationSize}, Generations: ${this.config.generations}`);
    logger.info(`Fitness metric: ${this.config.fitnessMetric}`);

    await this.kb.initialize();

    // Initialize population
    await this.initializePopulation(options?.seedStrategies);
    
    // Evaluate initial population
    await this.evaluatePopulation();
    
    // Record initial generation
    this.recordGeneration(0);

    // Main evolution loop
    for (let gen = 1; gen <= this.config.generations; gen++) {
      logger.info(`\n=== Generation ${gen}/${this.config.generations} ===`);
      
      // Selection
      const selected = this.select();
      
      // Create new population through crossover and mutation
      const offspring = this.reproduce(selected);
      
      // Preserve elite
      const elite = this.getElite();
      
      // New population = elite + offspring
      this.population = [...elite, ...offspring.slice(0, this.config.populationSize - elite.length)];
      
      // Evaluate new population
      await this.evaluatePopulation();
      
      // Record generation results
      this.recordGeneration(gen);
      
      // Callback
      if (options?.onGenerationComplete) {
        options.onGenerationComplete(gen, this.bestEver!);
      }
      
      // Log progress
      const genResult = this.generationResults[gen];
      logger.info(`Best fitness: ${genResult.bestFitness.toFixed(4)}, Avg: ${genResult.avgFitness.toFixed(4)}, Diversity: ${genResult.diversity.toFixed(4)}`);
      logger.info(`Best genome: ${this.bestEver?.name}`);
      
      // Early stopping if fitness is good enough
      if (genResult.bestFitness >= this.config.autoDeployThreshold) {
        logger.info(`Reached threshold fitness (${this.config.autoDeployThreshold}), stopping early`);
        break;
      }
    }

    // Calculate improvement
    const baselineFitness = await this.evaluateBaseline();
    const improvement = this.bestEver?.fitness 
      ? (this.bestEver.fitness - baselineFitness) / baselineFitness 
      : 0;

    // Build result
    const result: EvolutionResult = {
      evolutionId: this.evolutionId,
      generations: this.generationResults,
      bestGenome: this.bestEver!,
      improvementOverBaseline: improvement,
      totalEvaluations: this.evaluationCache.size,
      deployed: false,
      timestamp: new Date().toISOString(),
    };

    // Store best genomes in knowledge base
    for (const genome of this.population.filter(g => g.fitness)) {
      await this.kb.recordGenome(genome);
    }

    // Auto-deploy if enabled and threshold met
    if (this.config.autoDeployEnabled && 
        this.bestEver?.fitness && 
        this.bestEver.fitness >= this.config.autoDeployThreshold) {
      result.deployed = await this.deploy(this.bestEver);
    }

    await this.kb.save();

    logger.info(`\n=== Evolution Complete ===`);
    logger.info(`Best genome: ${this.bestEver?.name} (fitness: ${this.bestEver?.fitness?.toFixed(4)})`);
    logger.info(`Improvement over baseline: ${(improvement * 100).toFixed(1)}%`);

    return result;
  }

  /**
   * Initialize population with random and seeded genomes
   */
  private async initializePopulation(seedStrategies?: string[]): Promise<void> {
    logger.info('Initializing population...');
    
    this.population = [];
    
    // Add seeded strategies
    if (seedStrategies && seedStrategies.length > 0) {
      for (const strategy of seedStrategies) {
        this.population.push(createGenomeFromStrategy(strategy, 0));
      }
      logger.info(`Added ${seedStrategies.length} seeded strategies`);
    } else {
      // Default seeds
      const defaultSeeds = ['baseline', 'hybrid-bm25', 'semantic-chunks'];
      for (const strategy of defaultSeeds) {
        this.population.push(createGenomeFromStrategy(strategy, 0));
      }
    }

    // Add best genomes from knowledge base
    const historicalBest = this.kb.getBestGenomes(3);
    for (const genome of historicalBest) {
      // Create a copy with new ID
      this.population.push({
        ...genome,
        id: uuidv4(),
        generation: 0,
        fitness: undefined,
      });
    }
    logger.info(`Added ${historicalBest.length} historical best genomes`);

    // Fill remaining with random genomes
    while (this.population.length < this.config.populationSize) {
      this.population.push(createRandomGenome(0));
    }

    logger.info(`Population initialized with ${this.population.length} genomes`);
  }

  /**
   * Evaluate fitness for all genomes in population
   */
  private async evaluatePopulation(): Promise<void> {
    const unevaluated = this.population.filter(g => g.fitness === undefined);
    logger.info(`Evaluating ${unevaluated.length} genomes...`);

    for (let i = 0; i < unevaluated.length; i++) {
      const genome = unevaluated[i];
      
      // Check cache
      const cacheKey = this.getGenomeCacheKey(genome);
      if (this.evaluationCache.has(cacheKey)) {
        genome.fitness = this.evaluationCache.get(cacheKey)!;
        logger.debug(`Cache hit for ${genome.name}: ${genome.fitness.toFixed(4)}`);
        continue;
      }

      // Evaluate
      try {
        const fitness = await this.evaluateGenome(genome);
        genome.fitness = fitness;
        this.evaluationCache.set(cacheKey, fitness);
        logger.debug(`Evaluated ${genome.name}: ${fitness.toFixed(4)}`);
      } catch (error) {
        logger.warn(`Failed to evaluate ${genome.name}:`, error);
        genome.fitness = 0;
      }

      // Progress
      if ((i + 1) % 5 === 0) {
        logger.info(`Progress: ${i + 1}/${unevaluated.length} genomes evaluated`);
      }
    }

    // Update best ever
    for (const genome of this.population) {
      if (genome.fitness && (!this.bestEver || genome.fitness > this.bestEver.fitness!)) {
        this.bestEver = genome;
      }
    }
  }

  /**
   * Evaluate a single genome
   */
  private async evaluateGenome(genome: StrategyGenome): Promise<number> {
    const strategy = genomeToStrategy(genome);
    
    // Import and run evaluation
    const { EnhancedABTestingEngine } = await import('../core/ab-testing/enhanced-engine');
    
    const engine = new EnhancedABTestingEngine({
      id: `evo-${this.evolutionId}-${genome.id.slice(0, 8)}`,
      name: `Evolution Eval: ${genome.name}`,
      variants: [{
        id: genome.id,
        name: genome.name,
        provider: this.providerConfig,
        strategy: strategy.name,
      }],
      dataset: '',
      metrics: ['ndcg@5', 'ndcg@10', 'recall@5', 'recall@10', 'mrr@10'],
      output: {},
    });

    // Run evaluation on subset for speed
    const sampleSize = Math.min(this.testCases.length, 20);
    const sampledCases = this.sampleTestCases(sampleSize);
    
    const result = await engine.run(sampledCases, this.documents);
    await engine.close();

    // Calculate weighted fitness
    const metrics = result.variants[0]?.metrics || {};
    let fitness = 0;
    let totalWeight = 0;

    for (const [metric, weight] of Object.entries(this.config.fitnessWeights || {})) {
      const value = metrics[metric] || 0;
      fitness += value * weight;
      totalWeight += weight;
    }

    fitness = totalWeight > 0 ? fitness / totalWeight : metrics[this.config.fitnessMetric] || 0;

    // Apply constraint penalties
    const latency = result.variants[0]?.usage.avgLatency || 0;
    if (this.config.constraints?.maxLatencyMs && latency > this.config.constraints.maxLatencyMs) {
      fitness *= 0.8;  // 20% penalty
    }

    return fitness;
  }

  /**
   * Evaluate baseline strategy for comparison
   */
  private async evaluateBaseline(): Promise<number> {
    const baseline = createGenomeFromStrategy('baseline', 0);
    const cacheKey = this.getGenomeCacheKey(baseline);
    
    if (this.evaluationCache.has(cacheKey)) {
      return this.evaluationCache.get(cacheKey)!;
    }

    const fitness = await this.evaluateGenome(baseline);
    this.evaluationCache.set(cacheKey, fitness);
    return fitness;
  }

  /**
   * Select parents for reproduction
   */
  private select(): StrategyGenome[] {
    const selected: StrategyGenome[] = [];
    const targetSize = Math.floor(this.config.populationSize / 2);

    switch (this.config.selectionMethod) {
      case 'tournament':
        while (selected.length < targetSize) {
          selected.push(this.tournamentSelect());
        }
        break;
      
      case 'elitist':
        return [...this.population]
          .sort((a, b) => (b.fitness || 0) - (a.fitness || 0))
          .slice(0, targetSize);
      
      case 'roulette':
        while (selected.length < targetSize) {
          selected.push(this.rouletteSelect());
        }
        break;
    }

    return selected;
  }

  /**
   * Tournament selection
   */
  private tournamentSelect(): StrategyGenome {
    const tournamentSize = this.config.tournamentSize || 3;
    const candidates: StrategyGenome[] = [];
    
    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      candidates.push(this.population[idx]);
    }
    
    return candidates.reduce((best, current) => 
      (current.fitness || 0) > (best.fitness || 0) ? current : best
    );
  }

  /**
   * Roulette wheel selection
   */
  private rouletteSelect(): StrategyGenome {
    const totalFitness = this.population.reduce((sum, g) => sum + (g.fitness || 0), 0);
    let threshold = Math.random() * totalFitness;
    
    for (const genome of this.population) {
      threshold -= genome.fitness || 0;
      if (threshold <= 0) return genome;
    }
    
    return this.population[this.population.length - 1];
  }

  /**
   * Reproduce offspring through crossover and mutation
   */
  private reproduce(parents: StrategyGenome[]): StrategyGenome[] {
    const offspring: StrategyGenome[] = [];
    
    // Shuffle parents
    const shuffled = [...parents].sort(() => Math.random() - 0.5);
    
    // Create offspring through crossover
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      if (Math.random() < this.config.crossoverRate) {
        const [child1, child2] = crossover(shuffled[i], shuffled[i + 1]);
        offspring.push(child1, child2);
      } else {
        // Clone without crossover
        offspring.push(
          mutate(shuffled[i], this.config.mutationRate),
          mutate(shuffled[i + 1], this.config.mutationRate)
        );
      }
    }
    
    // Mutate offspring
    return offspring.map(g => 
      Math.random() < this.config.mutationRate ? mutate(g, this.config.mutationRate) : g
    );
  }

  /**
   * Get elite genomes to preserve
   */
  private getElite(): StrategyGenome[] {
    return [...this.population]
      .sort((a, b) => (b.fitness || 0) - (a.fitness || 0))
      .slice(0, this.config.eliteCount || 2);
  }

  /**
   * Record generation results
   */
  private recordGeneration(generation: number): void {
    const fitnesses = this.population
      .map(g => g.fitness || 0)
      .filter(f => f > 0);
    
    const result: GenerationResult = {
      generation,
      population: [...this.population],
      bestFitness: Math.max(...fitnesses, 0),
      avgFitness: fitnesses.length > 0 
        ? fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length 
        : 0,
      diversity: calculateDiversity(this.population),
    };
    
    this.generationResults.push(result);
  }

  /**
   * Deploy best genome
   */
  private async deploy(genome: StrategyGenome): Promise<boolean> {
    logger.info(`Deploying best genome: ${genome.name}`);
    
    const strategy = genomeToStrategy(genome);
    const outputPath = path.join(process.cwd(), '.embedeval', 'deployed-strategy.json');
    
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeJson(outputPath, {
      genome,
      strategy,
      deployedAt: new Date().toISOString(),
      evolutionId: this.evolutionId,
    }, { spaces: 2 });

    logger.info(`Deployed strategy saved to: ${outputPath}`);
    return true;
  }

  /**
   * Sample test cases for faster evaluation
   */
  private sampleTestCases(n: number): TestCase[] {
    if (n >= this.testCases.length) return this.testCases;
    
    const shuffled = [...this.testCases].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  /**
   * Get cache key for genome
   */
  private getGenomeCacheKey(genome: StrategyGenome): string {
    return JSON.stringify(genome.genes);
  }

  /**
   * Get current best genome
   */
  getBestGenome(): StrategyGenome | null {
    return this.bestEver;
  }

  /**
   * Get evolution ID
   */
  getEvolutionId(): string {
    return this.evolutionId;
  }

  /**
   * Get generation history
   */
  getGenerationHistory(): GenerationResult[] {
    return this.generationResults;
  }
}

/**
 * Run evolution with convenience function
 */
export async function runEvolution(options: {
  provider: ProviderConfig;
  corpusPath: string;
  queriesPath: string;
  config?: Partial<EvolutionConfig>;
  seedStrategies?: string[];
  onProgress?: (gen: number, best: StrategyGenome) => void;
}): Promise<EvolutionResult> {
  // Load data
  const queriesContent = await fs.readFile(options.queriesPath, 'utf-8');
  const corpusContent = await fs.readFile(options.corpusPath, 'utf-8');
  
  const testCases: TestCase[] = queriesContent.trim().split('\n').map(line => JSON.parse(line));
  const documents: Document[] = corpusContent.trim().split('\n').map(line => JSON.parse(line));

  logger.info(`Loaded ${testCases.length} test cases and ${documents.length} documents`);

  // Create and run engine
  const engine = new EvolutionEngine(
    options.provider,
    testCases,
    documents,
    options.config
  );

  return engine.evolve({
    seedStrategies: options.seedStrategies,
    onGenerationComplete: options.onProgress,
  });
}
