/**
 * MCP Server for EmbedEval
 * 
 * Exposes EmbedEval SDK as MCP tools for AI agents.
 * Enables agents to self-evaluate responses in real-time.
 * 
 * Run with: embedeval mcp-server
 * Or via npx: npx embedeval mcp-server
 */

import { createInterface } from 'readline';
import {
  evaluate,
  quickEval,
  getBuiltinEvals,
} from '../sdk/evaluate';
import {
  preflight,
} from '../sdk/preflight';
import {
  getConfidence,
  shouldSend,
} from '../sdk/confidence';
import {
  getSuggestions,
  getKnownCategories,
  generateRevisionPrompt,
} from '../sdk/suggestions';
import { getCollector } from '../sdk/collector';
import { Trace } from '../sdk/types';

// MCP Protocol Types
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// Tool definitions
const TOOLS = [
  {
    name: 'evaluate_response',
    description: 'Evaluate an AI response against built-in or custom evals. Returns pass/fail for each eval.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        response: { type: 'string', description: 'The AI response to evaluate' },
        query: { type: 'string', description: 'The original user query' },
        context: { type: 'string', description: 'Retrieved context used (optional)' },
        evals: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'List of eval names to run. Options: coherent, factual, helpful, complete, safe, uses-context, no-hallucination, has-sources' 
        },
      },
      required: ['response', 'query'],
    },
  },
  {
    name: 'quick_eval',
    description: 'Quick pass/fail check for a response. Fast, uses cheap model.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        response: { type: 'string', description: 'The AI response to evaluate' },
        query: { type: 'string', description: 'The original user query' },
      },
      required: ['response', 'query'],
    },
  },
  {
    name: 'preflight_check',
    description: 'Run preflight checks before sending a response. Catches obvious issues quickly.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        response: { type: 'string', description: 'The AI response to check' },
        query: { type: 'string', description: 'The original user query' },
        checks: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Specific checks to run. Options: coherent, safe, complete, relevant, factual' 
        },
      },
      required: ['response', 'query'],
    },
  },
  {
    name: 'get_confidence',
    description: 'Get confidence score and recommended action for a response.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        response: { type: 'string', description: 'The AI response' },
        query: { type: 'string', description: 'The original user query' },
      },
      required: ['response', 'query'],
    },
  },
  {
    name: 'should_send_response',
    description: 'Quick boolean check - should this response be sent?',
    inputSchema: {
      type: 'object' as const,
      properties: {
        response: { type: 'string', description: 'The AI response' },
        query: { type: 'string', description: 'The original user query' },
      },
      required: ['response', 'query'],
    },
  },
  {
    name: 'get_improvement_suggestions',
    description: 'Get actionable suggestions to improve a failed response.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        response: { type: 'string', description: 'The AI response that failed' },
        query: { type: 'string', description: 'The original user query' },
        failedEvals: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Which evals failed (e.g., coherent, factual)' 
        },
      },
      required: ['response', 'query', 'failedEvals'],
    },
  },
  {
    name: 'get_revision_prompt',
    description: 'Generate a revision prompt based on suggestions to improve the response.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        response: { type: 'string', description: 'The original response to revise' },
        suggestions: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'List of improvement suggestions' 
        },
      },
      required: ['response', 'suggestions'],
    },
  },
  {
    name: 'list_builtin_evals',
    description: 'List all available built-in evaluators.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_failure_categories',
    description: 'List known failure categories for classification.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'collect_trace',
    description: 'Record a trace for later analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Trace ID (auto-generated if not provided)' },
        query: { type: 'string', description: 'User query' },
        response: { type: 'string', description: 'AI response' },
        context: { type: 'string', description: 'Retrieved context (optional)' },
        metadata: { type: 'object', description: 'Additional metadata (optional)' },
      },
      required: ['query', 'response'],
    },
  },
  {
    name: 'get_collection_stats',
    description: 'Get statistics from collected traces.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'compile_dsl',
    description: 'Compile a DSL eval specification string into eval configs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        dsl: { type: 'string', description: 'DSL specification content (e.g., "must \\"Has Content\\": response length > 50")' },
      },
      required: ['dsl'],
    },
  },
  {
    name: 'run_dsl_evals',
    description: 'Compile DSL and run evals on a trace in one step.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        dsl: { type: 'string', description: 'DSL specification content' },
        query: { type: 'string', description: 'User query' },
        response: { type: 'string', description: 'AI response to evaluate' },
        context: { type: 'string', description: 'Retrieved context (optional)' },
      },
      required: ['dsl', 'query', 'response'],
    },
  },
  {
    name: 'list_dsl_templates',
    description: 'List available DSL templates (rag, chatbot, code-assistant, docs, agent, minimal).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_dsl_template',
    description: 'Get a specific DSL template content.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        template: { 
          type: 'string', 
          description: 'Template name: rag, chatbot, code-assistant, docs, agent, minimal' 
        },
      },
      required: ['template'],
    },
  },
];

// Tool handlers
async function handleTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'evaluate_response': {
      const evals = args.evals || ['coherent', 'helpful', 'complete'];
      const result = await evaluate(args.response, {
        query: args.query,
        context: args.context,
        evals,
      });
      return {
        passed: result.passed,
        passRate: result.passRate,
        results: result.results.map(r => ({
          eval: r.evalId,
          passed: r.passed,
          explanation: r.explanation,
        })),
      };
    }

    case 'quick_eval': {
      const passed = await quickEval(args.response, args.query);
      return { passed };
    }

    case 'preflight_check': {
      const result = await preflight(args.response, args.query, {
        checks: args.checks,
      });
      return {
        passed: result.passed,
        checks: result.checks,
        confidence: result.confidence,
        failedChecks: result.failedChecks,
      };
    }

    case 'get_confidence': {
      const result = await getConfidence(args.response, {
        query: args.query,
      });
      return {
        score: result.score,
        action: result.action,
        breakdown: result.breakdown,
        explanation: result.explanation,
      };
    }

    case 'should_send_response': {
      const ok = await shouldSend(args.response, args.query);
      return { shouldSend: ok };
    }

    case 'get_improvement_suggestions': {
      // Create a trace for suggestions
      const trace: Trace = {
        id: `temp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        query: args.query,
        response: args.response,
        metadata: {},
      };
      const evalResults = args.failedEvals.map((evalId: string) => ({
        evalId,
        passed: false,
        explanation: `Failed ${evalId} check`,
      }));
      const suggestions = await getSuggestions(trace, evalResults);
      return {
        suggestions: suggestions.map(s => ({
          category: s.category,
          severity: s.severity,
          action: s.action,
          example: s.example,
        })),
      };
    }

    case 'get_revision_prompt': {
      const prompt = generateRevisionPrompt(
        args.response,
        args.suggestions.map((s: string) => ({
          category: 'revision',
          severity: 'medium' as const,
          description: s,
          action: s,
        }))
      );
      return { revisionPrompt: prompt };
    }

    case 'list_builtin_evals': {
      const evals = getBuiltinEvals();
      return {
        evals: evals.map(name => ({
          id: name,
          name: name,
          description: `Built-in ${name} evaluator`,
        })),
      };
    }

    case 'list_failure_categories': {
      const categories = getKnownCategories();
      return { categories };
    }

    case 'collect_trace': {
      const collector = getCollector();
      const trace = await collector.collect({
        id: args.id,
        query: args.query,
        response: args.response,
        context: args.context ? { raw: args.context } : undefined,
        metadata: args.metadata,
      });
      return { traceId: trace.id, collected: true };
    }

    case 'get_collection_stats': {
      const collector = getCollector();
      const stats = collector.getStats();
      return stats;
    }

    case 'compile_dsl': {
      const { compile } = await import('../dsl');
      const configs = compile(args.dsl);
      return {
        evalCount: configs.length,
        evals: configs.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          priority: c.priority,
        })),
      };
    }

    case 'run_dsl_evals': {
      const { compile } = await import('../dsl');
      const { EvalRegistry } = await import('../evals/engine');
      
      // Compile DSL
      const configs = compile(args.dsl);
      
      // Create registry
      const registry = new EvalRegistry();
      for (const config of configs) {
        registry.register(config);
      }
      
      // Create trace
      const trace: Trace = {
        id: `eval-${Date.now()}`,
        timestamp: new Date().toISOString(),
        query: args.query,
        response: args.response,
        context: args.context ? { raw: args.context } : undefined,
        metadata: {},
      };
      
      // Run evals
      const results = await registry.runAll(trace);
      const passed = results.every(r => r.passed);
      
      return {
        passed,
        passRate: `${((results.filter(r => r.passed).length / results.length) * 100).toFixed(1)}%`,
        results: results.map(r => ({
          evalId: r.evalId,
          passed: r.passed,
          explanation: r.explanation,
        })),
      };
    }

    case 'list_dsl_templates': {
      const { listTemplates } = await import('../dsl/templates');
      const templates = listTemplates();
      return {
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          domain: t.domain,
        })),
      };
    }

    case 'get_dsl_template': {
      const { getTemplate } = await import('../dsl/templates');
      const template = getTemplate(args.template);
      if (!template) {
        throw new Error(`Template not found: ${args.template}`);
      }
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        content: template.content,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// MCP Server Class
class MCPServer {
  private rl: ReturnType<typeof createInterface>;

  constructor() {
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
  }

  private send(message: MCPResponse | MCPNotification): void {
    const json = JSON.stringify(message);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
  }

  private sendResult(id: string | number, result: any): void {
    this.send({
      jsonrpc: '2.0',
      id,
      result,
    });
  }

  private sendError(id: string | number | null, code: number, message: string): void {
    this.send({
      jsonrpc: '2.0',
      id,
      error: { code, message },
    });
  }

  private async handleRequest(request: MCPRequest): Promise<void> {
    const { id, method, params } = request;

    try {
      switch (method) {
        case 'initialize':
          this.sendResult(id, {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'embedeval',
              version: '2.0.5',
            },
          });
          break;

        case 'notifications/initialized':
          // Client is ready
          break;

        case 'tools/list':
          this.sendResult(id, { tools: TOOLS });
          break;

        case 'tools/call': {
          const { name, arguments: args } = params;
          const result = await handleTool(name, args || {});
          this.sendResult(id, {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          });
          break;
        }

        case 'ping':
          this.sendResult(id, {});
          break;

        default:
          this.sendError(id, -32601, `Method not found: ${method}`);
      }
    } catch (error: any) {
      this.sendError(id, -32603, error.message || 'Internal error');
    }
  }

  async start(): Promise<void> {
    let buffer = '';
    let contentLength = -1;

    process.stderr.write('EmbedEval MCP Server started\n');

    for await (const line of this.rl) {
      buffer += line + '\n';

      // Parse headers
      if (contentLength === -1) {
        const match = buffer.match(/Content-Length: (\d+)\r?\n\r?\n/);
        if (match) {
          contentLength = parseInt(match[1], 10);
          buffer = buffer.slice(match.index! + match[0].length);
        }
      }

      // Check if we have the full message
      if (contentLength !== -1 && buffer.length >= contentLength) {
        const json = buffer.slice(0, contentLength);
        buffer = buffer.slice(contentLength);
        contentLength = -1;

        try {
          const request = JSON.parse(json) as MCPRequest;
          await this.handleRequest(request);
        } catch (error: any) {
          this.sendError(null, -32700, 'Parse error');
        }
      }
    }
  }
}

// Export server start function
export async function startMCPServer(): Promise<void> {
  const server = new MCPServer();
  await server.start();
}

// Run if called directly
if (require.main === module) {
  startMCPServer().catch(error => {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  });
}
