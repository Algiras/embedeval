# Troubleshooting Guide

Common issues and their solutions when using EmbedEval.

---

## 1. Installation Issues

| Problem | Solution |
|---------|----------|
| `Permission denied` when installing globally | Use `sudo npm install -g embedeval` or install locally: `npm install embedeval` |
| `npm: command not found` | Install Node.js from https://nodejs.org or use nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh \| bash` |
| `embedeval: command not found` after install | Add npm global bin to PATH: `export PATH="$HOME/.npm-global/bin:$PATH"` or use `npx embedeval` |
| `Cannot find module` errors | Run `npm install` in project directory to install dependencies |
| `EACCES` permission error on macOS | Fix npm permissions: `sudo chown -R $(whoami) ~/.npm` and `sudo chown -R $(whoami) /usr/local/lib/node_modules` |

**Quick fix for permission issues:**
```bash
# Option 1: Use npx (no install needed)
npx embedeval --help

# Option 2: Install locally
npm install embedeval
npx embedeval --help
```

---

## 2. JSONL Format Errors

| Problem | Solution |
|---------|----------|
| "No traces found" or "Invalid JSON" | Ensure one JSON object per line, not an array of JSON objects |
| "Missing required field: id" | All traces must have: `id`, `timestamp`, `query`, `response` |
| "Unexpected token" | Check for trailing commas, which are invalid in JSON |
| UTF-8 encoding errors | Save file with UTF-8 encoding: `iconv -f ISO-8859-1 -t UTF-8 input.txt > output.jsonl` |
| Empty lines between traces | Remove all blank lines: `sed -i '' '/^$/d' traces.jsonl` |

**Correct JSONL format:**
```json
{"id":"trace-001","timestamp":"2026-01-31T10:00:00Z","query":"Hello","response":"Hi there"}
{"id":"trace-002","timestamp":"2026-01-31T10:01:00Z","query":"Help","response":"How can I help?"}
```

**Validate JSONL:**
```bash
# Check each line is valid JSON
while read -r line; do echo "$line" | jq . >/dev/null || echo "Invalid: $line"; done < traces.jsonl

# Count lines
wc -l traces.jsonl
```

---

## 3. Authentication Issues

| Problem | Solution |
|---------|----------|
| "GEMINI_API_KEY not found" | Set environment variable: `export GEMINI_API_KEY="your-key"` |
| "401 Unauthorized" from API | Verify API key is valid and not expired. Regenerate from provider console |
| "OpenRouter connection failed" | Set base URL: `export OPENAI_BASE_URL="https://openrouter.ai/api/v1"` |
| Rate limit errors | Add delay between requests: `embedeval eval run traces.jsonl -c evals.json --rate-limit 1000` |
| "Invalid provider" | Check available providers: `embedeval providers list` |

**Set up API keys:**
```bash
# Gemini (recommended)
export GEMINI_API_KEY="your-gemini-key"

# OpenAI
export OPENAI_API_KEY="your-openai-key"

# OpenRouter
export OPENAI_API_KEY="your-openrouter-key"
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"

# Verify setup
embedeval providers list
embedeval providers benchmark
```

---

## 4. Evaluation Failures

| Problem | Solution |
|---------|----------|
| "Eval config not found" | Check file path exists: `ls -la evals.json` and use absolute path if needed |
| "Unknown eval type: xyz" | Valid types: `assertion`, `regex`, `code`, `llm-judge`, `embedding` |
| "Cannot read property 'response' of undefined" | Ensure trace has `response` field. Check with: `jq '.[].response' traces.jsonl` |
| "LLM judge timeout" | Increase timeout: `embedeval eval run traces.jsonl -c evals.json --timeout 30000` |
| "Template variable not replaced" | Use correct variables: `{query}`, `{response}`, `{context}`, `{metadata}` |

**Validate eval config:**
```bash
# Check syntax
jq '.' evals.json

# Test with single trace
echo '{"id":"test","query":"test","response":"test"}' > test-trace.jsonl
embedeval eval run test-trace.jsonl -c evals.json
```

---

## 5. Performance Issues

| Problem | Solution |
|---------|----------|
| Evals running very slow | Use cheaper model: set `"model": "gemini-2.5-flash-lite"` in config |
| Out of memory errors | Process in batches: `embedeval eval run traces.jsonl -c evals.json --batch-size 10` |
| Network timeout errors | Increase timeout: `--timeout 60000` or use local provider (Ollama) |
| High API costs | Run cheap evals first, filter failures, then run expensive evals on subset |
| CPU usage 100% | Switch to LLM-judge with remote API instead of code evals |

**Optimization commands:**
```bash
# Run cheap evals only
embedeval eval run traces.jsonl -c cheap-evals.json

# Filter failures for expensive evals
jq -r '.results[] | select(.passed == false) | .traceId' results.json > failed.txt

# Run expensive evals on failures only
embedeval eval run traces.jsonl -c expensive-evals.json --filter failed.txt

# Use parallel processing
embedeval eval run traces.jsonl -c evals.json --parallel 5
```

---

## 6. CLI Errors

| Problem | Solution |
|---------|----------|
| "Unknown command: xyz" | Check available commands: `embedeval --help` or `embedeval [command] --help` |
| "Invalid option: --flag" | Verify option name: `embedeval eval run --help` |
| "Argument missing" | Provide required argument: `embedeval eval run traces.jsonl -c evals.json` |
| "Command not found" | Ensure embedeval is installed: `npm list -g embedeval` or use `npx` |
| "Cannot read file" | Check file permissions and path: `ls -la traces.jsonl` |

**Help commands:**
```bash
# Main help
embedeval --help

# Command-specific help
embedeval eval run --help
embedeval annotate --help
embedeval dsl --help

# List all commands
embedeval --help | grep -A 1 "Commands:"
```

---

## 7. Data Issues

| Problem | Solution |
|---------|----------|
| Empty results file | Check traces exist: `jq '.[] | .id' traces.jsonl \| wc -l` |
| "No annotations found" | Run annotate first: `embedeval annotate traces.jsonl -u user@email.com` |
| Missing context field | Add context or make evals context-optional with conditional checks |
| Duplicate trace IDs | Ensure unique IDs: `jq '.[].id' traces.jsonl \| sort \| uniq -d` |
| Wrong timestamp format | Use ISO 8601: `"timestamp": "2026-01-31T10:00:00Z"` |

**Data inspection:**
```bash
# Check trace count
jq '. | length' traces.jsonl

# Find missing required fields
jq 'select(.id == null)' traces.jsonl
jq 'select(.query == null)' traces.jsonl
jq 'select(.response == null)' traces.jsonl

# Check for duplicate IDs
jq -s 'map(.id) | group_by(.) | map(select(length > 1)) | .[]' traces.jsonl
```

---

## 8. DSL Errors

| Problem | Solution |
|---------|----------|
| "Invalid DSL syntax" | Validate first: `embedeval dsl validate my-evals.eval` |
| "Unknown template: xyz" | List templates: `embedeval dsl templates` |
| "Compilation failed" | Preview compiled output: `embedeval dsl preview my-evals.eval` |
| "Variable not defined" | Check DSL uses correct trace fields: `{query}`, `{response}`, `{context}` |
| "Priority must be cheap or expensive" | Use only `priority: cheap` or `priority: expensive` |

**DSL debugging:**
```bash
# List available templates
embedeval dsl templates

# Create from template
embedeval dsl init rag -o my-evals.eval

# Validate syntax
embedeval dsl validate my-evals.eval

# Preview compiled evals
embedeval dsl preview my-evals.eval

# Compile to JSON for inspection
embedeval dsl compile my-evals.eval -o evals.json
```

**DSL syntax examples:**
```bash
# Correct
must "Has Content": response length > 50
[expensive] must "Coherent": is coherent

# Incorrect
must "Has Content" response length > 50    # Missing colon
must: "Has Content": response length > 50  # Extra colon
[priority: cheap] must "Has Content"      # Wrong syntax
```

---

## 9. Debug Mode

| Flag | Description |
|------|-------------|
| `--debug` | Enable verbose debug logging |
| `--log-level trace` | Maximum verbosity (trace > debug > info > warn > error) |
| `--verbose` or `-v` | Detailed output for commands |
| `--dry-run` | Preview without executing |

**Debug commands:**
```bash
# Full debug mode
embedeval eval run traces.jsonl -c evals.json --debug

# Set log level
embedeval eval run traces.jsonl -c evals.json --log-level trace

# Dry run to preview
embedeval eval run traces.jsonl -c evals.json --dry-run

# Verbose annotation
embedeval annotate traces.jsonl --user user@email.com --verbose
```

**Log output locations:**
```bash
# Default logs (if configured)
~/.embedeval/logs/

# Or capture to file
embedeval eval run traces.jsonl -c evals.json --debug 2>&1 | tee debug.log
```

---

## 10. Getting Help

| Resource | Where |
|----------|-------|
| Documentation | https://github.com/Algiras/embedeval |
| Quick Reference | `QUICKREF-v2.md` in repo |
| Agent Guide | `AGENTS.md` in repo |
| Full README | `README-v2.md` in repo |
| Issue Tracker | https://github.com/Algiras/embedeval/issues |
| Hamel's FAQ | https://hamel.dev/blog/posts/evals-faq/ |

**Built-in help:**
```bash
# General help
embedeval --help

# Command help
embedeval eval --help
embedeval annotate --help
embedeval dsl --help
embedeval taxonomy --help

# Version check
embedeval --version

# Check installation
npm list -g embedeval
embedeval doctor  # (if available)
```

**Community support:**
- GitHub Issues: Report bugs and feature requests
- Discussions: Ask questions and share experiences
- Contributing: See CONTRIBUTING.md in repo

**When reporting issues, include:**
1. EmbedEval version: `embedeval --version`
2. OS and Node.js version: `node --version`
3. Command that failed
4. Full error message
5. Debug log if available: `--debug 2>&1 | tee log.txt`
