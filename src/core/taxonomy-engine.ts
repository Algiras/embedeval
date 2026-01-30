/**
 * Taxonomy Engine
 * Builds and maintains failure taxonomy from annotations
 * Implements "Axial Coding" from Hamel Husain's error analysis methodology
 */

import { Annotation, FailureTaxonomy, FailureCategory } from './types';
import { TaxonomyStore, AnnotationStore } from './storage';

export class TaxonomyEngine {
  private taxonomyStore: TaxonomyStore;
  private annotationStore: AnnotationStore;

  constructor(taxonomyPath: string, annotationsPath: string) {
    this.taxonomyStore = new TaxonomyStore(taxonomyPath);
    this.annotationStore = new AnnotationStore(annotationsPath);
  }

  /**
   * Build taxonomy from annotations using "Axial Coding"
   * Groups similar failures into categories
   */
  async build(annotator: string): Promise<FailureTaxonomy> {
    const annotations = await this.annotationStore.loadAll();
    const failedAnnotations = annotations.filter(a => a.label === 'fail');

    // Group by failure category
    const categoryMap = new Map<string, FailureCategory>();

    for (const annotation of failedAnnotations) {
      const categoryId = annotation.failureCategory || 'uncategorized';
      
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          id: categoryId,
          name: this.formatCategoryName(categoryId),
          description: '',
          count: 0,
          examples: [],
        });
      }

      const category = categoryMap.get(categoryId)!;
      category.count++;
      
      // Keep up to 5 example trace IDs
      if (category.examples.length < 5) {
        category.examples.push(annotation.traceId);
      }

      // Build description from notes (first 3 unique notes)
      if (annotation.notes && category.examples.length <= 3) {
        category.description += annotation.notes.substring(0, 100) + '; ';
      }
    }

    // Calculate stats
    const totalAnnotated = annotations.length;
    const totalPassed = annotations.filter(a => a.label === 'pass').length;
    const totalFailed = failedAnnotations.length;

    const taxonomy: FailureTaxonomy = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      annotator,
      categories: Array.from(categoryMap.values()).sort((a, b) => b.count - a.count),
      stats: {
        totalAnnotated,
        totalPassed,
        totalFailed,
        passRate: totalAnnotated > 0 ? totalPassed / totalAnnotated : 0,
      },
    };

    await this.taxonomyStore.save(taxonomy);
    return taxonomy;
  }

  /**
   * Update taxonomy with new annotations (incremental update)
   */
  async update(): Promise<FailureTaxonomy> {
    const existing = await this.taxonomyStore.load();
    if (!existing) {
      throw new Error('No existing taxonomy found. Run build() first.');
    }

    return this.build(existing.annotator);
  }

  /**
   * Get taxonomy as formatted string for display
   */
  formatAsString(taxonomy: FailureTaxonomy): string {
    const lines: string[] = [];
    lines.push('Failure Taxonomy');
    lines.push('=' .repeat(50));
    lines.push(`Total annotated: ${taxonomy.stats.totalAnnotated}`);
    lines.push(`Pass rate: ${(taxonomy.stats.passRate * 100).toFixed(1)}%`);
    lines.push(`Failed traces: ${taxonomy.stats.totalFailed}`);
    lines.push('');
    
    lines.push('Categories (sorted by frequency):');
    lines.push('-'.repeat(50));

    for (const category of taxonomy.categories) {
      const percentage = taxonomy.stats.totalFailed > 0
        ? ((category.count / taxonomy.stats.totalFailed) * 100).toFixed(1)
        : '0.0';
      
      lines.push(`${category.name}: ${category.count} (${percentage}%)`);
      if (category.description) {
        lines.push(`  ${category.description.substring(0, 80)}...`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Suggest categories for a new failure based on existing taxonomy
   */
  async suggestCategories(notes: string): Promise<string[]> {
    const taxonomy = await this.taxonomyStore.load();
    if (!taxonomy) return [];

    const notesLower = notes.toLowerCase();
    
    // Simple keyword matching (could be enhanced with embeddings)
    const suggestions = taxonomy.categories
      .filter(cat => {
        const nameMatch = cat.name.toLowerCase().includes(notesLower);
        const descMatch = cat.description.toLowerCase().includes(notesLower);
        return nameMatch || descMatch;
      })
      .map(cat => cat.id)
      .slice(0, 3);

    return suggestions;
  }

  private formatCategoryName(id: string): string {
    // Convert slug to human-readable name
    return id
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
