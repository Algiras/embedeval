# Getting Started with EmbedEval

Welcome! This 10-minute tutorial will walk you through evaluating your AI agent with EmbedEval.

## Prerequisites

- Node.js 18+ installed
- An API key (Gemini or OpenAI) for LLM-judge evals
- Agent logs in JSONL format (or create sample data below)

---

## Step 1: Verify Installation

```bash
embedeval --version
# Should show: embedeval v2.x.x

# If not installed:
npm install -g embedeval

# Set up API key (required for LLM evals)
export GEMINI_API_KEY="your-api-key-here"
```

---

## Step 2: Collect Your First Traces

Traces contain queries, responses, and metadata.

```bash
# If you have logs:
embedeval collect ./agent-logs.jsonl --output traces.jsonl

# Or create sample data:
cat > sample-traces.jsonl << 'EOF'
{"id":"trace-1","timestamp":"2026-01-31T10:00:00Z","query":"What's your refund policy?","response":"We offer full refunds within 30 days.","metadata":{"model":"gemini-2.5-flash","latency":150}}
{"id":"trace-2","timestamp":"2026-01-31T10:05:00Z","query":"How do I reset my password?","response":"Click 'Forgot Password' on login page.","metadata":{"model":"gemini-2.5-flash","latency":120}}
{"id":"trace-3","timestamp":"2026-01-31T10:10:00Z","query":"Can I get a free trial?","response":"Yes! We offer a 14-day free trial.","metadata":{"model":"gemini-2.5-flash","latency":180}}
EOF

embedeval collect ./sample-traces.jsonl --output traces.jsonl
```

---

## Step 3: View Your Traces

```bash
embedeval view traces.jsonl
```

Navigate with `j` (next) and `k` (previous). Search with `/pattern`, quit with `q`.

---

## Step 4: Annotate Traces (Most Important!)

This is the **most important step** - understand failures before automating.

```bash
embedeval annotate traces.jsonl --user "you@company.com"
```

**Keyboard shortcuts:**
- `p` = Mark PASS ✓
- `f` = Mark FAIL ✗ (then select category)
- `j/k` = Next/previous trace
- `c` = Change category
- `n` = Edit notes
- `s` = Save and quit

**Common mistakes:**
- ❌ Skipping annotations - You'll miss failure modes
- ❌ Using 1-5 scales - Binary (pass/fail) is faster
- ❌ Annotating too few traces - Aim for 50-100

---

## Step 5: Build Failure Taxonomy

```bash
embedeval taxonomy build --annotations annotations.jsonl
```

**Output:**
```
═══════════════════════════════════════════════
           FAILURE TAXONOMY REPORT
═══════════════════════════════════════════════

📊 Total Traces: 3
✅ Passed: 2 (66.7%)
❌ Failed: 1 (33.3%)

🔍 FAILURE CATEGORIES:
  hallucination: 1 trace (100.0% of failures)
```

This shows your pass rate and failure patterns. Build taxonomy BEFORE creating evals.

---

## Step 6: Run Your First Evaluation

Create an eval config and run it:

```bash
cat > my-evals.json << 'EOF'
{
  "evals": [
    {
      "id": "has_content",
      "name": "Has Content",
      "type": "assertion",
      "priority": "cheap",
      "config": {"check": "response.length > 20"}
    },
    {
      "id": "no_hallucination",
      "name": "No Hallucination",
      "type": "llm-judge",
      "priority": "expensive",
      "config": {
        "model": "gemini-2.5-flash",
        "prompt": "Check for factual errors. Query: {query} Response: {response} Answer PASS or FAIL."
      }
    }
  ]
}
EOF

embedeval eval run traces.jsonl --config my-evals.json --output results.json
```

**Output:**
```
✅ Results:
  Total traces: 3
  Passed: 2 (66.7%)
  Failed: 1

📊 Eval breakdown:
  Has Content: 3 pass, 0 fail (100.0%)
  No Hallucination: 2 pass, 1 fail (66.7%)
```

**Common mistakes:**
- ❌ Starting with expensive LLM evals - Run cheap evals first
- ❌ Not setting API keys - LLM evals require Gemini or OpenAI

---

## Step 7: Export Results for Analysis

```bash
embedeval export traces.jsonl \
  --annotations annotations.jsonl \
  --results results.json \
  --format notebook \
  --output analysis.ipynb

jupyter notebook analysis.ipynb
```

---

## Step 8: Next Steps

### Collect More Data
```bash
embedeval collect ./logs.jsonl --output traces.jsonl
# Aim for 50-100 traces minimum
```

### Try the High-Level DSL
```bash
embedeval dsl init chatbot -o my-evals.eval
# Edit with natural language, then:
embedeval dsl run my-evals.eval traces.jsonl -o results.json
```

### Real-Time Monitoring
```bash
embedeval watch traces.jsonl --dsl my-evals.eval
```

### Generate Reports
```bash
embedeval report -t traces.jsonl -a annotations.jsonl -o report.html
```

---

## Resources

- **Full Documentation**: [README-v2.md](./README-v2.md)
- **Quick Reference**: [QUICKREF-v2.md](./QUICKREF-v2.md)
- **Hamel's FAQ**: https://hamel.dev/blog/posts/evals-faq/
- **GitHub**: https://github.com/Algiras/embedeval

---

## Common Troubleshooting

| Problem | Solution |
|---------|----------|
| `command not found` | `npm install -g embedeval` |
| "No traces found" | Check JSONL format (one JSON per line) |
| "API key not found" | Set `GEMINI_API_KEY` or `OPENAI_API_KEY` |
| "Taxonomy empty" | Need at least 1 failed annotation |
| "Eval failed" | Check config syntax and trace fields |

---

## Key Principles

1. **Binary judgments only** - Pass/fail, not 1-5 scales
2. **Error analysis first** - Annotate manually before automating
3. **Cheap evals first** - Assertions/regex before LLM-as-judge
4. **Start small** - 50-100 traces minimum
5. **One annotator** - Single domain expert

---

**Ready to dive deeper?** Check out the [full documentation](./README-v2.md) for SDK integration, multi-model benchmarking, and drift detection.

Happy evaluating! 🎯
