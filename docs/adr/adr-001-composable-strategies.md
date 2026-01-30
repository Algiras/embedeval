# ADR-001: Composable Strategy Pipeline

## Status

Accepted

## Context

The initial design of EmbedEval only supported comparing different embedding models using a fixed retrieval approach (cosine similarity). However, modern retrieval systems use complex pipelines involving:
- Document chunking strategies
- Multiple retrieval methods (BM25, embeddings, hybrid)
- Fusion techniques (RRF, weighted)
- Re-ranking (LLM-based, diversity)

We needed a way to compare not just models, but entire retrieval approaches.

## Decision

We will implement a **composable strategy pipeline** where:
1. Each strategy consists of multiple stages
2. Stages are composable and can be mixed/matched
3. Each stage transforms a context object
4. The pipeline is: Chunking → Embedding → Retrieval → Fusion → Re-ranking

### Key Design Elements

```typescript
interface StrategyStage {
  name: string;
  type: 'chunking' | 'embedding' | 'retrieval' | 'fusion' | 'reranking';
  execute(context: StrategyContext): Promise<StrategyContext>;
}

interface Strategy {
  name: string;
  stages: StrategyStage[];
}
```

## Consequences

### Positive

- **Flexibility**: Users can create any combination of approaches
- **Extensibility**: New stages can be added without changing existing code
- **Testability**: Each stage can be tested independently
- **Clarity**: Pipeline structure is explicit and readable
- **Research**: Enables systematic comparison of approaches

### Negative

- **Complexity**: More complex than a simple model comparison tool
- **Learning Curve**: Users need to understand the pipeline concept
- **Performance**: Multiple stages add overhead
- **Debugging**: More complex to debug multi-stage pipelines

## Alternatives Considered

### Alternative 1: Fixed Strategies

Pre-defined strategies only (baseline, hybrid, etc.).

**Rejected**: Too limiting. Users need to experiment with custom combinations.

### Alternative 2: Configuration-based

JSON/YAML configuration files only, no code.

**Rejected**: Not flexible enough for complex custom logic.

### Alternative 3: Plugin System

Dynamic plugin loading from npm packages.

**Considered for future**: Good idea but adds complexity for v1.0.

## Implementation Notes

- StrategyRegistry manages available stages
- StrategyExecutor runs pipelines
- Context object passes data between stages
- Predefined strategies cover common use cases
- Custom strategies can be defined in config

## References

- [Strategy System Documentation](../../STRATEGY_SYSTEM.md)
- [Composable Pipeline Pattern](https://en.wikipedia.org/wiki/Chain-of-responsibility_pattern)

## Date

2024-01-30

## Author

Algiras <kras.algim@gmail.com>
