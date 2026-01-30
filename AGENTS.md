# EmbedEval v2 - Agent & LLM Usage Guide

> **Quick Reference**: Binary evals, trace-centric, error-analysis-first. Built on [Hamel Husain's principles](https://hamel.dev/blog/posts/evals-faq/).

---

## 🚀 For AI Agents (Claude, GPT, etc.)

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
| **Eval Add** | `embedeval eval add` | Add new evaluator |
| **Eval Run** | `embedeval eval run <traces> -c <config>` | Run evals |
| **Generate** | `embedeval generate create -d <dims> -n <count>` | Synthetic data |
| **Export** | `embedeval export <traces> -f notebook` | Jupyter notebook |
| **Report** | `embedeval report -t <traces> -a <annots>` | HTML dashboard |

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

## 📦 MCP Server Configuration

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

| Tool | Input | Output |
|------|-------|--------|
| `collect_traces` | `source: string` | `traces_file: string` |
| `annotate_traces` | `traces: string, user: string` | `annotations_file: string` |
| `build_taxonomy` | `annotations: string` | `taxonomy: object` |
| `add_eval` | `name: string, type: string, config: object` | `eval_id: string` |
| `run_evals` | `traces: string, evals: string` | `results: object` |
| `export_notebook` | `traces: string, format: string` | `notebook_path: string` |

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
