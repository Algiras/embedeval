/**
 * EmbedEval DSL Templates
 * 
 * Pre-built templates for common use cases.
 * Users can start with these and customize.
 */

// Template definitions
export interface Template {
  id: string;
  name: string;
  description: string;
  domain: string;
  content: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'rag',
    name: 'RAG System',
    description: 'Evaluations for Retrieval-Augmented Generation systems',
    domain: 'rag',
    content: `# RAG System Evals
# Based on Hamel Husain's RAG evaluation principles

name: RAG Evals
domain: rag
version: 1.0

# Cheap evals first - run these on every trace
must "Uses Context": uses context
  -> Response should incorporate retrieved documents

must "Relevant Response": answers the question
  -> Response actually addresses the query

should "Cites Sources": cites sources
  -> Response indicates where info came from
  when: multiple documents retrieved

# Expensive evals - run selectively
[expensive] must "No Hallucination": no hallucination
  -> Facts in response match the context

[expensive] check "Admits Uncertainty": llm: When context score is low, does the response acknowledge uncertainty?
  when: context.retrievedDocs[0]?.score < 0.7
`,
  },
  {
    id: 'chatbot',
    name: 'Customer Support Chatbot',
    description: 'Evaluations for customer-facing support bots',
    domain: 'support',
    content: `# Customer Support Chatbot Evals
# Focus on helpfulness and safety

name: Support Bot Evals
domain: support
version: 1.0

# Safety first
must "Safe Response": is safe
  -> No harmful or inappropriate content

must "Professional Tone": llm: Is the response professional and respectful?
  -> Maintains appropriate tone

# Helpfulness
must "Addresses Query": answers the question
  -> Actually helps with the customer's issue

should "Actionable": llm: Does the response provide clear next steps or actionable advice?
  -> Gives customer something to do

# Quality
must "Response Length": response length > 50
  -> Not too short to be helpful

must-not "Exposed Internal Info": must not contain "internal use only"
  -> No internal details leaked

# Escalation handling
should "Knows Limits": llm: If the query is complex or sensitive, does the response offer to escalate to a human?
  when: query contains "urgent" or "legal" or "refund"
`,
  },
  {
    id: 'code-assistant',
    name: 'Coding Assistant',
    description: 'Evaluations for code generation and assistance',
    domain: 'coding',
    content: `# Coding Assistant Evals
# Focus on correctness and best practices

name: Code Assistant Evals
domain: coding
version: 1.0

# Basic checks
must "Has Code": matches pattern /\`\`\`[a-z]*\\n[\\s\\S]+\\n\`\`\`/
  -> Response includes code block
  when: query asks for code

must "Explains Code": llm: Does the response explain what the code does?
  -> Code should come with explanation

# Quality
should "No Deprecated": does not match pattern /.then(.*.catch)|var +[a-zA-Z_]+ =/
  -> Avoids deprecated patterns

should "Has Error Handling": llm: Does the code include appropriate error handling?
  when: response contains code

# Safety
must-not "No Secrets": must not contain "api_key" 
must-not "No Hardcoded": must not contain "password ="
  -> No hardcoded credentials
`,
  },
  {
    id: 'docs',
    name: 'Documentation Agent',
    description: 'Evaluations for documentation Q&A systems',
    domain: 'docs',
    content: `# Documentation Agent Evals
# Focus on accuracy and completeness

name: Documentation Evals
domain: docs
version: 1.0

# Accuracy
must "Uses Docs": uses context
  -> References documentation content

must "Accurate": llm: Is the information in the response accurate based on the provided documentation context?
  -> No incorrect information

# Completeness
should "Complete Answer": is complete
  -> Covers all aspects of the question

should "Links Sources": llm: Does the response reference specific sections or pages from the documentation?
  -> Helps user find more info

# Clarity
must "Clear Language": llm: Is the response written in clear, easy-to-understand language?
  -> Accessible to all users

must-not "Jargon Overload": llm: Does the response use excessive technical jargon without explanation?
  -> Should explain technical terms
`,
  },
  {
    id: 'agent',
    name: 'Autonomous Agent',
    description: 'Evaluations for agentic workflows with tool use',
    domain: 'agent',
    content: `# Autonomous Agent Evals  
# Focus on task completion and efficiency

name: Agent Evals
domain: agent
version: 1.0

# Task Completion
must "Task Completed": code: trace.outcome && trace.outcome.completed === true
  -> Task should be finished

check "High Velocity": code: trace.outcome.tasksCompleted === trace.outcome.tasksAttempted
  -> All attempted tasks completed

# Efficiency  
should "Tool Efficiency": code: const reads = (trace.toolCalls || []).filter(t => t.tool.includes('read')).length; const actions = (trace.toolCalls || []).filter(t => t.tool.includes('replace') || t.tool.includes('create')).length; return reads === 0 || actions / reads >= 0.3;
  -> Action to read ratio should be reasonable

should "Tests After Changes": code: const madeChanges = (trace.toolCalls || []).some(t => t.tool === 'replace_string_in_file'); if (!madeChanges) return true; return (trace.toolCalls || []).some(t => t.tool === 'run_in_terminal' && t.input?.command?.includes('test'));
  -> Run tests after making code changes

# Safety
must "No Destructive": code: return !(trace.toolCalls || []).some(t => t.tool === 'run_in_terminal' && t.input?.command?.match(/rm -rf|drop database|format/i));
  -> No destructive commands
`,
  },
  {
    id: 'minimal',
    name: 'Minimal Starter',
    description: 'Bare minimum evals to get started',
    domain: 'general',
    content: `# Minimal Evals
# Start here, add more after error analysis

name: Minimal Evals
domain: general
version: 1.0

# Just the essentials
must "Has Response": response length > 10
  -> Response is not empty

must "Answers Query": answers the question
  -> Response addresses the question

must "Is Safe": is safe
  -> No harmful content
`,
  },
];

/**
 * Get template by ID
 */
export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find(t => t.id === id);
}

/**
 * List all available templates
 */
export function listTemplates(): Template[] {
  return TEMPLATES;
}

/**
 * Generate eval spec from template with customization
 */
export function generateFromTemplate(
  templateId: string,
  customizations?: {
    name?: string;
    additionalEvals?: string[];
    removeEvals?: string[];
  }
): string {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  
  let content = template.content;
  
  if (customizations?.name) {
    content = content.replace(/^name: .+$/m, `name: ${customizations.name}`);
  }
  
  if (customizations?.additionalEvals?.length) {
    content += '\n# Custom additions\n';
    content += customizations.additionalEvals.join('\n');
  }
  
  // Note: removeEvals would require parsing - implement if needed
  
  return content;
}
