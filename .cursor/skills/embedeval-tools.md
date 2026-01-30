# EmbedEval Custom Skills

> Skills for building and enhancing the self-evolving embedding researcher

## Skill: Create New Provider

When adding support for a new embedding provider:

### Steps

1. Create provider file at `src/providers/{name}.ts`
2. Implement the `EmbeddingProvider` interface
3. Add config type to `src/core/types.ts`
4. Register in provider factory at `src/providers/index.ts`
5. Add tests at `tests/providers/{name}.test.ts`
6. Document in README.md

### Template

```typescript
// src/providers/{name}.ts
import { EmbeddingProvider, ModelInfo, {Name}Config } from '../core/types';
import { logger } from '../utils/logger';

export class {Name}Provider implements EmbeddingProvider {
  name = '{name}';
  
  constructor(private config: {Name}Config) {}
  
  async embed(text: string): Promise<number[]> {
    // Implementation
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    // Batch implementation (optimize API calls)
  }
  
  getModelInfo(): ModelInfo {
    return {
      name: this.config.model,
      dimensions: 768, // Adjust per model
      maxTokens: 8192,
      provider: this.name,
    };
  }
}
```

---

## Skill: Create New Strategy Stage

When adding a new composable strategy stage:

### Steps

1. Identify the stage type: `chunking`, `retrieval`, `fusion`, or `reranking`
2. Create file at `src/strategies/{type}/{name}.ts`
3. Implement `StrategyStage` interface
4. Register in `src/strategies/registry.ts`
5. Add to predefined strategies if commonly useful
6. Add tests

### Template

```typescript
// src/strategies/{type}/{name}.ts
import { StrategyStage, StrategyContext, StageConfig } from '../types';
import { EmbeddingProvider } from '../../core/types';

export class {Name}Stage implements StrategyStage {
  name = '{name}';
  type = '{type}';
  
  constructor(private config: {Name}Config) {}
  
  async execute(
    context: StrategyContext,
    provider?: EmbeddingProvider
  ): Promise<StrategyContext> {
    const startTime = Date.now();
    
    // Implementation here
    
    context.stageTimings.set(this.name, Date.now() - startTime);
    return context;
  }
}
```

---

## Skill: Create Research Module

When adding a new research automation feature:

### Steps

1. Define the research question being answered
2. Create file at `src/research/{name}.ts`
3. Implement observe → analyze → hypothesize pattern
4. Integrate with knowledge base
5. Add CLI command wrapper
6. Document in AGENTS.md

### Template

```typescript
// src/research/{name}.ts
import { KnowledgeBase } from '../evolution/knowledge-base';
import { logger } from '../utils/logger';

export interface {Name}Config {
  // Configuration options
}

export interface {Name}Result {
  // Result structure
}

export class {Name}Engine {
  constructor(
    private kb: KnowledgeBase,
    private config: {Name}Config
  ) {}
  
  /**
   * Main entry point
   */
  async run(): Promise<{Name}Result> {
    logger.info(`Starting {name}...`);
    
    // 1. Observe current state
    const observations = await this.observe();
    
    // 2. Analyze patterns
    const analysis = await this.analyze(observations);
    
    // 3. Generate insights/hypotheses
    const insights = await this.synthesize(analysis);
    
    // 4. Store in knowledge base
    await this.kb.store('{name}', insights);
    
    return insights;
  }
  
  private async observe(): Promise<any> {
    // Collect data
  }
  
  private async analyze(data: any): Promise<any> {
    // Find patterns
  }
  
  private async synthesize(analysis: any): Promise<{Name}Result> {
    // Generate actionable insights
  }
}
```

---

## Skill: Create Evolution Component

When adding evolution system components:

### Genome Mutation

```typescript
// src/evolution/mutations/{name}.ts
import { StrategyGenome } from './strategy-genome';

export function mutate{Gene}(
  genome: StrategyGenome,
  rate: number
): StrategyGenome {
  if (Math.random() > rate) return genome;
  
  const mutated = structuredClone(genome);
  mutated.id = uuidv4();
  mutated.mutations = [...(genome.mutations || []), '{gene}'];
  
  // Apply mutation logic
  
  return mutated;
}
```

### Selection Method

```typescript
// src/evolution/selection/{name}.ts
import { StrategyGenome } from './strategy-genome';

export function {name}Selection(
  population: StrategyGenome[],
  count: number,
  config?: any
): StrategyGenome[] {
  // Selection logic
}
```

### Fitness Function

```typescript
// src/evolution/fitness/{name}.ts
import { EvaluationResult } from '../core/types';

export interface {Name}FitnessConfig {
  weights: Record<string, number>;
  constraints?: Record<string, number>;
}

export function compute{Name}Fitness(
  results: EvaluationResult,
  config: {Name}FitnessConfig
): number {
  let fitness = 0;
  
  // Weighted sum of metrics
  for (const [metric, weight] of Object.entries(config.weights)) {
    fitness += (results.metrics[metric] || 0) * weight;
  }
  
  // Apply constraint penalties
  
  return fitness;
}
```

---

## Skill: Create CLI Command

When adding a new CLI command:

### Steps

1. Create command at `src/cli/commands/{name}.ts`
2. Register in `src/cli/index.ts`
3. Add help text and examples
4. Create example config in `examples/`

### Template

```typescript
// src/cli/commands/{name}.ts
import { Command } from 'commander';
import { logger } from '../../utils/logger';
import { loadConfig } from '../../utils/config';

export function register{Name}Command(program: Command): void {
  program
    .command('{name}')
    .description('Description of what this command does')
    .option('-c, --config <path>', 'Configuration file')
    .option('-o, --output <path>', 'Output directory')
    .option('--verbose', 'Enable verbose logging')
    .action(async (options) => {
      try {
        const config = options.config 
          ? await loadConfig(options.config)
          : {};
        
        // Implementation
        
        logger.info('Command completed successfully');
      } catch (error) {
        logger.error('Command failed:', error);
        process.exit(1);
      }
    });
}
```

---

## Skill: Create MCP Tool

When exposing functionality to AI agents via MCP:

### Template

```typescript
// src/mcp/tools/{name}.ts
import { z } from 'zod';

export const {name}Tool = {
  name: 'embedeval_{name}',
  description: 'Description for AI agents',
  
  inputSchema: z.object({
    // Input parameters
  }),
  
  outputSchema: z.object({
    // Output structure
  }),
  
  async execute(input: z.infer<typeof this.inputSchema>) {
    // Implementation
    return result;
  },
};
```

---

## Skill: Add Knowledge Base Entity

When adding new data types to the knowledge base:

### Template

```typescript
// Add to src/evolution/knowledge-base.ts

export interface {Entity}Record {
  id: string;
  timestamp: Date;
  // Entity-specific fields
}

export class KnowledgeBase {
  // Add methods
  
  async store{Entity}(record: {Entity}Record): Promise<void> {
    await this.db.{entities}.insert(record);
  }
  
  async get{Entity}s(filter?: Partial<{Entity}Record>): Promise<{Entity}Record[]> {
    return this.db.{entities}.find(filter);
  }
  
  async getBest{Entity}(metric: string): Promise<{Entity}Record | null> {
    return this.db.{entities}
      .sort({ [metric]: -1 })
      .limit(1)
      .first();
  }
}
```

---

## Skill: Implement Agent Integration

When making features accessible to AI agents:

### Checklist

1. [ ] Define clear input/output schemas
2. [ ] Return structured JSON responses
3. [ ] Include interpretations, not just raw data
4. [ ] Provide actionable recommendations
5. [ ] Handle errors gracefully with suggestions
6. [ ] Document in AGENTS.md
7. [ ] Add MCP tool wrapper

### Response Format

```typescript
interface AgentResponse<T> {
  status: 'success' | 'error' | 'partial';
  data?: T;
  summary: string;           // Human-readable summary
  interpretation?: string;   // What the data means
  recommendations?: string[]; // Suggested next actions
  error?: {
    message: string;
    suggestion: string;
  };
}
```
