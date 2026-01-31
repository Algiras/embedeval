/**
 * EmbedEval DSL Entry Point
 * 
 * High-level DSL for defining evals in natural language.
 * Inspired by Hamel Husain's principles.
 */

export { parseEvalSpec, compileSpec, EvalSpec, EvalDefinition } from './parser';
export { TEMPLATES, Template, getTemplate, listTemplates, generateFromTemplate } from './templates';

import { parseEvalSpec, compileSpec } from './parser';
import { EvalConfig } from '../shared/types';

/**
 * Parse and compile a DSL file to eval configs
 */
export function compile(dslContent: string): EvalConfig[] {
  const spec = parseEvalSpec(dslContent);
  return compileSpec(spec);
}

/**
 * Validate DSL content
 */
export function validate(dslContent: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    const spec = parseEvalSpec(dslContent);
    
    if (!spec.name || spec.name === 'Untitled') {
      errors.push('Missing name: declaration');
    }
    
    if (spec.evals.length === 0) {
      errors.push('No eval definitions found');
    }
    
    for (const evalDef of spec.evals) {
      if (!evalDef.condition) {
        errors.push(`Eval "${evalDef.name}" has no condition`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  } catch (e: any) {
    return { valid: false, errors: [e.message] };
  }
}
