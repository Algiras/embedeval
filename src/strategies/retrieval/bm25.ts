/**
 * BM25 Retrieval Implementation
 * Based on the classic Okapi BM25 algorithm
 */

import { Document, RetrievedDoc } from '../../core/types';
import { StrategyContext, StrategyStage } from '../types';

export interface BM25Config {
  k: number;           // Number of results to return
  k1?: number;         // BM25 k1 parameter (default: 1.2)
  b?: number;          // BM25 b parameter (default: 0.75)
}

export class BM25RetrievalStage implements StrategyStage {
  name = 'bm25-retrieval';
  type = 'bm25' as const;
  
  private k1: number;
  private b: number;
  private docFreqs: Map<string, number> = new Map();
  private docLengths: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private totalDocs: number = 0;
  private documents: Document[] = [];

  constructor(private config: BM25Config) {
    this.k1 = config.k1 ?? 1.2;
    this.b = config.b ?? 0.75;
  }

  async execute(context: StrategyContext): Promise<StrategyContext> {
    const startTime = Date.now();
    
    // Use chunks if available, otherwise use original documents
    const docsToIndex = context.chunks || context.originalDocuments;
    this.documents = docsToIndex.map((c: any) => ({
      id: c.id,
      content: c.content,
      metadata: c.metadata,
    }));

    // Build index
    this.buildIndex(this.documents);

    // Search
    const results = this.search(context.query, this.config.k);

    const duration = Date.now() - startTime;
    context.bm25Results = results;
    context.stageTimings.set('bm25', duration);
    context.stageMetadata.set('bm25', {
      numDocs: this.totalDocs,
      avgDocLength: this.avgDocLength,
    });

    return context;
  }

  private buildIndex(docs: Document[]): void {
    this.totalDocs = docs.length;
    let totalLength = 0;

    // Calculate document frequencies and lengths
    for (const doc of docs) {
      const terms = this.tokenize(doc.content);
      const uniqueTerms = new Set(terms);
      
      this.docLengths.set(doc.id, terms.length);
      totalLength += terms.length;

      for (const term of uniqueTerms) {
        this.docFreqs.set(term, (this.docFreqs.get(term) || 0) + 1);
      }
    }

    this.avgDocLength = totalLength / this.totalDocs;
  }

  private search(query: string, k: number): RetrievedDoc[] {
    const queryTerms = this.tokenize(query);
    const scores: Map<string, number> = new Map();

    for (const doc of this.documents) {
      let score = 0;
      const docTerms = this.tokenize(doc.content);
      const docLength = docTerms.length;
      
      for (const term of queryTerms) {
        const tf = docTerms.filter(t => t === term).length;
        const df = this.docFreqs.get(term) || 0;
        
        if (df === 0) continue;

        const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);
        const tfNorm = (tf * (this.k1 + 1)) / (tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength)));
        
        score += idf * tfNorm;
      }

      if (score > 0) {
        scores.set(doc.id, score);
      }
    }

    // Sort by score and create RetrievedDoc array
    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k);

    return sorted.map(([id, score], index) => {
      const doc = this.documents.find(d => d.id === id)!;
      return {
        id,
        content: doc.content,
        score,
        rank: index + 1,
        isRelevant: false, // Will be set later
        metadata: doc.metadata,
      };
    });
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }
}
