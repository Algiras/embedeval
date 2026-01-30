# ADR-002: BullMQ for Parallel Processing

## Status

Accepted

## Context

Embedding evaluation involves:
- Processing thousands of queries
- Generating embeddings for queries and documents
- Computing similarity scores
- Running multiple variants (models/strategies)

This is computationally expensive and time-consuming when done sequentially. We needed a way to:
1. Process queries in parallel
2. Distribute work across CPU cores
3. Handle failures gracefully
4. Support resumable operations

## Decision

We will use **BullMQ** with **Redis** for job queue management:
1. Each query evaluation is a job
2. Jobs are processed by worker pools
3. Redis persists job state
4. Checkpointing saves progress per query

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Queue     │────▶│   Redis     │────▶│   Workers   │
│  (BullMQ)   │     │  (State)    │     │ (Processor) │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Consequences

### Positive

- **Performance**: Parallel processing reduces evaluation time significantly
- **Reliability**: Redis persistence prevents data loss
- **Scalability**: Can add more workers as needed
- **Resilience**: Failed jobs can be retried
- **Observability**: Built-in job monitoring and metrics

### Negative

- **Infrastructure**: Requires Redis server
- **Complexity**: Additional service to manage
- **Overhead**: Job queue adds latency for small datasets
- **Docker**: Local development requires Docker for Redis

## Alternatives Considered

### Alternative 1: Node.js Worker Threads

Use Node.js built-in worker_threads module.

**Rejected**: 
- No built-in persistence
- No job retry mechanism
- Harder to monitor

### Alternative 2: p-map (In-process)

Use p-map library for in-process parallelism.

**Rejected**:
- No persistence across crashes
- Limited to single machine
- No job queue features

### Alternative 3: RabbitMQ

Use RabbitMQ as message broker.

**Rejected**:
- More complex setup than Redis
- Overkill for our use case
- BullMQ has better Node.js integration

## Implementation Notes

- Redis runs in Docker for local development
- CheckpointManager saves progress after each query
- Jobs are idempotent (can be retried safely)
- Concurrency is configurable (default: 5 workers)

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Persistence](https://redis.io/docs/manual/persistence/)

## Date

2024-01-30

## Author

Algiras <kras.algim@gmail.com>
