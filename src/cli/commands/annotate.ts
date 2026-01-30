/**
 * Annotate Command
 * Interactive trace annotation (binary pass/fail)
 * Implements Hamel Husain's "benevolent dictator" annotation model
 */

import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { TraceStore, AnnotationStore } from '../../core/storage';
import { TaxonomyStore } from '../../core/storage';
import { Annotation } from '../../core/types';

interface AnnotateOptions {
  user: string;
  annotations: string;
  resume?: boolean;
}

export async function annotateCommand(tracesPath: string, options: AnnotateOptions): Promise<void> {
  console.log(chalk.blue.bold('📝 Interactive Trace Annotation\n'));
  console.log(chalk.gray('Annotator: ' + options.user));
  console.log(chalk.gray('Binary evaluation only: pass or fail\n'));
  console.log(chalk.gray('Keyboard shortcuts:'));
  console.log(chalk.gray('  p = pass'));
  console.log(chalk.gray('  f = fail'));
  console.log(chalk.gray('  c = set category'));
  console.log(chalk.gray('  n = add/edit notes'));
  console.log(chalk.gray('  j = next trace'));
  console.log(chalk.gray('  k = previous trace'));
  console.log(chalk.gray('  s = save and quit\n'));

  try {
    // Load traces
    const traceStore = new TraceStore(tracesPath);
    const traces = await traceStore.loadAll();

    if (traces.length === 0) {
      console.log(chalk.yellow('No traces to annotate.'));
      return;
    }

    // Load or initialize annotation store
    const annotationStore = new AnnotationStore(options.annotations);
    const existingAnnotations = await annotationStore.loadAll();
    
    // Load taxonomy if it exists
    const taxonomyStore = new TaxonomyStore('taxonomy.json');
    const taxonomy = await taxonomyStore.load();
    const categories = taxonomy?.categories.map(c => c.id) || [];

    console.log(chalk.green(`Loaded ${traces.length} traces`));
    console.log(chalk.green(`Existing annotations: ${existingAnnotations.length}\n`));

    // Build annotation map for quick lookup
    const annotationMap = new Map<string, Annotation>();
    existingAnnotations.forEach(a => {
      // Keep the most recent annotation for each trace
      const existing = annotationMap.get(a.traceId);
      if (!existing || new Date(a.timestamp) > new Date(existing.timestamp)) {
        annotationMap.set(a.traceId, a);
      }
    });

    // Determine starting index
    let currentIndex = 0;
    if (options.resume) {
      // Find first unannotated trace
      currentIndex = traces.findIndex(t => !annotationMap.has(t.id));
      if (currentIndex === -1) currentIndex = traces.length - 1;
    }

    let unsavedAnnotations: Annotation[] = [];

    // Main annotation loop
    while (currentIndex >= 0 && currentIndex < traces.length) {
      const trace = traces[currentIndex];
      const existingAnnotation = annotationMap.get(trace.id);

      // Display current trace
      console.clear();
      console.log(chalk.blue.bold(`Trace ${currentIndex + 1}/${traces.length} | ID: ${trace.id}`));
      
      if (existingAnnotation) {
        const statusColor = existingAnnotation.label === 'pass' ? chalk.green : chalk.red;
        console.log(statusColor(`Current status: ${existingAnnotation.label.toUpperCase()}`));
        if (existingAnnotation.failureCategory) {
          console.log(chalk.yellow(`Category: ${existingAnnotation.failureCategory}`));
        }
      } else {
        console.log(chalk.gray('Status: Not annotated'));
      }

      console.log(chalk.gray('-'.repeat(80)));
      console.log(chalk.blue('Query:'));
      console.log(trace.query);
      console.log('');
      console.log(chalk.blue('Response:'));
      console.log(trace.response);

      if (trace.context?.retrievedDocs) {
        console.log('');
        console.log(chalk.blue('Retrieved Documents:'));
        trace.context.retrievedDocs.forEach((doc, idx) => {
          console.log(chalk.gray(`  [${idx + 1}] Score: ${doc.score.toFixed(3)} | ${doc.content.substring(0, 80)}...`));
        });
      }

      console.log(chalk.gray('-'.repeat(80)));
      console.log(chalk.gray('Commands: [p]ass [f]ail [c]ategory [n]otes [j]next [k]prev [s]save-quit'));
      console.log(chalk.gray(`Progress: ${annotationMap.size}/${traces.length} annotated`));

      // Wait for user input
      const key = await waitForKey();

      switch (key.toLowerCase()) {
        case 'p':
          // Mark as pass
          const passAnnotation: Annotation = {
            id: uuidv4(),
            traceId: trace.id,
            annotator: options.user,
            timestamp: new Date().toISOString(),
            label: 'pass',
            notes: existingAnnotation?.notes || '',
            duration: 0, // Could track actual duration
            source: 'manual',
          };
          unsavedAnnotations.push(passAnnotation);
          annotationMap.set(trace.id, passAnnotation);
          currentIndex++;
          break;

        case 'f':
          // Mark as fail
          let failCategory = '';
          if (categories.length > 0) {
            console.log(chalk.yellow('\nSelect failure category:'));
            categories.forEach((cat, idx) => {
              console.log(`  ${idx + 1}. ${cat}`);
            });
            console.log(chalk.gray('  0. Skip category'));
            const catInput = await waitForLine();
            const catIndex = parseInt(catInput) - 1;
            if (catIndex >= 0 && catIndex < categories.length) {
              failCategory = categories[catIndex];
            }
          }

          console.log(chalk.yellow('\nAdd notes (optional, press Enter when done):'));
          const notes = await waitForLine();

          const failAnnotation: Annotation = {
            id: uuidv4(),
            traceId: trace.id,
            annotator: options.user,
            timestamp: new Date().toISOString(),
            label: 'fail',
            failureCategory: failCategory || undefined,
            notes: notes,
            duration: 0,
            source: 'manual',
          };
          unsavedAnnotations.push(failAnnotation);
          annotationMap.set(trace.id, failAnnotation);
          currentIndex++;
          break;

        case 'c':
          // Change category for existing annotation
          if (existingAnnotation && categories.length > 0) {
            console.log(chalk.yellow('\nSelect failure category:'));
            categories.forEach((cat, idx) => {
              console.log(`  ${idx + 1}. ${cat}`);
            });
            const catInput = await waitForLine();
            const catIndex = parseInt(catInput) - 1;
            if (catIndex >= 0 && catIndex < categories.length) {
              existingAnnotation.failureCategory = categories[catIndex];
              unsavedAnnotations.push(existingAnnotation);
            }
          }
          break;

        case 'n':
          // Edit notes
          if (existingAnnotation) {
            console.log(chalk.yellow('\nEdit notes (press Enter when done):'));
            const newNotes = await waitForLine();
            existingAnnotation.notes = newNotes;
            unsavedAnnotations.push(existingAnnotation);
          }
          break;

        case 'j':
        case '':
          currentIndex++;
          break;

        case 'k':
          currentIndex--;
          break;

        case 's':
        case 'q':
          // Save and quit
          console.log(chalk.blue('\n💾 Saving annotations...'));
          for (const annotation of unsavedAnnotations) {
            await annotationStore.append(annotation);
          }
          console.log(chalk.green(`✅ Saved ${unsavedAnnotations.length} annotations`));
          console.log(chalk.gray(`   Output: ${options.annotations}`));
          return;

        default:
          console.log(chalk.red(`Unknown command: ${key}`));
          await sleep(500);
      }
    }

    // Save remaining annotations
    if (unsavedAnnotations.length > 0) {
      console.log(chalk.blue('\n💾 Saving annotations...'));
      for (const annotation of unsavedAnnotations) {
        await annotationStore.append(annotation);
      }
      console.log(chalk.green(`✅ Saved ${unsavedAnnotations.length} annotations`));
    }

    console.log(chalk.green('\n✅ Annotation complete'));
    console.log(chalk.gray(`Total annotated: ${annotationMap.size}/${traces.length}`));

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
      const char = data.toString();
      if (char === '\u0003') { // Ctrl+C
        process.exit(0);
      }
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(char);
    });
  });
}

function waitForLine(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (data) => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
