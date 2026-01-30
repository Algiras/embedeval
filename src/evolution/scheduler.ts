/**
 * Evolution Scheduler - Automated Evolution Cycles
 * 
 * Schedules and manages automated evolution runs:
 * - Cron-based scheduling
 * - Continuous improvement loops
 * - Drift detection and reoptimization
 * - Auto-deployment with rollback
 * 
 * @module evolution/scheduler
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  EvolutionConfig,
  EvolutionResult,
  StrategyGenome,
  ProviderConfig,
} from '../core/types';
import { EvolutionEngine, runEvolution } from './evolution-engine';
import { KnowledgeBase } from './knowledge-base';
import { HypothesisEngine } from '../research/hypothesis-engine';
import { logger } from '../utils/logger';

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  // Data sources
  corpusPath: string;
  queriesPath: string;
  
  // Provider
  provider: ProviderConfig;
  
  // Schedule
  schedule?: string;  // Cron expression (e.g., "0 0 * * 0" for weekly)
  runImmediately?: boolean;
  maxConcurrentRuns?: number;
  
  // Evolution settings
  evolutionConfig?: Partial<EvolutionConfig>;
  
  // Deployment settings
  autoDeployEnabled?: boolean;
  autoDeployThreshold?: number;
  canaryPercentage?: number;
  monitoringWindowHours?: number;
  rollbackOnRegression?: boolean;
  
  // Notifications
  webhooks?: {
    onStart?: string;
    onComplete?: string;
    onImprovement?: string;
    onRegression?: string;
    onError?: string;
  };
  
  // Storage
  basePath?: string;
}

/**
 * Scheduler state
 */
interface SchedulerState {
  isRunning: boolean;
  currentRunId?: string;
  lastRunAt?: string;
  lastRunResult?: EvolutionResult;
  deployedGenome?: StrategyGenome;
  deployedAt?: string;
  consecutiveRegressions: number;
  history: Array<{
    runId: string;
    timestamp: string;
    bestFitness: number;
    deployed: boolean;
  }>;
}

/**
 * Evolution Scheduler
 */
export class EvolutionScheduler {
  private config: SchedulerConfig;
  private state: SchedulerState;
  private kb: KnowledgeBase;
  private hypothesisEngine: HypothesisEngine;
  private scheduledTask?: NodeJS.Timeout;
  private basePath: string;
  private stateFile: string;

  constructor(config: SchedulerConfig) {
    this.config = config;
    this.basePath = config.basePath || '.embedeval/evolution';
    this.stateFile = path.join(this.basePath, 'scheduler-state.json');
    this.kb = new KnowledgeBase(path.join(this.basePath, 'knowledge'));
    this.hypothesisEngine = new HypothesisEngine(this.kb);
    this.state = this.loadState();
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    logger.info('Starting Evolution Scheduler...');
    
    await fs.ensureDir(this.basePath);
    await this.kb.initialize();

    if (this.config.runImmediately) {
      logger.info('Running immediate evolution cycle...');
      await this.runEvolutionCycle();
    }

    if (this.config.schedule) {
      this.scheduleNextRun();
    }

    logger.info('Evolution Scheduler started');
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    logger.info('Stopping Evolution Scheduler...');
    
    if (this.scheduledTask) {
      clearTimeout(this.scheduledTask);
      this.scheduledTask = undefined;
    }
    
    await this.saveState();
    await this.kb.close();
    
    logger.info('Evolution Scheduler stopped');
  }

  /**
   * Run a single evolution cycle
   */
  async runEvolutionCycle(): Promise<EvolutionResult | null> {
    if (this.state.isRunning) {
      logger.warn('Evolution cycle already running, skipping');
      return null;
    }

    const runId = uuidv4();
    this.state.isRunning = true;
    this.state.currentRunId = runId;
    await this.saveState();

    logger.info(`\n========================================`);
    logger.info(`Starting Evolution Cycle: ${runId}`);
    logger.info(`========================================\n`);

    await this.notifyWebhook('onStart', { runId });

    try {
      // 1. Check if we need to evolve (detect drift)
      const shouldEvolve = await this.checkShouldEvolve();
      if (!shouldEvolve) {
        logger.info('No evolution needed (no drift detected)');
        this.state.isRunning = false;
        this.state.currentRunId = undefined;
        return null;
      }

      // 2. Generate hypotheses to seed evolution
      const hypotheses = await this.hypothesisEngine.generateHypotheses({
        currentStrategy: this.state.deployedGenome?.name || 'baseline',
        maxHypotheses: 3,
      });
      
      const seedStrategies = [
        'baseline',
        ...hypotheses.map(h => h.challengerStrategy as string).filter(Boolean),
      ];

      // 3. Run evolution
      const result = await runEvolution({
        provider: this.config.provider,
        corpusPath: this.config.corpusPath,
        queriesPath: this.config.queriesPath,
        config: {
          ...this.config.evolutionConfig,
          autoDeployEnabled: false,  // We handle deployment
        },
        seedStrategies,
        onProgress: (gen, best) => {
          logger.info(`Generation ${gen}: Best fitness = ${best.fitness?.toFixed(4)}`);
        },
      });

      // 4. Compare with current deployed
      const improved = await this.checkImprovement(result);

      // 5. Deploy if improved
      if (improved && this.config.autoDeployEnabled) {
        await this.deployWithCanary(result.bestGenome);
      }

      // 6. Update state
      this.state.lastRunAt = new Date().toISOString();
      this.state.lastRunResult = result;
      this.state.history.push({
        runId,
        timestamp: new Date().toISOString(),
        bestFitness: result.bestGenome.fitness || 0,
        deployed: improved && this.config.autoDeployEnabled === true,
      });

      // Keep only last 50 runs in history
      if (this.state.history.length > 50) {
        this.state.history = this.state.history.slice(-50);
      }

      await this.notifyWebhook('onComplete', { runId, result, improved });
      if (improved) {
        await this.notifyWebhook('onImprovement', { 
          runId, 
          improvement: result.improvementOverBaseline,
          bestGenome: result.bestGenome,
        });
      }

      logger.info(`\nEvolution cycle ${runId} completed`);
      logger.info(`Best fitness: ${result.bestGenome.fitness?.toFixed(4)}`);
      logger.info(`Improvement: ${(result.improvementOverBaseline * 100).toFixed(1)}%`);
      logger.info(`Deployed: ${improved && this.config.autoDeployEnabled}`);

      return result;

    } catch (error) {
      logger.error('Evolution cycle failed:', error);
      await this.notifyWebhook('onError', { 
        runId, 
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      this.state.isRunning = false;
      this.state.currentRunId = undefined;
      await this.saveState();
      
      // Schedule next run
      if (this.config.schedule) {
        this.scheduleNextRun();
      }
    }
  }

  /**
   * Check if evolution should run (drift detection)
   */
  private async checkShouldEvolve(): Promise<boolean> {
    // Always evolve if no previous deployment
    if (!this.state.deployedGenome) {
      logger.info('No deployed genome, evolution needed');
      return true;
    }

    // Check time since last run
    if (this.state.lastRunAt) {
      const hoursSinceLastRun = (Date.now() - new Date(this.state.lastRunAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRun < 24) {
        logger.info(`Only ${hoursSinceLastRun.toFixed(1)} hours since last run, skipping`);
        return false;
      }
    }

    // TODO: Implement actual drift detection by re-evaluating deployed strategy
    // For now, always evolve if scheduled
    return true;
  }

  /**
   * Check if new result is an improvement
   */
  private async checkImprovement(result: EvolutionResult): Promise<boolean> {
    if (!this.state.deployedGenome?.fitness) {
      return true;  // No baseline to compare
    }

    const threshold = this.config.autoDeployThreshold || 0.03;  // 3% improvement
    const improvement = (result.bestGenome.fitness! - this.state.deployedGenome.fitness) / 
                       this.state.deployedGenome.fitness;

    if (improvement >= threshold) {
      logger.info(`Improvement detected: ${(improvement * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`);
      this.state.consecutiveRegressions = 0;
      return true;
    }

    if (improvement < -0.01) {  // 1% regression
      this.state.consecutiveRegressions++;
      logger.warn(`Regression detected: ${(improvement * 100).toFixed(1)}% (consecutive: ${this.state.consecutiveRegressions})`);
      await this.notifyWebhook('onRegression', { improvement });
    }

    return false;
  }

  /**
   * Deploy with canary strategy
   */
  private async deployWithCanary(genome: StrategyGenome): Promise<void> {
    logger.info(`Deploying genome: ${genome.name}`);

    // Save deployment info
    const deploymentPath = path.join(this.basePath, 'deployments');
    await fs.ensureDir(deploymentPath);

    const deployment = {
      genome,
      deployedAt: new Date().toISOString(),
      previousGenome: this.state.deployedGenome,
      canaryPercentage: this.config.canaryPercentage || 100,
    };

    await fs.writeJson(
      path.join(deploymentPath, `deployment-${Date.now()}.json`),
      deployment,
      { spaces: 2 }
    );

    // Update current deployment
    await fs.writeJson(
      path.join(this.basePath, 'current-deployment.json'),
      deployment,
      { spaces: 2 }
    );

    this.state.deployedGenome = genome;
    this.state.deployedAt = new Date().toISOString();

    logger.info(`Deployed: ${genome.name} (fitness: ${genome.fitness?.toFixed(4)})`);
  }

  /**
   * Rollback to previous deployment
   */
  async rollback(): Promise<boolean> {
    const currentPath = path.join(this.basePath, 'current-deployment.json');
    
    if (!await fs.pathExists(currentPath)) {
      logger.warn('No current deployment to rollback');
      return false;
    }

    const current = await fs.readJson(currentPath);
    
    if (!current.previousGenome) {
      logger.warn('No previous genome to rollback to');
      return false;
    }

    logger.info(`Rolling back from ${current.genome.name} to ${current.previousGenome.name}`);

    this.state.deployedGenome = current.previousGenome;
    this.state.deployedAt = new Date().toISOString();

    await fs.writeJson(currentPath, {
      genome: current.previousGenome,
      deployedAt: new Date().toISOString(),
      previousGenome: null,
      rolledBackFrom: current.genome,
    }, { spaces: 2 });

    await this.saveState();

    return true;
  }

  /**
   * Schedule next run based on cron expression
   */
  private scheduleNextRun(): void {
    // Simple scheduling - run after fixed interval
    // TODO: Implement proper cron parsing
    const interval = this.parseCronToMs(this.config.schedule || '0 0 * * 0');
    
    logger.info(`Scheduling next run in ${(interval / (1000 * 60 * 60)).toFixed(1)} hours`);
    
    this.scheduledTask = setTimeout(() => {
      this.runEvolutionCycle().catch(err => 
        logger.error('Scheduled evolution cycle failed:', err)
      );
    }, interval);
  }

  /**
   * Parse cron to milliseconds (simplified)
   */
  private parseCronToMs(cron: string): number {
    // Simple parsing for common patterns
    const parts = cron.split(' ');
    
    // "0 0 * * 0" = weekly (Sunday midnight)
    if (parts[4] === '0' || parts[4] === '7') {
      return 7 * 24 * 60 * 60 * 1000;  // 1 week
    }
    
    // "0 0 * * *" = daily
    if (parts[2] === '*' && parts[3] === '*') {
      return 24 * 60 * 60 * 1000;  // 1 day
    }
    
    // Default to weekly
    return 7 * 24 * 60 * 60 * 1000;
  }

  /**
   * Send webhook notification
   */
  private async notifyWebhook(event: keyof SchedulerConfig['webhooks'], data: any): Promise<void> {
    const url = this.config.webhooks?.[event];
    if (!url) return;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          timestamp: new Date().toISOString(),
          ...data,
        }),
      });

      if (!response.ok) {
        logger.warn(`Webhook ${event} failed: ${response.status}`);
      }
    } catch (error) {
      logger.warn(`Webhook ${event} error:`, error);
    }
  }

  /**
   * Load scheduler state
   */
  private loadState(): SchedulerState {
    try {
      if (fs.existsSync(this.stateFile)) {
        return fs.readJsonSync(this.stateFile);
      }
    } catch (error) {
      logger.warn('Failed to load scheduler state, using default');
    }

    return {
      isRunning: false,
      consecutiveRegressions: 0,
      history: [],
    };
  }

  /**
   * Save scheduler state
   */
  private async saveState(): Promise<void> {
    await fs.ensureDir(path.dirname(this.stateFile));
    await fs.writeJson(this.stateFile, this.state, { spaces: 2 });
  }

  /**
   * Get current state
   */
  getState(): SchedulerState {
    return { ...this.state };
  }

  /**
   * Get deployed genome
   */
  getDeployedGenome(): StrategyGenome | undefined {
    return this.state.deployedGenome;
  }
}

/**
 * Create and start evolution scheduler
 */
export async function startEvolutionScheduler(config: SchedulerConfig): Promise<EvolutionScheduler> {
  const scheduler = new EvolutionScheduler(config);
  await scheduler.start();
  return scheduler;
}
