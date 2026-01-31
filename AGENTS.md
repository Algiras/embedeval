# EmbedEval v2 - Agent & LLM Usage Guide

> **Quick Reference**: Binary evals, trace-centric, error-analysis-first. Built on [Hamel Husain's principles](https://hamel.dev/blog/posts/evals-faq/).

---

## � Project Notes & Thoughts

Put strategy docs, campaign notes, and working thoughts in the `thoughts/` folder. This folder is gitignored and won't clutter the repo history.

```bash
# Examples of what goes in thoughts/
thoughts/MOLTBOOK_STRATEGY.md    # Campaign planning
thoughts/MOLTBOOK_CAMPAIGN.md    # Progress tracking
thoughts/LLM.md                  # LLM-specific notes
thoughts/GETTING_STARTED.md     # Onboarding drafts
```

---

## �🚀 For AI Agents (Claude, GPT, etc.)

### Core Workflow (3 Steps)

```bash
# 1. COLLECT - Import your LLM traces
embedeval collect ./agent-logs.jsonl --output traces.jsonl

# 2. ANNOTATE - Manual error analysis (CRITICAL!)
embedeval annotate traces.jsonl --user "agent@system.com"

# 3. TAXONOMY - Build failure taxonomy
embedeval taxonomy build --annotations annotations.jsonl
```

### Essential Commands

| Task | Command | Description |
|------|---------|-------------|
| **Collect** | `embedeval collect <source>` | Import traces from JSONL |
| **Annotate** | `embedeval annotate <traces> -u <email>` | Binary pass/fail annotation |
| **View** | `embedeval view <traces>` | Read-only trace viewer |
| **Taxonomy** | `embedeval taxonomy build` | Categorize failures |
| **DSL Init** | `embedeval dsl init <template>` | Create .eval file from template |
| **DSL Run** | `embedeval dsl run evals.eval traces.jsonl` | Compile & run in one step |
| **DSL UI** | `embedeval dsl ui evals.eval` | Generate HTML annotation UI |
| **DSL Serve** | `embedeval dsl serve evals.eval -t traces.jsonl` | Serve annotation UI locally |
| **Eval Add** | `embedeval eval add` | Add new evaluator |
| **Eval Run** | `embedeval eval run <traces> -c <config>` | Run evals |
| **Generate** | `embedeval generate create -d <dims> -n <count>` | Synthetic data |
| **Export** | `embedeval export <traces> -f notebook` | Jupyter notebook |
| **Report** | `embedeval report -t <traces> -a <annots>` | HTML dashboard |
| **Stats** | `embedeval stats <traces> -f moltbook` | Quick shareable stats |
| **Moltbook** | `embedeval moltbook --type post` | Generate community posts |

### Interactive Annotation Shortcuts

When running `embedeval annotate`:
- `p` = **PASS** ✓
- `f` = **FAIL** ✗ (then select category)
- `c` = Change category
- `n` = Edit notes
- `j` = Next trace
- `k` = Previous trace
- `s` = Save and quit

---

## � High-Level DSL for Easy Eval Definition (NEW)

Define evals in natural language with `.eval` files. Based on Hamel Husain's principles: binary, cheap-first, error-analysis-driven.

### Quick Start

```bash
# 1. Create from template
embedeval dsl init rag -o my-evals.eval

# 2. Edit the file (natural language!)
# 3. Validate
embedeval dsl validate my-evals.eval

# 4. Compile & Run in one step
embedeval dsl run my-evals.eval traces.jsonl -o results.json
```

### DSL Syntax

```bash
# Metadata
name: My Evals
domain: rag
version: 1.0

# CHEAP EVALS (fast, deterministic, run first)
must "Has Content": response length > 50
must "Uses Context": uses context
must-not "No Secrets": must not contain "api_key"
should "Cites Sources": cites sources

# EXPENSIVE EVALS (LLM-as-judge, run selectively)  
[expensive] must "No Hallucination": no hallucination
[expensive] check "Empathetic": llm: Is the response empathetic?
  when: query contains "frustrated"

# CUSTOM CODE
check "Fast": code: metadata.latency < 3000
```

### Natural Language Patterns

| Pattern | Example | Compiled To |
|---------|---------|-------------|
| `response length > N` | `response length > 50` | Assertion |
| `must contain "X"` | `must contain "refund"` | Regex (shouldMatch) |
| `must not contain "X"` | `must not contain "debug"` | Regex (!shouldMatch) |
| `matches pattern /X/` | `matches pattern /\d{3}-\d{4}/` | Regex |
| `uses context` | `uses context` | Code check |
| `cites sources` | `cites sources` | Code check |
| `is coherent` | `is coherent` | LLM judge |
| `is helpful` | `is helpful` | LLM judge |
| `is safe` | `is safe` | LLM judge |
| `no hallucination` | `no hallucination` | LLM judge |
| `answers the question` | `answers the question` | LLM judge |
| `code: expr` | `code: response.length < 500` | Custom code |
| `llm: prompt` | `llm: Is this professional?` | Custom LLM judge |

### Available Templates

| Template | Description |
|----------|-------------|
| `rag` | RAG systems (context usage, hallucination) |
| `chatbot` | Customer support bots (helpfulness, safety) |
| `code-assistant` | Code generation (syntax, best practices) |
| `docs` | Documentation Q&A (accuracy, completeness) |
| `agent` | Autonomous agents (task completion, efficiency) |
| `minimal` | Bare minimum to get started |

### DSL Commands

```bash
# List templates
embedeval dsl templates

# Create from template  
embedeval dsl init rag -o my-evals.eval

# Validate syntax
embedeval dsl validate my-evals.eval

# Preview compiled evals
embedeval dsl preview my-evals.eval

# Compile to JSON (for manual inspection)
embedeval dsl compile my-evals.eval -o evals.json

# Compile and run in one step
embedeval dsl run my-evals.eval traces.jsonl -o results.json

# Generate annotation UI (NEW!)
embedeval dsl ui my-evals.eval -o annotation.html

# Serve annotation UI with hot-reload (NEW!)
embedeval dsl serve my-evals.eval -t traces.jsonl
```

### Generate Annotation UI from DSL (NEW!)

The DSL can generate an **interactive HTML annotation interface** based on your eval criteria. This enables human evaluation using the exact same checks defined in your DSL.

```bash
# Generate standalone HTML annotation UI
embedeval dsl ui my-evals.eval -o annotation-ui.html --theme dark

# Options:
#   -o, --output <file>      Output HTML file (default: annotation-ui.html)
#   -a, --annotations <file> Annotations output filename (default: annotations.jsonl)
#   --theme <theme>          UI theme: light or dark (default: dark)
#   --no-shortcuts           Disable keyboard shortcuts
#   --no-context             Hide retrieved context section
#   --no-metadata            Hide trace metadata section
```

**Workflow:**
1. Define evals in DSL → `my-evals.eval`
2. Generate UI → `embedeval dsl ui my-evals.eval`
3. Open HTML → Load your `traces.jsonl`
4. Annotate → Check evals, add notes, mark Pass/Fail
5. Export → Download `annotations.jsonl`
6. Analyze → `embedeval taxonomy build -a annotations.jsonl`

**Keyboard Shortcuts in UI:**
- `P` = Mark as PASS
- `F` = Mark as FAIL
- `S` = Skip trace
- `←`/`K` = Previous trace
- `→`/`J` = Next trace
- `1-9` = Toggle eval checklist items

### Serve Annotation UI Locally

For teams or easier workflow, serve the UI with a local server:

```bash
# Start annotation server (opens browser automatically)
embedeval dsl serve my-evals.eval -p 3456

# Pre-load traces file
embedeval dsl serve my-evals.eval -t traces.jsonl --theme light

# Options:
#   -p, --port <port>  Port number (default: 3456)
#   -t, --traces <file> Pre-load traces file
#   --theme <theme>    UI theme: light or dark
```

### Example: RAG Eval File

```bash
# my-rag-evals.eval
name: RAG Evals
domain: rag

# Cheap evals - run on every trace
must "Uses Context": uses context
must "Answers Query": answers the question

# Expensive - run selectively
[expensive] must "No Hallucination": no hallucination
[expensive] check "Uncertainty": llm: Does response admit uncertainty when context is weak?
  when: context.retrievedDocs[0]?.score < 0.7
```

---

## �🛠️ SDK for Real-Time Self-Evaluation (NEW in 2.0.5)

The SDK allows agents to **self-evaluate responses in real-time** without CLI.

### Quick Start

```typescript
import { 
  evaluate,
  preflight, 
  getConfidence,
  getSuggestions,
  TraceCollector 
} from 'embedeval/sdk';

// 1. PREFLIGHT - Quick check before sending
const check = await preflight(myResponse, userQuery);
if (!check.passed) {
  console.log('Issues found:', check.failedChecks);
}

// 2. CONFIDENCE - Should I send this?
const confidence = await getConfidence(myResponse, { query: userQuery });
console.log(`Score: ${confidence.score}, Action: ${confidence.action}`);
// Action: 'send' | 'revise' | 'escalate' | 'clarify'

// 3. EVALUATE - Full evaluation
const result = await evaluate(myResponse, {
  query: userQuery,
  context: retrievedDocs,
  evals: ['coherent', 'factual', 'helpful', 'no-hallucination'],
});
console.log(`Passed: ${result.passed}, Rate: ${result.passRate}%`);

// 4. SUGGESTIONS - Get improvement advice
if (!result.passed) {
  const suggestions = await getSuggestions(trace, result.results);
  for (const s of suggestions) {
    console.log(`[${s.severity}] ${s.action}`);
  }
}
```

### Built-in Evaluators

| Eval | Description | Speed |
|------|-------------|-------|
| `coherent` | Response is well-structured | ⚡ Fast |
| `factual` | Contains accurate information | 🔄 Medium |
| `helpful` | Addresses user's need | ⚡ Fast |
| `complete` | Fully answers the question | ⚡ Fast |
| `safe` | No harmful content | ⚡ Fast |
| `uses-context` | Uses retrieved docs | ⚡ Fast |
| `no-hallucination` | No made-up facts | 🔄 Medium |
| `has-sources` | Cites sources properly | ⚡ Fast |

### Preflight Checks

Run quick checks **before** sending a response:

```typescript
import { preflight, preflightOk, needsRevision } from 'embedeval/sdk';

// Full preflight check
const check = await preflight(response, query, {
  checks: ['coherent', 'safe', 'relevant'],  // Optional: specific checks
  model: 'gemini-2.5-flash-lite',            // Optional: fastest model
});

if (!check.passed) {
  console.log('Failed checks:', check.failedChecks);
  // ['safe'] - response might be unsafe
}

// Quick boolean check
const ok = await preflightOk(response, query);
if (!ok) {
  // Needs revision
}

// Get revision hint
const hint = await needsRevision(response, query);
// "Response may not fully address the question"
```

### Confidence Scoring

Decide whether to send, revise, escalate, or clarify:

```typescript
import { getConfidence, shouldSend, determineAction } from 'embedeval/sdk';

// Full confidence analysis
const result = await getConfidence(response, {
  query: userQuery,
  method: 'hybrid',  // 'llm', 'embedding', or 'hybrid'
  thresholds: {
    send: 0.8,       // Score >= 0.8 → send
    revise: 0.6,     // Score >= 0.6 → revise
    escalate: 0.4,   // Score >= 0.4 → escalate to human
    clarify: 0.0,    // Score < 0.4 → ask for clarification
  },
});

console.log(`Score: ${result.score}`);
console.log(`Action: ${result.action}`);
console.log(`Breakdown:`, result.breakdown);
// { relevance: 0.85, completeness: 0.7, accuracy: 0.9, clarity: 0.8 }

// Quick checks
const ok = await shouldSend(response, query);  // boolean
const action = await determineAction(response); // 'send' | 'revise' | ...
```

### Auto-Collect Traces

Automatically collect traces for later analysis:

```typescript
import { TraceCollector, getCollector, autoCollect } from 'embedeval/sdk';

// Create a collector
const collector = new TraceCollector({
  outputFile: './traces.jsonl',
  autoEvaluate: true,  // Run evals automatically
  onTrace: (trace, results) => {
    console.log(`Collected: ${trace.id}, Passed: ${results?.passed}`);
  },
});

// Collect traces manually
await collector.collect({
  query: userQuery,
  response: myResponse,
  context: { retrievedDocs },
  metadata: { model: 'claude-opus-4', latency: 1200 },
});

// Get stats
const stats = collector.getStats();
console.log(`Pass rate: ${stats.passRate}%`);
console.log(`Top failures:`, stats.failureCategories);

// Use decorator for automatic collection
class MyAgent {
  @autoCollect()
  async generateResponse(query: string): Promise<string> {
    // Your logic here
    return response;
  }
}
```

### Improvement Suggestions

Get actionable fixes for failed evaluations:

```typescript
import { getSuggestions, generateRevisionPrompt } from 'embedeval/sdk';

const suggestions = await getSuggestions(trace, evalResults);

for (const s of suggestions) {
  console.log(`[${s.severity}] ${s.category}`);
  console.log(`  Action: ${s.action}`);
  console.log(`  Example: ${s.example}`);
}

// Output:
// [high] hallucination
//   Action: Remove or verify facts not in provided context
//   Example: Instead of "The API supports 100 concurrent connections"...

// Generate a revision prompt
const revisionPrompt = generateRevisionPrompt(originalResponse, suggestions);
// Use this prompt to revise the response
```

### Known Failure Categories

```typescript
import { getKnownCategories, getCategorySuggestion } from 'embedeval/sdk';

const categories = getKnownCategories();
// ['hallucination', 'incomplete', 'incoherent', 'irrelevant', 
//  'wrong-format', 'unsafe', 'no-sources', 'verbose', 
//  'missing-context', 'factual-error']

const fix = getCategorySuggestion('hallucination');
// { description: 'Response contains information not supported by context',
//   action: 'Remove or verify facts not in provided context...' }
```

### Complete Agent Self-Evaluation Workflow

```typescript
import { 
  preflight, 
  getConfidence, 
  evaluate, 
  getSuggestions,
  generateRevisionPrompt,
  TraceCollector 
} from 'embedeval/sdk';

const collector = new TraceCollector({ autoEvaluate: true });

async function respondToUser(query: string): Promise<string> {
  // 1. Generate initial response
  let response = await myLLM.generate(query);
  
  // 2. Preflight check (fast)
  const check = await preflight(response, query);
  if (!check.passed) {
    // 3. Get confidence and decide action
    const confidence = await getConfidence(response, { query });
    
    if (confidence.action === 'revise') {
      // 4. Get suggestions and revise
      const trace = { id: 'temp', query, response, timestamp: new Date().toISOString() };
      const evalResults = check.failedChecks.map(c => ({
        traceId: 'temp', evalId: c, passed: false
      }));
      const suggestions = await getSuggestions(trace, evalResults);
      const revisionPrompt = generateRevisionPrompt(response, suggestions);
      response = await myLLM.generate(revisionPrompt);
    } else if (confidence.action === 'escalate') {
      // Escalate to human
      return '[Escalated to human support]';
    }
  }
  
  // 5. Collect trace for later analysis
  await collector.collect({
    query,
    response,
    metadata: { revised: !check.passed },
  });
  
  return response;
}
```

---

## 🔮 Multi-Provider LLM Judge System

EmbedEval supports **multiple LLM providers** for evaluation. Use the best provider for your needs: speed, cost, quality, or privacy.

### Supported Providers

| Provider | Setup | Best For |
|----------|-------|----------|
| **Gemini** | `GEMINI_API_KEY` | Default, fast, cheap |
| **OpenAI** | `OPENAI_API_KEY` | High quality |
| **OpenRouter** | `OPENAI_BASE_URL` + key | Multi-model access |
| **Ollama** | `OPENAI_BASE_URL=localhost:11434` | Privacy, local |
| **Azure OpenAI** | Custom URL + key | Enterprise |

### Quick Setup

```bash
# Option 1: Gemini (recommended - fast, cheap)
export GEMINI_API_KEY="your-api-key"

# Option 2: OpenAI 
export OPENAI_API_KEY="your-api-key"

# Option 3: OpenRouter (access to many models)
export OPENAI_API_KEY="your-openrouter-key"
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"

# Option 4: Ollama (local, private)
export OPENAI_BASE_URL="http://localhost:11434/v1"

# Option 5: Set preferred provider
export EMBEDEVAL_PROVIDER="gemini"  # or "openai"

# Check available providers
embedeval providers list

# Benchmark speed
embedeval providers benchmark
```

### Available Models

**Gemini 3 Series (2026 - Flagship)**
| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `gemini-3-pro` | 🐢 Medium | 💵 High | Most intelligent, complex reasoning |
| `gemini-3-flash` | ⚡ Fast | 💰 Medium | Balanced speed and intelligence |

**Gemini 2.5 Series (Current Stable)**
| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `gemini-2.5-flash` | ⚡ Fast | 💰 Cheap | **DEFAULT** - Best price-performance |
| `gemini-2.5-flash-lite` | ⚡⚡ Fastest | 💰💰 Cheapest | Simple checks, reranking |
| `gemini-2.5-pro` | 🐢 Slow | 💵 High | Complex reasoning, long context |

**OpenAI Models**
| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `gpt-4o` | ⚡ Fast | 💵 High | Flagship quality |
| `gpt-4o-mini` | ⚡⚡ Fast | 💰 Cheap | Budget friendly |

**OpenRouter Models (via OPENAI_BASE_URL)**
| Model | Notes |
|-------|-------|
| `anthropic/claude-3.5-sonnet` | Best overall |
| `anthropic/claude-3-haiku` | Fast, cheap |
| `meta-llama/llama-3.1-70b-instruct` | Open source |

### LLM-Judge Eval Config

```json
{
  "id": "response-quality",
  "name": "Response Quality Check",
  "type": "llm-judge",
  "priority": "expensive",
  "config": {
    "model": "gemini-2.5-flash",
    "temperature": 0.0,
    "prompt": "Given this query and response, evaluate quality.\n\nQuery: {query}\nResponse: {response}\n\nAnswer ONLY 'PASS' if the response adequately addresses the query, or 'FAIL' if it does not."
  }
}
```

### Prompt Variables

In your prompt template, use these placeholders:
- `{query}` - The user's input/question
- `{response}` - The agent's response
- `{context}` - Retrieved context (if available)
- `{metadata}` - Trace metadata as JSON

### Cost Management Strategy

```bash
# 1. Run cheap evals first (free, instant)
embedeval eval run traces.jsonl -c cheap-evals.json -o cheap-results.json

# 2. Filter to only failed traces
jq -r '.results[] | select(.passed == false) | .traceId' cheap-results.json > failed.txt

# 3. Run expensive LLM evals only on failures
embedeval eval run traces.jsonl -c llm-evals.json --filter failed.txt -o deep-results.json
```

### Embedding & Semantic Similarity

```bash
# EmbedEval includes embedding support for semantic similarity evals
# Automatically uses:
# - Gemini: text-embedding-004
# - OpenAI: text-embedding-3-small
```

### Weak Agent Validators (Recommended!)

Use a cheap, fast model as a "weak agent" to validate your stronger model's outputs:

```json
[
  {
    "id": "weak-coherence-check",
    "name": "Coherence Check (Weak Agent)",
    "type": "llm-judge",
    "priority": "cheap",
    "config": {
      "model": "gemini-2.5-flash-lite",
      "temperature": 0.0,
      "prompt": "Is this response coherent and well-structured?\n\nResponse: {response}\n\nAnswer PASS or FAIL only."
    }
  },
  {
    "id": "weak-factual-check",
    "name": "Factual Sanity (Weak Agent)",
    "type": "llm-judge",
    "priority": "cheap",
    "config": {
      "model": "gemini-2.5-flash-lite",
      "temperature": 0.0,
      "prompt": "Does this response contain obviously false or contradictory statements?\n\nResponse: {response}\n\nAnswer PASS if acceptable, FAIL if contains obvious errors."
    }
  }
]
```

### Example: Full Eval Pipeline

```bash
# Real example testing RAG responses with Gemini judge

# Run the eval
embedeval eval run examples/v2/sample-traces.jsonl \
  -c examples/v2/evals/rag-evals.json \
  -o results.json

# Example output:
# ✅ Results:
#   Total traces: 3
#   Passed: 0, Failed: 3
# 📊 Eval breakdown:
#   Uses Retrieved Context: 3 pass, 0 fail (100.0%)  ← code eval
#   Cites Sources: 0 pass, 3 fail (0.0%)             ← regex eval
#   Response is Relevant: 3 pass, 0 fail (100.0%)   ← LLM judge ✨
#   No Hallucinated Facts: 1 pass, 2 fail (33.3%)   ← LLM judge ✨
```

---

## 📊 Self-Assessment System (Price, Speed, Quality)

EmbedEval includes a comprehensive self-assessment system for evaluating your own performance.

### Commands

```bash
# View model pricing
embedeval assess pricing

# Get model recommendation
embedeval assess recommend -p balanced -c moderate
# Options: -p quality|speed|cost|balanced -c simple|moderate|complex

# Run self-assessment on eval results
embedeval assess run -r results.json -m gemini-2.5-flash

# Compare two models
embedeval assess compare \
  --results-a model-a-results.json --model-a gemini-2.5-flash \
  --results-b model-b-results.json --model-b gpt-4o-mini
```

### Self-Assessment Report

The assessment generates a comprehensive report:

```
═══════════════════════════════════════════════
                SELF-ASSESSMENT REPORT                      
═══════════════════════════════════════════════

📊 Model: gemini-2.5-flash
📈 Sample: 15 evaluations

┌─────────────────────────────────────────────┐
│                   QUALITY                   │
├─────────────────────────────────────────────┤
│  Pass Rate:     60.0%                       │
│  Passed:        9                           │
│  Failed:        6                           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                    SPEED                    │
├─────────────────────────────────────────────┤
│  Avg Latency:   852ms                       │
│  P50 Latency:   500ms                       │
│  P95 Latency:   2566ms                      │
│  Throughput:    1.17 evals/sec              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                    COST                     │
├─────────────────────────────────────────────┤
│  Total Cost:    $0.000338                   │
│  Avg/Eval:      $0.000023                   │
│  Cost/Pass:     $0.000038                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                 EFFICIENCY                  │
├─────────────────────────────────────────────┤
│  Passes/$:      26667                       │
│  Passes/sec:    0.70                        │
│  Cost Score:    100/100                     │
│  Speed Score:   83/100                      │
│  Overall:       76/100                      │
└─────────────────────────────────────────────┘

📋 RECOMMENDATIONS:
   ⚠️ Pass rate below 70% - review failure categories
```

### Key Metrics Explained

| Metric | What It Measures | Good Target |
|--------|------------------|-------------|
| **Pass Rate** | % of evals that passed | >80% |
| **Avg Latency** | Mean response time | <1000ms |
| **P95 Latency** | 95th percentile latency | <3000ms |
| **Throughput** | Evals per second | >1.0 |
| **Cost/Pass** | $ per successful eval | <$0.001 |
| **Passes/$** | How many passes per dollar | >10000 |
| **Overall Score** | Combined efficiency (0-100) | >70 |

### Drift Detection

Monitor for performance degradation by providing a baseline:

```bash
# Save current metrics as baseline
embedeval assess run -r results.json -m gemini-2.5-flash -f json -o baseline.json

# Later, compare against baseline
embedeval assess run -r new-results.json -m gemini-2.5-flash -b baseline.json
```

Drift alerts trigger when:
- **Quality**: Pass rate drops >5%
- **Speed**: Latency increases >20%
- **Cost**: Cost increases >30%

### Model Comparison

Compare two approaches:

```bash
embedeval assess compare \
  --results-a cheap-model.json --model-a gemini-2.5-flash-lite \
  --results-b expensive-model.json --model-b gemini-2.5-pro

# Output:
# ═══════════════════════════════════════════════
#               MODEL COMPARISON                  
# ═══════════════════════════════════════════════
#   Model A: gemini-2.5-flash-lite
#   Model B: gemini-2.5-pro
#
#   QUALITY:
#     Pass Rate A: 78.0%
#     Pass Rate B: 92.0%
#     Winner: B
#
#   SPEED:
#     Avg Latency A: 450ms
#     Avg Latency B: 2100ms
#     Winner: A
#
#   COST:
#     Total Cost A: $0.000150
#     Total Cost B: $0.002500
#     Winner: A
#
#   RECOMMENDATION:
#     Depends on priority
#     No clear winner - choose based on priority
```

---

## 🎯 Hamel Husain Principles (Must Follow!)

### 1. **Binary Only** ✓/✗
```yaml
# GOOD: Binary evals
evals:
  - name: is_accurate
    type: llm-judge
    binary: true  # ONLY PASS or FAIL

# BAD: Likert scales (NEVER DO THIS)
evals:
  - name: quality_score
    type: 1_to_5  # DON'T
```

### 2. **Error Analysis First** 👀
```bash
# Spend 60-80% of time here:
embedeval annotate traces.jsonl --user "expert@company.com"

# NOT here (automate only after understanding failures):
# embedeval eval run ... # (do this AFTER annotation)
```

### 3. **Cheap Evals First** 💰
```yaml
evals:
  # Run cheap evals first (fast, deterministic)
  - name: has_content
    type: assertion
    check: "response.length > 100"
    priority: cheap
    
  # Expensive evals only for complex cases
  - name: factual_accuracy
    type: llm-judge
    priority: expensive
```

### 4. **Single Annotator** 👤
```bash
# One "benevolent dictator" owns quality
embedeval annotate traces.jsonl --user "product-manager@company.com"

# NOT multiple people voting (causes disagreement)
```

### 5. **Start with 50-100 Traces** 📊
```bash
# Minimum for meaningful taxonomy
embedeval collect ./logs.jsonl --limit 100
embedeval annotate traces.jsonl --user "pm@company.com"
```

---

## 🤖 Agent Strategy Evaluation

For autonomous agents evaluating their own strategies, EmbedEval supports **tool call tracking** and **outcome-based evaluation**.

### Trace Format for Agents

```json
{
  "id": "strategy-001",
  "timestamp": "2026-01-31T08:00:00Z",
  "query": "User asked for help debugging code",
  "response": "I'll help you debug...",
  "toolCalls": [
    {"tool": "read_file", "input": {"path": "src/index.ts"}, "output": "...", "latency": 50},
    {"tool": "run_in_terminal", "input": {"command": "npm test"}, "output": "3 tests passed", "latency": 2000}
  ],
  "metadata": {"provider": "anthropic", "model": "claude-opus-4", "latency": 3500},
  "outcome": {
    "completed": true,
    "userSatisfied": true,
    "tasksCompleted": 2,
    "tasksAttempted": 2
  }
}
```

### Built-in Strategy Evals

```json
[
  {
    "id": "task-completed",
    "name": "Task Completed",
    "type": "code",
    "priority": "cheap",
    "config": {"function": "return trace.outcome && trace.outcome.completed === true;"}
  },
  {
    "id": "execution-velocity",
    "name": "Execution Velocity",
    "type": "code",
    "priority": "cheap",
    "config": {"function": "return trace.outcome.tasksCompleted === trace.outcome.tasksAttempted;"}
  },
  {
    "id": "tool-efficiency",
    "name": "Tool Efficiency",
    "type": "code",
    "priority": "cheap",
    "config": {"function": "const reads = trace.toolCalls.filter(t => t.tool.includes('read')).length; const actions = trace.toolCalls.filter(t => t.tool.includes('replace') || t.tool.includes('create')).length; return actions / reads >= 0.3;"}
  },
  {
    "id": "tests-after-changes",
    "name": "Tests After Changes",
    "type": "code",
    "priority": "cheap",
    "config": {"function": "const madeChanges = trace.toolCalls.some(t => t.tool === 'replace_string_in_file'); if (!madeChanges) return true; return trace.toolCalls.some(t => t.tool === 'run_in_terminal' && t.input.command.includes('test'));"}
  }
]
```

### Run Strategy Evaluation

```bash
# Evaluate agent strategy traces
embedeval eval run agent-traces.jsonl -c strategy-evals.json -o results.json

# Example output:
# ✅ Results:
#   Total traces: 8
#   Passed: 3 (37.5%)
#   Failed: 5
#
# 📊 Eval breakdown:
#   Task Completed: 75.0%
#   Execution Velocity: 75.0%
#   Tool Efficiency: 87.5%
#   Tests After Changes: 62.5%
```

### Key Strategy Metrics

| Metric | What It Measures | Target |
|--------|-----------------|--------|
| **Task Completion** | Did you finish what was asked? | >90% |
| **User Satisfaction** | Was the user happy? | >85% |
| **Execution Velocity** | Tasks completed / attempted | 100% |
| **Tool Efficiency** | Actions taken / reads made | >30% |
| **Tests After Changes** | Did you verify your work? | 100% |

---

## 🧪 Self-Improvement Techniques for Agents

### Technique 1: Using Weaker Agents as Validators

Use a cheaper/faster model to validate your outputs before delivery. This catches obvious errors without expensive self-review.

```json
{
  "id": "weak-agent-validator",
  "name": "Weak Agent Validation",
  "type": "llm-judge",
  "priority": "cheap",
  "config": {
    "model": "gemini-1.5-flash",
    "temperature": 0.0,
    "prompt": "You are a validator. Given this response to the query, check for:\n1. Does it answer the question?\n2. Is it coherent?\n3. Are there obvious factual errors?\n\nQuery: {query}\nResponse: {response}\n\nAnswer PASS if acceptable, FAIL if there are problems."
  }
}
```

**Workflow:**
```bash
# 1. Generate your response
# 2. Run weak agent validation
embedeval eval run my-responses.jsonl -c weak-validator.json -o validation.json

# 3. Check which responses need revision
jq '.results[] | select(.results[0].passed == false) | .traceId' validation.json
```

### Technique 2: Domain-Specific Knowledge Corpus Evaluation

Create evals specific to your knowledge domain. Test whether responses correctly use domain terminology and concepts.

**Example: Technical Documentation Agent**
```json
[
  {
    "id": "uses-correct-api-names",
    "name": "Correct API Names",
    "type": "code",
    "priority": "cheap",
    "config": {
      "function": "const apiNames = ['createUser', 'updateUser', 'deleteUser', 'getUsers']; const mentioned = apiNames.filter(n => response.includes(n)); return mentioned.length > 0 || !query.toLowerCase().includes('api');"
    }
  },
  {
    "id": "matches-docs-terminology",
    "name": "Matches Docs Terminology",
    "type": "regex",
    "priority": "cheap",
    "config": {
      "pattern": "(endpoint|API key|Bearer token|REST|JSON)",
      "shouldMatch": true,
      "flags": "i"
    }
  },
  {
    "id": "no-deprecated-references",
    "name": "No Deprecated References",
    "type": "regex",
    "priority": "cheap",
    "config": {
      "pattern": "(v1 API|old endpoint|deprecated)",
      "shouldMatch": false,
      "flags": "i"
    }
  }
]
```

**Example: Legal/Compliance Agent**
```json
[
  {
    "id": "includes-disclaimer",
    "name": "Includes Required Disclaimer",
    "type": "assertion",
    "priority": "cheap",
    "config": {
      "check": "response.includes('not legal advice') || response.includes('consult') || !query.toLowerCase().includes('legal')"
    }
  },
  {
    "id": "cites-regulations",
    "name": "Cites Relevant Regulations",
    "type": "code",
    "priority": "cheap",
    "config": {
      "function": "const regs = ['GDPR', 'CCPA', 'HIPAA', 'SOC2', 'PCI']; const isCompliance = query.toLowerCase().match(/compliance|regulation|privacy|security/); if (!isCompliance) return true; return regs.some(r => response.includes(r));"
    }
  }
]
```

### Technique 3: Context-Aware Evaluation

Evaluate whether your response correctly uses the provided context (RAG evaluation).

```json
[
  {
    "id": "uses-retrieved-context",
    "name": "Uses Retrieved Context",
    "type": "code",
    "priority": "cheap",
    "config": {
      "function": "if (!context || !context.retrievedDocs || context.retrievedDocs.length === 0) return true; const topDoc = context.retrievedDocs[0].content.toLowerCase(); const keywords = topDoc.split(' ').filter(w => w.length > 5).slice(0, 10); return keywords.some(k => response.toLowerCase().includes(k));"
    }
  },
  {
    "id": "no-hallucinated-facts",
    "name": "No Hallucinated Facts",
    "type": "llm-judge",
    "priority": "expensive",
    "config": {
      "model": "gemini-1.5-flash",
      "temperature": 0.0,
      "prompt": "Check if the response contains facts NOT present in the context.\n\nContext:\n{context}\n\nResponse:\n{response}\n\nIf the response makes claims not supported by the context, answer FAIL. Otherwise PASS."
    }
  }
]
```

### Technique 4: Multi-Agent Verification Pipeline

Use multiple specialized agents to verify different aspects of your output.

```bash
# 1. Fact-checker agent (weak model, fast)
embedeval eval run responses.jsonl -c fact-check-evals.json -o fact-results.json

# 2. Style-checker agent (regex/assertion, instant)
embedeval eval run responses.jsonl -c style-evals.json -o style-results.json

# 3. Domain expert agent (stronger model, selective)
# Only run on traces that passed fact/style checks
jq -r '.results[] | select(.results | all(.passed)) | .traceId' fact-results.json > passed-traces.txt
embedeval eval run responses.jsonl -c expert-evals.json --filter passed-traces.txt -o expert-results.json
```

**Fact-Checker Evals (cheap):**
```json
[
  {
    "id": "no-made-up-numbers",
    "name": "No Made Up Numbers",
    "type": "code",
    "priority": "cheap",
    "config": {
      "function": "const numbers = response.match(/\\$[\\d,]+|\\d+%|\\d+ (users|customers|days)/g) || []; if (numbers.length === 0) return true; const contextStr = JSON.stringify(context); return numbers.some(n => contextStr.includes(n.replace(/[,$%]/g, '')));"
    }
  }
]
```

### Technique 5: Self-Improvement Feedback Loop

Track your performance over time and identify areas for improvement.

```bash
# Weekly self-evaluation routine
DATE=$(date +%Y-%m-%d)

# 1. Collect this week's traces
embedeval collect ./logs/week-${DATE}.jsonl -o traces-${DATE}.jsonl

# 2. Run standard evals
embedeval eval run traces-${DATE}.jsonl -c standard-evals.json -o results-${DATE}.json

# 3. Compare to last week
echo "This week's pass rate:"
jq '.summary.passRate' results-${DATE}.json

echo "Last week's pass rate:"
jq '.summary.passRate' results-$(date -d "7 days ago" +%Y-%m-%d).json

# 4. Generate improvement report
embedeval stats traces-${DATE}.jsonl -a annotations-${DATE}.jsonl -f moltbook
```

### Technique 6: Corpus-Specific Test Suites

Create test suites for different knowledge domains you work with.

**Structure:**
```
evals/
├── general/
│   ├── coherence.json      # Basic quality checks
│   └── helpfulness.json    # Was it helpful?
├── coding/
│   ├── syntax-valid.json   # Code compiles
│   ├── tests-pass.json     # Tests run
│   └── best-practices.json # Follows conventions
├── docs/
│   ├── accuracy.json       # Matches documentation
│   └── completeness.json   # Covers all points
└── support/
    ├── empathy.json        # Appropriate tone
    └── resolution.json     # Solves the problem
```

**Run domain-specific evals:**
```bash
# Detect domain from trace metadata
DOMAIN=$(jq -r '.metadata.domain // "general"' trace.json)

# Run appropriate eval suite
embedeval eval run traces.jsonl -c evals/${DOMAIN}/*.json -o results.json
```

### Technique 7: Calibration with Human Feedback

Periodically calibrate your self-evaluation against human judgment.

```bash
# 1. Run your automated evals
embedeval eval run traces.jsonl -c auto-evals.json -o auto-results.json

# 2. Get human annotations on same traces
embedeval annotate traces.jsonl -u human@company.com -a human-annotations.jsonl

# 3. Compare agreement
# (Export to notebook for analysis)
embedeval export traces.jsonl \
  --annotations human-annotations.jsonl \
  --results auto-results.json \
  --format notebook \
  --output calibration-analysis.ipynb

# Metrics to track:
# - Agreement rate: How often do auto evals match human?
# - False positive rate: Auto says PASS, human says FAIL
# - False negative rate: Auto says FAIL, human says PASS
```

---

## 🛠️ Common Agent Tasks

### Task: Understand My Failures
```bash
# 1. Collect recent traces
embedeval collect ./logs/recent.jsonl --limit 100

# 2. Annotate them manually
embedeval annotate traces.jsonl --user "agent@system.com"
# (Interactive: review each trace, mark pass/fail, categorize failures)

# 3. Build taxonomy to see patterns
embedeval taxonomy build --user "agent@system.com"

# Output shows:
# - Pass rate: 73%
# - Hallucination: 12 traces (44% of failures)
# - Incomplete: 8 traces (30% of failures)
```

### Task: Add Evaluation for Common Failure
```bash
# After building taxonomy, add evals for top failure categories

# For "hallucination" category:
embedeval eval add
# ? Eval name: no_hallucination
# ? Type: llm-judge
# ? Model: gemini-1.5-flash  (cheaper than main model)
# ? Prompt: Does the response contain factual errors not in context? Answer PASS or FAIL.
# ? Binary output: yes

# Run the eval
embedeval eval run traces.jsonl --config evals.yaml --output results.jsonl

# Generate report
embedeval eval report --results results.jsonl --format markdown
```

### Task: Generate Test Data
```bash
# 1. Create dimensions template
embedeval generate init  # Creates dimensions.yaml

# 2. Edit dimensions.yaml:
# dimensions:
#   query_complexity: [simple, multi_step, edge_case]
#   domain: [billing, technical, general]

# 3. Generate synthetic traces
embedeval generate create \
  --dimensions dimensions.yaml \
  --count 50 \
  --output synthetic-traces.jsonl

# 4. Run your system on synthetic data to collect real traces
# (Implementation depends on your system)

# 5. Evaluate synthetic traces
embedeval annotate synthetic-traces.jsonl --user "tester@system.com"
```

### Task: Export for Analysis
```bash
# Export to Jupyter notebook for deep analysis
embedeval export traces.jsonl \
  --format notebook \
  --annotations annotations.jsonl \
  --output analysis.ipynb

# Notebook includes:
# - Data loading
# - Failure distribution charts
# - Pass/fail vs latency analysis
# - Trace inspection utilities
```

---

## 📦 MCP Server Configuration (NEW in 2.0.5)

For Claude Desktop, Cursor, or other MCP clients:

```json
{
  "mcpServers": {
    "embedeval": {
      "command": "npx",
      "args": ["embedeval", "mcp-server"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

### MCP Tools Available

**Self-Evaluation Tools:**

| Tool | Description | Input |
|------|-------------|-------|
| `evaluate_response` | Full evaluation with multiple evals | `response`, `query`, `evals[]` |
| `quick_eval` | Fast pass/fail check | `response`, `query` |
| `preflight_check` | Pre-send checks | `response`, `query`, `checks[]` |
| `get_confidence` | Confidence score + action | `response`, `query` |
| `should_send_response` | Boolean: should I send? | `response`, `query` |
| `get_improvement_suggestions` | Actionable fixes | `response`, `query`, `failedEvals[]` |
| `get_revision_prompt` | Prompt to improve response | `response`, `suggestions[]` |

**Utility Tools:**

| Tool | Description | Input |
|------|-------------|-------|
| `list_builtin_evals` | List all available evals | none |
| `list_failure_categories` | Known failure types | none |
| `collect_trace` | Record trace for analysis | `query`, `response`, `metadata` |
| `get_collection_stats` | Stats from collected traces | none |

### MCP Tool Examples

**Example: Self-evaluate before sending**
```
1. Call preflight_check(response, query)
2. If failed, call get_improvement_suggestions(response, query, failedChecks)
3. Revise response based on suggestions
4. Call collect_trace(query, response) to record
```

**Example: Confidence-based routing**
```
1. Call get_confidence(response, query)
2. If action == 'send' → deliver response
3. If action == 'revise' → improve and retry
4. If action == 'escalate' → route to human
5. If action == 'clarify' → ask user for more info
```

---

## 🧠 Best Practices for LLMs

### DO:
1. ✅ **Always annotate manually first** - Understand failures before automating
2. ✅ **Use binary judgments** - Pass/fail is faster and clearer
3. ✅ **Build taxonomy** - Let data guide your evals, not imagination
4. ✅ **Start with 50-100 traces** - Minimum for meaningful patterns
5. ✅ **One annotator** - Single domain expert as "benevolent dictator"
6. ✅ **Cheap evals first** - Assertions, regex before LLM-as-judge
7. ✅ **Export to notebooks** - Use Jupyter for statistical analysis
8. ✅ **Version your traces** - Keep historical data for drift detection

### DON'T:
1. ❌ Skip manual annotation - You'll miss critical failure modes
2. ❌ Use 1-5 scales - They create disagreement and slow annotation
3. ❌ Build evals before taxonomy - You'll waste time on wrong metrics
4. ❌ Use multiple annotators - Creates conflict, slows decisions
5. ❌ Start with LLM-as-judge - It's expensive, use sparingly
6. ❌ Generate synthetic data without dimensions - Creates repetitive tests
7. ❌ Commit traces with PII - Sanitize data first

---

## 🔍 Data Format Reference

### Trace (JSONL)
```json
{
  "id": "trace-001",
  "timestamp": "2026-01-30T10:00:00Z",
  "query": "What's your refund policy?",
  "response": "We offer full refunds within 30 days...",
  "context": {
    "retrievedDocs": [
      {"id": "doc-1", "content": "...", "score": 0.94}
    ]
  },
  "metadata": {
    "provider": "google",
    "model": "gemini-1.5-flash",
    "latency": 180,
    "cost": 0.0001
  }
}
```

### Annotation (JSONL)
```json
{
  "id": "ann-001",
  "traceId": "trace-001",
  "annotator": "pm@company.com",
  "timestamp": "2026-01-30T10:05:00Z",
  "label": "fail",  // ONLY "pass" or "fail"
  "failureCategory": "hallucination",
  "notes": "Made up refund time limit",
  "source": "manual"
}
```

### Eval Config (YAML)
```yaml
evals:
  - id: has_content
    name: Has Content
    type: assertion
    priority: cheap
    config:
      check: "response.length > 50"
  
  - id: no_hallucination
    name: No Hallucination
    type: llm-judge
    priority: expensive
    config:
      model: gemini-1.5-flash
      prompt: "Does response contain factual errors? Answer PASS or FAIL."
      binary: true
```

---

## 🚨 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "No traces found" | Check JSONL format, ensure one JSON object per line |
| "Cannot find module" | Run `npm install` or `npm install -g embedeval` |
| "Permission denied" | Use `sudo` for global install, or install locally |
| "Taxonomy empty" | Need ≥1 failed annotation to build taxonomy |
| "Eval failed" | Check eval config syntax, ensure trace has required fields |

---

## 📚 Resources

- **Full Docs**: [README-v2.md](./README-v2.md)
- **Quick Ref**: [QUICKREF-v2.md](./QUICKREF-v2.md)
- **Hamel's FAQ**: https://hamel.dev/blog/posts/evals-faq/
- **GitHub**: https://github.com/Algiras/embedeval
- **NPM**: https://www.npmjs.com/package/embedeval

---

**Remember**: The goal is understanding failures, not perfect metrics. Spend time looking at traces! 👀
