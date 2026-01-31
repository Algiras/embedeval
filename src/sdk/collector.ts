/**
 * Automatic Trace Collector
 * 
 * Hooks into agent interactions to automatically collect traces.
 * Supports auto-evaluation, streaming, and callbacks.
 * 
 * @example
 * ```typescript
 * const collector = new TraceCollector({
 *   outputFile: 'traces.jsonl',
 *   autoEvaluate: true,
 *   evals: [{ id: 'coherence', ... }],
 *   onEvaluate: (trace, results) => {
 *     if (results.some(r => !r.passed)) {
 *       console.log('Quality issue detected!');
 *     }
 *   }
 * });
 * 
 * // Collect a trace
 * const trace = collector.collect({
 *   query: 'How do I reset password?',
 *   response: 'Go to settings...'
 * });
 * 
 * // Get stats
 * const stats = collector.getStats();
 * ```
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs-extra';
import { 
  Trace, 
  CollectorOptions, 
  CollectorStats,
  CollectInput 
} from './types';
import { evaluate } from './evaluate';
import { EvaluateResult } from './types';

/**
 * Automatic trace collector for agent self-evaluation
 */
export class TraceCollector {
  private traces: Trace[] = [];
  private evaluations: Map<string, EvaluateResult> = new Map();
  private options: CollectorOptions;
  private writeStream: fs.WriteStream | null = null;

  constructor(options: CollectorOptions = {}) {
    this.options = {
      maxTraces: 1000,
      autoEvaluate: false,
      ...options,
    };

    // Set up file output if specified
    if (options.outputFile) {
      this.writeStream = fs.createWriteStream(options.outputFile, { flags: 'a' });
    }
  }

  /**
   * Collect a new trace
   */
  async collect(input: CollectInput): Promise<Trace> {
    const trace: Trace = {
      id: input.id || uuidv4(),
      timestamp: new Date().toISOString(),
      query: input.query,
      response: input.response,
      context: input.context,
      toolCalls: input.toolCalls?.map(tc => ({
        ...tc,
        latency: tc.latency ?? 0,
      })),
      metadata: {
        ...input.metadata,
      },
    };

    // Add to in-memory storage
    this.traces.push(trace);

    // Trim if over max
    if (this.options.maxTraces && this.traces.length > this.options.maxTraces) {
      this.traces = this.traces.slice(-this.options.maxTraces);
    }

    // Write to file if configured
    if (this.writeStream) {
      this.writeStream.write(JSON.stringify(trace) + '\n');
    }

    // Call trace callback
    if (this.options.onTrace) {
      this.options.onTrace(trace);
    }

    // Auto-evaluate if configured
    if (this.options.autoEvaluate) {
      await this.evaluateTrace(trace);
    }

    return trace;
  }

  /**
   * Evaluate a trace with default evals
   */
  private async evaluateTrace(trace: Trace): Promise<EvaluateResult> {
    const result = await evaluate(trace.response, {
      query: trace.query,
      context: trace.context,
      evals: ['coherent', 'helpful'],
    });

    // Store results
    this.evaluations.set(trace.id, result);

    // Call evaluation callback
    if (this.options.onTrace) {
      this.options.onTrace(trace, result);
    }

    return result;
  }

  /**
   * Get a specific trace by ID
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.find(t => t.id === traceId);
  }

  /**
   * Get evaluation results for a trace
   */
  getEvaluation(traceId: string): EvaluateResult | undefined {
    return this.evaluations.get(traceId);
  }

  /**
   * Get all traces
   */
  getAllTraces(): Trace[] {
    return [...this.traces];
  }

  /**
   * Get recent traces
   */
  getRecentTraces(count: number = 10): Trace[] {
    return this.traces.slice(-count);
  }

  /**
   * Get failed traces (those that failed evaluation)
   */
  getFailedTraces(): Trace[] {
    return this.traces.filter(trace => {
      const evalResult = this.evaluations.get(trace.id);
      return evalResult && !evalResult.passed;
    });
  }

  /**
   * Get collector statistics
   */
  getStats(): CollectorStats {
    const evaluatedTraces = this.traces.filter(t => this.evaluations.has(t.id));
    const failedTraces = this.getFailedTraces();
    
    // Count failure categories
    const failureCategories: Record<string, number> = {};
    for (const trace of failedTraces) {
      const evalResult = this.evaluations.get(trace.id);
      if (evalResult?.failureCategories) {
        for (const category of evalResult.failureCategories) {
          failureCategories[category] = (failureCategories[category] || 0) + 1;
        }
      }
    }

    return {
      totalTraces: this.traces.length,
      totalEvaluated: evaluatedTraces.length,
      passed: evaluatedTraces.length - failedTraces.length,
      failed: failedTraces.length,
      passRate: evaluatedTraces.length > 0
        ? ((evaluatedTraces.length - failedTraces.length) / evaluatedTraces.length) * 100
        : 100,
      failureCategories,
    };
  }

  /**
   * Export traces to JSONL
   */
  async exportToFile(filePath: string): Promise<void> {
    const lines = this.traces.map(t => JSON.stringify(t)).join('\n');
    await fs.writeFile(filePath, lines + '\n');
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.traces = [];
    this.evaluations.clear();
  }

  /**
   * Close file stream if open
   */
  close(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }
}

// Singleton collector for simple usage
let defaultCollector: TraceCollector | null = null;

/**
 * Get or create the default collector
 */
export function getCollector(options?: CollectorOptions): TraceCollector {
  if (!defaultCollector || options) {
    defaultCollector = new TraceCollector(options);
  }
  return defaultCollector;
}

/**
 * Collect a trace using the default collector
 */
export async function collect(input: CollectInput): Promise<Trace> {
  return getCollector().collect(input);
}

/**
 * Get stats from the default collector
 */
export function getCollectorStats(): CollectorStats {
  return getCollector().getStats();
}

/**
 * Decorator for auto-collecting function calls
 * 
 * @example
 * ```typescript
 * class Agent {
 *   @autoCollect()
 *   async respond(query: string): Promise<string> {
 *     // ... generate response
 *     return response;
 *   }
 * }
 * ```
 */
export function autoCollect(options?: CollectorOptions) {
  return function(
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const collector = getCollector(options);

    descriptor.value = async function(this: unknown, ...args: unknown[]) {
      const startTime = Date.now();
      const query = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
      
      try {
        const response = await originalMethod.apply(this, args);
        const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
        
        await collector.collect({
          query,
          response: responseStr,
          metadata: {
            latency: Date.now() - startTime,
            success: true,
          },
        });
        
        return response;
      } catch (error) {
        await collector.collect({
          query,
          response: `Error: ${error instanceof Error ? error.message : error}`,
          metadata: {
            latency: Date.now() - startTime,
            success: false,
            error: true,
          },
        });
        throw error;
      }
    };

    return descriptor;
  };
}
