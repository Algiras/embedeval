# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the EmbedEval project.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences. ADRs help teams understand why certain decisions were made and provide historical context for future developers.

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](adr-001-composable-strategies.md) | Composable Strategy Pipeline | Accepted | 2024-01-30 |
| [ADR-002](adr-002-bullmq-for-parallel-processing.md) | BullMQ for Parallel Processing | Accepted | 2024-01-30 |
| [ADR-003](adr-003-binary-embedding-cache.md) | Binary Embedding Cache | Accepted | 2024-01-30 |
| [ADR-004](adr-004-provider-abstraction.md) | Provider Abstraction Layer | Accepted | 2024-01-30 |
| [ADR-005](adr-005-per-query-checkpointing.md) | Per-Query Checkpointing | Accepted | 2024-01-30 |
| [ADR-006](adr-006-typescript-strict-mode.md) | TypeScript Strict Mode | Accepted | 2024-01-30 |

## ADR Template

See [adr-template.md](adr-template.md) for the template used to create new ADRs.

## Contributing

When making significant architectural decisions:
1. Create a new ADR using the template
2. Discuss with the team
3. Update the index above
4. Submit a PR

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Michael Nygard's Article on ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
