/**
 * Comprehensive tests for JSONL Storage Layer
 * Tests TraceStore, AnnotationStore, and TaxonomyStore
 * Covers file operations, JSONL parsing, error handling, and statistics
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { TraceStore, AnnotationStore, TaxonomyStore } from '../../src/core/storage';
import { Trace, Annotation, FailureTaxonomy } from '../../src/core/types';

describe('Storage Layer', () => {
  let tempDir: string;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'embedeval-storage-test-'));
    // Suppress console.warn during tests
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);
    // Restore console.warn
    consoleWarnSpy.mockRestore();
  });

  // ==================== TraceStore Tests ====================

  describe('TraceStore', () => {
    let traceStore: TraceStore;
    let traceFilePath: string;

    beforeEach(() => {
      traceFilePath = path.join(tempDir, 'traces.jsonl');
      traceStore = new TraceStore(traceFilePath);
    });

    describe('loadAll()', () => {
      it('should return empty array when file does not exist', async () => {
        const traces = await traceStore.loadAll();
        expect(traces).toEqual([]);
      });

      it('should load all traces from JSONL file', async () => {
        const trace1: Trace = {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'What is the refund policy?',
          response: 'We offer full refunds within 30 days.',
          metadata: { provider: 'test', model: 'test-model', latency: 100 },
        };
        const trace2: Trace = {
          id: 'trace-002',
          timestamp: new Date().toISOString(),
          query: 'How do I reset my password?',
          response: 'Click on the "Forgot Password" link.',
        };

        await fs.writeFile(traceFilePath, JSON.stringify(trace1) + '\n' + JSON.stringify(trace2) + '\n');

        const traces = await traceStore.loadAll();
        expect(traces).toHaveLength(2);
        expect(traces[0].id).toBe('trace-001');
        expect(traces[1].id).toBe('trace-002');
      });

      it('should skip empty lines in JSONL', async () => {
        const trace1: Trace = {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Question?',
          response: 'Answer.',
        };
        const content = JSON.stringify(trace1) + '\n\n\n' + JSON.stringify(trace1) + '\n';
        await fs.writeFile(traceFilePath, content);

        const traces = await traceStore.loadAll();
        expect(traces).toHaveLength(2);
      });

      it('should handle JSON parse errors gracefully', async () => {
        const trace: Trace = {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Question?',
          response: 'Answer.',
        };
        const content = JSON.stringify(trace) + '\n{ invalid json }\n' + JSON.stringify(trace) + '\n';
        await fs.writeFile(traceFilePath, content);

        const traces = await traceStore.loadAll();
        expect(traces).toHaveLength(2);
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should load traces with context', async () => {
        const trace: Trace = {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'What is the policy?',
          response: 'Here is the policy.',
          context: {
            retrievedDocs: [
              { id: 'doc1', content: 'Policy content', score: 0.95 },
            ],
          },
        };
        await fs.writeFile(traceFilePath, JSON.stringify(trace) + '\n');

        const traces = await traceStore.loadAll();
        expect(traces[0].context?.retrievedDocs).toHaveLength(1);
        expect(traces[0].context?.retrievedDocs?.[0]?.score).toBe(0.95);
      });
    });

    describe('loadById()', () => {
      it('should return trace by ID', async () => {
        const trace1: Trace = {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Question 1?',
          response: 'Answer 1.',
        };
        const trace2: Trace = {
          id: 'trace-002',
          timestamp: new Date().toISOString(),
          query: 'Question 2?',
          response: 'Answer 2.',
        };
        await fs.writeFile(traceFilePath, JSON.stringify(trace1) + '\n' + JSON.stringify(trace2) + '\n');

        const result = await traceStore.loadById('trace-002');
        expect(result?.id).toBe('trace-002');
        expect(result?.query).toBe('Question 2?');
      });

      it('should return undefined for non-existent ID', async () => {
        const trace: Trace = {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Question?',
          response: 'Answer.',
        };
        await fs.writeFile(traceFilePath, JSON.stringify(trace) + '\n');

        const result = await traceStore.loadById('non-existent');
        expect(result).toBeUndefined();
      });
    });

    describe('append()', () => {
      it('should append a single trace to file', async () => {
        const trace: Trace = {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Question?',
          response: 'Answer.',
        };

        await traceStore.append(trace);

        const content = await fs.readFile(traceFilePath, 'utf-8');
        expect(content.trim()).toBe(JSON.stringify(trace));
      });

      it('should create file if it does not exist', async () => {
        const trace: Trace = {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Question?',
          response: 'Answer.',
        };

        await traceStore.append(trace);

        const exists = await fs.pathExists(traceFilePath);
        expect(exists).toBe(true);
      });

      it('should append multiple traces sequentially', async () => {
        const trace1: Trace = {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Question 1?',
          response: 'Answer 1.',
        };
        const trace2: Trace = {
          id: 'trace-002',
          timestamp: new Date().toISOString(),
          query: 'Question 2?',
          response: 'Answer 2.',
        };

        await traceStore.append(trace1);
        await traceStore.append(trace2);

        const traces = await traceStore.loadAll();
        expect(traces).toHaveLength(2);
        expect(traces[0].id).toBe('trace-001');
        expect(traces[1].id).toBe('trace-002');
      });
    });

    describe('appendMany()', () => {
      it('should append multiple traces in one operation', async () => {
        const traces: Trace[] = [
          {
            id: 'trace-001',
            timestamp: new Date().toISOString(),
            query: 'Question 1?',
            response: 'Answer 1.',
          },
          {
            id: 'trace-002',
            timestamp: new Date().toISOString(),
            query: 'Question 2?',
            response: 'Answer 2.',
          },
          {
            id: 'trace-003',
            timestamp: new Date().toISOString(),
            query: 'Question 3?',
            response: 'Answer 3.',
          },
        ];

        await traceStore.appendMany(traces);

        const loaded = await traceStore.loadAll();
        expect(loaded).toHaveLength(3);
      });

      it('should handle empty array', async () => {
        await traceStore.appendMany([]);
        const traces = await traceStore.loadAll();
        expect(traces).toEqual([]);
      });
    });

    describe('count()', () => {
      it('should return 0 for non-existent file', async () => {
        const count = await traceStore.count();
        expect(count).toBe(0);
      });

      it('should return correct count of traces', async () => {
        const traces: Trace[] = [
          { id: 'trace-001', timestamp: new Date().toISOString(), query: 'Q1?', response: 'A1' },
          { id: 'trace-002', timestamp: new Date().toISOString(), query: 'Q2?', response: 'A2' },
          { id: 'trace-003', timestamp: new Date().toISOString(), query: 'Q3?', response: 'A3' },
        ];
        await traceStore.appendMany(traces);

        const count = await traceStore.count();
        expect(count).toBe(3);
      });

      it('should skip empty lines when counting', async () => {
        const trace: Trace = {
          id: 'trace-001',
          timestamp: new Date().toISOString(),
          query: 'Q?',
          response: 'A',
        };
        // Write with extra newlines
        await fs.writeFile(traceFilePath, JSON.stringify(trace) + '\n\n' + JSON.stringify(trace) + '\n');

        const count = await traceStore.count();
        expect(count).toBe(2); // Skips empty lines
      });
    });
  });

  // ==================== AnnotationStore Tests ====================

  describe('AnnotationStore', () => {
    let annotationStore: AnnotationStore;
    let annotationFilePath: string;

    beforeEach(() => {
      annotationFilePath = path.join(tempDir, 'annotations.jsonl');
      annotationStore = new AnnotationStore(annotationFilePath);
    });

    describe('loadAll()', () => {
      it('should return empty array when file does not exist', async () => {
        const annotations = await annotationStore.loadAll();
        expect(annotations).toEqual([]);
      });

      it('should load all annotations', async () => {
        const annotation1: Annotation = {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'pass',
          notes: 'Good response',
          duration: 5000,
          source: 'manual',
        };
        const annotation2: Annotation = {
          id: 'ann-002',
          traceId: 'trace-002',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'hallucination',
          notes: 'Contains hallucinated facts',
          duration: 3000,
          source: 'manual',
        };

        await fs.writeFile(annotationFilePath, JSON.stringify(annotation1) + '\n' + JSON.stringify(annotation2) + '\n');

        const annotations = await annotationStore.loadAll();
        expect(annotations).toHaveLength(2);
        expect(annotations[0].label).toBe('pass');
        expect(annotations[1].label).toBe('fail');
      });

      it('should handle parse errors gracefully', async () => {
        const annotation: Annotation = {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'pass',
          notes: '',
          duration: 1000,
          source: 'manual',
        };
        const content = JSON.stringify(annotation) + '\n{ invalid }\n';
        await fs.writeFile(annotationFilePath, content);

        const annotations = await annotationStore.loadAll();
        expect(annotations).toHaveLength(1);
        expect(consoleWarnSpy).toHaveBeenCalled();
      });
    });

    describe('loadByTraceId()', () => {
      it('should return most recent annotation for trace', async () => {
        const olderAnnotation: Annotation = {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: '2024-01-01T00:00:00Z',
          label: 'fail',
          notes: 'Old annotation',
          duration: 1000,
          source: 'manual',
        };
        const newerAnnotation: Annotation = {
          id: 'ann-002',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: '2024-01-02T00:00:00Z',
          label: 'pass',
          notes: 'New annotation',
          duration: 1000,
          source: 'manual',
        };

        await fs.writeFile(annotationFilePath, JSON.stringify(olderAnnotation) + '\n' + JSON.stringify(newerAnnotation) + '\n');

        const result = await annotationStore.loadByTraceId('trace-001');
        expect(result?.label).toBe('pass');
        expect(result?.id).toBe('ann-002');
      });

      it('should return undefined for trace with no annotations', async () => {
        const annotation: Annotation = {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'pass',
          notes: '',
          duration: 1000,
          source: 'manual',
        };
        await fs.writeFile(annotationFilePath, JSON.stringify(annotation) + '\n');

        const result = await annotationStore.loadByTraceId('non-existent');
        expect(result).toBeUndefined();
      });
    });

    describe('loadAllForTraceId()', () => {
      it('should return all annotations for a trace sorted by timestamp', async () => {
        const annotation1: Annotation = {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: '2024-01-01T00:00:00Z',
          label: 'fail',
          notes: 'First',
          duration: 1000,
          source: 'manual',
        };
        const annotation2: Annotation = {
          id: 'ann-002',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: '2024-01-03T00:00:00Z',
          label: 'pass',
          notes: 'Third',
          duration: 1000,
          source: 'manual',
        };
        const annotation3: Annotation = {
          id: 'ann-003',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: '2024-01-02T00:00:00Z',
          label: 'fail',
          notes: 'Second',
          duration: 1000,
          source: 'manual',
        };

        await fs.writeFile(
          annotationFilePath,
          JSON.stringify(annotation1) + '\n' + JSON.stringify(annotation2) + '\n' + JSON.stringify(annotation3) + '\n'
        );

        const results = await annotationStore.loadAllForTraceId('trace-001');
        expect(results).toHaveLength(3);
        expect(results[0].id).toBe('ann-002'); // Most recent
        expect(results[1].id).toBe('ann-003');
        expect(results[2].id).toBe('ann-001'); // Oldest
      });

      it('should return empty array for trace with no annotations', async () => {
        const results = await annotationStore.loadAllForTraceId('non-existent');
        expect(results).toEqual([]);
      });
    });

    describe('append()', () => {
      it('should append annotation to file', async () => {
        const annotation: Annotation = {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'pass',
          notes: 'Good',
          duration: 1000,
          source: 'manual',
        };

        await annotationStore.append(annotation);

        const content = await fs.readFile(annotationFilePath, 'utf-8');
        expect(content.trim()).toBe(JSON.stringify(annotation));
      });
    });

    describe('getStats()', () => {
      it('should return zero stats for empty annotations', async () => {
        const stats = await annotationStore.getStats();
        expect(stats.total).toBe(0);
        expect(stats.passed).toBe(0);
        expect(stats.failed).toBe(0);
        expect(stats.passRate).toBe(0);
        expect(stats.byCategory).toEqual({});
      });

      it('should calculate pass rate correctly', async () => {
        const annotations: Annotation[] = [
          {
            id: 'ann-001',
            traceId: 'trace-001',
            annotator: 'test@example.com',
            timestamp: new Date().toISOString(),
            label: 'pass',
            notes: '',
            duration: 1000,
            source: 'manual',
          },
          {
            id: 'ann-002',
            traceId: 'trace-002',
            annotator: 'test@example.com',
            timestamp: new Date().toISOString(),
            label: 'fail',
            failureCategory: 'hallucination',
            notes: '',
            duration: 1000,
            source: 'manual',
          },
          {
            id: 'ann-003',
            traceId: 'trace-003',
            annotator: 'test@example.com',
            timestamp: new Date().toISOString(),
            label: 'pass',
            notes: '',
            duration: 1000,
            source: 'manual',
          },
        ];

        for (const ann of annotations) {
          await annotationStore.append(ann);
        }

        const stats = await annotationStore.getStats();
        expect(stats.total).toBe(3);
        expect(stats.passed).toBe(2);
        expect(stats.failed).toBe(1);
        expect(stats.passRate).toBe(2 / 3);
      });

      it('should group failures by category', async () => {
        const annotations: Annotation[] = [
          {
            id: 'ann-001',
            traceId: 'trace-001',
            annotator: 'test@example.com',
            timestamp: new Date().toISOString(),
            label: 'fail',
            failureCategory: 'hallucination',
            notes: '',
            duration: 1000,
            source: 'manual',
          },
          {
            id: 'ann-002',
            traceId: 'trace-002',
            annotator: 'test@example.com',
            timestamp: new Date().toISOString(),
            label: 'fail',
            failureCategory: 'hallucination',
            notes: '',
            duration: 1000,
            source: 'manual',
          },
          {
            id: 'ann-003',
            traceId: 'trace-003',
            annotator: 'test@example.com',
            timestamp: new Date().toISOString(),
            label: 'fail',
            failureCategory: 'incomplete',
            notes: '',
            duration: 1000,
            source: 'manual',
          },
          {
            id: 'ann-004',
            traceId: 'trace-004',
            annotator: 'test@example.com',
            timestamp: new Date().toISOString(),
            label: 'pass',
            notes: '',
            duration: 1000,
            source: 'manual',
          },
        ];

        for (const ann of annotations) {
          await annotationStore.append(ann);
        }

        const stats = await annotationStore.getStats();
        expect(stats.byCategory).toEqual({
          hallucination: 2,
          incomplete: 1,
        });
      });

      it('should handle annotations without failure categories', async () => {
        const annotations: Annotation[] = [
          {
            id: 'ann-001',
            traceId: 'trace-001',
            annotator: 'test@example.com',
            timestamp: new Date().toISOString(),
            label: 'fail',
            notes: '',
            duration: 1000,
            source: 'manual',
          },
          {
            id: 'ann-002',
            traceId: 'trace-002',
            annotator: 'test@example.com',
            timestamp: new Date().toISOString(),
            label: 'pass',
            notes: '',
            duration: 1000,
            source: 'manual',
          },
        ];

        for (const ann of annotations) {
          await annotationStore.append(ann);
        }

        const stats = await annotationStore.getStats();
        expect(stats.byCategory).toEqual({});
      });
    });
  });

  // ==================== TaxonomyStore Tests ====================

  describe('TaxonomyStore', () => {
    let taxonomyStore: TaxonomyStore;
    let taxonomyFilePath: string;

    beforeEach(() => {
      taxonomyFilePath = path.join(tempDir, 'taxonomy.json');
      taxonomyStore = new TaxonomyStore(taxonomyFilePath);
    });

    describe('load()', () => {
      it('should return null when file does not exist', async () => {
        const taxonomy = await taxonomyStore.load();
        expect(taxonomy).toBeNull();
      });

      it('should load taxonomy from JSON file', async () => {
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
              examples: ['trace-001', 'trace-002'],
            },
          ],
          stats: {
            totalAnnotated: 10,
            totalPassed: 7,
            totalFailed: 3,
            passRate: 0.7,
          },
        };

        await fs.writeFile(taxonomyFilePath, JSON.stringify(taxonomy, null, 2));

        const loaded = await taxonomyStore.load();
        expect(loaded).not.toBeNull();
        expect(loaded?.version).toBe('1.0');
        expect(loaded?.categories).toHaveLength(1);
        expect(loaded?.stats.passRate).toBe(0.7);
      });
    });

    describe('save()', () => {
      it('should save taxonomy to JSON file', async () => {
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
              examples: ['trace-001'],
            },
          ],
          stats: {
            totalAnnotated: 10,
            totalPassed: 7,
            totalFailed: 3,
            passRate: 0.7,
          },
        };

        await taxonomyStore.save(taxonomy);

        const exists = await fs.pathExists(taxonomyFilePath);
        expect(exists).toBe(true);

        const content = await fs.readFile(taxonomyFilePath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed.version).toBe('1.0');
        expect(parsed.categories).toHaveLength(1);
      });

      it('should pretty-print JSON with indentation', async () => {
        const taxonomy: FailureTaxonomy = {
          version: '1.0',
          lastUpdated: new Date().toISOString(),
          annotator: 'test@example.com',
          categories: [],
          stats: {
            totalAnnotated: 0,
            totalPassed: 0,
            totalFailed: 0,
            passRate: 0,
          },
        };

        await taxonomyStore.save(taxonomy);

        const content = await fs.readFile(taxonomyFilePath, 'utf-8');
        expect(content).toContain('\n');
        expect(content).toContain('  ');
      });
    });

    describe('exists()', () => {
      it('should return false when file does not exist', async () => {
        const exists = await taxonomyStore.exists();
        expect(exists).toBe(false);
      });

      it('should return true when file exists', async () => {
        await fs.writeFile(taxonomyFilePath, '{}');
        const exists = await taxonomyStore.exists();
        expect(exists).toBe(true);
      });
    });
  });

  // ==================== Integration Tests ====================

  describe('Integration', () => {
    it('should handle concurrent writes from multiple stores', async () => {
      const traceFile = path.join(tempDir, 'concurrent.jsonl');
      const store1 = new TraceStore(traceFile);
      const store2 = new TraceStore(traceFile);

      const trace1: Trace = {
        id: 'trace-001',
        timestamp: new Date().toISOString(),
        query: 'Q1?',
        response: 'A1',
      };
      const trace2: Trace = {
        id: 'trace-002',
        timestamp: new Date().toISOString(),
        query: 'Q2?',
        response: 'A2',
      };

      // Write from both stores
      await store1.append(trace1);
      await store2.append(trace2);

      // Read from first store
      const loaded = await store1.loadAll();
      expect(loaded).toHaveLength(2);
    });

    it('should maintain data integrity across multiple operations', async () => {
      const traceFile = path.join(tempDir, 'integrity.jsonl');
      const store = new TraceStore(traceFile);

      // Add traces
      const traces: Trace[] = [];
      for (let i = 0; i < 100; i++) {
        traces.push({
          id: `trace-${i.toString().padStart(3, '0')}`,
          timestamp: new Date().toISOString(),
          query: `Question ${i}?`,
          response: `Answer ${i}`,
          metadata: { latency: i * 10 },
        });
      }

      await store.appendMany(traces);

      // Verify count
      expect(await store.count()).toBe(100);

      // Verify all loaded
      const loaded = await store.loadAll();
      expect(loaded).toHaveLength(100);
      expect(loaded[50].id).toBe('trace-050');

      // Verify individual lookup
      const single = await store.loadById('trace-099');
      expect(single?.metadata?.latency).toBe(990);
    });
  });
});
