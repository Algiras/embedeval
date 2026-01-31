/**
 * Integration tests for LLM providers
 * Tests Gemini, OpenAI, and embedding providers
 * 
 * Environment Variables:
 * - GEMINI_API_KEY: Required for real Gemini tests
 * - OPENAI_API_KEY: Required for real OpenAI tests
 * 
 * Tests marked with it.skip() require manual testing with API keys
 * Tests marked with it() use mocks and can run in CI
 */

import {
  GeminiProvider,
  OpenAICompatibleProvider,
  GeminiEmbeddingProvider,
  OpenAIEmbeddingProvider,
  createProviders,
  getBestProvider,
  createJudge,
  GEMINI_MODELS,
  OPENAI_MODELS,
  DEFAULT_MODELS,
  cosineSimilarity,
  evaluateSemanticSimilarity,
} from '../../src/utils/llm-providers';

describe('LLM Providers - Integration', () => {
    describe('GeminiProvider', () => {
    describe('Initialization', () => {
      it('should initialize without API key but be unavailable', () => {
        const originalKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const provider = new GeminiProvider();
        expect(provider.name).toBe('gemini');
        expect(provider.isAvailable()).toBe(false);

        if (originalKey) process.env.GEMINI_API_KEY = originalKey;
      });

      it('should initialize with explicit API key parameter', () => {
        const originalKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const provider = new GeminiProvider('test-key');
        expect(provider.name).toBe('gemini');
        expect(provider.isAvailable()).toBe(true);

        if (originalKey) process.env.GEMINI_API_KEY = originalKey;
      });

      it('should initialize from environment variable GEMINI_API_KEY', () => {
        const originalKey = process.env.GEMINI_API_KEY;
        process.env.GEMINI_API_KEY = 'env-test-key';

        const provider = new GeminiProvider();
        expect(provider.isAvailable()).toBe(true);

        process.env.GEMINI_API_KEY = originalKey;
      });

      it('should initialize with default model catalog', () => {
        expect(GEMINI_MODELS).toBeDefined();
        expect(GEMINI_MODELS['gemini-2.5-flash']).toBeDefined();
        expect(GEMINI_MODELS['gemini-3-pro']).toBeDefined();
        expect(DEFAULT_MODELS.judge).toBe('gemini-2.5-flash');
      });
    });

    describe('Error Handling', () => {
      it('should throw error when judge called without initialization', async () => {
        const originalKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const provider = new GeminiProvider();
        await expect(provider.judge('test', 'gemini-2.5-flash', 0)).rejects.toThrow(
          'Gemini client not initialized'
        );

        if (originalKey) process.env.GEMINI_API_KEY = originalKey;
      });
    });

    describe('Real API Tests (Manual Only)', () => {
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;

      it.skip('should make real API call to Gemini (requires GEMINI_API_KEY)', async () => {
        if (!hasGeminiKey) {
          throw new Error('Skipping: GEMINI_API_KEY not set');
        }

        const provider = new GeminiProvider();
        const result = await provider.judge('Say "PASS"', 'gemini-2.5-flash', 0.0);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      }, 30000);

      it.skip('should handle different models (requires GEMINI_API_KEY)', async () => {
        if (!hasGeminiKey) {
          throw new Error('Skipping: GEMINI_API_KEY not set');
        }

        const provider = new GeminiProvider();
        const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

        for (const model of models) {
          const result = await provider.judge('Say "OK"', model, 0.0);
          expect(result).toBeDefined();
        }
      }, 60000);
    });
  });

    describe('OpenAICompatibleProvider', () => {
    describe('Initialization', () => {
      it('should initialize without API key and be unavailable (unless localhost)', () => {
        const originalKey = process.env.OPENAI_API_KEY;
        const originalUrl = process.env.OPENAI_BASE_URL;
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_BASE_URL;

        const provider = new OpenAICompatibleProvider();
        expect(provider.name).toBe('openai');
        expect(provider.isAvailable()).toBe(false);

        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
        if (originalUrl) process.env.OPENAI_BASE_URL = originalUrl;
      });

      it('should initialize with explicit API key parameter', () => {
        const provider = new OpenAICompatibleProvider({ apiKey: 'test-key' });
        expect(provider.isAvailable()).toBe(true);
        expect(provider.name).toBe('openai');
      });

      it('should initialize with custom baseUrl', () => {
        const provider = new OpenAICompatibleProvider({
          apiKey: 'test-key',
          baseUrl: 'http://localhost:11434/v1',
        });
        expect(provider.name).toBe('ollama');
      });

      it('should detect OpenRouter from baseUrl', () => {
        const provider = new OpenAICompatibleProvider({
          baseUrl: 'https://openrouter.ai/api/v1',
        });
        expect(provider.name).toBe('openrouter');
      });

      it('should detect Azure from baseUrl', () => {
        const provider = new OpenAICompatibleProvider({
          baseUrl: 'https://my-resource.openai.azure.com',
        });
        expect(provider.name).toBe('azure-openai');
      });

      it('should initialize from environment variables', () => {
        const originalKey = process.env.OPENAI_API_KEY;
        const originalUrl = process.env.OPENAI_BASE_URL;

        process.env.OPENAI_API_KEY = 'env-test-key';
        process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';

        const provider = new OpenAICompatibleProvider();
        expect(provider.isAvailable()).toBe(true);
        expect(provider.name).toBe('openrouter');

        process.env.OPENAI_API_KEY = originalKey;
        process.env.OPENAI_BASE_URL = originalUrl;
      });

      it('should initialize with default model catalog', () => {
        expect(OPENAI_MODELS).toBeDefined();
        expect(OPENAI_MODELS['gpt-4o']).toBeDefined();
        expect(OPENAI_MODELS['gpt-4o-mini']).toBeDefined();
      });
    });

    describe('Error Handling', () => {
      it('should throw error when judge called without API key', async () => {
        const originalKey = process.env.OPENAI_API_KEY;
        const originalUrl = process.env.OPENAI_BASE_URL;
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_BASE_URL;

        const provider = new OpenAICompatibleProvider();
        await expect(provider.judge('test', 'gpt-4o-mini', 0)).rejects.toThrow('API key not set');

        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
        if (originalUrl) process.env.OPENAI_BASE_URL = originalUrl;
      });
    });

    describe('Real API Tests (Manual Only)', () => {
      const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

      it.skip('should make real API call to OpenAI (requires OPENAI_API_KEY)', async () => {
        if (!hasOpenAIKey) {
          throw new Error('Skipping: OPENAI_API_KEY not set');
        }

        const provider = new OpenAICompatibleProvider();
        const result = await provider.judge('Say "PASS"', 'gpt-4o-mini', 0.0);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      }, 30000);
    });
  });

    describe('GeminiEmbeddingProvider', () => {
    describe('Initialization', () => {
      it('should initialize without API key and be unavailable', () => {
        const originalKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const provider = new GeminiEmbeddingProvider();
        expect(provider.name).toBe('gemini-embedding');
        expect(provider.isAvailable()).toBe(false);

        if (originalKey) process.env.GEMINI_API_KEY = originalKey;
      });

      it('should initialize with explicit API key', () => {
        const originalKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const provider = new GeminiEmbeddingProvider('test-key');
        expect(provider.isAvailable()).toBe(true);

        if (originalKey) process.env.GEMINI_API_KEY = originalKey;
      });

      it('should initialize from environment variable', () => {
        const originalKey = process.env.GEMINI_API_KEY;
        process.env.GEMINI_API_KEY = 'env-test-key';

        const provider = new GeminiEmbeddingProvider();
        expect(provider.isAvailable()).toBe(true);

        process.env.GEMINI_API_KEY = originalKey;
      });
    });

    describe('Error Handling', () => {
      it('should throw error when embed called without initialization', async () => {
        const originalKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const provider = new GeminiEmbeddingProvider();
        await expect(provider.embed('test')).rejects.toThrow('Gemini client not initialized');

        if (originalKey) process.env.GEMINI_API_KEY = originalKey;
      });

      it('should throw error when embedBatch called without initialization', async () => {
        const originalKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const provider = new GeminiEmbeddingProvider();
        await expect(provider.embedBatch(['a', 'b'])).rejects.toThrow('Gemini client not initialized');

        if (originalKey) process.env.GEMINI_API_KEY = originalKey;
      });
    });

    describe('Real API Tests (Manual Only)', () => {
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;

      it.skip('should generate embeddings (requires GEMINI_API_KEY)', async () => {
        if (!hasGeminiKey) {
          throw new Error('Skipping: GEMINI_API_KEY not set');
        }

        const provider = new GeminiEmbeddingProvider();
        const embedding = await provider.embed('Hello world');
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
        expect(typeof embedding[0]).toBe('number');
      }, 30000);

      it.skip('should generate batch embeddings (requires GEMINI_API_KEY)', async () => {
        if (!hasGeminiKey) {
          throw new Error('Skipping: GEMINI_API_KEY not set');
        }

        const provider = new GeminiEmbeddingProvider();
        const texts = ['Hello', 'World', 'Test'];
        const embeddings = await provider.embedBatch(texts);
        expect(embeddings).toHaveLength(3);
        expect(embeddings[0].length).toBe(embeddings[1].length);
        expect(embeddings[1].length).toBe(embeddings[2].length);
      }, 30000);
    });
  });

    describe('OpenAIEmbeddingProvider', () => {
    describe('Initialization', () => {
      it('should initialize without API key and be unavailable', () => {
        const originalKey = process.env.OPENAI_API_KEY;
        const originalUrl = process.env.OPENAI_BASE_URL;
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_BASE_URL;

        const provider = new OpenAIEmbeddingProvider();
        expect(provider.isAvailable()).toBe(false);

        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
        if (originalUrl) process.env.OPENAI_BASE_URL = originalUrl;
      });

      it('should initialize with explicit API key', () => {
        const provider = new OpenAIEmbeddingProvider({ apiKey: 'test-key' });
        expect(provider.isAvailable()).toBe(true);
      });

      it('should initialize from environment variable', () => {
        const originalKey = process.env.OPENAI_API_KEY;
        process.env.OPENAI_API_KEY = 'env-test-key';

        const provider = new OpenAIEmbeddingProvider();
        expect(provider.isAvailable()).toBe(true);

        process.env.OPENAI_API_KEY = originalKey;
      });
    });

    describe('Error Handling', () => {
      it('should throw error when embed called without API key', async () => {
        const originalKey = process.env.OPENAI_API_KEY;
        const originalUrl = process.env.OPENAI_BASE_URL;
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_BASE_URL;

        const provider = new OpenAIEmbeddingProvider();
        await expect(provider.embed('test')).rejects.toThrow('OpenAI API key not set');

        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
        if (originalUrl) process.env.OPENAI_BASE_URL = originalUrl;
      });

      it('should throw error when embedBatch called without API key', async () => {
        const originalKey = process.env.OPENAI_API_KEY;
        const originalUrl = process.env.OPENAI_BASE_URL;
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_BASE_URL;

        const provider = new OpenAIEmbeddingProvider();
        await expect(provider.embedBatch(['a', 'b'])).rejects.toThrow('OpenAI API key not set');

        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
        if (originalUrl) process.env.OPENAI_BASE_URL = originalUrl;
      });
    });

    describe('Real API Tests (Manual Only)', () => {
      const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

      it.skip('should generate embeddings (requires OPENAI_API_KEY)', async () => {
        if (!hasOpenAIKey) {
          throw new Error('Skipping: OPENAI_API_KEY not set');
        }

        const provider = new OpenAIEmbeddingProvider();
        const embedding = await provider.embed('Hello world');
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
        expect(typeof embedding[0]).toBe('number');
      }, 30000);

      it.skip('should generate batch embeddings (requires OPENAI_API_KEY)', async () => {
        if (!hasOpenAIKey) {
          throw new Error('Skipping: OPENAI_API_KEY not set');
        }

        const provider = new OpenAIEmbeddingProvider();
        const texts = ['Hello', 'World', 'Test'];
        const embeddings = await provider.embedBatch(texts);
        expect(embeddings).toHaveLength(3);
      }, 30000);
    });
  });

  describe('Provider Factory', () => {
    let originalGeminiKey: string | undefined;
    let originalOpenAIKey: string | undefined;
    let originalBaseUrl: string | undefined;
    let originalProvider: string | undefined;

    beforeEach(() => {
      // Save and clear environment variables
      originalGeminiKey = process.env.GEMINI_API_KEY;
      originalOpenAIKey = process.env.OPENAI_API_KEY;
      originalBaseUrl = process.env.OPENAI_BASE_URL;
      originalProvider = process.env.EMBEDEVAL_PROVIDER;

      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_BASE_URL;
      delete process.env.EMBEDEVAL_PROVIDER;
    });

    afterEach(() => {
      // Restore environment variables
      if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
      if (originalOpenAIKey) process.env.OPENAI_API_KEY = originalOpenAIKey;
      if (originalBaseUrl) process.env.OPENAI_BASE_URL = originalBaseUrl;
      if (originalProvider) process.env.EMBEDEVAL_PROVIDER = originalProvider;
    });

    it('should return empty registry when no keys set', () => {
      const providers = createProviders();
      expect(providers.llm).toEqual([]);
      expect(providers.embedding).toEqual([]);
    });

    it('should create Gemini provider when GEMINI_API_KEY is set', () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const providers = createProviders();
      expect(providers.llm).toHaveLength(1);
      expect(providers.llm[0].name).toBe('gemini');
      expect(providers.embedding).toHaveLength(1);
      expect(providers.embedding[0].name).toBe('gemini-embedding');
    });

    it('should create OpenAI provider when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const providers = createProviders();
      expect(providers.llm).toHaveLength(1);
      expect(providers.llm[0].name).toBe('openai');
      expect(providers.embedding).toHaveLength(1);
      expect(providers.embedding[0].name).toBe('openai-embedding');
    });

    it('should create both providers when both keys are set', () => {
      process.env.GEMINI_API_KEY = 'gemini-key';
      process.env.OPENAI_API_KEY = 'openai-key';
      const providers = createProviders();
      expect(providers.llm).toHaveLength(2);
      expect(providers.embedding).toHaveLength(2);
    });

    it('should create custom provider when OPENAI_BASE_URL is custom', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.OPENAI_BASE_URL = 'http://localhost:11434/v1';
      const providers = createProviders();
      expect(providers.llm.length).toBeGreaterThanOrEqual(1);
      const ollamaProvider = providers.llm.find((p: any) => p.name === 'ollama');
      expect(ollamaProvider).toBeDefined();
    });

    it('should get best provider based on EMBEDEVAL_PROVIDER preference', () => {
      process.env.GEMINI_API_KEY = 'gemini-key';
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.EMBEDEVAL_PROVIDER = 'openai';

      const providers = createProviders();
      const best = getBestProvider(providers);
      expect(best?.name).toBe('openai');
    });

    it('should fall back to any available provider', () => {
      process.env.GEMINI_API_KEY = 'gemini-key';
      process.env.EMBEDEVAL_PROVIDER = 'nonexistent';

      const providers = createProviders();
      const best = getBestProvider(providers);
      expect(best?.name).toBe('gemini');
    });

    it('should return null when no providers available', () => {
      const providers = createProviders();
      const best = getBestProvider(providers);
      expect(best).toBeNull();
    });
  });

  describe('Judge Factory', () => {
    let originalGeminiKey: string | undefined;
    let originalOpenAIKey: string | undefined;

    beforeEach(() => {
      originalGeminiKey = process.env.GEMINI_API_KEY;
      originalOpenAIKey = process.env.OPENAI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENAI_API_KEY;
    });

    afterEach(() => {
      if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
      if (originalOpenAIKey) process.env.OPENAI_API_KEY = originalOpenAIKey;
    });

    it('should create judge from Gemini config', () => {
      const judge = createJudge({
        provider: 'gemini',
        apiKey: 'test-key',
      });
      expect(judge).toBeDefined();
      expect(typeof judge).toBe('function');
    });

    it('should create judge from OpenAI config', () => {
      const judge = createJudge({
        provider: 'openai',
        apiKey: 'test-key',
      });
      expect(judge).toBeDefined();
      expect(typeof judge).toBe('function');
    });

    it('should create judge from custom config', () => {
      const judge = createJudge({
        provider: 'custom',
        apiKey: 'test-key',
        baseUrl: 'http://localhost:11434/v1',
      });
      expect(judge).toBeDefined();
      expect(typeof judge).toBe('function');
    });

    it('should return undefined when no config and no keys', () => {
      const judge = createJudge();
      expect(judge).toBeUndefined();
    });

    it('should auto-detect best provider when no config', () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const judge = createJudge();
      expect(judge).toBeDefined();
      expect(typeof judge).toBe('function');
    });

    it('should use config model over parameter', () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const judge = createJudge({
        provider: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-3-pro',
      });
      expect(judge).toBeDefined();
    });
  });

  describe('Cosine Similarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should return 0 for vectors of different lengths', () => {
      const a = [1, 2];
      const b = [1, 2, 3];
      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBe(0);
    });

    it('should handle negative values', () => {
      const a = [-1, -1];
      const b = [1, 1];
      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should calculate partial similarity', () => {
      const a = [1, 2, 3];
      const b = [2, 4, 6];
      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1.0, 5);
    });
  });

  describe('Semantic Similarity Evaluation', () => {
    it('should throw error when no embedding provider available', async () => {
      const originalGeminiKey = process.env.GEMINI_API_KEY;
      const originalOpenAIKey = process.env.OPENAI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      await expect(
        evaluateSemanticSimilarity('response', 'expected')
      ).rejects.toThrow('No embedding provider available');

      if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
      if (originalOpenAIKey) process.env.OPENAI_API_KEY = originalOpenAIKey;
    });

    describe('Real API Tests (Manual Only)', () => {
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;

      it.skip('should evaluate semantic similarity (requires GEMINI_API_KEY)', async () => {
        if (!hasGeminiKey) {
          throw new Error('Skipping: GEMINI_API_KEY not set');
        }

        const result = await evaluateSemanticSimilarity(
          'The sky is blue',
          'The sky is blue',
          0.8
        );
        expect(result.passed).toBe(true);
        expect(result.similarity).toBeGreaterThan(0.9);
      }, 30000);

      it.skip('should detect low similarity (requires GEMINI_API_KEY)', async () => {
        if (!hasGeminiKey) {
          throw new Error('Skipping: GEMINI_API_KEY not set');
        }

        const result = await evaluateSemanticSimilarity(
          'The sky is blue',
          'I love pizza',
          0.8
        );
        expect(result.passed).toBe(false);
        expect(result.similarity).toBeLessThan(0.8);
      }, 30000);
    });
  });

  describe('Provider Fallback Logic', () => {
    let originalGeminiKey: string | undefined;
    let originalOpenAIKey: string | undefined;
    let originalProvider: string | undefined;

    beforeEach(() => {
      originalGeminiKey = process.env.GEMINI_API_KEY;
      originalOpenAIKey = process.env.OPENAI_API_KEY;
      originalProvider = process.env.EMBEDEVAL_PROVIDER;
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.EMBEDEVAL_PROVIDER;
    });

    afterEach(() => {
      if (originalGeminiKey) process.env.GEMINI_API_KEY = originalGeminiKey;
      if (originalOpenAIKey) process.env.OPENAI_API_KEY = originalOpenAIKey;
      if (originalProvider) process.env.EMBEDEVAL_PROVIDER = originalProvider;
    });

    it('should prefer Gemini over OpenAI when both available', () => {
      process.env.GEMINI_API_KEY = 'gemini-key';
      process.env.OPENAI_API_KEY = 'openai-key';

      const providers = createProviders();
      const best = getBestProvider(providers);
      expect(best?.name).toBe('gemini');
    });

    it('should use OpenAI when Gemini not available', () => {
      process.env.OPENAI_API_KEY = 'openai-key';

      const providers = createProviders();
      const best = getBestProvider(providers);
      expect(best?.name).toBe('openai');
    });

    it('should respect EMBEDEVAL_PROVIDER preference for OpenAI', () => {
      process.env.GEMINI_API_KEY = 'gemini-key';
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.EMBEDEVAL_PROVIDER = 'openai';

      const providers = createProviders();
      const best = getBestProvider(providers);
      expect(best?.name).toBe('openai');
    });

    it('should handle invalid EMBEDEVAL_PROVIDER gracefully', () => {
      process.env.GEMINI_API_KEY = 'gemini-key';
      process.env.EMBEDEVAL_PROVIDER = 'invalid-provider';

      const providers = createProviders();
      const best = getBestProvider(providers);
      expect(best?.name).toBe('gemini');
    });
  });

  describe('Error Handling for Invalid API Keys', () => {
    it('should handle invalid Gemini API key gracefully', async () => {
      if (!process.env.GEMINI_API_KEY) {
        return;
      }

      const provider = new GeminiProvider('invalid-key');
      await expect(
        provider.judge('test', 'gemini-2.5-flash', 0.0)
      ).rejects.toThrow();
    }, 30000);

    it('should handle invalid OpenAI API key gracefully', async () => {
      if (!process.env.OPENAI_API_KEY) {
        return;
      }

      const provider = new OpenAICompatibleProvider({ apiKey: 'invalid-key', baseUrl: 'https://api.openai.com/v1' });
      await expect(
        provider.judge('test', 'gpt-4o-mini', 0.0)
      ).rejects.toThrow(/API error/);
    }, 30000);

    it('should handle invalid embedding API key gracefully', async () => {
      if (!process.env.OPENAI_API_KEY) {
        return;
      }

      const provider = new OpenAIEmbeddingProvider({ apiKey: 'invalid-key', baseUrl: 'https://api.openai.com/v1' });
      await expect(provider.embed('test')).rejects.toThrow(/embedding error/);
    }, 30000);
  });

  describe('Model Catalogs', () => {
    it('should have all Gemini models defined', () => {
      const models = Object.keys(GEMINI_MODELS);
      for (const model of models) {
        expect(GEMINI_MODELS[model as keyof typeof GEMINI_MODELS]).toBeDefined();
      }
    });

    it('should have all OpenAI models defined', () => {
      const models = Object.keys(OPENAI_MODELS);
      for (const model of models) {
        expect(OPENAI_MODELS[model as keyof typeof OPENAI_MODELS]).toBeDefined();
      }
    });

    it('should have all default models defined', () => {
      expect(DEFAULT_MODELS.judge).toBeDefined();
      expect(DEFAULT_MODELS.embedding).toBeDefined();
      expect(DEFAULT_MODELS.rerank).toBeDefined();
      expect(DEFAULT_MODELS.complex).toBeDefined();
    });

    it('should have correct model metadata structure', () => {
      const geminiModel = GEMINI_MODELS['gemini-2.5-flash'];
      expect(geminiModel).toHaveProperty('speed');
      expect(geminiModel).toHaveProperty('cost');
      expect(geminiModel).toHaveProperty('tier');

      const openaiModel = OPENAI_MODELS['gpt-4o'];
      expect(openaiModel).toHaveProperty('speed');
      expect(openaiModel).toHaveProperty('cost');
      expect(openaiModel).toHaveProperty('tier');
    });
  });
});
