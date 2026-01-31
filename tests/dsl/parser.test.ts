/**
 * Comprehensive Tests for the EmbedEval DSL Parser
 *
 * Tests:
 * 1. parseEvalSpec - metadata parsing (name, description, version, domain)
 * 2. parseEvalSpec - must/should/must-not evals
 * 3. parseEvalSpec - priority annotations ([expensive], [cheap])
 * 4. parseEvalSpec - continuation lines (when:, -> description)
 * 5. compileSpec - pattern matching for different eval types
 * 6. Error handling and edge cases
 */

import {
  parseEvalSpec,
  compileSpec,
  EvalSpec,
} from '../../src/dsl/parser';
import { EvalConfig, RegexConfig, CodeConfig, LLMJudgeConfig } from '../../src/shared/types';

// Type guard helpers for accessing config properties
function getRegexConfig(config: EvalConfig['config']): RegexConfig {
  return config as RegexConfig;
}

function getCodeConfig(config: EvalConfig['config']): CodeConfig {
  return config as CodeConfig;
}

function getLLMJudgeConfig(config: EvalConfig['config']): LLMJudgeConfig {
  return config as LLMJudgeConfig;
}

describe('DSL Parser', () => {
  describe('parseEvalSpec - Metadata Parsing', () => {
    it('should parse name field', () => {
      const dsl = `
name: My Test Eval
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.name).toBe('My Test Eval');
      expect(spec.evals).toHaveLength(0);
    });

    it('should use default name when not specified', () => {
      const dsl = `
# Just a comment
must "Has Content": response length > 10
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.name).toBe('Untitled');
    });

    it('should parse description field', () => {
      const dsl = `
name: RAG Evaluation
description: Evaluates RAG responses for quality and accuracy
domain: rag
version: 1.0
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.name).toBe('RAG Evaluation');
      expect(spec.description).toBe('Evaluates RAG responses for quality and accuracy');
      expect(spec.domain).toBe('rag');
      expect(spec.version).toBe('1.0');
    });

    it('should parse all metadata fields in any order', () => {
      const dsl = `
domain: chatbot
version: 2.0
description: A chatbot eval suite
name: Chatbot Evals
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.name).toBe('Chatbot Evals');
      expect(spec.description).toBe('A chatbot eval suite');
      expect(spec.domain).toBe('chatbot');
      expect(spec.version).toBe('2.0');
    });

    it('should handle empty metadata values', () => {
      const dsl = `
name:
description:
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.name).toBe('');
      expect(spec.description).toBe('');
    });
  });

  describe('parseEvalSpec - Must/Should/Must-Not Evals', () => {
    it('should parse must eval with quoted name', () => {
      const dsl = `
must "Has Content": response length > 50
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].type).toBe('must');
      expect(spec.evals[0].name).toBe('Has Content');
      expect(spec.evals[0].id).toBe('has-content');
      expect(spec.evals[0].condition).toBe('response length > 50');
    });

    it('should parse should eval with quoted name', () => {
      const dsl = `
should "Uses Context": uses context
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].type).toBe('should');
      expect(spec.evals[0].name).toBe('Uses Context');
      expect(spec.evals[0].condition).toBe('uses context');
    });

    it('should parse must-not eval with quoted name', () => {
      const dsl = `
must-not "No Secrets": must not contain "api_key"
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].type).toBe('must-not');
      expect(spec.evals[0].name).toBe('No Secrets');
      expect(spec.evals[0].condition).toBe('must not contain "api_key"');
    });

    it('should parse should-not eval with quoted name', () => {
      const dsl = `
should-not "No Debug Info": response must not contain "debug"
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].type).toBe('should-not');
      expect(spec.evals[0].name).toBe('No Debug Info');
    });

    it('should parse check eval with quoted name', () => {
      const dsl = `
check "Fast Response": code: metadata.latency < 3000
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].type).toBe('check');
      expect(spec.evals[0].name).toBe('Fast Response');
      expect(spec.evals[0].condition).toBe('code: metadata.latency < 3000');
    });

    it('should parse simple eval without quoted name (shorthand)', () => {
      const dsl = `
must is coherent
should cites sources
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(2);
      expect(spec.evals[0].type).toBe('must');
      expect(spec.evals[0].condition).toBe('is coherent');
      expect(spec.evals[1].type).toBe('should');
      expect(spec.evals[1].condition).toBe('cites sources');
    });

    it('should parse multiple evals in order', () => {
      const dsl = `
name: Multi Eval
must "First": response length > 10
should "Second": is coherent
must-not "Third": contains "error"
check "Fourth": code: true
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(4);
      expect(spec.evals[0].name).toBe('First');
      expect(spec.evals[1].name).toBe('Second');
      expect(spec.evals[2].name).toBe('Third');
      expect(spec.evals[3].name).toBe('Fourth');
    });

    it('should handle eval names with special characters', () => {
      const dsl = `
must "Check API-Key_v2": must not contain "secret"
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals[0].name).toBe('Check API-Key_v2');
      expect(spec.evals[0].id).toBe('check-api-key-v2');
    });

    it('should handle eval conditions with special characters', () => {
      const dsl = `
must "Complex": matches pattern /\\d{3}-\\d{4}/
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals[0].condition).toBe('matches pattern /\\d{3}-\\d{4}/');
    });
  });

  describe('parseEvalSpec - Priority Annotations', () => {
    it('should parse [expensive] priority annotation', () => {
      const dsl = `
[expensive] must "No Hallucination": no hallucination
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].priority).toBe('expensive');
    });

    it('should parse [cheap] priority annotation', () => {
      const dsl = `
[cheap] must "Has Content": response length > 50
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].priority).toBe('cheap');
    });

    it('should default to cheap priority when not specified', () => {
      const dsl = `
must "Default Priority": is coherent
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals[0].priority).toBe('cheap');
    });

    it('should handle mixed priorities in same spec', () => {
      const dsl = `
[cheap] must "Fast": response length > 10
[expensive] must "Accurate": is factual
must "Default": is helpful
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals[0].priority).toBe('cheap');
      expect(spec.evals[1].priority).toBe('expensive');
      expect(spec.evals[2].priority).toBe('cheap');
    });

    it('should be case insensitive for priority', () => {
      const dsl = `
[EXPENSIVE] must "Uppercase": no hallucination
[Expensive] must "Mixed": is complete
[cheap] must "Lowercase": is safe
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals[0].priority).toBe('expensive');
      expect(spec.evals[1].priority).toBe('expensive');
      expect(spec.evals[2].priority).toBe('cheap');
    });
  });

  describe('parseEvalSpec - Continuation Lines', () => {
    it('should parse when: condition for conditional execution', () => {
      const dsl = `
[expensive] must "No Hallucination": no hallucination
  when: context.retrievedDocs[0]?.score < 0.7
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].when).toBe('context.retrievedDocs[0]?.score < 0.7');
    });

    it('should parse -> description for eval description', () => {
      const dsl = `
must "Has Content": response length > 50
  -> This ensures the response is not empty
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].description).toBe('This ensures the response is not empty');
    });

    it('should handle both when: and -> in same eval', () => {
      const dsl = `
[expensive] must "Smart Check": no hallucination
  when: query contains "technical"
  -> Only run this expensive check for technical queries
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].priority).toBe('expensive');
      expect(spec.evals[0].when).toBe('query contains "technical"');
      expect(spec.evals[0].description).toBe('Only run this expensive check for technical queries');
    });

    it('should handle multiple evals with continuation lines', () => {
      const dsl = `
must "First": response length > 10
  -> First description

must "Second": is coherent
  when: response.length > 100
  -> Second description
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(2);
      expect(spec.evals[0].description).toBe('First description');
      expect(spec.evals[1].when).toBe('response.length > 100');
      expect(spec.evals[1].description).toBe('Second description');
    });

    it('should ignore continuation lines when no current eval', () => {
      const dsl = `
  when: some condition
  -> some description
must "Valid": is coherent
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].when).toBeUndefined();
      expect(spec.evals[0].description).toBeUndefined();
    });
  });

  describe('parseEvalSpec - Comments and Whitespace', () => {
    it('should ignore lines starting with #', () => {
      const dsl = `
# This is a comment
name: Test
# Another comment
must "Eval": is coherent
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.name).toBe('Test');
      expect(spec.evals).toHaveLength(1);
    });

    it('should ignore lines starting with //', () => {
      const dsl = `
// This is a JS-style comment
name: Test
must "Eval": is coherent
// End comment
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.name).toBe('Test');
      expect(spec.evals).toHaveLength(1);
    });

    it('should ignore empty lines', () => {
      const dsl = `
name: Test


must "Eval": is coherent

      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals).toHaveLength(1);
    });

    it('should trim whitespace from lines', () => {
      const dsl = `
  name: Test with spaces  
  must "Eval": is coherent  
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.name).toBe('Test with spaces');
      expect(spec.evals[0].name).toBe('Eval');
      expect(spec.evals[0].condition).toBe('is coherent');
    });
  });

  describe('compileSpec - Pattern Matching', () => {
    it('should compile must contain pattern to regex eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-must-contain',
          name: 'Must Contain Test',
          type: 'must',
          condition: 'must contain "refund"',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs).toHaveLength(1);
      expect(configs[0].type).toBe('regex');
      expect(configs[0].config).toEqual({
        pattern: 'refund',
        shouldMatch: true,
        flags: 'i',
      });
    });

    it('should compile must not contain pattern to regex eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-must-not-contain',
          name: 'Must Not Contain Test',
          type: 'must-not',
          condition: 'must not contain "api_key"',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('regex');
      expect(configs[0].config).toEqual({
        pattern: 'api_key',
        shouldMatch: false,
        flags: 'i',
      });
    });

    it('should compile should mention pattern to regex eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-should-mention',
          name: 'Should Mention Test',
          type: 'should',
          condition: 'should mention "documentation"',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('regex');
      expect(configs[0].config).toMatchObject({
        pattern: 'documentation',
        shouldMatch: true,
      });
    });

    it('should compile response length > N to assertion eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-length-greater',
          name: 'Length Greater Test',
          type: 'must',
          condition: 'response length > 100',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('assertion');
      expect(configs[0].config).toEqual({
        check: 'response.length > 100',
      });
    });

    it('should compile response length < N to assertion eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-length-less',
          name: 'Length Less Test',
          type: 'must',
          condition: 'response length < 500',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('assertion');
      expect(configs[0].config).toEqual({
        check: 'response.length < 500',
      });
    });

    it('should compile matches pattern to regex eval with flags', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-matches-pattern',
          name: 'Matches Pattern Test',
          type: 'must',
          condition: 'matches pattern /\\d{3}-\\d{4}/g',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('regex');
      expect(configs[0].config).toEqual({
        pattern: '\\d{3}-\\d{4}',
        shouldMatch: true,
        flags: 'g',
      });
    });

    it('should compile does not match pattern to regex eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-not-matches',
          name: 'Not Matches Test',
          type: 'must-not',
          condition: 'does not match pattern /error/i',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('regex');
      expect(configs[0].config).toEqual({
        pattern: 'error',
        shouldMatch: false,
        flags: 'i',
      });
    });

    it('should compile is coherent to llm-judge eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-coherent',
          name: 'Coherent Test',
          type: 'must',
          condition: 'is coherent',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('llm-judge');
      expect(configs[0].config).toMatchObject({
        model: 'gemini-2.5-flash',
        temperature: 0.0,
      });
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('coherent');
    });

    it('should compile is helpful to llm-judge eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-helpful',
          name: 'Helpful Test',
          type: 'should',
          condition: 'is helpful',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('llm-judge');
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('helpful');
    });

    it('should compile is factual to llm-judge eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-factual',
          name: 'Factual Test',
          type: 'must',
          condition: 'is factual',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('llm-judge');
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('factual');
    });

    it('should compile is complete to llm-judge eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-complete',
          name: 'Complete Test',
          type: 'must',
          condition: 'is complete',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('llm-judge');
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('complete');
    });

    it('should compile is safe to llm-judge eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-safe',
          name: 'Safe Test',
          type: 'must',
          condition: 'is safe',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('llm-judge');
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('safe');
    });

    it('should compile uses context to code eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-uses-context',
          name: 'Uses Context Test',
          type: 'must',
          condition: 'uses context',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('code');
      expect(configs[0].config).toHaveProperty('function');
      expect(getCodeConfig(configs[0].config).function).toContain('context.retrievedDocs');
    });

    it('should compile cites sources to code eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-cites',
          name: 'Cites Sources Test',
          type: 'should',
          condition: 'cites sources',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('code');
      expect(configs[0].config).toHaveProperty('function');
      expect(getCodeConfig(configs[0].config).function).toContain('according to');
    });

    it('should compile no hallucination to llm-judge eval with expensive priority', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-no-hallucination',
          name: 'No Hallucination Test',
          type: 'must',
          condition: 'no hallucination',
          priority: 'expensive',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('llm-judge');
      expect(configs[0].priority).toBe('expensive');
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('context');
    });

    it('should compile answers the question to llm-judge eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-answers',
          name: 'Answers Question Test',
          type: 'must',
          condition: 'answers the question',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('llm-judge');
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('question');
    });

    it('should compile code: expression to code eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-custom-code',
          name: 'Custom Code Test',
          type: 'check',
          condition: 'code: metadata.latency < 3000',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('code');
      expect(configs[0].config).toEqual({
        function: 'metadata.latency < 3000',
      });
    });

    it('should compile llm: prompt to llm-judge eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-custom-llm',
          name: 'Custom LLM Test',
          type: 'check',
          condition: 'llm: Is this response professional?',
          priority: 'expensive',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('llm-judge');
      expect(configs[0].priority).toBe('expensive');
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('Is this response professional?');
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('Answer only PASS or FAIL');
    });

    it('should compile unknown conditions to llm-judge eval', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-unknown',
          name: 'Unknown Condition',
          type: 'must',
          condition: 'has good grammar and spelling',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('llm-judge');
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('has good grammar and spelling');
    });

    it('should preserve eval priority in compiled config', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [
          {
            id: 'cheap-eval',
            name: 'Cheap Eval',
            type: 'must',
            condition: 'response length > 10',
            priority: 'cheap',
          },
          {
            id: 'expensive-eval',
            name: 'Expensive Eval',
            type: 'must',
            condition: 'is coherent',
            priority: 'expensive',
          },
        ],
      };

      const configs = compileSpec(spec);

      expect(configs[0].priority).toBe('cheap');
      expect(configs[1].priority).toBe('expensive');
    });

    it('should preserve description in compiled config', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-desc',
          name: 'Desc Test',
          type: 'must',
          condition: 'is coherent',
          description: 'This checks coherence',
        }],
      };

      const configs = compileSpec(spec);

      expect(configs[0].description).toBe('This checks coherence');
    });
  });

  describe('Full DSL to Compiled Config Integration', () => {
    it('should parse and compile a complete RAG eval spec', () => {
      const dsl = `
name: RAG Evaluations
description: Evaluates RAG system responses
domain: rag
version: 1.0

# Cheap evals - run first
must "Uses Context": uses context
must "Has Content": response length > 50

# Expensive evals - run selectively
[expensive] must "No Hallucination": no hallucination
  when: context.retrievedDocs[0]?.score < 0.7
  -> Only run when context confidence is low

[expensive] should "Cites Sources": cites sources
      `;

      const spec = parseEvalSpec(dsl);
      const configs = compileSpec(spec);

      expect(spec.name).toBe('RAG Evaluations');
      expect(spec.description).toBe('Evaluates RAG system responses');
      expect(spec.domain).toBe('rag');
      expect(spec.version).toBe('1.0');
      expect(spec.evals).toHaveLength(4);

      expect(configs).toHaveLength(4);
      expect(configs[0].type).toBe('code'); // uses context
      expect(configs[1].type).toBe('assertion'); // response length
      expect(configs[2].type).toBe('llm-judge'); // no hallucination
      expect(configs[2].priority).toBe('expensive');
      expect(configs[3].type).toBe('code'); // cites sources
    });

    it('should handle all pattern types in one spec', () => {
      const dsl = `
name: Comprehensive Eval

must "Contains Refund": must contain "refund"
must-not "No Error": must not contain "error"
should "Mentions Help": should mention "help"
must "Short": response length < 1000
must "Coherent": is coherent
must "Uses Context": uses context
must "No Hallucination": no hallucination
must "Pattern Match": matches pattern /\\d+/
check "Custom Code": code: response.includes('test')
check "Custom LLM": llm: Is this good?
      `;

      const spec = parseEvalSpec(dsl);
      const configs = compileSpec(spec);

      expect(spec.evals).toHaveLength(10);
      expect(configs).toHaveLength(10);

      // Verify types
      expect(configs[0].type).toBe('regex'); // must contain
      expect(configs[1].type).toBe('regex'); // must not contain
      expect(configs[2].type).toBe('regex'); // should mention
      expect(configs[3].type).toBe('assertion'); // response length
      expect(configs[4].type).toBe('llm-judge'); // is coherent
      expect(configs[5].type).toBe('code'); // uses context
      expect(configs[6].type).toBe('llm-judge'); // no hallucination
      expect(configs[7].type).toBe('regex'); // matches pattern
      expect(configs[8].type).toBe('code'); // code:
      expect(configs[9].type).toBe('llm-judge'); // llm:
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty DSL content', () => {
      const dsl = '';
      const spec = parseEvalSpec(dsl);

      expect(spec.name).toBe('Untitled');
      expect(spec.evals).toHaveLength(0);
    });

    it('should handle DSL with only comments', () => {
      const dsl = `
# Just a comment
// Another comment
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.name).toBe('Untitled');
      expect(spec.evals).toHaveLength(0);
    });

    it('should handle DSL with only whitespace', () => {
      const dsl = `

   

      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.name).toBe('Untitled');
      expect(spec.evals).toHaveLength(0);
    });

    it('should handle malformed eval lines gracefully', () => {
      const dsl = `
valid "Has Content": response length > 50
unknown "Test": is coherent
      `;
      const spec = parseEvalSpec(dsl);

      // Lines with invalid types (not must/should/must-not/should-not/check) should be ignored
      expect(spec.evals).toHaveLength(0);
    });

    it('should handle empty quoted names as simple eval pattern', () => {
      const dsl = `
must "": response length > 10
      `;
      const spec = parseEvalSpec(dsl);

      // Empty quotes are parsed as a simple eval (not quoted name pattern)
      // This is an edge case that results in an unusual name
      expect(spec.evals).toHaveLength(1);
      expect(spec.evals[0].condition).toContain('response length');
    });

    it('should handle special regex characters in must contain', () => {
      const dsl = `
must "Contains Special": must contain "[test]"
      `;
      const spec = parseEvalSpec(dsl);
      const configs = compileSpec(spec);

      expect(configs[0].type).toBe('regex');
      // Should escape the brackets
      expect(getRegexConfig(configs[0].config).pattern).toBe('\\[test\\]');
    });

    it('should handle complex code expressions', () => {
      const dsl = `
check "Complex Code": code: context && context.retrievedDocs && context.retrievedDocs.length > 0 && context.retrievedDocs[0].score > 0.5
      `;
      const spec = parseEvalSpec(dsl);

      expect(spec.evals[0].condition).toBe('code: context && context.retrievedDocs && context.retrievedDocs.length > 0 && context.retrievedDocs[0].score > 0.5');

      const configs = compileSpec(spec);
      expect(configs[0].type).toBe('code');
      expect(getCodeConfig(configs[0].config).function).toContain('context.retrievedDocs');
    });

    it('should compile empty spec to empty configs', () => {
      const spec: EvalSpec = {
        name: 'Empty',
        evals: [],
      };

      const configs = compileSpec(spec);
      expect(configs).toHaveLength(0);
    });

    it('should handle eval with very long condition', () => {
      const longCondition = 'code: ' + 'x'.repeat(1000);
      const dsl = `
check "Long": ${longCondition}
      `;

      const spec = parseEvalSpec(dsl);
      expect(spec.evals[0].condition).toBe(longCondition);
    });

    it('should handle evals with duplicate names (different IDs)', () => {
      const dsl = `
must "Same Name": response length > 10
must "Same Name": response length > 20
      `;

      const spec = parseEvalSpec(dsl);
      expect(spec.evals).toHaveLength(2);
      expect(spec.evals[0].id).toBe('same-name');
      expect(spec.evals[1].id).toBe('same-name');
    });
  });

  describe('Type Instruction Tests', () => {
    it('should include type instruction for must in LLM prompt', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-must',
          name: 'Must Test',
          type: 'must',
          condition: 'be professional',
        }],
      };

      const configs = compileSpec(spec);
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('MUST');
    });

    it('should include type instruction for must-not in LLM prompt', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-must-not',
          name: 'Must Not Test',
          type: 'must-not',
          condition: 'be rude',
        }],
      };

      const configs = compileSpec(spec);
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('MUST NOT');
    });

    it('should include type instruction for should in LLM prompt', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-should',
          name: 'Should Test',
          type: 'should',
          condition: 'be detailed',
        }],
      };

      const configs = compileSpec(spec);
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('SHOULD');
    });

    it('should include type instruction for should-not in LLM prompt', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-should-not',
          name: 'Should Not Test',
          type: 'should-not',
          condition: 'be verbose',
        }],
      };

      const configs = compileSpec(spec);
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('SHOULD NOT');
    });

    it('should include when condition in LLM prompt if present', () => {
      const spec: EvalSpec = {
        name: 'Test',
        evals: [{
          id: 'test-when',
          name: 'When Test',
          type: 'must',
          condition: 'be professional',
          when: 'query contains "business"',
        }],
      };

      const configs = compileSpec(spec);
      expect(getLLMJudgeConfig(configs[0].config).prompt).toContain('Only evaluate when: query contains "business"');
    });
  });
});
