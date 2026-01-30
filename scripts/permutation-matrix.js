#!/usr/bin/env node
/**
 * Permutation Matrix Evaluator
 * Tests ALL combinations and generates a ranked report
 * No evolution, no randomness - just systematic evaluation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

class PermutationMatrix {
  constructor(config) {
    this.config = config;
    this.results = [];
    this.permutations = this.generatePermutations();
  }

  generatePermutations() {
    // Define all options
    const providers = [
      { type: 'ollama', model: 'nomic-embed-text', name: 'Ollama Local' },
      { type: 'openai', model: 'text-embedding-3-small', name: 'OpenAI Small' },
      { type: 'openai', model: 'text-embedding-3-large', name: 'OpenAI Large' },
      { type: 'google', model: 'text-embedding-004', name: 'Gemini' },
      { type: 'huggingface', model: 'sentence-transformers/all-MiniLM-L6-v2', name: 'MiniLM' }
    ];

    const strategies = [
      { id: 'baseline', name: 'Baseline', description: 'Simple embedding + cosine similarity' },
      { id: 'semantic-chunks', name: 'Semantic Chunks', description: 'Intelligent document chunking' },
      { id: 'fixed-chunks', name: 'Fixed Chunks', description: 'Fixed-size chunking' },
      { id: 'hybrid-bm25', name: 'Hybrid BM25', description: 'Embeddings + keyword matching' },
      { id: 'mmr-diversity', name: 'MMR Diversity', description: 'Maximum marginal relevance' }
    ];

    const chunkSizes = [256, 512, 1024];
    const overlaps = [0, 50, 128];

    // Generate all permutations
    const permutations = [];
    
    for (const provider of providers) {
      for (const strategy of strategies) {
        // Only add chunking params for chunking strategies
        if (strategy.id.includes('chunks')) {
          for (const size of chunkSizes) {
            for (const overlap of overlaps) {
              if (overlap < size) { // Sanity check
                permutations.push({
                  provider,
                  strategy,
                  chunking: { size, overlap },
                  id: `${provider.type}-${strategy.id}-${size}-${overlap}`
                });
              }
            }
          }
        } else {
          permutations.push({
            provider,
            strategy,
            chunking: null,
            id: `${provider.type}-${strategy.id}`
          });
        }
      }
    }

    return permutations;
  }

  async evaluateAll() {
    console.log(`🔬 Testing ${this.permutations.length} permutations...\n`);
    
    for (let i = 0; i < this.permutations.length; i++) {
      const perm = this.permutations[i];
      
      console.log(`[${i + 1}/${this.permutations.length}] Testing: ${perm.provider.name} + ${perm.strategy.name}`);
      
      try {
        const result = await this.evaluatePermutation(perm);
        this.results.push(result);
        
        // Show interim result
        console.log(`  ✅ NDCG: ${result.metrics.ndcg.toFixed(3)} | Latency: ${result.metrics.latency.toFixed(0)}ms | Cost: $${result.metrics.cost.toFixed(4)}`);
        
      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}`);
        this.results.push({
          ...perm,
          metrics: { ndcg: 0, recall: 0, latency: 0, cost: 0, failed: true },
          error: error.message
        });
      }
    }
    
    // Sort by NDCG
    this.results.sort((a, b) => b.metrics.ndcg - a.metrics.ndcg);
    
    console.log('\n✅ All permutations evaluated!\n');
  }

  async evaluatePermutation(perm) {
    // Create config
    const config = {
      test: {
        name: `Permutation Test: ${perm.provider.name} + ${perm.strategy.name}`,
        id: perm.id
      },
      variants: [{
        id: perm.id,
        name: perm.id,
        provider: {
          type: perm.provider.type,
          model: perm.provider.model
        },
        strategy: perm.strategy.id,
        ...(perm.chunking && {
          chunking: {
            size: perm.chunking.size,
            overlap: perm.chunking.overlap
          }
        })
      }],
      dataset: this.config.dataset,
      corpus: this.config.corpus,
      metrics: ['ndcg@10', 'recall@10', 'mrr@10'],
      output: {
        json: `./results/permutations/${perm.id}/metrics.json`
      }
    };

    // Write temp config
    const configPath = `/tmp/permutation-${perm.id}.yaml`;
    fs.writeFileSync(configPath, yaml.stringify(config));

    // Run evaluation
    const outputDir = `./results/permutations/${perm.id}`;
    execSync(`embedeval ab-test --config ${configPath} --output ${outputDir}`, {
      encoding: 'utf-8',
      timeout: 300000 // 5 minute timeout per permutation
    });

    // Read results
    const resultsPath = `${outputDir}/metrics.json`;
    if (!fs.existsSync(resultsPath)) {
      throw new Error('No results generated');
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    const variant = results.variants[0];

    // Calculate cost (simplified)
    const costPerQuery = this.estimateCost(perm.provider);
    
    return {
      ...perm,
      metrics: {
        ndcg: variant.metrics.ndcg || 0,
        recall: variant.metrics.recall || 0,
        mrr: variant.metrics.mrr || 0,
        latency: variant.usage.avgLatency || 0,
        cost: costPerQuery
      }
    };
  }

  estimateCost(provider) {
    // Rough cost estimates per query
    const costs = {
      'ollama': 0,
      'openai': { 'text-embedding-3-small': 0.00002, 'text-embedding-3-large': 0.00013 },
      'google': 0.000025,
      'huggingface': 0
    };
    
    if (provider.type === 'openai') {
      return costs.openai[provider.model] || 0.00002;
    }
    return costs[provider.type] || 0;
  }

  generateReport() {
    const report = {
      summary: {
        totalPermutations: this.permutations.length,
        successful: this.results.filter(r => !r.metrics.failed).length,
        failed: this.results.filter(r => r.metrics.failed).length,
        dataset: this.config.dataset,
        corpus: this.config.corpus,
        generatedAt: new Date().toISOString()
      },
      top10: this.results.slice(0, 10).map((r, i) => ({
        rank: i + 1,
        id: r.id,
        provider: r.provider.name,
        strategy: r.strategy.name,
        chunking: r.chunking,
        metrics: r.metrics,
        recommendation: i === 0 ? '🏆 BEST OVERALL' : 
                       i < 3 ? '✅ Top Tier' : 
                       i < 5 ? '👍 Good Alternative' : '⚖️ Trade-off Option'
      })),
      byCategory: {
        bestQuality: this.getBestByMetric('ndcg'),
        fastest: this.getBestByMetric('latency', true), // true = ascending
        cheapest: this.getBestByMetric('cost', true),
        bestValue: this.getBestValue()
      },
      fullResults: this.results.map((r, i) => ({
        rank: i + 1,
        ...r
      }))
    };

    return report;
  }

  getBestByMetric(metric, ascending = false) {
    const sorted = [...this.results]
      .filter(r => !r.metrics.failed)
      .sort((a, b) => ascending ? 
        a.metrics[metric] - b.metrics[metric] : 
        b.metrics[metric] - a.metrics[metric]
      );
    return sorted[0];
  }

  getBestValue() {
    // Best NDCG per dollar (for paid providers) or just best NDCG (for free)
    return this.results
      .filter(r => !r.metrics.failed)
      .map(r => ({
        ...r,
        value: r.metrics.cost > 0 ? 
          r.metrics.ndcg / (r.metrics.cost * 1000) : // NDCG per $1k queries
          r.metrics.ndcg // Just NDCG for free providers
      }))
      .sort((a, b) => b.value - a.value)[0];
  }

  printReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('PERMUTATION MATRIX EVALUATION REPORT');
    console.log('='.repeat(80));
    console.log('');
    console.log(`Dataset: ${report.summary.dataset}`);
    console.log(`Corpus: ${report.summary.corpus}`);
    console.log(`Total Permutations Tested: ${report.summary.totalPermutations}`);
    console.log(`Successful: ${report.summary.successful} | Failed: ${report.summary.failed}`);
    console.log('');
    
    console.log('🏆 TOP 10 CONFIGURATIONS');
    console.log('-'.repeat(80));
    report.top10.forEach(r => {
      console.log(`\n#${r.rank} ${r.recommendation}`);
      console.log(`   Provider: ${r.provider}`);
      console.log(`   Strategy: ${r.strategy}`);
      if (r.chunking) {
        console.log(`   Chunking: ${r.chunking.size} tokens / ${r.chunking.overlap} overlap`);
      }
      console.log(`   📊 NDCG@10: ${r.metrics.ndcg.toFixed(3)} | Recall: ${r.metrics.recall.toFixed(3)} | MRR: ${r.metrics.mrr.toFixed(3)}`);
      console.log(`   ⚡ Latency: ${r.metrics.latency.toFixed(0)}ms | 💰 Cost: $${r.metrics.cost.toFixed(4)}/query`);
    });

    console.log('\n');
    console.log('📊 CATEGORY WINNERS');
    console.log('-'.repeat(80));
    
    const bq = report.byCategory.bestQuality;
    console.log(`\n🎯 Best Quality: ${bq.provider.name} + ${bq.strategy.name}`);
    console.log(`   NDCG@10: ${bq.metrics.ndcg.toFixed(3)}`);
    
    const bf = report.byCategory.fastest;
    console.log(`\n⚡ Fastest: ${bf.provider.name} + ${bf.strategy.name}`);
    console.log(`   Latency: ${bf.metrics.latency.toFixed(0)}ms`);
    
    const bc = report.byCategory.cheapest;
    console.log(`\n💰 Cheapest: ${bc.provider.name} + ${bc.strategy.name}`);
    console.log(`   Cost: $${bc.metrics.cost.toFixed(4)}/query`);
    
    const bv = report.byCategory.bestValue;
    console.log(`\n🏅 Best Value: ${bv.provider.name} + ${bv.strategy.name}`);
    console.log(`   NDCG@10: ${bv.metrics.ndcg.toFixed(3)} | Cost: $${bv.metrics.cost.toFixed(4)}/query`);
    if (bv.metrics.cost > 0) {
      console.log(`   Value: ${(bv.metrics.ndcg / (bv.metrics.cost * 1000)).toFixed(2)} NDCG per $1k queries`);
    }

    console.log('\n');
    console.log('💡 RECOMMENDATIONS FOR YOUR DATA');
    console.log('-'.repeat(80));
    console.log('');
    
    const winner = report.top10[0];
    console.log(`For your specific dataset, the OPTIMAL configuration is:`);
    console.log('');
    console.log(`  ${winner.provider} + ${winner.strategy}`);
    if (winner.chunking) {
      console.log(`  Chunk size: ${winner.chunking.size}, Overlap: ${winner.chunking.overlap}`);
    }
    console.log('');
    console.log(`Expected Performance:`);
    console.log(`  • NDCG@10: ${winner.metrics.ndcg.toFixed(3)} (${(winner.metrics.ndcg * 100).toFixed(1)}% quality)`);
    console.log(`  • Recall@10: ${winner.metrics.recall.toFixed(3)} (${(winner.metrics.recall * 100).toFixed(1)}% coverage)`);
    console.log(`  • Latency: ${winner.metrics.latency.toFixed(0)}ms per query`);
    console.log(`  • Cost: $${winner.metrics.cost.toFixed(4)} per query`);
    console.log('');
    console.log(`Configuration ID: ${winner.id}`);
    console.log('');
    console.log('Next steps:');
    console.log(`  1. Deploy this configuration: embedeval deploy --permutation ${winner.id}`);
    console.log(`  2. Full report saved to: ./results/permutation-report.json`);
    console.log(`  3. View all results: ./results/permutations/`);
    console.log('');
    console.log('='.repeat(80));
  }

  saveReport(report) {
    const reportPath = './results/permutation-report.json';
    fs.mkdirSync('./results', { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Also save as CSV for easy analysis
    const csvPath = './results/permutation-results.csv';
    const csv = [
      'rank,id,provider,strategy,chunk_size,chunk_overlap,ndcg,recall,mrr,latency,cost',
      ...report.fullResults.map(r => 
        `${r.rank},${r.id},${r.provider?.name || 'N/A'},${r.strategy?.name || 'N/A'},${r.chunking?.size || ''},${r.chunking?.overlap || ''},${r.metrics.ndcg},${r.metrics.recall},${r.metrics.mrr},${r.metrics.latency},${r.metrics.cost}`
      )
    ].join('\n');
    fs.writeFileSync(csvPath, csv);
    
    console.log(`\n📄 Reports saved:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   CSV: ${csvPath}`);
  }
}

// CLI usage
if (require.main === module) {
  const config = {
    dataset: process.argv[2] || './data/queries.jsonl',
    corpus: process.argv[3] || './data/corpus.jsonl'
  };

  const evaluator = new PermutationMatrix(config);
  
  evaluator.evaluateAll().then(() => {
    const report = evaluator.generateReport();
    evaluator.printReport(report);
    evaluator.saveReport(report);
    
    console.log('\n✨ Permutation matrix complete!');
    console.log(`Tested ${report.summary.totalPermutations} configurations on your data.`);
    console.log('The best configuration for YOUR specific use case is shown above.\n');
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

module.exports = PermutationMatrix;
