/**
 * Configuration loader and validator
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { EvalConfig, ABTestConfig } from '../core/types';
import { logger } from './logger';

/**
 * Load configuration from YAML or JSON file
 */
export async function loadConfig(configPath: string): Promise<EvalConfig> {
  if (!await fs.pathExists(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = await fs.readFile(configPath, 'utf-8');
  const ext = path.extname(configPath).toLowerCase();

  let config: EvalConfig;
  if (ext === '.yaml' || ext === '.yml') {
    config = yaml.parse(content);
  } else if (ext === '.json') {
    config = JSON.parse(content);
  } else {
    throw new Error(`Unsupported config format: ${ext}. Use .yaml, .yml, or .json`);
  }

  // Validate and set defaults
  return validateConfig(config);
}

/**
 * Validate configuration and set defaults
 */
function validateConfig(config: any): EvalConfig {
  // Ensure required fields
  if (!config.providers || config.providers.length === 0) {
    throw new Error('Configuration must include at least one provider');
  }

  if (!config.dataset) {
    throw new Error('Configuration must include dataset path');
  }

  // Set defaults
  return {
    providers: config.providers,
    strategies: config.strategies || [{ name: 'baseline', pipeline: ['embed', 'retrieve'] }],
    metrics: config.metrics || ['ndcg@10', 'recall@10', 'mrr@10'],
    dataset: config.dataset,
    corpus: config.corpus,
    output: config.output || {},
    gates: config.gates,
    humanEval: config.humanEval,
    cache: config.cache || {
      maxSizeGB: 10,
      checkpointInterval: 1,
    },
  };
}

/**
 * Convert EvalConfig to ABTestConfig
 */
export function toABTestConfig(
  config: EvalConfig,
  name: string = 'A/B Test',
  variants?: any[]
): ABTestConfig {
  return {
    id: generateTestId(),
    name,
    variants: variants || config.providers.map((provider, index) => ({
      id: `variant-${index}`,
      name: `${provider.type}-${provider.model}`,
      provider,
      strategy: config.strategies[0]?.name || 'baseline',
    })),
    dataset: config.dataset,
    corpus: config.corpus,
    metrics: config.metrics,
    gates: config.gates,
    output: config.output,
  };
}

/**
 * Generate unique test ID
 */
function generateTestId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Load dataset from JSONL file
 */
export async function loadDataset(datasetPath: string): Promise<any[]> {
  if (!await fs.pathExists(datasetPath)) {
    throw new Error(`Dataset file not found: ${datasetPath}`);
  }

  const content = await fs.readFile(datasetPath, 'utf-8');
  const lines = content.trim().split('\n');
  
  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      logger.warn(`Failed to parse line: ${line.substring(0, 100)}...`);
      return null;
    }
  }).filter(Boolean);
}

/**
 * Load corpus from JSONL file
 */
export async function loadCorpus(corpusPath: string): Promise<any[]> {
  return loadDataset(corpusPath);
}
