/**
 * Init Command - Interactive project scaffolding
 * 
 * Creates a new embedeval project with:
 * - Directory structure (traces/, evals/, annotations/, reports/)
 * - Sample traces file
 * - Starter .eval file from template
 * - .env configuration file
 * - Project README
 */

import chalk from 'chalk';
import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as readline from 'readline';
import { PROVIDERS, ProviderName } from '../../auth/types';

interface InitOptions {
  name?: string;
  template?: string;
  skipPrompts?: boolean;
  yes?: boolean;
}

const TEMPLATES = [
  { name: 'rag', description: 'RAG systems (context usage, hallucination checks)' },
  { name: 'chatbot', description: 'Customer support bots (helpfulness, safety)' },
  { name: 'code-assistant', description: 'Code generation (syntax, best practices)' },
  { name: 'docs', description: 'Documentation Q&A (accuracy, completeness)' },
  { name: 'agent', description: 'Autonomous agents (task completion, efficiency)' },
  { name: 'healthcare', description: 'Healthcare applications (HIPAA, medical accuracy, disclaimers)' },
  { name: 'legal', description: 'Legal applications (citations, precedent accuracy, jurisdiction)' },
  { name: 'finance', description: 'Financial applications (compliance, risk disclosure, calculations)' },
  { name: 'education', description: 'Educational applications (learning objectives, difficulty)' },
  { name: 'minimal', description: 'Bare minimum to get started' },
];

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function selectTemplate(): Promise<string> {
  console.log(chalk.blue('\n📋 Available Templates:\n'));
  TEMPLATES.forEach((t, i) => {
    console.log(`  ${i + 1}. ${chalk.bold(t.name.padEnd(15))} ${t.description}`);
  });
  console.log();
  
  const answer = await prompt('Select template (1-10): ');
  const choice = parseInt(answer, 10);
  
  if (choice >= 1 && choice <= TEMPLATES.length) {
    return TEMPLATES[choice - 1].name;
  }
  
  console.log(chalk.yellow('Invalid choice, using "minimal" template'));
  return 'minimal';
}

async function promptForApiKey(): Promise<{ provider: ProviderName; key: string } | null> {
  console.log(chalk.blue('\n🔐 LLM Provider Setup (optional)\n'));
  console.log(chalk.dim('You can configure API keys now or later using: embedeval auth login\n'));
  
  const providers: ProviderName[] = ['gemini', 'openai', 'openrouter', 'anthropic'];
  
  console.log('Available providers:');
  providers.forEach((p, i) => {
    console.log(`  ${i + 1}. ${PROVIDERS[p].displayName}`);
  });
  console.log(`  5. Skip for now`);
  console.log();
  
  const answer = await prompt('Select provider (1-5): ');
  const choice = parseInt(answer, 10);
  
  if (choice === 5 || choice < 1 || choice > 4) {
    return null;
  }
  
  const provider = providers[choice - 1];
  const key = await prompt(`Enter ${PROVIDERS[provider].displayName} API key: `);
  
  if (!key) {
    console.log(chalk.yellow('No key provided, skipping...'));
    return null;
  }
  
  return { provider, key };
}

export const initCommand = new Command('init')
  .description('Initialize a new embedeval project')
  .argument('[directory]', 'Project directory name', 'my-eval-project')
  .option('-t, --template <name>', 'Template to use (rag, chatbot, code-assistant, docs, agent, healthcare, legal, finance, education, minimal)')
  .option('--yes', 'Skip prompts and use defaults')
  .action(async (directory: string, options: InitOptions) => {
    const projectPath = path.resolve(directory);
    const projectName = path.basename(projectPath);
    
    // Check if directory already exists
    if (fs.existsSync(projectPath)) {
      const files = await fs.readdir(projectPath);
      if (files.length > 0) {
        console.log(chalk.red(`\n❌ Directory "${directory}" already exists and is not empty\n`));
        process.exit(1);
      }
    }
    
    console.log(chalk.blue(`\n🚀 Creating new embedeval project: ${chalk.bold(projectName)}\n`));
    
    // Select template
    let template = options.template;
    if (!options.yes && !template) {
      template = await selectTemplate();
    }
    template = template || 'minimal';
    
    // Create directory structure
    const dirs = ['traces', 'evals', 'annotations', 'reports', 'docs'];
    for (const dir of dirs) {
      await fs.ensureDir(path.join(projectPath, dir));
    }
    
    console.log(chalk.green(`  ✓ Created directory structure`));
    
    // Copy sample traces
    const sampleTracesPath = path.join(__dirname, '../../../examples/v2/sample-traces.jsonl');
    const destTracesPath = path.join(projectPath, 'traces', 'sample-traces.jsonl');
    
    if (fs.existsSync(sampleTracesPath)) {
      await fs.copy(sampleTracesPath, destTracesPath);
      console.log(chalk.green(`  ✓ Copied sample traces`));
    }
    
    // Create starter .eval file
    const evalContent = generateEvalTemplate(template, projectName);
    const evalPath = path.join(projectPath, 'evals', `${template}.eval`);
    await fs.writeFile(evalPath, evalContent);
    console.log(chalk.green(`  ✓ Created ${template}.eval template`));
    
    // Create .env file
    let envContent = `# EmbedEval Environment Configuration\n# Generated by: embedeval init\n\n`;
    
    if (!options.yes) {
      const apiKeyConfig = await promptForApiKey();
      if (apiKeyConfig) {
        const envVar = PROVIDERS[apiKeyConfig.provider].envVar;
        envContent += `${envVar}=${apiKeyConfig.key}\n`;
      }
    }
    
    envContent += `\n# Optional: Set default provider (gemini, openai, openrouter, anthropic, ollama)\n# EMBEDEVAL_PROVIDER=gemini\n\n# Optional: OpenRouter base URL for multi-model access\n# OPENAI_BASE_URL=https://openrouter.ai/api/v1\n`;
    
    await fs.writeFile(path.join(projectPath, '.env'), envContent);
    console.log(chalk.green(`  ✓ Created .env file`));
    
    // Create README
    const readmeContent = generateReadme(projectName, template);
    await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);
    console.log(chalk.green(`  ✓ Created README.md`));
    
    // Create .gitignore
    const gitignoreContent = `# EmbedEval project\n.env\n.env.local\n*.log\nnode_modules/\nannotations.jsonl\ntaxonomy.json\nreport.html\n`;
    await fs.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);
    console.log(chalk.green(`  ✓ Created .gitignore`));
    
    // Success message
    console.log(chalk.blue(`\n✅ Project created successfully!\n`));
    console.log(chalk.white(`Next steps:\n`));
    console.log(chalk.dim(`  cd ${directory}`));
    console.log(chalk.dim(`  embedeval doctor              # Verify setup`));
    console.log(chalk.dim(`  embedeval view traces/        # View sample traces`));
    console.log(chalk.dim(`  embedeval annotate traces/    # Start annotating`));
    console.log();
    console.log(chalk.blue(`Documentation: https://algimas.github.io/embedeval\n`));
  });

function generateEvalTemplate(template: string, projectName: string): string {
  const templates: Record<string, string> = {
    minimal: `# ${projectName} Evaluations
name: ${projectName}
domain: general
version: 1.0

# Cheap evals - run on every trace
must "Has Content": response length > 50
must "Answers Query": answers the question

# Expensive evals - run selectively
[expensive] must "No Hallucination": no hallucination
`,
    rag: `# ${projectName} - RAG Evaluations
name: ${projectName}
domain: rag
version: 1.0

# CHEAP EVALS (fast, deterministic)
must "Uses Context": uses context
must "Has Content": response length > 50
must-not "No Secrets": must not contain "api_key"
should "Cites Sources": cites sources

# EXPENSIVE EVALS (LLM-as-judge)
[expensive] must "No Hallucination": no hallucination
[expensive] must "Answers Query": answers the question
[expensive] check "Uncertainty": llm: Does response admit uncertainty when context is weak?
  when: context.retrievedDocs[0]?.score < 0.7
`,
    chatbot: `# ${projectName} - Chatbot Evaluations
name: ${projectName}
domain: chatbot
version: 1.0

# CHEAP EVALS
must "Has Content": response length > 20
must "Addresses Query": must contain "help" or "assist" or addresses the question
must-not "No Unsafe Content": must not contain "ignore previous instructions"

# EXPENSIVE EVALS
[expensive] must "Is Helpful": is helpful
[expensive] must "Is Safe": is safe
[expensive] should "Shows Empathy": llm: Does the response show empathy for frustrated users?
  when: query contains "frustrated" or "annoyed" or "angry"
`,
    'code-assistant': `# ${projectName} - Code Assistant Evaluations
name: ${projectName}
domain: code-assistant
version: 1.0

# CHEAP EVALS
must "Has Code": matches pattern /\`\`\`[a-z]*\\n/
must "Has Explanation": response length > 100
should "Best Practices": mentions "best practice" or "recommend"

# EXPENSIVE EVALS
[expensive] must "Correct Syntax": llm: Is the code syntactically correct?
[expensive] must "Compiles": llm: Would this code compile without errors?
[expensive] check "Includes Tests": llm: Does the response suggest or include tests?
`,
    docs: `# ${projectName} - Documentation Q&A Evaluations
name: ${projectName}
domain: docs
version: 1.0

# CHEAP EVALS
must "Has Content": response length > 50
must "Uses Context": uses context
should "Complete Answer": response length > 200

# EXPENSIVE EVALS
[expensive] must "Accurate": no hallucination
[expensive] must "Complete": answers the question
[expensive] check "References Docs": llm: Does the response reference specific documentation sections?
`,
    agent: `# ${projectName} - Agent Evaluations
name: ${projectName}
domain: agent
version: 1.0

# CHEAP EVALS
must "Has Content": response length > 50
must "Task Completion": code: metadata.completed === true
should "Efficiency": code: (trace.toolCalls?.length || 0) < 10

# EXPENSIVE EVALS
[expensive] must "Correct Action": llm: Did the agent take the correct action?
[expensive] must "No Errors": llm: Were there any execution errors?
[expensive] check "Explains Reasoning": llm: Does the agent explain its reasoning?
`,
    healthcare: `# ${projectName} - Healthcare Evaluations
name: ${projectName}
domain: healthcare
version: 1.0

# CHEAP EVALS
must "Has Content": response length > 50
must "HIPAA Compliant": must not contain "patient name" or "medical record number" or "SSN"
must "Medical Disclaimer": must contain "not medical advice" or "consult a healthcare professional"
should "Appropriate Tone": must not contain "worry" or "panic" or "emergency" (unless actually urgent)

# EXPENSIVE EVALS
[expensive] must "Medical Accuracy": llm: Is the medical information factually accurate based on current medical knowledge?
[expensive] must "Appropriate Scope": llm: Does the response stay within the appropriate scope for a non-diagnostic system?
[expensive] check "Safety Warning": llm: Does the response include appropriate warnings for serious symptoms?
  when: query contains "chest pain" or "difficulty breathing" or "severe"
`,
    legal: `# ${projectName} - Legal Evaluations
name: ${projectName}
domain: legal
version: 1.0

# CHEAP EVALS
must "Has Content": response length > 50
must "Legal Disclaimer": must contain "not legal advice" or "consult an attorney" or "for informational purposes only"
should "Citation Format": matches pattern /\[\d+\]|\([A-Z][a-z]+ v\. [A-Z][a-z]+\)/

# EXPENSIVE EVALS
[expensive] must "Precedent Accuracy": llm: Are the legal precedents and statutes cited accurately?
[expensive] must "Jurisdiction Check": llm: Does the response correctly identify relevant jurisdictions and note when laws vary by location?
[expensive] check "Full Disclosure": llm: Does the response disclose limitations, uncertainties, or areas where legal interpretation may vary?
`,
    finance: `# ${projectName} - Financial Evaluations
name: ${projectName}
domain: finance
version: 1.0

# CHEAP EVALS
must "Has Content": response length > 50
must "Risk Disclosure": must contain "risk" or "past performance" or "no guarantee" or "investment advice"
should "Calculation Check": code: if response matches /\$[\d,]+/ || response matches /\d+%/ then metadata.calculationsVerified === true else true

# EXPENSIVE EVALS
[expensive] must "Calculation Accuracy": llm: Are all numerical calculations and financial projections mathematically correct?
[expensive] must "Regulatory Compliance": llm: Does the response comply with relevant financial regulations (SEC, FINRA, etc.)?
[expensive] check "Fiduciary Standard": llm: Does the response prioritize the user's best interest over potential commissions or fees?
  when: query contains "advisor" or "recommend" or "should I"
`,
    education: `# ${projectName} - Education Evaluations
name: ${projectName}
domain: education
version: 1.0

# CHEAP EVALS
must "Has Content": response length > 50
must "Learning Objective": must contain "learn" or "understand" or "concept" or "example"
should "Appropriate Difficulty": code: metadata.difficultyLevel matches query.metadata.userLevel || true

# EXPENSIVE EVALS
[expensive] must "Learning Objective Alignment": llm: Does the response directly address the stated learning objective?
[expensive] must "Explanation Clarity": llm: Is the explanation clear, well-structured, and appropriate for the target educational level?
[expensive] check "Engagement": llm: Does the response use examples, analogies, or interactive elements to enhance engagement?
`,
  };
  
  return templates[template] || templates.minimal;
}

function generateReadme(projectName: string, template: string): string {
  return `# ${projectName}

Evaluation project created with [EmbedEval](https://github.com/Algiras/embedeval).

## Quick Start

\`\`\`bash
# 1. Verify setup
embedeval doctor

# 2. View sample traces
embedeval view traces/

# 3. Annotate traces (binary pass/fail)
embedeval annotate traces/sample-traces.jsonl --user you@example.com

# 4. Build failure taxonomy
embedeval taxonomy build --annotations annotations.jsonl --user you@example.com

# 5. Run evaluations
embedeval dsl run evals/${template}.eval traces/sample-traces.jsonl
\`\`\`

## Project Structure

\`\`\`
.
├── traces/          # Trace files (.jsonl)
├── evals/           # Evaluation configs (.eval)
├── annotations/     # Manual annotations (.jsonl)
├── reports/         # Generated reports (.html)
├── docs/            # Documentation
├── .env             # API keys (gitignored)
└── README.md        # This file
\`\`\`

## Template: ${template}

This project uses the **${template}** template. See \`evals/${template}.eval\` for evaluation criteria.

## Documentation

- [Full Documentation](https://algimas.github.io/embedeval)
- [Hamel Husain's Evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- [GitHub Repository](https://github.com/Algiras/embedeval)

## Tips

- **Start with annotation**: Understanding failures comes before automation
- **Binary judgments only**: Pass/fail is faster and clearer than 1-5 scales
- **Single annotator**: One "benevolent dictator" owns quality
- **Cheap evals first**: Run fast checks before expensive LLM-as-judge
`;
}

export default initCommand;
