/**
 * Confidence Scoring
 * 
 * Score how confident an agent should be about a response.
 * Used for deciding when to send, revise, escalate, or clarify.
 * 
 * @example
 * ```typescript
 * const confidence = await getConfidence(response, {
 *   query,
 *   context,
 *   method: 'hybrid'
 * });
 * 
 * if (confidence.score < 0.7) {
 *   if (confidence.action === 'clarify') {
 *     askForClarification();
 *   } else if (confidence.action === 'escalate') {
 *     escalateToHuman();
 *   }
 * }
 * ```
 */

import { createJudge, createProviders, cosineSimilarity } from '../utils/llm-providers';
import { ConfidenceOptions, ConfidenceResult } from './types';

// Thresholds for confidence-based actions
const THRESHOLDS = {
  send: 0.8,      // High confidence - send directly
  revise: 0.6,    // Medium - try to revise
  escalate: 0.4,  // Low - escalate to human
  clarify: 0,     // Very low - ask for clarification
};

/**
 * Calculate confidence score for a response
 */
export async function getConfidence(
  response: string,
  options: ConfidenceOptions = {}
): Promise<ConfidenceResult> {
  const {
    query,
    context,
    model = 'gemini-2.5-flash-lite',
    method = 'llm',
  } = options;

  let breakdown = {
    relevance: 0.7,
    completeness: 0.7,
    accuracy: 0.7,
    clarity: 0.7,
  };

  if (method === 'llm' || method === 'hybrid') {
    breakdown = await getLLMConfidence(response, query, context, model);
  }

  if (method === 'embedding' || method === 'hybrid') {
    const embeddingScore = await getEmbeddingConfidence(response, context);
    if (method === 'hybrid') {
      // Average with LLM scores
      breakdown.relevance = (breakdown.relevance + embeddingScore) / 2;
    } else {
      breakdown.relevance = embeddingScore;
      breakdown.completeness = embeddingScore;
    }
  }

  // Calculate overall score (weighted average)
  const score = (
    breakdown.relevance * 0.3 +
    breakdown.completeness * 0.25 +
    breakdown.accuracy * 0.25 +
    breakdown.clarity * 0.2
  );

  // Determine action
  let action: ConfidenceResult['action'];
  let reason: string;

  if (score >= THRESHOLDS.send) {
    action = 'send';
    reason = 'High confidence - response is ready to send';
  } else if (score >= THRESHOLDS.revise) {
    action = 'revise';
    reason = `Moderate confidence - consider improving ${getLowestAspect(breakdown)}`;
  } else if (score >= THRESHOLDS.escalate) {
    action = 'escalate';
    reason = 'Low confidence - consider escalating to human review';
  } else {
    action = 'clarify';
    reason = 'Very low confidence - ask user for clarification';
  }

  return {
    score,
    breakdown,
    action,
    reason,
  };
}

/**
 * Get confidence using LLM evaluation
 */
async function getLLMConfidence(
  response: string,
  query?: string,
  context?: string,
  model: string = 'gemini-2.5-flash-lite'
): Promise<ConfidenceResult['breakdown']> {
  const judge = createJudge({ provider: 'gemini', model });
  
  if (!judge) {
    return { relevance: 0.5, completeness: 0.5, accuracy: 0.5, clarity: 0.5 };
  }

  const prompt = `Rate the following response on a scale of 0.0 to 1.0 for each aspect:
1. Relevance: Does it address the query?
2. Completeness: Does it fully answer the question?
3. Accuracy: Is the information correct?
4. Clarity: Is it well-structured and easy to understand?

${query ? `Query: ${query}` : ''}
${context ? `Context: ${context}` : ''}
Response: ${response}

Respond with ONLY four numbers separated by commas, like: 0.8, 0.7, 0.9, 0.85`;

  try {
    const result = await judge(prompt, model, 0.0);
    const numbers = result.match(/(\d+\.?\d*)/g);
    
    if (numbers && numbers.length >= 4) {
      return {
        relevance: Math.min(1, Math.max(0, parseFloat(numbers[0]))),
        completeness: Math.min(1, Math.max(0, parseFloat(numbers[1]))),
        accuracy: Math.min(1, Math.max(0, parseFloat(numbers[2]))),
        clarity: Math.min(1, Math.max(0, parseFloat(numbers[3]))),
      };
    }
  } catch {
    // Fall back to defaults
  }

  return { relevance: 0.5, completeness: 0.5, accuracy: 0.5, clarity: 0.5 };
}

/**
 * Get confidence using embedding similarity
 */
async function getEmbeddingConfidence(
  response: string,
  context?: string
): Promise<number> {
  if (!context) {
    return 0.7; // Default confidence without context
  }

  try {
    const providers = createProviders();
    const embeddingProvider = providers.embedding[0];
    
    if (!embeddingProvider?.isAvailable()) {
      return 0.7;
    }

    const [responseEmbed, contextEmbed] = await Promise.all([
      embeddingProvider.embed(response),
      embeddingProvider.embed(context),
    ]);

    return cosineSimilarity(responseEmbed, contextEmbed);
  } catch {
    return 0.7;
  }
}

/**
 * Get the lowest scoring aspect
 */
function getLowestAspect(breakdown: ConfidenceResult['breakdown']): string {
  const entries = Object.entries(breakdown);
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}

/**
 * Quick confidence check
 * 
 * @example
 * ```typescript
 * const score = await confidenceScore(response, query);
 * if (score < 0.7) revise();
 * ```
 */
export async function confidenceScore(
  response: string,
  query?: string
): Promise<number> {
  const result = await getConfidence(response, { query, method: 'llm' });
  return result.score;
}

/**
 * Check if response should be sent (confidence >= 0.8)
 */
export async function shouldSend(
  response: string,
  query?: string
): Promise<boolean> {
  const result = await getConfidence(response, { query });
  return result.action === 'send';
}

/**
 * Determine the best action based on confidence
 */
export async function determineAction(
  response: string,
  options: ConfidenceOptions = {}
): Promise<{
  action: 'send' | 'revise' | 'escalate' | 'clarify';
  reason: string;
  score: number;
}> {
  const result = await getConfidence(response, options);
  return {
    action: result.action,
    reason: result.reason,
    score: result.score,
  };
}

/**
 * Get confidence with custom thresholds
 */
export async function getConfidenceWithThresholds(
  response: string,
  options: ConfidenceOptions,
  thresholds: { send?: number; revise?: number; escalate?: number }
): Promise<ConfidenceResult> {
  const result = await getConfidence(response, options);
  
  // Re-determine action with custom thresholds
  const sendThreshold = thresholds.send ?? THRESHOLDS.send;
  const reviseThreshold = thresholds.revise ?? THRESHOLDS.revise;
  const escalateThreshold = thresholds.escalate ?? THRESHOLDS.escalate;

  if (result.score >= sendThreshold) {
    result.action = 'send';
    result.reason = 'High confidence - response is ready to send';
  } else if (result.score >= reviseThreshold) {
    result.action = 'revise';
    result.reason = `Moderate confidence - consider improving ${getLowestAspect(result.breakdown)}`;
  } else if (result.score >= escalateThreshold) {
    result.action = 'escalate';
    result.reason = 'Low confidence - consider escalating to human review';
  } else {
    result.action = 'clarify';
    result.reason = 'Very low confidence - ask user for clarification';
  }

  return result;
}
