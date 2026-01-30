# EmbedEval Agent Integration Guide

> **Mission**: Transform EmbedEval into a self-evolving embedding researcher that AI agents can use to continuously improve their retrieval systems.

## Overview

EmbedEval is designed to be used by AI agents (like OpenClaw, Claude, or custom agents) to:
1. **Evaluate** embedding and retrieval quality
2. **Experiment** with different strategies
3. **Evolve** configurations automatically
4. **Deploy** improvements without human intervention

---

## Architecture for AI Agents

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI AGENT (e.g., OpenClaw)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  "I need to improve my memory retrieval"                            │
│                    │                                                 │
│                    ▼                                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    EMBEDEVAL MCP SERVER                       │  │
│  │  ┌─────────────┬─────────────┬─────────────┬──────────────┐  │  │
│  │  │  evaluate   │  experiment │   evolve    │   discover   │  │  │
│  │  │             │             │             │              │  │  │
│  │  │ Run A/B     │ Test hypo-  │ Auto-      │ Find new     │  │  │
│  │  │ tests       │ theses      │ optimize   │ models       │  │  │
│  │  └─────────────┴─────────────┴─────────────┴──────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Agent Capabilities

### 1. Evaluation Capabilities

Agents can request evaluations to understand their current retrieval quality:

```yaml
# Agent Request: "Evaluate my current memory retrieval"
action: evaluate
config:
  corpus: ./agent-memory/corpus.jsonl
  queries: ./agent-memory/recent-queries.jsonl
  provider:
    type: openai
    model: text-embedding-3-small
  strategy: baseline
  metrics:
    - ndcg@10
    - recall@10
    - mrr@10
```

**Response to Agent:**
```json
{
  "status": "completed",
  "summary": {
    "ndcg@10": 0.72,
    "recall@10": 0.65,
    "mrr@10": 0.58
  },
  "interpretation": "Moderate retrieval quality. Consider hybrid BM25 for +5-8% improvement.",
  "recommendations": [
    "hybrid-bm25 strategy shows +5.4% NDCG improvement in similar corpora",
    "semantic-chunks may help with your long documents (avg 2,400 tokens)"
  ]
}
```

### 2. Experimentation Capabilities

Agents can propose and run experiments:

```yaml
# Agent Request: "Test if chunking improves my retrieval"
action: experiment
hypothesis: "Semantic chunking improves retrieval for long documents"
variants:
  - name: baseline
    strategy: baseline
  - name: semantic-chunks
    strategy: semantic-chunks
    config:
      maxSize: 512
      overlap: 50
gates:
  ndcg@10:
    improvement: 0.05  # Must improve by 5%
```

**Response to Agent:**
```json
{
  "status": "completed",
  "hypothesis_confirmed": true,
  "results": {
    "baseline": { "ndcg@10": 0.72 },
    "semantic-chunks": { "ndcg@10": 0.78 }
  },
  "improvement": 0.083,
  "statistical_significance": {
    "p_value": 0.023,
    "significant": true
  },
  "recommendation": "DEPLOY semantic-chunks strategy"
}
```

### 3. Evolution Capabilities

Agents can trigger autonomous optimization:

```yaml
# Agent Request: "Optimize my retrieval configuration"
action: evolve
config:
  population_size: 10
  generations: 5
  fitness_metric: ndcg@10
  mutation_rate: 0.2
  auto_deploy: true
  auto_deploy_threshold: 0.80
constraints:
  max_latency_ms: 500
  max_cost_per_query: 0.001
```

**Response to Agent:**
```json
{
  "status": "completed",
  "generations_run": 5,
  "best_strategy": {
    "name": "evolved-gen5-champion",
    "genome": {
      "chunking": "semantic",
      "chunkSize": 384,
      "retrieval": "hybrid",
      "hybridWeights": [0.6, 0.4],
      "reranking": "mmr",
      "mmrLambda": 0.7
    },
    "fitness": 0.84
  },
  "improvement_over_baseline": 0.167,
  "deployed": true
}
```

### 4. Discovery Capabilities

Agents can discover new models and strategies:

```yaml
# Agent Request: "Find better embedding models for my use case"
action: discover
context:
  domain: "legal documents"
  languages: ["en"]
  document_length: "long"
  current_model: "text-embedding-3-small"
sources:
  - huggingface
  - mteb_leaderboard
```

**Response to Agent:**
```json
{
  "status": "completed",
  "recommendations": [
    {
      "model": "BAAI/bge-large-en-v1.5",
      "source": "huggingface",
      "mteb_score": 0.634,
      "reason": "Top performer for retrieval tasks, good for long documents"
    },
    {
      "model": "sentence-transformers/gtr-t5-xxl",
      "source": "huggingface", 
      "mteb_score": 0.621,
      "reason": "Excellent for legal domain based on LegalBench"
    }
  ],
  "suggested_experiment": {
    "variants": ["current", "bge-large", "gtr-t5"],
    "estimated_improvement": "5-15%"
  }
}
```

---

## Self-Evolution Loop

The core innovation is the **autonomous evolution loop**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVOLUTION LOOP (runs weekly)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. OBSERVE                                                     │
│      └─▶ Collect recent query logs                              │
│      └─▶ Measure current retrieval quality                      │
│      └─▶ Detect performance drift                               │
│                                                                  │
│   2. ANALYZE                                                     │
│      └─▶ Identify failure patterns                              │
│      └─▶ Cluster queries by performance                         │
│      └─▶ Find optimization opportunities                        │
│                                                                  │
│   3. HYPOTHESIZE                                                 │
│      └─▶ Generate experiment proposals                          │
│      └─▶ Prioritize by expected impact                          │
│      └─▶ Check knowledge base for past results                  │
│                                                                  │
│   4. EXPERIMENT                                                  │
│      └─▶ Run A/B tests                                          │
│      └─▶ Evaluate statistical significance                      │
│      └─▶ Measure cost/latency tradeoffs                         │
│                                                                  │
│   5. LEARN                                                       │
│      └─▶ Update knowledge base                                  │
│      └─▶ Record what worked/failed                              │
│      └─▶ Adjust hypothesis generator                            │
│                                                                  │
│   6. DEPLOY                                                      │
│      └─▶ Auto-promote winning configurations                    │
│      └─▶ Update production config                               │
│      └─▶ Monitor for regressions                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Knowledge Base Schema

The knowledge base stores learnings for continuous improvement:

```typescript
interface KnowledgeBase {
  // Experiment history
  experiments: Experiment[];
  
  // Model performance profiles
  modelProfiles: Map<string, ModelProfile>;
  
  // Strategy performance by context
  strategyPerformance: Map<string, StrategyPerformance>;
  
  // Failure patterns
  failurePatterns: FailurePattern[];
  
  // Best practices (learned)
  bestPractices: BestPractice[];
  
  // Evolution genealogy
  strategyLineage: StrategyGenome[];
}

interface Experiment {
  id: string;
  hypothesis: string;
  timestamp: Date;
  variants: Variant[];
  results: Results;
  outcome: 'confirmed' | 'rejected' | 'inconclusive';
  learnings: string[];
}

interface ModelProfile {
  modelId: string;
  provider: string;
  dimensions: number;
  avgLatency: number;
  costPer1kTokens: number;
  strengthDomains: string[];
  weaknessDomains: string[];
  performanceByTask: Map<string, number>;
}

interface StrategyPerformance {
  strategyName: string;
  avgNdcg: number;
  avgLatency: number;
  bestForContexts: string[];  // e.g., "long-docs", "short-queries"
  worstForContexts: string[];
}

interface FailurePattern {
  pattern: string;
  frequency: number;
  suggestedFix: string;
  fixSuccessRate: number;
}
```

---

## Integration Examples

### Example 1: OpenClaw Memory Enhancement

```yaml
# openclaw-weekly-evolution.yaml
# Run every Sunday at midnight

schedule: "0 0 * * 0"

evolution:
  name: "OpenClaw Memory Evolution"
  corpus: /openclaw/memory-corpus.jsonl
  queries: /openclaw/query-logs/last-week.jsonl
  
  observe:
    drift_detection: true
    failure_analysis: true
    
  experiment:
    max_variants: 5
    statistical_confidence: 0.95
    
  deploy:
    auto_deploy: true
    threshold:
      ndcg@10: 0.80
      improvement: 0.03
    rollback_on_regression: true
    
  notify:
    on_improvement: webhook://openclaw/embedding-improved
    on_regression: webhook://openclaw/embedding-regressed
```

### Example 2: RAG Pipeline Optimization

```yaml
# rag-optimizer.yaml
# Continuous optimization for RAG application

name: "RAG Pipeline Optimizer"

targets:
  - name: retrieval
    current_strategy: baseline
    optimization_goal: maximize ndcg@10
    constraints:
      latency_p95: 200ms
      cost_per_query: $0.0005

  - name: reranking
    current_strategy: none
    optimization_goal: maximize precision@5
    constraints:
      latency_p95: 500ms

experiments:
  - hypothesis: "Hybrid BM25 improves retrieval"
    challenger: hybrid-bm25
    
  - hypothesis: "LLM reranking improves precision"
    challenger: llm-reranked
    only_if: retrieval.ndcg@10 > 0.75
```

### Example 3: Multi-Agent Knowledge Sharing

```yaml
# federated-learning.yaml
# Share learnings across agent instances

federation:
  enabled: true
  central_server: https://embedeval-hub.example.com
  
  share:
    - model_profiles
    - strategy_performance
    - failure_patterns
    
  receive:
    - best_practices
    - new_model_recommendations
    
  privacy:
    anonymize_queries: true
    aggregate_only: true
```

---

## CLI Commands for Agents

```bash
# Evaluate current configuration
embedeval agent evaluate \
  --corpus ./corpus.jsonl \
  --queries ./queries.jsonl \
  --output-format json

# Run experiment
embedeval agent experiment \
  --hypothesis "hybrid beats baseline" \
  --baseline baseline \
  --challenger hybrid-bm25 \
  --confidence 0.95

# Start evolution
embedeval agent evolve \
  --generations 10 \
  --population 20 \
  --auto-deploy

# Query knowledge base
embedeval agent knowledge \
  --query "best strategy for legal documents"

# Discover new models
embedeval agent discover \
  --domain "scientific papers" \
  --constraint "latency < 100ms"
```

---

## MCP Server Tools

When running as an MCP server, EmbedEval exposes these tools:

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

## Getting Started for Agent Developers

### 1. Install EmbedEval

```bash
npm install -g embedeval
```

### 2. Initialize Knowledge Base

```bash
embedeval init --knowledge-base ./kb
```

### 3. Run First Evaluation

```bash
embedeval agent evaluate \
  --corpus ./your-corpus.jsonl \
  --queries ./your-queries.jsonl
```

### 4. Start Evolution Loop

```bash
embedeval agent evolve --auto-deploy
```

### 5. Connect to MCP (optional)

```json
{
  "mcpServers": {
    "embedeval": {
      "command": "embedeval",
      "args": ["mcp-server"],
      "env": {
        "OPENAI_API_KEY": "your-key"
      }
    }
  }
}
```

---

## Best Practices for AI Agents

1. **Start Simple**: Begin with baseline strategy, then evolve
2. **Log Everything**: Save all queries for synthetic data generation
3. **Set Gates**: Always define quality thresholds before deploying
4. **Monitor Drift**: Run weekly evaluations to detect degradation
5. **Trust but Verify**: Auto-deploy with rollback capability
6. **Share Learnings**: Contribute to federated knowledge base

---

## Roadmap

### Phase 1: Core Agent Support (Current)
- [x] A/B testing framework
- [x] Strategy system
- [x] Statistical significance testing
- [ ] Agent CLI commands
- [ ] MCP server implementation

### Phase 2: Self-Evolution
- [ ] Hypothesis generator
- [ ] Evolution scheduler
- [ ] Auto-deployment
- [ ] Knowledge base

### Phase 3: Intelligence
- [ ] Failure analysis
- [ ] Model discovery
- [ ] Synthetic data generation
- [ ] Embedding visualization

### Phase 4: Federation
- [ ] Multi-agent sharing
- [ ] Centralized knowledge hub
- [ ] Privacy-preserving aggregation

---

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines on contributing to the agent integration features.

---

*Built for AI agents that want to get smarter over time.* 🤖
