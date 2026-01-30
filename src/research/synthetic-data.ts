/**
 * Synthetic Data Generator for Self-Evolving Embedding Researcher
 * 
 * Generates test queries from a corpus using LLM, enabling:
 * - Bootstrap evaluation without human labels
 * - Generate hard negatives for challenging tests
 * - Create diverse query types (factual, conceptual, comparison)
 * 
 * @module research/synthetic-data
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  Document,
  TestCase,
  SyntheticQuery,
  SyntheticQueryConfig,
  ProviderConfig,
} from '../core/types';
import { logger } from '../utils/logger';

/**
 * Prompt templates for query generation
 */
const QUERY_GENERATION_PROMPTS = {
  factual: `Given this document, generate {count} factual questions that can be directly answered from the text.
These should be specific questions about facts, numbers, names, or events mentioned.

Document:
{document}

Generate questions in JSON format:
[
  {{"query": "...", "difficulty": "easy|medium|hard", "relevantPassage": "quote from document"}}
]`,

  conceptual: `Given this document, generate {count} conceptual questions that require understanding the main ideas.
These should test comprehension of concepts, relationships, or implications.

Document:
{document}

Generate questions in JSON format:
[
  {{"query": "...", "difficulty": "easy|medium|hard", "relevantPassage": "relevant section"}}
]`,

  comparison: `Given this document, generate {count} comparison or analysis questions.
These should ask about differences, similarities, pros/cons, or evaluations.

Document:
{document}

Generate questions in JSON format:
[
  {{"query": "...", "difficulty": "easy|medium|hard", "relevantPassage": "relevant section"}}
]`,

  procedural: `Given this document, generate {count} procedural or how-to questions.
These should ask about processes, steps, methods, or instructions.

Document:
{document}

Generate questions in JSON format:
[
  {{"query": "...", "difficulty": "easy|medium|hard", "relevantPassage": "relevant section"}}
]`,

  mixed: `Given this document, generate {count} diverse search queries that someone might use to find this information.
Include a mix of:
- Factual questions (who, what, when, where)
- Conceptual questions (why, how does X work)
- Comparison questions (difference between, compare)

Vary the difficulty:
- Easy: Direct questions with answers clearly in text
- Medium: Require some inference or connecting information
- Hard: Paraphrased or abstract questions

Document:
{document}

Generate queries in JSON format:
[
  {{"query": "...", "difficulty": "easy|medium|hard", "queryType": "factual|conceptual|comparison|procedural", "relevantPassage": "..."}}
]`,
};

/**
 * Hard negative generation prompt
 */
const HARD_NEGATIVE_PROMPT = `Given this document and query, identify or generate content that is:
1. Topically similar (same domain/subject)
2. But NOT relevant to answering the query

This helps test if the retrieval system can distinguish relevant from irrelevant content.

Query: {query}
Document: {document}

Generate 2-3 hard negative descriptions (what content would be similar but not helpful):
[
  {{"description": "...", "reason": "why it's not relevant"}}
]`;

/**
 * Synthetic Query Generator
 */
export class SyntheticQueryGenerator {
  private config: SyntheticQueryConfig;
  private llmProvider: any;  // Will be initialized based on config

  constructor(config: SyntheticQueryConfig) {
    this.config = config;
  }

  /**
   * Initialize the LLM provider for generation
   */
  private async initializeLLM(): Promise<void> {
    // Dynamic import based on provider type
    const providerConfig = this.config.provider;
    
    if (providerConfig.type === 'openai') {
      const { default: OpenAI } = await import('openai');
      this.llmProvider = new OpenAI({
        apiKey: providerConfig.apiKey,
        baseURL: providerConfig.baseUrl,
      });
    } else if (providerConfig.type === 'google') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this.llmProvider = new GoogleGenerativeAI(providerConfig.apiKey);
    } else {
      throw new Error(`LLM provider ${providerConfig.type} not supported for query generation`);
    }
  }

  /**
   * Generate queries from corpus
   */
  async generate(): Promise<SyntheticQuery[]> {
    await this.initializeLLM();
    
    logger.info(`Starting synthetic query generation...`);
    logger.info(`Target: ${this.config.numQueries} queries from corpus`);
    
    // Load corpus
    const documents = await this.loadCorpus();
    logger.info(`Loaded ${documents.length} documents from corpus`);
    
    // Calculate queries per document
    const queriesPerDoc = Math.ceil(this.config.numQueries / documents.length);
    
    const allQueries: SyntheticQuery[] = [];
    let generated = 0;
    
    for (const doc of documents) {
      if (generated >= this.config.numQueries) break;
      
      const remaining = this.config.numQueries - generated;
      const count = Math.min(queriesPerDoc, remaining);
      
      try {
        const queries = await this.generateQueriesForDocument(doc, count);
        allQueries.push(...queries);
        generated += queries.length;
        
        logger.debug(`Generated ${queries.length} queries for doc ${doc.id} (${generated}/${this.config.numQueries})`);
      } catch (error) {
        logger.warn(`Failed to generate queries for doc ${doc.id}:`, error);
      }
    }
    
    // Save results
    await this.saveQueries(allQueries);
    
    logger.info(`Generated ${allQueries.length} synthetic queries`);
    return allQueries;
  }

  /**
   * Load corpus from file
   */
  private async loadCorpus(): Promise<Document[]> {
    const content = await fs.readFile(this.config.corpusPath, 'utf-8');
    const lines = content.trim().split('\n');
    
    return lines.map(line => {
      const doc = JSON.parse(line);
      return {
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
      };
    });
  }

  /**
   * Generate queries for a single document
   */
  private async generateQueriesForDocument(doc: Document, count: number): Promise<SyntheticQuery[]> {
    const queryTypes = this.config.queryTypes;
    const queriesPerType = Math.ceil(count / queryTypes.length);
    
    const queries: SyntheticQuery[] = [];
    
    for (const queryType of queryTypes) {
      const typeCount = Math.min(queriesPerType, count - queries.length);
      if (typeCount <= 0) break;
      
      const prompt = this.buildPrompt(doc.content, queryType, typeCount);
      const response = await this.callLLM(prompt);
      const parsed = this.parseResponse(response);
      
      for (const q of parsed) {
        queries.push({
          id: uuidv4(),
          query: q.query,
          sourceDocId: doc.id,
          relevantDocs: [doc.id],
          difficulty: this.config.difficulty === 'mixed' ? q.difficulty : this.config.difficulty,
          queryType: q.queryType || queryType,
          reasoning: q.relevantPassage || '',
          generatedAt: new Date().toISOString(),
        });
      }
    }
    
    return queries;
  }

  /**
   * Build prompt for query generation
   */
  private buildPrompt(documentContent: string, queryType: string, count: number): string {
    const template = QUERY_GENERATION_PROMPTS[queryType as keyof typeof QUERY_GENERATION_PROMPTS] 
      || QUERY_GENERATION_PROMPTS.mixed;
    
    // Truncate document if too long
    const maxDocLength = 4000;
    const truncatedDoc = documentContent.length > maxDocLength 
      ? documentContent.slice(0, maxDocLength) + '...'
      : documentContent;
    
    return template
      .replace('{document}', truncatedDoc)
      .replace('{count}', count.toString());
  }

  /**
   * Call LLM to generate queries
   */
  private async callLLM(prompt: string): Promise<string> {
    const providerConfig = this.config.provider;
    
    if (providerConfig.type === 'openai') {
      const response = await this.llmProvider.chat.completions.create({
        model: this.config.llmModel,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates search queries for information retrieval evaluation. Always respond with valid JSON arrays.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });
      return response.choices[0]?.message?.content || '[]';
    } else if (providerConfig.type === 'google') {
      const model = this.llmProvider.getGenerativeModel({ model: this.config.llmModel });
      const result = await model.generateContent(prompt);
      return result.response.text();
    }
    
    throw new Error('Unsupported provider');
  }

  /**
   * Parse LLM response to extract queries
   */
  private parseResponse(response: string): Array<{
    query: string;
    difficulty: 'easy' | 'medium' | 'hard';
    queryType?: string;
    relevantPassage?: string;
  }> {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response;
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger.warn('Failed to parse LLM response:', error);
      return [];
    }
  }

  /**
   * Save generated queries to file
   */
  private async saveQueries(queries: SyntheticQuery[]): Promise<void> {
    await fs.ensureDir(path.dirname(this.config.outputPath));
    
    // Convert to TestCase format for compatibility
    const testCases: TestCase[] = queries.map(q => ({
      id: q.id,
      query: q.query,
      relevantDocs: q.relevantDocs,
      tags: [q.queryType, q.difficulty, 'synthetic'],
      metadata: {
        sourceDocId: q.sourceDocId,
        difficulty: q.difficulty,
        queryType: q.queryType,
        reasoning: q.reasoning,
        generatedAt: q.generatedAt,
      },
    }));
    
    // Write as JSONL
    const jsonl = testCases.map(tc => JSON.stringify(tc)).join('\n');
    await fs.writeFile(this.config.outputPath, jsonl);
    
    logger.info(`Saved ${queries.length} queries to ${this.config.outputPath}`);
  }

  /**
   * Generate hard negatives for existing queries
   */
  async generateHardNegatives(
    queries: TestCase[],
    documents: Document[]
  ): Promise<Map<string, string[]>> {
    await this.initializeLLM();
    
    const hardNegatives = new Map<string, string[]>();
    
    for (const query of queries) {
      // Find the relevant document
      const relevantDocId = query.relevantDocs[0];
      const relevantDoc = documents.find(d => d.id === relevantDocId);
      
      if (!relevantDoc) continue;
      
      try {
        const prompt = HARD_NEGATIVE_PROMPT
          .replace('{query}', query.query)
          .replace('{document}', relevantDoc.content.slice(0, 2000));
        
        const response = await this.callLLM(prompt);
        const parsed = this.parseResponse(response);
        
        // Find documents that match hard negative descriptions
        const negativeIds: string[] = [];
        for (const doc of documents) {
          if (query.relevantDocs.includes(doc.id)) continue;
          
          // Simple heuristic: check if doc contains keywords from hard negative descriptions
          for (const neg of parsed) {
            if (neg.description && doc.content.toLowerCase().includes(neg.description.toLowerCase().slice(0, 50))) {
              negativeIds.push(doc.id);
              break;
            }
          }
        }
        
        if (negativeIds.length > 0) {
          hardNegatives.set(query.id, negativeIds.slice(0, 5));
        }
      } catch (error) {
        logger.warn(`Failed to generate hard negatives for query ${query.id}`);
      }
    }
    
    return hardNegatives;
  }
}

/**
 * Convenience function to generate synthetic queries
 */
export async function generateSyntheticQueries(
  corpusPath: string,
  outputPath: string,
  options: {
    provider: ProviderConfig;
    llmModel: string;
    numQueries?: number;
    queryTypes?: ('factual' | 'conceptual' | 'comparison' | 'procedural')[];
    difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  }
): Promise<SyntheticQuery[]> {
  const config: SyntheticQueryConfig = {
    corpusPath,
    outputPath,
    provider: options.provider,
    llmModel: options.llmModel,
    numQueries: options.numQueries || 100,
    queryTypes: options.queryTypes || ['factual', 'conceptual', 'comparison'],
    difficulty: options.difficulty || 'mixed',
    includeNegatives: false,
  };
  
  const generator = new SyntheticQueryGenerator(config);
  return generator.generate();
}
