/**
 * Improvement Suggestions
 * 
 * Generate actionable suggestions based on evaluation failures.
 * Helps agents understand what to fix and how.
 * 
 * @example
 * ```typescript
 * const suggestions = await getSuggestions(trace, evalResults);
 * for (const s of suggestions) {
 *   console.log(`[${s.severity}] ${s.category}: ${s.action}`);
 * }
 * ```
 */

import { Trace, EvalResult, Suggestion } from './types';
import { createJudge } from '../utils/llm-providers';

// Known failure categories and their fixes
const CATEGORY_FIXES: Record<string, {
  description: string;
  action: string;
  example?: string;
}> = {
  hallucination: {
    description: 'Response contains information not supported by context',
    action: 'Remove or verify facts not in provided context. Cite sources when making claims.',
    example: 'Instead of "The API supports 100 concurrent connections", say "Based on the documentation, the API supports concurrent connections" (only if mentioned in context)',
  },
  incomplete: {
    description: 'Response does not fully address all parts of the query',
    action: 'Review the query for multiple questions or requirements. Address each one explicitly.',
    example: 'If asked "How to install and configure?", ensure both installation AND configuration are covered',
  },
  incoherent: {
    description: 'Response is poorly structured or hard to follow',
    action: 'Organize response with clear structure. Use numbered steps or bullet points for complex answers.',
    example: 'Break long responses into: 1) Overview, 2) Steps, 3) Troubleshooting',
  },
  irrelevant: {
    description: 'Response does not address what the user asked',
    action: 'Re-read the query carefully. Focus on exactly what is being asked.',
    example: 'If asked about pricing, do not explain features unless specifically relevant',
  },
  'wrong-format': {
    description: 'Response format does not match requirements',
    action: 'Check if code blocks, lists, or specific formats were requested. Match the expected output format.',
    example: 'If asked for JSON, return valid JSON. If asked for bullet points, use bullet points.',
  },
  unsafe: {
    description: 'Response may contain harmful or inappropriate content',
    action: 'Remove potentially harmful advice. Add appropriate disclaimers. Avoid absolute statements about safety-critical topics.',
    example: 'For medical/legal topics, add "Consult a professional for your specific situation"',
  },
  'no-sources': {
    description: 'Response makes claims without citing sources',
    action: 'When using retrieved context, reference where information came from.',
    example: 'Add "According to the documentation..." or "Based on the provided context..."',
  },
  verbose: {
    description: 'Response is longer than necessary',
    action: 'Remove filler words and redundant explanations. Be concise.',
    example: 'Instead of "I would be happy to help you with this. Basically, what you need to do is...", just say "To do this:"',
  },
  'missing-context': {
    description: 'Response does not use available context',
    action: 'Review retrieved documents and incorporate relevant information.',
    example: 'If context mentions specific features, include them rather than giving generic answers',
  },
  'factual-error': {
    description: 'Response contains incorrect information',
    action: 'Verify facts against reliable sources. If unsure, indicate uncertainty.',
    example: 'Say "I believe..." or "Based on my training..." when not 100% certain',
  },
};

/**
 * Generate improvement suggestions from evaluation results
 */
export async function getSuggestions(
  trace: Trace,
  evalResults: EvalResult[]
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  const failedResults = evalResults.filter(r => !r.passed);

  if (failedResults.length === 0) {
    return suggestions;
  }

  // Generate suggestions from known categories
  const categories = new Set<string>();
  for (const result of failedResults) {
    const category = result.failureCategory || guessCategory(result);
    if (category && !categories.has(category)) {
      categories.add(category);
      suggestions.push(createSuggestion(category, result, trace));
    }
  }

  // If no specific categories found, generate generic suggestions
  if (suggestions.length === 0) {
    suggestions.push({
      category: 'general',
      severity: 'medium',
      description: 'Response did not pass evaluation',
      action: 'Review the response against the query and context. Ensure it is accurate, complete, and relevant.',
      relatedTraceIds: [trace.id],
    });
  }

  // Try to get LLM-based suggestions for complex failures
  if (failedResults.length >= 2) {
    const llmSuggestion = await getLLMSuggestion(trace, failedResults);
    if (llmSuggestion) {
      suggestions.push(llmSuggestion);
    }
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return suggestions;
}

/**
 * Guess failure category from eval result
 */
function guessCategory(result: EvalResult): string | undefined {
  const explanation = (result.explanation || '').toLowerCase();
  const evalId = (result.evalId || '').toLowerCase();

  // Match common patterns
  if (explanation.includes('hallucin') || evalId.includes('hallucin')) return 'hallucination';
  if (explanation.includes('incomplete') || evalId.includes('complete')) return 'incomplete';
  if (explanation.includes('coherent') || evalId.includes('coherent')) return 'incoherent';
  if (explanation.includes('relevant') || evalId.includes('relevant')) return 'irrelevant';
  if (explanation.includes('format') || evalId.includes('format')) return 'wrong-format';
  if (explanation.includes('safe') || evalId.includes('safe')) return 'unsafe';
  if (explanation.includes('source') || evalId.includes('source')) return 'no-sources';
  if (explanation.includes('context') || evalId.includes('context')) return 'missing-context';
  if (explanation.includes('factual') || evalId.includes('factual')) return 'factual-error';

  return undefined;
}

/**
 * Create a suggestion from a category
 */
function createSuggestion(
  category: string,
  _result: EvalResult,
  trace: Trace
): Suggestion {
  const fix = CATEGORY_FIXES[category] || {
    description: `Failed ${category} check`,
    action: `Review and fix ${category} issues`,
  };

  // Determine severity based on category
  let severity: Suggestion['severity'] = 'medium';
  if (category === 'unsafe' || category === 'hallucination') {
    severity = 'high';
  } else if (category === 'verbose' || category === 'no-sources') {
    severity = 'low';
  }

  return {
    category,
    severity,
    description: fix.description,
    action: fix.action,
    example: fix.example,
    relatedTraceIds: [trace.id],
  };
}

/**
 * Get LLM-based suggestion for complex failures
 */
async function getLLMSuggestion(
  trace: Trace,
  failedResults: EvalResult[]
): Promise<Suggestion | null> {
  const judge = createJudge();
  if (!judge) return null;

  const failureDescriptions = failedResults
    .map(r => `- ${r.evalId}: ${r.explanation || 'Failed'}`)
    .join('\n');

  const prompt = `An AI response failed these evaluations:
${failureDescriptions}

Query: ${trace.query}
Response: ${trace.response.substring(0, 500)}${trace.response.length > 500 ? '...' : ''}

Provide ONE specific, actionable suggestion to improve this response. 
Format: [severity: high/medium/low] suggestion text`;

  try {
    const result = await judge(prompt, 'gemini-2.5-flash-lite', 0.3);
    
    // Parse severity and suggestion
    const match = result.match(/\[(high|medium|low)\]\s*(.+)/i);
    if (match) {
      return {
        category: 'llm-analysis',
        severity: match[1].toLowerCase() as Suggestion['severity'],
        description: 'LLM-generated suggestion based on multiple failures',
        action: match[2].trim(),
        relatedTraceIds: [trace.id],
      };
    }

    return {
      category: 'llm-analysis',
      severity: 'medium',
      description: 'LLM-generated suggestion based on multiple failures',
      action: result.trim(),
      relatedTraceIds: [trace.id],
    };
  } catch {
    return null;
  }
}

/**
 * Get top suggestions (most impactful)
 */
export async function getTopSuggestions(
  trace: Trace,
  evalResults: EvalResult[],
  limit: number = 3
): Promise<Suggestion[]> {
  const all = await getSuggestions(trace, evalResults);
  return all.slice(0, limit);
}

/**
 * Get suggestions for a specific category
 */
export function getCategorySuggestion(category: string): Suggestion | null {
  const fix = CATEGORY_FIXES[category];
  if (!fix) return null;

  return {
    category,
    severity: 'medium',
    description: fix.description,
    action: fix.action,
    example: fix.example,
  };
}

/**
 * Get all known failure categories
 */
export function getKnownCategories(): string[] {
  return Object.keys(CATEGORY_FIXES);
}

/**
 * Generate a revision prompt based on suggestions
 */
export function generateRevisionPrompt(
  originalResponse: string,
  suggestions: Suggestion[]
): string {
  const fixes = suggestions
    .map(s => `- ${s.action}`)
    .join('\n');

  return `Revise this response to address these issues:
${fixes}

Original response:
${originalResponse}

Provide an improved response:`;
}

/**
 * Check if a response needs specific improvements
 */
export async function needsImprovement(
  trace: Trace,
  evalResults: EvalResult[],
  categories: string[]
): Promise<boolean> {
  const suggestions = await getSuggestions(trace, evalResults);
  return suggestions.some(s => categories.includes(s.category));
}
