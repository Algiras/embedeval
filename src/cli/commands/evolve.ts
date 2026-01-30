/**
 * Evolution CLI Commands
 * 
 * CLI interface for running genetic algorithm evolution
 * to find optimal embedding strategies.
 * 
 * @module cli/commands/evolve
 */

import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import {
  EvolutionConfig,
  StrategyGenome,
  AgentResponse,
} from '../../core/types';
import { runEvolution } from '../../evolution/evolution-engine';
import { startEvolutionScheduler } from '../../evolution/scheduler';
import { genomeToStrategy } from '../../evolution/strategy-genome';

/** CLI Options interface */
interface EvolveRunOptions {
  queries: string;
  corpus: string;
  population?: string;
  generations?: string;
  mutation?: string;
  provider?: string;
  model?: string;
  baseline?: string;
  deployThreshold?: string;
  output?: string;
  outputFormat?: string;
}

interface ScheduleOptions {
  queries: string;
  corpus: string;
  interval: string;
  continuous?: boolean;
  stopOnPlateau?: string;
  output?: string;
}

interface ShowOptions {
  output?: string;
  limit?: string;
}

interface CompareOptions {
  output?: string;
}

interface ExportOptions {
  output?: string;
  format?: string;
}

/**
 * Register evolution commands
 */
export function registerEvolveCommand(program: Command): void {
  const evolve = program
    .command('evolve')
    .description('Evolve embedding strategies using genetic algorithms');

  // ============================================================================
  // evolve run - Run a single evolution cycle
  // ============================================================================
  evolve
    .command('run')
    .description('Run evolution to find optimal strategy')
    .requiredOption('-c, --corpus <path>', 'Corpus file path (JSONL)')
    .requiredOption('-q, --queries <path>', 'Queries file path (JSONL)')
    .option('--provider <type>', 'Provider type (ollama, openai, google, huggingface)', 'ollama')
    .option('--model <name>', 'Model name', 'nomic-embed-text')
    .option('--population <n>', 'Population size', '20')
    .option('--generations <n>', 'Number of generations', '10')
    .option('--mutation-rate <rate>', 'Mutation rate (0-1)', '0.2')
    .option('--fitness-metric <metric>', 'Primary fitness metric', 'ndcg10')
    .option('--seed-strategies <strategies>', 'Comma-separated seed strategies', 'baseline,hybrid-bm25')
    .option('--auto-deploy', 'Auto-deploy best strategy', false)
    .option('--deploy-threshold <threshold>', 'Minimum fitness to deploy', '0.8')
    .option('--output <path>', 'Output path for results', '.embedeval/evolution')
    .option('--output-format <format>', 'Output format (json, summary)', 'summary')
    .action(async (options: EvolveRunOptions) => {
      const spinner = ora('Starting evolution...').start();
      const startTime = Date.now();

      try {
        // Build provider config
        const providerConfig = {
          type: options.provider,
          model: options.model,
          baseUrl: options.provider === 'ollama' ? 'http://localhost:11434' : undefined,
          apiKey: options.provider === 'openai' ? process.env.OPENAI_API_KEY :
                  options.provider === 'google' ? process.env.GEMINI_API_KEY :
                  process.env.HUGGINGFACE_API_KEY,
        } as any;

        // Build evolution config
        const evolutionConfig: Partial<EvolutionConfig> = {
          populationSize: parseInt(options.population),
          generations: parseInt(options.generations),
          mutationRate: parseFloat(options.mutationRate),
          fitnessMetric: options.fitnessMetric,
          autoDeployEnabled: options.autoDeploy,
          autoDeployThreshold: parseFloat(options.deployThreshold),
        };

        const seedStrategies = options.seedStrategies.split(',').map((s: string) => s.trim());

        spinner.text = `Evolving with population=${evolutionConfig.populationSize}, generations=${evolutionConfig.generations}`;

        // Run evolution
        const result = await runEvolution({
          provider: providerConfig,
          corpusPath: options.corpus,
          queriesPath: options.queries,
          config: evolutionConfig,
          seedStrategies,
          onProgress: (gen, best) => {
            spinner.text = `Generation ${gen}/${evolutionConfig.generations}: Best fitness = ${best.fitness?.toFixed(4) || 'N/A'} (${best.name})`;
          },
        });

        spinner.succeed('Evolution completed!');

        // Save results
        const outputPath = path.resolve(options.output);
        await fs.ensureDir(outputPath);
        
        await fs.writeJson(
          path.join(outputPath, `evolution-${result.evolutionId}.json`),
          result,
          { spaces: 2 }
        );

        // Display results
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        if (options.outputFormat === 'json') {
          const response: AgentResponse = {
            status: 'success',
            data: result,
            summary: `Evolution completed in ${duration}s`,
            interpretation: `Best genome: ${result.bestGenome.name} (fitness: ${result.bestGenome.fitness?.toFixed(4)})`,
            recommendations: [
              `Improvement over baseline: ${(result.improvementOverBaseline * 100).toFixed(1)}%`,
              result.deployed ? 'Strategy deployed automatically' : 'Use --auto-deploy to deploy best strategy',
            ],
            metadata: {
              duration: Date.now() - startTime,
              timestamp: new Date().toISOString(),
              version: '1.0.0',
            },
          };
          console.log(JSON.stringify(response, null, 2));
        } else {
          console.log('\n' + chalk.bold('=== Evolution Results ===\n'));
          console.log(chalk.cyan('Evolution ID:'), result.evolutionId);
          console.log(chalk.cyan('Duration:'), `${duration}s`);
          console.log(chalk.cyan('Total evaluations:'), result.totalEvaluations);
          
          console.log('\n' + chalk.bold('Best Genome:'));
          console.log(chalk.green('  Name:'), result.bestGenome.name);
          console.log(chalk.green('  Fitness:'), result.bestGenome.fitness?.toFixed(4));
          console.log(chalk.green('  Generation:'), result.bestGenome.generation);
          
          console.log('\n' + chalk.bold('Genes:'));
          const genes = result.bestGenome.genes;
          console.log('  Chunking:', genes.chunkingMethod, genes.chunkSize ? `(${genes.chunkSize})` : '');
          console.log('  Retrieval:', genes.retrievalMethod, `(k=${genes.retrievalK})`);
          if (genes.hybridAlpha !== undefined) {
            console.log('  Hybrid alpha:', genes.hybridAlpha.toFixed(2));
          }
          console.log('  Reranking:', genes.rerankingMethod);
          
          console.log('\n' + chalk.bold('Improvement:'));
          console.log(chalk.yellow(`  ${(result.improvementOverBaseline * 100).toFixed(1)}%`), 'over baseline');
          
          console.log('\n' + chalk.bold('Generation Progress:'));
          for (const gen of result.generations.slice(-5)) {
            const bar = '█'.repeat(Math.round(gen.bestFitness * 20));
            const empty = '░'.repeat(20 - Math.round(gen.bestFitness * 20));
            console.log(`  Gen ${gen.generation.toString().padStart(2)}: ${bar}${empty} ${gen.bestFitness.toFixed(4)} (avg: ${gen.avgFitness.toFixed(4)})`);
          }
          
          if (result.deployed) {
            console.log('\n' + chalk.green.bold('✓ Strategy deployed automatically'));
          }
          
          console.log('\n' + chalk.gray(`Results saved to: ${outputPath}`));
        }

      } catch (error) {
        spinner.fail('Evolution failed');
        logger.error('Evolution failed:', error);
        
        if (options.outputFormat === 'json') {
          const response: AgentResponse = {
            status: 'error',
            summary: 'Evolution failed',
            error: {
              code: 'EVOLUTION_FAILED',
              message: error instanceof Error ? error.message : String(error),
              suggestion: 'Check provider configuration and data files',
            },
            metadata: {
              duration: Date.now() - startTime,
              timestamp: new Date().toISOString(),
              version: '1.0.0',
            },
          };
          console.log(JSON.stringify(response, null, 2));
        }
        
        process.exit(1);
      }
    });

  // ============================================================================
  // evolve schedule - Start scheduled evolution
  // ============================================================================
  evolve
    .command('schedule')
    .description('Start scheduled evolution cycles')
    .requiredOption('-c, --corpus <path>', 'Corpus file path (JSONL)')
    .requiredOption('-q, --queries <path>', 'Queries file path (JSONL)')
    .option('--provider <type>', 'Provider type', 'ollama')
    .option('--model <name>', 'Model name', 'nomic-embed-text')
    .option('--cron <expression>', 'Cron schedule (e.g., "0 0 * * 0" for weekly)', '0 0 * * 0')
    .option('--run-now', 'Run immediately before scheduling', false)
    .option('--auto-deploy', 'Auto-deploy improvements', false)
    .option('--output <path>', 'Output path', '.embedeval/evolution')
    .action(async (options: ScheduleOptions & { provider?: string; model?: string; cron?: string; runNow?: boolean; autoDeploy?: boolean }) => {
      console.log(chalk.bold('Starting Evolution Scheduler...\n'));

      try {
        const providerConfig = {
          type: options.provider || 'ollama',
          model: options.model || 'nomic-embed-text',
          baseUrl: options.provider === 'ollama' ? 'http://localhost:11434' : undefined,
          apiKey: options.provider === 'openai' ? process.env.OPENAI_API_KEY :
                  options.provider === 'google' ? process.env.GEMINI_API_KEY :
                  undefined,
        };

        const scheduler = await startEvolutionScheduler({
          corpusPath: options.corpus,
          queriesPath: options.queries,
          provider: providerConfig,
          schedule: options.cron,
          runImmediately: options.runNow,
          autoDeployEnabled: options.autoDeploy,
          basePath: options.output,
        });

        console.log(chalk.green('✓ Scheduler started'));
        console.log(chalk.cyan('Schedule:'), options.cron);
        console.log(chalk.cyan('Auto-deploy:'), options.autoDeploy ? 'enabled' : 'disabled');
        
        if (options.runNow) {
          console.log(chalk.yellow('\nRunning immediate evolution cycle...'));
        }

        // Keep process running
        console.log(chalk.gray('\nPress Ctrl+C to stop scheduler'));
        
        process.on('SIGINT', async () => {
          console.log('\n' + chalk.yellow('Stopping scheduler...'));
          await scheduler.stop();
          process.exit(0);
        });

      } catch (error) {
        logger.error('Failed to start scheduler:', error);
        process.exit(1);
      }
    });

  // ============================================================================
  // evolve show - Show evolution results
  // ============================================================================
  evolve
    .command('show')
    .description('Show evolution results')
    .option('--latest', 'Show latest evolution result', true)
    .option('--id <id>', 'Show specific evolution by ID')
    .option('--deployed', 'Show currently deployed strategy')
    .option('--history', 'Show evolution history')
    .option('--path <path>', 'Evolution data path', '.embedeval/evolution')
    .action(async (options: { latest?: boolean; id?: string; deployed?: boolean; history?: boolean; path?: string }) => {
      try {
        const basePath = path.resolve(options.path || '.embedeval/evolution');

        if (options.deployed) {
          const deploymentPath = path.join(basePath, 'current-deployment.json');
          
          if (!await fs.pathExists(deploymentPath)) {
            console.log(chalk.yellow('No deployment found'));
            return;
          }

          const deployment = await fs.readJson(deploymentPath);
          console.log(chalk.bold('\n=== Deployed Strategy ===\n'));
          console.log(chalk.cyan('Name:'), deployment.genome.name);
          console.log(chalk.cyan('Fitness:'), deployment.genome.fitness?.toFixed(4));
          console.log(chalk.cyan('Deployed at:'), deployment.deployedAt);
          console.log(chalk.cyan('\nGenes:'));
          console.log(JSON.stringify(deployment.genome.genes, null, 2));
          return;
        }

        if (options.history) {
          const statePath = path.join(basePath, 'scheduler-state.json');
          
          if (!await fs.pathExists(statePath)) {
            console.log(chalk.yellow('No history found'));
            return;
          }

          const state = await fs.readJson(statePath);
          console.log(chalk.bold('\n=== Evolution History ===\n'));
          
          for (const run of state.history.slice(-10).reverse()) {
            const status = run.deployed ? chalk.green('deployed') : chalk.gray('not deployed');
            console.log(`${run.timestamp} | fitness: ${run.bestFitness.toFixed(4)} | ${status}`);
          }
          return;
        }

        // Show latest or specific result
        const evolutionFiles = await fs.readdir(basePath)
          .catch(() => [] as string[])
          .then((files: string[]) => files.filter((f: string) => f.startsWith('evolution-') && f.endsWith('.json')));

        if (evolutionFiles.length === 0) {
          console.log(chalk.yellow('No evolution results found'));
          return;
        }

        const targetFile = options.id
          ? `evolution-${options.id}.json`
          : evolutionFiles.sort().reverse()[0];

        const resultPath = path.join(basePath, targetFile);
        
        if (!await fs.pathExists(resultPath)) {
          console.log(chalk.yellow(`Evolution result not found: ${targetFile}`));
          return;
        }

        const result = await fs.readJson(resultPath);
        
        console.log(chalk.bold('\n=== Evolution Result ===\n'));
        console.log(chalk.cyan('Evolution ID:'), result.evolutionId);
        console.log(chalk.cyan('Timestamp:'), result.timestamp);
        console.log(chalk.cyan('Generations:'), result.generations.length);
        console.log(chalk.cyan('Total evaluations:'), result.totalEvaluations);
        
        console.log(chalk.bold('\nBest Genome:'));
        console.log(chalk.green('  Name:'), result.bestGenome.name);
        console.log(chalk.green('  Fitness:'), result.bestGenome.fitness?.toFixed(4));
        console.log(chalk.green('  Improvement:'), `${(result.improvementOverBaseline * 100).toFixed(1)}%`);
        
        console.log(chalk.bold('\nStrategy Configuration:'));
        const strategy = genomeToStrategy(result.bestGenome);
        for (const stage of strategy.stages) {
          console.log(`  ${stage.type}: ${stage.name}`, stage.config ? JSON.stringify(stage.config) : '');
        }

      } catch (error) {
        logger.error('Failed to show results:', error);
        process.exit(1);
      }
    });

  // ============================================================================
  // evolve export - Export best strategy
  // ============================================================================
  evolve
    .command('export')
    .description('Export best evolved strategy as YAML config')
    .option('--id <id>', 'Evolution ID to export')
    .option('--path <path>', 'Evolution data path', '.embedeval/evolution')
    .option('--output <file>', 'Output YAML file', 'evolved-strategy.yaml')
    .action(async (options: { id?: string; path?: string; output?: string }) => {
      try {
        const basePath = path.resolve(options.path || '.embedeval/evolution');
        
        // Find evolution result
        const evolutionFiles = await fs.readdir(basePath)
          .catch(() => [] as string[])
          .then((files: string[]) => files.filter((f: string) => f.startsWith('evolution-') && f.endsWith('.json')));

        const targetFile = options.id
          ? `evolution-${options.id}.json`
          : evolutionFiles.sort().reverse()[0];

        if (!targetFile) {
          console.log(chalk.yellow('No evolution results found'));
          return;
        }

        const result = await fs.readJson(path.join(basePath, targetFile));
        const strategy = genomeToStrategy(result.bestGenome);

        // Convert to YAML-like config
        const config = {
          name: `Evolved Strategy: ${result.bestGenome.name}`,
          description: `Auto-evolved strategy with fitness ${result.bestGenome.fitness?.toFixed(4)}`,
          evolutionId: result.evolutionId,
          fitness: result.bestGenome.fitness,
          improvement: result.improvementOverBaseline,
          
          strategy: {
            name: strategy.name,
            stages: strategy.stages.map(s => ({
              type: s.type,
              name: s.name,
              config: s.config,
              enabled: s.enabled,
            })),
          },
          
          genes: result.bestGenome.genes,
        };

        // Write as JSON (YAML would need additional dependency)
        const outputPath = options.output.endsWith('.yaml') 
          ? options.output.replace('.yaml', '.json')
          : options.output;
        
        await fs.writeJson(outputPath, config, { spaces: 2 });
        
        console.log(chalk.green(`✓ Strategy exported to: ${outputPath}`));
        console.log(chalk.gray('\nUse with: embedeval ab-test --config ' + outputPath));

      } catch (error) {
        logger.error('Failed to export strategy:', error);
        process.exit(1);
      }
    });

  // ============================================================================
  // evolve rollback - Rollback to previous strategy
  // ============================================================================
  evolve
    .command('rollback')
    .description('Rollback to previously deployed strategy')
    .option('--path <path>', 'Evolution data path', '.embedeval/evolution')
    .action(async (options: { path?: string }) => {
      try {
        const basePath = path.resolve(options.path || '.embedeval/evolution');
        const deploymentPath = path.join(basePath, 'current-deployment.json');
        
        if (!await fs.pathExists(deploymentPath)) {
          console.log(chalk.yellow('No deployment found to rollback'));
          return;
        }

        const deployment = await fs.readJson(deploymentPath);
        
        if (!deployment.previousGenome) {
          console.log(chalk.yellow('No previous deployment to rollback to'));
          return;
        }

        console.log(chalk.yellow(`Rolling back from ${deployment.genome.name}...`));
        
        // Write previous genome as current
        await fs.writeJson(deploymentPath, {
          genome: deployment.previousGenome,
          previousGenome: null,
          deployedAt: new Date().toISOString(),
          rolledBackFrom: deployment.genome.name,
        });
        
        console.log(chalk.green(`✓ Rolled back to: ${deployment.previousGenome.name}`));

      } catch (error) {
        console.error('Rollback failed:', error);
        process.exit(1);
      }
    });
}
