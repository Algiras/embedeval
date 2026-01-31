/**
 * Multi-Provider LLM System for Evaluation
 * 
 * Supports:
 * - Gemini (3.x, 2.5x series) - Primary provider
 * - OpenAI-compatible APIs (ChatGPT, OpenRouter, Ollama, local models)
 * - Embedding providers for semantic similarity
 * - Reranking for confidence scoring
 * 
 * Environment Variables:
 * - GEMINI_API_KEY: Google Gemini API key
 * - OPENAI_API_KEY: OpenAI API key
 * - OPENAI_BASE_URL: Custom base URL (for OpenRouter, Ollama, etc.)
 * - EMBEDEVAL_PROVIDER: Default provider (gemini, openai)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './logger';

// ==================== TYPES ====================

export interface LLMProvider {
  name: string;
  judge(prompt: string, model: string, temperature: number): Promise<string>;
  isAvailable(): boolean;
}

export interface EmbeddingProvider {
  name: string;
  embed(text: string, model?: string): Promise<number[]>;
  embedBatch(texts: string[], model?: string): Promise<number[][]>;
  isAvailable(): boolean;
}

export interface ProviderConfig {
  provider: 'gemini' | 'openai' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderMetrics {
  provider: string;
  model: string;
  latency: number;
  tokens?: { input: number; output: number };
  cost?: number;
}

// ==================== MODEL CATALOG ====================

export const GEMINI_MODELS = {
  // Gemini 3 Series (Latest - 2026)
  'gemini-3-pro': { speed: 'medium', cost: 'high', tier: 'flagship', description: 'Most intelligent, best for complex reasoning' },
  'gemini-3-flash': { speed: 'fast', cost: 'medium', tier: 'balanced', description: 'Balanced speed and intelligence' },
  
  // Gemini 2.5 Series (Current stable)
  'gemini-2.5-flash': { speed: 'fast', cost: 'low', tier: 'workhorse', description: 'Best price-performance for evals' },
  'gemini-2.5-flash-lite': { speed: 'fastest', cost: 'lowest', tier: 'budget', description: 'Ultra fast, simple checks' },
  'gemini-2.5-pro': { speed: 'slow', cost: 'high', tier: 'thinking', description: 'Complex reasoning, long context' },
  
  // Legacy (Deprecated March 2026)
  'gemini-2.0-flash': { speed: 'fast', cost: 'low', tier: 'legacy', description: 'DEPRECATED - use 2.5' },
  'gemini-2.0-flash-lite': { speed: 'fastest', cost: 'lowest', tier: 'legacy', description: 'DEPRECATED - use 2.5' },
} as const;

export const OPENAI_MODELS = {
  'gpt-4o': { speed: 'medium', cost: 'high', tier: 'flagship' },
  'gpt-4o-mini': { speed: 'fast', cost: 'low', tier: 'budget' },
  'gpt-4-turbo': { speed: 'medium', cost: 'high', tier: 'legacy' },
  'gpt-3.5-turbo': { speed: 'fast', cost: 'lowest', tier: 'legacy' },
} as const;

export const OPENROUTER_MODELS = {
  'anthropic/claude-3.5-sonnet': { speed: 'medium', cost: 'medium' },
  'anthropic/claude-3-haiku': { speed: 'fast', cost: 'low' },
  'meta-llama/llama-3.1-70b-instruct': { speed: 'medium', cost: 'low' },
  'mistralai/mixtral-8x7b-instruct': { speed: 'fast', cost: 'low' },
} as const;

// Default model selection based on task
export const DEFAULT_MODELS = {
  judge: 'gemini-2.5-flash',       // Fast, cheap, good for binary evals
  embedding: 'text-embedding-004', // Gemini embedding model
  rerank: 'gemini-2.5-flash-lite', // Fastest for confidence scoring
  complex: 'gemini-3-pro',         // For complex reasoning tasks
} as const;

// ==================== GEMINI PROVIDER ====================

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private client: GoogleGenerativeAI | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.client = new GoogleGenerativeAI(key);
      logger.debug('Gemini provider initialized');
    } else {
      logger.warn('GEMINI_API_KEY not set - Gemini provider unavailable');
    }
  }

  async judge(prompt: string, model: string, temperature: number): Promise<string> {
    if (!this.client) {
      throw new Error('Gemini client not initialized - set GEMINI_API_KEY');
    }

    const modelName = model || DEFAULT_MODELS.judge;
    const startTime = Date.now();
    
    const genModel = this.client.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: temperature ?? 0.0,
        maxOutputTokens: 500,
      }
    });

    const result = await genModel.generateContent(prompt);
    const response = result.response;
    const latency = Date.now() - startTime;
    
    logger.debug(`Gemini ${modelName} responded in ${latency}ms`);
    return response.text();
  }

  isAvailable(): boolean {
    return this.client !== null;
  }
}

// ==================== OPENAI-COMPATIBLE PROVIDER ====================

/**
 * OpenAI-compatible provider
 * Works with: OpenAI, OpenRouter, Ollama, Azure OpenAI, local LLMs
 */
export class OpenAICompatibleProvider implements LLMProvider {
  name: string;
  private apiKey: string | null = null;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; baseUrl?: string; name?: string }) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY || null;
    this.baseUrl = options?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.name = options?.name || this.detectProviderName();
    
    if (this.apiKey) {
      logger.debug(`OpenAI-compatible provider initialized: ${this.name} (${this.baseUrl})`);
    } else {
      logger.warn(`${this.name} API key not set`);
    }
  }

  private detectProviderName(): string {
    if (this.baseUrl.includes('openrouter')) return 'openrouter';
    if (this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1')) return 'ollama';
    if (this.baseUrl.includes('azure')) return 'azure-openai';
    return 'openai';
  }

  async judge(prompt: string, model: string, temperature: number): Promise<string> {
    if (!this.apiKey && !this.baseUrl.includes('localhost')) {
      throw new Error(`${this.name} API key not set`);
    }

    const modelName = model || 'gpt-4o-mini';
    const startTime = Date.now();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    // OpenRouter specific header
    if (this.baseUrl.includes('openrouter')) {
      headers['HTTP-Referer'] = 'https://github.com/Algiras/embedeval';
      headers['X-Title'] = 'EmbedEval';
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: temperature ?? 0.0,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;
    
    logger.debug(`${this.name} ${modelName} responded in ${latency}ms`);
    return data.choices[0].message.content;
  }

  isAvailable(): boolean {
    return this.apiKey !== null || this.baseUrl.includes('localhost');
  }
}

// ==================== EMBEDDING PROVIDER ====================

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  name = 'gemini-embedding';
  private client: GoogleGenerativeAI | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.client = new GoogleGenerativeAI(key);
    }
  }

  async embed(text: string, model?: string): Promise<number[]> {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    const embeddingModel = this.client.getGenerativeModel({ 
      model: model || 'text-embedding-004' 
    });
    
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  }

  async embedBatch(texts: string[], model?: string): Promise<number[][]> {
    return Promise.all(texts.map(text => this.embed(text, model)));
  }

  isAvailable(): boolean {
    return this.client !== null;
  }
}

/**
 * OpenAI-compatible embedding provider
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name: string;
  private apiKey: string | null = null;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; baseUrl?: string; name?: string }) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY || null;
    this.baseUrl = options?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.name = options?.name || 'openai-embedding';
  }

  async embed(text: string, model?: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set');
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[], model?: string): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set');
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'text-embedding-3-small',
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  }

  isAvailable(): boolean {
    return this.apiKey !== null;
  }
}

// ==================== PROVIDER FACTORY ====================

export interface ProviderRegistry {
  llm: LLMProvider[];
  embedding: EmbeddingProvider[];
}

/**
 * Create providers from environment configuration
 */
export function createProviders(): ProviderRegistry {
  const providers: ProviderRegistry = {
    llm: [],
    embedding: [],
  };

  // Gemini (primary)
  const gemini = new GeminiProvider();
  if (gemini.isAvailable()) {
    providers.llm.push(gemini);
    providers.embedding.push(new GeminiEmbeddingProvider());
  }

  // OpenAI (secondary)
  const openai = new OpenAICompatibleProvider();
  if (openai.isAvailable()) {
    providers.llm.push(openai);
    providers.embedding.push(new OpenAIEmbeddingProvider());
  }

  // Custom OpenAI-compatible (from OPENAI_BASE_URL)
  if (process.env.OPENAI_BASE_URL && process.env.OPENAI_BASE_URL !== 'https://api.openai.com/v1') {
    const custom = new OpenAICompatibleProvider({
      baseUrl: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    });
    if (custom.isAvailable()) {
      providers.llm.push(custom);
    }
  }

  return providers;
}

/**
 * Get the best available LLM provider
 */
export function getBestProvider(providers: ProviderRegistry): LLMProvider | null {
  const preferred = process.env.EMBEDEVAL_PROVIDER || 'gemini';
  
  // Try preferred first
  const preferredProvider = providers.llm.find(p => p.name === preferred);
  if (preferredProvider?.isAvailable()) {
    return preferredProvider;
  }

  // Fall back to any available
  return providers.llm.find(p => p.isAvailable()) || null;
}

// ==================== JUDGE FACTORY ====================

/**
 * Create a judge function from available providers
 */
export function createJudge(config?: ProviderConfig): ((prompt: string, model: string, temperature: number) => Promise<string>) | undefined {
  // If specific config provided, use it
  if (config) {
    if (config.provider === 'gemini') {
      const provider = new GeminiProvider(config.apiKey);
      if (provider.isAvailable()) {
        return (prompt, model, temp) => provider.judge(prompt, config.model || model, config.temperature ?? temp);
      }
    } else if (config.provider === 'openai' || config.provider === 'custom') {
      const provider = new OpenAICompatibleProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      });
      if (provider.isAvailable()) {
        return (prompt, model, temp) => provider.judge(prompt, config.model || model, config.temperature ?? temp);
      }
    }
    return undefined;
  }

  // Auto-detect best provider
  const providers = createProviders();
  const best = getBestProvider(providers);
  
  if (!best) {
    logger.warn('No LLM provider available - set GEMINI_API_KEY or OPENAI_API_KEY');
    return undefined;
  }

  logger.info(`Using ${best.name} as LLM judge`);
  return (prompt, model, temp) => best.judge(prompt, model, temp);
}

// Backwards compatibility
export const createGeminiJudge = createJudge;

// ==================== RERANKING ====================

export interface RerankResult {
  traceId: string;
  passed: boolean;
  explanation: string;
  confidence: number;
}

/**
 * Rerank evaluation results with confidence scores
 */
export async function rerankResults(
  results: { traceId: string; passed: boolean; explanation: string }[],
  context: string,
  config?: ProviderConfig
): Promise<RerankResult[]> {
  const judge = createJudge(config);
  
  if (!judge) {
    // Return with default confidence if no LLM available
    return results.map(r => ({ ...r, confidence: 0.5 }));
  }

  const reranked: RerankResult[] = [];

  for (const result of results) {
    const rerankPrompt = `Given this evaluation result, rate your confidence (0.0 to 1.0) that the judgment is correct.

Context: ${context}
Result: ${result.passed ? 'PASS' : 'FAIL'}
Explanation: ${result.explanation}

Respond with just a number between 0.0 and 1.0 representing confidence.`;

    try {
      const response = await judge(rerankPrompt, DEFAULT_MODELS.rerank, 0.0);
      const confidence = parseFloat(response.trim()) || 0.5;
      reranked.push({ ...result, confidence: Math.min(1.0, Math.max(0.0, confidence)) });
    } catch {
      reranked.push({ ...result, confidence: 0.5 });
    }
  }

  // Sort by confidence (highest first)
  return reranked.sort((a, b) => b.confidence - a.confidence);
}

// ==================== SEMANTIC SIMILARITY ====================

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Evaluate semantic similarity between response and expected
 */
export async function evaluateSemanticSimilarity(
  response: string,
  expected: string,
  threshold: number = 0.8
): Promise<{ passed: boolean; similarity: number }> {
  const providers = createProviders();
  const embedProvider = providers.embedding[0];
  
  if (!embedProvider?.isAvailable()) {
    throw new Error('No embedding provider available');
  }

  const [responseEmbed, expectedEmbed] = await Promise.all([
    embedProvider.embed(response),
    embedProvider.embed(expected),
  ]);

  const similarity = cosineSimilarity(responseEmbed, expectedEmbed);
  return {
    passed: similarity >= threshold,
    similarity,
  };
}

// ==================== PROVIDER INFO ====================

/**
 * Get information about available providers
 */
export function getProviderInfo(): {
  available: string[];
  models: typeof GEMINI_MODELS & typeof OPENAI_MODELS;
  defaults: typeof DEFAULT_MODELS;
} {
  const providers = createProviders();
  
  return {
    available: providers.llm.map(p => p.name),
    models: { ...GEMINI_MODELS, ...OPENAI_MODELS },
    defaults: DEFAULT_MODELS,
  };
}

/**
 * List available providers and their status
 */
export function listProviders(): void {
  console.log('\n📡 LLM Providers:\n');
  
  const gemini = new GeminiProvider();
  console.log(`  Gemini: ${gemini.isAvailable() ? '✅ Available' : '❌ Not configured (set GEMINI_API_KEY)'}`);
  
  const openai = new OpenAICompatibleProvider();
  console.log(`  OpenAI: ${openai.isAvailable() ? '✅ Available' : '❌ Not configured (set OPENAI_API_KEY)'}`);
  
  if (process.env.OPENAI_BASE_URL) {
    const custom = new OpenAICompatibleProvider({ baseUrl: process.env.OPENAI_BASE_URL });
    console.log(`  Custom (${custom.name}): ${custom.isAvailable() ? '✅ Available' : '❌ Not configured'}`);
  }

  console.log('\n📊 Recommended Models for Evals:\n');
  console.log('  Gemini 3 Series (2026):');
  console.log('    gemini-3-pro          - Most intelligent, complex reasoning');
  console.log('    gemini-3-flash        - Balanced speed and intelligence');
  console.log('  Gemini 2.5 Series (Stable):');
  console.log('    gemini-2.5-flash      - Best price-performance (DEFAULT)');
  console.log('    gemini-2.5-flash-lite - Ultra fast, simple checks');
  console.log('    gemini-2.5-pro        - Deep thinking, long context');
  console.log('  OpenAI:');
  console.log('    gpt-4o                - Flagship');
  console.log('    gpt-4o-mini           - Budget friendly');
  
  console.log('\n🔧 Configuration:\n');
  console.log('  GEMINI_API_KEY     - Google Gemini API key');
  console.log('  OPENAI_API_KEY     - OpenAI/OpenRouter API key');
  console.log('  OPENAI_BASE_URL    - Custom endpoint:');
  console.log('                       • OpenRouter: https://openrouter.ai/api/v1');
  console.log('                       • Ollama:     http://localhost:11434/v1');
  console.log('                       • Azure:      https://<name>.openai.azure.com');
  console.log('  EMBEDEVAL_PROVIDER - Preferred provider (gemini, openai)');
  console.log('');
}

// ==================== BENCHMARK ====================

export interface BenchmarkResult {
  provider: string;
  model: string;
  latency: number;
  success: boolean;
  error?: string;
}

/**
 * Benchmark available providers for speed comparison
 */
export async function benchmarkProviders(prompt: string = 'Say "PASS" or "FAIL"'): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const providers = createProviders();

  for (const provider of providers.llm) {
    // Only test currently available models
    const models = provider.name === 'gemini' 
      ? ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
      : ['gpt-4o-mini'];

    for (const model of models) {
      const startTime = Date.now();
      try {
        await provider.judge(prompt, model, 0.0);
        results.push({
          provider: provider.name,
          model,
          latency: Date.now() - startTime,
          success: true,
        });
      } catch (error) {
        results.push({
          provider: provider.name,
          model,
          latency: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return results.sort((a, b) => a.latency - b.latency);
}
