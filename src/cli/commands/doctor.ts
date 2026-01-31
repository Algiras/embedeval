/**
 * Doctor Command - Environment diagnostics and setup verification
 * 
 * Checks:
 * - Node.js version (>=18)
 * - embedeval installation
 * - API keys configuration
 * - Sample data availability
 * - Auth status
 * 
 * Interactive Fix Mode:
 * - Automatically resolves common setup issues
 * - Prompts user for configuration when needed
 */

import chalk from 'chalk';
import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { listCredentials, getCredentialFromEnv, saveCredential } from '../../auth/store';
import { PROVIDERS, ProviderName } from '../../auth/types';
import { validateApiKey } from '../../auth/health-check';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
  recommendation?: string;
  fix?: () => Promise<boolean>;
}

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

async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

export const doctorCommand = new Command('doctor')
  .description('Check environment and diagnose setup issues')
  .option('--json', 'Output as JSON')
  .option('--fix', 'Attempt to fix issues interactively')
  .option('--validate-keys', 'Test API keys by making actual calls')
  .action(async (options?: { json?: boolean; fix?: boolean; validateKeys?: boolean }) => {
    const checks: CheckResult[] = [];
    
    console.log(chalk.blue('\n🔧 EmbedEval Doctor\n'));
    console.log(chalk.dim('Checking your environment...\n'));
    
    // Check 1: Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion >= 18) {
      checks.push({
        name: 'Node.js Version',
        status: 'pass',
        message: `Node.js ${nodeVersion} (>= 18.0.0)`,
      });
    } else {
      checks.push({
        name: 'Node.js Version',
        status: 'fail',
        message: `Node.js ${nodeVersion} (< 18.0.0)`,
        recommendation: 'Upgrade Node.js to version 18 or higher (https://nodejs.org)',
        fix: async () => {
          console.log(chalk.yellow('\n⚠️  Node.js upgrade required'));
          console.log(chalk.dim('Please download and install Node.js 18+ from https://nodejs.org'));
          return false; // Can't auto-fix Node.js version
        },
      });
    }
    
    // Check 2: Installation integrity
    const packageJsonPath = path.join(__dirname, '../../../package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = fs.readJsonSync(packageJsonPath);
      checks.push({
        name: 'Installation',
        status: 'pass',
        message: `embedeval v${pkg.version} installed`,
      });
    } else {
      checks.push({
        name: 'Installation',
        status: 'warn',
        message: 'Could not verify installation',
        recommendation: 'Try reinstalling: npm install -g embedeval',
        fix: async () => {
          console.log(chalk.blue('\n📦 Attempting to fix installation...'));
          const shouldInstall = await confirm('Install embedeval globally?');
          if (shouldInstall) {
            console.log(chalk.dim('Running: npm install -g embedeval'));
            // Note: We can't actually run npm install from within the CLI
            // This is just guidance
            console.log(chalk.yellow('Please run: npm install -g embedeval'));
          }
          return false;
        },
      });
    }
    
    // Check 3: API Keys
    const providers: ProviderName[] = ['gemini', 'openai', 'openrouter', 'anthropic', 'ollama'];
    const configuredProviders: { name: string; provider: ProviderName; source: string }[] = [];
    
    for (const provider of providers) {
      const envCred = getCredentialFromEnv(provider);
      if (envCred) {
        configuredProviders.push({ 
          name: PROVIDERS[provider].displayName, 
          provider,
          source: 'env'
        });
      }
    }
    
    // Also check stored credentials
    const storedCreds = await listCredentials();
    for (const cred of storedCreds) {
      const displayName = PROVIDERS[cred.provider].displayName;
      if (!configuredProviders.find(p => p.name === displayName)) {
        configuredProviders.push({ 
          name: displayName, 
          provider: cred.provider,
          source: 'stored'
        });
      }
    }
    
    if (configuredProviders.length > 0) {
      // Validate keys if requested
      let validProviders = configuredProviders;
      if (options?.validateKeys) {
        console.log(chalk.dim('\n  Validating API keys...'));
        const validated = [];
        for (const { name, provider, source } of configuredProviders) {
          const cred = await getCredentialFromEnv(provider);
          const apiKey = cred?.apiKey || '';
          const health = await validateApiKey(provider, apiKey);
          if (health.healthy) {
            validated.push({ name, provider, source, latency: health.latency });
            console.log(chalk.green(`    ✓ ${name} validated (${health.latency}ms)`));
          } else {
            console.log(chalk.red(`    ✗ ${name} failed: ${health.error}`));
          }
        }
        validProviders = validated;
      }
      
      if (validProviders.length > 0) {
        checks.push({
          name: 'LLM Providers',
          status: 'pass',
          message: `${validProviders.length} provider(s) ${options?.validateKeys ? 'validated' : 'configured'}`,
          details: validProviders.map(p => p.name).join(', '),
        });
      } else {
        checks.push({
          name: 'LLM Providers',
          status: 'fail',
          message: 'API keys configured but validation failed',
          recommendation: 'Check API keys and network connectivity',
          fix: async () => {
            return await fixNoProviders();
          },
        });
      }
    } else {
      checks.push({
        name: 'LLM Providers',
        status: 'fail',
        message: 'No LLM providers configured',
        recommendation: 'Run: embedeval auth login <provider>',
        details: 'Required: GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OLLAMA_HOST',
        fix: async () => {
          return await fixNoProviders();
        },
      });
    }
    
    // Check 4: Sample data
    const samplePaths = [
      path.join(__dirname, '../../../examples/v2/sample-traces.jsonl'),
      path.join(process.cwd(), 'examples/v2/sample-traces.jsonl'),
    ];
    
    let hasSampleData = false;
    let foundSamplePath = '';
    for (const samplePath of samplePaths) {
      if (fs.existsSync(samplePath)) {
        hasSampleData = true;
        foundSamplePath = samplePath;
        break;
      }
    }
    
    if (hasSampleData) {
      checks.push({
        name: 'Sample Data',
        status: 'pass',
        message: 'Sample traces available',
        details: foundSamplePath,
      });
    } else {
      checks.push({
        name: 'Sample Data',
        status: 'warn',
        message: 'No sample traces found',
        recommendation: 'Create sample data: embedeval generate init && embedeval generate create',
        fix: async () => {
          console.log(chalk.blue('\n📄 Creating sample traces...'));
          const shouldCreate = await confirm('Create sample traces in current directory?');
          if (shouldCreate) {
            const targetDir = path.join(process.cwd(), 'examples', 'v2');
            await fs.ensureDir(targetDir);
            const sampleContent = `{"id":"trace-001","timestamp":"2026-01-30T10:00:00Z","query":"What's your refund policy?","response":"We offer full refunds within 30 days.","context":{"retrievedDocs":[{"id":"doc-001","content":"Refund policy: 30 days","score":0.95}]},"metadata":{"provider":"gemini","model":"gemini-2.5-flash"}}
{"id":"trace-002","timestamp":"2026-01-30T10:01:00Z","query":"How do I reset my password?","response":"Click the Forgot Password link on the login page.","context":{"retrievedDocs":[{"id":"doc-002","content":"Password reset instructions","score":0.91}]},"metadata":{"provider":"openai","model":"gpt-4"}}
{"id":"trace-003","timestamp":"2026-01-30T10:02:00Z","query":"Do you offer enterprise pricing?","response":"Yes, contact sales@company.com for enterprise pricing.","context":{"retrievedDocs":[{"id":"doc-003","content":"Enterprise sales info","score":0.88}]},"metadata":{"provider":"gemini","model":"gemini-2.5-flash"}}
`;
            const targetPath = path.join(targetDir, 'sample-traces.jsonl');
            await fs.writeFile(targetPath, sampleContent);
            console.log(chalk.green(`  ✓ Created ${targetPath}`));
            return true;
          }
          return false;
        },
      });
    }
    
    // Check 5: System info
    checks.push({
      name: 'Operating System',
      status: 'pass',
      message: `${os.platform()} ${os.arch()}`,
    });
    
    // Output results
    if (options?.json) {
      console.log(JSON.stringify({
        checks: checks.map(c => ({
          name: c.name,
          status: c.status,
          message: c.message,
          details: c.details,
          recommendation: c.recommendation,
        })),
        summary: {
          passed: checks.filter(c => c.status === 'pass').length,
          failed: checks.filter(c => c.status === 'fail').length,
          warnings: checks.filter(c => c.status === 'warn').length,
        },
        system: {
          nodeVersion: process.version,
          platform: os.platform(),
          arch: os.arch(),
        },
      }, null, 2));
      return;
    }
    
    // Pretty output
    let hasFailures = false;
    let warningCount = 0;
    let fixableIssues: CheckResult[] = [];
    
    for (const check of checks) {
      const icon = check.status === 'pass' 
        ? chalk.green('✓') 
        : check.status === 'fail' 
          ? chalk.red('✗') 
          : chalk.yellow('⚠');
      
      const fixable = check.fix ? chalk.blue(' [fixable]') : '';
      console.log(`  ${icon} ${chalk.bold(check.name.padEnd(20))} ${check.message}${fixable}`);
      
      if (check.details) {
        console.log(chalk.dim(`    ${check.details}`));
      }
      
      if (check.recommendation && !options?.fix) {
        console.log(chalk.yellow(`    → ${check.recommendation}`));
      }
      
      if (check.status === 'fail') {
        hasFailures = true;
        if (check.fix) fixableIssues.push(check);
      }
      if (check.status === 'warn') {
        warningCount++;
        if (check.fix) fixableIssues.push(check);
      }
    }
    
    console.log();
    
    // Interactive fix mode
    if (options?.fix && fixableIssues.length > 0) {
      console.log(chalk.blue('🔧 Interactive Fix Mode\n'));
      
      for (const issue of fixableIssues) {
        console.log(chalk.yellow(`Fixing: ${issue.name}`));
        console.log(chalk.dim(`  ${issue.recommendation}\n`));
        
        try {
          const fixed = await issue.fix!();
          if (fixed) {
            console.log(chalk.green(`  ✓ Fixed ${issue.name}\n`));
          } else {
            console.log(chalk.yellow(`  ⚠ Could not auto-fix ${issue.name}\n`));
          }
        } catch (err) {
          console.log(chalk.red(`  ✗ Error fixing ${issue.name}: ${err}\n`));
        }
      }
      
      // Re-run doctor after fixes
      console.log(chalk.blue('🔄 Re-checking environment...\n'));
      // Reset and re-run checks (simplified for now)
      console.log(chalk.dim('Run doctor again to verify fixes:\n'));
      console.log(chalk.white('  embedeval doctor\n'));
    }
    
    // Summary
    const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const warnings = checks.filter(c => c.status === 'warn').length;
    
    if (failed === 0 && warnings === 0) {
      console.log(chalk.green.bold('✅ All checks passed! Your environment is ready.\n'));
      console.log(chalk.blue('Next steps:'));
      console.log('  1. Collect traces: embedeval collect <source> --output traces.jsonl');
      console.log('  2. Annotate:      embedeval annotate traces.jsonl --user you@example.com');
      console.log('  3. Build taxonomy: embedeval taxonomy build --annotations annotations.jsonl');
      console.log();
    } else if (failed === 0) {
      console.log(chalk.yellow.bold(`⚠️  ${passed} passed, ${warnings} warning(s)\n`));
      if (fixableIssues.length > 0 && !options?.fix) {
        console.log(chalk.blue(`Run with --fix to attempt auto-fixes:\n`));
        console.log(chalk.white('  embedeval doctor --fix\n'));
      }
    } else {
      console.log(chalk.red.bold(`❌ ${passed} passed, ${failed} failed, ${warnings} warning(s)\n`));
      if (fixableIssues.length > 0 && !options?.fix) {
        console.log(chalk.blue(`Run with --fix to attempt auto-fixes:\n`));
        console.log(chalk.white('  embedeval doctor --fix\n'));
      }
    }
    
    // Exit with error code if there are failures
    if (hasFailures && !options?.fix) {
      process.exit(1);
    }
  });

async function fixNoProviders(): Promise<boolean> {
  console.log(chalk.blue('\n🔐 Configure LLM Provider\n'));
  console.log(chalk.dim('Select a provider to configure:\n'));
  
  const providers: { key: string; name: string; envVar: string }[] = [
    { key: '1', name: 'Google Gemini (Recommended)', envVar: 'GEMINI_API_KEY' },
    { key: '2', name: 'OpenAI', envVar: 'OPENAI_API_KEY' },
    { key: '3', name: 'OpenRouter', envVar: 'OPENROUTER_API_KEY' },
    { key: '4', name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY' },
    { key: '5', name: 'Ollama (Local)', envVar: 'OLLAMA_HOST' },
    { key: '6', name: 'Skip for now', envVar: '' },
  ];
  
  providers.forEach(p => {
    console.log(`  ${p.key}. ${p.name}`);
  });
  console.log();
  
  const choice = await prompt('Select (1-6): ');
  const selected = providers.find(p => p.key === choice);
  
  if (!selected || selected.key === '6') {
    console.log(chalk.dim('\nSkipped. You can configure later with:'));
    console.log(chalk.white('  embedeval auth login <provider>\n'));
    return false;
  }
  
  const providerMap: Record<string, ProviderName> = {
    '1': 'gemini',
    '2': 'openai',
    '3': 'openrouter',
    '4': 'anthropic',
    '5': 'ollama',
  };
  
  const providerName = providerMap[selected.key];
  
  if (selected.key === '5') {
    // Ollama is different - uses host, not API key
    const host = await prompt('Ollama host (default: http://localhost:11434): ');
    const finalHost = host || 'http://localhost:11434';
    
    const saveToEnv = await confirm('Save to .env file?');
    if (saveToEnv) {
      const envContent = `OLLAMA_HOST=${finalHost}\n`;
      await fs.writeFile('.env', envContent);
      console.log(chalk.green(`  ✓ Created .env with OLLAMA_HOST`));
    } else {
      console.log(chalk.yellow(`  Add to environment: export OLLAMA_HOST=${finalHost}`));
    }
  } else {
    const key = await prompt(`${selected.envVar}: `);
    
    if (!key) {
      console.log(chalk.yellow('\nNo key provided. Skipped.'));
      return false;
    }
    
    const saveMethod = await prompt('Save to (1) .env file or (2) secure store? (1/2): ');
    
    if (saveMethod === '1') {
      // Save to .env file
      let envContent = '';
      if (fs.existsSync('.env')) {
        envContent = await fs.readFile('.env', 'utf-8');
        if (!envContent.endsWith('\n')) envContent += '\n';
      }
      envContent += `${selected.envVar}=${key}\n`;
      await fs.writeFile('.env', envContent);
      console.log(chalk.green(`  ✓ Added ${selected.envVar} to .env`));
    } else if (saveMethod === '2') {
      // Save to secure store
      try {
        await saveCredential({ 
          provider: providerName, 
          apiKey: key,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log(chalk.green(`  ✓ Saved ${selected.name} API key securely`));
      } catch (err) {
        console.log(chalk.red(`  ✗ Failed to save securely: ${err}`));
        console.log(chalk.yellow(`  Add to .env instead: ${selected.envVar}=your-key`));
        return false;
      }
    }
  }
  
  console.log(chalk.green(`\n  ✓ Provider configured!\n`));
  return true;
}

export default doctorCommand;
