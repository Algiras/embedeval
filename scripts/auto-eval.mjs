#!/usr/bin/env node
/**
 * Auto-Evaluation System
 * Takes user data, generates queries, runs permutation matrix, reports all optimization options
 * Usage: node auto-eval.mjs ./my-corpus.jsonl [options]
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class AutoEvaluator {
  constructor(corpusPath, options = {}) {
    this.corpusPath = corpusPath;
    this.options = {
      trainSplit: 0.8,
      numQueries: options.numQueries || 100,
      outputDir: options.outputDir || './auto-eval-results',
      providers: options.providers || ['ollama', 'openai', 'google'],
      strategies: options.strategies || ['baseline', 'semantic-chunks', 'hybrid-bm25'],
      ...options
    };
    this.runId = uuidv4().slice(0, 8);
    this.results = {
      dataSplit: null,
      generatedQueries: null,
      permutations: [],
      rankings: null,
      recommendations: null
    };
  }

  async run() {
    console.log('🔬 Auto-Evaluation System');
    console.log('=========================\n');
    
    // Phase 1: Load and split data
    console.log('📊 Phase 1: Data Preparation');
    await this.prepareData();
    
    // Phase 2: Generate queries
    console.log('\n🎯 Phase 2: Query Generation');
    await this.generateQueries();
    
    // Phase 3: Run permutation matrix
    console.log('\n🔍 Phase 3: Running Permutation Matrix');
    await this.runPermutationMatrix();
    
    // Phase 4: Analyze and rank
    console.log('\n📈 Phase 4: Analysis & Ranking');
    await this.analyzeResults();
    
    // Phase 5: Generate comprehensive report
    console.log('\n📋 Phase 5: Final Report');
    await this.generateReport();
    
    console.log('\n✅ Auto-evaluation complete!');
    console.log(`📁 Results saved to: ${this.options.outputDir}`);
  }

  async prepareData() {
    console.log(`  Loading corpus from: ${this.corpusPath}`);
    
    // Load corpus
    const corpusData = await fs.readFile(this.corpusPath, 'utf-8');
    const documents = corpusData
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    console.log(`  📄 Total documents: ${documents.length}`);
    
    // Shuffle and split 80/20
    const shuffled = this.shuffle([...documents]);
    const splitIndex = Math.floor(shuffled.length * this.options.trainSplit);
    
    const trainDocs = shuffled.slice(0, splitIndex);
    const testDocs = shuffled.slice(splitIndex);
    
    this.results.dataSplit = {
      total: documents.length,
      train: trainDocs.length,
      test: testDocs.length,
      splitRatio: this.options.trainSplit
    };
    
    // Save splits
    await fs.mkdir(this.options.outputDir, { recursive: true });
    await fs.writeFile(
      path.join(this.options.outputDir, 'train-corpus.jsonl'),
      trainDocs.map(d => JSON.stringify(d)).join('\n')
    );
    await fs.writeFile(
      path.join(this.options.outputDir, 'test-corpus.jsonl'),
      testDocs.map(d => JSON.stringify(d)).join('\n')
    );
    
    console.log(`  ✓ Split: ${trainDocs.length} train / ${testDocs.length} test`);
    console.log(`  💾 Saved to: ${this.options.outputDir}/`);
  }

  async generateQueries() {
    console.log(`  Generating ${this.options.numQueries} test queries...`);
    
    // Load test corpus
    const testData = await fs.readFile(
      path.join(this.options.outputDir, 'test-corpus.jsonl'),
      'utf-8'
    );
    const testDocs = testData
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    // Generate queries from documents
    const queries = [];
    const usedDocs = new Set();
    
    for (let i = 0; i < this.options.numQueries && i < testDocs.length; i++) {
      const doc = testDocs[i];
      const query = this.generateQueryFromDoc(doc);
      
      if (query && !usedDocs.has(doc.id)) {
        queries.push(query);
        usedDocs.add(doc.id);
      }
    }
    
    this.results.generatedQueries = {
      count: queries.length,
      sample: queries.slice(0, 3)
    };
    
    // Save queries
    await fs.writeFile(
      path.join(this.options.outputDir, 'queries.jsonl'),
      queries.map(q => JSON.stringify(q)).join('\n')
    );
    
    console.log(`  ✓ Generated ${queries.length} queries`);
    console.log(`  💾 Saved to: ${this.options.outputDir}/queries.jsonl`);
  }

  generateQueryFromDoc(doc) {
    // Simple query generation - extract key terms or use first sentence
    const content = doc.content || doc.text || '';
    if (!content) return null;
    
    // Strategy 1: Use first sentence (often contains main topic)
    const firstSentence = content.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 10 && firstSentence.length < 200) {
      return {
        id: `q-${doc.id || Math.random().toString(36).slice(2)}`,
        query: firstSentence,
        relevantDocs: [doc.id],
        relevanceScores: [1.0],
        source: 'first-sentence',
        originalDoc: doc.id
      };
    }
    
    // Strategy 2: Extract key terms (simple approach)
    const words = content.toLowerCase().split(/\s+/);
    const keyTerms = words.filter(w => w.length > 5).slice(0, 5);
    
    if (keyTerms.length >= 3) {
      return {
        id: `q-${doc.id || Math.random().toString(36).slice(2)}`,
        query: `Information about ${keyTerms.join(' ')}`,
        relevantDocs: [doc.id],
        relevanceScores: [1.0],
        source: 'key-terms',
        originalDoc: doc.id
      };
    }
    
    return null;
  }

  async runPermutationMatrix() {
    console.log('  Testing all provider/strategy combinations...');
    
    const providers = this.getProviderConfigs();
    const strategies = this.getStrategyConfigs();
    const queriesPath = path.join(this.options.outputDir, 'queries.jsonl');
    const corpusPath = path.join(this.options.outputDir, 'train-corpus.jsonl');
    
    let completed = 0;
    const total = providers.length * strategies.length;
    
    for (const provider of providers) {
      for (const strategy of strategies) {
        const config = this.createEvalConfig(provider, strategy, queriesPath, corpusPath);
        const configPath = path.join(this.options.outputDir, `config-${provider.id}-${strategy.id}.yaml`);
        
        // Write config
        await fs.writeFile(configPath, this.toYaml(config));
        
        // Run evaluation
        try {
          const outputDir = path.join(this.options.outputDir, 'results', `${provider.id}-${strategy.id}`);
          await fs.mkdir(outputDir, { recursive: true });
          
          execSync(`embedeval ab-test --config ${configPath} --output ${outputDir}`, {
            encoding: 'utf-8',
            timeout: 300000
          });
          
          // Read results
          const resultsPath = path.join(outputDir, 'metrics.json');
          if (await this.fileExists(resultsPath)) {
            const results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
            const variant = results.variants?.[0];
            
            if (variant) {
              this.results.permutations.push({
                provider: provider.name,
                providerId: provider.id,
                strategy: strategy.name,
                strategyId: strategy.id,
                metrics: {
                  ndcg: variant.metrics?.ndcg || 0,
                  recall: variant.metrics?.recall || 0,
                  mrr: variant.metrics?.mrr || 0,
                  latency: variant.usage?.avgLatency || 0
                },
                cost: provider.costPerQuery,
                outputDir
              });
            }
          }
          
          completed++;
          process.stdout.write(`\r  Progress: ${completed}/${total} (${((completed/total)*100).toFixed(0)}%)`);
          
        } catch (error) {
          console.log(`\n  ⚠️  Failed: ${provider.name} + ${strategy.name} - ${error.message}`);
          this.results.permutations.push({
            provider: provider.name,
            providerId: provider.id,
            strategy: strategy.name,
            strategyId: strategy.id,
            metrics: { ndcg: 0, recall: 0, mrr: 0, latency: 0 },
            cost: provider.costPerQuery,
            failed: true,
            error: error.message
          });
          completed++;
        }
      }
    }
    
    console.log('\n  ✓ All permutations tested');
  }

  getProviderConfigs() {
    const allProviders = [
      { id: 'ollama', name: 'Ollama Local', type: 'ollama', model: 'nomic-embed-text', costPerQuery: 0 },
      { id: 'openai-small', name: 'OpenAI Small', type: 'openai', model: 'text-embedding-3-small', costPerQuery: 0.00002 },
      { id: 'openai-large', name: 'OpenAI Large', type: 'openai', model: 'text-embedding-3-large', costPerQuery: 0.00013 },
      { id: 'google', name: 'Google Gemini', type: 'google', model: 'text-embedding-004', costPerQuery: 0.000025 },
      { id: 'minilm', name: 'HuggingFace MiniLM', type: 'huggingface', model: 'sentence-transformers/all-MiniLM-L6-v2', costPerQuery: 0 }
    ];
    
    return allProviders.filter(p => this.options.providers.includes(p.id) || this.options.providers.includes(p.type));
  }

  getStrategyConfigs() {
    const allStrategies = [
      { id: 'baseline', name: 'Baseline', description: 'Simple embedding + cosine similarity' },
      { id: 'semantic-chunks', name: 'Semantic Chunks', description: 'Intelligent document chunking' },
      { id: 'fixed-chunks', name: 'Fixed Chunks', description: 'Fixed-size chunking' },
      { id: 'hybrid-bm25', name: 'Hybrid BM25', description: 'Embeddings + keyword matching' },
      { id: 'mmr-diversity', name: 'MMR Diversity', description: 'Maximum marginal relevance' }
    ];
    
    return allStrategies.filter(s => this.options.strategies.includes(s.id));
  }

  createEvalConfig(provider, strategy, queriesPath, corpusPath) {
    return {
      test: {
        name: `${provider.name} + ${strategy.name}`,
        id: `${provider.id}-${strategy.id}`
      },
      variants: [{
        id: 'variant-1',
        name: `${provider.name} - ${strategy.name}`,
        provider: {
          type: provider.type,
          model: provider.model
        },
        strategy: strategy.id
      }],
      dataset: queriesPath,
      corpus: corpusPath,
      metrics: ['ndcg@10', 'recall@10', 'mrr@10'],
      output: {
        json: './metrics.json'
      }
    };
  }

  toYaml(obj) {
    // Simple YAML serialization
    return Object.entries(obj)
      .map(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value)) {
          return `${key}:\n${Object.entries(value)
            .map(([k, v]) => `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join('\n')}`;
        }
        return `${key}: ${JSON.stringify(value)}`;
      })
      .join('\n');
  }

  async analyzeResults() {
    console.log('  Analyzing results...');
    
    // Filter out failures
    const validResults = this.results.permutations.filter(p => !p.failed);
    
    // Sort by different metrics
    const byQuality = [...validResults].sort((a, b) => b.metrics.ndcg - a.metrics.ndcg);
    const bySpeed = [...validResults].sort((a, b) => a.metrics.latency - b.metrics.latency);
    const byCost = [...validResults].sort((a, b) => a.cost - b.cost);
    
    // Calculate value (NDCG per dollar)
    const byValue = validResults
      .map(p => ({
        ...p,
        value: p.cost > 0 ? p.metrics.ndcg / (p.cost * 1000) : p.metrics.ndcg * 1000
      }))
      .sort((a, b) => b.value - a.value);
    
    this.results.rankings = {
      byQuality: byQuality.slice(0, 5),
      bySpeed: bySpeed.slice(0, 5),
      byCost: byCost.slice(0, 5),
      byValue: byValue.slice(0, 5),
      overall: byQuality[0]
    };
    
    // Generate recommendations
    this.results.recommendations = this.generateRecommendations();
    
    console.log('  ✓ Analysis complete');
  }

  generateRecommendations() {
    const r = this.results.rankings;
    
    return {
      bestOverall: {
        ...r.overall,
        reason: 'Highest NDCG score - best retrieval quality'
      },
      bestQuality: {
        ...r.byQuality[0],
        reason: 'Maximum retrieval accuracy'
      },
      fastest: {
        ...r.bySpeed[0],
        reason: 'Lowest latency for real-time applications'
      },
      cheapest: {
        ...r.byCost[0],
        reason: 'Zero or minimal cost per query'
      },
      bestValue: {
        ...r.byValue[0],
        reason: 'Best quality per dollar spent'
      },
      alternatives: r.byQuality.slice(1, 4).map((p, i) => ({
        ...p,
        reason: `Quality option #${i + 2} with different trade-offs`
      }))
    };
  }

  async generateReport() {
    const report = {
      metadata: {
        runId: this.runId,
        timestamp: new Date().toISOString(),
        corpusPath: this.corpusPath,
        options: this.options
      },
      dataSummary: this.results.dataSplit,
      queriesGenerated: this.results.generatedQueries,
      totalPermutations: this.results.permutations.length,
      successfulPermutations: this.results.permutations.filter(p => !p.failed).length,
      rankings: this.results.rankings,
      recommendations: this.results.recommendations,
      allResults: this.results.permutations
    };
    
    // Save JSON report
    await fs.writeFile(
      path.join(this.options.outputDir, 'report.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Generate human-readable report
    await this.printHumanReport(report);
    
    // Generate CSV for analysis
    await this.generateCSV(report);
  }

  async printHumanReport(report) {
    const lines = [];
    
    lines.push('='.repeat(80));
    lines.push('AUTO-EVALUATION REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(`Run ID: ${report.metadata.runId}`);
    lines.push(`Corpus: ${report.metadata.corpusPath}`);
    lines.push(`Documents: ${report.dataSummary.total} (${report.dataSummary.train} train / ${report.dataSummary.test} test)`);
    lines.push(`Queries Generated: ${report.queriesGenerated.count}`);
    lines.push(`Permutations Tested: ${report.totalPermutations} (${report.successfulPermutations} successful)`);
    lines.push('');
    
    lines.push('🏆 TOP RECOMMENDATIONS FOR YOUR DATA');
    lines.push('-'.repeat(80));
    lines.push('');
    
    const recs = report.recommendations;
    
    // Best Overall
    lines.push(`1. 🥇 BEST OVERALL: ${recs.bestOverall.provider} + ${recs.bestOverall.strategy}`);
    lines.push(`   NDCG@10: ${recs.bestOverall.metrics.ndcg.toFixed(3)} | Recall: ${recs.bestOverall.metrics.recall.toFixed(3)} | MRR: ${recs.bestOverall.metrics.mrr.toFixed(3)}`);
    lines.push(`   Latency: ${recs.bestOverall.metrics.latency.toFixed(0)}ms | Cost: $${recs.bestOverall.cost.toFixed(5)}/query`);
    lines.push(`   Why: ${recs.bestOverall.reason}`);
    lines.push('');
    
    // Category Winners
    lines.push('📊 CATEGORY WINNERS');
    lines.push('-'.repeat(80));
    lines.push('');
    
    lines.push(`🎯 Best Quality:  ${recs.bestQuality.provider} + ${recs.bestQuality.strategy} (NDCG: ${recs.bestQuality.metrics.ndcg.toFixed(3)})`);
    lines.push(`⚡ Fastest:       ${recs.fastest.provider} + ${recs.fastest.strategy} (${recs.fastest.metrics.latency.toFixed(0)}ms)`);
    lines.push(`💰 Cheapest:      ${recs.cheapest.provider} + ${recs.cheapest.strategy} ($${recs.cheapest.cost.toFixed(5)}/query)`);
    lines.push(`🏅 Best Value:    ${recs.bestValue.provider} + ${recs.bestValue.strategy} (Value: ${recs.bestValue.value?.toFixed(0) || 'N/A'})`);
    lines.push('');
    
    // Alternatives
    lines.push('🔄 ALTERNATIVE OPTIONS');
    lines.push('-'.repeat(80));
    lines.push('');
    recs.alternatives.forEach((alt, i) => {
      lines.push(`${i + 2}. ${alt.provider} + ${alt.strategy}`);
      lines.push(`   NDCG: ${alt.metrics.ndcg.toFixed(3)} | Latency: ${alt.metrics.latency.toFixed(0)}ms | Cost: $${alt.cost.toFixed(5)}`);
      lines.push(`   ${alt.reason}`);
      lines.push('');
    });
    
    // What you can optimize
    lines.push('🔧 OPTIMIZATION OPPORTUNITIES');
    lines.push('-'.repeat(80));
    lines.push('');
    
    const qualityGap = recs.bestQuality.metrics.ndcg - recs.bestOverall.metrics.ndcg;
    if (qualityGap > 0.02) {
      lines.push(`• Switch from "${recs.bestOverall.strategy}" to "${recs.bestQuality.strategy}"`);
      lines.push(`  → Gain ${(qualityGap * 100).toFixed(1)}% quality (NDCG: ${recs.bestOverall.metrics.ndcg.toFixed(3)} → ${recs.bestQuality.metrics.ndcg.toFixed(3)})`);
      lines.push(`  → Trade-off: ${recs.bestQuality.metrics.latency > recs.bestOverall.metrics.latency ? 'Slower' : 'Same speed'}`);
      lines.push('');
    }
    
    const speedGap = recs.bestOverall.metrics.latency - recs.fastest.metrics.latency;
    if (speedGap > 50) {
      lines.push(`• Switch from "${recs.bestOverall.provider}" to "${recs.fastest.provider}"`);
      lines.push(`  → Gain ${speedGap.toFixed(0)}ms latency (${recs.bestOverall.metrics.latency.toFixed(0)}ms → ${recs.fastest.metrics.latency.toFixed(0)}ms)`);
      lines.push(`  → Trade-off: ${((recs.bestOverall.metrics.ndcg - recs.fastest.metrics.ndcg) * 100).toFixed(1)}% quality drop`);
      lines.push('');
    }
    
    const costGap = recs.bestOverall.cost - recs.cheapest.cost;
    if (costGap > 0.00001) {
      lines.push(`• Switch from "${recs.bestOverall.provider}" to "${recs.cheapest.provider}"`);
      lines.push(`  → Save $${costGap.toFixed(5)}/query ($${recs.bestOverall.cost.toFixed(5)} → $${recs.cheapest.cost.toFixed(5)})`);
      lines.push(`  → At 1000 queries/day: Save $${(costGap * 1000 * 30).toFixed(2)}/month`);
      lines.push(`  → Trade-off: ${((recs.bestOverall.metrics.ndcg - recs.cheapest.metrics.ndcg) * 100).toFixed(1)}% quality drop`);
      lines.push('');
    }
    
    lines.push('');
    lines.push('💡 QUICK WINS');
    lines.push('-'.repeat(80));
    lines.push('');
    
    // Find quick wins (low effort, high impact)
    const baseline = report.allResults.find(p => p.strategyId === 'baseline');
    const winner = recs.bestOverall;
    
    if (baseline && winner.metrics.ndcg > baseline.metrics.ndcg) {
      const improvement = ((winner.metrics.ndcg - baseline.metrics.ndcg) / baseline.metrics.ndcg * 100).toFixed(1);
      lines.push(`• Upgrade from Baseline to ${winner.strategy}: +${improvement}% quality`);
    }
    
    // Best free option
    const bestFree = report.allResults
      .filter(p => p.cost === 0)
      .sort((a, b) => b.metrics.ndcg - a.metrics.ndcg)[0];
    
    if (bestFree) {
      lines.push(`• Best free option: ${bestFree.provider} + ${bestFree.strategy} (NDCG: ${bestFree.metrics.ndcg.toFixed(3)})`);
    }
    
    lines.push('');
    lines.push('='.repeat(80));
    lines.push('');
    lines.push('📁 Full report saved to:');
    lines.push(`   JSON: ${this.options.outputDir}/report.json`);
    lines.push(`   CSV:  ${this.options.outputDir}/results.csv`);
    lines.push('');
    lines.push('Next steps:');
    lines.push('  1. Review the detailed JSON report');
    lines.push('  2. Choose your preferred trade-off (quality/speed/cost)');
    lines.push('  3. Deploy the winning configuration');
    lines.push('  4. Re-run monthly to detect drift');
    lines.push('');
    
    const reportText = lines.join('\n');
    console.log('\n' + reportText);
    
    // Save to file
    await fs.writeFile(
      path.join(this.options.outputDir, 'REPORT.txt'),
      reportText
    );
  }

  async generateCSV(report) {
    const headers = ['rank', 'provider', 'strategy', 'ndcg', 'recall', 'mrr', 'latency_ms', 'cost_per_query', 'value_score'];
    
    const rows = report.allResults
      .sort((a, b) => b.metrics.ndcg - a.metrics.ndcg)
      .map((p, i) => [
        i + 1,
        p.provider,
        p.strategy,
        p.metrics.ndcg.toFixed(4),
        p.metrics.recall.toFixed(4),
        p.metrics.mrr.toFixed(4),
        p.metrics.latency.toFixed(0),
        p.cost.toFixed(6),
        p.cost > 0 ? (p.metrics.ndcg / (p.cost * 1000)).toFixed(2) : (p.metrics.ndcg * 1000).toFixed(2)
      ].join(','));
    
    const csv = [headers.join(','), ...rows].join('\n');
    
    await fs.writeFile(
      path.join(this.options.outputDir, 'results.csv'),
      csv
    );
  }

  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

// CLI usage
const corpusPath = process.argv[2];
if (!corpusPath) {
  console.log('Usage: node auto-eval.mjs <corpus.jsonl> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --queries <n>      Number of queries to generate (default: 100)');
  console.log('  --providers <list> Comma-separated providers (default: all)');
  console.log('  --strategies <list> Comma-separated strategies (default: all)');
  console.log('  --output <dir>     Output directory (default: ./auto-eval-results)');
  console.log('');
  console.log('Example:');
  console.log('  node auto-eval.mjs ./my-corpus.jsonl --queries 50 --providers ollama,openai');
  process.exit(1);
}

// Parse options
const options = {};
for (let i = 3; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace('--', '');
  const value = process.argv[i + 1];
  
  if (key === 'queries') options.numQueries = parseInt(value);
  if (key === 'providers') options.providers = value.split(',');
  if (key === 'strategies') options.strategies = value.split(',');
  if (key === 'output') options.outputDir = value;
}

const evaluator = new AutoEvaluator(corpusPath, options);
evaluator.run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
