# EmbedEval Development Workflow

> Workflows for common development tasks

## Workflow: Add New Feature

### 1. Planning Phase

```
User: I want to add [feature] to EmbedEval

AI Actions:
1. Check if similar feature exists (grep codebase)
2. Review AGENTS.md for architecture alignment
3. Check .cursorrules for coding standards
4. Propose implementation plan with:
   - Files to create/modify
   - Types to add
   - Tests needed
   - Documentation updates
```

### 2. Implementation Phase

```
Order of operations:
1. Add types to src/core/types.ts (if needed)
2. Implement core logic in appropriate module
3. Add to registry/factory if pluggable
4. Create CLI command wrapper
5. Add tests
6. Update documentation
```

### 3. Integration Phase

```
Checklist:
- [ ] Types exported from module index
- [ ] CLI command registered in index.ts
- [ ] Tests passing (npm test)
- [ ] Linting clean (npm run lint)
- [ ] Documentation updated
- [ ] Example config added (if applicable)
```

---

## Workflow: Debug Evaluation Issue

### 1. Gather Information

```bash
# Check recent test results
ls -la .embedeval/runs/

# Read specific test results
cat .embedeval/runs/<test-id>/results/metrics.json

# Check logs
cat .embedeval/logs/latest.log
```

### 2. Reproduce Issue

```bash
# Run with verbose logging
npm run dev -- ab-test \
  --config ./examples/config.yaml \
  --verbose

# Or specific query
npm run dev -- ab-test \
  --query "specific failing query" \
  --verbose
```

### 3. Analyze

```typescript
// Common issues:
// 1. Provider connection - check API keys
// 2. Cache corruption - clear .embedeval/cache/
// 3. Redis down - check docker/redis.sh status
// 4. Type mismatch - check corpus/query format
```

---

## Workflow: Add New Embedding Provider

### Quick Reference

```
1. src/providers/{name}.ts - Provider implementation
2. src/core/types.ts - Add {Name}Config interface
3. src/providers/index.ts - Add to createProvider factory
4. tests/providers/{name}.test.ts - Unit tests
5. README.md - Document new provider
6. examples/configs/{name}-example.yaml - Example config
```

### Checklist

```markdown
- [ ] Implements EmbeddingProvider interface
- [ ] Handles rate limiting
- [ ] Handles errors gracefully
- [ ] Supports batch embedding
- [ ] Returns correct dimensions
- [ ] Has working tests
- [ ] Documented in README
```

---

## Workflow: Add Evolution Feature

### Research First

```
1. Check docs/adr/ for related decisions
2. Review src/evolution/ existing code
3. Check knowledge base schema in types
4. Understand the evolution loop:
   Observe → Analyze → Hypothesize → Experiment → Learn → Deploy
```

### Implementation Pattern

```typescript
// New evolution components should:
// 1. Be stateless where possible
// 2. Use knowledge base for persistence
// 3. Support both manual and scheduled execution
// 4. Emit events for monitoring
// 5. Be testable in isolation
```

---

## Workflow: Performance Optimization

### 1. Profile Current State

```bash
# Run with timing
time npm run dev -- ab-test --config ./config.yaml

# Check cache hit rate
npm run dev -- cache stats
```

### 2. Identify Bottlenecks

```typescript
// Common bottlenecks:
// 1. API rate limits - increase batch size
// 2. Cache misses - warm cache first
// 3. Redis latency - check connection
// 4. Large documents - add chunking
```

### 3. Optimize

```yaml
# config.yaml optimizations
cache:
  maxSizeGB: 10
  warmupEnabled: true

processing:
  concurrency: 10
  batchSize: 100
```

---

## Workflow: Release New Version

### Pre-Release Checklist

```bash
# 1. Run all tests
npm test
npm run test:local  # if Ollama available

# 2. Check linting
npm run lint

# 3. Build
npm run build

# 4. Update version
npm version patch|minor|major

# 5. Update CHANGELOG.md
# 6. Create git tag
git tag v1.x.x

# 7. Push
git push origin main --tags
```

### Post-Release

```bash
# 1. Publish to npm (if configured)
npm publish --access public

# 2. Create GitHub release
gh release create v1.x.x --generate-notes

# 3. Update documentation site
```

---

## Workflow: Knowledge Base Operations

### Initialize Knowledge Base

```bash
embedeval init --knowledge-base ./kb
```

### Query Knowledge Base

```typescript
// From code
const kb = new KnowledgeBase('./kb');

// Get best strategies for context
const best = await kb.getBestStrategies({
  domain: 'legal',
  documentLength: 'long'
});

// Get experiment history
const history = await kb.getExperiments({
  status: 'confirmed',
  minImprovement: 0.05
});
```

### Backup Knowledge Base

```bash
# Create backup
tar -czf kb-backup-$(date +%Y%m%d).tar.gz ./kb

# Restore
tar -xzf kb-backup-YYYYMMDD.tar.gz
```

---

## Workflow: Agent Integration Testing

### Test MCP Tools

```bash
# Start MCP server
npm run dev -- mcp-server --stdio

# In another terminal, test with mcp-client
echo '{"method":"tools/list"}' | npm run dev -- mcp-server --stdio
```

### Simulate Agent Requests

```typescript
// tests/integration/agent.test.ts
describe('Agent Integration', () => {
  it('should evaluate and return recommendations', async () => {
    const response = await mcpClient.call('embedeval_evaluate', {
      corpus: './examples/sample-corpus.jsonl',
      queries: './examples/sample-queries.jsonl',
      provider: { type: 'ollama', model: 'nomic-embed-text' }
    });
    
    expect(response.status).toBe('success');
    expect(response.recommendations).toBeDefined();
  });
});
```

---

## Common Commands Reference

```bash
# Development
npm run dev -- <command>           # Run in dev mode
npm run build                       # Build TypeScript
npm test                            # Run tests
npm run lint                        # Check linting
npm run lint:fix                    # Fix linting issues

# Evaluation
npm run dev -- ab-test --config ./config.yaml
npm run dev -- ab-test --variants ollama:nomic-embed-text --dataset ./data.jsonl

# Strategy
npm run dev -- strategy --list
npm run dev -- strategy --info hybrid-bm25

# Providers
npm run dev -- providers --list
npm run dev -- providers --test ollama

# Cache
npm run dev -- cache stats
npm run dev -- cache clear

# Docker/Redis
./docker/redis.sh start
./docker/redis.sh stop
./docker/redis.sh status
```
