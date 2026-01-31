/**
 * Comprehensive tests for Taxonomy CLI Commands
 * Tests taxonomy build, show, update, validation, and category aggregation
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { taxonomyCommand } from '../../src/cli/commands/taxonomy';
import { TaxonomyStore, AnnotationStore } from '../../src/core/storage';
import { Annotation, FailureTaxonomy } from '../../src/core/types';

describe('Taxonomy CLI Commands', () => {
  let tempDir: string;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'embedeval-taxonomy-test-'));
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // ==================== taxonomy build Tests ====================

  describe('taxonomy build', () => {
    let annotationsPath: string;
    let taxonomyPath: string;

    beforeEach(() => {
      annotationsPath = path.join(tempDir, 'annotations.jsonl');
      taxonomyPath = path.join(tempDir, 'taxonomy.json');
    });

    it('should build taxonomy from mixed pass/fail annotations', async () => {
      const annotations: Annotation[] = [
        {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'pass',
          notes: 'Good response',
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
          notes: 'Made up facts not in context',
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
          notes: 'Did not fully answer question',
          duration: 1000,
          source: 'manual',
        },
      ];

      const annotationStore = new AnnotationStore(annotationsPath);
      for (const ann of annotations) {
        await annotationStore.append(ann);
      }

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy).not.toBeNull();
      expect(taxonomy?.annotator).toBe('test@example.com');
      expect(taxonomy?.stats.totalAnnotated).toBe(3);
      expect(taxonomy?.stats.totalPassed).toBe(1);
      expect(taxonomy?.stats.totalFailed).toBe(2);
      expect(taxonomy?.stats.passRate).toBe(1 / 3);
      expect(taxonomy?.categories).toHaveLength(2);
      expect(taxonomy?.categories[0].id).toBe('hallucination');
      expect(taxonomy?.categories[0].count).toBe(1);
    });

    it('should handle annotations without failure categories', async () => {
      const annotations: Annotation[] = [
        {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          notes: 'Just failed, no category',
          duration: 1000,
          source: 'manual',
        },
      ];

      const annotationStore = new AnnotationStore(annotationsPath);
      await annotationStore.append(annotations[0]);

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy?.categories).toHaveLength(1);
      expect(taxonomy?.categories[0].id).toBe('uncategorized');
      expect(taxonomy?.categories[0].name).toBe('Uncategorized');
    });

    it('should aggregate failures by category correctly', async () => {
      const annotations: Annotation[] = [
        {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'hallucination',
          notes: 'Hallucination 1',
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
          notes: 'Hallucination 2',
          duration: 1000,
          source: 'manual',
        },
        {
          id: 'ann-003',
          traceId: 'trace-003',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'hallucination',
          notes: 'Hallucination 3',
          duration: 1000,
          source: 'manual',
        },
        {
          id: 'ann-004',
          traceId: 'trace-004',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'incomplete',
          notes: 'Incomplete answer',
          duration: 1000,
          source: 'manual',
        },
      ];

      const annotationStore = new AnnotationStore(annotationsPath);
      for (const ann of annotations) {
        await annotationStore.append(ann);
      }

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy?.categories).toHaveLength(2);
      expect(taxonomy?.categories[0].id).toBe('hallucination');
      expect(taxonomy?.categories[0].count).toBe(3);
      expect(taxonomy?.categories[1].id).toBe('incomplete');
      expect(taxonomy?.categories[1].count).toBe(1);
    });

    it('should include example trace IDs up to 5', async () => {
      const annotations: Annotation[] = [];
      for (let i = 0; i < 7; i++) {
        annotations.push({
          id: `ann-${i.toString().padStart(3, '0')}`,
          traceId: `trace-${i.toString().padStart(3, '0')}`,
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'hallucination',
          notes: `Example ${i}`,
          duration: 1000,
          source: 'manual',
        });
      }

      const annotationStore = new AnnotationStore(annotationsPath);
      for (const ann of annotations) {
        await annotationStore.append(ann);
      }

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy?.categories[0].examples).toHaveLength(5);
      expect(taxonomy?.categories[0].examples).toEqual([
        'trace-000',
        'trace-001',
        'trace-002',
        'trace-003',
        'trace-004',
      ]);
    });

    it('should sort categories by count descending', async () => {
      const annotations: Annotation[] = [
        {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'incomplete',
          notes: 'Incomplete',
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
          notes: 'Hallucination 1',
          duration: 1000,
          source: 'manual',
        },
        {
          id: 'ann-003',
          traceId: 'trace-003',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'hallucination',
          notes: 'Hallucination 2',
          duration: 1000,
          source: 'manual',
        },
        {
          id: 'ann-004',
          traceId: 'trace-004',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'hallucination',
          notes: 'Hallucination 3',
          duration: 1000,
          source: 'manual',
        },
      ];

      const annotationStore = new AnnotationStore(annotationsPath);
      for (const ann of annotations) {
        await annotationStore.append(ann);
      }

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy?.categories[0].id).toBe('hallucination');
      expect(taxonomy?.categories[0].count).toBe(3);
      expect(taxonomy?.categories[1].id).toBe('incomplete');
      expect(taxonomy?.categories[1].count).toBe(1);
    });

    it('should build description from annotation notes', async () => {
      const annotations: Annotation[] = [
        {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'hallucination',
          notes: 'Contains made up numbers',
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
          notes: 'Invents fictional features',
          duration: 1000,
          source: 'manual',
        },
      ];

      const annotationStore = new AnnotationStore(annotationsPath);
      for (const ann of annotations) {
        await annotationStore.append(ann);
      }

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy?.categories[0].description).toContain('Contains made up numbers');
      expect(taxonomy?.categories[0].description).toContain('Invents fictional features');
    });

    it('should display success message with statistics', async () => {
      const annotations: Annotation[] = [
        {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'pass',
          notes: 'Good',
          duration: 1000,
          source: 'manual',
        },
      ];

      const annotationStore = new AnnotationStore(annotationsPath);
      await annotationStore.append(annotations[0]);

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Taxonomy built successfully'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Total annotated: 1'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Pass rate: 100.0%'));
    });

    it('should handle empty annotations file', async () => {
      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy).not.toBeNull();
      expect(taxonomy?.stats.totalAnnotated).toBe(0);
      expect(taxonomy?.stats.passRate).toBe(0);
      expect(taxonomy?.categories).toHaveLength(0);
    });
  });

  // ==================== taxonomy show Tests ====================

  describe('taxonomy show', () => {
    let taxonomyPath: string;

    beforeEach(() => {
      taxonomyPath = path.join(tempDir, 'taxonomy.json');
    });

    it('should display taxonomy when it exists', async () => {
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

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      await taxonomyStore.save(taxonomy);

      await taxonomyCommand.show({ taxonomy: taxonomyPath });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Failure Taxonomy'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Maintained by: test@example.com'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Total annotated: 10'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Pass rate: 70.0%'));
    });

    it('should display friendly message when taxonomy does not exist', async () => {
      await taxonomyCommand.show({ taxonomy: taxonomyPath });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No taxonomy found'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('taxonomy build'));
    });

    it('should display all categories with descriptions', async () => {
      const taxonomy: FailureTaxonomy = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        annotator: 'test@example.com',
        categories: [
          {
            id: 'hallucination',
            name: 'Hallucination',
            description: 'Made up facts not in context',
            count: 5,
            examples: ['trace-001'],
          },
          {
            id: 'incomplete',
            name: 'Incomplete',
            description: '',
            count: 2,
            examples: ['trace-002'],
          },
        ],
        stats: {
          totalAnnotated: 10,
          totalPassed: 3,
          totalFailed: 7,
          passRate: 0.3,
        },
      };

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      await taxonomyStore.save(taxonomy);

      await taxonomyCommand.show({ taxonomy: taxonomyPath });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Hallucination'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Made up facts'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Incomplete'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No description'));
    });
  });

  // ==================== taxonomy update Tests ====================

  describe('taxonomy update', () => {
    let annotationsPath: string;
    let taxonomyPath: string;

    beforeEach(() => {
      annotationsPath = path.join(tempDir, 'annotations.jsonl');
      taxonomyPath = path.join(tempDir, 'taxonomy.json');
    });

    it('should update taxonomy with new annotations', async () => {
      const initialAnnotations: Annotation[] = [
        {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'hallucination',
          notes: 'Initial annotation',
          duration: 1000,
          source: 'manual',
        },
      ];

      const annotationStore = new AnnotationStore(annotationsPath);
      for (const ann of initialAnnotations) {
        await annotationStore.append(ann);
      }

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      const newAnnotations: Annotation[] = [
        {
          id: 'ann-002',
          traceId: 'trace-002',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'hallucination',
          notes: 'New annotation',
          duration: 1000,
          source: 'manual',
        },
      ];

      for (const ann of newAnnotations) {
        await annotationStore.append(ann);
      }

      await taxonomyCommand.update({
        taxonomy: taxonomyPath,
        annotations: annotationsPath,
      });

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy?.stats.totalFailed).toBe(2);
      expect(taxonomy?.categories[0].count).toBe(2);
    });

    it('should throw error when updating non-existent taxonomy', async () => {
      await expect(
        taxonomyCommand.update({
          taxonomy: taxonomyPath,
          annotations: annotationsPath,
        })
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', expect.any(String));
    });

    it('should display success message after update', async () => {
      const annotations: Annotation[] = [
        {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'pass',
          notes: 'Good',
          duration: 1000,
          source: 'manual',
        },
      ];

      const annotationStore = new AnnotationStore(annotationsPath);
      await annotationStore.append(annotations[0]);

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      await taxonomyCommand.update({
        taxonomy: taxonomyPath,
        annotations: annotationsPath,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Taxonomy updated'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Pass rate: 100.0%'));
    });
  });

  // ==================== Validation Tests ====================

  describe('validation', () => {
    it('should require valid annotations file path', async () => {
      const taxonomyPath = path.join(tempDir, 'taxonomy.json');
      const invalidAnnotationsPath = path.join(tempDir, 'nonexistent.jsonl');

      await expect(
        taxonomyCommand.build({
          annotations: invalidAnnotationsPath,
          user: 'test@example.com',
          output: taxonomyPath,
        })
      ).resolves.not.toThrow();

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy).not.toBeNull();
      expect(taxonomy?.stats.totalAnnotated).toBe(0);
    });

    it('should require user parameter for build', async () => {
      const annotationsPath = path.join(tempDir, 'annotations.jsonl');
      const taxonomyPath = path.join(tempDir, 'taxonomy.json');

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'required@example.com',
        output: taxonomyPath,
      });

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy?.annotator).toBe('required@example.com');
    });

    it('should handle corrupted taxonomy file gracefully', async () => {
      const taxonomyPath = path.join(tempDir, 'taxonomy.json');
      await fs.writeFile(taxonomyPath, '{ invalid json }');

      await expect(
        taxonomyCommand.show({ taxonomy: taxonomyPath })
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', expect.any(String));
    });
  });

  // ==================== Category Aggregation Tests ====================

  describe('category aggregation', () => {
    let annotationsPath: string;
    let taxonomyPath: string;

    beforeEach(() => {
      annotationsPath = path.join(tempDir, 'annotations.jsonl');
      taxonomyPath = path.join(tempDir, 'taxonomy.json');
    });

    it('should aggregate annotations across multiple categories', async () => {
      const annotations: Annotation[] = [
        {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'hallucination',
          notes: 'H1',
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
          notes: 'H2',
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
          notes: 'I1',
          duration: 1000,
          source: 'manual',
        },
        {
          id: 'ann-004',
          traceId: 'trace-004',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'incomplete',
          notes: 'I2',
          duration: 1000,
          source: 'manual',
        },
        {
          id: 'ann-005',
          traceId: 'trace-005',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'incomplete',
          notes: 'I3',
          duration: 1000,
          source: 'manual',
        },
      ];

      const annotationStore = new AnnotationStore(annotationsPath);
      for (const ann of annotations) {
        await annotationStore.append(ann);
      }

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy?.stats.totalFailed).toBe(5);
      expect(taxonomy?.categories).toHaveLength(2);
      expect(taxonomy?.categories[0].id).toBe('incomplete');
      expect(taxonomy?.categories[0].count).toBe(3);
      expect(taxonomy?.categories[1].id).toBe('hallucination');
      expect(taxonomy?.categories[1].count).toBe(2);
    });

    it('should calculate percentage distribution correctly', async () => {
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
          label: 'fail',
          failureCategory: 'hallucination',
          notes: '',
          duration: 1000,
          source: 'manual',
        },
        {
          id: 'ann-004',
          traceId: 'trace-004',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          failureCategory: 'incomplete',
          notes: '',
          duration: 1000,
          source: 'manual',
        },
      ];

      const annotationStore = new AnnotationStore(annotationsPath);
      for (const ann of annotations) {
        await annotationStore.append(ann);
      }

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      await taxonomyCommand.show({ taxonomy: taxonomyPath });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('66.7%'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('33.3%'));
    });

    it('should preserve category ID for uncategorized failures', async () => {
      const annotations: Annotation[] = [
        {
          id: 'ann-001',
          traceId: 'trace-001',
          annotator: 'test@example.com',
          timestamp: new Date().toISOString(),
          label: 'fail',
          notes: 'Uncategorized failure',
          duration: 1000,
          source: 'manual',
        },
      ];

      const annotationStore = new AnnotationStore(annotationsPath);
      await annotationStore.append(annotations[0]);

      await taxonomyCommand.build({
        annotations: annotationsPath,
        user: 'test@example.com',
        output: taxonomyPath,
      });

      const taxonomyStore = new TaxonomyStore(taxonomyPath);
      const taxonomy = await taxonomyStore.load();

      expect(taxonomy?.categories[0].id).toBe('uncategorized');
      expect(taxonomy?.categories[0].name).toBe('Uncategorized');
      expect(taxonomy?.categories[0].count).toBe(1);
    });
  });
});
