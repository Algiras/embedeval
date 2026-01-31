/**
 * Doctor Command - Environment diagnostics and setup verification
 * 
 * Checks:
 * - Node.js version (>=18)
 * - embedeval installation
 * - API keys configuration
 * - Sample data availability
 * - Auth status
 */

import chalk from 'chalk';
import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { listCredentials, getCredentialFromEnv } from '../../auth/store';
import { PROVIDERS, ProviderName } from '../../auth/types';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
  recommendation?: string;
}

export const doctorCommand = new Command('doctor')
  .description('Check environment and diagnose setup issues')
  .option('--json', 'Output as JSON')
  .option('--fix', 'Attempt to fix issues interactively')
  .action(async (options?: { json?: boolean; fix?: boolean }) => {
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
        recommendation: 'Upgrade Node.js to version 18 or higher',
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
      });
    }
    
    // Check 3: API Keys
    const providers: ProviderName[] = ['gemini', 'openai', 'openrouter', 'anthropic', 'ollama'];
    const configuredProviders: string[] = [];
    
    for (const provider of providers) {
      const envCred = getCredentialFromEnv(provider);
      if (envCred) {
        configuredProviders.push(PROVIDERS[provider].displayName);
      }
    }
    
    // Also check stored credentials
    const storedCreds = await listCredentials();
    for (const cred of storedCreds) {
      const displayName = PROVIDERS[cred.provider].displayName;
      if (!configuredProviders.includes(displayName)) {
        configuredProviders.push(displayName);
      }
    }
    
    if (configuredProviders.length > 0) {
      checks.push({
        name: 'LLM Providers',
        status: 'pass',
        message: `${configuredProviders.length} provider(s) configured`,
        details: configuredProviders.join(', '),
      });
    } else {
      checks.push({
        name: 'LLM Providers',
        status: 'fail',
        message: 'No LLM providers configured',
        recommendation: 'Run: embedeval auth login <provider>',
        details: 'Required: GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OLLAMA_HOST',
      });
    }
    
    // Check 4: Sample data
    const samplePaths = [
      path.join(__dirname, '../../../examples/v2/sample-traces.jsonl'),
      path.join(process.cwd(), 'examples/v2/sample-traces.jsonl'),
    ];
    
    let hasSampleData = false;
    for (const samplePath of samplePaths) {
      if (fs.existsSync(samplePath)) {
        hasSampleData = true;
        break;
      }
    }
    
    if (hasSampleData) {
      checks.push({
        name: 'Sample Data',
        status: 'pass',
        message: 'Sample traces available',
      });
    } else {
      checks.push({
        name: 'Sample Data',
        status: 'warn',
        message: 'No sample traces found',
        recommendation: 'Create sample data: embedeval generate init && embedeval generate create',
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
        checks,
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
    
    for (const check of checks) {
      const icon = check.status === 'pass' 
        ? chalk.green('✓') 
        : check.status === 'fail' 
          ? chalk.red('✗') 
          : chalk.yellow('⚠');
      
      console.log(`  ${icon} ${chalk.bold(check.name.padEnd(20))} ${check.message}`);
      
      if (check.details) {
        console.log(chalk.dim(`    ${check.details}`));
      }
      
      if (check.recommendation) {
        console.log(chalk.yellow(`    → ${check.recommendation}`));
      }
      
      if (check.status === 'fail') hasFailures = true;
      if (check.status === 'warn') warningCount++;
    }
    
    console.log();
    
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
    } else {
      console.log(chalk.red.bold(`❌ ${passed} passed, ${failed} failed, ${warnings} warning(s)\n`));
    }
    
    // Interactive fix mode
    if (options?.fix && hasFailures) {
      console.log(chalk.blue('💡 Running interactive setup...\n'));
      console.log(chalk.dim('Run: embedeval auth login to configure a provider\n'));
    }
    
    // Exit with error code if there are failures
    if (hasFailures) {
      process.exit(1);
    }
  });

export default doctorCommand;
