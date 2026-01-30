#!/usr/bin/env node
/**
 * EmbedEval Auto-Discovery System
 * Takes a folder, auto-discovers data, generates markdown, runs evals, reports results
 * Usage: node auto-discovery.mjs ./my-data-folder/
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { glob } from 'glob';

class AutoDiscoverySystem {
  constructor(inputFolder, options = {}) {
    this.inputFolder = path.resolve(inputFolder);
    this.options = {
      outputDir: options.outputDir || './embedeval-output',
      generateMarkdown: options.generateMarkdown !== false,
      runEvaluations: options.runEvaluations !== false,
      ...options
    };
    this.discovered = {
      documents: [],
      queries: [],
      config: null
    };
    this.results = {
      summary: null,
      rankings: null,
      markdown: null
    };
  }

  async run() {
    console.log('🔍 EmbedEval Auto-Discovery System');
    console.log('===================================\n');
    console.log(`Input: ${this.inputFolder}`);
    console.log(`Output: ${this.options.outputDir}\n`);

    // Phase 1: Discover data
    console.log('📁 Phase 1: Discovering Data...');
    await this.discoverData();

    // Phase 2: Auto-generate queries if needed
    if (this.discovered.queries.length === 0) {
      console.log('\n🎯 Phase 2: Generating Test Queries...');
      await this.generateQueries();
    }

    // Phase 3: Create optimized configs
    console.log('\n⚙️  Phase 3: Creating Evaluation Configs...');
    await this.createConfigs();

    // Phase 4: Run evaluations
    if (this.options.runEvaluations) {
      console.log('\n🔬 Phase 4: Running Permutation Matrix...');
      await this.runEvaluations();
    }

    // Phase 5: Generate comprehensive markdown report
    if (this.options.generateMarkdown) {
      console.log('\n📝 Phase 5: Generating Markdown Report...');
      await this.generateMarkdown();
    }

    // Phase 6: Build final summary
    console.log('\n📊 Phase 6: Final Summary...');
    await this.buildSummary();

    console.log('\n✅ Complete!');
    console.log(`📁 All outputs in: ${this.options.outputDir}`);
    console.log(`📄 Markdown report: ${path.join(this.options.outputDir, 'EVALUATION-REPORT.md')}`);
  }

  async discoverData() {
    console.log('  Scanning for data files...');

    // Look for common data formats
    const patterns = [
      '**/*.jsonl',
      '**/*.json',
      '**/*.txt',
      '**/*.md',
      '**/corpus*',
      '**/documents*',
      '**/queries*',
      '**/data/*'
    ];

    const foundFiles = [];
    for (const pattern of patterns) {
      const files = await glob(pattern, { cwd: this.inputFolder });
      foundFiles.push(...files.map(f => path.join(this.inputFolder, f)));
    }

    // Categorize files
    for (const file of foundFiles) {
      const basename = path.basename(file).toLowerCase();
      const content = await this.peekFile(file);

      if (basename.includes('query') || basename.includes('question')) {
        this.discovered.queries.push({ path: file, type: 'queries', preview: content.slice(0, 200) });
      } else if (basename.includes('corpus') || basename.includes('doc') || basename.includes('data')) {
        this.discovered.documents.push({ path: file, type: 'corpus', preview: content.slice(0, 200) });
      } else {
        // Try to determine type from content
        if (content.includes('"query"') || content.includes('"question"')) {
          this.discovered.queries.push({ path: file, type: 'queries', preview: content.slice(0, 200) });
        } else {
          this.discovered.documents.push({ path: file, type: 'corpus', preview: content.slice(0, 200) });
        }
      }
    }

    console.log(`  ✓ Found ${this.discovered.documents.length} document files`);
    console.log(`  ✓ Found ${this.discovered.queries.length} query files`);

    // Show previews
    if (this.discovered.documents.length > 0) {
      console.log('\n  Document samples:');
      this.discovered.documents.slice(0, 3).forEach((doc, i) => {
        console.log(`    ${i + 1}. ${path.relative(this.inputFolder, doc.path)}`);
        console.log(`       Preview: ${doc.preview.slice(0, 80)}...`);
      });
    }

    // Consolidate into single corpus
    if (this.discovered.documents.length > 0) {
      await this.consolidateCorpus();
    }
  }

  async peekFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.slice(0, 500); // First 500 chars
    } catch {
      return '';
    }
  }

  async consolidateCorpus() {
    console.log('\n  Consolidating corpus...');

    const allDocs = [];
    for (const docFile of this.discovered.documents) {
      const content = await fs.readFile(docFile.path, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const doc = JSON.parse(line);
          allDocs.push({
            id: doc.id || `doc-${allDocs.length}`,
            content: doc.content || doc.text || doc.body || line,
            metadata: doc.metadata || {}
          });
        } catch {
          // Treat as plain text
          allDocs.push({
            id: `doc-${allDocs.length}`,
            content: line,
            metadata: { source: docFile.path }
          });
        }
      }
    }

    // Save consolidated corpus
    await fs.mkdir(this.options.outputDir, { recursive: true });
    const corpusPath = path.join(this.options.outputDir, 'corpus.jsonl');
    await fs.writeFile(
      corpusPath,
      allDocs.map(d => JSON.stringify(d)).join('\n')
    );

    this.discovered.consolidatedCorpus = corpusPath;
    this.discovered.totalDocs = allDocs.length;

    console.log(`  ✓ Consolidated ${allDocs.length} documents`);
    console.log(`  💾 Saved to: ${corpusPath}`);
  }

  async generateQueries() {
    console.log('  Generating queries from corpus...');

    const corpusData = await fs.readFile(this.discovered.consolidatedCorpus, 'utf-8');
    const docs = corpusData.split('\n')
      .filter(l => l.trim())
      .map(l => JSON.parse(l));

    const queries = [];
    const usedDocs = new Set();

    // Generate queries from documents
    for (const doc of docs) {
      if (usedDocs.has(doc.id) || queries.length >= 100) break;

      const query = this.extractQueryFromDoc(doc);
      if (query) {
        queries.push(query);
        usedDocs.add(doc.id);
      }
    }

    // Save queries
    const queriesPath = path.join(this.options.outputDir, 'queries.jsonl');
    await fs.writeFile(
      queriesPath,
      queries.map(q => JSON.stringify(q)).join('\n')
    );

    this.discovered.generatedQueries = queriesPath;
    this.discovered.totalQueries = queries.length;

    console.log(`  ✓ Generated ${queries.length} test queries`);
    console.log(`  💾 Saved to: ${queriesPath}`);

    // Show samples
    console.log('\n  Query samples:');
    queries.slice(0, 3).forEach((q, i) => {
      console.log(`    ${i + 1}. "${q.query.slice(0, 60)}..."`);
    });
  }

  extractQueryFromDoc(doc) {
    const content = doc.content || '';

    // Strategy 1: First sentence
    const firstSentence = content.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 15 && firstSentence.length < 150) {
      return {
        id: `q-${doc.id}`,
        query: firstSentence,
        relevantDocs: [doc.id],
        relevanceScores: [1.0]
      };
    }

    // Strategy 2: Key phrase
    const words = content.split(/\s+/).filter(w => w.length > 4);
    if (words.length >= 4) {
      return {
        id: `q-${doc.id}`,
        query: `What is ${words.slice(0, 4).join(' ')}?`,
        relevantDocs: [doc.id],
        relevanceScores: [1.0]
      };
    }

    return null;
  }

  async createConfigs() {
    console.log('  Creating optimized evaluation configs...');

    const configs = [
      {
        name: 'Quick Test (3 providers)',
        file: 'eval-quick.yaml',
        providers: ['ollama', 'openai', 'google'],
        strategies: ['baseline', 'semantic-chunks']
      },
      {
        name: 'Standard Test (5 providers)',
        file: 'eval-standard.yaml',
        providers: ['ollama', 'openai', 'google', 'huggingface'],
        strategies: ['baseline', 'semantic-chunks', 'hybrid-bm25']
      },
      {
        name: 'Full Matrix (All combinations)',
        file: 'eval-full.yaml',
        providers: ['ollama', 'openai', 'google', 'huggingface'],
        strategies: ['baseline', 'semantic-chunks', 'fixed-chunks', 'hybrid-bm25', 'mmr-diversity']
      }
    ];

    for (const config of configs) {
      const yaml = this.buildConfigYaml(config);
      const configPath = path.join(this.options.outputDir, config.file);
      await fs.writeFile(configPath, yaml);
    }

    console.log(`  ✓ Created ${configs.length} evaluation configs`);
    configs.forEach(c => {
      console.log(`    • ${c.file} - ${c.name}`);
    });

    // Create default config
    this.discovered.defaultConfig = path.join(this.options.outputDir, 'eval-standard.yaml');
  }

  buildConfigYaml(config) {
    const providers = {
      'ollama': { type: 'ollama', model: 'nomic-embed-text' },
      'openai': { type: 'openai', model: 'text-embedding-3-small' },
      'google': { type: 'google', model: 'text-embedding-004' },
      'huggingface': { type: 'huggingface', model: 'sentence-transformers/all-MiniLM-L6-v2' }
    };

    let yaml = `# ${config.name}\n`;
    yaml += `test:\n`;
    yaml += `  name: "${config.name}"\n`;
    yaml += `  id: auto-discovery-${Date.now()}\n\n`;
    yaml += `variants:\n`;

    let variantId = 0;
    for (const providerKey of config.providers) {
      for (const strategy of config.strategies) {
        const provider = providers[providerKey];
        yaml += `  - id: variant-${variantId++}\n`;
        yaml += `    name: "${providerKey}-${strategy}"\n`;
        yaml += `    provider:\n`;
        yaml += `      type: ${provider.type}\n`;
        yaml += `      model: ${provider.model}\n`;
        yaml += `    strategy: ${strategy}\n`;
      }
    }

    yaml += `\ndataset: ./queries.jsonl\n`;
    yaml += `corpus: ./corpus.jsonl\n\n`;
    yaml += `metrics:\n`;
    yaml += `  - ndcg@10\n`;
    yaml += `  - recall@10\n`;
    yaml += `  - mrr@10\n\n`;
    yaml += `output:\n`;
    yaml += `  json: ./results/metrics.json\n`;
    yaml += `  dashboard: ./results/dashboard.html\n`;
    yaml += `  csv: ./results/results.csv\n`;

    return yaml;
  }

  async runEvaluations() {
    console.log('  Running evaluations (this may take a while)...');

    const configPath = this.discovered.defaultConfig;
    const resultsDir = path.join(this.options.outputDir, 'results');

    try {
      execSync(`embedeval ab-test --config ${configPath} --output ${resultsDir}`, {
        encoding: 'utf-8',
        timeout: 600000, // 10 minutes
        stdio: 'inherit'
      });

      // Read results
      const metricsPath = path.join(resultsDir, 'metrics.json');
      if (await this.fileExists(metricsPath)) {
        const metrics = JSON.parse(await fs.readFile(metricsPath, 'utf-8'));
        this.results.evaluation = metrics;

        // Calculate rankings
        this.results.rankings = this.calculateRankings(metrics);
      }

      console.log('  ✓ Evaluations complete');
    } catch (error) {
      console.log(`  ⚠️  Evaluation error: ${error.message}`);
      console.log('  Continuing with markdown generation...');
    }
  }

  calculateRankings(metrics) {
    if (!metrics.variants) return null;

    const variants = metrics.variants.map(v => ({
      name: v.variantName || v.variantId,
      provider: v.provider?.type || 'unknown',
      strategy: v.strategy || 'baseline',
      ndcg: v.metrics?.ndcg || 0,
      recall: v.metrics?.recall || 0,
      mrr: v.metrics?.mrr || 0,
      latency: v.usage?.avgLatency || 0
    }));

    return {
      byQuality: [...variants].sort((a, b) => b.ndcg - a.ndcg).slice(0, 5),
      bySpeed: [...variants].sort((a, b) => a.latency - b.latency).slice(0, 5),
      bestOverall: variants.sort((a, b) => b.ndcg - a.ndcg)[0]
    };
  }

  async generateMarkdown() {
    console.log('  Building comprehensive markdown report...');

    const md = [];

    // Header
    md.push('# EmbedEval Auto-Discovery Report');
    md.push('');
    md.push(`**Generated:** ${new Date().toLocaleString()}`);
    md.push(`**Data Source:** \`${this.inputFolder}\``);
    md.push(`**Output:** \`${this.options.outputDir}\``);
    md.push('');
    md.push('---');
    md.push('');

    // Data Summary
    md.push('## 📊 Data Summary');
    md.push('');
    md.push(`- **Total Documents:** ${this.discovered.totalDocs || 'N/A'}`);
    md.push(`- **Test Queries:** ${this.discovered.totalQueries || 'N/A'}`);
    md.push(`- **Source Files:** ${this.discovered.documents.length}`);
    md.push('');

    // Discovered Files
    if (this.discovered.documents.length > 0) {
      md.push('### Discovered Files');
      md.push('');
      md.push('| File | Type | Preview |');
      md.push('|------|------|---------|');
      this.discovered.documents.forEach(doc => {
        const relPath = path.relative(this.inputFolder, doc.path);
        const preview = doc.preview.slice(0, 50).replace(/\|/g, '\\|');
        md.push(`| ${relPath} | ${doc.type} | ${preview}... |`);
      });
      md.push('');
    }

    // Results
    if (this.results.rankings) {
      md.push('## 🏆 Evaluation Results');
      md.push('');

      // Best Overall
      const best = this.results.rankings.bestOverall;
      md.push('### Best Overall Configuration');
      md.push('');
      md.push(`**${best.name}**`);
      md.push('');
      md.push(`- **NDCG@10:** ${best.ndcg.toFixed(3)}`);
      md.push(`- **Recall@10:** ${best.recall.toFixed(3)}`);
      md.push(`- **MRR@10:** ${best.mrr.toFixed(3)}`);
      md.push(`- **Latency:** ${best.latency.toFixed(0)}ms`);
      md.push('');

      // Top by Quality
      md.push('### Top 5 by Quality');
      md.push('');
      md.push('| Rank | Configuration | NDCG | Recall | MRR |');
      md.push('|------|--------------|------|--------|-----|');
      this.results.rankings.byQuality.forEach((v, i) => {
        md.push(`| ${i + 1} | ${v.name} | ${v.ndcg.toFixed(3)} | ${v.recall.toFixed(3)} | ${v.mrr.toFixed(3)} |`);
      });
      md.push('');

      // Top by Speed
      md.push('### Top 5 by Speed');
      md.push('');
      md.push('| Rank | Configuration | Latency |');
      md.push('|------|--------------|---------|');
      this.results.rankings.bySpeed.forEach((v, i) => {
        md.push(`| ${i + 1} | ${v.name} | ${v.latency.toFixed(0)}ms |`);
      });
      md.push('');
    }

    // Recommendations
    md.push('## 💡 Recommendations');
    md.push('');

    if (this.results.rankings) {
      const best = this.results.rankings.bestOverall;
      md.push(`### For Your Data, Use: **${best.name}**`);
      md.push('');
      md.push('This configuration provides the best balance of quality and performance for your specific dataset.');
      md.push('');
    }

    md.push('### Quick Start');
    md.push('');
    md.push('```bash');
    md.push('# Run evaluation with recommended config');
    md.push(`embedeval ab-test --config ${path.relative(process.cwd(), this.discovered.defaultConfig)}`);
    md.push('');
    md.push('# View results');
    md.push(`open ${path.relative(process.cwd(), this.options.outputDir)}/results/dashboard.html`);
    md.push('```');
    md.push('');

    // Optimization Guide
    md.push('## 🔧 Optimization Guide');
    md.push('');
    md.push('### If You Want Better Quality');
    md.push('- Try larger embedding models (text-embedding-3-large)');
    md.push('- Use semantic chunking for long documents');
    md.push('- Enable hybrid BM25 for keyword matching');
    md.push('');
    md.push('### If You Want Lower Latency');
    md.push('- Use local models (Ollama) instead of APIs');
    md.push('- Use smaller embedding models');
    md.push('- Disable reranking stages');
    md.push('');
    md.push('### If You Want Lower Cost');
    md.push('- Use HuggingFace models (free)');
    md.push('- Use Ollama for local inference');
    md.push('- Batch queries when possible');
    md.push('');

    // Files Generated
    md.push('## 📁 Generated Files');
    md.push('');
    md.push('```');
    md.push(`${path.basename(this.options.outputDir)}/`);
    md.push('├── corpus.jsonl          # Consolidated documents');
    md.push('├── queries.jsonl         # Generated test queries');
    md.push('├── eval-quick.yaml       # Quick evaluation config');
    md.push('├── eval-standard.yaml    # Standard evaluation config');
    md.push('├── eval-full.yaml        # Full permutation matrix');
    md.push('├── results/              # Evaluation results');
    md.push('│   ├── metrics.json');
    md.push('│   ├── dashboard.html');
    md.push('│   └── results.csv');
    md.push('└── EVALUATION-REPORT.md  # This report');
    md.push('```');
    md.push('');

    // Next Steps
    md.push('## 🚀 Next Steps');
    md.push('');
    md.push('1. **Review Results**: Check the generated dashboard at `results/dashboard.html`');
    md.push('2. **Choose Config**: Select the best configuration for your needs');
    md.push('3. **Deploy**: Use the winning configuration in your application');
    md.push('4. **Monitor**: Re-run monthly to detect performance drift');
    md.push('');

    // Footer
    md.push('---');
    md.push('');
    md.push('*Generated by EmbedEval Auto-Discovery System*');
    md.push('*For questions: https://github.com/Algiras/embedeval*');

    const markdownContent = md.join('\n');

    // Save markdown
    const mdPath = path.join(this.options.outputDir, 'EVALUATION-REPORT.md');
    await fs.writeFile(mdPath, markdownContent);

    this.results.markdown = mdPath;
    console.log(`  ✓ Markdown report: ${mdPath}`);
  }

  async buildSummary() {
    const summary = {
      input: this.inputFolder,
      output: this.options.outputDir,
      discovered: {
        documents: this.discovered.totalDocs,
        queries: this.discovered.totalQueries,
        files: this.discovered.documents.length
      },
      generated: {
        corpus: this.discovered.consolidatedCorpus,
        queries: this.discovered.generatedQueries,
        configs: 3,
        markdown: this.results.markdown
      },
      results: this.results.rankings ? {
        bestOverall: this.results.rankings.bestOverall,
        totalVariants: this.results.rankings.byQuality.length
      } : null
    };

    // Save summary JSON
    await fs.writeFile(
      path.join(this.options.outputDir, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Print final summary
    console.log('\n📋 Summary');
    console.log('==========');
    console.log(`Documents processed: ${summary.discovered.documents}`);
    console.log(`Queries generated: ${summary.discovered.queries}`);
    console.log(`Best configuration: ${summary.results?.bestOverall?.name || 'N/A'}`);
    console.log(`Quality (NDCG): ${summary.results?.bestOverall?.ndcg.toFixed(3) || 'N/A'}`);
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// CLI
const inputFolder = process.argv[2];
if (!inputFolder) {
  console.log('Usage: node auto-discovery.mjs <folder-path> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --output <dir>     Output directory (default: ./embedeval-output)');
  console.log('  --no-eval          Skip running evaluations');
  console.log('  --no-markdown      Skip markdown generation');
  console.log('');
  console.log('Example:');
  console.log('  node auto-discovery.mjs ./my-documents/ --output ./eval-results');
  process.exit(1);
}

const options = {};
for (let i = 3; i < process.argv.length; i++) {
  if (process.argv[i] === '--output') {
    options.outputDir = process.argv[++i];
  } else if (process.argv[i] === '--no-eval') {
    options.runEvaluations = false;
  } else if (process.argv[i] === '--no-markdown') {
    options.generateMarkdown = false;
  }
}

const system = new AutoDiscoverySystem(inputFolder, options);
system.run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
