# LLM Integration Guide

> Complete SDK reference for AI agents using EmbedEval for real-time self-evaluation and quality assurance.

---

## Quick Start

### Installation

```bash
npm install embedeval
```

### Environment Setup

```bash
# Required: Set your preferred LLM provider
export GEMINI_API_KEY="your-api-key"        # Recommended: fast, cheap
# OR
export OPENAI_API_KEY="your-api-key"        # High quality
# OR
export OPENAI_BASE_URL="http://localhost:11434/v1"  # Ollama for local
```

### SDK Import

```typescript
import { 
  evaluate,
  preflight, 
  preflightOk,
  getConfidence,
  shouldSend,
  getSuggestions,
  generateRevisionPrompt,
  TraceCollector,
  getKnownCategories,
  getCategorySuggestion
} from 'embedeval/sdk';
```

---

## Core SDK Functions

### 1. Preflight Checks

Run quick validation **before** sending a response to users.

```typescript
// Full preflight check with detailed results
const check = await preflight(response, query, {
  checks: ['coherent', 'safe', 'relevant'],  // Specific checks
  model: 'gemini-2.5-flash-lite',            // Fastest model
});

if (!check.passed) {
  console.log('Failed checks:', check.failedChecks);
  // ['safe'] - response might be unsafe
  console.log('Suggestions:', check.suggestions);
}

// Quick boolean check
const ok = await preflightOk(response, query);
if (!ok) {
  // Revise before sending
}

// Get revision hint
const hint = await needsRevision(response, query);
// "Response may not fully address the question"
```

**Use case:** Gate-keeping responses before delivery to catch obvious issues instantly.

### 2. Confidence Scoring

Decide whether to send, revise, escalate, or ask for clarification.

```typescript
// Full confidence analysis
const result = await getConfidence(response, {
  query: userQuery,
  method: 'hybrid',  // 'llm', 'embedding', or 'hybrid'
  thresholds: {
    send: 0.8,       // Score >= 0.8 → deliver immediately
    revise: 0.6,     // Score >= 0.6 → auto-revise
    escalate: 0.4,   // Score >= 0.4 → human review
    clarify: 0.0,    // Score < 0.4 → ask user for clarification
  },
});

console.log(`Score: ${result.score}`);        // 0.0 - 1.0
console.log(`Action: ${result.action}`);      // 'send' | 'revise' | 'escalate' | 'clarify'
console.log(`Breakdown:`, result.breakdown);
// { relevance: 0.85, completeness: 0.7, accuracy: 0.9, clarity: 0.8 }

// Quick checks
const ok = await shouldSend(response, query);    // boolean
const action = await determineAction(response);   // 'send' | 'revise' | ...
```

**Use case:** Implement confidence-based routing for different quality tiers.

### 3. Full Evaluation

Comprehensive evaluation with multiple evaluators.

```typescript
const result = await evaluate(response, {
  query: userQuery,
  context: retrievedDocs,           // Optional: for RAG systems
  evals: ['coherent', 'factual', 'helpful', 'no-hallucination'],
  metadata: { model: 'claude-4', latency: 1200 },
});

console.log(`Passed: ${result.passed}`);      // true/false
console.log(`Pass rate: ${result.passRate}%`);
console.log(`Results:`, result.results);
// [{ evalId: 'coherent', passed: true, latency: 50 }, ...]

if (!result.passed) {
  const failed = result.results.filter(r => !r.passed);
  console.log('Failed evals:', failed.map(f => f.evalId));
}
```

**Use case:** Post-hoc quality assessment and logging for continuous improvement.

### 4. Improvement Suggestions

Get actionable fixes for failed evaluations.

```typescript
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
// Feed this back to your LLM for revision
const improvedResponse = await llm.generate(revisionPrompt);
```

**Use case:** Auto-improve responses based on specific failure patterns.

### 5. Trace Collection

Automatically collect traces for later analysis.

```typescript
// Create a collector
const collector = new TraceCollector({
  outputFile: './traces.jsonl',
  autoEvaluate: true,  // Run evals automatically
  onTrace: (trace, results) => {
    console.log(`Collected: ${trace.id}, Passed: ${results?.passed}`);
  },
});

// Collect manually
await collector.collect({
  query: userQuery,
  response: myResponse,
  context: { retrievedDocs },
  metadata: { 
    model: 'claude-opus-4', 
    latency: 1200,
    sessionId: 'sess-123'
  },
});

// Get stats
const stats = collector.getStats();
console.log(`Pass rate: ${stats.passRate}%`);
console.log(`Top failures:`, stats.failureCategories);

// Save to file
await collector.save();
```

**Use case:** Continuous monitoring and data collection for offline analysis.

### 6. Failure Categories

Access known failure types and suggested fixes.

```typescript
// List all known categories
const categories = getKnownCategories();
// ['hallucination', 'incomplete', 'incoherent', 'irrelevant', 
//  'wrong-format', 'unsafe', 'no-sources', 'verbose', 
//  'missing-context', 'factual-error']

// Get suggestion for a specific failure
const fix = getCategorySuggestion('hallucination');
// {
//   description: 'Response contains information not supported by context',
//   action: 'Remove or verify facts not in provided context...',
//   severity: 'high'
// }
```

**Use case:** Build custom error handling and remediation logic.

---

## Built-in Evaluators

| Evaluator | Description | Speed | Use Case |
|-----------|-------------|-------|----------|
| `coherent` | Response is well-structured | ⚡ Fast | Gate-keeping |
| `factual` | Contains accurate information | 🔄 Medium | Content verification |
| `helpful` | Addresses user's need | ⚡ Fast | Support quality |
| `complete` | Fully answers the question | ⚡ Fast | Comprehensiveness |
| `safe` | No harmful content | ⚡ Fast | Safety filter |
| `uses-context` | Uses retrieved docs (RAG) | ⚡ Fast | RAG validation |
| `no-hallucination` | No made-up facts | 🔄 Medium | Factuality |
| `has-sources` | Cites sources properly | ⚡ Fast | Attribution |

---

## Complete Self-Evaluation Workflow

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
  
  // 2. Preflight check (fast - < 100ms)
  const check = await preflight(response, query);
  
  if (!check.passed) {
    // 3. Get confidence and decide action
    const confidence = await getConfidence(response, { query });
    
    if (confidence.action === 'revise') {
      // 4. Get suggestions and auto-revise
      const trace = { 
        id: crypto.randomUUID(), 
        query, 
        response, 
        timestamp: new Date().toISOString() 
      };
      const evalResults = check.failedChecks.map(c => ({
        traceId: trace.id, evalId: c, passed: false
      }));
      const suggestions = await getSuggestions(trace, evalResults);
      const revisionPrompt = generateRevisionPrompt(response, suggestions);
      response = await myLLM.generate(revisionPrompt);
      
    } else if (confidence.action === 'escalate') {
      // 5. Route to human
      return '[Escalated to human support]';
      
    } else if (confidence.action === 'clarify') {
      // 6. Ask for clarification
      return 'Could you provide more details about what you need?';
    }
  }
  
  // 7. Collect trace for later analysis
  await collector.collect({
    query,
    response,
    metadata: { revised: !check.passed },
  });
  
  return response;
}
```

---

## MCP Server Configuration

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

| Tool | Description | Input |
|------|-------------|-------|
| `evaluate_response` | Full evaluation with multiple evals | `response`, `query`, `evals[]` |
| `quick_eval` | Fast pass/fail check | `response`, `query` |
| `preflight_check` | Pre-send checks | `response`, `query`, `checks[]` |
| `get_confidence` | Confidence score + action | `response`, `query` |
| `should_send_response` | Boolean: should I send? | `response`, `query` |
| `get_improvement_suggestions` | Actionable fixes | `response`, `query`, `failedEvals[]` |
| `get_revision_prompt` | Prompt to improve response | `response`, `suggestions[]` |
| `list_builtin_evals` | List all available evals | none |
| `list_failure_categories` | Known failure types | none |
| `collect_trace` | Record trace for analysis | `query`, `response`, `metadata` |
| `get_collection_stats` | Stats from collected traces | none |

---

## Provider Configuration

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
# Gemini (recommended - default provider)
export GEMINI_API_KEY="your-api-key"

# OpenAI
export OPENAI_API_KEY="your-api-key"

# OpenRouter (access to Claude, Llama, etc.)
export OPENAI_API_KEY="your-openrouter-key"
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"

# Ollama (local, private)
export OPENAI_BASE_URL="http://localhost:11434/v1"

# Set preferred provider explicitly
export EMBEDEVAL_PROVIDER="gemini"  # or "openai"
```

### Available Models

**Gemini 2.5 Series (Recommended)**

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `gemini-2.5-flash` | ⚡ Fast | 💰 Cheap | **Default** - Best price-performance |
| `gemini-2.5-flash-lite` | ⚡⚡ Fastest | 💰💰 Cheapest | Simple checks, preflight |
| `gemini-2.5-pro` | 🐢 Slow | 💵 High | Complex reasoning |

**OpenAI Models**

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `gpt-4o` | ⚡ Fast | 💵 High | Flagship quality |
| `gpt-4o-mini` | ⚡⚡ Fast | 💰 Cheap | Budget friendly |

### Provider Selection Strategy

```typescript
// Use different providers for different evaluation tiers

// Tier 1: Fast preflight (cheap model)
const preflight = await preflightOk(response, query, {
  model: 'gemini-2.5-flash-lite'  // Fastest, cheapest
});

// Tier 2: Quality evaluation (balanced model)
const result = await evaluate(response, {
  query,
  evals: ['coherent', 'helpful'],
  model: 'gemini-2.5-flash'  // Default, balanced
});

// Tier 3: Deep analysis (strong model, only when needed)
const deep = await evaluate(response, {
  query,
  evals: ['no-hallucination'],
  model: 'gemini-2.5-pro'  // Best quality, expensive
});
```

---

## Best Practices

### 1. Cheap Evals First

Always run fast/cheap evals before expensive LLM-as-judge:

```typescript
// Good: Fast validation before expensive check
const cheap = await preflightOk(response, query);
if (cheap) {
  const deep = await evaluate(response, { query, evals: ['no-hallucination'] });
}

// Bad: Always running expensive eval
const deep = await evaluate(response, { query, evals: ['no-hallucination'] });
```

### 2. Progressive Evaluation

Use confidence thresholds to route responses:

```typescript
const confidence = await getConfidence(response, { query });

switch (confidence.action) {
  case 'send':
    return response;  // Deliver immediately
  case 'revise':
    return await autoRevise(response, query);  // Auto-improve
  case 'escalate':
    return await routeToHuman(query, response);  // Human review
  case 'clarify':
    return askForClarification(query);  // Ask user
}
```

### 3. Continuous Collection

Always collect traces for offline analysis:

```typescript
const collector = new TraceCollector({
  outputFile: './traces.jsonl',
  autoEvaluate: true,
});

// In your response handler
await collector.collect({ query, response, metadata });

// Weekly: Analyze collected traces
// embedeval taxonomy build --annotations annotations.jsonl
```

### 4. Calibration

Periodically verify auto-evals match human judgment:

```bash
# 1. Run your auto-evals
# 2. Get human annotations on same traces
# 3. Compare agreement rates
# 4. Adjust thresholds or prompts based on gaps
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "API key not found" | Set `GEMINI_API_KEY` or `OPENAI_API_KEY` |
| "Evaluation timeout" | Use faster model like `gemini-2.5-flash-lite` |
| "All evals fail" | Check trace format has required fields (query, response) |
| "High latency" | Reduce evals array or use cheaper models |
| "Inconsistent results" | Set `temperature: 0` in eval config |

---

## Resources

- **Main Docs**: [README-v2.md](./README-v2.md)
- **Agent Guide**: [AGENTS.md](./AGENTS.md)
- **Getting Started**: [GETTING_STARTED.md](./GETTING_STARTED.md)
- **Hamel's Eval FAQ**: https://hamel.dev/blog/posts/evals-faq/

---

**Pro tip:** Start with `preflight()` for gate-keeping, then use `getConfidence()` for routing decisions. Collect traces continuously for offline improvement cycles.
