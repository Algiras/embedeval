#!/usr/bin/env node

/**
 * Demo Evaluation Script
 * Shows how EmbedEval works with sample data
 */

const fs = require('fs');
const path = require('path');

// Load sample data
const queriesPath = path.join(__dirname, '..', 'examples', 'sample-queries.jsonl');
const corpusPath = path.join(__dirname, '..', 'examples', 'sample-corpus.jsonl');

console.log('🔬 EmbedEval Demo Evaluation\n');
console.log('===========================\n');

// Check if files exist
if (!fs.existsSync(queriesPath)) {
  console.error('❌ Sample queries file not found:', queriesPath);
  process.exit(1);
}

if (!fs.existsSync(corpusPath)) {
  console.error('❌ Sample corpus file not found:', corpusPath);
  process.exit(1);
}

// Load data
const queries = fs.readFileSync(queriesPath, 'utf-8')
  .trim()
  .split('\n')
  .map(line => JSON.parse(line));

const corpus = fs.readFileSync(corpusPath, 'utf-8')
  .trim()
  .split('\n')
  .map(line => JSON.parse(line));

console.log(`📊 Dataset Statistics:`);
console.log(`   Queries: ${queries.length}`);
console.log(`   Documents: ${corpus.length}\n`);

// Show sample queries
console.log('📝 Sample Queries:');
queries.forEach((q, i) => {
  console.log(`   ${i + 1}. "${q.query}"`);
  console.log(`      Relevant docs: ${q.relevantDocs.join(', ')}`);
});

console.log('\n📚 Sample Documents:');
corpus.slice(0, 3).forEach((doc, i) => {
  console.log(`   ${i + 1}. ${doc.id}: "${doc.content.substring(0, 60)}..."`);
});

console.log('\n🎯 Expected Evaluation Flow:');
console.log('   1. Load queries and corpus');
console.log('   2. For each query:');
console.log('      - Generate embedding for query');
console.log('      - Generate embeddings for all documents');
console.log('      - Calculate cosine similarity');
console.log('      - Rank documents by similarity');
console.log('      - Check if relevant docs are in top-k');
console.log('   3. Calculate metrics (NDCG, Recall, MRR, MAP)');
console.log('   4. Compare results across different models/strategies\n');

console.log('🔍 Comparison Scenarios:');
console.log('   Scenario 1: Baseline (no chunking)');
console.log('   Scenario 2: Fixed-size chunks (512 chars)');
console.log('   Scenario 3: Semantic chunks (paragraph-based)');
console.log('   Scenario 4: Hybrid BM25 + Embeddings\n');

console.log('📈 Expected Results:');
console.log('   Query: "What is machine learning?"');
console.log('   Relevant: doc1, doc2');
console.log('   ');
console.log('   Baseline Strategy:');
console.log('     Top 3: doc1 (0.95), doc2 (0.92), doc3 (0.45)');
console.log('     Recall@3: 1.0 (both relevant docs found)');
console.log('     NDCG@3: 0.98');
console.log('   ');
console.log('   With Chunking:');
console.log('     Top 3: doc1-chunk1 (0.97), doc2-chunk1 (0.94), doc1-chunk2 (0.89)');
console.log('     Recall@3: 1.0');
console.log('     NDCG@3: 0.99 (slightly better with chunks)\n');

console.log('✨ To run actual evaluation:');
console.log('   1. Start Ollama: ollama serve');
console.log('   2. Pull model: ollama pull nomic-embed-text');
console.log('   3. Start Redis: ./docker/redis.sh start');
console.log('   4. Run eval:');
console.log('      npm run dev -- ab-test');
console.log('        --variants ollama:nomic-embed-text');
console.log('        --strategies baseline,fixed-chunks');
console.log('        --dataset ./examples/sample-queries.jsonl');
console.log('        --corpus ./examples/sample-corpus.jsonl\n');

console.log('🔍 To search HuggingFace models:');
console.log('   npm run dev -- huggingface --search "sentence-transformers"\n');

console.log('✅ Demo complete!');
