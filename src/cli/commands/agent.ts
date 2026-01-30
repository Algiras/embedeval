/**
 * Agent CLI Commands
 * 
 * CLI interface for AI agents to interact with EmbedEval programmatically.
 * Returns structured JSON responses suitable for agent consumption.
 * 
 * @module cli/commands/agent
 */

import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  AgentResponse,
  ABTestResult,
  Hypothesis,
  SyntheticQuery,
} from '../../core/types';
import { KnowledgeBase } from '../../evolution/knowledge-base';
import { HypothesisEngine } from '../../research/hypothesis-engine';
import { SyntheticQueryGenerator } from '../../research/synthetic-data';
import { loadConfig } from '../../utils/config';
import { logger } from '../../utils/logger';

/**
 * Format response for agent consumption
 */
function formatAgentResponse<T>(
  status: 'success' | 'error' | 'partial',
  data?: T,
  options?: {
    summary?: string;
    interpretation?: string;
    recommendations?: string[];
    error?: { code: string; message: string; suggestion: string };
  }
): AgentResponse<T> {
  return {
    status,
    data,
    summary: options?.summary || '',
    interpretation: options?.interpretation,
    recommendations: options?.recommendations,
    error: options?.error,
    metadata: {
      duration: 0,  // Will be set by caller
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

/**
 * Register agent commands
 */
export function registerAgentCommand(program: Command): void {
  const agent = program
    .command('agent')
    .description('AI agent interface for programmatic access');

  // ============================================================================
  // agent evaluate - Run evaluation and return structured results
  // ============================================================================
  agent
    .command('evaluate')
    .description('Evaluate embedding quality on a dataset')
    .requiredOption('-c, --corpus <path>', 'Corpus file path (JSONL)')
    .requiredOption('-q, --queries <path>', 'Queries file path (JSONL)')
    .option('--provider <type>', 'Provider type (ollama, openai, google, huggingface)', 'ollama')
    .option('--model <name>', 'Model name', 'nomic-embed-text')
    .option('--strategy <name>', 'Strategy name', 'baseline')
    .option('--output-format <format>', 'Output format (json, summary)', 'json')
    .action(async (options) => {
      const startTime = Date.now();
      
      try {
        // Build config
        const config = {
          providers: [{
            type: options.provider,
            model: options.model,
            baseUrl: options.provider === 'ollama' ? 'http://localhost:11434' : undefined,
          }],
          dataset: options.queries,
          corpus: options.corpus,
          strategies: [{ name: options.strategy, pipeline: ['embed', 'retrieve'] }],
          metrics: ['ndcg@5', 'ndcg@10', 'recall@5', 'recall@10', 'mrr@10'],
        };

        // Import and run evaluation
        const { EnhancedABTestingEngine } = await import('../../core/ab-testing/enhanced-engine');
        
        // Load data
        const queriesContent = await fs.readFile(options.queries, 'utf-8');
        const corpusContent = await fs.readFile(options.corpus, 'utf-8');
        
        const testCases = queriesContent.trim().split('\n').map(line => JSON.parse(line));
        const documents = corpusContent.trim().split('\n').map(line => JSON.parse(line));

        const engine = new EnhancedABTestingEngine({
          id: `agent-eval-${Date.now()}`,
          name: 'Agent Evaluation',
          variants: [{
            id: 'v1',
            name: `${options.provider}:${options.model}`,
            provider: config.providers[0] as any,
            strategy: options.strategy,
          }],
          dataset: options.queries,
          corpus: options.corpus,
          metrics: config.metrics,
          output: {},
        });

        const result = await engine.run(testCases, documents);
        await engine.close();

        // Build response
        const variant = result.variants[0];
        const response = formatAgentResponse<ABTestResult>(
          'success',
          result,
          {
            summary: `Evaluation completed: NDCG@10=${variant.metrics.ndcg10?.toFixed(3)}, Recall@10=${variant.metrics.recall10?.toFixed(3)}`,
            interpretation: interpretResults(variant.metrics),
            recommendations: generateRecommendations(variant.metrics, options.strategy),
          }
        );
        
        response.metadata!.duration = Date.now() - startTime;

        if (options.outputFormat === 'summary') {
          console.log(response.summary);
          console.log('\nInterpretation:', response.interpretation);
          console.log('\nRecommendations:');
          response.recommendations?.forEach(r => console.log(`  - ${r}`));
        } else {
          console.log(JSON.stringify(response, null, 2));
        }

        // Record in knowledge base
        const kb = new KnowledgeBase();
        await kb.initialize();
        await kb.recordExperiment(result, { corpus: options.corpus });
        await kb.close();

      } catch (error) {
        const response = formatAgentResponse<null>(
          'error',
          null,
          {
            summary: 'Evaluation failed',
            error: {
              code: 'EVAL_FAILED',
              message: error instanceof Error ? error.message : String(error),
              suggestion: 'Check that corpus and queries files exist and are valid JSONL',
            },
          }
        );
        response.metadata!.duration = Date.now() - startTime;
        console.log(JSON.stringify(response, null, 2));
        process.exit(1);
      }
    });

  // ============================================================================
  // agent hypothesize - Generate experiment hypotheses
  // ============================================================================
  agent
    .command('hypothesize')
    .description('Generate experiment hypotheses based on current state')
    .option('--strategy <name>', 'Current strategy', 'baseline')
    .option('--model <name>', 'Current model', 'unknown')
    .option('--max <n>', 'Maximum hypotheses to generate', '5')
    .option('--output-format <format>', 'Output format (json, summary)', 'json')
    .action(async (options) => {
      const startTime = Date.now();
      
      try {
        const kb = new KnowledgeBase();
        await kb.initialize();
        
        const engine = new HypothesisEngine(kb);
        
        const hypotheses = await engine.generateHypotheses({
          currentStrategy: options.strategy,
          currentModel: options.model,
          maxHypotheses: parseInt(options.max),
        });
        
        await kb.close();

        const response = formatAgentResponse<Hypothesis[]>(
          hypotheses.length > 0 ? 'success' : 'partial',
          hypotheses,
          {
            summary: `Generated ${hypotheses.length} hypotheses for testing`,
            interpretation: hypotheses.length > 0 
              ? `Top hypothesis: ${hypotheses[0].statement} (confidence: ${(hypotheses[0].confidence * 100).toFixed(0)}%)`
              : 'No hypotheses generated. Try running more experiments first.',
            recommendations: hypotheses.slice(0, 3).map(h => 
              `Test: ${h.challengerStrategy} vs ${h.baselineStrategy} (expected +${(h.expectedImprovement * 100).toFixed(0)}%)`
            ),
          }
        );
        
        response.metadata!.duration = Date.now() - startTime;

        if (options.outputFormat === 'summary') {
          console.log(response.summary);
          console.log('\nHypotheses:');
          hypotheses.forEach((h, i) => {
            console.log(`\n${i + 1}. ${h.statement}`);
            console.log(`   Rationale: ${h.rationale}`);
            console.log(`   Test: ${h.baselineStrategy} vs ${h.challengerStrategy}`);
            console.log(`   Expected: +${(h.expectedImprovement * 100).toFixed(0)}%, Confidence: ${(h.confidence * 100).toFixed(0)}%`);
          });
        } else {
          console.log(JSON.stringify(response, null, 2));
        }

      } catch (error) {
        const response = formatAgentResponse<null>(
          'error',
          null,
          {
            summary: 'Hypothesis generation failed',
            error: {
              code: 'HYPOTHESIS_FAILED',
              message: error instanceof Error ? error.message : String(error),
              suggestion: 'Ensure knowledge base is initialized',
            },
          }
        );
        response.metadata!.duration = Date.now() - startTime;
        console.log(JSON.stringify(response, null, 2));
        process.exit(1);
      }
    });

  // ============================================================================
  // agent generate-queries - Generate synthetic test queries
  // ============================================================================
  agent
    .command('generate-queries')
    .description('Generate synthetic test queries from corpus')
    .requiredOption('-c, --corpus <path>', 'Corpus file path (JSONL)')
    .requiredOption('-o, --output <path>', 'Output file path')
    .option('--provider <type>', 'LLM provider (openai, google)', 'openai')
    .option('--model <name>', 'LLM model name', 'gpt-4')
    .option('--num-queries <n>', 'Number of queries to generate', '50')
    .option('--difficulty <level>', 'Difficulty (easy, medium, hard, mixed)', 'mixed')
    .option('--output-format <format>', 'Output format (json, summary)', 'json')
    .action(async (options) => {
      const startTime = Date.now();
      
      try {
        // Check for API key
        const apiKey = options.provider === 'openai' 
          ? process.env.OPENAI_API_KEY 
          : process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
          throw new Error(`${options.provider.toUpperCase()}_API_KEY environment variable not set`);
        }

        const generator = new SyntheticQueryGenerator({
          corpusPath: options.corpus,
          outputPath: options.output,
          provider: {
            type: options.provider,
            apiKey,
            model: options.model,
          } as any,
          llmModel: options.model,
          numQueries: parseInt(options.numQueries),
          queryTypes: ['factual', 'conceptual', 'comparison'],
          difficulty: options.difficulty as any,
          includeNegatives: false,
        });

        const queries = await generator.generate();

        const response = formatAgentResponse<SyntheticQuery[]>(
          'success',
          queries,
          {
            summary: `Generated ${queries.length} synthetic queries`,
            interpretation: `Queries saved to ${options.output}. Distribution: ${summarizeQueryDistribution(queries)}`,
            recommendations: [
              'Run evaluation with generated queries to establish baseline',
              'Review queries for quality before production use',
              'Consider generating hard negatives for challenging evaluation',
            ],
          }
        );
        
        response.metadata!.duration = Date.now() - startTime;

        if (options.outputFormat === 'summary') {
          console.log(response.summary);
          console.log('\nSample queries:');
          queries.slice(0, 5).forEach((q, i) => {
            console.log(`  ${i + 1}. [${q.difficulty}] ${q.query}`);
          });
        } else {
          console.log(JSON.stringify(response, null, 2));
        }

      } catch (error) {
        const response = formatAgentResponse<null>(
          'error',
          null,
          {
            summary: 'Query generation failed',
            error: {
              code: 'GENERATION_FAILED',
              message: error instanceof Error ? error.message : String(error),
              suggestion: 'Check API key and corpus file path',
            },
          }
        );
        response.metadata!.duration = Date.now() - startTime;
        console.log(JSON.stringify(response, null, 2));
        process.exit(1);
      }
    });

  // ============================================================================
  // agent knowledge - Query the knowledge base
  // ============================================================================
  agent
    .command('knowledge')
    .description('Query the knowledge base for insights')
    .option('--query <text>', 'Natural language query')
    .option('--best-models', 'Get best performing models')
    .option('--best-strategies', 'Get best performing strategies')
    .option('--failures', 'Get common failure patterns')
    .option('--insights', 'Get generated insights')
    .option('--stats', 'Get knowledge base statistics')
    .option('--output-format <format>', 'Output format (json, summary)', 'json')
    .action(async (options) => {
      const startTime = Date.now();
      
      try {
        const kb = new KnowledgeBase();
        await kb.initialize();

        let data: any = {};
        let summary = '';

        if (options.bestModels) {
          data.bestModels = kb.getBestModels('ndcg10', 5);
          summary = `Top ${data.bestModels.length} models by NDCG@10`;
        }

        if (options.bestStrategies) {
          data.bestStrategies = kb.getBestStrategies({ limit: 5 });
          summary += summary ? '; ' : '';
          summary += `Top ${data.bestStrategies.length} strategies`;
        }

        if (options.failures) {
          data.failurePatterns = kb.getFailurePatterns({ limit: 10 });
          summary += summary ? '; ' : '';
          summary += `${data.failurePatterns.length} failure patterns`;
        }

        if (options.insights) {
          data.insights = kb.generateInsights();
          summary += summary ? '; ' : '';
          summary += `${data.insights.length} insights`;
        }

        if (options.stats) {
          data.stats = kb.getStats();
          summary += summary ? '; ' : '';
          summary += `Stats: ${data.stats.totalExperiments} experiments`;
        }

        if (options.query) {
          // Simple keyword-based query
          data.recommendations = kb.getRecommendations({
            domain: options.query,
          });
          summary = `Recommendations for: ${options.query}`;
        }

        await kb.close();

        const response = formatAgentResponse(
          Object.keys(data).length > 0 ? 'success' : 'partial',
          data,
          {
            summary: summary || 'No query specified',
            recommendations: data.recommendations || data.insights?.slice(0, 3),
          }
        );
        
        response.metadata!.duration = Date.now() - startTime;

        if (options.outputFormat === 'summary') {
          console.log(response.summary);
          if (data.insights) {
            console.log('\nInsights:');
            data.insights.forEach((i: string) => console.log(`  - ${i}`));
          }
          if (data.recommendations) {
            console.log('\nRecommendations:');
            data.recommendations.forEach((r: string) => console.log(`  - ${r}`));
          }
        } else {
          console.log(JSON.stringify(response, null, 2));
        }

      } catch (error) {
        const response = formatAgentResponse<null>(
          'error',
          null,
          {
            summary: 'Knowledge query failed',
            error: {
              code: 'KNOWLEDGE_FAILED',
              message: error instanceof Error ? error.message : String(error),
              suggestion: 'Initialize knowledge base first: embedeval init --knowledge-base',
            },
          }
        );
        response.metadata!.duration = Date.now() - startTime;
        console.log(JSON.stringify(response, null, 2));
        process.exit(1);
      }
    });

  // ============================================================================
  // agent init - Initialize knowledge base and directories
  // ============================================================================
  agent
    .command('init')
    .description('Initialize EmbedEval for agent use')
    .option('--path <path>', 'Base path for EmbedEval data', '.embedeval')
    .action(async (options) => {
      const startTime = Date.now();
      
      try {
        const basePath = path.resolve(options.path);
        
        // Create directories
        await fs.ensureDir(path.join(basePath, 'knowledge'));
        await fs.ensureDir(path.join(basePath, 'runs'));
        await fs.ensureDir(path.join(basePath, 'cache'));
        
        // Initialize knowledge base
        const kb = new KnowledgeBase(path.join(basePath, 'knowledge'));
        await kb.initialize();
        await kb.save();
        await kb.close();

        const response = formatAgentResponse(
          'success',
          { path: basePath },
          {
            summary: `Initialized EmbedEval at ${basePath}`,
            recommendations: [
              'Generate synthetic queries: embedeval agent generate-queries -c corpus.jsonl -o queries.jsonl',
              'Run first evaluation: embedeval agent evaluate -c corpus.jsonl -q queries.jsonl',
              'Generate hypotheses: embedeval agent hypothesize',
            ],
          }
        );
        
        response.metadata!.duration = Date.now() - startTime;
        console.log(JSON.stringify(response, null, 2));

      } catch (error) {
        const response = formatAgentResponse<null>(
          'error',
          null,
          {
            summary: 'Initialization failed',
            error: {
              code: 'INIT_FAILED',
              message: error instanceof Error ? error.message : String(error),
              suggestion: 'Check directory permissions',
            },
          }
        );
        response.metadata!.duration = Date.now() - startTime;
        console.log(JSON.stringify(response, null, 2));
        process.exit(1);
      }
    });
}

// ============================================================================
// Helper Functions
// ============================================================================

function interpretResults(metrics: Record<string, number>): string {
  const ndcg = metrics.ndcg10 || 0;
  const recall = metrics.recall10 || 0;
  const mrr = metrics.mrr10 || 0;

  let interpretation = '';

  if (ndcg >= 0.8) {
    interpretation = 'Excellent retrieval quality. ';
  } else if (ndcg >= 0.6) {
    interpretation = 'Good retrieval quality with room for improvement. ';
  } else if (ndcg >= 0.4) {
    interpretation = 'Moderate retrieval quality. Consider strategy improvements. ';
  } else {
    interpretation = 'Poor retrieval quality. Significant improvements needed. ';
  }

  if (recall > 0.8 && mrr < 0.5) {
    interpretation += 'Relevant docs are found but poorly ranked - consider reranking.';
  } else if (recall < 0.5) {
    interpretation += 'Many relevant docs are missed - consider hybrid retrieval.';
  }

  return interpretation;
}

function generateRecommendations(metrics: Record<string, number>, currentStrategy: string): string[] {
  const recommendations: string[] = [];
  const ndcg = metrics.ndcg10 || 0;
  const recall = metrics.recall10 || 0;

  if (ndcg < 0.6 && !currentStrategy.includes('chunk')) {
    recommendations.push('Try semantic-chunks strategy for potentially +5-10% NDCG improvement');
  }

  if (ndcg < 0.7 && !currentStrategy.includes('hybrid')) {
    recommendations.push('Try hybrid-bm25 strategy to capture exact keyword matches');
  }

  if (recall > 0.7 && ndcg < 0.6) {
    recommendations.push('Add LLM reranking to improve result ordering');
  }

  if (recommendations.length === 0) {
    recommendations.push('Current configuration is performing well');
    recommendations.push('Consider testing against different query types');
  }

  return recommendations;
}

function summarizeQueryDistribution(queries: SyntheticQuery[]): string {
  const byDifficulty: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const q of queries) {
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;
    byType[q.queryType] = (byType[q.queryType] || 0) + 1;
  }

  const diffStr = Object.entries(byDifficulty)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  
  return diffStr;
}
