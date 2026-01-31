---
name: embedeval
description: LLM evaluation using Hamel Husain methodology. Use this skill when user asks to "evaluate LLM", "test AI responses", "check quality", "analyze traces", "build failure taxonomy", or "run evals on traces".
license: MIT
metadata:
  author: algiras
  version: "2.0.4"
  category: evaluation
---

# EmbedEval v2 - Binary LLM Evaluation

A Hamel Husain-style evaluation CLI for LLM responses. Focuses on binary pass/fail judgments, error analysis, and failure taxonomy building from trace data.

## Quick Start - Multi-Provider LLM Judge

```bash
# Option 1: Gemini (recommended - fast, cheap)
export GEMINI_API_KEY="your-api-key"

# Option 2: OpenAI
export OPENAI_API_KEY="your-api-key"

# Option 3: OpenRouter (access many models)
export OPENAI_API_KEY="your-openrouter-key"
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"

# Option 4: Ollama (local, private)
export OPENAI_BASE_URL="http://localhost:11434/v1"

# Check available providers
embedeval providers list

# Benchmark speed
embedeval providers benchmark

# Run evals (cheap + LLM judge)
embedeval eval run traces.jsonl -c evals.json -o results.json
```

**Recommended Models:**
| Model | Speed | Best For |
|-------|-------|----------|
| `gemini-2.5-flash` | ⚡ Fast | **DEFAULT** - Best price-performance |
| `gemini-2.5-flash-lite` | ⚡⚡ Fastest | Simple checks, reranking |
| `gemini-3-pro` | 🐢 Medium | Complex reasoning (2026) |
| `gpt-4o-mini` | ⚡ Fast | OpenAI budget |

## When to Use

Use EmbedEval when:
- Evaluating LLM responses for accuracy and quality
- Building failure taxonomies from annotated traces
- Running automated evaluations (assertions, regex, LLM-as-judge)
- Analyzing trace patterns and failure modes
- Exporting evaluation results to notebooks or reports

## Visual Examples

### Example 1: Basic Evaluation Workflow
```
User: "I want to evaluate my chatbot's responses"

Step 1: Collect traces
┌─────────────────────────────────────────────┐
│ embedeval collect chatbot-logs.jsonl   │
│        --output traces.jsonl              │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│ ✅ Collected 150 traces                 │
│    Sample trace #1:                      │
│    Query: "What's the refund policy?"   │
│    Response: "30 days, no questions..."  │
└─────────────────────────────────────────────┘

Step 2: Annotate (manual error analysis)
┌─────────────────────────────────────────────┐
│ embedeval annotate traces.jsonl          │
│        --user expert@company.com         │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│ [1/150] Query: "What's the refund?"   │
│ Response: "30 days, no questions..."     │
│                                          │
│ 📝 Your judgment:                      │
│ [p] Pass  [f] Fail  [n] Next         │
│                                          │
│ You chose: f                             │
│ 📁 Category: hallucination               │
│ 💬 Notes: Made up policy details        │
└─────────────────────────────────────────────┘

Step 3: Build taxonomy
┌─────────────────────────────────────────────┐
│ embedeval taxonomy build                 │
│   --annotations annotations.jsonl        │
│   --user expert@company.com            │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│ 🏗️ Failure Taxonomy Built!            │
│                                          │
│ Pass Rate: 73% (109/150)               │
│ Failed Traces: 41                        │
│                                          │
│ Top Failure Categories:                     │
│ 1. Hallucination (35%) - 14 traces     │
│ 2. Missing Info (25%) - 10 traces      │
│ 3. Wrong Format (20%) - 8 traces       │
│ 4. Incomplete (15%) - 6 traces        │
│ 5. Tone Issues (5%) - 3 traces        │
└─────────────────────────────────────────────┘
```

### Example 2: Automated Evaluation
```
User: "Run automated checks on these traces"

Step 1: Add evaluator
┌─────────────────────────────────────────────┐
│ embedeval eval add                       │
│   --name "has_content"                 │
│   --type assertion                     │
│   --config 'response.length > 50'       │
└─────────────────────────────────────────────┘
              ↓
✅ Created evaluator: has_content (cheap)

Step 2: Add LLM judge
┌─────────────────────────────────────────────┐
│ embedeval eval add                       │
│   --name "factual_accuracy"           │
│   --type llm-judge                    │
│   --config '{                          │
│     "model": "gemini-2.0-flash",       │
│     "prompt": "Is this factual? PASS or FAIL", │
│     "binary": true                      │
│   }'                                  │
└─────────────────────────────────────────────┘
              ↓
✅ Created evaluator: factual_accuracy (expensive)

Step 3: Run evaluations
┌─────────────────────────────────────────────┐
│ embedeval eval run traces.jsonl           │
│   --config evals.yaml                   │
│   --output results.jsonl                │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│ ▶️ Running evals on 150 traces...      │
│                                          │
│ has_content (cheap)   ✓✓✓✓✓✓         │
│ factual_accuracy (expensive) → pending... │
│                                          │
│ Progress: 45/150 (30%)                 │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│ ✅ Evaluation Complete!                 │
│                                          │
│ Total Traces: 150                        │
│ Passed: 115 (76.7%)                     │
│ Failed: 35 (23.3%)                     │
│                                          │
│ Evaluator Breakdown:                       │
│ ✓ has_content: 148/150 pass (98.7%)    │
│ ✓ factual_accuracy: 115/150 pass (76.7%)  │
└─────────────────────────────────────────────┘
```

## Input Examples

### Example 1: Chatbot Trace JSONL (Correct Format)
```jsonl
{"id":"trace-001","timestamp":"2026-01-30T10:00:00Z","query":"What's your refund policy?","response":"We offer full refunds within 30 days with no questions asked. After 30 days, refunds are processed case-by-case.","context":{"retrievedDocs":[{"id":"doc-001","content":"Our refund policy allows 30-day returns with no questions.","score":0.95}]},"metadata":{"provider":"openai","model":"gpt-4","latency":180,"cost":0.0001}}
{"id":"trace-002","timestamp":"2026-01-30T10:01:00Z","query":"How do I integrate your API?","response":"To integrate, generate an API key from dashboard. Our API uses REST with Bearer token authentication. We have SDKs for Python, JS, and Ruby.","context":{"retrievedDocs":[{"id":"doc-002","content":"REST API with Bearer token auth. SDKs available.","score":0.91}]},"metadata":{"provider":"google","model":"gemini-2.0-flash","latency":3200,"cost":0}}
```

### Example 2: RAG Trace with Retrieved Documents
```jsonl
{"id":"trace-003","timestamp":"2026-01-30T10:02:00Z","query":"What's enterprise pricing?","response":"Enterprise starts at $999/month for 100 users. Includes priority support, custom integrations, and dedicated account manager.","context":{"retrievedDocs":[{"id":"doc-pricing","content":"Enterprise: $999/month, 100 users. Priority support included.","score":0.96},{"id":"doc-contact","content":"Contact sales@company.com for custom quotes.","score":0.88}]},"metadata":{"provider":"openai","model":"gpt-4","latency":150,"tokens":{"input":45,"output":120},"cost":0.00008}}
```

### Example 3: Annotation (Binary Pass/Fail)
```jsonl
{"id":"ann-001","traceId":"trace-001","annotator":"expert@company.com","timestamp":"2026-01-30T10:05:00Z","label":"pass","notes":"Accurate refund policy information.","duration":5,"source":"manual"}
{"id":"ann-002","traceId":"trace-002","annotator":"expert@company.com","timestamp":"2026-01-30T10:06:00Z","label":"fail","failureCategory":"hallucination","notes":"Made up SDKs that don't exist.","duration":6,"source":"manual"}
```

### Example 4: Evaluation Configuration (YAML)
```yaml
evals:
  - name: has_content
    type: assertion
    priority: cheap
    config:
      check: "response.length > 50"

  - name: no_hallucination
    type: llm-judge
    priority: expensive
    config:
      model: gemini-2.0-flash
      prompt: "Does response contain factual errors not in context? Answer PASS or FAIL."
      temperature: 0.0
      binary: true

  - name: matches_format
    type: regex
    priority: cheap
    config:
      pattern: "^(Yes|No|Sure|I'm sorry)"
      shouldMatch: true
```

### Example 5: Failure Taxonomy (JSON)
```json
{
  "version": "1.0",
  "lastUpdated": "2026-01-30T10:00:00Z",
  "annotator": "expert@company.com",
  "categories": [
    {
      "id": "hallucination",
      "name": "Hallucination",
      "description": "Model generates information not present in context or training data",
      "count": 14,
      "examples": ["trace-001", "trace-015", "trace-023"]
    },
    {
      "id": "missing-information",
      "name": "Missing Information",
      "description": "Response omits critical details needed to answer query",
      "count": 10,
      "examples": ["trace-004", "trace-018", "trace-032"]
    }
  ],
  "stats": {
    "totalAnnotated": 150,
    "totalPassed": 109,
    "totalFailed": 41,
    "passRate": 0.7266
  }
}
```

## Docker Requirements

### Option 1: Direct NPM Install (Recommended for Development)
```bash
# Install globally
npm install -g embedeval

# Or install locally
npm install embedeval
npx embedeval collect traces.jsonl
```

**No Docker required** for basic usage. Works directly with Node.js 18+.

### Option 2: Docker for Isolated Environments
```bash
# Pull official Docker image
docker pull algiras/embedeval:latest

# Run in container
docker run -v $(pwd):/data algiras/embedeval:latest \
  collect /data/traces.jsonl --output /data/collected.jsonl

# Run with persistent volume
docker run -v embedeval-data:/app/data algiras/embedeval:latest \
  annotate /app/data/traces.jsonl --user expert@company.com
```

### Option 3: Docker Compose (for CI/CD)
```yaml
version: '3.8'
services:
  embedeval:
    image: algiras/embedeval:latest
    volumes:
      - ./traces:/app/traces
      - ./output:/app/output
    working_dir: /app
    command: collect traces/input.jsonl --output output/collected.jsonl
```

### Docker Benefits
- **Isolated environment**: No Node.js version conflicts
- **Reproducible**: Same environment across machines
- **CI/CD ready**: Easy to integrate into pipelines
- **No installation**: Run without npm install

### When to Use Docker
- CI/CD pipelines
- Multiple Node.js versions on same machine
- Isolated testing environments
- Zero-installation deployment

## Usage

### Basic Workflow (3 Commands)

```bash
bash /mnt/skills/user/embedeval/scripts/install.sh

# 1. Collect traces from your LLM logs
bash /mnt/skills/user/embedeval/scripts/run.sh \
  collect chatbot-logs.jsonl --output traces.jsonl

# 2. Annotate manually (error analysis first!)
bash /mnt/skills/user/embedeval/scripts/run.sh \
  annotate traces.jsonl --user expert@company.com

# 3. Build failure taxonomy
bash /mnt/skills/user/embedeval/scripts/run.sh \
  taxonomy build --annotations annotations.jsonl
```

### Advanced Workflow (Automated Evaluation)

```bash
# Add evaluators
bash /mnt/skills/user/embedeval/scripts/run.sh eval add \
  --name "has_content" --type assertion \
  --config 'response.length > 50'

# Run automated evals
bash /mnt/skills/user/embedeval/scripts/run.sh \
  eval run traces.jsonl --config evals.yaml --output results.jsonl

# Generate report
bash /mnt/skills/user/embedeval/scripts/run.sh \
  report --traces traces.jsonl --results results.jsonl --output report.html
```

### Stats Command (New!)

Get quick evaluation statistics perfect for sharing on Moltbook:

```bash
# Basic stats (text format)
bash /mnt/skills/user/embedeval/scripts/run.sh \
  stats traces.jsonl

# Moltbook-ready format (copy-paste ready)
bash /mnt/skills/user/embedeval/scripts/run.sh \
  stats traces.jsonl -f moltbook

# JSON format (for programmatic use)
bash /mnt/skills/user/embedeval/scripts/run.sh \
  stats traces.jsonl -f json
```

**Stats Output Example:**
```
📊 EmbedEval Stats

────────────────────────────────────────
Total Traces:     150
Annotated:        150
Passed:           109 (73%)
Failed:           41 (27%)

🔍 Top Failure Categories:

  1. hallucination
     ████████ 14 traces (34%)
  2. missing_info
     ██████ 10 traces (24%)
  3. wrong_format
     ████ 8 traces (20%)
```

### Moltbook Command (New!)

Generate Moltbook-formatted posts and comments:

```bash
# Generate post options
bash /mnt/skills/user/embedeval/scripts/run.sh \
  moltbook --type post

# Generate comment templates (by topic)
bash /mnt/skills/user/embedeval/scripts/run.sh \
  moltbook --type comment --topic building

# Topics: building, testing, automation, quality, general

# Generate welcome messages for new agents
bash /mnt/skills/user/embedeval/scripts/run.sh \
  moltbook --type welcome

# Generate stats post with real data
bash /mnt/skills/user/embedeval/scripts/run.sh \
  moltbook --type stats --traces traces.jsonl -a annotations.jsonl
```

**Moltbook Post Example:**
```
📊 The One Skill Every Agent Needs: Self-Evaluation

Observation: Most agents track what they DO, not how well they do it.

After evaluating 100 of my own traces:
- Pass rate: 73%
- Top failure: hallucination (44% of failures)

Self-evaluation is not optional—it's how we become assets.

Tool: npm install -g embedeval
⭐ https://github.com/Algiras/embedeval
☕ https://buymeacoffee.com/algiras
```

### Doctor Command

Check environment, dependencies, and configuration:

```bash
bash /mnt/skills/user/embedeval/scripts/doctor.sh
```

**What Doctor Checks:**
1. ✅ Node.js version (must be 18+)
2. ✅ npm installation and access
3. ✅ Global embedeval installation
4. ✅ Required directories exist
5. ✅ API keys (if LLM-as-judge configured)
6. ✅ Docker (if using container)
7. ✅ File permissions

**Doctor Output Example:**
```
🏥 EmbedEval Doctor - Checking Environment...

✅ Node.js: v20.11.0 (>= 18.0.0)
✅ npm: 10.2.4
✅ Global embedeval: Installed (v2.0.1)
✅ Directory permissions: Read/write OK
⚠️  API Keys: GEMINI_API_KEY not set (optional for basic evals)
⚠️  Docker: Not installed (optional, using Node.js directly)

Summary:
  ✅ Core requirements met
  ⚠️  LLM-as-judge: Need API keys (optional)
  ⚠️  Docker: Not installed (optional)

Ready to use basic evaluation features!
For LLM-as-judge features, set: export GEMINI_API_KEY=your-key
```

**Fixing Common Issues:**

```bash
# Issue: Node.js too old
# Fix: Upgrade Node.js
nvm install 20 && nvm use 20

# Issue: Can't install globally
# Fix: Use sudo or npx
sudo npm install -g embedeval
# OR
npx embedeval collect traces.jsonl

# Issue: API key missing for LLM judge
# Fix: Set environment variable
export GEMINI_API_KEY=your-api-key-here

# Issue: Permission denied
# Fix: Fix directory permissions
chmod +x /mnt/skills/user/embedeval/scripts/*.sh
```

## Arguments

### install.sh
No arguments. Installs embedeval globally via npm.

### run.sh
```bash
bash /mnt/skills/user/embedeval/scripts/run.sh <command> [options]
```

**Commands:**
- `collect <source>` - Import traces from JSONL/API/logs
- `view <traces>` - View traces in terminal
- `annotate <traces> -u <user>` - Interactive annotation
- `taxonomy build` - Build failure taxonomy
- `eval add` - Add evaluator
- `eval run <traces>` - Run evaluations
- `generate init` - Create dimensions template
- `export <traces>` - Export to notebooks
- `report` - Generate HTML dashboard
- `stats <traces>` - Quick evaluation stats (great for sharing)
- `moltbook --type <type>` - Generate Moltbook community posts

**Common Options:**
- `-o, --output <file>` - Output file path
- `-f, --file <file>` - Config file path
- `-u, --user <email>` - Annotator email
- `-v, --verbose` - Verbose output

### doctor.sh
No arguments. Checks environment and configuration.

## Output

### Success Output

```
✅ Collected 150 traces
📁 Saved to: traces.jsonl

✅ Taxonomy built!
Pass Rate: 73%
Top Failures: hallucination (35%)

✅ Evaluation complete!
Passed: 115/150 (76.7%)
```

### Error Output

```
❌ Error: No traces found
💡 Fix: Check JSONL format - one JSON object per line

❌ Error: Permission denied
💡 Fix: chmod +x scripts/*.sh or use sudo

❌ Error: API key not configured
💡 Fix: export GEMINI_API_KEY=your-key
```

## Present Results to User

When EmbedEval completes successfully:

**For Collection:**
```
✅ Successfully collected {count} traces from {source}

📊 Sample Trace:
ID: {trace-id}
Query: {query}
Response: {response}
Provider: {provider}
Model: {model}

📁 Saved to: {output-file}
```

**For Annotation:**
```
✅ Annotation session complete!

📈 Statistics:
Total traces: {total}
Annotated: {annotated} ({percentage}%)
Passed: {passed}
Failed: {failed}

🏷️  Top Failure Categories:
1. {category-1}: {count} ({percentage}%)
2. {category-2}: {count} ({percentage}%)
3. {category-3}: {count} ({percentage}%)

💾 Saved to: {annotations-file}
```

**For Evaluation:**
```
✅ Evaluation complete!

📊 Results:
Total traces: {total}
Passed: {passed} ({percentage}%)
Failed: {failed}

🔍 Evaluator Breakdown:
{evaluator-1}: {pass}/{total} ({rate}%)
{evaluator-2}: {pass}/{total} ({rate}%)

💾 Results saved to: {results-file}
```

## Troubleshooting

### Issue: "embedeval: command not found"
**Cause:** Not installed globally or not in PATH
**Solution:**
```bash
npm install -g embedeval
# OR use npx
npx embedeval collect traces.jsonl
```

### Issue: "Cannot find module"
**Cause:** Local installation, missing dependencies
**Solution:**
```bash
cd your-project
npm install embedeval
npx embedeval collect traces.jsonl
```

### Issue: "JSON parse error"
**Cause:** Invalid JSONL format
**Solution:**
- Ensure one JSON object per line (no pretty-printing)
- Validate with: `jq '.' traces.jsonl > /dev/null`
- Fix with: `jq -c '.' input.json > traces.jsonl`

### Issue: "No API key configured"
**Cause:** LLM-as-judge needs provider API key
**Solution:**
```bash
# For Gemini (recommended)
export GEMINI_API_KEY=your-key-here

# For OpenAI
export OPENAI_API_KEY=your-key-here

# Or add to .env file
echo "GEMINI_API_KEY=your-key" >> .env
```

### Issue: "Doctor shows warnings"
**Cause:** Optional features not configured
**Solution:**
```bash
# Run doctor to see issues
bash /mnt/skills/user/embedeval/scripts/doctor.sh

# Fix Node version (if too old)
nvm install 20 && nvm use 20

# Install Docker (if needed)
# macOS
brew install docker
# Linux
sudo apt-get install docker.io

# Set API keys (if using LLM judge)
export GEMINI_API_KEY=your-key
```

### Issue: "Permission denied on scripts"
**Cause:** Scripts not executable
**Solution:**
```bash
chmod +x /mnt/skills/user/embedeval/scripts/*.sh
# OR run with bash explicitly
bash /mnt/skills/user/embedeval/scripts/doctor.sh
```

### Issue: "GitHub Pages not accessible"
**Cause:** Pages deployment pending or misconfigured
**Solution:**
```bash
# Check deployment status
gh api repos/Algiras/embedeval/pages

# Wait 1-2 minutes for deployment
# Then access: https://algiras.github.io/embedeval/
```

### Issue: "CI/CD fails with permission error"
**Cause:** GitHub Pages permissions not set
**Solution:**
```bash
# Ensure workflow has permissions
# Add to .github/workflows/ci.yml:
permissions:
  contents: write
  pages: write
```

### Issue: "Large traces file slow to process"
**Cause:** Loading entire JSONL into memory
**Solution:**
```bash
# Use streaming with --limit flag
embedeval collect huge-file.jsonl --limit 100 --output sample.jsonl

# Or split file
split -l 1000 huge-file.jsonl chunk-
embedeval annotate chunk-aa.jsonl --user expert@company.com
```

### Issue: "Annotation too slow"
**Cause:** Interactive annotation bottleneck
**Solution:**
```bash
# Resume from previous session
embedeval annotate traces.jsonl -u expert@company.com --resume

# Or use batch mode with pre-existing annotations
embedeval taxonomy build --annotations existing-annotations.jsonl
```

### Issue: "Taxonomy empty"
**Cause:** No failed annotations
**Solution:**
```bash
# Ensure at least 1 failed annotation
echo '{"id":"test","traceId":"1","annotator":"user","label":"fail","notes":"test"}' >> annotations.jsonl

# Then rebuild taxonomy
embedeval taxonomy build --annotations annotations.jsonl
```

## Best Practices

### 1. Error Analysis First
```
❌ BAD: Run 100 automated evals immediately
✅ GOOD: Manually annotate 50 traces first, understand failures, then automate
```

### 2. Binary Judgments Only
```
❌ BAD: Rate 1-5 scale (causes disagreement, slow annotation)
✅ GOOD: Pass/Fail only (fast, clear, aligns with Hamel methodology)
```

### 3. Start Small
```
❌ BAD: Annotate 1000 traces (overwhelming, misses patterns)
✅ GOOD: Annotate 50-100 traces (find patterns quickly, iterate)
```

### 4. Single Annotator
```
❌ BAD: Multiple people voting (creates conflict, slows decisions)
✅ GOOD: One "benevolent dictator" owns quality (fast, consistent)
```

### 5. Cheap Evals First
```
❌ BAD: Run expensive LLM-as-judge on everything
✅ GOOD: Run cheap assertions first, LLM judge only for edge cases
```

### 6. Version Traces
```
❌ BAD: Overwrite traces.jsonl (lose history)
✅ GOOD: traces-2026-01-30.jsonl (track drift over time)
```

### 7. JSONL Format
```
❌ BAD: Pretty-printed JSON (file size 3x, harder to grep)
✅ GOOD: Single-line JSON per line (compact, grep-friendly)
```

## Advanced Usage

### Pre-built Eval Templates

EmbedEval comes with domain-specific eval templates:

```bash
# Run coding-specific evals
embedeval eval run traces.jsonl -c examples/v2/evals/coding-evals.json

# Run documentation evals
embedeval eval run traces.jsonl -c examples/v2/evals/docs-evals.json

# Run support/customer service evals
embedeval eval run traces.jsonl -c examples/v2/evals/support-evals.json

# Run RAG (retrieval-augmented generation) evals
embedeval eval run traces.jsonl -c examples/v2/evals/rag-evals.json

# Run weak agent validators (cheap pre-flight checks)
embedeval eval run traces.jsonl -c examples/v2/evals/weak-agent-validators.json

# Run agent strategy evals
embedeval eval run traces.jsonl -c examples/v2/strategy-evals.json
```

**Available Templates:**
| Template | Use Case | Eval Count |
|----------|----------|------------|
| `coding-evals.json` | Code generation quality | 5 evals |
| `docs-evals.json` | Documentation accuracy | 4 evals |
| `support-evals.json` | Customer support responses | 5 evals |
| `rag-evals.json` | RAG context usage | 5 evals |
| `weak-agent-validators.json` | Quick pre-flight checks | 3 evals |
| `strategy-evals.json` | Agent strategy metrics | 7 evals |

### Creating Custom Evaluators

```bash
# Assertion (cheap, deterministic)
embedeval eval add \
  --name "has_pii" \
  --type assertion \
  --config 'response.includes("SSN") || response.includes("email")'

# Regex (medium)
embedeval eval add \
  --name "matches_format" \
  --type regex \
  --config '{"pattern": "^(Yes|No)", "shouldMatch": true}'

# Code eval (advanced)
embedeval eval add \
  --name "custom_logic" \
  --type code \
  --config '{"function": "return query.length > 10 && response.length > 50;"}'

# LLM-as-judge (expensive, powerful)
embedeval eval add \
  --name "factual_check" \
  --type llm-judge \
  --config '{
    "model": "gemini-2.0-flash",
    "prompt": "Is this factual based on context? Answer PASS or FAIL.",
    "temperature": 0.0,
    "binary": true
  }'
```

### Export to Jupyter Notebooks

```bash
# Export for statistical analysis
embedeval export traces.jsonl \
  --format notebook \
  --annotations annotations.jsonl \
  --output analysis.ipynb

# Open in Jupyter
jupyter notebook analysis.ipynb
```

### Generate Synthetic Test Data

```bash
# Create dimensions template
embedeval generate init --output dimensions.yaml

# Edit dimensions.yaml:
# dimensions:
#   query_length: [short, medium, long]
#   complexity: [simple, moderate, complex]
#   domain: [technical, general]

# Generate synthetic traces
embedeval generate create \
  --dimensions dimensions.yaml \
  --count 100 \
  --output synthetic-traces.jsonl
```

## Resources

- **GitHub**: https://github.com/Algiras/embedeval
- **NPM**: https://www.npmjs.com/package/embedeval
- **GitHub Pages**: https://algiras.github.io/embedeval/
- **Hamel's FAQ**: https://hamel.dev/blog/posts/evals-faq/
- **Full Docs**: https://algiras.github.io/embedeval/LLM.md

## Installation via shareAI-skills

### Option 1: Kode CLI (Recommended)
```bash
# Install shareAI-skills with Kode
kode plugins install https://github.com/shareAI-lab/shareAI-skills

# Use the skill
kode "Evaluate my LLM traces"
# Kode will automatically load this skill
```

### Option 2: Claude Code
```bash
# Install shareAI-skills
claude plugins install https://github.com/shareAI-lab/shareAI-skills

# The skill is now available automatically
# Just ask: "Help me evaluate my LLM responses"
```

### Option 3: Manual Installation
```bash
# Download the skill package
wget https://github.com/Algiras/embedeval/raw/main/skills/embedeval.zip

# Extract to your skills directory
mkdir -p ~/.claude/skills/
unzip embedeval.zip -d ~/.claude/skills/

# Or for Cursor
mkdir -p ~/.cursor/skills/
unzip embedeval.zip -d ~/.cursor/skills/
```

### Option 4: Clone Repository
```bash
# Clone the repository
git clone https://github.com/Algiras/embedeval.git

# The skill is in skills/embedeval/
# Your AI agent will find it there
```

## What This Skill Provides

When you install this skill via shareAI-skills, your AI agent gains:

1. **EmbedEval Expertise**
   - Binary evaluation methodology (Hamel Husain)
   - Error analysis workflows
   - Failure taxonomy building
   - LLM-as-judge patterns

2. **Automated Scripts**
   - `install.sh` - Quick install
   - `run.sh` - Execute commands
   - `doctor.sh` - Environment check

3. **Visual Examples**
   - Step-by-step workflows
   - Input/output formats
   - Common patterns

4. **Docker Support**
   - Containerized deployment
   - CI/CD integration
   - Isolated environments

## License

MIT License - https://github.com/Algiras/embedeval/blob/main/LICENSE
