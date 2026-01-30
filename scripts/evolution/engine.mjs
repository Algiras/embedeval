/**
 * Evolution Engine
 * 
 * Main genetic algorithm implementation with:
 * - Multi-objective optimization (NSGA-II inspired)
 * - Adaptive mutation rates
 * - Island model for parallel evolution
 * - Environment-aware evolution
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { StrategyGenome, GenomeFactory, EMBEDDING_PROVIDERS } from './genome.mjs';
import { 
  mutate, 
  uniformCrossover, 
  blendCrossover,
  tournamentSelect, 
  rankSelect,
  nsgaSelect,
  calculateDiversity,
  applyDiversityPressure,
} from './operators.mjs';
import { FitnessEvaluator, FitnessResult, DEFAULT_EVAL_CONFIG } from './fitness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// EVOLUTION CONFIGURATION
// ============================================================================

export const DEFAULT_EVOLUTION_CONFIG = {
  // Population
  populationSize: 20,
  eliteCount: 3,
  
  // Generations
  maxGenerations: 10,
  stagnationLimit: 5,       // Stop if no improvement for this many generations
  
  // Mutation
  baseMutationRate: 0.2,
  adaptiveMutation: true,   // Increase mutation when stagnant
  mutationRateMin: 0.1,
  mutationRateMax: 0.5,
  
  // Crossover
  crossoverRate: 0.8,
  crossoverMethod: 'blend', // 'uniform', 'singlePoint', 'blend'
  
  // Selection
  selectionMethod: 'tournament', // 'tournament', 'rank', 'nsga'
  tournamentSize: 3,
  
  // Diversity
  maintainDiversity: true,
  diversityThreshold: 0.15,
  diversityPenalty: 0.1,
  
  // Multi-objective
  objectives: ['correctness', 'speed', 'cost'],
  objectiveWeights: {
    correctness: 0.5,
    speed: 0.25,
    cost: 0.25,
  },
  
  // Environment
  environment: 'default',   // 'default', 'local-only', 'cost-optimized', 'speed-optimized'
  
  // Checkpointing
  checkpointInterval: 1,    // Save every N generations
  checkpointDir: null,      // Will use default if null
  
  // Reporting
  verbose: true,
  reportInterval: 1,
};

// Environment presets
export const ENVIRONMENTS = {
  'default': {
    availableProviders: ['ollama', 'openai', 'gemini', 'cohere'],
    maxLatencyMs: null,
    maxCostPerQuery: null,
    minNdcg10: null,
  },
  'local-only': {
    availableProviders: ['ollama'],
    maxLatencyMs: null,
    maxCostPerQuery: 0,
    minNdcg10: null,
  },
  'cost-optimized': {
    availableProviders: ['ollama', 'gemini'],
    maxLatencyMs: 5000,
    maxCostPerQuery: 0.001,
    minNdcg10: 0.5,
  },
  'speed-optimized': {
    availableProviders: ['ollama'],
    maxLatencyMs: 500,
    maxCostPerQuery: null,
    minNdcg10: 0.4,
  },
  'quality-optimized': {
    availableProviders: ['ollama', 'openai', 'cohere'],
    maxLatencyMs: 10000,
    maxCostPerQuery: 0.01,
    minNdcg10: 0.7,
  },
};

// ============================================================================
// EVOLUTION ENGINE
// ============================================================================

export class EvolutionEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_EVOLUTION_CONFIG, ...config };
    this.evaluator = null;
    this.population = [];
    this.generation = 0;
    this.history = [];
    this.bestEver = null;
    this.stagnationCount = 0;
    this.currentMutationRate = this.config.baseMutationRate;
    
    // Callbacks
    this.onGenerationComplete = config.onGenerationComplete || null;
    this.onEvolutionComplete = config.onEvolutionComplete || null;
  }
  
  /**
   * Initialize the evolution engine
   */
  async initialize(queries, documents, options = {}) {
    this.queries = queries;
    this.documents = documents;
    
    // Set up environment
    const envConfig = ENVIRONMENTS[this.config.environment] || ENVIRONMENTS['default'];
    
    // Initialize evaluator
    this.evaluator = new FitnessEvaluator({
      ...DEFAULT_EVAL_CONFIG,
      environment: envConfig,
      weights: {
        correctnessWeight: this.config.objectiveWeights.correctness || 0.5,
        speedWeight: this.config.objectiveWeights.speed || 0.25,
        costWeight: this.config.objectiveWeights.cost || 0.25,
        robustnessWeight: this.config.objectiveWeights.robustness || 0,
      },
    });
    
    // Pre-compute document embeddings for all available providers
    this.docEmbeddingsCache = new Map();
    
    // Initialize population
    if (options.initialPopulation) {
      this.population = options.initialPopulation;
    } else {
      this.population = GenomeFactory.createSeededPopulation(this.config.populationSize);
    }
    
    // Filter population by environment constraints
    this.population = this.population.filter(g => {
      const provider = EMBEDDING_PROVIDERS[g.genes.primaryEmbedding]?.provider;
      return !provider || envConfig.availableProviders.includes(provider);
    });
    
    // Fill remaining with valid random genomes
    while (this.population.length < this.config.populationSize) {
      const genome = GenomeFactory.createRandom(0);
      const provider = EMBEDDING_PROVIDERS[genome.genes.primaryEmbedding]?.provider;
      if (!provider || envConfig.availableProviders.includes(provider)) {
        this.population.push(genome);
      }
    }
    
    this.log('Initialized evolution engine');
    this.log(`  Population: ${this.population.length}`);
    this.log(`  Environment: ${this.config.environment}`);
    this.log(`  Objectives: ${this.config.objectives.join(', ')}`);
  }
  
  /**
   * Run the full evolution
   */
  async evolve() {
    this.log('\n🧬 Starting Evolution\n');
    
    const startTime = Date.now();
    
    for (this.generation = 1; this.generation <= this.config.maxGenerations; this.generation++) {
      const genResult = await this.runGeneration();
      
      // Check stopping conditions
      if (this.stagnationCount >= this.config.stagnationLimit) {
        this.log(`\n⚠️ Stopping early: No improvement for ${this.stagnationCount} generations`);
        break;
      }
      
      // Checkpoint
      if (this.config.checkpointDir && this.generation % this.config.checkpointInterval === 0) {
        await this.saveCheckpoint();
      }
    }
    
    const duration = (Date.now() - startTime) / 1000;
    
    // Final report
    this.log('\n' + '═'.repeat(60));
    this.log('🏆 EVOLUTION COMPLETE');
    this.log('═'.repeat(60));
    this.log(`\nDuration: ${duration.toFixed(1)}s`);
    this.log(`Generations: ${this.generation - 1}`);
    
    if (this.bestEver) {
      this.log(`\nBest Strategy: ${this.bestEver.getName()}`);
      this.log(`  Fitness: ${this.bestEver.fitness?.overall?.toFixed(4)}`);
      this.log(`  NDCG@10: ${this.bestEver.fitness?.correctness?.ndcg10?.toFixed(4)}`);
      this.log(`  Latency: ${this.bestEver.fitness?.speed?.avgLatencyMs?.toFixed(0)}ms`);
      this.log(`  Cost/Query: $${this.bestEver.fitness?.cost?.costPerQuery?.toFixed(6)}`);
    }
    
    if (this.onEvolutionComplete) {
      this.onEvolutionComplete({
        bestGenome: this.bestEver,
        history: this.history,
        population: this.population,
        generation: this.generation - 1,
        duration,
      });
    }
    
    return {
      bestGenome: this.bestEver,
      finalPopulation: this.population,
      history: this.history,
      generation: this.generation - 1,
      duration,
    };
  }
  
  /**
   * Run a single generation
   */
  async runGeneration() {
    this.log(`\n${'─'.repeat(50)}`);
    this.log(`  Generation ${this.generation}/${this.config.maxGenerations}`);
    this.log(`${'─'.repeat(50)}\n`);
    
    const genStartTime = Date.now();
    const genResult = {
      generation: this.generation,
      population: [],
      bestFitness: 0,
      avgFitness: 0,
      diversity: 0,
      mutationRate: this.currentMutationRate,
    };
    
    // Evaluate population
    this.log('  Evaluating population...');
    for (let i = 0; i < this.population.length; i++) {
      const genome = this.population[i];
      
      if (!genome.fitness) {
        genome.fitness = await this.evaluator.evaluate(
          genome, 
          this.queries, 
          this.documents
        );
      }
      
      this.log(`    [${i + 1}/${this.population.length}] ${genome.getName()}: ${genome.fitness.overall.toFixed(4)}`);
    }
    
    // Sort by overall fitness
    this.population.sort((a, b) => b.fitness.overall - a.fitness.overall);
    
    // Update best ever
    const previousBest = this.bestEver?.fitness?.overall || 0;
    if (!this.bestEver || this.population[0].fitness.overall > this.bestEver.fitness.overall) {
      this.bestEver = this.population[0].clone();
      this.bestEver.fitness = { ...this.population[0].fitness };
      this.stagnationCount = 0;
    } else {
      this.stagnationCount++;
    }
    
    // Calculate statistics
    genResult.bestFitness = this.population[0].fitness.overall;
    genResult.avgFitness = this.population.reduce((sum, g) => sum + g.fitness.overall, 0) / this.population.length;
    genResult.diversity = calculateDiversity(this.population);
    genResult.bestGenome = this.population[0].getName();
    genResult.improvement = genResult.bestFitness - previousBest;
    
    // Record history
    this.history.push(genResult);
    
    // Report
    this.log(`\n  📊 Generation ${this.generation} Summary:`);
    this.log(`     Best: ${genResult.bestFitness.toFixed(4)} (${this.population[0].getName()})`);
    this.log(`     Avg:  ${genResult.avgFitness.toFixed(4)}`);
    this.log(`     Diversity: ${genResult.diversity.toFixed(4)}`);
    this.log(`     Mutation Rate: ${this.currentMutationRate.toFixed(2)}`);
    
    if (genResult.improvement > 0) {
      this.log(`     ⬆️ Improvement: +${genResult.improvement.toFixed(4)}`);
    } else if (this.stagnationCount > 0) {
      this.log(`     ⏳ Stagnation: ${this.stagnationCount}/${this.config.stagnationLimit}`);
    }
    
    // Callback
    if (this.onGenerationComplete) {
      this.onGenerationComplete(genResult);
    }
    
    // Create next generation (unless this is the last)
    if (this.generation < this.config.maxGenerations) {
      this.createNextGeneration();
    }
    
    genResult.duration = (Date.now() - genStartTime) / 1000;
    
    return genResult;
  }
  
  /**
   * Create the next generation through selection, crossover, and mutation
   */
  createNextGeneration() {
    const newPopulation = [];
    
    // Elitism - keep best individuals unchanged
    for (let i = 0; i < this.config.eliteCount; i++) {
      const elite = this.population[i].clone();
      elite.fitness = { ...this.population[i].fitness };
      newPopulation.push(elite);
    }
    
    // Adaptive mutation rate
    if (this.config.adaptiveMutation) {
      this.adaptMutationRate();
    }
    
    // Apply diversity pressure
    let diversityPenalties = new Map();
    if (this.config.maintainDiversity) {
      diversityPenalties = applyDiversityPressure(this.population, this.config.diversityThreshold);
    }
    
    // Fill rest with offspring
    while (newPopulation.length < this.config.populationSize) {
      // Selection
      let parent1, parent2;
      
      if (this.config.selectionMethod === 'nsga' && this.config.objectives.length > 1) {
        parent1 = nsgaSelect(this.population, this.config.objectives);
        parent2 = nsgaSelect(this.population, this.config.objectives);
      } else if (this.config.selectionMethod === 'rank') {
        parent1 = rankSelect(this.population, 'overall');
        parent2 = rankSelect(this.population, 'overall');
      } else {
        parent1 = tournamentSelect(this.population, 'overall', this.config.tournamentSize);
        parent2 = tournamentSelect(this.population, 'overall', this.config.tournamentSize);
      }
      
      // Crossover
      let child;
      if (Math.random() < this.config.crossoverRate) {
        if (this.config.crossoverMethod === 'blend') {
          child = blendCrossover(parent1, parent2);
        } else if (this.config.crossoverMethod === 'singlePoint') {
          child = singlePointCrossover(parent1, parent2);
        } else {
          child = uniformCrossover(parent1, parent2);
        }
      } else {
        child = parent1.clone();
      }
      
      // Mutation
      child = mutate(child, {
        mutationRate: this.currentMutationRate,
        pipelineMutationRate: this.currentMutationRate * 0.75,
        parameterMutationRate: this.currentMutationRate * 1.25,
      });
      
      child.generation = this.generation + 1;
      child.fitness = null; // Needs re-evaluation
      
      // Validate and add
      const validation = child.validate();
      if (validation.valid) {
        newPopulation.push(child);
      }
    }
    
    this.population = newPopulation;
  }
  
  /**
   * Adapt mutation rate based on progress
   */
  adaptMutationRate() {
    if (this.stagnationCount > 2) {
      // Increase mutation to escape local optima
      this.currentMutationRate = Math.min(
        this.config.mutationRateMax,
        this.currentMutationRate * 1.2
      );
    } else if (this.stagnationCount === 0 && this.history.length > 1) {
      // Decrease mutation when making progress
      this.currentMutationRate = Math.max(
        this.config.mutationRateMin,
        this.currentMutationRate * 0.95
      );
    }
  }
  
  /**
   * Save checkpoint
   */
  async saveCheckpoint() {
    const checkpointDir = this.config.checkpointDir || path.join(__dirname, '../../.evolution');
    
    try {
      await fs.mkdir(checkpointDir, { recursive: true });
      
      const checkpoint = {
        generation: this.generation,
        population: this.population.map(g => g.toJSON()),
        bestEver: this.bestEver?.toJSON(),
        history: this.history,
        config: this.config,
        timestamp: new Date().toISOString(),
      };
      
      const filename = path.join(checkpointDir, `checkpoint-gen${this.generation}.json`);
      await fs.writeFile(filename, JSON.stringify(checkpoint, null, 2));
      
      this.log(`  💾 Checkpoint saved: ${filename}`);
    } catch (error) {
      this.log(`  ⚠️ Failed to save checkpoint: ${error.message}`);
    }
  }
  
  /**
   * Load from checkpoint
   */
  async loadCheckpoint(checkpointPath) {
    const content = await fs.readFile(checkpointPath, 'utf-8');
    const checkpoint = JSON.parse(content);
    
    this.generation = checkpoint.generation;
    this.population = checkpoint.population.map(g => StrategyGenome.fromJSON(g));
    this.bestEver = checkpoint.bestEver ? StrategyGenome.fromJSON(checkpoint.bestEver) : null;
    this.history = checkpoint.history;
    
    this.log(`Loaded checkpoint from generation ${this.generation}`);
  }
  
  /**
   * Get Pareto front (non-dominated solutions)
   */
  getParetoFront() {
    const dominated = new Set();
    
    for (let i = 0; i < this.population.length; i++) {
      for (let j = 0; j < this.population.length; j++) {
        if (i === j) continue;
        
        const gi = this.population[i].fitness;
        const gj = this.population[j].fitness;
        
        // Check if j dominates i
        let jBetterAll = true;
        let jStrictlyBetter = false;
        
        for (const obj of this.config.objectives) {
          const fi = this.getObjectiveValue(gi, obj);
          const fj = this.getObjectiveValue(gj, obj);
          
          if (fj < fi) jBetterAll = false;
          if (fj > fi) jStrictlyBetter = true;
        }
        
        if (jBetterAll && jStrictlyBetter) {
          dominated.add(i);
          break;
        }
      }
    }
    
    return this.population.filter((_, i) => !dominated.has(i));
  }
  
  /**
   * Get objective value from fitness result
   */
  getObjectiveValue(fitness, objective) {
    if (!fitness) return 0;
    
    switch (objective) {
      case 'correctness':
        return fitness.correctness?.ndcg10 || 0;
      case 'speed':
        return fitness.speed ? 1 / (fitness.speed.avgLatencyMs + 1) : 0; // Invert for maximization
      case 'cost':
        return fitness.cost ? 1 / (fitness.cost.costPerQuery + 0.0001) : 0; // Invert for maximization
      case 'robustness':
        return fitness.robustness?.consistencyScore || 0;
      default:
        return fitness.overall || 0;
    }
  }
  
  /**
   * Log message if verbose
   */
  log(message) {
    if (this.config.verbose) {
      console.log(message);
    }
  }
}

export default { EvolutionEngine, DEFAULT_EVOLUTION_CONFIG, ENVIRONMENTS };
