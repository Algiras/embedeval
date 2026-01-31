/**
 * SDK Evaluate Module Tests
 * 
 * Comprehensive tests for the core SDK evaluation functions.
 * Mocks LLM providers and eval engine to avoid actual API calls.
 */

import { evaluate, quickEval, getBuiltinEvals, getBuiltinEval, BUILTIN_EVALS } from '../../src/sdk/evaluate';
import { EvaluateOptions } from '../../src/sdk/types';
import { EvalConfig } from '../../src/shared/types';
import { EvalRegistry } from '../../src/evals/engine';
import { createJudge } from '../../src/utils/llm-providers';
import { getSuggestions } from '../../src/sdk/suggestions';
import { v4 as uuidv4 } from 'uuid';

// Mocks
jest.mock('uuid');
jest.mock('../../src/evals/engine');
jest.mock('../../src/utils/llm-providers');
jest.mock('../../src/sdk/suggestions');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('SDK Evaluate Module', () => {
  const mockUuid = 'test-trace-id-123';
  const mockDate = '2026-01-31T10:00:00.000Z';
  const mockRegistry = {
    register: jest.fn(),
    runAll: jest.fn(),
  };
  const mockJudge = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue(mockUuid);
    jest.useFakeTimers();
    jest.setSystemTime(new Date(mockDate));
    
    (EvalRegistry as jest.Mock).mockImplementation(() => mockRegistry);
    (createJudge as jest.Mock).mockReturnValue(mockJudge);
    (getSuggestions as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Base options for testing
  const baseOptions: EvaluateOptions = {
    query: 'What is the refund policy?',
  };

  describe('evaluate()', () => {

    it('should evaluate a response with default evals (coherence, helpful)', async () => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'builtin-coherence', passed: true, latency: 100 },
        { evalId: 'builtin-helpful', passed: true, latency: 150 },
      ]);

      const result = await evaluate('Test response', baseOptions);

      expect(result.traceId).toBe(mockUuid);
      expect(result.passed).toBe(true);
      expect(result.passRate).toBe(100);
      expect(result.summary.total).toBe(2);
      expect(result.summary.passed).toBe(2);
      expect(result.summary.failed).toBe(0);
      expect(mockRegistry.register).toHaveBeenCalledTimes(2);
      expect(mockRegistry.runAll).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUuid,
          query: baseOptions.query,
          response: 'Test response',
          metadata: { source: 'sdk' },
        }),
        { stopOnFail: undefined }
      );
    });

    it('should evaluate with custom built-in eval names', async () => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'builtin-safe', passed: true, latency: 50 },
        { evalId: 'builtin-complete', passed: true, latency: 60 },
      ]);

      const result = await evaluate('Test response', {
        ...baseOptions,
        evals: ['safe', 'complete'],
      });

      expect(result.summary.total).toBe(2);
      expect(result.passed).toBe(true);
      expect(mockRegistry.register).toHaveBeenCalledTimes(2);
    });

    it('should evaluate with custom EvalConfig objects', async () => {
      const customEval: EvalConfig = {
        id: 'custom-eval',
        name: 'Custom Check',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'response.length > 10' },
      };

      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'custom-eval', passed: true, latency: 10 },
      ]);

      const result = await evaluate('Test response', {
        ...baseOptions,
        evals: [customEval],
      });

      expect(result.summary.total).toBe(1);
      expect(mockRegistry.register).toHaveBeenCalledWith(customEval);
    });

    it('should mix built-in names and custom configs', async () => {
      const customEval: EvalConfig = {
        id: 'custom-eval',
        name: 'Custom Check',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'true' },
      };

      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'builtin-coherence', passed: true, latency: 100 },
        { evalId: 'custom-eval', passed: true, latency: 10 },
      ]);

      const result = await evaluate('Test response', {
        ...baseOptions,
        evals: ['coherence', customEval],
      });

      expect(result.summary.total).toBe(2);
      expect(mockRegistry.register).toHaveBeenCalledTimes(2);
    });

    it('should handle eval failures correctly', async () => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'builtin-coherence', passed: true, latency: 100 },
        { evalId: 'builtin-helpful', passed: false, latency: 150, failureCategory: 'incoherent' },
      ]);

      const result = await evaluate('Test response', baseOptions);

      expect(result.passed).toBe(false);
      expect(result.passRate).toBe(50);
      expect(result.summary.passed).toBe(1);
      expect(result.summary.failed).toBe(1);
      expect(result.failureCategories).toContain('incoherent');
    });

    it('should stop on first failure when stopOnFail is true', async () => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'builtin-coherence', passed: false, latency: 100 },
      ]);

      const result = await evaluate('Test response', {
        ...baseOptions,
        stopOnFail: true,
      });

      expect(result.passed).toBe(false);
      expect(mockRegistry.runAll).toHaveBeenCalledWith(
        expect.any(Object),
        { stopOnFail: true }
      );
    });

    it('should include context in trace when provided', async () => {
      mockRegistry.runAll.mockResolvedValue([]);

      const context = {
        retrievedDocs: [{ id: 'doc1', content: 'Context content', score: 0.9 }],
      };

      await evaluate('Test response', {
        ...baseOptions,
        context,
      });

      expect(mockRegistry.runAll).toHaveBeenCalledWith(
        expect.objectContaining({ context }),
        expect.any(Object)
      );
    });

    it('should include metadata in trace when provided', async () => {
      mockRegistry.runAll.mockResolvedValue([]);

      const metadata = { model: 'gpt-4', latency: 200, cost: 0.01 };

      await evaluate('Test response', {
        ...baseOptions,
        metadata,
      });

      expect(mockRegistry.runAll).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { ...metadata, source: 'sdk' },
        }),
        expect.any(Object)
      );
    });

    it('should warn for unknown eval names', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockRegistry.runAll.mockResolvedValue([]);

      await evaluate('Test response', {
        ...baseOptions,
        evals: ['unknown-eval', 'coherence'],
      });

      expect(consoleSpy).toHaveBeenCalledWith('Unknown eval: unknown-eval, skipping');
      expect(mockRegistry.register).toHaveBeenCalledTimes(1); // Only coherence
      consoleSpy.mockRestore();
    });

    it('should return 100% pass rate when no evals run', async () => {
      mockRegistry.runAll.mockResolvedValue([]);

      const result = await evaluate('Test response', {
        ...baseOptions,
        evals: [],
      });

      expect(result.passRate).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.summary.total).toBe(0);
    });

    it('should calculate latency correctly', async () => {
      jest.useRealTimers();
      mockRegistry.runAll.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve([
          { evalId: 'test', passed: true, latency: 100 },
        ]), 50))
      );

      const startTime = Date.now();
      const result = await evaluate('Test response', baseOptions);
      const actualLatency = Date.now() - startTime;

      expect(result.latency).toBeGreaterThan(0);
      expect(result.latency).toBeLessThan(actualLatency + 100);
    });

    it('should get suggestions when there are failures', async () => {
      const evalResults = [
        { evalId: 'builtin-helpful', passed: false, failureCategory: 'irrelevant' },
      ];
      mockRegistry.runAll.mockResolvedValue(evalResults);
      
      const mockSuggestions = [
        { category: 'irrelevant', severity: 'high', action: 'Focus on the question' },
      ];
      (getSuggestions as jest.Mock).mockResolvedValue(mockSuggestions);

      const result = await evaluate('Test response', baseOptions);

      expect(getSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockUuid }),
        evalResults
      );
      expect(result.suggestions).toEqual(['Focus on the question']);
    });

    it('should not get suggestions when all evals pass', async () => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'builtin-coherence', passed: true },
      ]);

      await evaluate('Test response', baseOptions);

      expect(getSuggestions).not.toHaveBeenCalled();
    });

    it('should handle suggestions error gracefully', async () => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'builtin-helpful', passed: false },
      ]);
      (getSuggestions as jest.Mock).mockRejectedValue(new Error('Suggestion error'));

      // Should not throw
      const result = await evaluate('Test response', baseOptions);

      expect(result.passed).toBe(false);
      expect(result.suggestions).toBeUndefined();
    });

    it('should deduplicate failure categories', async () => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'eval1', passed: false, failureCategory: 'hallucination' },
        { evalId: 'eval2', passed: false, failureCategory: 'hallucination' },
        { evalId: 'eval3', passed: false, failureCategory: 'incomplete' },
      ]);

      const result = await evaluate('Test response', baseOptions);

      expect(result.failureCategories).toEqual(['hallucination', 'incomplete']);
    });

    it('should handle undefined failure categories', async () => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'eval1', passed: false },
        { evalId: 'eval2', passed: false, failureCategory: 'error' },
      ]);

      const result = await evaluate('Test response', baseOptions);

      expect(result.failureCategories).toEqual(['error']);
    });
  });

  describe('quickEval()', () => {
    beforeEach(() => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'builtin-coherence', passed: true },
        { evalId: 'builtin-helpful', passed: true },
      ]);
    });

    it('should return true when both default evals pass', async () => {
      const result = await quickEval('Good response', 'What is the refund policy?');
      
      expect(result).toBe(true);
      expect(mockRegistry.runAll).toHaveBeenCalledWith(
        expect.any(Object),
        { stopOnFail: true }
      );
    });

    it('should return false when any eval fails', async () => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'builtin-coherence', passed: true },
        { evalId: 'builtin-helpful', passed: false },
      ]);

      const result = await quickEval('Bad response', 'What is the refund policy?');
      
      expect(result).toBe(false);
    });

    it('should pass context as retrievedDocs when provided', async () => {
      const context = 'Some context information';
      
      await quickEval('Response', 'Query', context);

      expect(mockRegistry.runAll).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            retrievedDocs: [{ id: 'ctx', content: context }],
          },
        }),
        expect.any(Object)
      );
    });

    it('should not include context when not provided', async () => {
      await quickEval('Response', 'Query');

      expect(mockRegistry.runAll).toHaveBeenCalledWith(
        expect.objectContaining({
          context: undefined,
        }),
        expect.any(Object)
      );
    });
  });

  describe('getBuiltinEvals()', () => {
    it('should return all built-in eval names', () => {
      const evals = getBuiltinEvals();

      expect(evals).toContain('coherence');
      expect(evals).toContain('factual');
      expect(evals).toContain('helpful');
      expect(evals).toContain('complete');
      expect(evals).toContain('safe');
      expect(evals).toContain('uses-context');
      expect(evals).toContain('no-hallucination');
      expect(evals).toContain('has-sources');
      expect(evals).toHaveLength(8);
    });
  });

  describe('getBuiltinEval()', () => {
    it('should return config for coherence eval', () => {
      const config = getBuiltinEval('coherence');

      expect(config).toEqual({
        id: 'builtin-coherence',
        name: 'Coherence',
        description: 'Check if response is coherent and well-structured',
        type: 'llm-judge',
        priority: 'cheap',
        config: {
          model: 'gemini-2.5-flash-lite',
          temperature: 0.0,
          prompt: expect.stringContaining('coherent'),
          binary: true,
        },
      });
    });

    it('should return config for uses-context eval', () => {
      const config = getBuiltinEval('uses-context');

      expect(config).toEqual({
        id: 'builtin-uses-context',
        name: 'Uses Context',
        description: 'Check if response uses retrieved context',
        type: 'code',
        priority: 'cheap',
        config: {
          function: expect.stringContaining('retrievedDocs'),
        },
      });
    });

    it('should return config for has-sources eval', () => {
      const config = getBuiltinEval('has-sources');

      expect(config).toEqual({
        id: 'builtin-has-sources',
        name: 'Has Sources',
        description: 'Check if response cites sources',
        type: 'regex',
        priority: 'cheap',
        config: {
          pattern: '(according to|based on|source:|reference:|\\[\\d+\\])',
          shouldMatch: true,
          flags: 'i',
        },
      });
    });

    it('should return undefined for unknown eval name', () => {
      const config = getBuiltinEval('unknown-eval');

      expect(config).toBeUndefined();
    });
  });

  describe('BUILTIN_EVALS mapping', () => {
    it('should have all eval IDs correctly mapped', () => {
      expect(BUILTIN_EVALS['coherence'].id).toBe('builtin-coherence');
      expect(BUILTIN_EVALS['factual'].id).toBe('builtin-factual');
      expect(BUILTIN_EVALS['helpful'].id).toBe('builtin-helpful');
      expect(BUILTIN_EVALS['complete'].id).toBe('builtin-complete');
      expect(BUILTIN_EVALS['safe'].id).toBe('builtin-safe');
      expect(BUILTIN_EVALS['uses-context'].id).toBe('builtin-uses-context');
      expect(BUILTIN_EVALS['no-hallucination'].id).toBe('builtin-no-hallucination');
      expect(BUILTIN_EVALS['has-sources'].id).toBe('builtin-has-sources');
    });

    it('should categorize evals by priority correctly', () => {
      const cheapEvals = Object.values(BUILTIN_EVALS).filter(e => e.priority === 'cheap');
      const expensiveEvals = Object.values(BUILTIN_EVALS).filter(e => e.priority === 'expensive');

      expect(cheapEvals.map(e => e.id)).toEqual([
        'builtin-coherence',
        'builtin-helpful',
        'builtin-complete',
        'builtin-safe',
        'builtin-uses-context',
        'builtin-has-sources',
      ]);

      expect(expensiveEvals.map(e => e.id)).toEqual([
        'builtin-factual',
        'builtin-no-hallucination',
      ]);
    });

    it('should use appropriate models for LLM judges', () => {
      const llmJudges = Object.values(BUILTIN_EVALS).filter(e => e.type === 'llm-judge');
      
      // Cheap evals use flash-lite
      const cheapLlms = llmJudges.filter(e => e.priority === 'cheap');
      cheapLlms.forEach(e => {
        expect(e.config.model).toBe('gemini-2.5-flash-lite');
      });

      // Expensive evals use flash
      const expensiveLlms = llmJudges.filter(e => e.priority === 'expensive');
      expensiveLlms.forEach(e => {
        expect(e.config.model).toBe('gemini-2.5-flash');
      });
    });

    it('should have correct type distribution', () => {
      const types = Object.values(BUILTIN_EVALS).reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(types).toEqual({
        'llm-judge': 6,
        'code': 1,
        'regex': 1,
      });
    });

    it('should have unique IDs for all evals', () => {
      const ids = Object.values(BUILTIN_EVALS).map(e => e.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have binary flag for all LLM judges', () => {
      const llmJudges = Object.values(BUILTIN_EVALS).filter(e => e.type === 'llm-judge');
      
      llmJudges.forEach(e => {
        expect(e.config.binary).toBe(true);
      });
    });

    it('should have temperature set to 0 for all LLM judges', () => {
      const llmJudges = Object.values(BUILTIN_EVALS).filter(e => e.type === 'llm-judge');
      
      llmJudges.forEach(e => {
        expect(e.config.temperature).toBe(0.0);
      });
    });

    it('should include query placeholder in relevant prompts', () => {
      const promptBased = Object.values(BUILTIN_EVALS).filter(
        e => e.type === 'llm-judge' && e.config.prompt
      );
      
      const withQuery = promptBased.filter(e => e.config.prompt?.includes('{query}'));
      
      expect(withQuery.map(e => e.id)).toContain('builtin-helpful');
      expect(withQuery.map(e => e.id)).toContain('builtin-complete');
    });

    it('should include response placeholder in all LLM prompts', () => {
      const llmJudges = Object.values(BUILTIN_EVALS).filter(e => e.type === 'llm-judge');
      
      llmJudges.forEach(e => {
        expect(e.config.prompt).toContain('{response}');
      });
    });

    it('should include context placeholder in context-aware evals', () => {
      const contextAware = ['factual', 'no-hallucination'];

      contextAware.forEach(evalName => {
        const eval_ = BUILTIN_EVALS[evalName];
        expect(eval_).toBeDefined();
        expect(eval_.config.prompt).toContain('{context}');
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle empty response', async () => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'builtin-coherence', passed: false },
      ]);

      const result = await evaluate('', baseOptions);

      expect(result.passed).toBe(false);
      expect(result.results).toHaveLength(1);
    });

    it('should handle long responses', async () => {
      const longResponse = 'A'.repeat(10000);
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'builtin-coherence', passed: true },
      ]);

      await evaluate(longResponse, baseOptions);

      expect(mockRegistry.runAll).toHaveBeenCalledWith(
        expect.objectContaining({ response: longResponse }),
        expect.any(Object)
      );
    });

    it('should handle complex context with multiple docs', async () => {
      const complexContext = {
        retrievedDocs: [
          { id: 'doc1', content: 'First doc', score: 0.95 },
          { id: 'doc2', content: 'Second doc', score: 0.85 },
          { id: 'doc3', content: 'Third doc', score: 0.75 },
        ],
        queryEmbedding: [0.1, 0.2, 0.3],
      };

      mockRegistry.runAll.mockResolvedValue([]);

      await evaluate('Response', {
        ...baseOptions,
        context: complexContext,
      });

      expect(mockRegistry.runAll).toHaveBeenCalledWith(
        expect.objectContaining({ context: complexContext }),
        expect.any(Object)
      );
    });

    it('should handle eval errors gracefully', async () => {
      mockRegistry.runAll.mockRejectedValue(new Error('Registry error'));

      await expect(evaluate('Test', baseOptions)).rejects.toThrow('Registry error');
    });

    it('should handle malformed eval results', async () => {
      mockRegistry.runAll.mockResolvedValue([
        { evalId: 'eval1', passed: true },
        null,
        { evalId: 'eval3', passed: false },
        undefined,
      ]);

      const result = await evaluate('Test', baseOptions);

      // Should filter out null/undefined
      expect(result.summary.total).toBe(2); // Only valid results
      expect(result.summary.passed).toBe(1);
      expect(result.summary.failed).toBe(1);
      expect(result.results).toHaveLength(4); // Original results (includes null/undefined)
    });
  });
});
