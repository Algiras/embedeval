/**
 * Generate Command
 * Synthetic data generation for traces
 * - init: Create dimensions.yaml template
 * - create: Generate synthetic traces using dimensions
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { v4 as uuidv4 } from 'uuid';
import { Trace, TraceMetadata } from '../../core/types';
import { TraceStore } from '../../core/storage';

const DEFAULT_DIMENSIONS_TEMPLATE = `# Synthetic Data Dimensions
# Define dimensions to generate varied synthetic traces

dimensions:
  query_length:
    - short    # < 50 tokens
    - medium   # 50-200 tokens
    - long     # > 200 tokens

  complexity:
    - simple
    - moderate
    - complex

  domain:
    - general
    - technical
    - creative
    - analytical

  context_required:
    - none
    - minimal
    - extensive

# Constraints
constraints:
  min_query_length: 10
  max_query_length: 1000
  max_response_length: 2000

# Output settings
output:
  format: jsonl
  include_metadata: true
`;

interface InitOptions {
  output?: string;
}

interface CreateOptions {
  dimensions: string;
  count: number;
  output: string;
  provider?: string;
  model?: string;
}

interface DimensionConfig {
  dimensions: Record<string, string[]>;
  constraints?: {
    min_query_length?: number;
    max_query_length?: number;
    max_response_length?: number;
  };
  output?: {
    format?: string;
    include_metadata?: boolean;
  };
}

/**
 * Initialize dimensions.yaml template
 */
export async function initCommand(options: InitOptions): Promise<void> {
  console.log(chalk.blue.bold('📝 Creating dimensions template...\n'));

  const spinner = ora('Generating template').start();

  try {
    const outputPath = options.output || 'dimensions.yaml';

    // Check if file already exists
    if (await fs.pathExists(outputPath)) {
      spinner.fail(`File already exists: ${outputPath}`);
      console.log(chalk.yellow('Use --output to specify a different path'));
      process.exit(1);
    }

    // Write template
    await fs.writeFile(outputPath, DEFAULT_DIMENSIONS_TEMPLATE, 'utf-8');

    spinner.succeed(`Created dimensions template`);
    console.log(chalk.green(`\n✅ Template saved to: ${path.resolve(outputPath)}`));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  1. Edit the dimensions.yaml file'));
    console.log(chalk.gray('  2. Run: embedeval generate create --dimensions dimensions.yaml --count 100 --output synthetic.jsonl'));

  } catch (error) {
    spinner.fail('Failed to create template');
    console.error(chalk.red(error instanceof Error ? error.message : error));
    process.exit(1);
  }
}

/**
 * Create synthetic traces from dimensions
 */
export async function createCommand(options: CreateOptions): Promise<void> {
  console.log(chalk.blue.bold('🔨 Generating synthetic traces...\n'));

  const spinner = ora('Loading dimensions').start();

  try {
    // Load dimensions config
    if (!(await fs.pathExists(options.dimensions))) {
      spinner.fail(`Dimensions file not found: ${options.dimensions}`);
      process.exit(1);
    }

    // TODO: Parse YAML dimensions file
    // For now, use default dimensions
    const dimensions: DimensionConfig = {
      dimensions: {
        query_length: ['short', 'medium', 'long'],
        complexity: ['simple', 'moderate', 'complex'],
        domain: ['general', 'technical', 'creative', 'analytical'],
        context_required: ['none', 'minimal', 'extensive'],
      },
    };

    spinner.text = `Generating ${options.count} synthetic traces...`;

    // Generate synthetic traces
    const traces: Trace[] = [];
    const dimensionKeys = Object.keys(dimensions.dimensions);

    for (let i = 0; i < options.count; i++) {
      // Select random combination of dimensions
      const selectedDimensions: Record<string, string> = {};
      for (const key of dimensionKeys) {
        const values = dimensions.dimensions[key];
        selectedDimensions[key] = values[Math.floor(Math.random() * values.length)];
      }

      // Generate trace based on dimensions
      const trace = generateSyntheticTrace(i, selectedDimensions, options);
      traces.push(trace);

      spinner.text = `Generated trace ${i + 1}/${options.count}...`;
    }

    spinner.succeed(`Generated ${traces.length} synthetic traces`);

    // Save traces
    const store = new TraceStore(options.output);
    await store.appendMany(traces);

    console.log(chalk.green(`\n✅ Synthetic traces saved`));
    console.log(chalk.gray(`   Count: ${traces.length}`));
    console.log(chalk.gray(`   Output: ${path.resolve(options.output)}`));

    // Show sample
    if (traces.length > 0) {
      console.log(chalk.blue('\n📋 Sample trace:'));
      const sample = traces[0];
      console.log(`   ID: ${sample.id}`);
      console.log(`   Query: ${sample.query.substring(0, 80)}...`);
      console.log(`   Response: ${sample.response.substring(0, 80)}...`);
    }

  } catch (error) {
    spinner.fail('Failed to generate traces');
    console.error(chalk.red(error instanceof Error ? error.message : error));
    process.exit(1);
  }
}

/**
 * Generate a single synthetic trace
 */
function generateSyntheticTrace(
  index: number,
  dimensions: Record<string, string>,
  options: CreateOptions
): Trace {
  // TODO: Generate realistic synthetic content based on dimensions
  // This is a placeholder implementation

  const queryTemplates: Record<string, string[]> = {
    short: [
      'What is AI?',
      'Explain quantum computing',
      'Best programming languages?',
    ],
    medium: [
      'How does machine learning work and what are its main types?',
      'Compare different database types for web applications',
      'What are the benefits of microservices architecture?',
    ],
    long: [
      'I need a comprehensive overview of artificial intelligence including its history, current state, machine learning fundamentals, deep learning architectures, and future implications for society and industry',
      'Can you provide a detailed explanation of how modern web browsers work, including rendering engines, JavaScript execution, networking, and security models?',
    ],
  };

  const responseTemplates: Record<string, string[]> = {
    simple: [
      'AI is technology that enables machines to simulate human intelligence.',
      'Quantum computing uses quantum bits to perform calculations.',
    ],
    moderate: [
      'Machine learning is a subset of AI that uses algorithms to learn from data. It includes supervised learning, unsupervised learning, and reinforcement learning approaches.',
      'Web applications can use SQL databases for structured data or NoSQL for flexible schemas.',
    ],
    complex: [
      'Artificial intelligence encompasses multiple paradigms including symbolic AI, machine learning, and deep learning. Machine learning itself branches into supervised learning (trained on labeled data), unsupervised learning (finding patterns in unlabeled data), and reinforcement learning (learning through interaction with environments).',
    ],
  };

  // Select templates based on dimensions
  const queryLength = dimensions.query_length || 'medium';
  const complexity = dimensions.complexity || 'moderate';

  const queries = queryTemplates[queryLength] || queryTemplates.medium;
  const responses = responseTemplates[complexity] || responseTemplates.moderate;

  const query = queries[index % queries.length] + ` [${Object.values(dimensions).join(', ')}]`;
  const response = responses[index % responses.length];

  const metadata: TraceMetadata = {
    provider: options.provider || 'synthetic',
    model: options.model || 'generator-v1',
    latency: Math.floor(Math.random() * 500) + 100,
    tokens: {
      input: query.length / 4,
      output: response.length / 4,
    },
    cost: Math.random() * 0.01,
  };

  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    query,
    response,
    metadata,
  };
}
