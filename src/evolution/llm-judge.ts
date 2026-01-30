/**
 * LLM-as-a-Judge Evaluator
 * 
 * Uses LLMs to evaluate retrieval quality beyond traditional metrics.
 * Provides semantic understanding of relevance that metrics like NDCG cannot capture.
 * 
 * @module evolution/llm-judge
 */

import { LLMJudgeConfig, LLMJudgeResult, TestCase, RetrievedDoc } from '../core/types';
import { logger } from '../utils/logger';

/**
 * Default evaluation prompt for LLM judge
 */
const DEFAULT_JUDGE_PROMPT = `You are an expert relevance judge evaluating search results.

Given a user query and a list of retrieved documents, evaluate how well the results satisfy the information need.

Query: {query}

Retrieved Documents:
{documents}

Evaluate on these criteria:
1. **Relevance** (0-1): How relevant are the documents to the query?
2. **Completeness** (0-1): Do the results fully answer the query?
3. **Overall** (0-1): Overall quality of the retrieval results

Respond in JSON format:
{
  "relevanceScore": <0-1>,
  "completenessScore": <0-1>,
  "overallScore": <0-1>,
  "reasoning": "<brief explanation>",
  "improvements": ["<suggestion1>", "<suggestion2>"]
}`;

/**
 * LLM Judge Evaluator
 */
export class LLMJudge {
  private config: LLMJudgeConfig;
  private cache: Map<string, LLMJudgeResult> = new Map();

  constructor(config: LLMJudgeConfig) {
    this.config = {
      maxTokens: 500,
      temperature: 0.3,
      ...config,
    };
  }

  /**
   * Evaluate a single query result
   */
  async evaluate(
    testCase: TestCase,
    retrievedDocs: RetrievedDoc[],
    docContents: Map<string, string>
  ): Promise<LLMJudgeResult> {
    const cacheKey = `${testCase.id}:${retrievedDocs.map(d => d.id).join(',')}`;
    
    if (this.cache.has(cacheKey)) {
      logger.debug(`LLM Judge cache hit for ${testCase.id}`);
      return this.cache.get(cacheKey)!;
    }

    // Format documents for prompt
    const docsText = retrievedDocs.slice(0, 5).map((doc, i) => {
      const content = docContents.get(doc.id) || doc.content || '';
      const truncated = content.length > 500 ? content.substring(0, 500) + '...' : content;
      return `[${i + 1}] (score: ${doc.score.toFixed(3)})\n${truncated}`;
    }).join('\n\n');

    const prompt = (this.config.prompt || DEFAULT_JUDGE_PROMPT)
      .replace('{query}', testCase.query)
      .replace('{documents}', docsText);

    try {
      const response = await this.callLLM(prompt);
      const judgment = this.parseResponse(response);

      const result: LLMJudgeResult = {
        queryId: testCase.id,
        query: testCase.query,
        retrievedDocs: retrievedDocs.slice(0, 5).map(d => ({
          docId: d.id,
          content: docContents.get(d.id) || d.content || '',
          score: d.score,
        })),
        judgment,
        usage: response.usage,
      };

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      logger.warn(`LLM Judge failed for ${testCase.id}:`, error);
      
      // Return fallback
      return {
        queryId: testCase.id,
        query: testCase.query,
        retrievedDocs: retrievedDocs.slice(0, 5).map(d => ({
          docId: d.id,
          content: docContents.get(d.id) || '',
          score: d.score,
        })),
        judgment: {
          overallScore: 0.5,
          relevanceScore: 0.5,
          completenessScore: 0.5,
          reasoning: 'Evaluation failed, using default score',
        },
        usage: { inputTokens: 0, outputTokens: 0, cost: 0 },
      };
    }
  }

  /**
   * Batch evaluate multiple queries
   */
  async evaluateBatch(
    testCases: TestCase[],
    resultsMap: Map<string, RetrievedDoc[]>,
    docContents: Map<string, string>,
    options?: { concurrency?: number; sampleSize?: number }
  ): Promise<LLMJudgeResult[]> {
    const { concurrency = 3, sampleSize } = options || {};
    
    // Sample if needed
    let casesToEvaluate = testCases;
    if (sampleSize && sampleSize < testCases.length) {
      const shuffled = [...testCases].sort(() => Math.random() - 0.5);
      casesToEvaluate = shuffled.slice(0, sampleSize);
    }

    const results: LLMJudgeResult[] = [];
    
    // Process in batches
    for (let i = 0; i < casesToEvaluate.length; i += concurrency) {
      const batch = casesToEvaluate.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (testCase) => {
        const retrieved = resultsMap.get(testCase.id) || [];
        return this.evaluate(testCase, retrieved, docContents);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      logger.info(`LLM Judge progress: ${results.length}/${casesToEvaluate.length}`);
    }

    return results;
  }

  /**
   * Get aggregate statistics from judge results
   */
  static aggregateResults(results: LLMJudgeResult[]): {
    avgOverall: number;
    avgRelevance: number;
    avgCompleteness: number;
    totalCost: number;
    commonIssues: string[];
  } {
    if (results.length === 0) {
      return {
        avgOverall: 0,
        avgRelevance: 0,
        avgCompleteness: 0,
        totalCost: 0,
        commonIssues: [],
      };
    }

    const sum = results.reduce(
      (acc, r) => ({
        overall: acc.overall + r.judgment.overallScore,
        relevance: acc.relevance + r.judgment.relevanceScore,
        completeness: acc.completeness + r.judgment.completenessScore,
        cost: acc.cost + r.usage.cost,
      }),
      { overall: 0, relevance: 0, completeness: 0, cost: 0 }
    );

    // Count improvement suggestions
    const improvementCounts = new Map<string, number>();
    for (const result of results) {
      for (const improvement of result.judgment.improvements || []) {
        const count = improvementCounts.get(improvement) || 0;
        improvementCounts.set(improvement, count + 1);
      }
    }

    const commonIssues = [...improvementCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);

    return {
      avgOverall: sum.overall / results.length,
      avgRelevance: sum.relevance / results.length,
      avgCompleteness: sum.completeness / results.length,
      totalCost: sum.cost,
      commonIssues,
    };
  }

  /**
   * Call the LLM provider
   */
  private async callLLM(prompt: string): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number; cost: number };
  }> {
    switch (this.config.provider) {
      case 'gemini':
        return this.callGemini(prompt);
      case 'openai':
        return this.callOpenAI(prompt);
      case 'ollama':
        return this.callOllama(prompt);
      default:
        throw new Error(`Unknown LLM provider: ${this.config.provider}`);
    }
  }

  /**
   * Call Gemini API
   */
  private async callGemini(prompt: string): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number; cost: number };
  }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: this.config.maxTokens,
            temperature: this.config.temperature,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Estimate tokens (Gemini doesn't always return usage)
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(content.length / 4);
    
    // Gemini pricing (approximate)
    const cost = (inputTokens * 0.00001) + (outputTokens * 0.00003);

    return { content, usage: { inputTokens, outputTokens, cost } };
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number; cost: number };
  }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;

    // OpenAI pricing (GPT-4o)
    const cost = (inputTokens * 0.0025 / 1000) + (outputTokens * 0.01 / 1000);

    return { content, usage: { inputTokens, outputTokens, cost } };
  }

  /**
   * Call Ollama API
   */
  private async callOllama(prompt: string): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number; cost: number };
  }> {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.response || '';
    
    // Ollama is free/local
    const inputTokens = data.prompt_eval_count || Math.ceil(prompt.length / 4);
    const outputTokens = data.eval_count || Math.ceil(content.length / 4);

    return { content, usage: { inputTokens, outputTokens, cost: 0 } };
  }

  /**
   * Parse LLM response JSON
   */
  private parseResponse(response: { content: string; usage: any }): LLMJudgeResult['judgment'] {
    const { content } = response;
    
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        overallScore: Math.max(0, Math.min(1, parsed.overallScore || parsed.overall_score || 0.5)),
        relevanceScore: Math.max(0, Math.min(1, parsed.relevanceScore || parsed.relevance_score || 0.5)),
        completenessScore: Math.max(0, Math.min(1, parsed.completenessScore || parsed.completeness_score || 0.5)),
        reasoning: parsed.reasoning || parsed.explanation || '',
        improvements: parsed.improvements || parsed.suggestions || [],
      };
    } catch (error) {
      logger.warn('Failed to parse LLM judge response:', content.substring(0, 200));
      
      // Attempt to extract scores with regex
      const overallMatch = content.match(/overall[:\s]+([0-9.]+)/i);
      const relevanceMatch = content.match(/relevance[:\s]+([0-9.]+)/i);
      
      return {
        overallScore: overallMatch ? parseFloat(overallMatch[1]) : 0.5,
        relevanceScore: relevanceMatch ? parseFloat(relevanceMatch[1]) : 0.5,
        completenessScore: 0.5,
        reasoning: content.substring(0, 200),
      };
    }
  }
}

/**
 * Create a configured LLM Judge
 */
export function createLLMJudge(config: Partial<LLMJudgeConfig> = {}): LLMJudge {
  const finalConfig: LLMJudgeConfig = {
    provider: config.provider || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'ollama'),
    model: config.model || (config.provider === 'gemini' ? 'gemini-1.5-flash' : config.provider === 'openai' ? 'gpt-4o-mini' : 'llama3'),
    ...config,
  };

  return new LLMJudge(finalConfig);
}
