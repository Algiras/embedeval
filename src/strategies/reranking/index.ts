/**
 * Re-ranking Strategies
 */

import { RetrievedDoc, ProviderConfig } from '../../core/types';
import { StrategyContext, StrategyStage } from '../types';
import { createProvider } from '../../providers';
import { logger } from '../../utils/logger';

export interface LLMRerankingConfig {
  provider: ProviderConfig;
  model?: string;
  topK: number;
  promptTemplate?: string;
}

/**
 * LLM-based Re-ranking
 * Uses an LLM to score relevance of retrieved documents
 */
export class LLMRerankingStage implements StrategyStage {
  name = 'llm-reranking';
  type = 'reranking' as const;

  constructor(private config: LLMRerankingConfig) {}

  async execute(context: StrategyContext): Promise<StrategyContext> {
    const startTime = Date.now();
    
    // Get documents to re-rank
    const docsToRerank = context.fusedResults || context.retrievedDocs || [];
    
    if (docsToRerank.length === 0) {
      logger.warn('No documents to re-rank');
      return context;
    }

    // Create LLM provider for judging
    const judgeProvider = createProvider(this.config.provider);

    // Score each document
    const scoredDocs: Array<{ doc: RetrievedDoc; score: number }> = [];
    
    for (const doc of docsToRerank.slice(0, this.config.topK * 2)) {
      try {
        const score = await this.scoreDocument(judgeProvider, context.query, doc);
        scoredDocs.push({ doc, score });
      } catch (error) {
        logger.warn(`Failed to score document ${doc.id}:`, error);
        // Keep original score
        scoredDocs.push({ doc, score: doc.score });
      }
    }

    // Sort by LLM score and take topK
    const reranked = scoredDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.topK)
      .map((item, index) => ({
        ...item.doc,
        score: item.score,
        rank: index + 1,
      }));

    const duration = Date.now() - startTime;
    context.rerankedDocs = reranked;
    context.stageTimings.set('reranking', duration);
    context.stageMetadata.set('reranking', {
      method: 'llm',
      model: this.config.provider.model,
      numScored: scoredDocs.length,
      numReturned: reranked.length,
    });

    return context;
  }

  private async scoreDocument(
    provider: any,
    query: string,
    doc: RetrievedDoc
  ): Promise<number> {
    const prompt = this.config.promptTemplate || this.getDefaultPrompt();
    const filledPrompt = prompt
      .replace('{query}', query)
      .replace('{document}', doc.content.substring(0, 1000)); // Limit doc length

    // For OpenAI-style providers
    if (this.config.provider.type === 'openai') {
      const response = await fetch(
        `${this.config.provider.baseUrl || 'https://api.openai.com/v1'}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.provider.model || 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a relevance judge. Rate how relevant the document is to the query on a scale of 0-10. Respond with only a number.' },
              { role: 'user', content: filledPrompt },
            ],
            temperature: 0,
            max_tokens: 10,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '0';
      const score = parseFloat(content.match(/\d+\.?\d*/)?.[0] || '0');
      return Math.min(10, Math.max(0, score)) / 10; // Normalize to 0-1
    }

    // For other providers, return original score
    return doc.score;
  }

  private getDefaultPrompt(): string {
    return `Rate the relevance of the following document to the query on a scale of 0-10.

Query: {query}

Document: {document}

Relevance score (0-10):`;
  }
}

export interface MMRConfig {
  lambda: number;      // Balance between relevance and diversity (0-1)
  topK: number;
}

/**
 * Maximal Marginal Relevance (MMR)
 * Balances relevance with diversity to reduce redundancy
 */
export class MMRRerankingStage implements StrategyStage {
  name = 'mmr-reranking';
  type = 'reranking' as const;

  constructor(private config: MMRConfig) {}

  async execute(context: StrategyContext): Promise<StrategyContext> {
    const startTime = Date.now();
    const lambda = this.config.lambda;
    
    // Get documents to re-rank
    const candidates = context.fusedResults || context.retrievedDocs || [];
    
    if (candidates.length === 0) {
      logger.warn('No documents for MMR');
      return context;
    }

    // We need embeddings for MMR
    if (!context.documentEmbeddings || context.documentEmbeddings.size === 0) {
      logger.warn('No embeddings available for MMR, falling back to original ranking');
      context.rerankedDocs = candidates.slice(0, this.config.topK);
      return context;
    }

    const selected: RetrievedDoc[] = [];
    const remaining = [...candidates];

    while (selected.length < this.config.topK && remaining.length > 0) {
      let bestMMRScore = -Infinity;
      let bestIndex = -1;

      for (let i = 0; i < remaining.length; i++) {
        const doc = remaining[i];
        const relevanceScore = doc.score;

        // Calculate max similarity to already selected documents
        let maxSimilarity = 0;
        for (const selectedDoc of selected) {
          const sim = this.cosineSimilarity(
            context.documentEmbeddings!.get(doc.id)!,
            context.documentEmbeddings!.get(selectedDoc.id)!
          );
          maxSimilarity = Math.max(maxSimilarity, sim);
        }

        // MMR formula: lambda * relevance - (1 - lambda) * max_similarity
        const mmrScore = lambda * relevanceScore - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestMMRScore) {
          bestMMRScore = mmrScore;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        selected.push(remaining[bestIndex]);
        remaining.splice(bestIndex, 1);
      }
    }

    // Update ranks
    const reranked = selected.map((doc, index) => ({
      ...doc,
      rank: index + 1,
    }));

    const duration = Date.now() - startTime;
    context.rerankedDocs = reranked;
    context.stageTimings.set('reranking', duration);
    context.stageMetadata.set('reranking', {
      method: 'mmr',
      lambda,
      numResults: reranked.length,
    });

    return context;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
