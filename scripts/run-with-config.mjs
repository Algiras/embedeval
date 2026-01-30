#!/usr/bin/env node

/**
 * User-Configurable Evolution Runner
 * 
 * Reads user's config file, tries all permutations, and provides
 * personalized recommendations based on their constraints.
 * 
 * Usage:
 *   node scripts/run-with-config.mjs [config-file]
 *   node scripts/run-with-config.mjs ./my-config.yaml
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Simple YAML parser for our config format (no external dependency)
function parseYaml(content) {
  const result = {};
  const lines = content.split('\n');
  const stack = [{ indent: -1, obj: result }];
  
  for (let line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') continue;
    
    const indent = line.search(/\S/);
    const trimmed = line.trim();
    
    // Pop stack to find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    
    const parent = stack[stack.length - 1].obj;
    
    // Handle list items
    if (trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim();
      if (!Array.isArray(parent)) {
        // Find the key that should be an array
        const keys = Object.keys(parent);
        const lastKey = keys[keys.length - 1];
        if (parent[lastKey] === null || parent[lastKey] === undefined) {
          parent[lastKey] = [];
        }
        if (Array.isArray(parent[lastKey])) {
          parent[lastKey].push(parseValue(value));
        }
      } else {
        parent.push(parseValue(value));
      }
      continue;
    }
    
    // Handle key: value pairs
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      const valueStr = trimmed.slice(colonIdx + 1).trim();
      
      if (valueStr === '' || valueStr.startsWith('#')) {
        // Nested object or array coming
        parent[key] = {};
        stack.push({ indent, obj: parent[key] });
      } else {
        parent[key] = parseValue(valueStr);
      }
    }
  }
  
  return result;
}

function parseValue(str) {
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'null') return null;
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  if (/^-?\d*\.\d+$/.test(str)) return parseFloat(str);
  // Remove quotes if present
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  // Remove inline comments
  const commentIdx = str.indexOf('#');
  if (commentIdx > 0) {
    return str.slice(0, commentIdx).trim();
  }
  return str;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG = {
  models: {
    ollama: {
      enabled: true,
      models: ['nomic-embed-text', 'mxbai-embed-large'],
    },
  },
  enhancements: {
    query: ['none', 'hyde'],
    retrieval: ['cosine', 'hybrid_rrf'],
    reranking: ['none', 'cross_encoder_small', 'mmr'],
    chunking: ['none', 'parent_child'],
    multi_stage: ['none', 'two_stage'],
  },
  constraints: {
    max_cost_per_query: 0,
    max_latency_ms: 1000,
    local_only: true,
    min_accuracy: 0,
  },
  evolution: {
    generations: 10,
    population_size: 20,
    elite_count: 3,
    mutation_rate: 0.25,
    exhaustive_first: true,
    max_combinations: 500,
  },
  output: {
    dir: './results',
    html_report: true,
    save_all_configs: true,
    recommendations: {
      top_k: 5,
      show_tradeoffs: true,
      explain_why: true,
    },
  },
};

// =============================================================================
// ENHANCEMENT METADATA
// =============================================================================

const ENHANCEMENT_INFO = {
  query: {
    none: { cost: 0, latency: 0, boost: 0, description: 'Raw query, no processing' },
    lowercase: { cost: 0, latency: 1, boost: 0.02, description: 'Simple lowercase normalization' },
    expand_synonyms: { cost: 0, latency: 5, boost: 0.05, description: 'Add synonym terms from dictionary' },
    expand_llm: { cost: 0.001, latency: 200, boost: 0.12, description: 'Use LLM to expand query' },
    hyde: { cost: 0.002, latency: 300, boost: 0.18, description: 'Generate hypothetical document to embed' },
    hyde_multi: { cost: 0.005, latency: 500, boost: 0.22, description: 'Generate multiple hypothetical docs' },
    step_back: { cost: 0.001, latency: 200, boost: 0.10, description: 'Ask a more general question first' },
    multi_query: { cost: 0.003, latency: 400, boost: 0.15, description: 'Generate multiple query variants' },
  },
  retrieval: {
    cosine: { cost: 0, latency: 10, boost: 0, description: 'Standard cosine similarity' },
    dot: { cost: 0, latency: 10, boost: 0.01, description: 'Dot product similarity' },
    bm25_only: { cost: 0, latency: 5, boost: -0.05, description: 'BM25 lexical search only' },
    hybrid_linear: { cost: 0, latency: 15, boost: 0.08, description: 'Linear blend of dense + BM25' },
    hybrid_rrf: { cost: 0, latency: 15, boost: 0.12, description: 'Reciprocal Rank Fusion (recommended)' },
    hybrid_convex: { cost: 0, latency: 15, boost: 0.10, description: 'Convex combination' },
    late_interaction: { cost: 0.0005, latency: 50, boost: 0.15, description: 'ColBERT-style token matching' },
  },
  reranking: {
    none: { cost: 0, latency: 0, boost: 0, description: 'No reranking' },
    bm25_rerank: { cost: 0, latency: 5, boost: 0.05, description: 'Rerank by BM25 score' },
    mmr: { cost: 0, latency: 10, boost: 0.08, description: 'Maximal Marginal Relevance for diversity' },
    cross_encoder_small: { cost: 0, latency: 100, boost: 0.18, description: 'Local cross-encoder (MiniLM)' },
    cross_encoder_large: { cost: 0, latency: 200, boost: 0.25, description: 'Local cross-encoder (BGE-large)' },
    llm_pointwise: { cost: 0.005, latency: 500, boost: 0.20, description: 'LLM scores each result' },
    llm_pairwise: { cost: 0.01, latency: 800, boost: 0.25, description: 'LLM compares result pairs' },
    llm_listwise: { cost: 0.008, latency: 600, boost: 0.30, description: 'LLM ranks entire list at once' },
    cohere_rerank: { cost: 0.002, latency: 150, boost: 0.28, description: 'Cohere Rerank API' },
    jina_rerank: { cost: 0.0015, latency: 120, boost: 0.26, description: 'Jina Reranker API' },
    cascade: { cost: 0.003, latency: 250, boost: 0.32, description: 'Fast filter then accurate rerank' },
  },
  chunking: {
    none: { cost: 0, latency: 0, boost: 0, description: 'Full documents, no chunking' },
    fixed_256: { cost: 0, latency: 0, boost: 0.03, description: '256 token fixed chunks' },
    fixed_512: { cost: 0, latency: 0, boost: 0.05, description: '512 token fixed chunks' },
    semantic: { cost: 0.001, latency: 50, boost: 0.10, description: 'Semantic boundary detection' },
    sentence: { cost: 0, latency: 5, boost: 0.06, description: 'Sentence-level chunks' },
    paragraph: { cost: 0, latency: 5, boost: 0.07, description: 'Paragraph-level chunks' },
    parent_child: { cost: 0, latency: 10, boost: 0.12, description: 'Small chunks, return parent context' },
    sliding_window: { cost: 0, latency: 5, boost: 0.08, description: 'Overlapping window chunks' },
  },
  multi_stage: {
    none: { cost: 0, latency: 0, boost: 0, stages: 1, description: 'Single retrieval stage' },
    two_stage: { cost: 0, latency: 50, boost: 0.10, stages: 2, description: 'Retrieve k1 → rerank → k2' },
    three_stage: { cost: 0.001, latency: 100, boost: 0.15, stages: 3, description: 'k1 → filter → k2 → verify' },
    iterative: { cost: 0.002, latency: 200, boost: 0.18, stages: 3, description: 'Iterative refinement' },
  },
};

const MODEL_INFO = {
  ollama: {
    'nomic-embed-text': { cost: 0, latency: 50, quality: 0.58, dims: 768 },
    'mxbai-embed-large': { cost: 0, latency: 80, quality: 0.60, dims: 1024 },
    'all-minilm': { cost: 0, latency: 30, quality: 0.52, dims: 384 },
    'snowflake-arctic-embed': { cost: 0, latency: 60, quality: 0.62, dims: 768 },
  },
  openai: {
    'text-embedding-3-small': { cost: 0.00002, latency: 200, quality: 0.68, dims: 1536 },
    'text-embedding-3-large': { cost: 0.00013, latency: 250, quality: 0.72, dims: 3072 },
    'text-embedding-ada-002': { cost: 0.0001, latency: 200, quality: 0.65, dims: 1536 },
  },
  gemini: {
    'text-embedding-004': { cost: 0.000025, latency: 150, quality: 0.70, dims: 768 },
    'embedding-001': { cost: 0.000025, latency: 150, quality: 0.65, dims: 768 },
  },
  cohere: {
    'embed-english-v3.0': { cost: 0.0001, latency: 180, quality: 0.71, dims: 1024 },
    'embed-multilingual-v3.0': { cost: 0.0001, latency: 180, quality: 0.69, dims: 1024 },
  },
  voyage: {
    'voyage-2': { cost: 0.0001, latency: 200, quality: 0.70, dims: 1024 },
    'voyage-large-2': { cost: 0.00012, latency: 250, quality: 0.73, dims: 1536 },
    'voyage-code-2': { cost: 0.00012, latency: 200, quality: 0.68, dims: 1536 },
  },
  huggingface: {
    'BAAI/bge-small-en-v1.5': { cost: 0, latency: 40, quality: 0.56, dims: 384 },
    'BAAI/bge-large-en-v1.5': { cost: 0, latency: 100, quality: 0.64, dims: 1024 },
    'sentence-transformers/all-MiniLM-L6-v2': { cost: 0, latency: 30, quality: 0.50, dims: 384 },
  },
};

// =============================================================================
// LOAD CONFIG
// =============================================================================

async function loadConfig(configPath) {
  const defaultJsonPath = path.join(ROOT, 'config', 'evolution-config.json');
  const exampleJsonPath = path.join(ROOT, 'config', 'evolution-config.example.json');
  
  let configFile = configPath;
  
  if (!configFile) {
    // Try default locations (JSON preferred)
    try {
      await fs.access(defaultJsonPath);
      configFile = defaultJsonPath;
    } catch {
      try {
        await fs.access(exampleJsonPath);
        configFile = exampleJsonPath;
        console.log('⚠️  Using example config. Copy to evolution-config.json for customization.\n');
      } catch {
        console.log('📝 No config found, using defaults.\n');
        return DEFAULT_CONFIG;
      }
    }
  }
  
  console.log(`📋 Loading config from: ${configFile}\n`);
  
  const content = await fs.readFile(configFile, 'utf-8');
  
  // Parse based on file extension
  let userConfig;
  if (configFile.endsWith('.json')) {
    userConfig = JSON.parse(content);
  } else {
    // YAML - use simple parser for basic configs
    userConfig = parseYaml(content);
  }
  
  // Merge with defaults
  return deepMerge(DEFAULT_CONFIG, userConfig);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// =============================================================================
// GENERATE ALL COMBINATIONS
// =============================================================================

function* generateCombinations(config) {
  // Get enabled models
  const models = [];
  for (const [provider, providerConfig] of Object.entries(config.models)) {
    if (providerConfig.enabled) {
      for (const model of providerConfig.models) {
        models.push({ provider, model });
      }
    }
  }
  
  if (models.length === 0) {
    console.error('❌ No models enabled in config!');
    process.exit(1);
  }
  
  const enhancements = config.enhancements;
  
  // Generate all combinations
  for (const modelConfig of models) {
    for (const query of enhancements.query || ['none']) {
      for (const retrieval of enhancements.retrieval || ['cosine']) {
        for (const reranking of enhancements.reranking || ['none']) {
          for (const chunking of enhancements.chunking || ['none']) {
            for (const multiStage of enhancements.multi_stage || ['none']) {
              yield {
                id: crypto.randomUUID(),
                model: modelConfig,
                query,
                retrieval,
                reranking,
                chunking,
                multiStage,
              };
            }
          }
        }
      }
    }
  }
}

function countCombinations(config) {
  let count = 0;
  for (const _ of generateCombinations(config)) {
    count++;
  }
  return count;
}

// =============================================================================
// EVALUATE CONFIGURATION
// =============================================================================

function evaluateConfig(combo, constraints) {
  const { model, query, retrieval, reranking, chunking, multiStage } = combo;
  
  // Get base model info
  const modelInfo = MODEL_INFO[model.provider]?.[model.model] || {
    cost: 0, latency: 50, quality: 0.55, dims: 768
  };
  
  // Calculate totals
  let totalCost = modelInfo.cost;
  let totalLatency = modelInfo.latency;
  let totalBoost = 0;
  
  // Add enhancement costs and boosts
  const enhancements = [
    { layer: 'query', value: query },
    { layer: 'retrieval', value: retrieval },
    { layer: 'reranking', value: reranking },
    { layer: 'chunking', value: chunking },
    { layer: 'multi_stage', value: multiStage },
  ];
  
  for (const { layer, value } of enhancements) {
    const info = ENHANCEMENT_INFO[layer]?.[value];
    if (info) {
      totalCost += info.cost;
      totalLatency += info.latency;
      // Diminishing returns on boosts
      const diminishing = 1 / (1 + totalBoost);
      totalBoost += info.boost * diminishing;
    }
  }
  
  // Synergy bonuses
  if (query === 'hyde' && reranking.includes('cross_encoder')) {
    totalBoost += 0.05;
  }
  if (retrieval === 'hybrid_rrf' && multiStage !== 'none') {
    totalBoost += 0.04;
  }
  if (chunking === 'parent_child' && reranking !== 'none') {
    totalBoost += 0.03;
  }
  
  // Calculate quality score
  const maxBoost = 0.40;
  const effectiveBoost = Math.min(totalBoost, maxBoost);
  const qualityScore = Math.min(0.95, modelInfo.quality * (1 + effectiveBoost));
  
  // Check constraints
  const meetsConstraints = 
    totalCost <= constraints.max_cost_per_query &&
    totalLatency <= constraints.max_latency_ms &&
    qualityScore >= constraints.min_accuracy &&
    (!constraints.local_only || totalCost === 0);
  
  return {
    ...combo,
    metrics: {
      quality: qualityScore,
      cost: totalCost,
      latency: totalLatency,
      boost: effectiveBoost,
    },
    meetsConstraints,
  };
}

// =============================================================================
// GENERATE RECOMMENDATIONS
// =============================================================================

function generateRecommendations(results, config) {
  const { recommendations } = config.output;
  const validResults = results.filter(r => r.meetsConstraints);
  
  // Sort by quality (primary), then by cost (secondary)
  validResults.sort((a, b) => {
    if (Math.abs(a.metrics.quality - b.metrics.quality) > 0.01) {
      return b.metrics.quality - a.metrics.quality;
    }
    return a.metrics.cost - b.metrics.cost;
  });
  
  // Get top configs
  const topConfigs = validResults.slice(0, recommendations.top_k);
  
  // Find best for different criteria
  const bestQuality = validResults.reduce((a, b) => 
    b.metrics.quality > a.metrics.quality ? b : a, validResults[0]);
  
  const bestSpeed = validResults.reduce((a, b) => 
    b.metrics.latency < a.metrics.latency ? b : a, validResults[0]);
  
  const bestCost = validResults.filter(r => r.metrics.cost === 0)
    .reduce((a, b) => b.metrics.quality > a.metrics.quality ? b : a, 
      validResults.filter(r => r.metrics.cost === 0)[0] || validResults[0]);
  
  const bestBalanced = validResults.reduce((a, b) => {
    const scoreA = a.metrics.quality * 0.5 + (1 - a.metrics.latency / 1000) * 0.3 + (1 - a.metrics.cost * 100) * 0.2;
    const scoreB = b.metrics.quality * 0.5 + (1 - b.metrics.latency / 1000) * 0.3 + (1 - b.metrics.cost * 100) * 0.2;
    return scoreB > scoreA ? b : a;
  }, validResults[0]);
  
  return {
    topConfigs,
    bestFor: {
      quality: bestQuality,
      speed: bestSpeed,
      cost: bestCost,
      balanced: bestBalanced,
    },
    totalTested: results.length,
    validCount: validResults.length,
    invalidCount: results.length - validResults.length,
  };
}

function explainConfig(config) {
  const reasons = [];
  const { model, query, retrieval, reranking, chunking, multiStage } = config;
  
  // Model reasoning
  const modelInfo = MODEL_INFO[model.provider]?.[model.model];
  if (modelInfo) {
    if (modelInfo.cost === 0) {
      reasons.push(`✅ Free model (${model.provider}/${model.model})`);
    } else {
      reasons.push(`💰 Paid model with ${(modelInfo.quality * 100).toFixed(0)}% base quality`);
    }
  }
  
  // Enhancement reasoning
  if (query !== 'none') {
    const info = ENHANCEMENT_INFO.query[query];
    reasons.push(`🔍 Query: ${info?.description || query} (+${((info?.boost || 0) * 100).toFixed(0)}%)`);
  }
  
  if (retrieval !== 'cosine') {
    const info = ENHANCEMENT_INFO.retrieval[retrieval];
    reasons.push(`📊 Retrieval: ${info?.description || retrieval} (+${((info?.boost || 0) * 100).toFixed(0)}%)`);
  }
  
  if (reranking !== 'none') {
    const info = ENHANCEMENT_INFO.reranking[reranking];
    reasons.push(`🔄 Reranking: ${info?.description || reranking} (+${((info?.boost || 0) * 100).toFixed(0)}%)`);
  }
  
  if (chunking !== 'none') {
    const info = ENHANCEMENT_INFO.chunking[chunking];
    reasons.push(`📄 Chunking: ${info?.description || chunking}`);
  }
  
  if (multiStage !== 'none') {
    const info = ENHANCEMENT_INFO.multi_stage[multiStage];
    reasons.push(`🔢 Multi-stage: ${info?.description || multiStage}`);
  }
  
  return reasons;
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

function formatConfig(config) {
  const parts = [
    config.model.model,
  ];
  if (config.query !== 'none') parts.push(config.query);
  if (config.retrieval !== 'cosine') parts.push(config.retrieval);
  if (config.reranking !== 'none') parts.push(`→${config.reranking.split('_')[0]}`);
  if (config.multiStage !== 'none') parts.push(`(${config.multiStage})`);
  
  return parts.join(' + ');
}

function displayResults(recommendations, config) {
  const { topConfigs, bestFor, totalTested, validCount, invalidCount } = recommendations;
  
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    YOUR PERSONALIZED RECOMMENDATIONS                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  
  console.log(`\n📊 Tested ${totalTested} configurations`);
  console.log(`   ✅ ${validCount} meet your constraints`);
  console.log(`   ❌ ${invalidCount} filtered out (cost/latency/quality constraints)`);
  
  // Best for each criterion
  console.log('\n🏆 BEST FOR EACH CRITERION:\n');
  
  if (bestFor.quality) {
    console.log('   📈 BEST QUALITY:');
    console.log(`      Config: ${formatConfig(bestFor.quality)}`);
    console.log(`      Score: ${(bestFor.quality.metrics.quality * 100).toFixed(1)}%`);
    console.log(`      Cost: $${bestFor.quality.metrics.cost.toFixed(5)}/query | Latency: ${bestFor.quality.metrics.latency}ms`);
  }
  
  if (bestFor.speed && bestFor.speed !== bestFor.quality) {
    console.log('\n   ⚡ FASTEST:');
    console.log(`      Config: ${formatConfig(bestFor.speed)}`);
    console.log(`      Latency: ${bestFor.speed.metrics.latency}ms`);
    console.log(`      Score: ${(bestFor.speed.metrics.quality * 100).toFixed(1)}%`);
  }
  
  if (bestFor.cost && bestFor.cost !== bestFor.quality) {
    console.log('\n   💰 BEST FREE:');
    console.log(`      Config: ${formatConfig(bestFor.cost)}`);
    console.log(`      Score: ${(bestFor.cost.metrics.quality * 100).toFixed(1)}%`);
    console.log(`      Cost: $0.00 (completely free)`);
  }
  
  if (bestFor.balanced && bestFor.balanced !== bestFor.quality) {
    console.log('\n   ⚖️  BEST BALANCED:');
    console.log(`      Config: ${formatConfig(bestFor.balanced)}`);
    console.log(`      Score: ${(bestFor.balanced.metrics.quality * 100).toFixed(1)}% | Latency: ${bestFor.balanced.metrics.latency}ms | Cost: $${bestFor.balanced.metrics.cost.toFixed(5)}`);
  }
  
  // Top configs with explanations
  console.log('\n\n📋 TOP CONFIGURATIONS:\n');
  
  for (let i = 0; i < topConfigs.length; i++) {
    const cfg = topConfigs[i];
    console.log(`   ${i + 1}. ${formatConfig(cfg)}`);
    console.log(`      Quality: ${(cfg.metrics.quality * 100).toFixed(1)}% | Latency: ${cfg.metrics.latency}ms | Cost: $${cfg.metrics.cost.toFixed(5)}/query`);
    
    if (config.output.recommendations.explain_why) {
      const reasons = explainConfig(cfg);
      for (const reason of reasons.slice(0, 3)) {
        console.log(`      ${reason}`);
      }
    }
    console.log('');
  }
  
  // Show what options are available
  console.log('\n📝 YOUR OPTIONS SUMMARY:\n');
  
  console.log('   Models enabled:');
  for (const [provider, providerConfig] of Object.entries(config.models)) {
    if (providerConfig.enabled) {
      console.log(`     • ${provider}: ${providerConfig.models.join(', ')}`);
    }
  }
  
  console.log('\n   Enhancements enabled:');
  for (const [layer, values] of Object.entries(config.enhancements)) {
    console.log(`     • ${layer}: ${values.join(', ')}`);
  }
  
  console.log('\n   Your constraints:');
  console.log(`     • Max cost: $${config.constraints.max_cost_per_query}/query`);
  console.log(`     • Max latency: ${config.constraints.max_latency_ms}ms`);
  console.log(`     • Local only: ${config.constraints.local_only}`);
  console.log(`     • Min accuracy: ${(config.constraints.min_accuracy * 100).toFixed(0)}%`);
  
  // Suggestions for improvement
  console.log('\n\n💡 SUGGESTIONS TO IMPROVE:\n');
  
  const suggestions = [];
  
  // Check if reranking is being used
  if (!config.enhancements.reranking?.some(r => r.includes('cross_encoder'))) {
    suggestions.push('Add cross_encoder_large to reranking - biggest quality boost (+25%)');
  }
  
  // Check if hybrid retrieval is enabled
  if (!config.enhancements.retrieval?.includes('hybrid_rrf')) {
    suggestions.push('Enable hybrid_rrf retrieval - combines dense + BM25 for better results');
  }
  
  // Check if multi-stage is enabled
  if (!config.enhancements.multi_stage?.includes('two_stage')) {
    suggestions.push('Try two_stage retrieval - over-fetch then rerank for better precision');
  }
  
  // Check if HyDE is enabled
  if (!config.enhancements.query?.includes('hyde')) {
    suggestions.push('Add hyde query enhancement - generates hypothetical docs for better matching');
  }
  
  // Check model variety
  const enabledProviders = Object.entries(config.models).filter(([_, c]) => c.enabled);
  if (enabledProviders.length === 1) {
    suggestions.push('Enable more model providers to find the best match for your data');
  }
  
  for (const suggestion of suggestions.slice(0, 5)) {
    console.log(`   → ${suggestion}`);
  }
  
  return recommendations;
}

// =============================================================================
// GENERATE HTML REPORT
// =============================================================================

function generateHTMLReport(recommendations, config, allResults) {
  const { topConfigs, bestFor, totalTested, validCount } = recommendations;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Embedding Configuration Results - EmbedEval</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --bg: #0d1117;
      --card: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --accent: #58a6ff;
      --success: #3fb950;
      --warning: #d29922;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 2rem;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1, h2, h3 { color: white; margin-bottom: 1rem; }
    .hero {
      text-align: center;
      padding: 3rem;
      background: linear-gradient(135deg, #1a1f35 0%, #0d1117 100%);
      border-radius: 16px;
      margin-bottom: 2rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
    }
    .stat-value { font-size: 2rem; font-weight: bold; color: var(--accent); }
    .stat-label { color: var(--text-muted); font-size: 0.9rem; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .config-list {
      list-style: none;
    }
    .config-item {
      padding: 1rem;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      margin-bottom: 0.75rem;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 1rem;
      align-items: center;
    }
    .config-name { font-weight: 600; }
    .config-details { color: var(--text-muted); font-size: 0.9rem; }
    .metrics {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
    }
    .metric {
      padding: 0.25rem 0.5rem;
      background: rgba(88, 166, 255, 0.1);
      border-radius: 4px;
    }
    .best-badge {
      background: var(--success);
      color: black;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: bold;
    }
    .chart-container { height: 400px; margin-top: 1rem; }
    .constraints {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    .constraint {
      padding: 0.75rem;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      text-align: center;
    }
    footer {
      text-align: center;
      padding: 2rem;
      color: var(--text-muted);
    }
    footer a { color: var(--accent); }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>🎯 Your Personalized Recommendations</h1>
      <p>Based on your models, constraints, and ${totalTested} tested configurations</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${totalTested}</div>
        <div class="stat-label">Configurations Tested</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${validCount}</div>
        <div class="stat-label">Meet Your Constraints</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${bestFor.quality ? (bestFor.quality.metrics.quality * 100).toFixed(1) : 0}%</div>
        <div class="stat-label">Best Quality Achieved</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${bestFor.speed ? bestFor.speed.metrics.latency : 0}ms</div>
        <div class="stat-label">Fastest Latency</div>
      </div>
    </div>
    
    <div class="card">
      <h2>🏆 Best For Each Criterion</h2>
      <ul class="config-list">
        ${bestFor.quality ? `
        <li class="config-item">
          <div>
            <div class="config-name">📈 Best Quality: ${formatConfig(bestFor.quality)}</div>
            <div class="config-details">${explainConfig(bestFor.quality).slice(0, 2).join(' | ')}</div>
          </div>
          <div class="metrics">
            <span class="metric">${(bestFor.quality.metrics.quality * 100).toFixed(1)}%</span>
            <span class="metric">${bestFor.quality.metrics.latency}ms</span>
            <span class="metric">$${bestFor.quality.metrics.cost.toFixed(4)}</span>
          </div>
        </li>` : ''}
        ${bestFor.speed ? `
        <li class="config-item">
          <div>
            <div class="config-name">⚡ Fastest: ${formatConfig(bestFor.speed)}</div>
            <div class="config-details">${explainConfig(bestFor.speed).slice(0, 2).join(' | ')}</div>
          </div>
          <div class="metrics">
            <span class="metric">${(bestFor.speed.metrics.quality * 100).toFixed(1)}%</span>
            <span class="metric">${bestFor.speed.metrics.latency}ms</span>
          </div>
        </li>` : ''}
        ${bestFor.cost ? `
        <li class="config-item">
          <div>
            <div class="config-name">💰 Best Free: ${formatConfig(bestFor.cost)}</div>
            <div class="config-details">${explainConfig(bestFor.cost).slice(0, 2).join(' | ')}</div>
          </div>
          <div class="metrics">
            <span class="metric">${(bestFor.cost.metrics.quality * 100).toFixed(1)}%</span>
            <span class="best-badge">FREE</span>
          </div>
        </li>` : ''}
      </ul>
    </div>
    
    <div class="card">
      <h2>📋 Top ${topConfigs.length} Configurations</h2>
      <ul class="config-list">
        ${topConfigs.map((cfg, i) => `
        <li class="config-item">
          <div>
            <div class="config-name">${i + 1}. ${formatConfig(cfg)}</div>
            <div class="config-details">
              Model: ${cfg.model.provider}/${cfg.model.model}<br>
              ${cfg.query !== 'none' ? `Query: ${cfg.query} | ` : ''}
              ${cfg.retrieval !== 'cosine' ? `Retrieval: ${cfg.retrieval} | ` : ''}
              ${cfg.reranking !== 'none' ? `Rerank: ${cfg.reranking}` : ''}
            </div>
          </div>
          <div class="metrics">
            <span class="metric">${(cfg.metrics.quality * 100).toFixed(1)}%</span>
            <span class="metric">${cfg.metrics.latency}ms</span>
            <span class="metric">$${cfg.metrics.cost.toFixed(4)}</span>
          </div>
        </li>
        `).join('')}
      </ul>
    </div>
    
    <div class="card">
      <h2>📊 Quality vs Latency Tradeoff</h2>
      <div class="chart-container">
        <canvas id="scatterChart"></canvas>
      </div>
    </div>
    
    <div class="card">
      <h2>⚙️ Your Configuration</h2>
      <h3>Constraints Applied:</h3>
      <div class="constraints">
        <div class="constraint">
          <strong>Max Cost</strong><br>
          $${config.constraints.max_cost_per_query}/query
        </div>
        <div class="constraint">
          <strong>Max Latency</strong><br>
          ${config.constraints.max_latency_ms}ms
        </div>
        <div class="constraint">
          <strong>Local Only</strong><br>
          ${config.constraints.local_only ? 'Yes' : 'No'}
        </div>
        <div class="constraint">
          <strong>Min Accuracy</strong><br>
          ${(config.constraints.min_accuracy * 100).toFixed(0)}%
        </div>
      </div>
    </div>
    
    <footer>
      <p>Generated by <a href="https://github.com/Algiras/embedeval">EmbedEval</a></p>
      <p><a href="./landing.html">← Back to Dashboard</a></p>
    </footer>
  </div>
  
  <script>
    const allResults = ${JSON.stringify(allResults.slice(0, 100).map(r => ({
      name: formatConfig(r),
      quality: r.metrics.quality,
      latency: r.metrics.latency,
      cost: r.metrics.cost,
      valid: r.meetsConstraints,
    })))};
    
    new Chart(document.getElementById('scatterChart'), {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Valid Configs',
          data: allResults.filter(r => r.valid).map(r => ({ x: r.latency, y: r.quality * 100 })),
          backgroundColor: '#3fb950',
        }, {
          label: 'Filtered Out',
          data: allResults.filter(r => !r.valid).map(r => ({ x: r.latency, y: r.quality * 100 })),
          backgroundColor: '#f8514966',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#c9d1d9' } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const r = allResults[ctx.dataIndex];
                return \`\${r?.name}: \${r?.quality?.toFixed ? (r.quality * 100).toFixed(1) : 0}% @ \${r?.latency}ms\`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Latency (ms)', color: '#c9d1d9' },
            ticks: { color: '#8b949e' },
            grid: { color: '#30363d' }
          },
          y: {
            title: { display: true, text: 'Quality (%)', color: '#c9d1d9' },
            ticks: { color: '#8b949e' },
            grid: { color: '#30363d' }
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║            EMBEDEVAL - CONFIGURABLE EVOLUTION                            ║');
  console.log('║            Find the best embedding configuration for YOUR data           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');
  
  // Load config
  const configPath = process.argv[2];
  const config = await loadConfig(configPath);
  
  // Count combinations
  const totalCombinations = countCombinations(config);
  console.log(`🔢 Total possible combinations: ${totalCombinations}`);
  
  if (totalCombinations > config.evolution.max_combinations) {
    console.log(`⚠️  Limiting to ${config.evolution.max_combinations} (set max_combinations in config to change)`);
  }
  
  // Show what we're testing
  console.log('\n📋 Testing configurations...\n');
  
  // Evaluate all combinations
  const results = [];
  let tested = 0;
  let lastProgress = 0;
  
  for (const combo of generateCombinations(config)) {
    if (tested >= config.evolution.max_combinations) break;
    
    const result = evaluateConfig(combo, config.constraints);
    results.push(result);
    tested++;
    
    // Progress update
    const progress = Math.floor(tested / Math.min(totalCombinations, config.evolution.max_combinations) * 100);
    if (progress >= lastProgress + 10) {
      process.stdout.write(`   Testing: ${progress}% (${tested}/${Math.min(totalCombinations, config.evolution.max_combinations)})\r`);
      lastProgress = progress;
    }
  }
  
  console.log(`   Testing: 100% (${tested} configurations evaluated)      `);
  
  // Generate recommendations
  const recommendations = generateRecommendations(results, config);
  
  // Display results
  displayResults(recommendations, config);
  
  // Save results
  const outputDir = path.resolve(config.output.dir);
  await fs.mkdir(outputDir, { recursive: true });
  
  if (config.output.save_all_configs) {
    await fs.writeFile(
      path.join(outputDir, 'all-configs.json'),
      JSON.stringify(results, null, 2)
    );
  }
  
  await fs.writeFile(
    path.join(outputDir, 'recommendations.json'),
    JSON.stringify(recommendations, null, 2)
  );
  
  if (config.output.html_report) {
    const html = generateHTMLReport(recommendations, config, results);
    await fs.writeFile(path.join(outputDir, 'your-recommendations.html'), html);
  }
  
  console.log(`\n\n📄 Results saved to: ${outputDir}/`);
  console.log('   • recommendations.json');
  if (config.output.save_all_configs) console.log('   • all-configs.json');
  if (config.output.html_report) console.log('   • your-recommendations.html');
}

main().catch(console.error);
