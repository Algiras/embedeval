# ADR-003: Binary Embedding Cache

## Status

Accepted

## Context

Embedding generation is expensive:
- API calls cost money (OpenAI, Google)
- Local models take time (Ollama)
- Same documents/queries are often re-embedded

For A/B testing, we:
- Test multiple strategies on same data
- Re-run experiments with different parameters
- Compare models on identical queries

Without caching, we'd regenerate embeddings repeatedly.

## Decision

We will implement a **binary embedding cache** with:
1. SHA-256 keys based on (text + provider + model)
2. Binary storage (8 bytes per float)
3. LRU eviction with 10GB limit
4. Filesystem-based storage

### Storage Format

```
.embedeval/cache/embeddings/
├── {hash}.bin          # Binary embedding data
└── index.json          # Metadata index
```

### Key Features

- **Binary Format**: Fast I/O, compact storage
- **LRU Eviction**: Automatically removes old entries
- **10GB Limit**: Configurable cache size
- **Persistent**: Survives process restarts

## Consequences

### Positive

- **Cost Savings**: Reduces API calls significantly
- **Speed**: Loading from disk is faster than regenerating
- **Reproducibility**: Same embeddings for same inputs
- **Offline Work**: Can work offline if cache is warm

### Negative

- **Disk Usage**: Up to 10GB of disk space
- **Warm-up**: First run is slow (cold cache)
- **Invalidation**: Model changes require cache clear
- **Portability**: Cache is machine-specific

## Alternatives Considered

### Alternative 1: No Cache

Generate embeddings every time.

**Rejected**: Too expensive and slow for iterative development.

### Alternative 2: In-Memory Cache

Store embeddings in memory only.

**Rejected**:
- Lost on process restart
- Limited by RAM
- Not suitable for large datasets

### Alternative 3: Redis Cache

Store embeddings in Redis.

**Rejected**:
- Adds complexity (another service)
- Network overhead
- Overkill for local filesystem access

### Alternative 4: SQLite Cache

Use SQLite database for storage.

**Considered**:
- Good for metadata
- Binary storage in SQLite is complex
- Filesystem is simpler for binary data

## Implementation Notes

- Uses Node.js Buffer for binary operations
- SHA-256 for deterministic keys
- LRU tracking via file timestamps
- Atomic writes (write to temp, then rename)

## References

- [LRU Cache Algorithm](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU))
- [Node.js Buffer](https://nodejs.org/api/buffer.html)

## Date

2024-01-30

## Author

Algiras <kras.algim@gmail.com>
