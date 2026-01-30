/**
 * Collect Command
 * Import traces from JSONL files, APIs, or log files
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { v4 as uuidv4 } from 'uuid';
import { Trace, TraceMetadata } from '../../core/types';
import { TraceStore } from '../../core/storage';

interface CollectOptions {
  output: string;
  limit?: number;
  filter?: string;
}

export async function collectCommand(source: string, options: CollectOptions): Promise<void> {
  console.log(chalk.blue.bold('📥 Collecting traces...\n'));

  const spinner = ora('Reading source file').start();
  
  try {
    // Validate source exists
    if (!(await fs.pathExists(source))) {
      spinner.fail(`Source file not found: ${source}`);
      process.exit(1);
    }

    // Read source file
    const sourceContent = await fs.readFile(source, 'utf-8');
    const lines = sourceContent.split('\n').filter(line => line.trim());
    
    spinner.text = `Found ${lines.length} lines, processing...`;

    // Parse and transform traces
    const traces: Trace[] = [];
    let skipped = 0;

    for (let i = 0; i < lines.length; i++) {
      if (options.limit && traces.length >= options.limit) break;

      try {
        const rawData = JSON.parse(lines[i]);
        const trace = transformToTrace(rawData);
        
        // Apply filter if specified
        if (options.filter) {
          const filterLower = options.filter.toLowerCase();
          const matches = 
            trace.query.toLowerCase().includes(filterLower) ||
            trace.response.toLowerCase().includes(filterLower);
          if (!matches) {
            skipped++;
            continue;
          }
        }

        traces.push(trace);
      } catch (e) {
        skipped++;
        continue;
      }
    }

    spinner.succeed(`Processed ${lines.length} lines`);

    // Save traces
    const store = new TraceStore(options.output);
    await store.appendMany(traces);

    console.log(chalk.green(`\n✅ Collected ${traces.length} traces`));
    if (skipped > 0) {
      console.log(chalk.yellow(`   Skipped ${skipped} invalid/filtered lines`));
    }
    console.log(chalk.gray(`   Saved to: ${path.resolve(options.output)}`));

    // Show sample
    if (traces.length > 0) {
      console.log(chalk.blue('\n📋 Sample trace:'));
      const sample = traces[0];
      console.log(`   ID: ${sample.id}`);
      console.log(`   Query: ${sample.query.substring(0, 80)}...`);
      console.log(`   Provider: ${sample.metadata.provider}`);
      console.log(`   Model: ${sample.metadata.model}`);
    }

  } catch (error) {
    spinner.fail('Failed to collect traces');
    console.error(chalk.red(error instanceof Error ? error.message : error));
    process.exit(1);
  }
}

/**
 * Transform various input formats to standard Trace format
 */
function transformToTrace(rawData: any): Trace {
  // If already in Trace format, use as-is
  if (rawData.id && rawData.query && rawData.response && rawData.metadata) {
    return {
      ...rawData,
      timestamp: rawData.timestamp || new Date().toISOString(),
    };
  }

  // Try to detect and transform common formats
  
  // Format 1: {input, output, model, ...}
  if (rawData.input || rawData.output || rawData.prompt || rawData.completion) {
    return {
      id: rawData.id || uuidv4(),
      timestamp: rawData.timestamp || new Date().toISOString(),
      query: rawData.input || rawData.prompt || rawData.query || '',
      response: rawData.output || rawData.completion || rawData.response || '',
      metadata: {
        provider: rawData.provider || 'unknown',
        model: rawData.model || 'unknown',
        latency: rawData.latency || rawData.duration || 0,
        tokens: rawData.tokens,
        cost: rawData.cost,
      },
    };
  }

  // Format 2: {messages: [{role, content}]}
  if (rawData.messages && Array.isArray(rawData.messages)) {
    const userMessage = rawData.messages.find((m: any) => m.role === 'user');
    const assistantMessage = rawData.messages.find((m: any) => m.role === 'assistant');
    
    return {
      id: rawData.id || uuidv4(),
      timestamp: rawData.timestamp || new Date().toISOString(),
      query: userMessage?.content || '',
      response: assistantMessage?.content || '',
      metadata: {
        provider: rawData.provider || 'unknown',
        model: rawData.model || 'unknown',
        latency: rawData.latency || 0,
      },
    };
  }

  // Fallback: Create trace with whatever data we have
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    query: JSON.stringify(rawData).substring(0, 200),
    response: '',
    metadata: {
      provider: 'unknown',
      model: 'unknown',
      latency: 0,
    },
  };
}
