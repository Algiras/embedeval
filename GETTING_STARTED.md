# 🚀 Getting Started with EmbedEval v2

> Binary evals, trace-centric, error-analysis-first. The evaluation CLI that actually works.

Welcome! This guide will get you from zero to insights in **under 5 minutes**.

---

## ⚡ Quick Start (3 Commands)

```bash
# 1. Install
npm install -g embedeval

# 2. Check it works
embedeval --version

# 3. Run the getting started wizard
embedeval doctor  # Built-in helper to check your setup
```

---

## 🎯 Your First Evaluation (5 Minutes)

### Step 1: Create Sample Data

```bash
# Create a sample trace file
cat > my-traces.jsonl << 'EOF'
{"id":"trace-001","timestamp":"2026-01-31T10:00:00Z","query":"What's your refund policy?","response":"We offer full refunds within 30 days of purchase with no questions asked.","context":{"retrievedDocs":[{"id":"doc-1","content":"Refund policy: 30 days, no questions.","score":0.95}]},"metadata":{"provider":"openai","model":"gpt-4","latency":180}}
{"id":"trace-002","timestamp":"2026-01-31T10:01:00Z","query":"How do I integrate your API?","response":"To integrate, generate an API key from your dashboard. We support REST endpoints with Bearer token authentication.","context":{"retrievedDocs":[{"id":"doc-2","content":"API docs: REST, Bearer tokens.","score":0.92}]},"metadata":{"provider":"openai","model":"gpt-4","latency":220}}
{"id":"trace-003","timestamp":"2026-01-31T10:02:00Z","query":"What's enterprise pricing?","response":"Enterprise starts at $999/month. Actually, let me correct that - I don't have current pricing info.","context":{"retrievedDocs":[{"id":"doc-3","content":"Enterprise: Contact sales.","score":0.78}]},"metadata":{"provider":"openai","model":"gpt-4","latency":340}}
EOF

echo "✅ Created my-traces.jsonl with 3 sample traces"
```

### Step 2: Collect & View

```bash
# Collect traces (confirms format is correct)
embedeval collect my-traces.jsonl --output collected.jsonl

# View them
embedeval view collected.jsonl
```

**Output:**
```
🔍 Viewing traces (read-only)

Found 3 traces

================================================================================
Trace 1/3 | ID: trace-001
Status: Not annotated

Query:
What's your refund policy?

Response:
We offer full refunds within 30 days of purchase with no questions asked.

Metadata: openai | gpt-4 | 180ms
```

### Step 3: Annotate (The Magic ✨)

```bash
# Annotate manually - this is where you learn about failures
embedeval annotate collected.jsonl --user "you@example.com"
```

**Interactive Mode:**
```
📝 Interactive Trace Annotation

Trace 1/3 | ID: trace-001
Query: What's your refund policy?
Response: We offer full refunds within 30 days...

Your judgment:
[p] Pass  [f] Fail  [c] Category  [n] Notes  [s] Save & Quit

You pressed: p
✅ Marked as PASS

---

Trace 3/3 | ID: trace-003
Query: What's enterprise pricing?
Response: Enterprise starts at $999/month. Actually, let me correct that...

Your judgment:
[p] Pass  [f] Fail  [c] Category  [n] Notes  [s] Save & Quit

You pressed: f
❌ Marked as FAIL
Select failure category:
1. hallucination
2. incomplete
3. wrong-format
4. other

You selected: 1 (hallucination)
Notes: Made up pricing then corrected itself
✅ Saved

💾 Saved to annotations.jsonl
```

### Step 4: Build Taxonomy

```bash
# Automatically categorize failures
embedeval taxonomy build \
  --annotations annotations.jsonl \
  --user "you@example.com" \
  --output my-taxonomy.json
```

**Output:**
```
🏗️  Building Failure Taxonomy

✅ Taxonomy built successfully!

Statistics:
  Total annotated: 3
  Pass rate: 66.7%
  Failed traces: 1

Failure Categories:
  1. Hallucination: 1 (100.0%)
     Made up pricing then corrected itself.

💾 Saved to: my-taxonomy.json
```

🎉 **Congratulations!** You've completed your first evaluation cycle!

---

## 📊 What You Learned

In just 5 minutes, you:
- ✅ Imported 3 traces
- ✅ Annotated them with binary pass/fail
- ✅ Identified 1 hallucination failure
- ✅ Built a failure taxonomy
- ✅ Learned your pass rate is 67%

**Key Insight:** Your LLM is hallucinating on pricing questions. This is a specific, actionable finding you can fix!

---

## 🚀 Next Steps

### Option 1: Evaluate Your Real Data (Recommended)

```bash
# Export traces from your LLM system
# Format should match the sample above

# Collect your production traces
embedeval collect ./production-logs.jsonl --output traces.jsonl

# Annotate 50-100 traces (takes ~30 min)
embedeval annotate traces.jsonl --user "you@company.com"

# Build taxonomy
embedeval taxonomy build --annotations annotations.jsonl
```

### Option 2: Add Automated Evaluations

```bash
# Add cheap evaluators (fast, deterministic)
embedeval eval add \
  --name "has_content" \
  --type assertion \
  --config 'response.length > 50'

# Add expensive eval (LLM-as-judge)
embedeval eval add \
  --name "no_hallucination" \
  --type llm-judge \
  --config '{"model": "gemini-1.5-flash", "prompt": "Is this factual? PASS or FAIL", "binary": true}'

# Run automated evals
embedeval eval run traces.jsonl --config evals.yaml --output results.jsonl
```

### Option 3: Generate Synthetic Test Data

```bash
# Create test dimensions
embedeval generate init --output dimensions.yaml

# Edit dimensions.yaml:
# dimensions:
#   query_type: [factual, opinion, technical]
#   complexity: [simple, complex]

# Generate 50 synthetic traces
embedeval generate create \
  --dimensions dimensions.yaml \
  --count 50 \
  --output synthetic-traces.jsonl
```

---

## 📖 Understanding the Philosophy

EmbedEval follows [Hamel Husain's principles](https://hamel.dev/blog/posts/evals-faq/):

### 1. **Error Analysis First** 👀
```
❌ BAD: Build 50 automated evals immediately
✅ GOOD: Manually annotate 50 traces first
   Why: You'll discover failure patterns you never imagined
```

### 2. **Binary Only** ✓/✗
```
❌ BAD: Rate quality 1-5 (creates disagreement, slow)
✅ GOOD: Pass or fail (fast, clear, actionable)
```

### 3. **Start Small** 📊
```
❌ BAD: Annotate 1000 traces (overwhelming)
✅ GOOD: Annotate 50 traces (find patterns quickly)
```

### 4. **Single Annotator** 👤
```
❌ BAD: Multiple people voting (creates conflict)
✅ GOOD: One "benevolent dictator" owns quality
```

---

## 🔧 Common Use Cases

### Use Case 1: Chatbot Quality Check
```bash
# 1. Export chat logs
embedeval collect ./chat-logs.jsonl --output traces.jsonl

# 2. Annotate for accuracy
embedeval annotate traces.jsonl --user "pm@company.com"

# 3. See what breaks
embedeval taxonomy build --annotations annotations.jsonl
```

### Use Case 2: RAG System Evaluation
```bash
# Check if retrieved docs match responses
embedeval eval add \
  --name "retrieval_match" \
  --type llm-judge \
  --config '{"prompt": "Does response use info from context? PASS or FAIL"}'

embedeval eval run traces.jsonl --config evals.yaml
```

### Use Case 3: API Response Testing
```bash
# Generate synthetic API test cases
embedeval generate init --output api-dimensions.yaml
# Edit: dimensions.endpoint, dimensions.method, dimensions.auth

embedeval generate create \
  --dimensions api-dimensions.yaml \
  --count 100 \
  --output api-tests.jsonl

# Run through your API
# (Your code here to hit API with test queries)

# Evaluate responses
embedeval collect api-responses.jsonl --output traces.jsonl
embedeval annotate traces.jsonl --user "tester@company.com"
```

---

## 🛠️ Troubleshooting

### "embedeval: command not found"
```bash
# Try npx (no installation needed)
npx embedeval collect traces.jsonl

# Or install globally
npm install -g embedeval
```

### "Permission denied"
```bash
# If using npm install -g with permission issues
sudo npm install -g embedeval

# Or use npx instead
npx embedeval <command>
```

### "JSON parse error"
```bash
# Check your JSONL format
# WRONG (pretty-printed):
{
  "id": "1",
  "query": "test"
}

# RIGHT (one line per JSON):
{"id": "1", "query": "test"}
{"id": "2", "query": "test2"}

# Fix with jq
jq -c '.' pretty-printed.json > traces.jsonl
```

### "No traces found"
```bash
# Check file exists
ls -la traces.jsonl

# Check format
cat traces.jsonl | head -3

# Validate JSONL
while read line; do echo "$line" | jq . > /dev/null; done < traces.jsonl
echo "All lines valid!"
```

---

## 📚 Data Format Reference

### Trace (JSONL)
```jsonl
{"id":"trace-001","timestamp":"2026-01-31T10:00:00Z","query":"What's your refund policy?","response":"We offer full refunds within 30 days...","context":{"retrievedDocs":[{"id":"doc-1","content":"Refund policy details...","score":0.95}]},"metadata":{"provider":"openai","model":"gpt-4","latency":180,"cost":0.0001}}
```

**Required fields:**
- `id`: Unique identifier
- `query`: User input
- `response`: LLM output
- `metadata`: Provider, model, latency

**Optional fields:**
- `context`: Retrieved documents for RAG
- `timestamp`: ISO 8601 format
- `metadata.cost`: Cost per request
- `metadata.tokens`: Input/output token counts

### Annotation (JSONL)
```jsonl
{"id":"ann-001","traceId":"trace-001","annotator":"you@example.com","timestamp":"2026-01-31T10:05:00Z","label":"pass","notes":"Accurate response","duration":5,"source":"manual"}
{"id":"ann-002","traceId":"trace-002","annotator":"you@example.com","timestamp":"2026-01-31T10:06:00Z","label":"fail","failureCategory":"hallucination","notes":"Made up pricing info","duration":6,"source":"manual"}
```

### Taxonomy (JSON)
```json
{
  "version": "1.0",
  "lastUpdated": "2026-01-31T10:00:00Z",
  "annotator": "you@example.com",
  "categories": [
    {
      "id": "hallucination",
      "name": "Hallucination",
      "count": 5,
      "examples": ["trace-001", "trace-003"]
    }
  ],
  "stats": {
    "totalAnnotated": 10,
    "totalPassed": 7,
    "totalFailed": 3,
    "passRate": 0.7
  }
}
```

---

## 🎓 Learning Path

### Beginner (Week 1)
1. ✅ Run the 5-minute quick start above
2. ✅ Annotate 20 real traces from your system
3. ✅ Build your first taxonomy
4. ✅ Identify your top 3 failure categories

### Intermediate (Week 2)
1. ✅ Annotate 100 traces total
2. ✅ Add 2-3 automated evaluators
3. ✅ Run evals on new traces
4. ✅ Compare manual vs automated results

### Advanced (Week 3+)
1. ✅ Integrate into CI/CD pipeline
2. ✅ Generate synthetic test cases
3. ✅ Export to Jupyter for analysis
4. ✅ Set up automated alerts for quality regression

---

## 🔗 Resources

- **GitHub**: https://github.com/Algiras/embedeval
- **Documentation**: https://algiras.github.io/embedeval/
- **NPM**: https://www.npmjs.com/package/embedeval
- **Hamel's FAQ**: https://hamel.dev/blog/posts/evals-faq/
- **Full LLM Guide**: [LLM.md](./LLM.md)

---

## 💡 Pro Tips

1. **Version your traces**: `traces-2026-01-31.jsonl`
2. **Keep annotations in git**: Track quality over time
3. **Use grep on JSONL**: `grep "hallucination" annotations.jsonl`
4. **Start with 50 traces**: Minimum for meaningful patterns
5. **One annotator**: Consistency > consensus

---

**You're ready to evaluate!** Start with the 5-minute quick start above, then graduate to your real data. Remember: spend 80% of time looking at traces, 20% building evals.

Happy evaluating! 🚀
