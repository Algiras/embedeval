/**
 * Strategy System Tests
 */

import { FixedSizeChunkingStage, SemanticChunkingStage, SlidingWindowChunkingStage } from '../src/strategies/chunking';
import { BM25RetrievalStage } from '../src/strategies/retrieval/bm25';
import { ReciprocalRankFusionStage, WeightedFusionStage } from '../src/strategies/fusion';
import { MMRRerankingStage } from '../src/strategies/reranking';
import { StrategyContext } from '../src/strategies/types';
import { TestCase } from '../src/core/types';

describe('Chunking Strategies', () => {
  const mockDocuments = [
    { id: 'doc1', content: 'This is a test document. It has multiple sentences. Here is another one.', metadata: {} },
    { id: 'doc2', content: 'Second document with different content. More text here.', metadata: {} },
  ];

  const mockContext: StrategyContext = {
    query: 'test query',
    queryId: 'q1',
    testCase: { id: 'q1', query: 'test', relevantDocs: ['doc1'] } as TestCase,
    originalDocuments: mockDocuments,
    stageTimings: new Map(),
    stageMetadata: new Map(),
  };

  test('FixedSizeChunkingStage creates chunks of correct size', async () => {
    const stage = new FixedSizeChunkingStage({ size: 20, overlap: 5 });
    const result = await stage.execute(mockContext);

    expect(result.chunks).toBeDefined();
    expect(result.chunks!.length).toBeGreaterThan(0);
    expect(result.stageMetadata.get('chunking').strategy).toBe('fixed-size');
  });

  test('SemanticChunkingStage chunks by paragraphs', async () => {
    const stage = new SemanticChunkingStage({ maxSize: 100, similarityThreshold: 0.7 });
    const result = await stage.execute(mockContext);

    expect(result.chunks).toBeDefined();
    expect(result.chunks!.length).toBeGreaterThan(0);
    expect(result.stageMetadata.get('chunking').strategy).toBe('semantic');
  });

  test('SlidingWindowChunkingStage creates overlapping windows', async () => {
    const stage = new SlidingWindowChunkingStage({ size: 15, step: 10 });
    const result = await stage.execute(mockContext);

    expect(result.chunks).toBeDefined();
    expect(result.chunks!.length).toBeGreaterThan(0);
    expect(result.stageMetadata.get('chunking').strategy).toBe('sliding-window');
  });
});

describe('BM25 Retrieval', () => {
  const mockDocuments = [
    { id: 'doc1', content: 'The quick brown fox jumps over the lazy dog', metadata: {} },
    { id: 'doc2', content: 'A quick brown dog runs in the park', metadata: {} },
    { id: 'doc3', content: 'Lazy dogs sleep all day', metadata: {} },
  ];

  const mockContext: StrategyContext = {
    query: 'quick brown fox',
    queryId: 'q1',
    testCase: { id: 'q1', query: 'quick brown fox', relevantDocs: ['doc1'] } as TestCase,
    originalDocuments: mockDocuments,
    stageTimings: new Map(),
    stageMetadata: new Map(),
  };

  test('BM25RetrievalStage returns ranked results', async () => {
    const stage = new BM25RetrievalStage({ k: 10 });
    const result = await stage.execute(mockContext);

    expect(result.bm25Results).toBeDefined();
    expect(result.bm25Results!.length).toBeGreaterThan(0);
    expect(result.bm25Results![0].score).toBeGreaterThan(0);
  });
});

describe('Fusion Strategies', () => {
  const mockContext: StrategyContext = {
    query: 'test',
    queryId: 'q1',
    testCase: { id: 'q1', query: 'test', relevantDocs: ['doc1'] } as TestCase,
    originalDocuments: [],
    retrievedDocs: [
      { id: 'doc1', content: 'A', score: 0.9, rank: 1, isRelevant: true },
      { id: 'doc2', content: 'B', score: 0.8, rank: 2, isRelevant: false },
    ],
    bm25Results: [
      { id: 'doc2', content: 'B', score: 0.85, rank: 1, isRelevant: false },
      { id: 'doc1', content: 'A', score: 0.75, rank: 2, isRelevant: true },
    ],
    stageTimings: new Map(),
    stageMetadata: new Map(),
  };

  test('ReciprocalRankFusionStage combines results', async () => {
    const stage = new ReciprocalRankFusionStage({ k: 60, topK: 10 });
    const result = await stage.execute(mockContext);

    expect(result.fusedResults).toBeDefined();
    expect(result.fusedResults!.length).toBeGreaterThan(0);
    expect(result.stageMetadata.get('fusion').method).toBe('rrf');
  });

  test('WeightedFusionStage combines with weights', async () => {
    const stage = new WeightedFusionStage({ weights: [0.6, 0.4], topK: 10 });
    const result = await stage.execute(mockContext);

    expect(result.fusedResults).toBeDefined();
    expect(result.fusedResults!.length).toBeGreaterThan(0);
    expect(result.stageMetadata.get('fusion').method).toBe('weighted');
  });
});

describe('MMR Re-ranking', () => {
  const mockContext: StrategyContext = {
    query: 'test',
    queryId: 'q1',
    testCase: { id: 'q1', query: 'test', relevantDocs: ['doc1'] } as TestCase,
    originalDocuments: [],
    retrievedDocs: [
      { id: 'doc1', content: 'A', score: 0.9, rank: 1, isRelevant: true },
      { id: 'doc2', content: 'B', score: 0.8, rank: 2, isRelevant: false },
      { id: 'doc3', content: 'C', score: 0.7, rank: 3, isRelevant: false },
    ],
    documentEmbeddings: new Map([
      ['doc1', [1, 0, 0]],
      ['doc2', [0.9, 0.1, 0]],
      ['doc3', [0, 1, 0]],
    ]),
    stageTimings: new Map(),
    stageMetadata: new Map(),
  };

  test('MMRRerankingStage balances relevance and diversity', async () => {
    const stage = new MMRRerankingStage({ lambda: 0.5, topK: 2 });
    const result = await stage.execute(mockContext);

    expect(result.rerankedDocs).toBeDefined();
    expect(result.rerankedDocs!.length).toBe(2);
    expect(result.stageMetadata.get('reranking').method).toBe('mmr');
  });
});
