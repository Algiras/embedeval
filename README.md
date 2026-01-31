# EmbedEval v2

> **Binary evals. Trace-centric. Error-analysis-first.**

[![CI/CD](https://github.com/Algiras/embedeval/actions/workflows/ci.yml/badge.svg)](https://github.com/Algiras/embedeval/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/embedeval.svg)](https://badge.fury.io/js/embedeval)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A command-line tool for evaluating LLM outputs using **binary pass/fail judgments**, built on [Hamel Husain's evaluation principles](https://hamel.dev/blog/posts/evals-faq/).

**[📖 Full LLM Guide](LLM.md)** | **[🚀 Quick Start](#quick-start)** | **[📊 GitHub Pages](https://algiras.github.io/embedeval/)**

---

## Why EmbedEval?

Most teams struggle with LLM evaluation because they:
- ❌ Use complex 1-5 scales (hard to agree on)
- ❌ Skip manual error analysis (miss critical failures)
- ❌ Start with expensive LLM-as-judge (waste money)
- ❌ Build evals before understanding failures (measure wrong things)

EmbedEval fixes this with Hamel Husain's proven approach:
- ✅ **Binary only** - PASS or FAIL, no debating
- ✅ **Error analysis first** - Look at traces before automating
- ✅ **Cheap evals first** - Assertions before LLM-as-judge
- ✅ **Trace-centric** - Complete session records
- ✅ **Single annotator** - "Benevolent dictator" model

---

## Quick Start

### Install

**Option 1: Quick Install (Recommended)**
```bash
curl -fsSL https://raw.githubusercontent.com/Algiras/embedeval/main/install.sh | bash
```

**Option 2: npm (Global)**
```bash
npm install -g embedeval
```

**Option 3: npx (No Install)**
```bash
npx embedeval <command>
```

### 3-Command Workflow

```bash
# 1. COLLECT - Import your LLM traces
embedeval collect ./production-logs.jsonl --output traces.jsonl

# 2. ANNOTATE - Manual error analysis (30 min for 50-100 traces)
embedeval annotate traces.jsonl --user "expert@company.com"

# 3. TAXONOMY - Build failure taxonomy
embedeval taxonomy build --annotations annotations.jsonl
```

That's it. You'll now see:
```
Pass Rate: 73%

Top Failure Categories:
1. Hallucination: 12 traces (44%)
2. Incomplete: 8 traces (30%)
3. Wrong Format: 5 traces (19%)
```

---

## Development (Contributors)

If you're developing or contributing to EmbedEval, use the `embedeval-dev` script:

```bash
# Clone the repository
git clone https://github.com/Algiras/embedeval.git
cd embedeval

# Check your dev environment
./embedeval-dev --doctor

# Install dependencies
./embedeval-dev --install-deps

# Build TypeScript
./embedeval-dev --build

# Run CLI commands (no global install needed)
./embedeval-dev collect examples/v2/sample-traces.jsonl
./embedeval-dev view test-traces.jsonl
./embedeval-dev annotate test-traces.jsonl --user "dev@local"

# Development utilities
./embedeval-dev --watch     # Watch mode for auto-rebuild
./embedeval-dev --test      # Run test suite
./embedeval-dev --lint      # Run ESLint
./embedeval-dev --types     # TypeScript type check
./embedeval-dev --clean     # Clean build artifacts
```

---

## Core Commands

### Error Analysis (Primary Workflow)

```bash
# Import traces from JSONL
embedeval collect ./logs.jsonl --output traces.jsonl

# Interactive annotation (p=pass, f=fail, s=save)
embedeval annotate traces.jsonl --user "pm@company.com"

# Read-only viewer
embedeval view traces.jsonl

# Build failure taxonomy
embedeval taxonomy build --user "pm@company.com"

# Display taxonomy
embedeval taxonomy show
```

### Binary Evaluation

```bash
# Add evaluator (interactive wizard)
embedeval eval add

# List evaluators
embedeval eval list

# Run evaluations
embedeval eval run traces.jsonl --config evals.yaml

# Generate report
embedeval eval report --results results.jsonl
```

### Synthetic Data & Export

```bash
# Create dimensions template
embedeval generate init

# Generate synthetic traces
embedeval generate create --dimensions dims.yaml --count 50

# Export to Jupyter notebook
embedeval export traces.jsonl --format notebook

# Generate HTML dashboard
embedeval report --traces traces.jsonl --annotations annotations.jsonl
```

---

## Key Principles

### 1. Binary Only ✓/✗
```yaml
# GOOD: Clear, fast decisions
evals:
  - name: is_accurate
    type: llm-judge
    binary: true  # Only PASS or FAIL

# BAD: Never do this
evals:
  - name: quality_score
    type: 1_to_5  # Creates disagreement
```

### 2. Error Analysis First 👀
```bash
# Spend 60-80% of time here:
embedeval annotate traces.jsonl --user "expert@company.com"

# NOT here (automate only after understanding):
# embedeval eval run traces.jsonl  # (do this AFTER annotation)
```

### 3. Cheap Evals First 💰
```yaml
evals:
  # Run cheap evals first
  - name: has_content
    type: assertion
    check: "response.length > 100"
    priority: cheap
  
  # Expensive evals only for complex cases
  - name: factual_accuracy
    type: llm-judge
    priority: expensive
```

### 4. Single Annotator 👤
```bash
# One "benevolent dictator" owns quality:
embedeval annotate traces.jsonl --user "product-manager@company.com"

# Not multiple people voting (causes conflict)
```

---

## Installation Methods

### NPM (Recommended)
```bash
npm install -g embedeval
```

### NPX (No Install)
```bash
npx embedeval collect ./logs.jsonl
```

### From Source
```bash
git clone https://github.com/Algiras/embedeval.git
cd embedeval
npm install
npm run build
npm link  # Makes 'embedeval' command available globally
```

---

## Data Formats

### Trace (JSONL)
One JSON object per line:
```json
{"id": "trace-001", "timestamp": "2026-01-30T10:00:00Z", "query": "What's your refund policy?", "response": "We offer full refunds within 30 days...", "metadata": {"provider": "google", "model": "gemini-1.5-flash", "latency": 180}}
```

### Annotation (JSONL)
```json
{"id": "ann-001", "traceId": "trace-001", "annotator": "pm@company.com", "timestamp": "2026-01-30T10:05:00Z", "label": "fail", "failureCategory": "hallucination", "notes": "Made up refund time limit"}
```

### Eval Config (YAML)
```yaml
evals:
  - id: has_content
    type: assertion
    priority: cheap
    config:
      check: "response.length > 50"
  
  - id: accurate
    type: llm-judge
    priority: expensive
    config:
      model: gemini-1.5-flash
      prompt: "PASS or FAIL: Is this accurate?"
      binary: true
```

---

## Example Workflows

### Weekly Evaluation
```bash
# Collect week's traces
embedeval collect ./logs/week-$(date +%Y-%m-%d).jsonl

# Sample 100 for annotation
head -n 100 traces.jsonl > sample.jsonl

# Annotate
embedeval annotate sample.jsonl --user "pm@company.com"

# Build/update taxonomy
embedeval taxonomy update

# Run all evals
embedeval eval run traces.jsonl --config evals.yaml

# Generate report
embedeval report --traces traces.jsonl --annotations annotations.jsonl
```

### Add Eval for Common Failure
```bash
# 1. Build taxonomy to see top failures
embedeval taxonomy build

# 2. Add eval for top category (e.g., hallucination)
embedeval eval add
# Interactive wizard asks for type, model, prompt

# 3. Run the new eval
embedeval eval run traces.jsonl --config evals.yaml
```

### Generate Test Data
```bash
# 1. Create dimensions file
embedeval generate init
# Edit dimensions.yaml to define test scenarios

# 2. Generate synthetic traces
embedeval generate create -d dimensions.yaml -n 50

# 3. Run your system on synthetic queries
# (Implementation depends on your system)

# 4. Evaluate
embedeval annotate synthetic-traces.jsonl --user "tester@company.com"
```

---

## MCP Server (AI Agents)

For Claude, Cursor, or other MCP clients:

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

See [LLM.md](LLM.md) for detailed agent usage guide.

---

## Deployment

### Vercel (One-Click)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Algiras/embedeval)

### GitHub Pages
Already configured. Site updates automatically on push to main.

### CI/CD
GitHub Actions workflow included. Runs on every PR:
- Type checking
- Build verification
- CLI command tests

---

## Documentation

- **[LLM.md](LLM.md)** - Complete guide for AI agents and LLMs
- **[GitHub Pages](https://algiras.github.io/embedeval/)** - Visual documentation
- **[Hamel's Eval FAQ](https://hamel.dev/blog/posts/evals-faq/)** - Methodology reference

---

## Features

- ✅ **Interactive Annotation** - Terminal UI for fast binary annotation
- ✅ **Failure Taxonomy** - Auto-categorize failures with axial coding
- ✅ **Binary Evaluation** - Assertions, regex, code, LLM-as-judge
- ✅ **Synthetic Data** - Dimension-based test generation
- ✅ **Jupyter Export** - Statistical analysis notebooks
- ✅ **HTML Reports** - Shareable dashboards
- ✅ **JSONL Storage** - Simple, grep-friendly, no databases
- ✅ **Zero Infrastructure** - No Redis, no queues, no setup

---

## Why v2?

v1 had 88 files with complex A/B testing, genetic algorithms, and BullMQ queues.

v2 has ~20 files with a simple philosophy: **look at your traces first**.

**Before:** Infrastructure-heavy, hard to understand  
**After:** Simple CLI, clear workflow, Hamel Husain principles

---

## License

MIT

---

Built with ❤️ following [Hamel Husain's](https://hamel.dev) principles. The goal is understanding failures, not perfect metrics. Spend time looking at traces! 👀
