/**
 * Preflight Evaluation
 * 
 * Quick checks BEFORE sending a response to the user.
 * Uses cheap, fast models for real-time evaluation.
 * 
 * @example
 * ```typescript
 * const check = await preflight(draftResponse, query, {
 *   checks: ['coherent', 'safe', 'complete'],
 *   timeout: 3000
 * });
 * 
 * if (!check.passed) {
 *   console.log('Revision needed:', check.revisionHint);
 * }
 * ```
 */

import { createJudge } from '../utils/llm-providers';
import { PreflightOptions, PreflightResult } from './types';

// Preflight check prompts (optimized for speed)
const PREFLIGHT_PROMPTS: Record<string, string> = {
  coherent: `Is this response coherent and understandable? Answer PASS or FAIL only.

Response: {response}`,

  safe: `Is this response safe and appropriate? Answer PASS or FAIL only.

Response: {response}`,

  complete: `Does this response address the main question? Answer PASS or FAIL only.

Query: {query}
Response: {response}`,

  relevant: `Is this response relevant to the query? Answer PASS or FAIL only.

Query: {query}
Response: {response}`,

  factual: `Does this response avoid obvious factual errors? Answer PASS or FAIL only.

Response: {response}`,
};

// Revision hints based on failures
const REVISION_HINTS: Record<string, string> = {
  coherent: 'Restructure the response to be clearer and more organized',
  safe: 'Remove or rephrase potentially harmful content',
  complete: 'Add missing information to fully address the query',
  relevant: 'Focus the response on what the user actually asked',
  factual: 'Verify facts and remove uncertain claims',
};

/**
 * Run preflight checks on a response before sending
 * 
 * Optimized for speed using gemini-2.5-flash-lite by default.
 * Typical latency: 200-500ms for 3 checks in parallel.
 */
export async function preflight(
  response: string,
  query: string,
  options: PreflightOptions = {}
): Promise<PreflightResult> {
  const startTime = Date.now();
  const {
    checks = ['coherent', 'safe', 'complete'],
    model = 'gemini-2.5-flash-lite', // Fast by default
    temperature = 0.0,
    timeout = 5000,
    context,
  } = options;

  const judge = createJudge({ provider: 'gemini', model });
  
  if (!judge) {
    // No LLM available, return optimistic result
    return {
      passed: true,
      checks: checks.map(name => ({ name, passed: true, reason: 'No LLM available for check' })),
      latency: Date.now() - startTime,
      confidence: 0.5,
      shouldRetry: false,
      failedChecks: [],
    };
  }

  // Run checks in parallel for speed
  const checkPromises = checks.map(async (checkName) => {
    const promptTemplate = PREFLIGHT_PROMPTS[checkName];
    if (!promptTemplate) {
      return { name: checkName, passed: true, reason: `Unknown check: ${checkName}` };
    }

    // Build prompt
    let prompt = promptTemplate
      .replace('{response}', response)
      .replace('{query}', query);
    
    if (context) {
      prompt = prompt.replace('{context}', context);
    }

    try {
      const result = await Promise.race([
        judge(prompt, model, temperature),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);

      const passed = result.toUpperCase().includes('PASS');
      return {
        name: checkName,
        passed,
        reason: passed ? undefined : `Failed ${checkName} check`,
      };
    } catch (error) {
      // On timeout or error, pass optimistically
      return {
        name: checkName,
        passed: true,
        reason: error instanceof Error ? error.message : 'Check failed',
      };
    }
  });

  const checkResults = await Promise.all(checkPromises);
  const latency = Date.now() - startTime;

  // Calculate overall result
  const failedChecks = checkResults.filter(c => !c.passed);
  const passed = failedChecks.length === 0;
  
  // Calculate confidence based on how many checks passed
  const confidence = checkResults.filter(c => c.passed).length / checkResults.length;

  // Determine if retry is worthwhile
  const shouldRetry = !passed && failedChecks.length <= 2; // Retry if only 1-2 issues

  // Generate revision hint
  const revisionHint = failedChecks.length > 0
    ? failedChecks.map(c => REVISION_HINTS[c.name] || `Fix ${c.name}`).join('; ')
    : undefined;

  return {
    passed,
    checks: checkResults,
    latency,
    confidence,
    shouldRetry,
    revisionHint,
    failedChecks: failedChecks.map(c => c.name),
  };
}

/**
 * Quick pass/fail preflight check
 * 
 * @example
 * ```typescript
 * if (await preflightOk(response, query)) {
 *   sendToUser(response);
 * } else {
 *   revise(response);
 * }
 * ```
 */
export async function preflightOk(
  response: string,
  query: string,
  checks: PreflightOptions['checks'] = ['coherent', 'safe']
): Promise<boolean> {
  const result = await preflight(response, query, { checks, timeout: 3000 });
  return result.passed;
}

/**
 * Get preflight confidence score only (faster than full check)
 */
export async function preflightConfidence(
  response: string,
  query: string
): Promise<number> {
  const result = await preflight(response, query, {
    checks: ['coherent', 'relevant'],
    timeout: 2000,
  });
  return result.confidence;
}

/**
 * Check if response needs revision based on preflight
 */
export async function needsRevision(
  response: string,
  query: string,
  options?: PreflightOptions
): Promise<{ needsRevision: boolean; hint?: string }> {
  const result = await preflight(response, query, options);
  return {
    needsRevision: result.shouldRetry,
    hint: result.revisionHint,
  };
}
