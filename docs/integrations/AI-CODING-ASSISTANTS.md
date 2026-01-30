# AI Coding Assistant Integration Guide

> **Claude Code** and **OpenCode** can help EmbedEval continuously improve by running evaluations, analyzing results, and suggesting optimizations.

## Overview

AI coding assistants can:
1. **Run Evaluations** — Execute A/B tests and experiments automatically
2. **Analyze Results** — Interpret metrics and identify improvement opportunities
3. **Generate Configurations** — Create new evaluation configs for testing
4. **Iterate** — Continuously refine based on results
5. **Document** — Update knowledge base with findings

---

## Choosing the Right Approach

### When NOT to Use Evolution/Genetic Algorithms

You're right to question this! **Evolution is often overkill** because:

- **Finite permutations**: Only ~1,750 configuration combinations (providers × models × strategies × chunking)
- **Static data**: If your corpus doesn't change, just test once and done
- **Simple needs**: Grid search or A/B testing is faster and clearer
- **Limited budget**: Evolution requires many evaluations ($$$)

**Use simple A/B testing when:**
- You have < 1,000 queries
- Corpus is stable
- You want results in hours, not days
- Budget is limited

### When Evolution Makes Sense

**Evolution IS useful for:**
- **Continuous improvement**: Weekly re-optimization as data changes
- **Multi-objective optimization**: Balance quality + cost + speed simultaneously
- **Learning over time**: Build knowledge of what works for YOUR specific data
- **Complex tradeoffs**: When you can't afford the "best" model, find optimal cost/quality balance

**Think of it as:**
- Simple A/B = "Test A vs B, pick winner" ✓ Fast, clear
- Grid search = "Test all combinations" ✓ Thorough, expensive
- Evolution = "Learn what works over time" ✓ Adaptive, continuous

### Recommended: Start Simple

```
Phase 1 (Week 1): Simple A/B Test
└─ Test 3-5 strategies on your data
└─ Pick winner manually

Phase 2 (Month 1-3): Smart Selection
└─ Use rule-based selection from Phase 1 learnings
└─ Test only promising candidates

Phase 3 (Ongoing): Evolution (if needed)
└─ Only if data changes frequently
└─ Only if you need continuous optimization
└─ Only after you understand your data
```

**Most users never need Phase 3!** Simple A/B testing with smart selection covers 90% of use cases.

---

## Claude Code Integration

### Setup

Add to your `.claude/CLAUDE.md` or project instructions:

```markdown
# EmbedEval Integration

## Available Commands

- `embedeval ab-test --config <file>` — Run A/B test
- `embedeval strategy --list` — List available strategies
- `embedeval providers --list` — List available providers

## Workflow

When asked to improve embedding performance:
1. Check current configuration in examples/
2. Run baseline evaluation
3. Propose improvements (new models, strategies)
4. Create experiment configs
5. Run A/B tests
6. Analyze results and recommend
7. Update configuration if improved

## Key Metrics

- NDCG@10 — Overall quality (target: >0.75)
- Recall@10 — Coverage (target: >0.70)
- MRR@10 — Ranking quality
- Latency — Speed (target: <500ms)
- Cost — $/query (optimize for budget)
```

### Example Usage

**You:** "Help me improve my OpenClaw memory retrieval"

**Claude Code:**
```bash
# 1. Check current performance
embedeval ab-test --config examples/openclaw/openclaw-memory-eval.yaml

# 2. Analyze results
# [Reads metrics.json]
# Current: NDCG@10=0.72, Recall@10=0.65
# Opportunity: Try semantic-chunks for long documents

# 3. Create experiment config
# [Writes new config with semantic-chunks strategy]

# 4. Run experiment
embedeval ab-test --config experiments/openclaw-chunking-test.yaml

# 5. Compare results
# Improved: NDCG@10=0.78 (+8.3%)
# Deploy recommendation: YES
```

### Claude Code Tools

Create `.claude/tools/embedeval-evaluate.json`:

```json
{
  "name": "embedeval_evaluate",
  "description": "Run embedding evaluation on a corpus",
  "parameters": {
    "config": {
      "type": "string",
      "description": "Path to evaluation config YAML"
    },
    "output": {
      "type": "string",
      "description": "Output directory for results"
    }
  },
  "command": "embedeval ab-test --config {{config}} --output {{output}}"
}
```

Create `.claude/tools/embedeval-experiment.json`:

```json
{
  "name": "embedeval_experiment",
  "description": "Run A/B experiment between strategies",
  "parameters": {
    "hypothesis": {
      "type": "string",
      "description": "What we're testing"
    },
    "baseline": {
      "type": "string",
      "description": "Baseline strategy name"
    },
    "challenger": {
      "type": "string",
      "description": "New strategy to test"
    }
  }
}
```

---

## OpenCode Integration

### Setup

Add to `AGENTS.md` or `.opencode/config.md`:

```markdown
# EmbedEval Agent Configuration

## Capabilities

This agent can help optimize embedding and retrieval systems using EmbedEval.

### Evaluation Commands

```bash
# Run evaluation
npm run eval -- --config <config-file>

# List strategies
npm run strategy -- --list

# Compare results
npm run compare -- --results <dir>
```

### Self-Improvement Loop

1. **Analyze Current State**
   - Read existing configs in examples/
   - Check recent results in results/
   - Identify underperforming areas

2. **Generate Hypotheses**
   - "Try model X for domain Y"
   - "Switch to strategy Z for long docs"
   - "Test hybrid approach"

3. **Run Experiments**
   - Create YAML configs
   - Execute A/B tests
   - Collect metrics

4. **Analyze & Learn**
   - Calculate improvements
   - Check statistical significance
   - Document findings

5. **Deploy Winners**
   - Update production config
   - Monitor for regression
   - Rollback if needed
```

### OpenCode Workflow

**Prompt:** "Optimize my retrieval system"

**OpenCode Execution:**

```
[Opencode] I'll help optimize your retrieval system. Let me start by evaluating the current performance.

[Step 1] Running baseline evaluation...
$ embedeval ab-test --config examples/current-config.yaml
→ Results: NDCG@10=0.68, Recall@10=0.61

[Step 2] Analyzing for improvement opportunities...
→ Low NDCG suggests poor ranking quality
→ Long avg document length (2.4k tokens) → try semantic-chunks
→ Current: baseline strategy

[Step 3] Creating experiment...
→ New config: semantic-chunks + hybrid-bm25
→ Testing against baseline

[Step 4] Running experiment...
$ embedeval ab-test --config experiments/optimization-test.yaml
→ Results: NDCG@10=0.79 (+16.2%), Recall@10=0.73 (+19.7%)
→ Statistical significance: p<0.05 ✓

[Step 5] Recommending deployment...
✅ Significant improvement detected
✅ Deploying new configuration
✅ Updated: config/production.yaml

[Complete] Retrieval system optimized!
Improvement: +16.2% NDCG, +19.7% Recall
Strategy: hybrid-bm25 with semantic-chunks
```

---

## Self-Improvement Automation

### Simple Grid Search (Recommended First)

Before complex evolution, try **simple grid search** - test all combinations systematically:

```bash
#!/bin/bash
# simple-grid-search.sh - Test all strategy combinations

STRATEGIES=("baseline" "semantic-chunks" "hybrid-bm25" "mmr-diversity")
PROVIDERS=("ollama:nomic-embed-text" "openai:text-embedding-3-small")

BEST_SCORE=0
BEST_CONFIG=""

for strategy in "${STRATEGIES[@]}"; do
  for provider in "${PROVIDERS[@]}"; do
    echo "Testing: $provider + $strategy"
    
    # Create temp config
    cat > /tmp/test.yaml << EOF
test:
  name: "Grid Search Test"
variants:
  - id: test
    provider: { type: ${provider%%:*}, model: ${provider#*:} }
    strategy: $strategy
dataset: ./data/queries.jsonl
corpus: ./data/corpus.jsonl
metrics: [ndcg@10]
EOF
    
    # Run evaluation
    embedeval ab-test --config /tmp/test.yaml --output /tmp/results
    
    # Get score
    SCORE=$(jq -r '.metrics.ndcg' /tmp/results/metrics.json)
    echo "  Score: $SCORE"
    
    # Track best
    if (( $(echo "$SCORE > $BEST_SCORE" | bc -l) )); then
      BEST_SCORE=$SCORE
      BEST_CONFIG="$provider + $strategy"
    fi
  done
done

echo ""
echo "🏆 Winner: $BEST_CONFIG"
echo "   Score: $BEST_SCORE"
echo ""
echo "Total evaluations: $((${#STRATEGIES[@]} * ${#PROVIDERS[@]}))"
```

**When to use:**
- ✓ Small number of combinations (< 50)
- ✓ Want guaranteed optimal solution
- ✓ Have time/budget for exhaustive testing
- ✓ Data is stable

**Cost estimate:** 20 strategies × $0.0001/query × 100 queries = $0.20

---

### Continuous Evaluation Mode

Create `scripts/continuous-improvement.js`:

```javascript
#!/usr/bin/env node
/**
 * Continuous Self-Improvement Loop
 * Runs evaluations, analyzes results, and suggests optimizations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SelfImprovingEvaluator {
  constructor(config) {
    this.config = config;
    this.knowledgeBase = this.loadKnowledgeBase();
  }

  async run() {
    console.log('🤖 Starting self-improvement loop...\n');
    
    // 1. Evaluate current performance
    const baseline = await this.evaluate('current');
    
    // 2. Generate improvement hypotheses
    const hypotheses = this.generateHypotheses(baseline);
    
    // 3. Test each hypothesis
    for (const hypothesis of hypotheses) {
      const result = await this.testHypothesis(hypothesis);
      
      if (result.improvement > 0.05) {
        console.log(`✅ Found significant improvement: ${result.improvement}%`);
        await this.deploy(hypothesis);
      }
    }
    
    // 4. Update knowledge base
    this.updateKnowledgeBase();
    
    console.log('\n✨ Self-improvement cycle complete!');
  }

  async evaluate(strategy) {
    console.log(`🔍 Evaluating: ${strategy}`);
    
    const result = execSync(
      `embedeval ab-test --config ${this.config} --output ./results/${strategy}`,
      { encoding: 'utf-8' }
    );
    
    const metrics = JSON.parse(
      fs.readFileSync(`./results/${strategy}/metrics.json`)
    );
    
    return metrics;
  }

  generateHypotheses(baseline) {
    const hypotheses = [];
    
    // Based on baseline, suggest improvements
    if (baseline.ndcg < 0.75) {
      hypotheses.push({
        name: 'Try hybrid-bm25',
        strategy: 'hybrid-bm25',
        reason: 'Low NDCG, hybrid may improve ranking'
      });
    }
    
    if (baseline.avgLatency > 500) {
      hypotheses.push({
        name: 'Switch to lighter model',
        model: 'text-embedding-3-small',
        reason: 'High latency, try faster model'
      });
    }
    
    // Check knowledge base for past successes
    const pastWins = this.knowledgeBase.successfulStrategies;
    for (const win of pastWins) {
      if (win.context === this.config.context) {
        hypotheses.push(win.strategy);
      }
    }
    
    return hypotheses;
  }

  async testHypothesis(hypothesis) {
    console.log(`🧪 Testing: ${hypothesis.name}`);
    
    // Create experiment config
    const experimentConfig = this.createExperimentConfig(hypothesis);
    
    // Run experiment
    const result = await this.evaluate('experiment');
    
    // Calculate improvement
    const baseline = await this.evaluate('baseline');
    const improvement = (result.ndcg - baseline.ndcg) / baseline.ndcg;
    
    return {
      hypothesis,
      improvement,
      result,
      significant: improvement > 0.05
    };
  }

  async deploy(hypothesis) {
    console.log(`🚀 Deploying: ${hypothesis.name}`);
    
    // Update production config
    const prodConfig = this.loadProdConfig();
    prodConfig.strategy = hypothesis.strategy;
    this.saveProdConfig(prodConfig);
    
    // Log deployment
    this.knowledgeBase.deployments.push({
      timestamp: new Date(),
      strategy: hypothesis,
      reason: 'Self-improvement loop'
    });
  }

  loadKnowledgeBase() {
    try {
      return JSON.parse(fs.readFileSync('./.embedeval/kb.json'));
    } catch {
      return { experiments: [], successfulStrategies: [], deployments: [] };
    }
  }

  updateKnowledgeBase() {
    fs.writeFileSync('./.embedeval/kb.json', JSON.stringify(this.knowledgeBase, null, 2));
  }
}

// Run if called directly
if (require.main === module) {
  const evaluator = new SelfImprovingEvaluator(process.argv[2] || './config.yaml');
  evaluator.run().catch(console.error);
}

module.exports = SelfImprovingEvaluator;
```

### Usage with AI Assistants

**Claude Code:**
```bash
# Start continuous improvement
claude run scripts/continuous-improvement.js ./config.yaml

# Or use MCP tool
claude tools embedeval-evolve --config ./config.yaml --auto-deploy
```

**OpenCode:**
```bash
# Run self-improvement loop
opencode exec node scripts/continuous-improvement.js

# Schedule weekly runs
opencode schedule --weekly "improve embeddings"
```

---

## Advanced: Multi-Agent Collaboration

### Scenario: OpenClaw + Claude + OpenCode

```
OpenClaw Agent: "I need better memory retrieval"
        │
        ▼
Claude Code: Creates evaluation config
        │
        ▼
EmbedEval: Runs A/B test
        │
        ▼
OpenCode: Analyzes results, suggests model
        │
        ▼
Claude Code: Tests new model
        │
        ▼
EmbedEval: Confirms 15% improvement
        │
        ▼
OpenCode: Deploys to production
        │
        ▼
OpenClaw: Uses improved retrieval ✨
```

### Implementation

Create `integrations/multi-agent-orchestrator.yaml`:

```yaml
orchestration:
  name: "Multi-Agent Optimization"
  
  agents:
    - name: claude
      role: config_generator
      capabilities:
        - create_yaml_configs
        - interpret_results
        - suggest_improvements
      
    - name: opencode
      role: executor
      capabilities:
        - run_evaluations
        - analyze_metrics
        - deploy_changes
      
    - name: openclaw
      role: user
      capabilities:
        - provide_corpus
        - define_requirements
        - accept_recommendations
  
  workflow:
    1_request:
      from: openclaw
      action: "I need better retrieval"
      
    2_generate:
      from: claude
      action: create_baseline_config
      output: baseline.yaml
      
    3_execute:
      from: opencode
      action: run_evaluation
      input: baseline.yaml
      output: baseline_results/
      
    4_analyze:
      from: claude
      action: interpret_results
      input: baseline_results/
      output: improvement_plan.json
      
    5_experiment:
      from: opencode
      action: run_experiments
      input: improvement_plan.json
      output: experiment_results/
      
    6_deploy:
      from: opencode
      action: deploy_winner
      condition: improvement > 5%
      
    7_notify:
      from: claude
      to: openclaw
      message: "Retrieval improved by X%"
```

---

## Best Practices

### 1. Start with Clear Baseline

Always establish baseline before experimenting:

```bash
# Run baseline
embedeval ab-test --config baseline.yaml --output results/baseline

# Document baseline metrics
echo "Baseline NDCG@10: $(jq .metrics.ndcg results/baseline/metrics.json)"
```

### 2. Set Improvement Gates

Define what "success" means:

```yaml
gates:
  enabled: true
  metrics:
    ndcg@10:
      min: 0.75        # Must meet minimum
      improvement: 0.05  # Must improve by 5%
  latency:
    maxMs: 500         # Can't get slower
```

### 3. Document Everything

AI assistants should update knowledge base:

```bash
# After experiment
claude exec scripts/log-experiment.js \
  --hypothesis "semantic chunks help" \
  --result "+8% NDCG" \
  --deployed true
```

### 4. Test Edge Cases

Don't just test average performance:

```yaml
# Test different query types
datasets:
  - short-queries.jsonl      # < 10 words
  - long-queries.jsonl       # > 50 words  
  - ambiguous-queries.jsonl  # Unclear intent
  - technical-queries.jsonl  # Domain-specific
```

### 5. Monitor in Production

Set up continuous monitoring:

```bash
# Weekly quality check
0 2 * * 0 opencode exec scripts/weekly-check.sh

# Alert on degradation
embedeval monitor --threshold ndcg@10:0.70 --alert webhook
```

---

## Example: Complete Self-Improvement Session

**OpenClaw:** "My memory retrieval seems worse lately"

**Claude Code:**
```
I'll help diagnose and fix your retrieval performance. Let me start by running a baseline evaluation.

> embedeval ab-test --config openclaw-current.yaml

Results:
- NDCG@10: 0.68 (was 0.75 last month)
- Recall@10: 0.61
- ⚠️ Performance dropped 9.3%

Let me check your knowledge base growth...

> ls -lh openclaw/memory-corpus.jsonl
File grew from 10MB to 50MB (5x growth!)

Hypothesis: Corpus growth requires better chunking strategy

> [Creates experiment config with semantic-chunks]
> embedeval ab-test --config experiment-chunking.yaml

Results:
- NDCG@10: 0.79 (+16.2% vs degraded, +5.3% vs original)
- Recall@10: 0.73 (+19.7%)
✅ Significant improvement!

Deploying new configuration...
> [Updates openclaw-production.yaml]

✨ Complete! Your retrieval is now better than ever:
- NDCG improved from 0.68 → 0.79 (+16.2%)
- Successfully handles 5x larger corpus
- Strategy: semantic-chunks with 384-token chunks
```

**OpenClaw:** "Thanks! Can we make this automatic?"

**OpenCode:**
```
Setting up continuous improvement...

> [Creates .github/workflows/weekly-optimization.yml]
> [Schedules Sunday 2 AM runs]
> [Configures auto-deploy with rollback]

Done! Your system will now:
✓ Self-evaluate weekly
✓ Auto-optimize when opportunities found
✓ Rollback if performance drops
✓ Alert you to significant changes
```

---

## Next Steps

1. **Install EmbedEval**: `npm install -g embedeval`
2. **Configure AI Assistant**: Add tools/config to Claude/OpenCode
3. **Create Baseline**: Run initial evaluation
4. **Start Improving**: Let AI assistants run experiments
5. **Deploy Winners**: Auto-promote successful strategies

---

*Empower your AI agents to get smarter over time.* 🤖✨
