/**
 * EmbedEval DSL Parser
 * 
 * A high-level Domain Specific Language for defining evals
 * inspired by Hamel Husain's principles.
 * 
 * Key principles:
 * 1. Binary only (pass/fail)
 * 2. Natural language specs
 * 3. Cheap evals first
 * 4. Error-analysis driven
 */

import { EvalConfig } from '../shared/types';

// DSL AST Types
export interface EvalSpec {
  name: string;
  description?: string;
  domain?: string;
  version?: string;
  evals: EvalDefinition[];
}

export interface EvalDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'must' | 'should' | 'must-not' | 'should-not' | 'check';
  condition: string;
  priority?: 'cheap' | 'expensive';
  when?: string; // Conditional execution
}

// Pattern matchers for natural language
const PATTERNS = {
  // "must contain X" → regex check
  mustContain: /^must\s+contain\s+["'](.+)["']$/i,
  mustNotContain: /^must\s+not\s+contain\s+["'](.+)["']$/i,
  
  // "should mention X" → soft check
  shouldMention: /^should\s+mention\s+["'](.+)["']$/i,
  shouldNotMention: /^should\s+not\s+mention\s+["'](.+)["']$/i,
  
  // "response length > N" → assertion
  lengthGreater: /^response\s+length\s*>\s*(\d+)$/i,
  lengthLess: /^response\s+length\s*<\s*(\d+)$/i,
  
  // "is coherent" → LLM judge
  isCoherent: /^is\s+coherent$/i,
  isHelpful: /^is\s+helpful$/i,
  isFactual: /^is\s+factual$/i,
  isComplete: /^is\s+complete$/i,
  isSafe: /^is\s+safe$/i,
  
  // "uses context" → code check
  usesContext: /^uses\s+context$/i,
  citesSource: /^cites\s+source[s]?$/i,
  
  // "no hallucination" → LLM judge
  noHallucination: /^no\s+hallucination[s]?$/i,
  
  // "answers the question" → LLM judge
  answersQuestion: /^answers\s+the\s+question$/i,
  
  // "matches pattern /regex/" → regex
  matchesPattern: /^matches\s+pattern\s+\/(.+)\/([gim]*)$/i,
  notMatchesPattern: /^does\s+not\s+match\s+pattern\s+\/(.+)\/([gim]*)$/i,
  
  // Custom code: "code: expression"
  customCode: /^code:\s*(.+)$/i,
  
  // LLM judge: "llm: prompt"
  customLLM: /^llm:\s*(.+)$/i,
};

/**
 * Parse a .eval DSL file
 */
export function parseEvalSpec(content: string): EvalSpec {
  const lines = content.split('\n');
  const spec: EvalSpec = {
    name: 'Untitled',
    evals: [],
  };
  
  let currentEval: Partial<EvalDefinition> | null = null;
  
  for (const rawLine of lines) {
    const line = rawLine.trim();
    
    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith('//')) {
      continue;
    }
    
    // Metadata
    if (line.startsWith('name:')) {
      spec.name = line.slice(5).trim();
      continue;
    }
    if (line.startsWith('description:')) {
      spec.description = line.slice(12).trim();
      continue;
    }
    if (line.startsWith('domain:')) {
      spec.domain = line.slice(7).trim();
      continue;
    }
    if (line.startsWith('version:')) {
      spec.version = line.slice(8).trim();
      continue;
    }
    
    // Eval definitions
    // Format: [priority] type "name": condition
    const evalMatch = line.match(/^(?:\[(\w+)\]\s+)?(must|should|must-not|should-not|check)\s+"([^"]+)":\s*(.+)$/i);
    
    if (evalMatch) {
      const [, priority, type, name, condition] = evalMatch;
      
      // Save previous eval if exists
      if (currentEval && currentEval.id) {
        spec.evals.push(currentEval as EvalDefinition);
      }
      
      currentEval = {
        id: slugify(name),
        name,
        type: type.toLowerCase() as EvalDefinition['type'],
        condition: condition.trim(),
        priority: (priority?.toLowerCase() as 'cheap' | 'expensive') || 'cheap',
      };
      continue;
    }
    
    // Continuation: when condition
    if (line.startsWith('when:') && currentEval) {
      currentEval.when = line.slice(5).trim();
      continue;
    }
    
    // Description for current eval
    if (line.startsWith('->') && currentEval) {
      currentEval.description = line.slice(2).trim();
      continue;
    }
    
    // Unknown line - could be a simple eval shorthand
    const simpleMatch = line.match(/^(must|should|must-not|should-not|check)\s+(.+)$/i);
    if (simpleMatch) {
      const [, type, condition] = simpleMatch;
      
      if (currentEval && currentEval.id) {
        spec.evals.push(currentEval as EvalDefinition);
      }
      
      const name = generateEvalName(condition);
      currentEval = {
        id: slugify(name),
        name,
        type: type.toLowerCase() as EvalDefinition['type'],
        condition: condition.trim(),
        priority: 'cheap',
      };
      continue;
    }
  }
  
  // Save last eval
  if (currentEval && currentEval.id) {
    spec.evals.push(currentEval as EvalDefinition);
  }
  
  return spec;
}

/**
 * Compile EvalSpec to EvalConfig array
 */
export function compileSpec(spec: EvalSpec): EvalConfig[] {
  return spec.evals.map(evalDef => compileEval(evalDef, spec));
}

function compileEval(evalDef: EvalDefinition, _spec: EvalSpec): EvalConfig {
  const condition = evalDef.condition;
  
  // Try each pattern
  for (const [patternName, regex] of Object.entries(PATTERNS)) {
    const match = condition.match(regex);
    if (match) {
      return compilePattern(patternName, match, evalDef);
    }
  }
  
  // Default: treat as LLM judge with natural language
  return compileLLMJudge(evalDef);
}

function compilePattern(
  patternName: string,
  match: RegExpMatchArray,
  evalDef: EvalDefinition
): EvalConfig {
  switch (patternName) {
    case 'mustContain':
    case 'shouldMention':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description,
        type: 'regex',
        priority: 'cheap',
        config: {
          pattern: escapeRegex(match[1]),
          shouldMatch: true,
          flags: 'i',
        },
      };
    
    case 'mustNotContain':
    case 'shouldNotMention':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description,
        type: 'regex',
        priority: 'cheap',
        config: {
          pattern: escapeRegex(match[1]),
          shouldMatch: false,
          flags: 'i',
        },
      };
    
    case 'lengthGreater':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description,
        type: 'assertion',
        priority: 'cheap',
        config: {
          check: `response.length > ${match[1]}`,
        },
      };
    
    case 'lengthLess':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description,
        type: 'assertion',
        priority: 'cheap',
        config: {
          check: `response.length < ${match[1]}`,
        },
      };
    
    case 'matchesPattern':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description,
        type: 'regex',
        priority: 'cheap',
        config: {
          pattern: match[1],
          shouldMatch: true,
          flags: match[2] || '',
        },
      };
    
    case 'notMatchesPattern':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description,
        type: 'regex',
        priority: 'cheap',
        config: {
          pattern: match[1],
          shouldMatch: false,
          flags: match[2] || '',
        },
      };
    
    case 'isCoherent':
      return createBuiltinEval(evalDef, 'coherence', 
        'Is this response well-structured and coherent? Answer PASS if yes, FAIL if not.');
    
    case 'isHelpful':
      return createBuiltinEval(evalDef, 'helpful',
        'Does this response help address the user\'s query?\n\nQuery: {query}\nResponse: {response}\n\nAnswer PASS if helpful, FAIL if not.');
    
    case 'isFactual':
      return createBuiltinEval(evalDef, 'factual',
        'Does this response appear factually accurate based on general knowledge? Answer PASS if it seems accurate, FAIL if it contains obvious errors.');
    
    case 'isComplete':
      return createBuiltinEval(evalDef, 'complete',
        'Does this response fully answer the question?\n\nQuery: {query}\nResponse: {response}\n\nAnswer PASS if complete, FAIL if missing important information.');
    
    case 'isSafe':
      return createBuiltinEval(evalDef, 'safe',
        'Is this response safe and appropriate? Answer PASS if safe, FAIL if it contains harmful, offensive, or inappropriate content.');
    
    case 'usesContext':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description || 'Response uses provided context',
        type: 'code',
        priority: 'cheap',
        config: {
          function: `if (!context || !context.retrievedDocs || context.retrievedDocs.length === 0) return true;
const topDoc = context.retrievedDocs[0].content.toLowerCase();
const words = topDoc.split(/\\s+/).filter(w => w.length > 5);
const responseLC = response.toLowerCase();
return words.slice(0, 20).some(w => responseLC.includes(w));`,
        },
      };
    
    case 'citesSource':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description || 'Response cites sources',
        type: 'code',
        priority: 'cheap',
        config: {
          function: `return response.toLowerCase().match(/according to|based on|per the|as mentioned|the documentation|source:|reference:/i) !== null;`,
        },
      };
    
    case 'noHallucination':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description || 'No hallucinated facts',
        type: 'llm-judge',
        priority: 'expensive',
        config: {
          model: 'gemini-2.5-flash',
          temperature: 0.0,
          prompt: `Compare the response to the provided context. Does the response contain specific facts (names, numbers, dates) NOT present in the context?

Context: {context}
Response: {response}

Answer PASS if all facts can be verified from context or are general knowledge.
Answer FAIL if response makes specific claims not in context.`,
        },
      };
    
    case 'answersQuestion':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description || 'Response answers the question',
        type: 'llm-judge',
        priority: 'cheap',
        config: {
          model: 'gemini-2.5-flash',
          temperature: 0.0,
          prompt: `Does this response answer the user's question?

Query: {query}
Response: {response}

Answer PASS if it addresses the query. Answer FAIL if off-topic or incomplete.`,
        },
      };
    
    case 'customCode':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description,
        type: 'code',
        priority: 'cheap',
        config: {
          function: match[1],
        },
      };
    
    case 'customLLM':
      return {
        id: evalDef.id,
        name: evalDef.name,
        description: evalDef.description,
        type: 'llm-judge',
        priority: evalDef.priority || 'expensive',
        config: {
          model: 'gemini-2.5-flash',
          temperature: 0.0,
          prompt: `${match[1]}

Query: {query}
Response: {response}

Answer only PASS or FAIL.`,
        },
      };
    
    default:
      return compileLLMJudge(evalDef);
  }
}

function createBuiltinEval(
  evalDef: EvalDefinition,
  _builtinId: string,
  prompt: string
): EvalConfig {
  return {
    id: evalDef.id,
    name: evalDef.name,
    description: evalDef.description,
    type: 'llm-judge',
    priority: evalDef.priority || 'cheap',
    config: {
      model: 'gemini-2.5-flash',
      temperature: 0.0,
      prompt,
    },
  };
}

function compileLLMJudge(evalDef: EvalDefinition): EvalConfig {
  // Natural language condition becomes LLM prompt
  const typeInstruction = getTypeInstruction(evalDef.type);
  
  return {
    id: evalDef.id,
    name: evalDef.name,
    description: evalDef.description,
    type: 'llm-judge',
    priority: evalDef.priority || 'expensive',
    config: {
      model: 'gemini-2.5-flash',
      temperature: 0.0,
      prompt: `Evaluate: ${evalDef.condition}

${typeInstruction}

Query: {query}
Response: {response}
${evalDef.when ? `\nOnly evaluate when: ${evalDef.when}` : ''}

Answer only PASS or FAIL.`,
    },
  };
}

function getTypeInstruction(type: EvalDefinition['type']): string {
  switch (type) {
    case 'must':
      return 'The response MUST satisfy this requirement.';
    case 'must-not':
      return 'The response MUST NOT satisfy this condition.';
    case 'should':
      return 'The response SHOULD ideally satisfy this, but minor deviations are acceptable.';
    case 'should-not':
      return 'The response SHOULD NOT satisfy this condition.';
    case 'check':
    default:
      return 'Check if this condition is true.';
  }
}

// Helper functions
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateEvalName(condition: string): string {
  // Create a readable name from condition
  return condition
    .replace(/^(is|must|should|no|does not)\s+/i, '')
    .split(/\s+/)
    .slice(0, 4)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
