/**
 * View Command
 * Read-only trace viewer (terminal UI)
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { TraceStore, AnnotationStore } from '../../core/storage';
import { Annotation } from '../../core/types';

interface ViewOptions {
  annotations?: string;
  filter?: string;
}

export async function viewCommand(tracesPath: string, options: ViewOptions): Promise<void> {
  console.log(chalk.blue.bold('🔍 Viewing traces (read-only)\n'));

  try {
    // Load traces
    const traceStore = new TraceStore(tracesPath);
    const traces = await traceStore.loadAll();

    if (traces.length === 0) {
      console.log(chalk.yellow('No traces found.'));
      return;
    }

    // Load annotations if provided
    let annotations: Annotation[] = [];
    if (options.annotations) {
      const annotationStore = new AnnotationStore(options.annotations);
      annotations = await annotationStore.loadAll();
    }

    // Filter traces if specified
    let displayTraces = traces;
    if (options.filter) {
      displayTraces = traces.filter(t => {
        const annotation = annotations.find(a => a.traceId === t.id);
        return annotation?.failureCategory === options.filter;
      });
    }

    console.log(chalk.green(`Found ${displayTraces.length} traces\n`));

    // Simple terminal viewer (non-interactive for now)
    for (let i = 0; i < displayTraces.length; i++) {
      const trace = displayTraces[i];
      const annotation = annotations.find(a => a.traceId === trace.id);

      console.log(chalk.gray('='.repeat(80)));
      console.log(chalk.white.bold(`Trace ${i + 1}/${displayTraces.length} | ID: ${trace.id}`));
      
      if (annotation) {
        const statusColor = annotation.label === 'pass' ? chalk.green : chalk.red;
        console.log(statusColor(`Status: ${annotation.label.toUpperCase()}`));
        if (annotation.failureCategory) {
          console.log(chalk.yellow(`Category: ${annotation.failureCategory}`));
        }
      } else {
        console.log(chalk.gray('Status: Not annotated'));
      }

      console.log(chalk.blue('\nQuery:'));
      console.log(trace.query);

      console.log(chalk.blue('\nResponse:'));
      console.log(trace.response.substring(0, 500));
      if (trace.response.length > 500) {
        console.log(chalk.gray('... (truncated)'));
      }

      if (trace.context?.retrievedDocs) {
        console.log(chalk.blue('\nRetrieved Documents:'));
        trace.context.retrievedDocs.forEach((doc, idx) => {
          console.log(chalk.gray(`  [${idx + 1}] Score: ${doc.score.toFixed(3)} | ${doc.content.substring(0, 100)}...`));
        });
      }

      console.log(chalk.gray(`\nMetadata: ${trace.metadata.provider} | ${trace.metadata.model} | ${trace.metadata.latency}ms`));
      
      if (annotation?.notes) {
        console.log(chalk.blue('\nNotes:'));
        console.log(chalk.italic(annotation.notes));
      }

      console.log('');
      
      // Pause every 5 traces
      if ((i + 1) % 5 === 0 && i < displayTraces.length - 1) {
        console.log(chalk.gray('Press Enter to continue (or q to quit)...'));
        const key = await waitForKey();
        if (key === 'q') break;
      }
    }

    console.log(chalk.green('\n✅ Viewing complete'));

  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function waitForKey(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', (data) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}
