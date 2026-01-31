# EmbedEval Skills Index

> **Quick Navigation**: AGENTS.md organized as actionable skills for AI agents. Use this to find the right tool fast.

---

## 🎯 Core Skills (Start Here)

| Skill | AGENTS.md Section | Command | When to Use |
|-------|------------------|---------|-------------|
| **Setup** | Core Workflow | `embedeval init <project>` | Starting a new evaluation project |
| **Diagnostics** | - | `embedeval doctor` | Verify environment before starting |
| **Collect** | Core Workflow | `embedeval collect <source>` | Import traces from logs/API |
| **Annotate** | Core Workflow | `embedeval annotate <traces>` | Manual binary pass/fail annotation |
| **Taxonomy** | Core Workflow | `embedeval taxonomy build` | Categorize failure patterns |

---

## 🛠️ Workflow Skills

### Evaluation Definition
| Skill | Section | Command | When to Use |
|-------|---------|---------|-------------|
| **DSL Init** | DSL Quick Start | `embedeval dsl init <template>` | Create .eval file from template |
| **DSL Validate** | DSL Quick Start | `embedeval dsl validate <file>` | Check .eval syntax |
| **DSL Run** | DSL Quick Start | `embedeval dsl run <evals> <traces>` | Compile & run evaluations |
| **DSL UI** | DSL Commands | `embedeval dsl ui <evals>` | Generate HTML annotation UI |
| **DSL Serve** | DSL Commands | `embedeval dsl serve <evals>` | Serve UI with hot-reload |
| **Eval Add** | Essential Commands | `embedeval eval add` | Interactive wizard to add evaluators |
| **Eval Run** | Essential Commands | `embedeval eval run <traces>` | Run evals with config |

### Analysis & Reporting
| Skill | Section | Command | When to Use |
|-------|---------|---------|-------------|
| **View** | Essential Commands | `embedeval view <traces>` | Read-only trace inspection |
| **Report** | Essential Commands | `embedeval report -t <traces>` | Generate HTML dashboard |
| **Stats** | Essential Commands | `embedeval stats <traces>` | Quick metrics for sharing |
| **Export** | Essential Commands | `embedeval export <traces>` | Export to Jupyter notebook |
| **Diff** | Diff Command | `embedeval diff before.json after.json` | Detect drift/regression |
| **Benchmark** | Benchmark Command | `embedeval benchmark <traces>` | Compare eval configs |

### Real-Time & Automation
| Skill | Section | Command | When to Use |
|-------|---------|---------|-------------|
| **Watch** | Watch Mode | `embedeval watch <traces>` | Real-time eval on new traces |
| **Moltbook** | Essential Commands | `embedeval moltbook --type post` | Generate community posts |

---

## 🔬 Advanced Skills

### Self-Evaluation (SDK)
| Skill | Section | Code Pattern | When to Use |
|-------|---------|--------------|-------------|
| **Preflight** | SDK Quick Start | `await preflight(response, query)` | Quick check before sending |
| **Confidence** | Confidence Scoring | `await getConfidence(response, query)` | Decide: send/revise/escalate |
| **Evaluate** | SDK Quick Start | `await evaluate(response, config)` | Full evaluation |
| **Suggestions** | Improvement Suggestions | `await getSuggestions(trace, results)` | Get actionable fixes |
| **Auto-Collect** | Auto-Collect Traces | `new TraceCollector()` | Automatic trace recording |

### Provider Management
| Skill | Section | Command | When to Use |
|-------|---------|---------|-------------|
| **Auth Login** | Multi-Provider System | `embedeval auth login <provider>` | Configure API keys |
| **Auth Status** | Multi-Provider System | `embedeval auth status` | Check all providers |
| **Auth Check** | Multi-Provider System | `embedeval auth check` | Verify API keys work |
| **Providers List** | Multi-Provider System | `embedeval providers list` | See available providers |
| **Providers Benchmark** | Multi-Provider System | `embedeval providers benchmark` | Benchmark latency |

### Assessment & Metrics
| Skill | Section | Command | When to Use |
|-------|---------|---------|-------------|
| **Assess Run** | Self-Assessment | `embedeval assess run -r <results>` | Analyze performance |
| **Assess Compare** | Self-Assessment | `embedeval assess compare` | Compare two models |
| **Assess Recommend** | Self-Assessment | `embedeval assess recommend` | Get model recommendation |
| **Assess Pricing** | Self-Assessment | `embedeval assess pricing` | View model pricing |

---

## 📋 Template Skills

| Template | Section | Command | Best For |
|----------|---------|---------|----------|
| **RAG** | DSL Templates | `embedeval dsl init rag` | RAG systems, context usage |
| **Chatbot** | DSL Templates | `embedeval dsl init chatbot` | Customer support bots |
| **Code Assistant** | DSL Templates | `embedeval dsl init code-assistant` | Code generation |
| **Docs** | DSL Templates | `embedeval dsl init docs` | Documentation Q&A |
| **Agent** | DSL Templates | `embedeval dsl init agent` | Autonomous agents |
| **Minimal** | DSL Templates | `embedeval dsl init minimal` | Getting started |

---

## 🧠 Agent Self-Improvement Skills

| Skill | Section | Approach | When to Use |
|-------|---------|----------|-------------|
| **Weak Validator** | Technique 1 | Use cheap model to validate expensive one | Pre-send validation |
| **Domain Corpus** | Technique 2 | Test domain-specific terminology | Domain knowledge validation |
| **Context-Aware** | Technique 3 | Check context usage, no hallucination | RAG evaluation |
| **Multi-Agent Verify** | Technique 4 | Pipeline of specialized validators | Complex validation |
| **Feedback Loop** | Technique 5 | Track performance over time | Continuous improvement |
| **Test Suites** | Technique 6 | Domain-specific eval suites | Organized testing |
| **Calibration** | Technique 7 | Compare auto-eval with human judgment | Ensure accuracy |

---

## 🔧 Common Tasks (Quick Reference)

```bash
# Understand failures
collect → annotate → taxonomy build

# Add evaluation for failure
taxonomy build → embedeval eval add → eval run

# Generate test data
embedeval generate init → edit dimensions.yaml → generate create

# Export for analysis
embedeval export <traces> -f notebook -o analysis.ipynb

# Self-evaluation workflow
embedeval collect → preflight check → get confidence → evaluate → get suggestions
```

---

## 🎮 Interactive Shortcuts

### Annotation Mode (`embedeval annotate`)
- `p` = Pass ✓
- `f` = Fail ✗
- `c` = Change category
- `n` = Edit notes
- `j/k` = Next/Previous trace
- `s` = Save and quit

### DSL UI Annotation
- `P` = Pass
- `F` = Fail
- `S` = Skip
- `←/→` or `J/K` = Navigate
- `1-9` = Toggle eval checklist

---

## 📚 Data Formats (Reference)

| Format | Extension | Use Case |
|--------|-----------|----------|
| **Traces** | `.jsonl` | LLM interaction logs |
| **Annotations** | `.jsonl` | Binary pass/fail labels |
| **Eval Config** | `.eval` | Natural language eval definition |
| **Taxonomy** | `.json` | Failure categories |
| **Results** | `.json` | Evaluation results |
| **Report** | `.html` | Dashboard |

---

## 🚨 Troubleshooting Skills

| Issue | Skill | Solution |
|-------|-------|----------|
| "No traces found" | Diagnostics | Check JSONL format |
| "Permission denied" | Setup | Use `sudo` for global install |
| "Taxonomy empty" | Annotate | Need ≥1 failed annotation |
| "Eval failed" | DSL Validate | Check eval config syntax |
| Token expired | Auth | Auto-refreshed on `auth status` |

---

## 🎯 Hamel Husain Principles (Rules)

1. **Binary Only** ✓/✗ - Never use 1-5 scales
2. **Error Analysis First** - Annotate before automating
3. **Cheap Evals First** - Assertions before LLM-as-judge
4. **Single Annotator** - One "benevolent dictator"
5. **50-100 Traces** - Minimum for meaningful patterns

---

## 🔗 Quick Links

- **AGENTS.md**: Full detailed documentation
- **README.md**: Project overview and installation
- **docs/index.html**: GitHub Pages site
- **examples/v2/**: Sample data and configs

---

**Usage**: Tell agents "Use the [Skill Name] skill" and they'll know exactly which command/pattern to use.
