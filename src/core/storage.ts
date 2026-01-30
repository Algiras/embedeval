/**
 * JSONL Storage Layer for Traces and Annotations
 * Simple, grep-friendly, version-control friendly
 */

import * as fs from 'fs-extra';
import * as readline from 'readline';
import { Trace, Annotation, FailureTaxonomy } from '../core/types';

export class TraceStore {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async loadAll(): Promise<Trace[]> {
    const traces: Trace[] = [];
    
    if (!(await fs.pathExists(this.filePath))) {
      return traces;
    }

    const fileStream = fs.createReadStream(this.filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          const trace = JSON.parse(line) as Trace;
          traces.push(trace);
        } catch (e) {
          console.warn(`Failed to parse trace line: ${line.substring(0, 100)}...`);
        }
      }
    }

    return traces;
  }

  async loadById(id: string): Promise<Trace | undefined> {
    const traces = await this.loadAll();
    return traces.find(t => t.id === id);
  }

  async append(trace: Trace): Promise<void> {
    const line = JSON.stringify(trace);
    await fs.appendFile(this.filePath, line + '\n', 'utf-8');
  }

  async appendMany(traces: Trace[]): Promise<void> {
    const lines = traces.map(t => JSON.stringify(t)).join('\n') + '\n';
    await fs.appendFile(this.filePath, lines, 'utf-8');
  }

  async count(): Promise<number> {
    let count = 0;
    
    if (!(await fs.pathExists(this.filePath))) {
      return count;
    }

    const fileStream = fs.createReadStream(this.filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) count++;
    }

    return count;
  }
}

export class AnnotationStore {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async loadAll(): Promise<Annotation[]> {
    const annotations: Annotation[] = [];
    
    if (!(await fs.pathExists(this.filePath))) {
      return annotations;
    }

    const fileStream = fs.createReadStream(this.filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          const annotation = JSON.parse(line) as Annotation;
          annotations.push(annotation);
        } catch (e) {
          console.warn(`Failed to parse annotation line: ${line.substring(0, 100)}...`);
        }
      }
    }

    return annotations;
  }

  async loadByTraceId(traceId: string): Promise<Annotation | undefined> {
    const annotations = await this.loadAll();
    // Return most recent annotation for this trace
    return annotations
      .filter(a => a.traceId === traceId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  async loadAllForTraceId(traceId: string): Promise<Annotation[]> {
    const annotations = await this.loadAll();
    return annotations
      .filter(a => a.traceId === traceId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async append(annotation: Annotation): Promise<void> {
    const line = JSON.stringify(annotation);
    await fs.appendFile(this.filePath, line + '\n', 'utf-8');
  }

  async getStats(): Promise<{
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    byCategory: Record<string, number>;
  }> {
    const annotations = await this.loadAll();
    const total = annotations.length;
    const passed = annotations.filter(a => a.label === 'pass').length;
    const failed = annotations.filter(a => a.label === 'fail').length;
    
    const byCategory: Record<string, number> = {};
    annotations.forEach(a => {
      if (a.failureCategory) {
        byCategory[a.failureCategory] = (byCategory[a.failureCategory] || 0) + 1;
      }
    });

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? passed / total : 0,
      byCategory,
    };
  }
}

export class TaxonomyStore {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<FailureTaxonomy | null> {
    if (!(await fs.pathExists(this.filePath))) {
      return null;
    }

    const content = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(content) as FailureTaxonomy;
  }

  async save(taxonomy: FailureTaxonomy): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(taxonomy, null, 2), 'utf-8');
  }

  async exists(): Promise<boolean> {
    return fs.pathExists(this.filePath);
  }
}
