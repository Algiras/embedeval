/**
 * Strategy Discovery Module
 * 
 * Uses LLMs and research papers to discover new retrieval strategies:
 * - Analyzes performance gaps and suggests improvements
 * - Generates novel strategy combinations
 * - Learns from failure patterns
 * - Researches academic papers for new techniques
 * 
 * @module evolution/strategy-discovery
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AdvancedStrategyGenome,
  StrategyGenes,
  AdvancedGenomeFactory,
  RAG_ARCHITECTURES,
  RETRIEVAL_METHODS,
  QUERY_STRATEGIES,
  RERANKING_METHODS,
} from './advanced-genome';
import { TestCase, Document, LLMJudgeResult } from '../core/types';
import { logger } from '../utils/logger';

// ============================================================================
// RESEARCH PAPERS DATABASE
// ============================================================================

/**
 * Research papers and their key techniques
 */
export const RESEARCH_PAPERS = {
  // Query enhancement
  'HyDE': {
    title: 'Precise Zero-Shot Dense Retrieval without Relevance Labels',
    year: 2022,
    technique: 'Hypothetical Document Embeddings',
    description: 'Generate a hypothetical document that would answer the query, then use its embedding for retrieval',
    applicableTo: ['factual', 'analytical'],
    geneChanges: { queryStrategy: 'HYDE' },
  },
  
  'Query2Doc': {
    title: 'Query2Doc: Query Expansion with Large Language Models',
    year: 2023,
    technique: 'LLM Query Expansion',
    description: 'Use LLM to expand query with pseudo-documents',
    applicableTo: ['factual', 'procedural'],
    geneChanges: { queryStrategy: 'EXPANDED' },
  },
  
  'Step-Back': {
    title: 'Take a Step Back: Evoking Reasoning via Abstraction',
    year: 2023,
    technique: 'Step-back Prompting',
    description: 'Ask a more general question first, then use that context',
    applicableTo: ['analytical', 'complex'],
    geneChanges: { queryStrategy: 'STEP_BACK' },
  },
  
  // RAG Architectures
  'RAPTOR': {
    title: 'RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval',
    year: 2024,
    technique: 'Hierarchical Summarization',
    description: 'Build tree of summaries at different abstraction levels',
    applicableTo: ['long_docs', 'analytical'],
    geneChanges: { architecture: 'HIERARCHICAL', hierarchicalLevels: 3 },
  },
  
  'GraphRAG': {
    title: 'GraphRAG: Unlocking LLM discovery on narrative private data',
    year: 2024,
    technique: 'Knowledge Graph Enhanced Retrieval',
    description: 'Build knowledge graph, use graph traversal with retrieval',
    applicableTo: ['complex', 'multi_hop'],
    geneChanges: { architecture: 'GRAPH_RAG', graphEnabled: true },
  },
  
  'Self-RAG': {
    title: 'Self-RAG: Learning to Retrieve, Generate, and Critique',
    year: 2023,
    technique: 'Self-reflective Retrieval',
    description: 'Model decides when to retrieve and critiques its own outputs',
    applicableTo: ['factual', 'analytical'],
    geneChanges: { architecture: 'SELF_RAG', selfReflectionEnabled: true },
  },
  
  'CRAG': {
    title: 'Corrective Retrieval Augmented Generation',
    year: 2024,
    technique: 'Adaptive Retrieval Correction',
    description: 'Evaluate retrieval quality, trigger web search if needed',
    applicableTo: ['factual', 'current_events'],
    geneChanges: { architecture: 'CORRECTIVE_RAG' },
  },
  
  'Adaptive-RAG': {
    title: 'Adaptive-RAG: Learning to Adapt Retrieval-Augmented LLMs',
    year: 2024,
    technique: 'Query Complexity Routing',
    description: 'Route queries to different strategies based on complexity',
    applicableTo: ['mixed', 'variable_complexity'],
    geneChanges: { architecture: 'ADAPTIVE' },
  },
  
  // Retrieval methods
  'ColBERT': {
    title: 'ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction',
    year: 2020,
    technique: 'Late Interaction',
    description: 'Token-level matching instead of single vector similarity',
    applicableTo: ['precise', 'factual'],
    geneChanges: { embeddingStrategy: 'LATE_INTERACTION' },
  },
  
  'SPLADE': {
    title: 'SPLADE: Sparse Lexical and Expansion Model for First Stage Ranking',
    year: 2021,
    technique: 'Learned Sparse Representations',
    description: 'Learn sparse vectors that capture important terms',
    applicableTo: ['keyword_rich', 'factual'],
    geneChanges: { embeddingStrategy: 'SPARSE_LEARNED' },
  },
  
  // Reranking
  'RankGPT': {
    title: 'RankGPT: Zero-Shot Listwise Reranking with LLMs',
    year: 2023,
    technique: 'LLM Listwise Reranking',
    description: 'Use LLM to rerank entire list at once',
    applicableTo: ['any'],
    geneChanges: { rerankingMethod: 'LLM_LISTWISE' },
  },
  
  'LostInMiddle': {
    title: 'Lost in the Middle: How Language Models Use Long Contexts',
    year: 2023,
    technique: 'Positional Reordering',
    description: 'Reorder documents to avoid middle position bias',
    applicableTo: ['long_context'],
    geneChanges: { rerankingMethod: 'POSITIONAL' },
  },
  
  // Chunking
  'Parent-Child': {
    title: 'Advanced RAG: Parent Document Retrieval',
    year: 2023,
    technique: 'Parent-Child Chunks',
    description: 'Index small chunks, return parent chunks for context',
    applicableTo: ['long_docs'],
    geneChanges: { chunkingStrategy: 'PARENT_CHILD' },
  },
  
  'Sentence-Window': {
    title: 'LlamaIndex Sentence Window Retrieval',
    year: 2023,
    technique: 'Sentence Window',
    description: 'Index sentences, return with surrounding context window',
    applicableTo: ['precise'],
    geneChanges: { chunkingStrategy: 'SENTENCE', postProcessing: ['sentence_window'] },
  },
};

// ============================================================================
// STRATEGY DISCOVERY
// ============================================================================

/**
 * Failure pattern analysis
 */
export interface FailurePattern {
  pattern: string;
  examples: Array<{
    query: string;
    expectedDocs: string[];
    retrievedDocs: string[];
    score: number;
  }>;
  suggestedFixes: string[];
  frequency: number;
}

/**
 * Discovery suggestion
 */
export interface StrategySuggestion {
  id: string;
  name: string;
  description: string;
  rationale: string;
  basedOn?: string; // Paper name
  geneChanges: Partial<StrategyGenes>;
  expectedImprovement: number;
  applicableTo: string[];
  confidence: number;
}

/**
 * Strategy Discovery Engine
 */
export class StrategyDiscoveryEngine {
  private failurePatterns: FailurePattern[] = [];
  private llmJudgeResults: LLMJudgeResult[] = [];
  
  /**
   * Analyze evaluation results to find failure patterns
   */
  analyzeFailures(
    testCases: TestCase[],
    results: Map<string, { retrieved: string[]; score: number }>,
    documents: Map<string, Document>
  ): FailurePattern[] {
    const patterns: Map<string, FailurePattern> = new Map();
    
    for (const tc of testCases) {
      const result = results.get(tc.id);
      if (!result) continue;
      
      const score = result.score;
      if (score >= 0.8) continue; // Not a failure
      
      // Classify the failure
      const failureType = this.classifyFailure(tc, result.retrieved, tc.relevantDocs, documents);
      
      if (!patterns.has(failureType)) {
        patterns.set(failureType, {
          pattern: failureType,
          examples: [],
          suggestedFixes: this.getSuggestedFixes(failureType),
          frequency: 0,
        });
      }
      
      const pattern = patterns.get(failureType)!;
      pattern.frequency++;
      if (pattern.examples.length < 5) {
        pattern.examples.push({
          query: tc.query,
          expectedDocs: tc.relevantDocs,
          retrievedDocs: result.retrieved,
          score,
        });
      }
    }
    
    this.failurePatterns = [...patterns.values()].sort((a, b) => b.frequency - a.frequency);
    return this.failurePatterns;
  }
  
  /**
   * Classify the type of retrieval failure
   */
  private classifyFailure(
    tc: TestCase,
    retrieved: string[],
    expected: string[],
    documents: Map<string, Document>
  ): string {
    const expectedSet = new Set(expected);
    const retrievedSet = new Set(retrieved);
    
    // Complete miss - none of expected docs retrieved
    if (![...expectedSet].some(e => retrievedSet.has(e))) {
      // Check if it's a semantic gap
      const queryWords = new Set(tc.query.toLowerCase().split(/\s+/));
      const expectedDocs = expected.map(id => documents.get(id)?.content || '').join(' ');
      const expectedWords = new Set(expectedDocs.toLowerCase().split(/\s+/));
      
      const overlap = [...queryWords].filter(w => expectedWords.has(w)).length;
      
      if (overlap < 3) {
        return 'semantic_gap'; // Query and docs use different vocabulary
      }
      return 'complete_miss';
    }
    
    // Partial miss - some expected docs not retrieved
    const missedCount = [...expectedSet].filter(e => !retrievedSet.has(e)).length;
    if (missedCount > 0) {
      if (missedCount === 1) {
        return 'partial_miss_single';
      }
      return 'partial_miss_multiple';
    }
    
    // Wrong ranking - docs retrieved but not at top
    const firstRelevantRank = retrieved.findIndex(r => expectedSet.has(r));
    if (firstRelevantRank > 2) {
      return 'ranking_issue';
    }
    
    return 'unknown';
  }
  
  /**
   * Get suggested fixes for a failure pattern
   */
  private getSuggestedFixes(pattern: string): string[] {
    const fixes: Record<string, string[]> = {
      'semantic_gap': [
        'Use HyDE for query expansion',
        'Add query rewriting',
        'Try hybrid retrieval with BM25',
        'Increase retrieval K',
      ],
      'complete_miss': [
        'Try different embedding model',
        'Use multi-query approach',
        'Add BM25 component',
        'Try chunking strategy',
      ],
      'partial_miss_single': [
        'Increase retrieval K',
        'Lower score threshold',
        'Try hybrid retrieval',
      ],
      'partial_miss_multiple': [
        'Significantly increase retrieval K',
        'Use RAG fusion',
        'Try hierarchical retrieval',
      ],
      'ranking_issue': [
        'Add reranking step',
        'Try cross-encoder reranking',
        'Use MMR for diversity',
      ],
      'unknown': [
        'Try different architecture',
        'Experiment with chunking',
        'Add LLM-based reranking',
      ],
    };
    
    return fixes[pattern] || fixes['unknown'];
  }
  
  /**
   * Generate strategy suggestions based on failures and research
   */
  generateSuggestions(
    currentGenome: AdvancedStrategyGenome,
    failures: FailurePattern[]
  ): StrategySuggestion[] {
    const suggestions: StrategySuggestion[] = [];
    
    // Analyze current genome to see what's not being used
    const currentStrategy = currentGenome.defaultStrategy;
    
    // 1. Suggest based on failure patterns
    for (const failure of failures.slice(0, 3)) { // Top 3 failure patterns
      const suggestion = this.suggestForFailure(failure, currentStrategy);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
    
    // 2. Suggest research-backed techniques not currently in use
    for (const [name, paper] of Object.entries(RESEARCH_PAPERS)) {
      if (this.wouldHelpCurrent(paper, currentStrategy)) {
        suggestions.push({
          id: uuidv4(),
          name: `Apply ${paper.technique}`,
          description: paper.description,
          rationale: `Research paper "${paper.title}" (${paper.year}) suggests this technique`,
          basedOn: name,
          geneChanges: paper.geneChanges as Partial<StrategyGenes>,
          expectedImprovement: 0.1,
          applicableTo: paper.applicableTo,
          confidence: 0.7,
        });
      }
    }
    
    // 3. Suggest ensemble if not using
    if (!currentGenome.ensemble?.enabled) {
      suggestions.push({
        id: uuidv4(),
        name: 'Enable Ensemble',
        description: 'Combine multiple strategies for more robust results',
        rationale: 'Ensemble methods often outperform single strategies',
        geneChanges: {},
        expectedImprovement: 0.15,
        applicableTo: ['any'],
        confidence: 0.6,
      });
    }
    
    // 4. Suggest architecture upgrade
    const archComplexity = RAG_ARCHITECTURES[currentStrategy.architecture]?.complexity || 1;
    if (archComplexity < 3) {
      suggestions.push({
        id: uuidv4(),
        name: 'Upgrade to Advanced Architecture',
        description: 'Try hierarchical or adaptive RAG for better results',
        rationale: 'Current architecture is simple, more complex architectures may help',
        geneChanges: { architecture: 'HIERARCHICAL' },
        expectedImprovement: 0.12,
        applicableTo: ['complex', 'long_docs'],
        confidence: 0.5,
      });
    }
    
    return suggestions.sort((a, b) => 
      (b.expectedImprovement * b.confidence) - (a.expectedImprovement * a.confidence)
    );
  }
  
  /**
   * Suggest a fix for a specific failure pattern
   */
  private suggestForFailure(
    failure: FailurePattern,
    current: StrategyGenes
  ): StrategySuggestion | null {
    switch (failure.pattern) {
      case 'semantic_gap':
        if (current.queryStrategy === 'RAW') {
          return {
            id: uuidv4(),
            name: 'Add HyDE for Semantic Gap',
            description: 'Use hypothetical document embeddings to bridge vocabulary gap',
            rationale: `${failure.frequency} queries failed due to semantic gap between query and documents`,
            basedOn: 'HyDE',
            geneChanges: { queryStrategy: 'HYDE' },
            expectedImprovement: 0.2,
            applicableTo: ['semantic_gap'],
            confidence: 0.8,
          };
        }
        break;
        
      case 'complete_miss':
        if (current.retrievalMethod !== 'HYBRID_RRF') {
          return {
            id: uuidv4(),
            name: 'Switch to Hybrid Retrieval',
            description: 'Combine dense and sparse retrieval for better coverage',
            rationale: `${failure.frequency} queries completely missed relevant documents`,
            geneChanges: { retrievalMethod: 'HYBRID_RRF' },
            expectedImprovement: 0.25,
            applicableTo: ['complete_miss'],
            confidence: 0.75,
          };
        }
        break;
        
      case 'ranking_issue':
        if (current.rerankingMethod === 'NONE') {
          return {
            id: uuidv4(),
            name: 'Add Reranking Step',
            description: 'Use cross-encoder or LLM reranking to improve result ordering',
            rationale: `${failure.frequency} queries had relevant docs but ranked too low`,
            basedOn: 'RankGPT',
            geneChanges: { rerankingMethod: 'CROSS_ENCODER', rerankingTopK: 10 },
            expectedImprovement: 0.18,
            applicableTo: ['ranking_issue'],
            confidence: 0.8,
          };
        }
        break;
    }
    
    return null;
  }
  
  /**
   * Check if a research technique would help the current strategy
   */
  private wouldHelpCurrent(
    paper: typeof RESEARCH_PAPERS[keyof typeof RESEARCH_PAPERS],
    current: StrategyGenes
  ): boolean {
    for (const [gene, value] of Object.entries(paper.geneChanges)) {
      const currentValue = (current as any)[gene];
      if (currentValue !== value) {
        return true; // This technique is not currently being used
      }
    }
    return false;
  }
  
  /**
   * Apply a suggestion to create a new genome
   */
  applySuggestion(
    genome: AdvancedStrategyGenome,
    suggestion: StrategySuggestion
  ): AdvancedStrategyGenome {
    const newGenome: AdvancedStrategyGenome = {
      ...genome,
      id: uuidv4(),
      name: `${genome.name}-${suggestion.name.replace(/\s+/g, '')}`,
      defaultStrategy: {
        ...genome.defaultStrategy,
        ...suggestion.geneChanges,
      },
      generation: genome.generation + 1,
      parentIds: [genome.id],
      createdAt: new Date().toISOString(),
      experimentalFeatures: [...(genome.experimentalFeatures || []), suggestion.name],
      basedOnPaper: suggestion.basedOn,
    };
    
    return newGenome;
  }
  
  /**
   * Use LLM to discover novel strategy combinations
   */
  async discoverWithLLM(
    currentGenome: AdvancedStrategyGenome,
    performanceData: {
      fitness: number;
      failures: FailurePattern[];
      llmJudgeResults?: LLMJudgeResult[];
    },
    llmProvider: 'gemini' | 'openai' | 'ollama' = 'gemini'
  ): Promise<StrategySuggestion[]> {
    const prompt = this.buildDiscoveryPrompt(currentGenome, performanceData);
    
    try {
      const response = await this.callLLM(prompt, llmProvider);
      return this.parseDiscoverySuggestions(response);
    } catch (error) {
      logger.warn('LLM discovery failed:', error);
      return [];
    }
  }
  
  /**
   * Build prompt for LLM-based discovery
   */
  private buildDiscoveryPrompt(
    genome: AdvancedStrategyGenome,
    data: { fitness: number; failures: FailurePattern[]; llmJudgeResults?: LLMJudgeResult[] }
  ): string {
    return `You are an expert in information retrieval and RAG systems.

Current Strategy Configuration:
- Architecture: ${genome.defaultStrategy.architecture}
- Embedding: ${genome.defaultStrategy.embeddingProvider}/${genome.defaultStrategy.embeddingModel}
- Query Strategy: ${genome.defaultStrategy.queryStrategy}
- Retrieval: ${genome.defaultStrategy.retrievalMethod} (k=${genome.defaultStrategy.retrievalK})
- Reranking: ${genome.defaultStrategy.rerankingMethod}
- Chunking: ${genome.defaultStrategy.chunkingStrategy}

Current Performance:
- Overall Fitness: ${(data.fitness * 100).toFixed(1)}%

Top Failure Patterns:
${data.failures.slice(0, 3).map(f => `- ${f.pattern}: ${f.frequency} occurrences`).join('\n')}

${data.llmJudgeResults ? `LLM Judge Feedback:
- Avg Relevance: ${(data.llmJudgeResults.reduce((a, b) => a + b.judgment.relevanceScore, 0) / data.llmJudgeResults.length * 100).toFixed(0)}%
- Avg Completeness: ${(data.llmJudgeResults.reduce((a, b) => a + b.judgment.completenessScore, 0) / data.llmJudgeResults.length * 100).toFixed(0)}%` : ''}

Based on recent research papers (HyDE, RAPTOR, GraphRAG, Self-RAG, ColBERT, SPLADE), suggest 3 specific improvements.

Respond in JSON format:
[
  {
    "name": "Suggestion name",
    "description": "What to change",
    "geneChanges": { "queryStrategy": "HYDE", ... },
    "expectedImprovement": 0.15,
    "confidence": 0.8
  }
]`;
  }
  
  /**
   * Call LLM for discovery
   */
  private async callLLM(prompt: string, provider: string): Promise<string> {
    // Implementation similar to llm-judge.ts
    // For brevity, returning placeholder
    logger.info(`Would call ${provider} with discovery prompt`);
    return '[]';
  }
  
  /**
   * Parse LLM discovery response
   */
  private parseDiscoverySuggestions(response: string): StrategySuggestion[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.map((s: any) => ({
        id: uuidv4(),
        name: s.name,
        description: s.description,
        rationale: 'LLM-suggested improvement',
        geneChanges: s.geneChanges || {},
        expectedImprovement: s.expectedImprovement || 0.1,
        applicableTo: ['any'],
        confidence: s.confidence || 0.5,
      }));
    } catch {
      return [];
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  RESEARCH_PAPERS,
  StrategyDiscoveryEngine,
};
