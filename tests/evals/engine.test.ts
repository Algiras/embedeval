/**
 * Tests for the Binary Evaluation Engine
 * Tests all eval types: assertion, regex, code, llm-judge
 * Tests EvalRegistry priority sorting and filtering
 */

import {
  AssertionEval,
  RegexEval,
  CodeEval,
  LLMJudgeEval,
  EvalRegistry,
} from '../../src/evals/engine';
import { Trace, EvalConfig } from '../../src/core/types';

// Mock logger to avoid console noise during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Evaluation Engine', () => {
  // Sample trace for testing
  const sampleTrace: Trace = {
    id: 'test-001',
    timestamp: new Date().toISOString(),
    query: 'What is the refund policy?',
    response: 'We offer full refunds within 30 days of purchase.',
    metadata: {
      provider: 'test',
      model: 'test-model',
      latency: 100,
    },
  };

  describe('AssertionEval', () => {
    let assertionEval: AssertionEval;

    beforeEach(() => {
      assertionEval = new AssertionEval();
    });

    it('should pass when response length check is true', async () => {
      const config: EvalConfig = {
        id: 'test-assertion-length',
        name: 'Response Length Check',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'response.length > 10' },
      };

      const result = await assertionEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
      expect(result.evalId).toBe('test-assertion-length');
      expect(result.explanation).toContain('true');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should fail when response length check is false', async () => {
      const config: EvalConfig = {
        id: 'test-assertion-fail',
        name: 'Response Too Long',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'response.length > 1000' },
      };

      const result = await assertionEval.run(sampleTrace, config);

      expect(result.passed).toBe(false);
      expect(result.explanation).toContain('false');
    });

    it('should access trace properties in assertion', async () => {
      const config: EvalConfig = {
        id: 'test-assertion-trace',
        name: 'Check Query',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'query.includes("refund")' },
      };

      const result = await assertionEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
    });

    it('should access metadata in assertion', async () => {
      const config: EvalConfig = {
        id: 'test-assertion-metadata',
        name: 'Check Latency',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'metadata.latency < 200' },
      };

      const result = await assertionEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
    });

    it('should handle invalid assertion expressions gracefully', async () => {
      const config: EvalConfig = {
        id: 'test-assertion-error',
        name: 'Invalid Check',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'undefinedVariable.something' },
      };

      const result = await assertionEval.run(sampleTrace, config);

      expect(result.passed).toBe(false);
      expect(result.explanation).toContain('Assertion error');
    });

    it('should handle context data in assertions', async () => {
      const traceWithContext: Trace = {
        ...sampleTrace,
        context: {
          retrievedDocs: [
            { id: 'doc1', content: 'Refund policy info', score: 0.9 },
          ],
        },
      };

      const config: EvalConfig = {
        id: 'test-assertion-context',
        name: 'Has Context',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'context && context.retrievedDocs.length > 0' },
      };

      const result = await assertionEval.run(traceWithContext, config);

      expect(result.passed).toBe(true);
    });
  });

  describe('RegexEval', () => {
    let regexEval: RegexEval;

    beforeEach(() => {
      regexEval = new RegexEval();
    });

    it('should pass when pattern is found and shouldMatch is true', async () => {
      const config: EvalConfig = {
        id: 'test-regex-match',
        name: 'Contains refund',
        type: 'regex',
        priority: 'cheap',
        config: { pattern: 'refund', shouldMatch: true, flags: 'i' },
      };

      const result = await regexEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
      expect(result.explanation).toContain('found');
    });

    it('should fail when pattern is not found and shouldMatch is true', async () => {
      const config: EvalConfig = {
        id: 'test-regex-no-match',
        name: 'Contains shipping',
        type: 'regex',
        priority: 'cheap',
        config: { pattern: 'shipping', shouldMatch: true },
      };

      const result = await regexEval.run(sampleTrace, config);

      expect(result.passed).toBe(false);
      expect(result.explanation).toContain('not found');
    });

    it('should pass when pattern is absent and shouldMatch is false', async () => {
      const config: EvalConfig = {
        id: 'test-regex-absent',
        name: 'No shipping mentioned',
        type: 'regex',
        priority: 'cheap',
        config: { pattern: 'shipping', shouldMatch: false },
      };

      const result = await regexEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
      expect(result.explanation).toContain('correctly absent');
    });

    it('should fail when pattern is unexpectedly found and shouldMatch is false', async () => {
      const config: EvalConfig = {
        id: 'test-regex-unexpected',
        name: 'Should not mention refund',
        type: 'regex',
        priority: 'cheap',
        config: { pattern: 'refund', shouldMatch: false },
      };

      const result = await regexEval.run(sampleTrace, config);

      expect(result.passed).toBe(false);
      expect(result.explanation).toContain('unexpectedly found');
    });

    it('should respect regex flags', async () => {
      const config: EvalConfig = {
        id: 'test-regex-flags',
        name: 'Case insensitive match',
        type: 'regex',
        priority: 'cheap',
        config: { pattern: 'REFUND', shouldMatch: true, flags: 'i' },
      };

      const result = await regexEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
    });

    it('should handle invalid regex patterns gracefully', async () => {
      const config: EvalConfig = {
        id: 'test-regex-invalid',
        name: 'Invalid regex',
        type: 'regex',
        priority: 'cheap',
        config: { pattern: '[invalid', shouldMatch: true },
      };

      const result = await regexEval.run(sampleTrace, config);

      expect(result.passed).toBe(false);
      expect(result.explanation).toContain('Regex error');
    });

    it('should handle complex regex patterns', async () => {
      const config: EvalConfig = {
        id: 'test-regex-complex',
        name: 'Days pattern',
        type: 'regex',
        priority: 'cheap',
        config: { pattern: '\\d+ days', shouldMatch: true },
      };

      const result = await regexEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
      expect(result.explanation).toContain('found');
    });
  });

  describe('CodeEval', () => {
    let codeEval: CodeEval;

    beforeEach(() => {
      codeEval = new CodeEval();
    });

    it('should pass when code returns true', async () => {
      const config: EvalConfig = {
        id: 'test-code-true',
        name: 'Check response length',
        type: 'code',
        priority: 'cheap',
        config: { function: 'return response.length > 10;' },
      };

      const result = await codeEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
      expect(result.explanation).toContain('true');
    });

    it('should fail when code returns false', async () => {
      const config: EvalConfig = {
        id: 'test-code-false',
        name: 'Check response too long',
        type: 'code',
        priority: 'cheap',
        config: { function: 'return response.length > 1000;' },
      };

      const result = await codeEval.run(sampleTrace, config);

      expect(result.passed).toBe(false);
      expect(result.explanation).toContain('false');
    });

    it('should handle object return with passed property', async () => {
      const config: EvalConfig = {
        id: 'test-code-object',
        name: 'Custom check with explanation',
        type: 'code',
        priority: 'cheap',
        config: {
          function: 'return { passed: true, explanation: "Custom reason" };',
        },
      };

      const result = await codeEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
      expect(result.explanation).toBe('Custom reason');
    });

    it('should access all trace parameters', async () => {
      const config: EvalConfig = {
        id: 'test-code-params',
        name: 'Check all params',
        type: 'code',
        priority: 'cheap',
        config: {
          function: `
            return query.includes('refund') && 
                   response.includes('days') && 
                   metadata.latency === 100;
          `,
        },
      };

      const result = await codeEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
    });

    it('should handle code errors gracefully', async () => {
      const config: EvalConfig = {
        id: 'test-code-error',
        name: 'Code with error',
        type: 'code',
        priority: 'cheap',
        config: { function: 'throw new Error("Test error");' },
      };

      const result = await codeEval.run(sampleTrace, config);

      expect(result.passed).toBe(false);
      expect(result.explanation).toContain('Code execution error');
      expect(result.explanation).toContain('Test error');
    });

    it('should handle syntax errors in code', async () => {
      const config: EvalConfig = {
        id: 'test-code-syntax',
        name: 'Invalid syntax',
        type: 'code',
        priority: 'cheap',
        config: { function: 'return {' },
      };

      const result = await codeEval.run(sampleTrace, config);

      expect(result.passed).toBe(false);
      expect(result.explanation).toContain('Code execution error');
    });

    it('should coerce non-boolean return values', async () => {
      const config: EvalConfig = {
        id: 'test-code-coerce',
        name: 'Return string',
        type: 'code',
        priority: 'cheap',
        config: { function: 'return "truthy value";' },
      };

      const result = await codeEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
    });
  });

  describe('LLMJudgeEval', () => {
    const mockJudgeFunction = jest.fn();
    let llmJudgeEval: LLMJudgeEval;

    beforeEach(() => {
      mockJudgeFunction.mockClear();
      llmJudgeEval = new LLMJudgeEval(mockJudgeFunction);
    });

    it('should pass when judge returns PASS', async () => {
      mockJudgeFunction.mockResolvedValue('PASS');

      const config: EvalConfig = {
        id: 'test-llm-judge',
        name: 'LLM Quality Check',
        type: 'llm-judge',
        priority: 'expensive',
        config: {
          model: 'gemini-2.5-flash',
          prompt: 'Is this response helpful? Answer PASS or FAIL.',
          temperature: 0,
        },
      };

      const result = await llmJudgeEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
      expect(mockJudgeFunction).toHaveBeenCalledWith(
        expect.stringContaining('Is this response helpful'),
        'gemini-2.5-flash',
        0
      );
    });

    it('should fail when judge returns FAIL', async () => {
      mockJudgeFunction.mockResolvedValue('FAIL');

      const config: EvalConfig = {
        id: 'test-llm-fail',
        name: 'LLM Quality Check',
        type: 'llm-judge',
        priority: 'expensive',
        config: {
          model: 'gemini-2.5-flash',
          prompt: 'Is this accurate?',
          temperature: 0,
        },
      };

      const result = await llmJudgeEval.run(sampleTrace, config);

      expect(result.passed).toBe(false);
    });

    it('should replace query placeholder in prompt', async () => {
      mockJudgeFunction.mockResolvedValue('PASS');

      const config: EvalConfig = {
        id: 'test-llm-query',
        name: 'Query Check',
        type: 'llm-judge',
        priority: 'expensive',
        config: {
          model: 'gemini-2.5-flash',
          prompt: 'Query: {query}',
          temperature: 0,
        },
      };

      await llmJudgeEval.run(sampleTrace, config);

      expect(mockJudgeFunction).toHaveBeenCalledWith(
        expect.stringContaining('What is the refund policy?'),
        expect.any(String),
        expect.any(Number)
      );
    });

    it('should replace response placeholder in prompt', async () => {
      mockJudgeFunction.mockResolvedValue('PASS');

      const config: EvalConfig = {
        id: 'test-llm-response',
        name: 'Response Check',
        type: 'llm-judge',
        priority: 'expensive',
        config: {
          model: 'gemini-2.5-flash',
          prompt: 'Response: {response}',
          temperature: 0,
        },
      };

      await llmJudgeEval.run(sampleTrace, config);

      expect(mockJudgeFunction).toHaveBeenCalledWith(
        expect.stringContaining('We offer full refunds'),
        expect.any(String),
        expect.any(Number)
      );
    });

    it('should handle judge function errors', async () => {
      mockJudgeFunction.mockRejectedValue(new Error('API Error'));

      const config: EvalConfig = {
        id: 'test-llm-error',
        name: 'LLM Check',
        type: 'llm-judge',
        priority: 'expensive',
        config: {
          model: 'gemini-2.5-flash',
          prompt: 'Check this',
          temperature: 0,
        },
      };

      const result = await llmJudgeEval.run(sampleTrace, config);

      expect(result.passed).toBe(false);
      expect(result.explanation).toContain('API Error');
    });

    it('should extract explanation from judge response', async () => {
      mockJudgeFunction.mockResolvedValue('PASS The response is accurate and helpful');

      const config: EvalConfig = {
        id: 'test-llm-explanation',
        name: 'LLM Check',
        type: 'llm-judge',
        priority: 'expensive',
        config: {
          model: 'gemini-2.5-flash',
          prompt: 'Check this',
          temperature: 0,
        },
      };

      const result = await llmJudgeEval.run(sampleTrace, config);

      expect(result.passed).toBe(true);
      expect(result.explanation).toBe('The response is accurate and helpful');
    });

    it('should format context for LLM', async () => {
      mockJudgeFunction.mockResolvedValue('PASS');

      const traceWithContext: Trace = {
        ...sampleTrace,
        context: {
          retrievedDocs: [
            { id: 'doc1', content: 'Refund policy: 30 days', score: 0.95 },
            { id: 'doc2', content: 'Another doc', score: 0.8 },
          ],
        },
      };

      const config: EvalConfig = {
        id: 'test-llm-context',
        name: 'Context Check',
        type: 'llm-judge',
        priority: 'expensive',
        config: {
          model: 'gemini-2.5-flash',
          prompt: 'Context: {context}',
          temperature: 0,
        },
      };

      await llmJudgeEval.run(traceWithContext, config);

      expect(mockJudgeFunction).toHaveBeenCalledWith(
        expect.stringContaining('[1]'),
        expect.any(String),
        expect.any(Number)
      );
    });
  });

  describe('EvalRegistry', () => {
    let registry: EvalRegistry;
    const mockJudgeFunction = jest.fn().mockResolvedValue('PASS');

    beforeEach(() => {
      registry = new EvalRegistry(mockJudgeFunction);
    });

    it('should register evals', () => {
      const config: EvalConfig = {
        id: 'test-eval',
        name: 'Test Eval',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'true' },
      };

      registry.register(config);

      expect(registry.get('test-eval')).toEqual(config);
      expect(registry.list()).toHaveLength(1);
    });

    it('should run cheap evals before expensive evals', async () => {
      const cheapConfig: EvalConfig = {
        id: 'cheap-eval',
        name: 'Cheap Eval',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'true' },
      };

      const expensiveConfig: EvalConfig = {
        id: 'expensive-eval',
        name: 'Expensive Eval',
        type: 'llm-judge',
        priority: 'expensive',
        config: { model: 'test', prompt: 'test', temperature: 0 },
      };

      registry.register(cheapConfig);
      registry.register(expensiveConfig);

      const results = await registry.runAll(sampleTrace);

      expect(results).toHaveLength(2);
      expect(results[0].evalId).toBe('cheap-eval');
      expect(results[1].evalId).toBe('expensive-eval');
    });

    it('should filter evals by ID', async () => {
      const config1: EvalConfig = {
        id: 'eval-1',
        name: 'Eval 1',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'true' },
      };

      const config2: EvalConfig = {
        id: 'eval-2',
        name: 'Eval 2',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'true' },
      };

      registry.register(config1);
      registry.register(config2);

      const results = await registry.runAll(sampleTrace, { filter: ['eval-1'] });

      expect(results).toHaveLength(1);
      expect(results[0].evalId).toBe('eval-1');
    });

    it('should stop on first cheap failure when stopOnFail is true', async () => {
      const failingConfig: EvalConfig = {
        id: 'failing-eval',
        name: 'Failing Eval',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'false' },
      };

      const passingConfig: EvalConfig = {
        id: 'passing-eval',
        name: 'Passing Eval',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'true' },
      };

      registry.register(failingConfig);
      registry.register(passingConfig);

      const results = await registry.runAll(sampleTrace, { stopOnFail: true });

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
    });

    it('should continue after expensive eval failure even with stopOnFail', async () => {
      mockJudgeFunction.mockResolvedValue('FAIL');

      const cheapConfig: EvalConfig = {
        id: 'cheap-eval',
        name: 'Cheap Eval',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'true' },
      };

      const expensiveConfig: EvalConfig = {
        id: 'expensive-eval',
        name: 'Expensive Eval',
        type: 'llm-judge',
        priority: 'expensive',
        config: { model: 'test', prompt: 'test', temperature: 0 },
      };

      registry.register(cheapConfig);
      registry.register(expensiveConfig);

      const results = await registry.runAll(sampleTrace, { stopOnFail: true });

      // Both should run because only cheap failures stop execution
      expect(results).toHaveLength(2);
    });

    it('should handle unknown eval types gracefully', async () => {
      const config = {
        id: 'unknown-eval',
        name: 'Unknown Eval',
        type: 'unknown-type' as any,
        priority: 'cheap',
        config: { check: 'true' },
      } as EvalConfig;

      registry.register(config);

      const results = await registry.runAll(sampleTrace);

      expect(results).toHaveLength(0); // Unknown types are skipped
    });

    it('should handle runner errors gracefully', async () => {
      const config: EvalConfig = {
        id: 'error-eval',
        name: 'Error Eval',
        type: 'code',
        priority: 'cheap',
        config: { function: 'throw new Error("Runner error")' },
      };

      registry.register(config);

      const results = await registry.runAll(sampleTrace);

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].explanation).toContain('Runner error');
    });

    it('should return empty results when no evals registered', async () => {
      const results = await registry.runAll(sampleTrace);
      expect(results).toEqual([]);
    });

    it('should list all registered evals', () => {
      const config1: EvalConfig = {
        id: 'eval-1',
        name: 'Eval 1',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'true' },
      };

      const config2: EvalConfig = {
        id: 'eval-2',
        name: 'Eval 2',
        type: 'regex',
        priority: 'cheap',
        config: { pattern: 'test', shouldMatch: true },
      };

      registry.register(config1);
      registry.register(config2);

      const list = registry.list();

      expect(list).toHaveLength(2);
      expect(list.map(e => e.id)).toContain('eval-1');
      expect(list.map(e => e.id)).toContain('eval-2');
    });

    it('should return undefined for unregistered eval', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });
});
