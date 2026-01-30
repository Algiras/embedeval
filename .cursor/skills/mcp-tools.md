# MCP Tools for EmbedEval Development

> Tools to create when building the self-evolving embedding researcher

## Recommended MCP Tools to Build

These tools would enhance your ability to develop and test EmbedEval:

---

## Tool: `embedeval_evaluate`

**Purpose**: Run quick evaluations from chat

```typescript
{
  name: "embedeval_evaluate",
  description: "Evaluate embedding quality on a dataset",
  input: {
    corpus: "path to corpus JSONL",
    queries: "path to queries JSONL", 
    provider: "ollama | openai | google | huggingface",
    model: "model name",
    strategy: "baseline | hybrid-bm25 | semantic-chunks | ...",
    metrics: ["ndcg@10", "recall@10", "mrr@10"]
  },
  output: {
    metrics: { ndcg10: 0.72, recall10: 0.65, ... },
    summary: "Moderate retrieval quality...",
    recommendations: ["Try hybrid-bm25 for +5% improvement"]
  }
}
```

---

## Tool: `embedeval_compare`

**Purpose**: Compare two strategies or models

```typescript
{
  name: "embedeval_compare",
  description: "A/B test two embedding configurations",
  input: {
    baseline: { provider, model, strategy },
    challenger: { provider, model, strategy },
    dataset: "path to evaluation data",
    significance: 0.05
  },
  output: {
    winner: "challenger",
    improvement: 0.08,
    pValue: 0.023,
    significant: true,
    recommendation: "Deploy challenger configuration"
  }
}
```

---

## Tool: `embedeval_generate_queries`

**Purpose**: Generate synthetic test queries from documents

```typescript
{
  name: "embedeval_generate_queries",
  description: "Generate test queries from a corpus using LLM",
  input: {
    corpus: "path to documents",
    numQueries: 50,
    difficulty: "easy | medium | hard | mixed",
    queryTypes: ["factual", "conceptual", "comparison"],
    llmProvider: "openai",
    llmModel: "gpt-4"
  },
  output: {
    queries: [
      { id, query, difficulty, relevantDocs, reasoning }
    ],
    savedTo: "./generated-queries.jsonl"
  }
}
```

---

## Tool: `embedeval_analyze_failures`

**Purpose**: Understand why certain queries fail

```typescript
{
  name: "embedeval_analyze_failures",
  description: "Analyze query failures to find patterns",
  input: {
    testId: "previous test run ID",
    threshold: 0.5  // NDCG below this = failure
  },
  output: {
    patterns: [
      {
        pattern: "long_query_failure",
        frequency: 0.23,
        description: "Queries > 100 chars fail more often",
        suggestedFix: "Try semantic chunking",
        examples: [...]
      }
    ],
    recommendations: [...]
  }
}
```

---

## Tool: `embedeval_discover_models`

**Purpose**: Find new embedding models to try

```typescript
{
  name: "embedeval_discover_models",
  description: "Discover new embedding models from HuggingFace/MTEB",
  input: {
    domain: "legal | medical | scientific | general",
    languages: ["en"],
    maxDimensions: 1024,
    minMtebScore: 0.5,
    limit: 10
  },
  output: {
    models: [
      {
        id: "BAAI/bge-large-en-v1.5",
        mtebScore: 0.634,
        dimensions: 1024,
        strengths: ["retrieval", "long documents"],
        license: "MIT"
      }
    ],
    suggestedExperiment: { ... }
  }
}
```

---

## Tool: `embedeval_evolve`

**Purpose**: Run strategy evolution optimization

```typescript
{
  name: "embedeval_evolve",
  description: "Evolve strategy configuration using genetic algorithm",
  input: {
    corpus: "path to corpus",
    queries: "path to queries",
    generations: 5,
    populationSize: 10,
    fitnessMetric: "ndcg@10",
    constraints: {
      maxLatencyMs: 500,
      maxCostPerQuery: 0.001
    }
  },
  output: {
    bestStrategy: {
      genome: { chunking, retrieval, reranking, ... },
      fitness: 0.84
    },
    improvement: 0.12,
    generations: [...],
    deployed: false
  }
}
```

---

## Tool: `embedeval_knowledge_query`

**Purpose**: Query the knowledge base for past learnings

```typescript
{
  name: "embedeval_knowledge_query",
  description: "Query knowledge base for past experiment results",
  input: {
    query: "best strategy for legal documents",
    // OR structured query:
    filters: {
      domain: "legal",
      metric: "ndcg@10",
      minScore: 0.7
    }
  },
  output: {
    results: [
      {
        strategy: "hybrid-bm25",
        avgNdcg: 0.78,
        experiments: 12,
        recommendation: "Confirmed effective for legal domain"
      }
    ],
    insights: [
      "BM25 helps with legal terminology exact matching",
      "Chunking less important for short legal clauses"
    ]
  }
}
```

---

## Implementation Guide

### 1. Create MCP Server

```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server';
import { evaluateTool } from './tools/evaluate';
import { compareTool } from './tools/compare';
// ... other tools

const server = new Server({
  name: 'embedeval',
  version: '1.0.0',
});

server.setRequestHandler('tools/list', () => ({
  tools: [evaluateTool, compareTool, ...],
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  const tool = tools.find(t => t.name === name);
  return tool.execute(args);
});

export { server };
```

### 2. Add to CLI

```typescript
// src/cli/commands/mcp-server.ts
import { program } from 'commander';
import { server } from '../../mcp/server';

program
  .command('mcp-server')
  .description('Start MCP server for AI agent integration')
  .option('--stdio', 'Use stdio transport')
  .action(async (options) => {
    if (options.stdio) {
      await server.connect(new StdioServerTransport());
    }
  });
```

### 3. Configure in Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "embedeval": {
      "command": "npx",
      "args": ["embedeval", "mcp-server", "--stdio"],
      "env": {
        "OPENAI_API_KEY": "${env:OPENAI_API_KEY}"
      }
    }
  }
}
```

---

## Using skillz MCP to Create Tools

If you have skillz MCP available, you can create these tools dynamically:

```
Create a tool called "embedeval_quick_eval" that:
1. Takes corpus path, queries path, and provider config
2. Runs EmbedEval evaluation
3. Returns metrics with interpretation
4. Suggests improvements based on results
```

This allows rapid prototyping of new evaluation workflows without modifying EmbedEval core code.
