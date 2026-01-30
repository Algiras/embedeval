# Prompt: Implement New Feature

Use this prompt template when asking AI to implement new features for EmbedEval.

---

## Template

```
I want to add [FEATURE_NAME] to EmbedEval.

Context:
- EmbedEval is a self-evolving embedding evaluation system
- See docs/AGENTS.md for agent integration architecture
- See .cursorrules for coding standards
- Current architecture: providers → strategies → evaluation → evolution

Requirements:
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

Constraints:
- Must integrate with existing strategy system
- Must be accessible to AI agents
- Must be testable in isolation
- Follow TypeScript best practices

Expected deliverables:
1. Implementation files
2. Type definitions
3. Tests
4. Documentation updates
5. Example configuration
```

---

## Example: Add Hypothesis Generator

```
I want to add a Hypothesis Generator to EmbedEval.

Context:
- EmbedEval is a self-evolving embedding evaluation system
- See docs/AGENTS.md for agent integration architecture
- The evolution loop needs to automatically propose experiments

Requirements:
- Analyze current evaluation results to find improvement opportunities
- Generate hypotheses like "Hybrid BM25 may improve long document retrieval"
- Prioritize hypotheses by expected impact and confidence
- Check knowledge base to avoid repeating failed experiments

Constraints:
- Must integrate with existing strategy system
- Must be accessible to AI agents via MCP
- Must store generated hypotheses in knowledge base
- Follow TypeScript best practices

Expected deliverables:
1. src/research/hypothesis-engine.ts
2. Types in src/core/types.ts
3. Tests in tests/research/hypothesis-engine.test.ts
4. CLI command: embedeval research hypothesize
5. MCP tool: embedeval_generate_hypotheses
6. Update docs/AGENTS.md with hypothesis generation docs
```

---

## Example: Add Embedding Visualizer

```
I want to add an Embedding Visualizer to EmbedEval.

Context:
- EmbedEval evaluates embedding quality for retrieval
- Users need to understand their embedding space
- Visualization helps debug retrieval failures

Requirements:
- Generate t-SNE or UMAP visualization of embeddings
- Color by relevance, cluster, or custom attribute
- Output as interactive HTML (using Plotly or similar)
- Support filtering by query or document subset

Constraints:
- Should work with existing embedding cache
- Must handle large datasets (sample if needed)
- Pure TypeScript implementation (or use existing npm packages)
- Generate static HTML (no server required)

Expected deliverables:
1. src/analysis/embedding-visualizer.ts
2. CLI command: embedeval analyze visualize
3. Tests
4. Example output in examples/
```

---

## Example: Add Model Discovery

```
I want to add Model Discovery to EmbedEval.

Context:
- EmbedEval should help users find better embedding models
- HuggingFace has thousands of embedding models
- MTEB leaderboard ranks model performance

Requirements:
- Search HuggingFace for embedding models by criteria
- Fetch MTEB scores for discovered models
- Rank by relevance to user's domain/task
- Suggest experiments to test promising models

Constraints:
- Use HuggingFace API (no scraping)
- Cache model metadata in knowledge base
- Respect rate limits
- Return actionable recommendations

Expected deliverables:
1. src/research/model-discovery.ts
2. CLI command: embedeval research discover
3. MCP tool: embedeval_discover_models
4. Documentation in docs/AGENTS.md
```
