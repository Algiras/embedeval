/**
 * Preflight Check System
 * 
 * Validates all prerequisites before running evolution.
 * Stops with clear instructions if something is missing.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const icons = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  pending: '○',
};

/**
 * Check result structure
 */
class CheckResult {
  constructor(name, status, message, fix = null, docs = null) {
    this.name = name;
    this.status = status; // 'pass' | 'fail' | 'warn'
    this.message = message;
    this.fix = fix; // How to fix the issue
    this.docs = docs; // Link to documentation
  }
}

/**
 * Preflight checker class
 */
export class PreflightChecker {
  constructor(options = {}) {
    this.options = {
      provider: options.provider || 'ollama',
      model: options.model || 'nomic-embed-text',
      requireGemini: options.requireGemini || false,
      requireOpenAI: options.requireOpenAI || false,
      ...options,
    };
    this.results = [];
  }

  log(icon, color, message) {
    console.log(`${color}${icon}${colors.reset} ${message}`);
  }

  /**
   * Run all preflight checks
   */
  async runAll() {
    console.log(`\n${colors.bold}${colors.cyan}🔍 Running Preflight Checks${colors.reset}\n`);
    console.log(`${colors.gray}Validating environment before evolution...${colors.reset}\n`);

    // Core checks
    await this.checkNodeVersion();
    await this.checkDataFiles();
    await this.checkDocsDirectory();
    
    // Provider-specific checks
    if (this.options.provider === 'ollama') {
      await this.checkOllamaRunning();
      await this.checkOllamaModel();
    }
    
    if (this.options.requireGemini || this.options.provider === 'gemini') {
      await this.checkGeminiApiKey();
    }
    
    if (this.options.requireOpenAI || this.options.provider === 'openai') {
      await this.checkOpenAIApiKey();
    }

    // Display results
    return this.displayResults();
  }

  /**
   * Check Node.js version
   */
  async checkNodeVersion() {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    
    if (major >= 18) {
      this.results.push(new CheckResult(
        'Node.js Version',
        'pass',
        `Node.js ${version} (>= 18 required)`
      ));
    } else {
      this.results.push(new CheckResult(
        'Node.js Version',
        'fail',
        `Node.js ${version} is too old (>= 18 required)`,
        'Install Node.js 18 or later:\n  brew install node\n  # or use nvm:\n  nvm install 18 && nvm use 18',
        'https://nodejs.org/en/download/'
      ));
    }
  }

  /**
   * Check data files exist
   */
  async checkDataFiles() {
    const queriesPath = path.join(__dirname, '../examples/sample-queries.jsonl');
    const corpusPath = path.join(__dirname, '../examples/sample-corpus.jsonl');
    
    const queriesExist = await this.fileExists(queriesPath);
    const corpusExist = await this.fileExists(corpusPath);
    
    if (queriesExist && corpusExist) {
      // Validate content
      try {
        const queriesContent = await fs.readFile(queriesPath, 'utf-8');
        const corpusContent = await fs.readFile(corpusPath, 'utf-8');
        
        const queries = queriesContent.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
        const docs = corpusContent.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
        
        if (queries.length === 0 || docs.length === 0) {
          this.results.push(new CheckResult(
            'Evaluation Data',
            'fail',
            'Data files are empty',
            'Add evaluation data to:\n  examples/sample-queries.jsonl\n  examples/sample-corpus.jsonl\n\nFormat:\n  {"id": "q1", "query": "...", "relevantDocs": ["doc1"]}\n  {"id": "doc1", "content": "..."}',
          ));
        } else {
          this.results.push(new CheckResult(
            'Evaluation Data',
            'pass',
            `Found ${queries.length} queries and ${docs.length} documents`
          ));
        }
      } catch (e) {
        this.results.push(new CheckResult(
          'Evaluation Data',
          'fail',
          `Invalid JSON in data files: ${e.message}`,
          'Ensure each line is valid JSON:\n  {"id": "q1", "query": "...", "relevantDocs": ["doc1"]}'
        ));
      }
    } else {
      const missing = [];
      if (!queriesExist) missing.push('sample-queries.jsonl');
      if (!corpusExist) missing.push('sample-corpus.jsonl');
      
      this.results.push(new CheckResult(
        'Evaluation Data',
        'fail',
        `Missing data files: ${missing.join(', ')}`,
        `Create the missing files in examples/:\n\n${missing.includes('sample-queries.jsonl') ? 
          '# sample-queries.jsonl\n{"id": "q1", "query": "What is machine learning?", "relevantDocs": ["doc1", "doc2"]}\n\n' : ''}${missing.includes('sample-corpus.jsonl') ? 
          '# sample-corpus.jsonl\n{"id": "doc1", "content": "Machine learning is a subset of AI..."}\n' : ''}`
      ));
    }
  }

  /**
   * Check docs directory exists and is writable
   */
  async checkDocsDirectory() {
    const docsPath = path.join(__dirname, '../docs');
    
    try {
      await fs.access(docsPath);
      // Try to write a test file
      const testFile = path.join(docsPath, '.preflight-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      this.results.push(new CheckResult(
        'Docs Directory',
        'pass',
        'docs/ directory exists and is writable'
      ));
    } catch (e) {
      if (e.code === 'ENOENT') {
        this.results.push(new CheckResult(
          'Docs Directory',
          'fail',
          'docs/ directory does not exist',
          'Create the docs directory:\n  mkdir -p docs'
        ));
      } else {
        this.results.push(new CheckResult(
          'Docs Directory',
          'fail',
          `docs/ directory is not writable: ${e.message}`,
          'Fix permissions:\n  chmod 755 docs'
        ));
      }
    }
  }

  /**
   * Check if Ollama is running
   */
  async checkOllamaRunning() {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        this.results.push(new CheckResult(
          'Ollama Server',
          'pass',
          'Ollama is running on localhost:11434'
        ));
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e) {
      this.results.push(new CheckResult(
        'Ollama Server',
        'fail',
        'Ollama is not running or not accessible',
        `Start Ollama:\n  # macOS/Linux\n  ollama serve\n\n  # Or run in background\n  ollama serve &\n\n  # Check status\n  curl http://localhost:11434/api/tags`,
        'https://ollama.ai/download'
      ));
    }
  }

  /**
   * Check if required Ollama model is available
   */
  async checkOllamaModel() {
    const model = this.options.model;
    
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        this.results.push(new CheckResult(
          `Ollama Model (${model})`,
          'warn',
          'Could not check model availability (Ollama not responding)'
        ));
        return;
      }
      
      const data = await response.json();
      const models = data.models || [];
      const hasModel = models.some(m => 
        m.name === model || 
        m.name === `${model}:latest` ||
        m.name.startsWith(`${model}:`)
      );
      
      if (hasModel) {
        this.results.push(new CheckResult(
          `Ollama Model (${model})`,
          'pass',
          `Model '${model}' is installed`
        ));
      } else {
        const availableModels = models.map(m => m.name).join(', ') || 'none';
        this.results.push(new CheckResult(
          `Ollama Model (${model})`,
          'fail',
          `Model '${model}' is not installed`,
          `Pull the required model:\n  ollama pull ${model}\n\nAvailable models: ${availableModels}`,
          'https://ollama.ai/library'
        ));
      }
    } catch (e) {
      this.results.push(new CheckResult(
        `Ollama Model (${model})`,
        'warn',
        `Could not verify model: ${e.message}`
      ));
    }
  }

  /**
   * Check Gemini API key
   */
  async checkGeminiApiKey() {
    const key = process.env.GEMINI_API_KEY;
    
    if (key && key.length > 10) {
      // Optionally validate the key by making a test request
      this.results.push(new CheckResult(
        'Gemini API Key',
        'pass',
        'GEMINI_API_KEY is set'
      ));
    } else if (key) {
      this.results.push(new CheckResult(
        'Gemini API Key',
        'fail',
        'GEMINI_API_KEY appears to be invalid (too short)',
        'Set a valid Gemini API key:\n  export GEMINI_API_KEY="your-api-key-here"\n\n  # Or add to .env file:\n  echo "GEMINI_API_KEY=your-key" >> .env',
        'https://aistudio.google.com/app/apikey'
      ));
    } else {
      this.results.push(new CheckResult(
        'Gemini API Key',
        'fail',
        'GEMINI_API_KEY is not set',
        'Get an API key from Google AI Studio and set it:\n  export GEMINI_API_KEY="your-api-key-here"\n\n  # Or add to .env file:\n  echo "GEMINI_API_KEY=your-key" >> .env',
        'https://aistudio.google.com/app/apikey'
      ));
    }
  }

  /**
   * Check OpenAI API key
   */
  async checkOpenAIApiKey() {
    const key = process.env.OPENAI_API_KEY;
    
    if (key && key.startsWith('sk-') && key.length > 20) {
      this.results.push(new CheckResult(
        'OpenAI API Key',
        'pass',
        'OPENAI_API_KEY is set'
      ));
    } else if (key) {
      this.results.push(new CheckResult(
        'OpenAI API Key',
        'fail',
        'OPENAI_API_KEY appears to be invalid',
        'Set a valid OpenAI API key:\n  export OPENAI_API_KEY="sk-..."\n\n  # Or add to .env file:\n  echo "OPENAI_API_KEY=sk-..." >> .env',
        'https://platform.openai.com/api-keys'
      ));
    } else {
      this.results.push(new CheckResult(
        'OpenAI API Key',
        'fail',
        'OPENAI_API_KEY is not set',
        'Get an API key from OpenAI and set it:\n  export OPENAI_API_KEY="sk-..."\n\n  # Or add to .env file:\n  echo "OPENAI_API_KEY=sk-..." >> .env',
        'https://platform.openai.com/api-keys'
      ));
    }
  }

  /**
   * Helper to check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Display results and return pass/fail
   */
  displayResults() {
    console.log(`\n${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    
    const passed = this.results.filter(r => r.status === 'pass');
    const failed = this.results.filter(r => r.status === 'fail');
    const warned = this.results.filter(r => r.status === 'warn');
    
    // Show all results
    for (const result of this.results) {
      const icon = result.status === 'pass' ? icons.success : 
                   result.status === 'fail' ? icons.error : icons.warning;
      const color = result.status === 'pass' ? colors.green : 
                    result.status === 'fail' ? colors.red : colors.yellow;
      
      this.log(icon, color, `${colors.bold}${result.name}${colors.reset}`);
      console.log(`   ${colors.gray}${result.message}${colors.reset}`);
      
      if (result.status === 'fail' && result.fix) {
        console.log(`\n   ${colors.cyan}${colors.bold}How to fix:${colors.reset}`);
        const fixLines = result.fix.split('\n');
        for (const line of fixLines) {
          console.log(`   ${colors.cyan}${line}${colors.reset}`);
        }
        if (result.docs) {
          console.log(`\n   ${colors.blue}📖 Docs: ${result.docs}${colors.reset}`);
        }
      }
      console.log('');
    }
    
    // Summary
    console.log(`${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    console.log(`${colors.bold}Summary:${colors.reset} ${colors.green}${passed.length} passed${colors.reset}, ${colors.red}${failed.length} failed${colors.reset}, ${colors.yellow}${warned.length} warnings${colors.reset}\n`);
    
    if (failed.length > 0) {
      console.log(`${colors.red}${colors.bold}❌ Preflight checks failed!${colors.reset}`);
      console.log(`${colors.gray}Please fix the issues above and run again:${colors.reset}`);
      console.log(`${colors.cyan}  node scripts/run-evolution.mjs${colors.reset}\n`);
      return false;
    }
    
    if (warned.length > 0) {
      console.log(`${colors.yellow}${colors.bold}⚠️  Preflight checks passed with warnings${colors.reset}`);
      console.log(`${colors.gray}Evolution will proceed, but some features may not work.${colors.reset}\n`);
    } else {
      console.log(`${colors.green}${colors.bold}✅ All preflight checks passed!${colors.reset}`);
      console.log(`${colors.gray}Starting evolution...${colors.reset}\n`);
    }
    
    return true;
  }
}

/**
 * Run preflight checks standalone
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    provider: 'ollama',
    model: 'nomic-embed-text',
  };
  
  // Parse command line args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && args[i + 1]) {
      options.provider = args[++i];
    } else if (args[i] === '--model' && args[i + 1]) {
      options.model = args[++i];
    } else if (args[i] === '--require-gemini') {
      options.requireGemini = true;
    } else if (args[i] === '--require-openai') {
      options.requireOpenAI = true;
    }
  }
  
  const checker = new PreflightChecker(options);
  const passed = await checker.runAll();
  
  process.exit(passed ? 0 : 1);
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export default PreflightChecker;
