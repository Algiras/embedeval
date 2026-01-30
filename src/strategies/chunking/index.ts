/**
 * Fixed Size Chunking Strategy
 */

import { Document } from '../../core/types';
import { Chunk, StrategyContext, StrategyStage } from '../types';

export interface FixedSizeChunkingConfig {
  size: number;        // Chunk size in characters
  overlap: number;     // Overlap in characters
}

export class FixedSizeChunkingStage implements StrategyStage {
  name = 'fixed-size-chunking';
  type = 'chunking' as const;

  constructor(private config: FixedSizeChunkingConfig) {}

  async execute(context: StrategyContext): Promise<StrategyContext> {
    const startTime = Date.now();
    const chunks: Chunk[] = [];
    let chunkId = 0;

    for (const doc of context.originalDocuments) {
      const content = doc.content;
      const { size, overlap } = this.config;
      
      let start = 0;
      while (start < content.length) {
        const end = Math.min(start + size, content.length);
        const chunkContent = content.slice(start, end);
        
        chunks.push({
          id: `chunk-${chunkId++}`,
          content: chunkContent,
          parentDocId: doc.id,
          startIndex: start,
          endIndex: end,
          metadata: {
            ...doc.metadata,
            originalDocId: doc.id,
          },
        });

        // Move start forward by (size - overlap)
        start += size - overlap;
        
        // If we're at the end, break
        if (end === content.length) break;
      }
    }

    const duration = Date.now() - startTime;
    context.chunks = chunks;
    context.stageTimings.set('chunking', duration);
    context.stageMetadata.set('chunking', {
      strategy: 'fixed-size',
      numChunks: chunks.length,
      avgChunkSize: chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length,
    });

    return context;
  }
}

/**
 * Semantic Chunking Strategy (using embeddings to find boundaries)
 */
export interface SemanticChunkingConfig {
  maxSize: number;           // Maximum chunk size
  similarityThreshold: number; // Threshold for semantic similarity (0-1)
}

export class SemanticChunkingStage implements StrategyStage {
  name = 'semantic-chunking';
  type = 'chunking' as const;

  constructor(private config: SemanticChunkingConfig) {}

  async execute(context: StrategyContext): Promise<StrategyContext> {
    const startTime = Date.now();
    const chunks: Chunk[] = [];
    let chunkId = 0;

    // Simple implementation: split by paragraphs and group by similarity
    // In production, you'd use embeddings to find semantic boundaries
    for (const doc of context.originalDocuments) {
      const paragraphs = doc.content.split(/\n\s*\n/);
      let currentChunk: string[] = [];
      let currentSize = 0;
      let startIndex = 0;

      for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i].trim();
        if (!para) continue;

        // If adding this paragraph would exceed max size, save current chunk
        if (currentSize + para.length > this.config.maxSize && currentChunk.length > 0) {
          const chunkContent = currentChunk.join('\n\n');
          chunks.push({
            id: `chunk-${chunkId++}`,
            content: chunkContent,
            parentDocId: doc.id,
            startIndex,
            endIndex: startIndex + chunkContent.length,
            metadata: {
              ...doc.metadata,
              originalDocId: doc.id,
              paragraphs: currentChunk.length,
            },
          });
          
          startIndex += chunkContent.length + 2; // +2 for \n\n
          currentChunk = [para];
          currentSize = para.length;
        } else {
          currentChunk.push(para);
          currentSize += para.length + 2; // +2 for \n\n
          // If this is the last paragraph, save the chunk
          if (i === paragraphs.length - 1) {
            const chunkContent = currentChunk.join('\n\n');
            chunks.push({
              id: `chunk-${chunkId++}`,
              content: chunkContent,
              parentDocId: doc.id,
              startIndex,
              endIndex: startIndex + chunkContent.length,
              metadata: {
                ...doc.metadata,
                originalDocId: doc.id,
                paragraphs: currentChunk.length,
              },
            });
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    context.chunks = chunks;
    context.stageTimings.set('chunking', duration);
    context.stageMetadata.set('chunking', {
      strategy: 'semantic',
      numChunks: chunks.length,
      avgChunkSize: chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length,
    });

    return context;
  }
}

/**
 * Sliding Window Chunking Strategy
 */
export interface SlidingWindowChunkingConfig {
  size: number;    // Window size in characters
  step: number;    // Step size (how much to slide)
}

export class SlidingWindowChunkingStage implements StrategyStage {
  name = 'sliding-window-chunking';
  type = 'chunking' as const;

  constructor(private config: SlidingWindowChunkingConfig) {}

  async execute(context: StrategyContext): Promise<StrategyContext> {
    const startTime = Date.now();
    const chunks: Chunk[] = [];
    let chunkId = 0;

    for (const doc of context.originalDocuments) {
      const content = doc.content;
      const { size, step } = this.config;
      
      let start = 0;
      while (start < content.length) {
        const end = Math.min(start + size, content.length);
        const chunkContent = content.slice(start, end);
        
        chunks.push({
          id: `chunk-${chunkId++}`,
          content: chunkContent,
          parentDocId: doc.id,
          startIndex: start,
          endIndex: end,
          metadata: {
            ...doc.metadata,
            originalDocId: doc.id,
            windowStart: start,
          },
        });

        start += step;
        if (end === content.length) break;
      }
    }

    const duration = Date.now() - startTime;
    context.chunks = chunks;
    context.stageTimings.set('chunking', duration);
    context.stageMetadata.set('chunking', {
      strategy: 'sliding-window',
      numChunks: chunks.length,
      avgChunkSize: chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length,
    });

    return context;
  }
}
