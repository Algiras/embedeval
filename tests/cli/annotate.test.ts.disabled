/**
 * Comprehensive tests for CLI annotate command
 * Tests interactive UI simulation, saving annotations, keyboard shortcuts, and validation
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { Readable } from 'stream';

jest.mock('uuid');
jest.mock('chalk', () => {
  const identity = (str: string) => str;
  const mock = {
    blue: {
      bold: identity,
    },
    green: identity,
    gray: identity,
    red: identity,
    yellow: identity,
  };
  return mock;
});
jest.unmock('chalk');

const mockUuid = 'test-annotation-id-123';
const mockDate = '2026-01-31T12:00:00.000Z';

// Global input queues for mocking
let keyInputs: string[] = [];
let lineInputs: string[] = [];

// Mock process.stdin before importing the command
const mockStdin = new Readable({
  read() {},
}) as any;

// Add TTY methods to mock stdin
const onceMock = jest.fn(function(this: any, event: string | symbol, callback: (...args: any[]) => void) {
  if (event === 'data') {
    // Trigger callback with next available input
    process.nextTick(() => {
      if (keyInputs.length > 0) {
        const key = keyInputs.shift()!;
        callback(Buffer.from(key));
      } else if (lineInputs.length > 0) {
        const line = lineInputs.shift()!;
        callback(Buffer.from(line + '\n'));
      }
    });
  }
  return this;
});

Object.assign(mockStdin, {
  setRawMode: jest.fn(function(this: any) {
    return this;
  }),
  resume: jest.fn(function(this: any) {
    return this;
  }),
  pause: jest.fn(function(this: any) { return this; }),
  setEncoding: jest.fn(function(this: any) { return this; }),
  once: onceMock,
  removeAllListeners: jest.fn(() => {}),
  isTTY: true,
});

Object.defineProperty(process, 'stdin', {
  value: mockStdin,
  writable: false,
});

// Now import after mocking
import { annotateCommand } from '../../src/cli/commands/annotate';
import { Trace, Annotation, FailureTaxonomy } from '../../src/core/types';
import { v4 as uuidv4 } from 'uuid';

describe('CLI annotate command', () => {
  let tempDir: string;
  let tracesPath: string;
  let annotationsPath: string;
  let taxonomyPath: string;
  let consoleSpy: jest.SpyInstance;
  let consoleClearSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue(mockUuid);
    jest.useFakeTimers();
    jest.setSystemTime(new Date(mockDate));

    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'embedeval-annotate-test-'));
    tracesPath = path.join(tempDir, 'traces.jsonl');
    annotationsPath = path.join(tempDir, 'annotations.jsonl');
    taxonomyPath = path.join(tempDir, 'taxonomy.json');

    // Reset input queues
    keyInputs = [];
    lineInputs = [];

    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleClearSpy = jest.spyOn(console, 'clear').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);
    // Restore console methods
    consoleSpy.mockRestore();
    consoleClearSpy.mockRestore();
    processExitSpy.mockRestore();
    // Restore timers
    jest.useRealTimers();
  });

  // Helper: Create sample traces
  const createSampleTraces = (count: number): Trace[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `trace-${String(i + 1).padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
      query: `Question ${i + 1}?`,
      response: `Answer ${i + 1}`,
      metadata: { provider: 'test', model: 'test-model', latency: 100 + i * 10 },
    }));
  };

  // Helper: Write traces to file
  const writeTraces = async (traces: Trace[]): Promise<void> => {
    const content = traces.map(t => JSON.stringify(t)).join('\n') + '\n';
    await fs.writeFile(tracesPath, content);
  };

  // Helper: Create sample taxonomy
  const createSampleTaxonomy = async (): Promise<void> => {
    const taxonomy: FailureTaxonomy = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      annotator: 'test@example.com',
      categories: [
        {
          id: 'hallucination',
          name: 'Hallucination',
          description: 'Contains made-up facts',
          count: 5,
          examples: [],
        },
        {
          id: 'incomplete',
          name: 'Incomplete',
          description: 'Missing information',
          count: 3,
          examples: [],
        },
      ],
      stats: {
        totalAnnotated: 8,
        totalPassed: 4,
        totalFailed: 4,
        passRate: 0.5,
      },
    };
    await fs.writeFile(taxonomyPath, JSON.stringify(taxonomy, null, 2));
  };

  // Helper: Write existing annotations
  const writeAnnotations = async (annotations: Annotation[]): Promise<void> => {
    const content = annotations.map(a => JSON.stringify(a)).join('\n') + '\n';
    await fs.writeFile(annotationsPath, content);
  };

  // Helper: Simulate key press sequence
  // Rules:
  // - Letters p, f, c, n, j, k, s, q or Enter (empty) = key input
  // - Numbers (0, 1, 2, ...) = line input (category selection)
  // - Multi-character strings = line input (notes)
  const simulateKeys = (...inputs: string[]): void => {
    const keyCommands = new Set(['p', 'f', 'c', 'n', 'j', 'k', 's', 'q', '']);
    inputs.forEach(input => {
      if (keyCommands.has(input)) {
        keyInputs.push(input);
      } else {
        lineInputs.push(input);
      }
    });
  };

  // ==================== ANNOTATE COMMAND TESTS ====================

  describe('annotateCommand - interactive UI simulation', () => {
    it('should display annotation header with user info', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      await createSampleTaxonomy();

      // Immediately save and quit
      simulateKeys('s');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Interactive Trace Annotation'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Annotator: test@example.com'));
    });

    it('should display keyboard shortcuts', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      await createSampleTaxonomy();
      simulateKeys('s');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Keyboard shortcuts'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('p = pass'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('f = fail'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('c = set category'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('n = add/edit notes'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('j = next trace'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('k = previous trace'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('s = save and quit'));
    });

    it('should display current trace with query and response', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      await createSampleTaxonomy();
      simulateKeys('s');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Trace 1/1'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ID: trace-001'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Query:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Question 1?'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Response:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Answer 1'));
    });

    it('should display retrieved documents when present', async () => {
      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Question?',
          response: 'Answer.',
          context: {
            retrievedDocs: [
              { id: 'doc1', content: 'Document content here', score: 0.95 },
              { id: 'doc2', content: 'Another document', score: 0.87 },
            ],
          },
        },
      ];
      await writeTraces(traces);
      await createSampleTaxonomy();
      simulateKeys('s');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retrieved Documents'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Score: 0.95'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Score: 0.87'));
    });

    it('should show progress indicator', async () => {
      const traces = createSampleTraces(3);
      await writeTraces(traces);
      await createSampleTaxonomy();
      simulateKeys('s');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Progress:'));
    });
  });

  // ==================== SAVING ANNOTATIONS ====================

  describe('annotateCommand - saving annotations', () => {
    it('should save pass annotation to file', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      await createSampleTaxonomy();

      simulateKeys('p', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      const exists = await fs.pathExists(annotationsPath);
      expect(exists).toBe(true);

      const content = await fs.readFile(annotationsPath, 'utf-8');
      const savedAnnotations = content.trim().split('\n');
      expect(savedAnnotations).toHaveLength(1);

      const annotation = JSON.parse(savedAnnotations[0]) as Annotation;
      expect(annotation.label).toBe('pass');
      expect(annotation.traceId).toBe('trace-001');
      expect(annotation.annotator).toBe('test@example.com');
      expect(annotation.source).toBe('manual');
    });

    it('should save fail annotation with category and notes', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      await createSampleTaxonomy();

      simulateKeys('f', '1', 'This is hallucinated', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      const content = await fs.readFile(annotationsPath, 'utf-8');
      const annotation = JSON.parse(content.trim()) as Annotation;

      expect(annotation.label).toBe('fail');
      expect(annotation.failureCategory).toBe('hallucination');
      expect(annotation.notes).toBe('This is hallucinated');
    });

    it('should save multiple annotations', async () => {
      const traces = createSampleTraces(2);
      await writeTraces(traces);
      await createSampleTaxonomy();

      simulateKeys('p', 'f', '2', 'Missing info', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      const content = await fs.readFile(annotationsPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);

      const ann1 = JSON.parse(lines[0]) as Annotation;
      const ann2 = JSON.parse(lines[1]) as Annotation;

      expect(ann1.label).toBe('pass');
      expect(ann2.label).toBe('fail');
      expect(ann2.failureCategory).toBe('incomplete');
    });

    it('should save on quit (q) command', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      await createSampleTaxonomy();

      simulateKeys('p', 'q');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      const exists = await fs.pathExists(annotationsPath);
      expect(exists).toBe(true);
    });

    it('should append to existing annotations file', async () => {
      const traces = createSampleTraces(2);
      await writeTraces(traces);
      await createSampleTaxonomy();

      // Write existing annotation
      const existingAnnotation: Annotation = {
        id: 'existing-001',
        traceId: 'trace-999',
        annotator: 'other@example.com',
        timestamp: new Date().toISOString(),
        label: 'pass',
        notes: '',
        duration: 1000,
        source: 'manual',
      };
      await writeAnnotations([existingAnnotation]);

      // Run annotate command
      simulateKeys('p', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      const content = await fs.readFile(annotationsPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);

      const ann1 = JSON.parse(lines[0]) as Annotation;
      const ann2 = JSON.parse(lines[1]) as Annotation;

      expect(ann1.traceId).toBe('trace-999');
      expect(ann2.traceId).toBe('trace-001');
    });
  });

  // ==================== KEYBOARD SHORTCUTS ====================

  describe('annotateCommand - keyboard shortcuts', () => {
    describe('p = pass', () => {
      it('should mark trace as pass with p key', async () => {
        const traces = createSampleTraces(1);
        await writeTraces(traces);
        await createSampleTaxonomy();

        simulateKeys('p', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const content = await fs.readFile(annotationsPath, 'utf-8');
        const annotation = JSON.parse(content.trim()) as Annotation;
        expect(annotation.label).toBe('pass');
      });

      it('should move to next trace after marking pass', async () => {
        const traces = createSampleTraces(2);
        await writeTraces(traces);
        await createSampleTaxonomy();

        simulateKeys('p', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const content = await fs.readFile(annotationsPath, 'utf-8');
        const lines = content.trim().split('\n');
        expect(lines).toHaveLength(1); // Only saved first trace before quit

        const annotation = JSON.parse(lines[0]) as Annotation;
        expect(annotation.traceId).toBe('trace-001');
      });
    });

    describe('f = fail', () => {
      it('should prompt for category on fail', async () => {
        const traces = createSampleTraces(1);
        await writeTraces(traces);
        await createSampleTaxonomy();

        simulateKeys('f', '1', '', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const content = await fs.readFile(annotationsPath, 'utf-8');
        const annotation = JSON.parse(content.trim()) as Annotation;
        expect(annotation.label).toBe('fail');
        expect(annotation.failureCategory).toBe('hallucination');
      });

      it('should allow skipping category with 0', async () => {
        const traces = createSampleTraces(1);
        await writeTraces(traces);
        await createSampleTaxonomy();

        simulateKeys('f', '0', '', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const content = await fs.readFile(annotationsPath, 'utf-8');
        const annotation = JSON.parse(content.trim()) as Annotation;
        expect(annotation.label).toBe('fail');
        expect(annotation.failureCategory).toBeUndefined();
      });

      it('should prompt for notes on fail', async () => {
        const traces = createSampleTraces(1);
        await writeTraces(traces);
        await createSampleTaxonomy();

        simulateKeys('f', '1', 'Detailed notes about failure', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const content = await fs.readFile(annotationsPath, 'utf-8');
        const annotation = JSON.parse(content.trim()) as Annotation;
        expect(annotation.notes).toBe('Detailed notes about failure');
      });
    });

    describe('c = change category', () => {
      it('should change category for existing annotation', async () => {
        const traces = createSampleTraces(1);
        await writeTraces(traces);
        await createSampleTaxonomy();

        // Existing annotation
        const existing: Annotation = {
          id: 'existing-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'hallucination',
          notes: '',
          duration: 1000,
          source: 'manual',
        };
        await writeAnnotations([existing]);

        simulateKeys('c', '2', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const content = await fs.readFile(annotationsPath, 'utf-8');
        const lines = content.trim().split('\n');
        expect(lines).toHaveLength(2); // Original + updated

        const updated = JSON.parse(lines[1]) as Annotation;
        expect(updated.failureCategory).toBe('incomplete');
      });

      it('should only work when existing annotation exists', async () => {
        const traces = createSampleTraces(1);
        await writeTraces(traces);
        await createSampleTaxonomy();

        simulateKeys('c', '1', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        // Should not save anything since no annotation existed
        const exists = await fs.pathExists(annotationsPath);
        expect(exists).toBe(false);
      });
    });

    describe('n = edit notes', () => {
      it('should edit notes for existing annotation', async () => {
        const traces = createSampleTraces(1);
        await writeTraces(traces);
        await createSampleTaxonomy();

        const existing: Annotation = {
          id: 'existing-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'pass',
          notes: 'Original notes',
          duration: 1000,
          source: 'manual',
        };
        await writeAnnotations([existing]);

        simulateKeys('n', 'Updated notes', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const content = await fs.readFile(annotationsPath, 'utf-8');
        const lines = content.trim().split('\n');
        const updated = JSON.parse(lines[1]) as Annotation;
        expect(updated.notes).toBe('Updated notes');
      });

      it('should preserve original notes when editing', async () => {
        const traces = createSampleTraces(1);
        await writeTraces(traces);
        await createSampleTaxonomy();

        const existing: Annotation = {
          id: 'existing-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'pass',
          notes: 'Original notes',
          duration: 1000,
          source: 'manual',
        };
        await writeAnnotations([existing]);

        simulateKeys('p', 's'); // Pass should preserve existing notes

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const content = await fs.readFile(annotationsPath, 'utf-8');
        const lines = content.trim().split('\n');
        const newAnnotation = JSON.parse(lines[1]) as Annotation;
        expect(newAnnotation.notes).toBe('Original notes');
      });
    });

    describe('j = next trace', () => {
      it('should move to next trace with j key', async () => {
        const traces = createSampleTraces(2);
        await writeTraces(traces);
        await createSampleTaxonomy();

        simulateKeys('j', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const exists = await fs.pathExists(annotationsPath);
        expect(exists).toBe(false); // No annotations saved, just moved
      });

      it('should move to next trace with Enter key', async () => {
        const traces = createSampleTraces(2);
        await writeTraces(traces);
        await createSampleTaxonomy();

        simulateKeys('', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const exists = await fs.pathExists(annotationsPath);
        expect(exists).toBe(false);
      });
    });

    describe('k = previous trace', () => {
      it('should move to previous trace with k key', async () => {
        const traces = createSampleTraces(3);
        await writeTraces(traces);
        await createSampleTaxonomy();

        simulateKeys('j', 'k', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const exists = await fs.pathExists(annotationsPath);
        expect(exists).toBe(false);
      });
    });

    describe('s = save and quit', () => {
      it('should save all annotations and exit', async () => {
        const traces = createSampleTraces(2);
        await writeTraces(traces);
        await createSampleTaxonomy();

        simulateKeys('p', 'f', '1', '', 's');

        await annotateCommand(tracesPath, {
          user: 'test@example.com',
          annotations: annotationsPath,
        });

        const content = await fs.readFile(annotationsPath, 'utf-8');
        const lines = content.trim().split('\n');
        expect(lines).toHaveLength(2);
      });
    });
  });

  // ==================== VALIDATION ====================

  describe('annotateCommand - validation', () => {
    it('should enforce binary pass/fail only', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      await createSampleTaxonomy();

      simulateKeys('p', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      const content = await fs.readFile(annotationsPath, 'utf-8');
      const annotation = JSON.parse(content.trim()) as Annotation;

      expect(['pass', 'fail']).toContain(annotation.label);
    });

    it('should require category on fail when taxonomy exists', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      await createSampleTaxonomy();

      simulateKeys('f', '1', '', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      const content = await fs.readFile(annotationsPath, 'utf-8');
      const annotation = JSON.parse(content.trim()) as Annotation;

      expect(annotation.label).toBe('fail');
      expect(annotation.failureCategory).toBeDefined();
    });

    it('should allow fail without category when no taxonomy', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      // Don't create taxonomy

      simulateKeys('f', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      const content = await fs.readFile(annotationsPath, 'utf-8');
      const annotation = JSON.parse(content.trim()) as Annotation;

      expect(annotation.label).toBe('fail');
      expect(annotation.failureCategory).toBeUndefined();
    });

    it('should display validation message for unknown commands', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      await createSampleTaxonomy();

      simulateKeys('x', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    });

    it('should handle empty traces file gracefully', async () => {
      await fs.writeFile(tracesPath, '');
      await createSampleTaxonomy();

      simulateKeys('s');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No traces to annotate'));
    });

    it('should resume from first unannotated trace with resume flag', async () => {
      const traces = createSampleTraces(3);
      await writeTraces(traces);
      await createSampleTaxonomy();

      // Annotate first trace
      const existing: Annotation = {
        id: 'existing-001',
        traceId: 'trace-001',
        annotator: 'test@example.com',
        timestamp: new Date().toISOString(),
        label: 'pass',
        notes: '',
        duration: 1000,
        source: 'manual',
      };
      await writeAnnotations([existing]);

      simulateKeys('p', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
        resume: true,
      });

      const content = await fs.readFile(annotationsPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);

      // Should have annotated trace-002 (first unannotated)
      const newAnnotation = JSON.parse(lines[1]) as Annotation;
      expect(newAnnotation.traceId).toBe('trace-002');
    });
  });

  // ==================== EDGE CASES ====================

  describe('annotateCommand - edge cases', () => {
    it('should handle traces with missing metadata', async () => {
      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Question?',
          response: 'Answer',
          // No metadata
        },
      ];
      await writeTraces(traces);
      await createSampleTaxonomy();

      simulateKeys('p', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      const exists = await fs.pathExists(annotationsPath);
      expect(exists).toBe(true);
    });

    it('should handle traces with empty response', async () => {
      const traces: Trace[] = [
        {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Question?',
          response: '',
        },
      ];
      await writeTraces(traces);
      await createSampleTaxonomy();

      simulateKeys('p', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      const content = await fs.readFile(annotationsPath, 'utf-8');
      const annotation = JSON.parse(content.trim()) as Annotation;
      expect(annotation.label).toBe('pass');
    });

    it('should display existing annotation status', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      await createSampleTaxonomy();

      const existing: Annotation = {
        id: 'existing-001',
        traceId: 'trace-001',
        annotator: 'test@example.com',
        timestamp: new Date().toISOString(),
        label: 'pass',
        notes: 'Good response',
        duration: 1000,
        source: 'manual',
      };
      await writeAnnotations([existing]);

      simulateKeys('s');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Current status:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PASS'));
    });

    it('should handle multiple annotations for same trace (keep most recent)', async () => {
      const traces = createSampleTraces(1);
      await writeTraces(traces);
      await createSampleTaxonomy();

      const older: Annotation = {
        id: 'old-001',
        traceId: 'trace-001',
        annotator: 'test@example.com',
        timestamp: '2024-01-01T00:00:00Z',
        label: 'fail',
        notes: 'Old annotation',
        duration: 1000,
        source: 'manual',
      };
      const newer: Annotation = {
        id: 'new-001',
        traceId: 'trace-001',
        annotator: 'test@example.com',
        timestamp: '2024-01-02T00:00:00Z',
        label: 'pass',
        notes: 'New annotation',
        duration: 1000,
        source: 'manual',
      };
      await writeAnnotations([older, newer]);

      simulateKeys('s');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PASS'));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('FAIL'));
    });
  });

  // ==================== INTEGRATION TESTS ====================

  describe('annotateCommand - integration', () => {
    it('should handle complete annotation workflow', async () => {
      const traces = createSampleTraces(3);
      await writeTraces(traces);
      await createSampleTaxonomy();

      // Annotate all traces
      simulateKeys('p', 'f', '1', 'Hallucinated content', 'f', '2', 'Missing details', 's');

      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      const content = await fs.readFile(annotationsPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(3);

      const ann1 = JSON.parse(lines[0]) as Annotation;
      const ann2 = JSON.parse(lines[1]) as Annotation;
      const ann3 = JSON.parse(lines[2]) as Annotation;

      expect(ann1.label).toBe('pass');
      expect(ann2.label).toBe('fail');
      expect(ann2.failureCategory).toBe('hallucination');
      expect(ann3.label).toBe('fail');
      expect(ann3.failureCategory).toBe('incomplete');
    });

    it('should handle annotations across multiple sessions', async () => {
      const traces = createSampleTraces(2);
      await writeTraces(traces);
      await createSampleTaxonomy();

      // First session: annotate first trace
      simulateKeys('p', 's');
      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
      });

      // Reset for second session
      keyInputs = [];

      // Second session: annotate second trace (resume)
      simulateKeys('f', '1', '', 's');
      await annotateCommand(tracesPath, {
        user: 'test@example.com',
        annotations: annotationsPath,
        resume: true,
      });

      const content = await fs.readFile(annotationsPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);

      const ann1 = JSON.parse(lines[0]) as Annotation;
      const ann2 = JSON.parse(lines[1]) as Annotation;

      expect(ann1.traceId).toBe('trace-001');
      expect(ann1.label).toBe('pass');
      expect(ann2.traceId).toBe('trace-002');
      expect(ann2.label).toBe('fail');
    });
  });
});
