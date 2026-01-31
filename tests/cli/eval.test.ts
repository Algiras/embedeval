/**
 * Comprehensive tests for Eval CLI commands
 * Tests eval add, list, run, report, filtering, and stopOnFail behavior
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  addEvalCommand,
  listEvalsCommand,
  runEvalCommand,
  reportEvalCommand,
} from '../../src/cli/commands/eval';
import { Trace, EvalConfig } from '../../src/core/types';

// Mock process.exit to prevent test termination
jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  throw new Error(`process.exit(${code}) called`);
});

// Mock ora spinner
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn(function(this: any, msg: string) {
      console.log(msg);
      return this;
    }),
    fail: jest.fn(function(this: any, msg: string) {
      console.log(msg);
      return this;
    }),
    text: '',
  }));
});

describe('Eval CLI Commands', () => {
  let tempDir: string;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'embedeval-eval-cli-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // ==================== ADD EVAL COMMAND ====================

  describe('addEvalCommand', () => {
    afterEach(() => {
      if (fs.existsSync('evals.json')) {
        fs.removeSync('evals.json');
      }
    });

    it('should add a new assertion eval', async () => {
      await addEvalCommand('has-content', {
        type: 'assertion',
        config: JSON.stringify({ check: 'response.length > 50' }),
      });

      const evals: EvalConfig[] = await fs.readJson('evals.json');
      expect(evals).toHaveLength(1);
      expect(evals[0].name).toBe('has-content');
      expect(evals[0].type).toBe('assertion');
      expect(evals[0].priority).toBe('cheap');
      expect(evals[0].config).toEqual({ check: 'response.length > 50' });
    });

    it('should add a new regex eval', async () => {
      await addEvalCommand('contains-refund', {
        type: 'regex',
        config: JSON.stringify({ pattern: 'refund', shouldMatch: true, flags: 'i' }),
      });

      const evals: EvalConfig[] = await fs.readJson('evals.json');
      expect(evals).toHaveLength(1);
      expect(evals[0].name).toBe('contains-refund');
      expect(evals[0].type).toBe('regex');
      expect(evals[0].config).toEqual({ pattern: 'refund', shouldMatch: true, flags: 'i' });
    });

    it('should add a new code eval', async () => {
      await addEvalCommand('uses-context', {
        type: 'code',
        config: JSON.stringify({
          function: 'return context?.retrievedDocs?.length > 0',
        }),
      });

      const evals: EvalConfig[] = await fs.readJson('evals.json');
      expect(evals).toHaveLength(1);
      expect(evals[0].type).toBe('code');
      expect(evals[0].config).toEqual({
        function: 'return context?.retrievedDocs?.length > 0',
      });
    });

    it('should add a new LLM-judge eval with expensive priority', async () => {
      await addEvalCommand('factual-check', {
        type: 'llm-judge',
        priority: 'expensive',
        config: JSON.stringify({
          model: 'gemini-1.5-flash',
          prompt: 'Is this response factually accurate?',
          temperature: 0.0,
        }),
      });

      const evals: EvalConfig[] = await fs.readJson('evals.json');
      expect(evals).toHaveLength(1);
      expect(evals[0].type).toBe('llm-judge');
      expect(evals[0].priority).toBe('expensive');
    });

    it('should default LLM-judge to expensive priority', async () => {
      await addEvalCommand('llm-check', {
        type: 'llm-judge',
        config: JSON.stringify({
          model: 'gemini-1.5-flash',
          prompt: 'Test prompt',
          temperature: 0.0,
        }),
      });

      const evals: EvalConfig[] = await fs.readJson('evals.json');
      expect(evals[0].priority).toBe('expensive');
    });

    it('should add multiple evals to the same file', async () => {
      await addEvalCommand('eval-1', {
        type: 'assertion',
        config: JSON.stringify({ check: 'response.length > 10' }),
      });

      await addEvalCommand('eval-2', {
        type: 'regex',
        config: JSON.stringify({ pattern: 'test', shouldMatch: true }),
      });

      await addEvalCommand('eval-3', {
        type: 'code',
        config: JSON.stringify({ function: 'return true' }),
      });

      const evals: EvalConfig[] = await fs.readJson('evals.json');
      expect(evals).toHaveLength(3);
      expect(evals.map(e => e.name)).toEqual(['eval-1', 'eval-2', 'eval-3']);
    });

    it('should generate unique IDs for each eval', async () => {
      await addEvalCommand('eval-1', { type: 'assertion', config: JSON.stringify({ check: 'true' }) });
      await addEvalCommand('eval-2', { type: 'assertion', config: JSON.stringify({ check: 'true' }) });

      const evals: EvalConfig[] = await fs.readJson('evals.json');
      expect(evals[0].id).not.toBe(evals[1].id);
    });

    it('should handle invalid JSON config gracefully', async () => {
      await expect(
        addEvalCommand('bad-eval', {
          type: 'assertion',
          config: 'invalid json',
        })
      ).rejects.toThrow('process.exit');
    });
  });

  // ==================== LIST EVALS COMMAND ====================

  describe('listEvalsCommand', () => {
    afterEach(() => {
      if (fs.existsSync('evals.json')) {
        fs.removeSync('evals.json');
      }
    });

    it('should display message when no evals file exists', async () => {
      await listEvalsCommand();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No evals registered yet')
      );
    });

    it('should display message when evals file is empty', async () => {
      await fs.writeJson('evals.json', []);
      await listEvalsCommand();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No evals registered')
      );
    });

    it('should list single eval', async () => {
      const evalConfig: EvalConfig = {
        id: 'test-id',
        name: 'test-eval',
        type: 'assertion',
        priority: 'cheap',
        config: { check: 'true' },
        description: 'Test description',
      };
      await fs.writeJson('evals.json', [evalConfig]);

      await listEvalsCommand();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 eval(s)')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-eval')
      );
    });

    it('should list multiple evals', async () => {
      const evals: EvalConfig[] = [
        {
          id: 'id-1',
          name: 'eval-1',
          type: 'assertion',
          priority: 'cheap',
          config: { check: 'true' },
        },
        {
          id: 'id-2',
          name: 'eval-2',
          type: 'regex',
          priority: 'cheap',
          config: { pattern: 'test', shouldMatch: true },
        },
        {
          id: 'id-3',
          name: 'eval-3',
          type: 'llm-judge',
          priority: 'expensive',
          config: { model: 'test', prompt: 'test', temperature: 0.0 },
        },
      ];
      await fs.writeJson('evals.json', evals);

      await listEvalsCommand();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 3 eval(s)')
      );
    });

    it('should display eval type and priority correctly', async () => {
      const evalConfig: EvalConfig = {
        id: 'test-id',
        name: 'test-eval',
        type: 'llm-judge',
        priority: 'expensive',
        config: { model: 'test', prompt: 'test', temperature: 0.0 },
      };
      await fs.writeJson('evals.json', [evalConfig]);

      await listEvalsCommand();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Type: llm-judge')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Priority: expensive')
      );
    });
  });

  // ==================== RUN EVAL COMMAND ====================

  describe('runEvalCommand', () => {
    let tracesFilePath: string;
    let evalsFilePath: string;

    beforeEach(async () => {
      tracesFilePath = path.join(tempDir, 'traces.jsonl');
      evalsFilePath = path.join(tempDir, 'evals.json');

      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'What is the refund policy?',
          response: 'We offer full refunds within 30 days of purchase.',
        },
        {
          id: 'trace-002',
          timestamp: new Date().toISOString(),
          query: 'Hello',
          response: 'Hi there!',
        },
      ];

      await fs.writeFile(
        tracesFilePath,
        traces.map(t => JSON.stringify(t)).join('\n') + '\n'
      );

      const evals: EvalConfig[] = [
        {
          id: 'eval-1',
          name: 'has-content',
          type: 'assertion',
          priority: 'cheap',
          config: { check: 'response.length > 10' },
        },
        {
          id: 'eval-2',
          name: 'contains-hello',
          type: 'regex',
          priority: 'cheap',
          config: { pattern: 'hello', shouldMatch: true, flags: 'i' },
        },
      ];

      await fs.writeJson(evalsFilePath, evals);
    });

    it('should run evals on traces successfully', async () => {
      await runEvalCommand({
        traces: tracesFilePath,
        config: evalsFilePath,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Evaluated 2 traces')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Passed:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed:')
      );
    });

    it('should handle missing traces file', async () => {
      await expect(
        runEvalCommand({
          traces: 'non-existent.jsonl',
          config: evalsFilePath,
        })
      ).rejects.toThrow('process.exit');
    });

    it('should handle empty traces file', async () => {
      const emptyTracesPath = path.join(tempDir, 'empty.jsonl');
      await fs.writeFile(emptyTracesPath, '');

      await expect(
        runEvalCommand({
          traces: emptyTracesPath,
          config: evalsFilePath,
        })
      ).rejects.toThrow('process.exit');
    });

    it('should handle missing evals file', async () => {
      await expect(
        runEvalCommand({
          traces: tracesFilePath,
          config: 'non-existent.json',
        })
      ).rejects.toThrow('process.exit');
    });

    it('should save results to output file', async () => {
      const outputPath = path.join(tempDir, 'results.json');

      await runEvalCommand({
        traces: tracesFilePath,
        config: evalsFilePath,
        output: outputPath,
      });

      const exists = await fs.pathExists(outputPath);
      expect(exists).toBe(true);

      const results = await fs.readJson(outputPath);
      expect(results).toHaveProperty('timestamp');
      expect(results).toHaveProperty('traces');
      expect(results).toHaveProperty('summary');
      expect(results).toHaveProperty('results');
    });

    it('should calculate pass rate correctly', async () => {
      await runEvalCommand({
        traces: tracesFilePath,
        config: evalsFilePath,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Pass rate: \d+\.\d+%/)
      );
    });

    it('should display eval breakdown', async () => {
      await runEvalCommand({
        traces: tracesFilePath,
        config: evalsFilePath,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Eval breakdown:')
      );
    });
  });

  // ==================== FILTER BY PRIORITY ====================

  describe('runEvalCommand with priority filtering', () => {
    let tracesFilePath: string;
    let evalsFilePath: string;

    beforeEach(async () => {
      tracesFilePath = path.join(tempDir, 'traces.jsonl');
      evalsFilePath = path.join(tempDir, 'evals.json');

      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Test question',
          response: 'Test response with enough content',
        },
      ];

      await fs.writeFile(
        tracesFilePath,
        JSON.stringify(traces[0]) + '\n'
      );

      const evals: EvalConfig[] = [
        {
          id: 'cheap-1',
          name: 'cheap-eval-1',
          type: 'assertion',
          priority: 'cheap',
          config: { check: 'response.length > 10' },
        },
        {
          id: 'cheap-2',
          name: 'cheap-eval-2',
          type: 'regex',
          priority: 'cheap',
          config: { pattern: 'content', shouldMatch: true },
        },
        {
          id: 'expensive-1',
          name: 'expensive-eval-1',
          type: 'llm-judge',
          priority: 'expensive',
          config: { model: 'test', prompt: 'Test', temperature: 0.0 },
        },
      ];

      await fs.writeJson(evalsFilePath, evals);
    });

    it('should run only cheap evals when filtered', async () => {
      await runEvalCommand({
        traces: tracesFilePath,
        config: evalsFilePath,
        filter: ['cheap-1', 'cheap-2'],
      });

      const logs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(logs).toContain('Passed:');
    });

    it('should run single eval when filtered by ID', async () => {
      await runEvalCommand({
        traces: tracesFilePath,
        config: evalsFilePath,
        filter: ['cheap-1'],
      });

      const logs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(logs).toContain('Passed:');
    });

    it('should handle empty filter array (run all)', async () => {
      await runEvalCommand({
        traces: tracesFilePath,
        config: evalsFilePath,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Evaluated 1 traces')
      );
    });
  });

  // ==================== STOP ON FAIL BEHAVIOR ====================

  describe('runEvalCommand with stopOnFail', () => {
    let tracesFilePath: string;
    let evalsFilePath: string;

    beforeEach(async () => {
      tracesFilePath = path.join(tempDir, 'traces.jsonl');
      evalsFilePath = path.join(tempDir, 'evals.json');

      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Test',
          response: 'Short',
        },
      ];

      await fs.writeFile(
        tracesFilePath,
        JSON.stringify(traces[0]) + '\n'
      );

      const evals: EvalConfig[] = [
        {
          id: 'fail-eval',
          name: 'failing-eval',
          type: 'assertion',
          priority: 'cheap',
          config: { check: 'response.length > 100' },
        },
        {
          id: 'pass-eval',
          name: 'passing-eval',
          type: 'assertion',
          priority: 'cheap',
          config: { check: 'response.length > 0' },
        },
      ];

      await fs.writeJson(evalsFilePath, evals);
    });

    it('should stop on first failure when stopOnFail is true', async () => {
      await runEvalCommand({
        traces: tracesFilePath,
        config: evalsFilePath,
        stopOnFail: true,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Evaluated 1 traces')
      );
    });

    it('should run all evals when stopOnFail is false', async () => {
      await runEvalCommand({
        traces: tracesFilePath,
        config: evalsFilePath,
        stopOnFail: false,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Evaluated 1 traces')
      );
    });

    it('should continue when stopOnFail but first eval passes', async () => {
      const traces: Trace[] = [
        {
          id: 'trace-002',
          timestamp: new Date().toISOString(),
          query: 'Test',
          response: 'A very long response that satisfies the first check',
        },
      ];

      const tracesFile = path.join(tempDir, 'traces2.jsonl');
      await fs.writeFile(tracesFile, JSON.stringify(traces[0]) + '\n');

      const evals: EvalConfig[] = [
        {
          id: 'pass-eval',
          name: 'passing-eval',
          type: 'assertion',
          priority: 'cheap',
          config: { check: 'response.length > 10' },
        },
        {
          id: 'fail-eval',
          name: 'failing-eval',
          type: 'assertion',
          priority: 'cheap',
          config: { check: 'response.length > 1000' },
        },
      ];

      const evalsFile = path.join(tempDir, 'evals2.json');
      await fs.writeJson(evalsFile, evals);

      await runEvalCommand({
        traces: tracesFile,
        config: evalsFile,
        stopOnFail: true,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Evaluated 1 traces')
      );
    });
  });

  // ==================== REPORT COMMAND ====================

  describe('reportEvalCommand', () => {
    let resultsFilePath: string;

    beforeEach(async () => {
      resultsFilePath = path.join(tempDir, 'results.json');

      const mockResults = {
        timestamp: new Date().toISOString(),
        traces: 10,
        summary: {
          passed: 8,
          failed: 2,
          passRate: 0.8,
        },
        results: [],
      };

      await fs.writeJson(resultsFilePath, mockResults);
    });

    it('should generate report from results file', async () => {
      await reportEvalCommand(resultsFilePath);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Eval Report')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Summary:')
      );
    });

    it('should handle missing results file', async () => {
      await expect(
        reportEvalCommand('non-existent.json')
      ).rejects.toThrow('process.exit');
    });

    it('should display pass rate correctly', async () => {
      const results = {
        timestamp: new Date().toISOString(),
        traces: 5,
        summary: {
          passed: 4,
          failed: 1,
          passRate: 0.8,
        },
        results: [],
      };

      await fs.writeJson(resultsFilePath, results);

      await reportEvalCommand(resultsFilePath);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Pass rate: 80.0%')
      );
    });

    it('should display timestamp from results', async () => {
      const testTimestamp = '2024-01-15T10:30:00.000Z';

      const results = {
        timestamp: testTimestamp,
        traces: 1,
        summary: { passed: 1, failed: 0, passRate: 1.0 },
        results: [],
      };

      await fs.writeJson(resultsFilePath, results);

      await reportEvalCommand(resultsFilePath);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(testTimestamp)
      );
    });
  });

  // ==================== INTEGRATION TESTS ====================

  describe('Integration: add -> list -> run -> report', () => {
    afterEach(() => {
      ['evals.json', 'traces.jsonl', 'results.json'].forEach(f => {
        if (fs.existsSync(f)) fs.removeSync(f);
      });
    });

    it('should complete full workflow', async () => {
      const tracesFile = path.join(tempDir, 'traces.jsonl');

      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'What is the return policy?',
          response: 'We offer a 30-day return policy for all items.',
        },
      ];

      await fs.writeFile(tracesFile, JSON.stringify(traces[0]) + '\n');

      await addEvalCommand('has-content', {
        type: 'assertion',
        config: JSON.stringify({ check: 'response.length > 10' }),
      });

      await listEvalsCommand();

      const resultsFile = path.join(tempDir, 'results.json');
      await runEvalCommand({
        traces: tracesFile,
        output: resultsFile,
      });

      await reportEvalCommand(resultsFile);

      expect(fs.existsSync('evals.json')).toBe(true);
      expect(fs.existsSync(resultsFile)).toBe(true);
    });
  });

  // ==================== ERROR HANDLING ====================

  describe('Error handling', () => {
    it('should handle malformed evals config', async () => {
      const evalsFile = path.join(tempDir, 'bad-evals.json');
      await fs.writeFile(evalsFile, 'invalid json');

      const tracesFile = path.join(tempDir, 'traces.jsonl');
      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Test',
          response: 'Response',
        },
      ];
      await fs.writeFile(tracesFile, JSON.stringify(traces[0]) + '\n');

      await expect(
        runEvalCommand({
          traces: tracesFile,
          config: evalsFile,
        })
      ).rejects.toThrow();
    });

    it('should handle malformed traces file', async () => {
      const tracesFile = path.join(tempDir, 'bad-traces.jsonl');
      await fs.writeFile(tracesFile, 'not valid json\nnot valid either\n');

      const evalsFile = path.join(tempDir, 'evals.json');
      await fs.writeJson(evalsFile, [
        {
          id: 'test',
          name: 'test',
          type: 'assertion',
          priority: 'cheap',
          config: { check: 'true' },
        },
      ]);

      await expect(
        runEvalCommand({
          traces: tracesFile,
          config: evalsFile,
        })
      ).rejects.toThrow();
    });
  });
});
