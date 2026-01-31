/**
 * Auth CLI Commands - Manage provider authentication
 * 
 * Commands:
 * - auth login [provider] - Authenticate with a provider
 * - auth logout [provider] - Remove stored credentials
 * - auth status - Show authentication status
 * - auth check - Verify all API keys work
 * - auth list - List all configured providers
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  ProviderName,
  PROVIDERS,
  saveCredential,
  deleteCredential,
  listCredentials,
  getCredentialFromEnv,
  openRouterPKCEFlow,
  runManualFlow,
  promptForProvider,
  validateApiKey,
  HealthCheckResult,
} from '../../auth/index.js';
import { logger } from '../../utils/logger.js';

export const authCommand = new Command('auth')
  .description('Manage provider authentication')
  .addCommand(loginCommand())
  .addCommand(logoutCommand())
  .addCommand(statusCommand())
  .addCommand(checkCommand())
  .addCommand(listCommand());

/**
 * auth login [provider]
 */
function loginCommand(): Command {
  return new Command('login')
    .description('Authenticate with a provider')
    .argument('[provider]', 'Provider name (gemini, openai, openrouter, anthropic, ollama)')
    .option('--no-validate', 'Skip API key validation')
    .option('--with-token <token>', 'Provide token directly (for CI/CD)')
    .action(async (providerArg?: string, options?: { validate: boolean; withToken?: string }) => {
      try {
        let provider: ProviderName;

        if (providerArg) {
          // Validate provider name
          if (!PROVIDERS[providerArg as ProviderName]) {
            console.error(chalk.red(`Unknown provider: ${providerArg}`));
            console.log('Available providers:', Object.keys(PROVIDERS).join(', '));
            process.exit(1);
          }
          provider = providerArg as ProviderName;
        } else {
          // Interactive provider selection
          provider = await promptForProvider();
        }

        const config = PROVIDERS[provider];
        console.log(chalk.blue(`\n🔐 Authenticating with ${config.displayName}...\n`));

        let credential;

        // CI/CD mode: use provided token
        if (options?.withToken) {
          const now = new Date().toISOString();
          credential = {
            provider,
            apiKey: options.withToken,
            createdAt: now,
            updatedAt: now,
          };
          console.log('Using provided token...');
        }
        // OAuth flow for supported providers
        else if (provider === 'openrouter' && config.supportsOAuth) {
          console.log('Starting OAuth authentication...');
          credential = await openRouterPKCEFlow();
        }
        // Manual key entry
        else {
          credential = await runManualFlow({
            provider,
            validate: options?.validate !== false,
          });
        }

        // Save credential
        await saveCredential(credential);
        console.log(chalk.green(`\n✅ Successfully authenticated with ${config.displayName}`));
        console.log(chalk.dim(`   Credentials stored securely.`));

      } catch (err) {
        if (err instanceof Error) {
          logger.error('Authentication failed:', err.message);
        }
        process.exit(1);
      }
    });
}

/**
 * auth logout [provider]
 */
function logoutCommand(): Command {
  return new Command('logout')
    .description('Remove stored credentials')
    .argument('[provider]', 'Provider name (or "all" to remove all)')
    .action(async (providerArg?: string) => {
      try {
        if (providerArg === 'all') {
          const creds = await listCredentials();
          for (const cred of creds) {
            await deleteCredential(cred.provider);
          }
          console.log(chalk.green('✅ Removed all stored credentials'));
          return;
        }

        if (providerArg) {
          if (!PROVIDERS[providerArg as ProviderName]) {
            console.error(chalk.red(`Unknown provider: ${providerArg}`));
            process.exit(1);
          }
          await deleteCredential(providerArg as ProviderName);
          console.log(chalk.green(`✅ Removed credentials for ${providerArg}`));
        } else {
          // Interactive selection
          const provider = await promptForProvider();
          await deleteCredential(provider);
          console.log(chalk.green(`✅ Removed credentials for ${provider}`));
        }
      } catch (err) {
        logger.error('Logout failed:', err);
        process.exit(1);
      }
    });
}

/**
 * auth status
 */
function statusCommand(): Command {
  return new Command('status')
    .description('Show authentication status for all providers')
    .action(async () => {
      console.log(chalk.blue('\n🔐 Authentication Status\n'));

      const stored = await listCredentials();
      const storedMap = new Map(stored.map(c => [c.provider, c]));

      for (const provider of Object.values(PROVIDERS)) {
        const cred = storedMap.get(provider.name);
        const envCred = getCredentialFromEnv(provider.name);
        
        let status: string;
        let source: string = '';
        let details: string = '';

        if (cred) {
          status = chalk.green('✓ Authenticated');
          source = chalk.dim('(stored)');
          const keyPreview = cred.apiKey.slice(0, 4) + '...' + cred.apiKey.slice(-4);
          details = chalk.dim(`Key: ${keyPreview}`);
          
          if (cred.expiresAt) {
            const expires = new Date(cred.expiresAt);
            if (expires < new Date()) {
              status = chalk.yellow('⚠ Expired');
            } else {
              details += chalk.dim(` | Expires: ${expires.toLocaleDateString()}`);
            }
          }
        } else if (envCred) {
          status = chalk.green('✓ Authenticated');
          source = chalk.dim('(env var)');
          const keyPreview = envCred.apiKey.slice(0, 4) + '...' + envCred.apiKey.slice(-4);
          details = chalk.dim(`${provider.envVar}=${keyPreview}`);
        } else {
          status = chalk.dim('○ Not configured');
        }

        console.log(`  ${provider.displayName.padEnd(20)} ${status} ${source}`);
        if (details) {
          console.log(`  ${''.padEnd(20)} ${details}`);
        }
      }

      console.log(chalk.dim('\n  Run `embedeval auth login <provider>` to authenticate\n'));
    });
}

/**
 * auth check - Verify all API keys work
 */
function checkCommand(): Command {
  return new Command('check')
    .description('Verify all configured API keys work')
    .argument('[provider]', 'Provider name (or check all if omitted)')
    .option('--json', 'Output as JSON')
    .action(async (providerArg?: string, options?: { json?: boolean }) => {
      const results: HealthCheckResult[] = [];
      
      // Determine which providers to check
      let providersToCheck: ProviderName[];
      
      if (providerArg) {
        if (!PROVIDERS[providerArg as ProviderName]) {
          console.error(chalk.red(`Unknown provider: ${providerArg}`));
          process.exit(1);
        }
        providersToCheck = [providerArg as ProviderName];
      } else {
        providersToCheck = Object.keys(PROVIDERS) as ProviderName[];
      }

      if (!options?.json) {
        console.log(chalk.blue('\n🏥 Health Check - Verifying API Keys\n'));
      }

      // Get all credentials
      const stored = await listCredentials();
      const storedMap = new Map(stored.map(c => [c.provider, c]));

      for (const providerName of providersToCheck) {
        const provider = PROVIDERS[providerName];
        const cred = storedMap.get(providerName);
        const envCred = getCredentialFromEnv(providerName);
        const apiKey = cred?.apiKey || envCred?.apiKey;

        if (!apiKey) {
          if (!options?.json) {
            console.log(`  ${provider.displayName.padEnd(20)} ${chalk.dim('○ Not configured')}`);
          }
          results.push({
            provider: providerName,
            healthy: false,
            error: 'Not configured',
          });
          continue;
        }

        if (!options?.json) {
          process.stdout.write(`  ${provider.displayName.padEnd(20)} `);
        }

        // Run health check
        const result = await validateApiKey(providerName, apiKey);
        results.push(result);

        if (!options?.json) {
          if (result.healthy) {
            let details = chalk.green('✓ Healthy');
            if (result.latency) {
              details += chalk.dim(` (${result.latency}ms)`);
            }
            if (result.details?.models) {
              details += chalk.dim(` · ${result.details.models} models`);
            }
            if (result.details?.quota) {
              details += chalk.dim(` · ${result.details.quota}`);
            }
            console.log(details);
          } else {
            console.log(chalk.red(`✗ Failed`) + chalk.dim(` - ${result.error}`));
          }
        }
      }

      if (options?.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      // Summary
      const healthy = results.filter(r => r.healthy).length;
      const configured = results.filter(r => r.error !== 'Not configured').length;
      const failed = configured - healthy;

      console.log();
      if (failed === 0 && configured > 0) {
        console.log(chalk.green(`  ✅ All ${configured} configured provider(s) healthy\n`));
      } else if (failed > 0) {
        console.log(chalk.yellow(`  ⚠️  ${failed} of ${configured} provider(s) failed health check\n`));
        process.exit(1);
      } else {
        console.log(chalk.dim(`  No providers configured. Run \`embedeval auth login\` to add one.\n`));
      }
    });
}

/**
 * auth list
 */
function listCommand(): Command {
  return new Command('list')
    .description('List all available providers')
    .option('--json', 'Output as JSON')
    .action(async (options?: { json?: boolean }) => {
      if (options?.json) {
        console.log(JSON.stringify(Object.values(PROVIDERS), null, 2));
        return;
      }

      console.log(chalk.blue('\n📋 Available Providers\n'));

      for (const provider of Object.values(PROVIDERS)) {
        console.log(`  ${chalk.bold(provider.displayName)}`);
        console.log(`    Name:      ${provider.name}`);
        console.log(`    Env Var:   ${provider.envVar}`);
        console.log(`    Docs:      ${chalk.underline(provider.docsUrl)}`);
        console.log(`    OAuth:     ${provider.supportsOAuth ? '✓' : '✗'}`);
        console.log();
      }
    });
}

export default authCommand;
