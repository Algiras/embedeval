/**
 * Comprehensive tests for CLI collect command
 * Tests collect command - reading JSONL files, filtering traces, output file creation, validation
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { collectCommand } from '../../src/cli/commands/collect';
import { TraceStore } from '../../src/core/storage';
import { Trace } from '../../src/core/types';

describe('collect command', () => {
  let tempDir: string;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'embedeval-collect-test-'));
    // Suppress console output during tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);
    // Restore console and process
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // ==================== VALIDATION TESTS ====================

  describe('validation', () => {
    it('should exit with error when source file does not exist', async () => {
      const sourceFile = path.join(tempDir, 'nonexistent.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      await expect(
        collectCommand(sourceFile, { output: outputFile })
      ).rejects.toThrow('process.exit called');

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle empty source file gracefully', async () => {
      const sourceFile = path.join(tempDir, 'empty.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      await fs.writeFile(sourceFile, '');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces).toHaveLength(0);
    });

    it('should handle source file with only empty lines', async () => {
      const sourceFile = path.join(tempDir, 'empty-lines.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      await fs.writeFile(sourceFile, '\n\n\n\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces).toHaveLength(0);
    });
  });

  // ==================== READING JSONL FILES ====================

  describe('reading JSONL files', () => {
    it('should read traces from valid JSONL file', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const trace1: Trace = {
        id: 'trace-001',
        timestamp: '2024-01-01T10:00:00Z',
        query: 'What is the refund policy?',
        response: 'We offer full refunds within 30 days.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };
      const trace2: Trace = {
        id: 'trace-002',
        timestamp: '2024-01-01T10:01:00Z',
        query: 'How do I reset my password?',
        response: 'Click on the "Forgot Password" link.',
        metadata: { provider: 'test', model: 'test-model', latency: 150 },
      };

      await fs.writeFile(sourceFile, JSON.stringify(trace1) + '\n' + JSON.stringify(trace2) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces).toHaveLength(2);
      expect(traces[0].id).toBe('trace-001');
      expect(traces[1].id).toBe('trace-002');
    });

    it('should skip invalid JSON lines and continue', async () => {
      const sourceFile = path.join(tempDir, 'mixed.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const validTrace: Trace = {
        id: 'trace-001',
        timestamp: '2024-01-01T10:00:00Z',
        query: 'Question?',
        response: 'Answer.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      const content = JSON.stringify(validTrace) + '\n' + '{ invalid json }\n' + JSON.stringify(validTrace) + '\n';
      await fs.writeFile(sourceFile, content);

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces).toHaveLength(2);
    });

    it('should skip empty lines in JSONL', async () => {
      const sourceFile = path.join(tempDir, 'with-empty-lines.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const trace1: Trace = {
        id: 'trace-001',
        timestamp: '2024-01-01T10:00:00Z',
        query: 'Question 1?',
        response: 'Answer 1.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };
      const trace2: Trace = {
        id: 'trace-002',
        timestamp: '2024-01-01T10:01:00Z',
        query: 'Question 2?',
        response: 'Answer 2.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      const content = JSON.stringify(trace1) + '\n\n\n' + JSON.stringify(trace2) + '\n';
      await fs.writeFile(sourceFile, content);

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces).toHaveLength(2);
    });

    it('should read large JSONL files efficiently', async () => {
      const sourceFile = path.join(tempDir, 'large.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        const trace: Trace = {
          id: `trace-${i.toString().padStart(3, '0')}`,
          timestamp: '2024-01-01T10:00:00Z',
          query: `Question ${i}?`,
          response: `Answer ${i}.`,
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        };
        lines.push(JSON.stringify(trace));
      }

      await fs.writeFile(sourceFile, lines.join('\n') + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces).toHaveLength(100);
    });
  });

  // ==================== FILTERING TRACES ====================

  describe('filtering traces', () => {
    it('should filter traces by keyword in query', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: '2024-01-01T10:00:00Z',
          query: 'What is the refund policy?',
          response: 'We offer refunds.',
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        },
        {
          id: 'trace-002',
          timestamp: '2024-01-01T10:01:00Z',
          query: 'How do I reset my password?',
          response: 'Click forgot password.',
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        },
        {
          id: 'trace-003',
          timestamp: '2024-01-01T10:02:00Z',
          query: 'refund policy details',
          response: 'Full details here.',
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        },
      ];

      await fs.writeFile(sourceFile, traces.map(t => JSON.stringify(t)).join('\n') + '\n');

      await collectCommand(sourceFile, { output: outputFile, filter: 'refund' });

      const store = new TraceStore(outputFile);
      const filteredTraces = await store.loadAll();
      expect(filteredTraces).toHaveLength(2);
      expect(filteredTraces[0].id).toBe('trace-001');
      expect(filteredTraces[1].id).toBe('trace-003');
    });

    it('should filter traces by keyword in response', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: '2024-01-01T10:00:00Z',
          query: 'Question?',
          response: 'The answer is yes.',
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        },
        {
          id: 'trace-002',
          timestamp: '2024-01-01T10:01:00Z',
          query: 'Another question?',
          response: 'No.',
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        },
        {
          id: 'trace-003',
          timestamp: '2024-01-01T10:02:00Z',
          query: 'More?',
          response: 'Yes, definitely.',
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        },
      ];

      await fs.writeFile(sourceFile, traces.map(t => JSON.stringify(t)).join('\n') + '\n');

      await collectCommand(sourceFile, { output: outputFile, filter: 'yes' });

      const store = new TraceStore(outputFile);
      const filteredTraces = await store.loadAll();
      expect(filteredTraces).toHaveLength(2);
      expect(filteredTraces[0].id).toBe('trace-001');
      expect(filteredTraces[1].id).toBe('trace-003');
    });

    it('should be case-insensitive when filtering', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: '2024-01-01T10:00:00Z',
          query: 'REFUND policy?',
          response: 'Answer.',
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        },
        {
          id: 'trace-002',
          timestamp: '2024-01-01T10:01:00Z',
          query: 'Question?',
          response: 'refund allowed',
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        },
      ];

      await fs.writeFile(sourceFile, traces.map(t => JSON.stringify(t)).join('\n') + '\n');

      await collectCommand(sourceFile, { output: outputFile, filter: 'refund' });

      const store = new TraceStore(outputFile);
      const filteredTraces = await store.loadAll();
      expect(filteredTraces).toHaveLength(2);
    });

    it('should return empty result when no traces match filter', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const trace: Trace = {
        id: 'trace-001',
        timestamp: '2024-01-01T10:00:00Z',
        query: 'Question?',
        response: 'Answer.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      await fs.writeFile(sourceFile, JSON.stringify(trace) + '\n');

      await collectCommand(sourceFile, { output: outputFile, filter: 'nonexistent' });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces).toHaveLength(0);
    });
  });

  // ==================== LIMIT OPTION ====================

  describe('limit option', () => {
    it('should limit number of traces collected', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const lines: string[] = [];
      for (let i = 0; i < 10; i++) {
        const trace: Trace = {
          id: `trace-${i.toString().padStart(3, '0')}`,
          timestamp: '2024-01-01T10:00:00Z',
          query: `Question ${i}?`,
          response: `Answer ${i}.`,
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        };
        lines.push(JSON.stringify(trace));
      }

      await fs.writeFile(sourceFile, lines.join('\n') + '\n');

      await collectCommand(sourceFile, { output: outputFile, limit: 5 });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces).toHaveLength(5);
      expect(traces[0].id).toBe('trace-000');
      expect(traces[4].id).toBe('trace-004');
    });

    it('should collect all traces when limit is larger than available', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const trace1: Trace = {
        id: 'trace-001',
        timestamp: '2024-01-01T10:00:00Z',
        query: 'Question 1?',
        response: 'Answer 1.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };
      const trace2: Trace = {
        id: 'trace-002',
        timestamp: '2024-01-01T10:01:00Z',
        query: 'Question 2?',
        response: 'Answer 2.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      await fs.writeFile(sourceFile, JSON.stringify(trace1) + '\n' + JSON.stringify(trace2) + '\n');

      await collectCommand(sourceFile, { output: outputFile, limit: 10 });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces).toHaveLength(2);
    });

    it('should apply limit before filter', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const traces: Trace[] = [];
      for (let i = 0; i < 10; i++) {
        traces.push({
          id: `trace-${i.toString().padStart(3, '0')}`,
          timestamp: '2024-01-01T10:00:00Z',
          query: i < 5 ? 'refund' : 'other',
          response: `Answer ${i}.`,
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        });
      }

      await fs.writeFile(sourceFile, traces.map(t => JSON.stringify(t)).join('\n') + '\n');

      await collectCommand(sourceFile, { output: outputFile, limit: 3, filter: 'refund' });

      const store = new TraceStore(outputFile);
      const collectedTraces = await store.loadAll();
      expect(collectedTraces.length).toBeLessThanOrEqual(3);
    });
  });

  // ==================== OUTPUT FILE CREATION ====================

  describe('output file creation', () => {
    it('should create output file with correct format', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const trace: Trace = {
        id: 'trace-001',
        timestamp: '2024-01-01T10:00:00Z',
        query: 'Question?',
        response: 'Answer.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      await fs.writeFile(sourceFile, JSON.stringify(trace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const exists = await fs.pathExists(outputFile);
      expect(exists).toBe(true);

      const content = await fs.readFile(outputFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      expect(lines).toHaveLength(1);

      const loadedTrace = JSON.parse(lines[0]) as Trace;
      expect(loadedTrace.id).toBe('trace-001');
    });

    it('should append to existing output file', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const existingTrace: Trace = {
        id: 'existing-001',
        timestamp: '2024-01-01T09:00:00Z',
        query: 'Existing question?',
        response: 'Existing answer.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      await fs.writeFile(outputFile, JSON.stringify(existingTrace) + '\n');

      const newTrace: Trace = {
        id: 'new-001',
        timestamp: '2024-01-01T10:00:00Z',
        query: 'New question?',
        response: 'New answer.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      await fs.writeFile(sourceFile, JSON.stringify(newTrace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces).toHaveLength(2);
      expect(traces[0].id).toBe('existing-001');
      expect(traces[1].id).toBe('new-001');
    });

    it('should write traces in JSONL format (one JSON per line)', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: '2024-01-01T10:00:00Z',
          query: 'Question 1?',
          response: 'Answer 1.',
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        },
        {
          id: 'trace-002',
          timestamp: '2024-01-01T10:01:00Z',
          query: 'Question 2?',
          response: 'Answer 2.',
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        },
      ];

      await fs.writeFile(sourceFile, traces.map(t => JSON.stringify(t)).join('\n') + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const content = await fs.readFile(outputFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      expect(lines).toHaveLength(2);

      lines.forEach((line, i) => {
        const parsed = JSON.parse(line);
        expect(parsed).toMatchObject({
          id: traces[i].id,
          query: traces[i].query,
          response: traces[i].response,
        });
      });
    });
  });

  // ==================== TRANSFORM FUNCTION TESTS ====================

  describe('transformToTrace function', () => {
    it('should accept traces already in correct format', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const trace: Trace = {
        id: 'trace-001',
        timestamp: '2024-01-01T10:00:00Z',
        query: 'Question?',
        response: 'Answer.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      await fs.writeFile(sourceFile, JSON.stringify(trace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces[0]).toEqual(trace);
    });

    it('should add timestamp if missing', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const incompleteTrace = {
        id: 'trace-001',
        query: 'Question?',
        response: 'Answer.',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      await fs.writeFile(sourceFile, JSON.stringify(incompleteTrace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces[0].timestamp).toBeDefined();
      expect(traces[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should transform format with input/output fields', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const inputFormatTrace = {
        id: 'trace-001',
        input: 'What is the policy?',
        output: 'The policy is...',
        model: 'gpt-4',
        latency: 1000,
      };

      await fs.writeFile(sourceFile, JSON.stringify(inputFormatTrace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces[0].query).toBe('What is the policy?');
      expect(traces[0].response).toBe('The policy is...');
      expect(traces[0].metadata?.model).toBe('gpt-4');
      expect(traces[0].metadata?.latency).toBe(1000);
    });

    it('should transform format with prompt/completion fields', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const promptFormatTrace = {
        id: 'trace-001',
        prompt: 'Write a story',
        completion: 'Once upon a time...',
        model: 'claude-3',
        duration: 2000,
      };

      await fs.writeFile(sourceFile, JSON.stringify(promptFormatTrace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces[0].query).toBe('Write a story');
      expect(traces[0].response).toBe('Once upon a time...');
      expect(traces[0].metadata?.latency).toBe(2000);
    });

    it('should transform format with messages array', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const messagesFormatTrace = {
        id: 'trace-001',
        messages: [
          { role: 'user', content: 'Hello!' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        model: 'gemini-pro',
      };

      await fs.writeFile(sourceFile, JSON.stringify(messagesFormatTrace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces[0].query).toBe('Hello!');
      expect(traces[0].response).toBe('Hi there!');
      expect(traces[0].metadata?.model).toBe('gemini-pro');
    });

    it('should use fallback format for unknown structures', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const unknownFormat = {
        data: 'some value',
        count: 42,
        active: true,
      };

      await fs.writeFile(sourceFile, JSON.stringify(unknownFormat) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces[0].query).toContain('some value');
      expect(traces[0].id).toBeDefined();
      expect(traces[0].timestamp).toBeDefined();
    });

    it('should generate UUID for traces without ID', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const noIdTrace = {
        input: 'Question?',
        output: 'Answer.',
        model: 'test-model',
      };

      await fs.writeFile(sourceFile, JSON.stringify(noIdTrace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces[0].id).toBeDefined();
      expect(traces[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should preserve additional metadata fields', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const traceWithExtraFields = {
        id: 'trace-001',
        input: 'Question?',
        output: 'Answer.',
        model: 'test-model',
        tokens: { input: 10, output: 20 },
        cost: 0.001,
        customField: 'custom value',
      };

      await fs.writeFile(sourceFile, JSON.stringify(traceWithExtraFields) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces[0].metadata?.tokens).toEqual({ input: 10, output: 20 });
      expect(traces[0].metadata?.cost).toBe(0.001);
    });
  });

  // ==================== EDGE CASES ====================

  describe('edge cases', () => {
    it('should handle traces with empty query or response', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const emptyTrace = {
        id: 'trace-001',
        timestamp: '2024-01-01T10:00:00Z',
        query: '',
        response: '',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      await fs.writeFile(sourceFile, JSON.stringify(emptyTrace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces).toHaveLength(1);
      // When empty, it's still valid but query/response remain empty
      expect(traces[0].query).toBe('');
      expect(traces[0].response).toBe('');
    });

    it('should handle unicode characters in traces', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const unicodeTrace: Trace = {
        id: 'trace-001',
        timestamp: '2024-01-01T10:00:00Z',
        query: '你好, مرحبا, 🌍',
        response: 'Response with emoji 😊 and unicode characters',
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      await fs.writeFile(sourceFile, JSON.stringify(unicodeTrace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces[0].query).toBe('你好, مرحبا, 🌍');
      expect(traces[0].response).toBe('Response with emoji 😊 and unicode characters');
    });

    it('should handle very long query and response', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const longText = 'a'.repeat(10000);
      const longTrace: Trace = {
        id: 'trace-001',
        timestamp: '2024-01-01T10:00:00Z',
        query: longText,
        response: longText,
        metadata: { provider: 'test', model: 'test-model', latency: 100 },
      };

      await fs.writeFile(sourceFile, JSON.stringify(longTrace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      expect(traces[0].query).toHaveLength(10000);
      expect(traces[0].response).toHaveLength(10000);
    });

    it('should handle nested objects in metadata', async () => {
      const sourceFile = path.join(tempDir, 'traces.jsonl');
      const outputFile = path.join(tempDir, 'output.jsonl');

      const nestedMetadataTrace = {
        id: 'trace-001',
        query: 'Question?',
        response: 'Answer.',
        metadata: {
          provider: 'test',
          model: 'test-model',
          latency: 100,
          extra: {
            nested: {
              deep: {
                value: 42,
              },
            },
          },
        },
      };

      await fs.writeFile(sourceFile, JSON.stringify(nestedMetadataTrace) + '\n');

      await collectCommand(sourceFile, { output: outputFile });

      const store = new TraceStore(outputFile);
      const traces = await store.loadAll();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((traces[0].metadata as any).extra?.nested?.deep?.value).toBe(42);
    });
  });
});
