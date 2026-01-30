# Prompt: Debug Issue

Use this prompt template when asking AI to help debug issues in EmbedEval.

---

## Template

```
I'm experiencing an issue with EmbedEval:

Error/Symptom:
[Describe what's happening]

Expected Behavior:
[What should happen instead]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Environment:
- Node version: [version]
- EmbedEval version: [version]
- OS: [macOS/Linux/Windows]
- Provider being used: [ollama/openai/etc]

Relevant logs:
```
[paste logs here]
```

What I've tried:
- [Attempt 1]
- [Attempt 2]
```

---

## Example: Provider Connection Issue

```
I'm experiencing an issue with EmbedEval:

Error/Symptom:
Getting "Connection refused" when trying to use Ollama provider

Expected Behavior:
Should connect to Ollama and generate embeddings

Steps to Reproduce:
1. Start fresh terminal
2. Run: npm run dev -- ab-test --variants ollama:nomic-embed-text --dataset ./examples/sample-queries.jsonl
3. Error appears after ~5 seconds

Environment:
- Node version: 18.17.0
- EmbedEval version: 1.0.0
- OS: macOS 14.0
- Provider being used: Ollama

Relevant logs:
```
[2024-01-15 10:30:45] ERROR: Provider ollama failed: Connection refused
  at OllamaProvider.embed (src/providers/ollama.ts:42)
  Error: connect ECONNREFUSED 127.0.0.1:11434
```

What I've tried:
- Checked Ollama is installed (ollama --version works)
- Tried restarting terminal
- Verified model is pulled (ollama list shows nomic-embed-text)
```

---

## Example: Evaluation Metric Issue

```
I'm experiencing an issue with EmbedEval:

Error/Symptom:
NDCG scores are always 0 even when relevant documents are retrieved

Expected Behavior:
NDCG should be > 0 when relevant documents appear in top results

Steps to Reproduce:
1. Create dataset with known relevant docs
2. Run evaluation: npm run dev -- ab-test --config ./my-config.yaml
3. Check results - all NDCG values are 0

Environment:
- Node version: 20.0.0
- EmbedEval version: 1.0.0
- OS: Ubuntu 22.04
- Provider being used: OpenAI

Relevant logs:
```
Results:
{
  "metrics": {
    "ndcg@10": 0,
    "recall@10": 0.8,
    "mrr@10": 0.5
  }
}
```

What I've tried:
- Verified relevantDocs IDs match corpus document IDs
- Checked that retrieved docs include relevant ones
- Recall and MRR look correct, only NDCG is 0
```

---

## Example: Redis/BullMQ Issue

```
I'm experiencing an issue with EmbedEval:

Error/Symptom:
Jobs are stuck in "waiting" state and never complete

Expected Behavior:
Jobs should be processed by workers and complete

Steps to Reproduce:
1. Start Redis: ./docker/redis.sh start
2. Run evaluation with multiple queries
3. Jobs appear in queue but never process

Environment:
- Node version: 18.17.0
- EmbedEval version: 1.0.0
- OS: macOS 14.0
- Redis version: 7.0

Relevant logs:
```
[2024-01-15 10:30:45] INFO: Added 100 jobs to queue
[2024-01-15 10:30:45] INFO: Starting 5 workers
[2024-01-15 10:35:45] WARN: No jobs completed in 5 minutes
```

What I've tried:
- Restarted Redis
- Cleared the queue: redis-cli FLUSHALL
- Checked Redis connection: redis-cli PING returns PONG
```

---

## Debugging Checklist for AI

When debugging EmbedEval issues, check:

1. **Environment**
   - [ ] Node version >= 18
   - [ ] Required env vars set (OPENAI_API_KEY, etc.)
   - [ ] Redis running (for BullMQ features)

2. **Provider Issues**
   - [ ] API keys valid
   - [ ] Service accessible (Ollama running, API endpoints reachable)
   - [ ] Model exists/pulled

3. **Data Format**
   - [ ] JSONL files are valid JSON
   - [ ] Required fields present (id, query, relevantDocs)
   - [ ] Document IDs match between queries and corpus

4. **Cache Issues**
   - [ ] Cache directory writable
   - [ ] Not exceeding disk space
   - [ ] Try clearing cache: rm -rf .embedeval/cache

5. **BullMQ Issues**
   - [ ] Redis accessible
   - [ ] No stale workers
   - [ ] Queue not paused
