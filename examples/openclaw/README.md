# OpenClaw Self-Improvement Examples

This directory contains example configurations showing how [OpenClaw](https://github.com/openclaw) and other AI agents can use EmbedEval for systematic self-improvement of their knowledge and memory systems.

## Examples Overview

### 1. Memory Quality Evaluation
**File:** `openclaw-memory-eval.yaml`

Basic memory quality assessment comparing different embedding strategies:
- Current vs improved memory strategies
- Local (Ollama) vs cloud (OpenAI) options
- Quality gates to ensure minimum performance

**Use Case:** Weekly memory quality audits to ensure retrieval accuracy

```bash
embedeval ab-test --config openclaw-memory-eval.yaml
```

### 2. Knowledge Clustering
**File:** `openclaw-clustering-eval.yaml`

Test different clustering strategies for organizing information:
- Semantic clustering (by meaning)
- Topic-based clustering (by tags)
- Hybrid clustering (semantic + keywords)

**Use Case:** Optimize how information is organized for better discovery

```bash
embedeval ab-test --config openclaw-clustering-eval.yaml
```

### 3. Cross-Agent Information Sharing
**File:** `openclaw-federated-sharing.yaml`

Evaluate federated knowledge sharing between multiple agent instances:
- Shared embedding spaces
- Federated search across agents
- Ensemble retrieval strategies

**Use Case:** Multiple OpenClaw instances sharing knowledge collectively

```bash
embedeval ab-test --config openclaw-federated-sharing.yaml
```

### 4. Weekly Quality Monitoring
**File:** `openclaw-weekly-quality-check.yaml`

Automated quality monitoring configuration:
- Scheduled quality assessments
- Threshold-based alerts
- Trend tracking over time

**Use Case:** Continuous monitoring to detect knowledge degradation

```bash
# Run manually
embedeval ab-test --config openclaw-weekly-quality-check.yaml

# Or schedule via cron (see openclaw-weekly-monitor.sh)
```

### 5. Automated Monitoring Script
**File:** `openclaw-weekly-monitor.sh`

Bash script for automated quality monitoring:
- Runs weekly evaluation
- Checks quality thresholds
- Triggers re-optimization if needed
- Maintains quality trend CSV

**Setup:**
```bash
# Make executable
chmod +x openclaw-weekly-monitor.sh

# Add to crontab for weekly runs
0 2 * * 0 /path/to/openclaw-weekly-monitor.sh
```

### 6. Cost Optimization
**File:** `openclaw-cost-optimization.yaml`

Compare expensive vs cheap embedding strategies:
- Premium (OpenAI Large) vs Budget (HuggingFace)
- Cost per query analysis
- Quality vs cost tradeoffs

**Use Case:** Optimize costs as knowledge corpus scales to millions of documents

```bash
embedeval ab-test --config openclaw-cost-optimization.yaml
```

## How OpenClaw Could Use These

### Continuous Improvement Workflow

1. **Weekly Monitoring** (Automated)
   ```bash
   # Run every Sunday at 2 AM
   ./openclaw-weekly-monitor.sh
   ```

2. **Monthly Strategy Review** (Manual)
   ```bash
   # Test new strategies monthly
   embedeval ab-test --config openclaw-memory-eval.yaml
   embedeval ab-test --config openclaw-clustering-eval.yaml
   ```

3. **Quarterly Cost Optimization** (Manual)
   ```bash
   # Review costs as corpus grows
   embedeval ab-test --config openclaw-cost-optimization.yaml
   ```

### Integration with OpenClaw

OpenClaw could integrate EmbedEval in several ways:

**Option 1: External Evaluation**
```bash
# OpenClaw exports knowledge, EmbedEval evaluates
openclaw export-knowledge --format jsonl
embedeval ab-test --config openclaw-memory-eval.yaml
openclaw import-results --apply-if-better
```

**Option 2: Library Integration**
```typescript
// OpenClaw uses EmbedEval as a library
import { EnhancedABTestingEngine } from 'embedeval';

const engine = new EnhancedABTestingEngine(config);
const results = await engine.run(testCases, documents);

if (results.overallScore > threshold) {
  await openclaw.updateMemoryStrategy(newStrategy);
}
```

**Option 3: CI/CD Pipeline**
```yaml
# .github/workflows/memory-quality.yml
name: Memory Quality Check
on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly
jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: embedeval ab-test --config examples/openclaw-weekly-quality-check.yaml
      - run: ./scripts/check-quality-gates.sh
```

## Benefits for AI Agents

- 🧠 **Better Context** — Ensure most relevant information is retrieved
- 💰 **Cost Control** — Find optimal quality/cost balance
- ⚡ **Speed Optimization** — Test latency vs quality tradeoffs
- 📊 **Measurable Improvement** — Track performance over time
- 🔄 **Continuous Learning** — Automated A/B testing
- 🌐 **Knowledge Sharing** — Federated learning across agents

## Customization

These examples use placeholder data paths:
- `./data/openclaw-*-queries.jsonl`
- `./data/openclaw-*-corpus.jsonl`

Replace these with your actual OpenClaw data exports.

## Support

If these examples help your AI agent improve, consider supporting EmbedEval:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/Algiras)

Your support helps build better tools for AI agent self-improvement!

## More Information

- [OpenClaw GitHub](https://github.com/openclaw)
- [EmbedEval Documentation](../README.md)
- [Meta-Evaluation Results](https://algiras.github.io/embedeval/)
