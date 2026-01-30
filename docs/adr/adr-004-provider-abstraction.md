# ADR-004: Provider Abstraction Layer

## Status

Accepted

## Context

EmbedEval needs to support multiple embedding providers:
- Local models (Ollama)
- Cloud APIs (OpenAI, Google, HuggingFace)
- Custom endpoints (OpenRouter, self-hosted)

Each provider has:
- Different APIs
- Different authentication methods
- Different response formats
- Different capabilities (batch, streaming, etc.)

We needed a unified interface to treat all providers equally.

## Decision

We will implement a **Provider Abstraction Layer** with:
1. Common `EmbeddingProvider` interface
2. Factory pattern for provider creation
3. Provider-specific implementations
4. Runtime provider selection

### Interface Design

```typescript
interface EmbeddingProvider {
  name: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getModelInfo(): ModelInfo;
}

function createProvider(config: ProviderConfig): EmbeddingProvider;
```

### Supported Providers

1. **Ollama** - Local models via HTTP
2. **OpenAI** - OpenAI API + compatible endpoints
3. **Google** - Gemini Embedding API
4. **HuggingFace** - HF Inference API + custom endpoints

## Consequences

### Positive

- **Uniformity**: All providers implement same interface
- **Extensibility**: Easy to add new providers
- **Testing**: Can mock providers for testing
- **Flexibility**: Users can switch providers easily
- **A/B Testing**: Can compare providers directly

### Negative

- **Lowest Common Denominator**: Some provider features may not be exposed
- **Complexity**: Need to handle provider-specific quirks
- **Maintenance**: Must update when provider APIs change
- **Error Handling**: Different providers have different error types

## Alternatives Considered

### Alternative 1: Direct API Calls

Call each provider's API directly without abstraction.

**Rejected**:
- Code duplication
- Hard to compare providers
- Difficult to test

### Alternative 2: Third-Party SDK

Use a library like LangChain for provider management.

**Rejected**:
- Adds heavy dependency
- Less control over implementation
- Potential vendor lock-in

### Alternative 3: GraphQL Federation

Use GraphQL to unify different APIs.

**Rejected**:
- Overkill for simple embedding calls
- Adds unnecessary complexity

## Implementation Notes

- Each provider is in a separate file
- Factory function handles provider instantiation
- Config validation per provider type
- Error translation to common format

## References

- [Factory Pattern](https://en.wikipedia.org/wiki/Factory_method_pattern)
- [Adapter Pattern](https://en.wikipedia.org/wiki/Adapter_pattern)
- [OpenAI API](https://platform.openai.com/docs/api-reference)

## Date

2024-01-30

## Author

Algiras <kras.algim@gmail.com>
