# Evolution System - Genetic Algorithm for Strategy Optimization

EmbedEval includes a powerful genetic algorithm system that automatically evolves and discovers the optimal embedding retrieval strategy for your specific use case.

## Overview

The evolution system uses biological evolution principles to find the best combination of:
- **Chunking methods** (none, fixed, semantic, sliding)
- **Retrieval methods** (cosine, BM25, hybrid)
- **Reranking methods** (none, LLM, MMR, cross-encoder)
- **Hyperparameters** (chunk size, retrieval K, weights, etc.)

## Quick Start

### Run Evolution

```bash
# Basic evolution run
embedeval evolve run \
  --corpus ./data/corpus.jsonl \
  --queries ./data/queries.jsonl \
  --generations 10 \
  --population 20

# With specific provider
embedeval evolve run \
  --corpus ./data/corpus.jsonl \
  --queries ./data/queries.jsonl \
  --provider openai \
  --model text-embedding-3-small \
  --auto-deploy

# Scheduled evolution (runs weekly)
embedeval evolve schedule \
  --corpus ./data/corpus.jsonl \
  --queries ./data/queries.jsonl \
  --cron "0 0 * * 0" \
  --auto-deploy
```

### View Results

```bash
# Show latest evolution result
embedeval evolve show

# Show deployed strategy
embedeval evolve show --deployed

# Show evolution history
embedeval evolve show --history

# Export best strategy
embedeval evolve export --output best-strategy.json
```

## How It Works

### 1. Strategy Genome

Each strategy is represented as a "genome" with genes:

```typescript
interface StrategyGenome {
  genes: {
    // Chunking genes
    chunkingMethod: 'none' | 'fixed' | 'semantic' | 'sliding';
    chunkSize?: number;        // 128-1024
    chunkOverlap?: number;     // 0-50%
    
    // Retrieval genes
    retrievalMethod: 'cosine' | 'bm25' | 'hybrid';
    retrievalK: number;        // 10-100
    hybridWeights?: [number, number];
    
    // Reranking genes
    rerankingMethod: 'none' | 'llm' | 'mmr' | 'cross-encoder';
    rerankingTopK?: number;
    mmrLambda?: number;
  };
  fitness?: number;
  generation: number;
}
```

### 2. Evolution Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVOLUTION LOOP                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INITIALIZE                                                   │
│     └─▶ Create population of random + seeded strategies         │
│                                                                  │
│  2. EVALUATE                                                     │
│     └─▶ Run A/B tests to measure fitness (NDCG, recall, etc)   │
│                                                                  │
│  3. SELECT                                                       │
│     └─▶ Tournament/elitist selection of best performers         │
│                                                                  │
│  4. REPRODUCE                                                    │
│     └─▶ Crossover: Combine genes from two parents              │
│     └─▶ Mutation: Random changes to genes                       │
│                                                                  │
│  5. REPLACE                                                      │
│     └─▶ New generation = elite + offspring                      │
│                                                                  │
│  6. REPEAT until convergence or max generations                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Fitness Evaluation

Fitness is calculated as a weighted combination of metrics:

```typescript
fitness = 0.5 * NDCG@10 + 0.3 * Recall@10 + 0.2 * MRR@10
```

Constraints can apply penalties:
- Latency > max → 20% fitness penalty
- Cost > max → 20% fitness penalty

### 4. Genetic Operators

**Mutation** (default rate: 20%):
- Categorical genes: Random selection from valid values
- Numeric genes: Gaussian perturbation (±20% of range)

**Crossover** (default rate: 80%):
- Uniform crossover: Each gene randomly from parent A or B

**Selection Methods**:
- Tournament (default): Random k individuals compete, best wins
- Elitist: Top n individuals always selected
- Roulette: Probability proportional to fitness

## Configuration

### Evolution Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `populationSize` | 20 | Number of strategies per generation |
| `generations` | 10 | Number of evolution cycles |
| `mutationRate` | 0.2 | Probability of gene mutation |
| `crossoverRate` | 0.8 | Probability of crossover |
| `selectionMethod` | tournament | Selection strategy |
| `eliteCount` | 2 | Number of elite to preserve |
| `fitnessMetric` | ndcg10 | Primary optimization target |

### Seeding Strategies

Evolution can be seeded with known good strategies:

```bash
embedeval evolve run \
  --seed-strategies baseline,hybrid-bm25,semantic-chunks
```

The evolution will also automatically include:
- Historical best genomes from knowledge base
- Strategies suggested by hypothesis engine

### Auto-Deployment

When enabled, evolution automatically deploys winning strategies:

```bash
embedeval evolve run --auto-deploy --deploy-threshold 0.8
```

Deployment includes:
- Saving strategy configuration
- Creating rollback point
- Optional canary deployment

### Scheduled Evolution

Run evolution on a schedule for continuous improvement:

```bash
# Weekly evolution (Sunday midnight)
embedeval evolve schedule --cron "0 0 * * 0" --auto-deploy

# Daily evolution
embedeval evolve schedule --cron "0 0 * * *" --auto-deploy
```

Features:
- Drift detection before running
- Automatic rollback on regression
- Webhook notifications

## Example Output

```
=== Evolution Results ===

Evolution ID: abc123-def456
Duration: 342.5s
Total evaluations: 156

Best Genome:
  Name: semantic-512-hybrid-w60-mmr-λ0.7
  Fitness: 0.8234
  Generation: 8

Genes:
  Chunking: semantic (512)
  Retrieval: hybrid (k=100)
  Hybrid weights: 0.60, 0.40
  Reranking: mmr

Improvement:
  12.3% over baseline

Generation Progress:
  Gen  1: ████████░░░░░░░░░░░░ 0.7123 (avg: 0.6234)
  Gen  5: ███████████░░░░░░░░░ 0.7856 (avg: 0.7123)
  Gen  8: ████████████████░░░░ 0.8234 (avg: 0.7856)
  Gen 10: ████████████████░░░░ 0.8234 (avg: 0.7923)

✓ Strategy deployed automatically
```

## Programmatic Usage

```typescript
import { EvolutionEngine, runEvolution } from 'embedeval/evolution';

// Simple usage
const result = await runEvolution({
  provider: { type: 'ollama', model: 'nomic-embed-text', baseUrl: '...' },
  corpusPath: './corpus.jsonl',
  queriesPath: './queries.jsonl',
  config: {
    generations: 10,
    populationSize: 20,
  },
  onProgress: (gen, best) => {
    console.log(`Gen ${gen}: ${best.fitness}`);
  },
});

console.log('Best strategy:', result.bestGenome.name);
console.log('Improvement:', result.improvementOverBaseline);

// Advanced usage with custom config
const engine = new EvolutionEngine(
  providerConfig,
  testCases,
  documents,
  {
    populationSize: 30,
    generations: 20,
    mutationRate: 0.15,
    fitnessWeights: {
      ndcg10: 0.6,
      recall10: 0.2,
      mrr10: 0.2,
    },
    constraints: {
      maxLatencyMs: 500,
    },
    autoDeployEnabled: true,
    autoDeployThreshold: 0.85,
  }
);

const result = await engine.evolve({
  seedStrategies: ['baseline', 'hybrid-bm25'],
  onGenerationComplete: (gen, best) => {
    // Custom progress handling
  },
});
```

## Knowledge Base Integration

Evolution results are automatically stored in the knowledge base:

- Best genomes from each run
- Strategy performance profiles
- Fitness history over generations

Query the knowledge base:

```bash
embedeval agent knowledge --best-strategies
embedeval agent knowledge --insights
```

## Best Practices

1. **Start with good seeds**: Include strategies you know work well
2. **Use sufficient population**: At least 15-20 for good diversity
3. **Allow enough generations**: 10-20 for convergence
4. **Monitor diversity**: Low diversity → premature convergence
5. **Set realistic constraints**: Don't over-penalize latency/cost
6. **Use auto-deploy carefully**: Always keep rollback capability
7. **Run regularly**: Weekly evolution catches drift

## Troubleshooting

### Evolution not improving

- Increase population size
- Lower mutation rate (too high = random search)
- Check if fitness metric is appropriate
- Ensure test data is representative

### Fitness plateau

- Increase mutation rate temporarily
- Add new seed strategies
- Check for constraint penalties

### Too slow

- Reduce population size
- Use smaller test sample
- Enable caching (default)

---

*The evolution system is the core of EmbedEval's self-improvement capability.*
