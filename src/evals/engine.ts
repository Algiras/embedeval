/**
 * Binary Evaluation Engine
 * Supports cheap evals (assertions, regex, code) and expensive evals (LLM-as-judge)
 * All evals return binary PASS/FAIL results only (Hamel Husain principle)
 */

import { Trace, EvalConfig, EvalResult, EvalTypeConfig } from '../core/types';
import { logger } from '../utils/logger';

export interface EvalRunner {
  run(trace: Trace, config: EvalConfig): Promise<EvalResult>;
}

// ==================== CHEAP EVALS ====================

export class AssertionEval implements EvalRunner {
  async run(trace: Trace, config: EvalConfig): Promise<EvalResult> {
    const startTime = Date.now();
    const assertionConfig = config.config as { check: string };
    
    try {
      // Create safe evaluation context
      const context = {
        trace,
        query: trace.query,
        response: trace.response,
        output: trace.response,
        context: trace.context,
        toolCalls: trace.toolCalls,
        metadata: trace.metadata,
      };

      // Evaluate the assertion expression safely
      const result = this.safeEval(assertionConfig.check, context);
      
      return {
        evalId: config.id,
        passed: Boolean(result),
        explanation: `Assertion "${assertionConfig.check}" returned ${result}`,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        evalId: config.id,
        passed: false,
        explanation: `Assertion error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        latency: Date.now() - startTime,
      };
    }
  }

  private safeEval(expression: string, context: Record<string, unknown>): boolean {
    // Build function from expression
    const contextKeys = Object.keys(context);
    const contextValues = Object.values(context);
    
    // Create function with context variables as parameters
    const fn = new Function(...contextKeys, `return (${expression});`);
    
    // Execute with context values
    const result = fn(...contextValues);
    
    return Boolean(result);
  }
}

export class RegexEval implements EvalRunner {
  async run(trace: Trace, config: EvalConfig): Promise<EvalResult> {
    const startTime = Date.now();
    const regexConfig = config.config as { pattern: string; shouldMatch: boolean; flags?: string };
    
    try {
      const regex = new RegExp(regexConfig.pattern, regexConfig.flags || '');
      const matches = regex.test(trace.response);
      const passed = regexConfig.shouldMatch ? matches : !matches;
      
      return {
        evalId: config.id,
        passed,
        explanation: regexConfig.shouldMatch
          ? (matches ? `Pattern "${regexConfig.pattern}" found` : `Pattern "${regexConfig.pattern}" not found`)
          : (matches ? `Pattern "${regexConfig.pattern}" unexpectedly found` : `Pattern "${regexConfig.pattern}" correctly absent`),
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        evalId: config.id,
        passed: false,
        explanation: `Regex error: ${error instanceof Error ? error.message : 'Invalid pattern'}`,
        latency: Date.now() - startTime,
      };
    }
  }
}

export class CodeEval implements EvalRunner {
  async run(trace: Trace, config: EvalConfig): Promise<EvalResult> {
    const startTime = Date.now();
    const codeConfig = config.config as { function: string };
    
    try {
      // Create function from string
      const fn = new Function('trace', 'query', 'response', 'output', 'context', 'toolCalls', 'metadata', codeConfig.function);
      
      // Execute with trace data
      const result = fn(
        trace,
        trace.query,
        trace.response,
        trace.response,
        trace.context,
        trace.toolCalls,
        trace.metadata
      );
      
      // Handle both boolean and object return types
      if (typeof result === 'boolean') {
        return {
          evalId: config.id,
          passed: result,
          explanation: `Code eval returned ${result}`,
          latency: Date.now() - startTime,
        };
      } else if (result && typeof result === 'object') {
        return {
          evalId: config.id,
          passed: Boolean(result.passed),
          explanation: result.explanation || `Code eval returned ${result.passed}`,
          latency: Date.now() - startTime,
        };
      } else {
        return {
          evalId: config.id,
          passed: Boolean(result),
          explanation: `Code eval returned ${result}`,
          latency: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        evalId: config.id,
        passed: false,
        explanation: `Code execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        latency: Date.now() - startTime,
      };
    }
  }
}

// ==================== EXPENSIVE EVALS ====================

export class LLMJudgeEval implements EvalRunner {
  private judgeFunction: (prompt: string, model: string, temperature: number) => Promise<string>;

  constructor(
    judgeFunction: (prompt: string, model: string, temperature: number) => Promise<string>
  ) {
    this.judgeFunction = judgeFunction;
  }

  async run(trace: Trace, config: EvalConfig): Promise<EvalResult> {
    const startTime = Date.now();
    const llmConfig = config.config as { model: string; prompt: string; temperature: number };
    
    try {
      // Build prompt with trace data
      const prompt = llmConfig.prompt
        .replace(/\{query\}/g, trace.query)
        .replace(/\{response\}/g, trace.response)
        .replace(/\{output\}/g, trace.response)
        .replace(/\{context\}/g, this.formatContext(trace.context))
        .replace(/\{metadata\}/g, JSON.stringify(trace.metadata, null, 2));

      // Call judge LLM
      const judgeResponse = await this.judgeFunction(
        prompt,
        llmConfig.model,
        llmConfig.temperature ?? 0.0
      );

      // Parse binary response (PASS/FAIL)
      const output = judgeResponse.trim().toUpperCase();
      const passed = output.startsWith('PASS');
      
      // Extract explanation (everything after PASS/FAIL)
      const explanation = output.replace(/^(PASS|FAIL)\s*/i, '').trim() || 
        `LLM judge returned: ${output}`;

      return {
        evalId: config.id,
        passed,
        explanation,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        evalId: config.id,
        passed: false,
        explanation: `LLM judge error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        latency: Date.now() - startTime,
      };
    }
  }

  private formatContext(context: Trace['context']): string {
    if (!context || !context.retrievedDocs) return 'No context available';
    
    return context.retrievedDocs
      .map((doc, i) => `[${i + 1}] ${doc.content.substring(0, 200)}... (score: ${doc.score.toFixed(3)})`)
      .join('\n\n');
  }
}

// ==================== EVAL REGISTRY ====================

export class EvalRegistry {
  private evals: Map<string, EvalConfig> = new Map();
  private runners: Map<string, EvalRunner> = new Map();

  constructor(judgeFunction?: (prompt: string, model: string, temperature: number) => Promise<string>) {
    // Register cheap eval runners
    this.runners.set('assertion', new AssertionEval());
    this.runners.set('regex', new RegexEval());
    this.runners.set('code', new CodeEval());
    
    // Register expensive eval runner
    if (judgeFunction) {
      this.runners.set('llm-judge', new LLMJudgeEval(judgeFunction));
    }
  }

  register(evalConfig: EvalConfig): void {
    this.evals.set(evalConfig.id, evalConfig);
    logger.debug(`Registered eval: ${evalConfig.id} (${evalConfig.type})`);
  }

  async runAll(trace: Trace, options: { 
    stopOnFail?: boolean;
    filter?: string[];
  } = {}): Promise<EvalResult[]> {
    const results: EvalResult[] = [];
    
    // Get evals to run (filtered or all)
    let evalsToRun = Array.from(this.evals.values());
    if (options.filter) {
      evalsToRun = evalsToRun.filter(e => options.filter!.includes(e.id));
    }

    // Sort by priority (cheap first)
    evalsToRun.sort((a, b) => {
      if (a.priority === 'cheap' && b.priority === 'expensive') return -1;
      if (a.priority === 'expensive' && b.priority === 'cheap') return 1;
      return 0;
    });

    for (const evalConfig of evalsToRun) {
      const runner = this.runners.get(evalConfig.type);
      if (!runner) {
        logger.warn(`No runner found for eval type: ${evalConfig.type}`);
        continue;
      }

      try {
        const result = await runner.run(trace, evalConfig);
        results.push(result);

        // Early exit if configured
        if (options.stopOnFail && !result.passed && evalConfig.priority === 'cheap') {
          logger.debug(`Stopping evals on first failure: ${evalConfig.id}`);
          break;
        }
      } catch (error) {
        logger.error(`Error running eval ${evalConfig.id}:`, error);
        results.push({
          evalId: evalConfig.id,
          passed: false,
          explanation: `Runner error: ${error instanceof Error ? error.message : 'Unknown'}`,
          latency: 0,
        });
      }
    }

    return results;
  }

  list(): EvalConfig[] {
    return Array.from(this.evals.values());
  }

  get(id: string): EvalConfig | undefined {
    return this.evals.get(id);
  }
}
