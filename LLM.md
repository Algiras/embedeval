# EmbedEval v2 - LLM Usage Guide

> **TL;DR**: Binary evaluation CLI for LLM systems. Install: `npm install -g embedeval`. Core workflow: `collect` → `annotate` → `taxonomy build`.

## What is EmbedEval?

A command-line tool for evaluating LLM outputs using **binary pass/fail judgments**, built on [Hamel Husain's evaluation principles](https://hamel.dev/blog/posts/evals-faq/).

### Key Principles

1. **Binary Only** - PASS or FAIL. No 1-5 scales.
2. **Error Analysis First** - Manually review traces before automating.
3. **Trace-Centric** - Complete records: query + response + context + metadata.
4. **Cheap Evals First** - Use assertions/regex before expensive LLM-as-judge.
5. **Benevolent Dictator** - One domain expert annotates (no committees).

## Installation

```bash
npm install -g embedeval
```

Or use npx (no install):
```bash
npx embedeval <command>
```

## Core Workflow (3 Steps)

```bash
# 1. COLLECT - Import your LLM traces
embedeval collect ./production-logs.jsonl --output traces.jsonl

# 2. ANNOTATE - Manual error analysis (30 min for 50-100 traces)
embedeval annotate traces.jsonl --user "expert@company.com"

# 3. TAXONOMY - Build failure taxonomy
embedeval taxonomy build --annotations annotations.jsonl
```

## Essential Commands

### Error Analysis (Start Here)

| Command | Purpose | Example |
|---------|---------|---------|
| `collect <source>` | Import traces from JSONL | `embedeval collect ./logs.jsonl` |
| `annotate <traces> -u <email>` | Binary annotation (interactive) | `embedeval annotate traces.jsonl -u pm@co.com` |
| `view <traces>` | Read-only trace viewer | `embedeval view traces.jsonl` |
| `taxonomy build` | Build failure taxonomy | `embedeval taxonomy build -a annotations.jsonl` |
| `taxonomy show` | Display taxonomy | `embedeval taxonomy show` |

### Binary Evaluation

| Command | Purpose | Example |
|---------|---------|---------|
| `eval add` | Add evaluator (interactive wizard) | `embedeval eval add` |
| `eval list` | List registered evals | `embedeval eval list` |
| `eval run <traces> -c <config>` | Run evals | `embedeval eval run traces.jsonl -c evals.yaml` |
| `eval report -r <results>` | Generate report | `embedeval eval report -r results.jsonl` |

### Synthetic Data & Export

| Command | Purpose | Example |
|---------|---------|---------|
| `generate init` | Create dimensions template | `embedeval generate init` |
| `generate create -d <dims> -n <count>` | Generate synthetic traces | `embedeval generate create -d dims.yaml -n 50` |
| `export <traces> -f notebook` | Export to Jupyter | `embedeval export traces.jsonl -f notebook` |
| `report -t <traces> -a <annots>` | HTML dashboard | `embedeval report -t traces.jsonl -a annotations.jsonl` |

## Interactive Annotation Shortcuts

When running `embedeval annotate`:

| Key | Action |
|-----|--------|
| `p` | Mark as **PASS** ✓ |
| `f` | Mark as **FAIL** ✗ (then select category) |
| `c` | Change failure category |
| `n` | Edit notes |
| `j` or `Enter` | Next trace |
| `k` | Previous trace |
| `s` or `q` | **Save and quit** |

## Data Formats

### Trace (JSONL)
One JSON object per line:
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
  "label": "fail",
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
      prompt: "Context: {context}\nResponse: {response}\n\nDoes the response contain factual errors not in the context? Answer ONLY 'PASS' or 'FAIL'."
      binary: true
```

### Dimensions (YAML) - For Synthetic Data
```yaml
dimensions:
  query_type:
    - simple_lookup
    - multi_step
    - edge_case
  domain:
    - billing
    - technical
    - general
  user_sentiment:
    - frustrated
    - neutral
    - happy
```

## Common Tasks for LLMs

### Task 1: Understand Your Failures
```bash
# Collect recent traces
embedeval collect ./logs/recent.jsonl --limit 100

# Annotate manually (this is where you learn)
embedeval annotate traces.jsonl --user "expert@company.com"

# Build taxonomy to see patterns
embedeval taxonomy build --user "expert@company.com"

# View the taxonomy
embedeval taxonomy show
```

**Expected Output:**
```
Pass Rate: 73.0% (73 passed, 27 failed)

Top Failure Categories:
1. Hallucination: 12 traces (44% of failures)
2. Incomplete: 8 traces (30% of failures)  
3. Wrong Format: 5 traces (19% of failures)
```

### Task 2: Add Eval for Top Failure
```bash
# After building taxonomy, add evals for persistent issues

# For "hallucination" category:
embedeval eval add
# Interactive wizard:
# ? Eval name: no_hallucination
# ? Type: llm-judge
# ? Model: gemini-1.5-flash (cheaper than your main model)
# ? Prompt: Does response contain factual errors not in context? Answer PASS or FAIL.
# ? Binary output: yes (required)

# Run the eval
embedeval eval run traces.jsonl --config evals.yaml --output results.jsonl

# Generate report
embedeval eval report --results results.jsonl --format markdown
```

### Task 3: Generate Test Data
```bash
# Create dimensions file
embedeval generate init
# Edit dimensions.yaml to define your test scenarios

# Generate 50 synthetic test cases
embedeval generate create \
  --dimensions dimensions.yaml \
  --count 50 \
  --output synthetic-traces.jsonl

# Run your LLM system on synthetic queries to generate real traces
# (This step depends on your system)

# Evaluate synthetic traces
embedeval annotate synthetic-traces.jsonl --user "tester@company.com"
embedeval eval run synthetic-traces.jsonl --config evals.yaml
```

### Task 4: Export for Analysis
```bash
# Export to Jupyter notebook for statistical analysis
embedeval export traces.jsonl \
  --format notebook \
  --annotations annotations.jsonl \
  --results eval-results.jsonl \
  --output analysis.ipynb

# Notebook includes:
# - Failure distribution charts
# - Pass/fail vs latency analysis
# - Category breakdown
# - Trace inspection utilities
```

### Task 5: Weekly Evaluation Workflow
```bash
# Automated weekly evaluation pipeline

# 1. Collect week's traces
embedeval collect ./logs/week-$(date +%Y-%m-%d).jsonl

# 2. Sample 100 for annotation
head -n 100 traces.jsonl > sample-traces.jsonl

# 3. Annotate (if not automated)
embedeval annotate sample-traces.jsonl --user "pm@company.com"

# 4. Update taxonomy
embedeval taxonomy update

# 5. Run all evals
embedeval eval run traces.jsonl --config evals.yaml

# 6. Generate report
embedeval report \
  --traces traces.jsonl \
  --annotations annotations.jsonl \
  --results eval-results.jsonl \
  --output weekly-report.html
```

## Hamel Husain Principles (MUST FOLLOW)

### ✅ DO

1. **Start with Manual Annotation**
   ```bash
   # Spend 60-80% of time here
   embedeval annotate traces.jsonl --user "expert@company.com"
   ```

2. **Use Binary Judgments Only**
   ```yaml
   # GOOD: Binary
   label: pass  # or fail
   
   # BAD: Never do this
   quality_score: 3  # out of 5
   ```

3. **Build Taxonomy Before Adding Evals**
   ```bash
   # Let data guide you, not imagination
   embedeval taxonomy build
   # Then add evals for top categories
   ```

4. **Use Single Annotator (Benevolent Dictator)**
   ```bash
   # One person owns quality
   embedeval annotate traces.jsonl --user "product-manager@company.com"
   ```

5. **Start with 50-100 Traces**
   ```bash
   embedeval collect ./logs.jsonl --limit 100
   ```

6. **Cheap Evals First**
   ```yaml
   evals:
     - type: assertion      # CHEAP - run first
       priority: cheap
     - type: llm-judge      # EXPENSIVE - run last
       priority: expensive
   ```

7. **Export to Notebooks for Analysis**
   ```bash
   embedeval export traces.jsonl --format notebook
   ```

### ❌ DON'T

1. **Never Skip Manual Annotation**
   ```bash
   # WRONG: Going straight to automation
   embedeval eval run traces.jsonl --config evals.yaml
   
   # RIGHT: Annotate first
   embedeval annotate traces.jsonl --user "expert@company.com"
   embedeval taxonomy build
   embedeval eval add  # Add evals for discovered failures
   ```

2. **Never Use 1-5 Scales or Likert**
   ```yaml
   # NEVER DO THIS
   rating: 1_to_5
   
   # ALWAYS DO THIS
   label: pass  # or fail
   ```

3. **Never Build Evals Before Understanding Failures**
   ```bash
   # WRONG: Imagining what might fail
   embedeval eval add  # Don't do this first!
   
   # RIGHT: Look at data first
   embedeval annotate traces.jsonl
   embedeval taxonomy build  # See what actually fails
   embedeval eval add  # Now add targeted evals
   ```

4. **Never Use Multiple Annotators**
   ```bash
   # WRONG: Multiple people voting
   # Leads to disagreements and slow decisions
   
   # RIGHT: Single "benevolent dictator"
   embedeval annotate traces.jsonl --user "pm@company.com"
   ```

5. **Never Start with LLM-as-Judge**
   ```yaml
   # WRONG: Expensive from the start
   evals:
     - type: llm-judge  # Slow and costly
       model: gpt-4
   
   # RIGHT: Cheap evals first
   evals:
     - type: assertion  # Fast and free
       check: "response.length > 0"
     - type: llm-judge   # Only for complex cases
       model: gemini-flash  # Cheaper model
   ```

6. **Never Generate Synthetic Data Without Dimensions**
   ```bash
   # WRONG: Generic generation
   # Results in repetitive, unhelpful test cases
   
   # RIGHT: Structured dimensions
   embedeval generate init  # Create dimensions.yaml
   # Edit to define: query_type, domain, user_sentiment, etc.
   embedeval generate create -d dimensions.yaml -n 50
   ```

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| "No traces found" | Invalid JSONL format | Check: one JSON object per line, no trailing commas |
| "Cannot find module" | Not installed | Run `npm install -g embedeval` |
| "Taxonomy empty" | No failed annotations | Need ≥1 trace with `label: fail` |
| "Eval failed" | Config syntax error | Check YAML indentation, quotes |
| "Permission denied" | File permissions | Use `sudo` for global install, or install locally |
| "Binary output required" | LLM-as-judge config | Set `binary: true` in eval config |

## MCP Server Integration

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

### MCP Tools

| Tool | Input | Output |
|------|-------|--------|
| `collect_traces` | `source: string` | `traces_file: string` |
| `annotate_traces` | `traces: string, user: string` | `annotations_file: string` |
| `build_taxonomy` | `annotations: string` | `taxonomy: object` |
| `add_eval` | `name: string, type: string` | `eval_id: string` |
| `run_evals` | `traces: string, evals: string` | `results: object` |
| `export_notebook` | `traces: string, format: string` | `notebook: string` |

## Quick Reference Card

**3-Command Workflow:**
```bash
embedeval collect ./logs.jsonl
embedeval annotate traces.jsonl -u you@company.com
embedeval taxonomy build
```

**Annotate Shortcuts:**
- `p` = pass
- `f` = fail
- `s` = save & quit

**Data Files:**
- Traces: `traces.jsonl` (JSONL format)
- Annotations: `annotations.jsonl` (JSONL format)
- Taxonomy: `taxonomy.json` (JSON format)
- Evals: `evals.yaml` (YAML format)

**Principles:**
1. Binary only (pass/fail)
2. Error analysis first
3. Cheap evals first
4. Single annotator
5. Start with 50-100 traces

---

**Remember**: The goal is understanding failures, not perfect metrics. Spend time looking at traces! 👀

**Resources:**
- Full docs: [README.md](./README.md)
- Hamel's FAQ: https://hamel.dev/blog/posts/evals-faq/
- GitHub: https://github.com/Algiras/embedeval
- NPM: https://www.npmjs.com/package/embedeval
