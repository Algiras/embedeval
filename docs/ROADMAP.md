# EmbedEval Roadmap

> Transforming EmbedEval into a Self-Evolving Embedding Researcher

## Vision

EmbedEval will become an autonomous system that AI agents can use to continuously improve their retrieval systems without human intervention.

---

## Current State (v1.0)

### ✅ Completed

- **Core Evaluation**
  - A/B testing framework
  - Multiple providers (Ollama, OpenAI, Google, HuggingFace)
  - Comprehensive metrics (NDCG, Recall, MRR, MAP, Hit Rate)
  - Statistical significance testing

- **Strategy System**
  - Composable pipelines (chunking → embedding → retrieval → fusion → reranking)
  - Predefined strategies (baseline, hybrid-bm25, semantic-chunks, etc.)
  - Custom strategy configuration via YAML

- **Infrastructure**
  - BullMQ parallel processing
  - Per-query checkpointing
  - 10GB binary embedding cache
  - Human evaluation wizard
  - HTML dashboard generation

---

## Phase 1: Research Automation 🔬 ✅ COMPLETED

**Goal**: Enable systematic research without manual experiment design

### P0 - Critical

| Feature | Description | Status |
|---------|-------------|--------|
| Synthetic Query Generation | Generate test queries from corpus using LLM | ✅ Completed |
| Experiment History | Track all experiments in knowledge base | ✅ Completed |
| Agent CLI Commands | CLI interface for AI agents | ✅ Completed |

### P1 - Important

| Feature | Description | Status |
|---------|-------------|--------|
| Hypothesis Engine | Auto-propose experiments based on results | ✅ Completed |
| Failure Analysis | Categorize and explain query failures | ✅ Completed |
| Model Discovery | Find new models from HuggingFace/MTEB | 🔲 Not Started |

### P2 - Nice to Have

| Feature | Description | Status |
|---------|-------------|--------|
| Benchmark Integration | Run MTEB/BEIR benchmarks | 🔲 Not Started |
| Embedding Visualization | t-SNE/UMAP of embedding space | 🔲 Not Started |

---

## Phase 2: Self-Evolution 🧬 ✅ COMPLETED

**Goal**: Autonomous optimization of retrieval configurations

### P0 - Critical

| Feature | Description | Status |
|---------|-------------|--------|
| Strategy Genome | Represent strategies as evolvable genomes | ✅ Completed |
| Knowledge Base | Persistent storage for learnings | ✅ Completed |
| Evolution Engine | Genetic algorithm for strategy optimization | ✅ Completed |

### P1 - Important

| Feature | Description | Status |
|---------|-------------|--------|
| Evolution Scheduler | Cron-based automatic evolution cycles | ✅ Completed |
| Auto-Deployment | Deploy winning configurations automatically | ✅ Completed |
| Regression Detection | Alert when quality drops | ✅ Completed |

### P2 - Nice to Have

| Feature | Description | Status |
|---------|-------------|--------|
| Multi-Objective Evolution | Optimize for quality + cost + latency | ✅ Completed |
| Strategy Lineage Tracking | Visualize evolution genealogy | ✅ Completed |

---

## Phase 3: Agent Integration 🤖

**Goal**: Full integration with AI agent ecosystems

### P0 - Critical

| Feature | Description | Status |
|---------|-------------|--------|
| MCP Server | Expose tools via Model Context Protocol | 🔲 Not Started |
| Structured Responses | Agent-friendly JSON output with recommendations | 🔲 Not Started |

### P1 - Important

| Feature | Description | Status |
|---------|-------------|--------|
| Webhook Notifications | Alert agents of improvements/regressions | 🔲 Not Started |
| API Mode | RESTful API for programmatic access | 🔲 Not Started |

### P2 - Nice to Have

| Feature | Description | Status |
|---------|-------------|--------|
| Federated Learning | Share learnings across agent instances | 🔲 Not Started |
| Privacy-Preserving Aggregation | Secure multi-party learning | 🔲 Not Started |

---

## Feature Details

### Synthetic Query Generation

```typescript
// Generate test queries from documents
embedeval research generate-queries \
  --corpus ./docs.jsonl \
  --provider openai \
  --model gpt-4 \
  --num-queries 100 \
  --difficulty mixed \
  --output ./synthetic-queries.jsonl
```

**Implementation**:
- Use LLM to generate questions that documents can answer
- Include difficulty levels (easy, medium, hard)
- Generate hard negatives for challenging evaluation
- Store with automatic relevance labels

---

### Knowledge Base

```typescript
interface KnowledgeBase {
  // Experiment tracking
  experiments: Experiment[];
  
  // Model performance profiles
  modelProfiles: Map<string, ModelProfile>;
  
  // Strategy performance by context
  strategyPerformance: Map<string, StrategyPerformance>;
  
  // Failure patterns and fixes
  failurePatterns: FailurePattern[];
  
  // Best practices (learned)
  bestPractices: BestPractice[];
  
  // Evolution history
  strategyLineage: StrategyGenome[];
}
```

**Storage**: SQLite for portability, with optional PostgreSQL for scale

---

### Hypothesis Engine

```typescript
// Auto-generate experiment proposals
const hypotheses = await engine.generateHypotheses({
  currentResults: evaluationResults,
  failurePatterns: analyzedFailures,
  knowledgeBase: kb,
});

// Returns:
[
  {
    hypothesis: "Semantic chunking improves long document retrieval",
    confidence: 0.7,
    expectedImprovement: 0.05,
    challenger: "semantic-chunks",
    conditions: { documentLength: "long" }
  }
]
```

---

### Evolution Engine

```typescript
// Run strategy evolution
const result = await evolution.run({
  populationSize: 20,
  generations: 10,
  fitnessMetric: 'ndcg@10',
  constraints: {
    maxLatencyMs: 500,
    maxCostPerQuery: 0.001
  }
});

// Returns best evolved strategy
{
  genome: {
    chunking: 'semantic',
    chunkSize: 384,
    retrieval: 'hybrid',
    hybridWeights: [0.6, 0.4],
    reranking: 'mmr',
    mmrLambda: 0.7
  },
  fitness: 0.84,
  generation: 10
}
```

---

### MCP Server Tools

| Tool | Description |
|------|-------------|
| `embedeval_evaluate` | Run evaluation on corpus/queries |
| `embedeval_experiment` | Run A/B test between strategies |
| `embedeval_evolve` | Start evolution optimization |
| `embedeval_discover` | Find new models/strategies |
| `embedeval_knowledge_query` | Query the knowledge base |
| `embedeval_knowledge_store` | Store new learnings |
| `embedeval_deploy` | Deploy a configuration |
| `embedeval_rollback` | Rollback to previous config |

---

## Success Metrics

### Phase 1 Success
- [ ] Can generate 100 synthetic queries in < 5 minutes
- [ ] Knowledge base tracks all experiments
- [ ] AI agents can run evaluations via CLI

### Phase 2 Success
- [ ] Evolution improves NDCG by 5%+ on test datasets
- [ ] Auto-deployment works with rollback safety
- [ ] Weekly evolution cycles run unattended

### Phase 3 Success
- [ ] MCP tools work with Claude/GPT agents
- [ ] Agents can self-improve their retrieval over time
- [ ] Federated learning shares insights across instances

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to contribute to these features.

Priority areas for contribution:
1. Synthetic query generation
2. Knowledge base implementation
3. MCP server tools

---

## Timeline

This is a living roadmap. Priorities may shift based on:
- User feedback
- AI agent ecosystem developments
- New embedding models/techniques

**Last Updated**: January 2026
