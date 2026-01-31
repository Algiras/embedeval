/**
 * EmbedEval DSL CLI Commands
 * 
 * Commands for working with the high-level DSL.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { parseEvalSpec, compileSpec, compile, validate } from '../../dsl';
import { listTemplates, getTemplate, generateFromTemplate } from '../../dsl/templates';
import { logger } from '../../utils/logger';

export function registerDSLCommands(program: Command): void {
  const dsl = program
    .command('dsl')
    .description('Work with EmbedEval DSL (Domain Specific Language) for easy eval definitions');

  // dsl compile - Convert .eval to .json
  dsl
    .command('compile <file>')
    .description('Compile a .eval DSL file to JSON eval config')
    .option('-o, --output <file>', 'Output JSON file')
    .option('--pretty', 'Pretty print JSON', true)
    .action(async (file: string, options) => {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const configs = compile(content);
        
        const output = options.pretty 
          ? JSON.stringify(configs, null, 2)
          : JSON.stringify(configs);
        
        if (options.output) {
          fs.writeFileSync(options.output, output);
          logger.success(`Compiled ${configs.length} evals to ${options.output}`);
        } else {
          console.log(output);
        }
      } catch (e: any) {
        logger.error(`Failed to compile: ${e.message}`);
        process.exit(1);
      }
    });

  // dsl validate - Check a .eval file for errors
  dsl
    .command('validate <file>')
    .description('Validate a .eval DSL file')
    .action(async (file: string) => {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const result = validate(content);
        
        if (result.valid) {
          const spec = parseEvalSpec(content);
          logger.success(`✓ Valid! Found ${spec.evals.length} eval definitions`);
          
          console.log('\n📋 Evals:');
          for (const evalDef of spec.evals) {
            const priority = evalDef.priority === 'expensive' ? '💰' : '⚡';
            console.log(`   ${priority} [${evalDef.type}] ${evalDef.name}`);
          }
        } else {
          logger.error('Validation failed:');
          for (const error of result.errors) {
            console.log(`   ❌ ${error}`);
          }
          process.exit(1);
        }
      } catch (e: any) {
        logger.error(`Failed to validate: ${e.message}`);
        process.exit(1);
      }
    });

  // dsl preview - Show what the compiled config looks like
  dsl
    .command('preview <file>')
    .description('Preview compiled eval configs without saving')
    .action(async (file: string) => {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const spec = parseEvalSpec(content);
        const configs = compileSpec(spec);
        
        console.log(`\n📝 ${spec.name}`);
        if (spec.description) console.log(`   ${spec.description}`);
        if (spec.domain) console.log(`   Domain: ${spec.domain}`);
        console.log(`   Evals: ${configs.length}\n`);
        
        for (const config of configs) {
          const typeIcons: Record<string, string> = {
            'assertion': '🔍',
            'regex': '📐',
            'code': '⚙️',
            'llm-judge': '🤖',
          };
          const typeIcon = typeIcons[config.type] || '•';
          
          const priority = config.priority === 'expensive' ? '💰' : '⚡';
          
          console.log(`${priority} ${typeIcon} ${config.name} (${config.type})`);
          if (config.description) {
            console.log(`   ${config.description}`);
          }
          console.log('');
        }
      } catch (e: any) {
        logger.error(`Failed to preview: ${e.message}`);
        process.exit(1);
      }
    });

  // dsl templates - List available templates
  dsl
    .command('templates')
    .description('List available eval templates')
    .action(async () => {
      const templates = listTemplates();
      
      console.log('\n📚 Available Templates:\n');
      
      for (const template of templates) {
        console.log(`  ${template.id.padEnd(15)} ${template.name}`);
        console.log(`  ${''.padEnd(15)} ${template.description}`);
        console.log('');
      }
      
      console.log('Use `embedeval dsl init <template>` to create a new .eval file');
    });

  // dsl init - Create a new .eval file from template
  dsl
    .command('init [template]')
    .description('Create a new .eval file from a template')
    .option('-o, --output <file>', 'Output file', 'evals.eval')
    .option('-n, --name <name>', 'Custom name for the eval spec')
    .action(async (templateId: string | undefined, options) => {
      const id = templateId || 'minimal';
      const template = getTemplate(id);
      
      if (!template) {
        logger.error(`Unknown template: ${id}`);
        console.log('\nAvailable templates:');
        for (const t of listTemplates()) {
          console.log(`  - ${t.id}: ${t.name}`);
        }
        process.exit(1);
      }
      
      const content = generateFromTemplate(id, {
        name: options.name,
      });
      
      const outputPath = options.output;
      
      if (fs.existsSync(outputPath)) {
        logger.error(`File already exists: ${outputPath}`);
        process.exit(1);
      }
      
      fs.writeFileSync(outputPath, content);
      logger.success(`Created ${outputPath} from template "${template.name}"`);
      
      console.log('\n📝 Next steps:');
      console.log(`   1. Edit ${outputPath} to customize your evals`);
      console.log(`   2. Run: embedeval dsl validate ${outputPath}`);
      console.log(`   3. Run: embedeval dsl compile ${outputPath} -o evals.json`);
      console.log(`   4. Run: embedeval eval run traces.jsonl -c evals.json`);
    });

  // dsl run - Compile and run in one step
  dsl
    .command('run <evalFile> <traceFile>')
    .description('Compile DSL and run evals in one step')
    .option('-o, --output <file>', 'Output results file')
    .action(async (evalFile: string, traceFile: string, options) => {
      try {
        // Compile DSL
        const dslContent = fs.readFileSync(evalFile, 'utf-8');
        const configs = compile(dslContent);
        
        logger.info(`Compiled ${configs.length} evals from DSL`);
        
        // Import and run eval engine
        const { EvalRegistry } = await import('../../evals/engine');
        
        // Create registry and register evals
        const registry = new EvalRegistry();
        for (const config of configs) {
          registry.register(config);
        }
        
        // Read traces
        const traceContent = fs.readFileSync(traceFile, 'utf-8');
        const traces = traceContent
          .trim()
          .split('\n')
          .map(line => JSON.parse(line));
        
        // Run evals on each trace
        const allResults: any[] = [];
        for (const trace of traces) {
          const traceResults = await registry.runAll(trace);
          allResults.push({
            traceId: trace.id,
            passed: traceResults.every(r => r.passed),
            results: traceResults,
          });
        }
        
        const results = { results: allResults };
        
        // Output
        const output = JSON.stringify(results, null, 2);
        if (options.output) {
          fs.writeFileSync(options.output, output);
          logger.success(`Results saved to ${options.output}`);
        } else {
          console.log(output);
        }
        
        // Summary
        const passed = results.results.filter((r: { passed: boolean }) => r.passed).length;
        const total = results.results.length;
        const rate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
        
        console.log(`\n✅ Results: ${passed}/${total} passed (${rate}%)`);
        
      } catch (e: any) {
        logger.error(`Failed: ${e.message}`);
        process.exit(1);
      }
    });

  // dsl ui - Generate annotation UI from DSL
  dsl
    .command('ui <evalFile>')
    .description('Generate interactive HTML annotation UI from DSL spec')
    .option('-o, --output <file>', 'Output HTML file', 'annotation-ui.html')
    .option('-a, --annotations <file>', 'Annotations output filename', 'annotations.jsonl')
    .option('--theme <theme>', 'UI theme (light, dark)', 'dark')
    .option('--no-shortcuts', 'Disable keyboard shortcuts')
    .option('--no-context', 'Hide retrieved context')
    .option('--no-metadata', 'Hide trace metadata')
    .action(async (evalFile: string, options) => {
      try {
        const dslContent = fs.readFileSync(evalFile, 'utf-8');
        const spec = parseEvalSpec(dslContent);
        
        const { generateAnnotationUI } = await import('../../dsl/ui-generator');
        
        const html = generateAnnotationUI(spec, '', options.annotations, {
          theme: options.theme,
          showContext: options.context !== false,
          showMetadata: options.metadata !== false,
          keyboardShortcuts: options.shortcuts !== false,
        });
        
        fs.writeFileSync(options.output, html);
        logger.success(`Generated annotation UI: ${options.output}`);
        
        console.log('\n📝 Next steps:');
        console.log(`   1. Open ${options.output} in a browser`);
        console.log('   2. Load your traces.jsonl file');
        console.log('   3. Annotate traces using the checklist');
        console.log('   4. Click "Export Annotations" when done');
        console.log(`   5. Use annotations with: embedeval taxonomy build -a ${options.annotations}`);
        
        // Try to open in browser
        const openCommand = process.platform === 'darwin' ? 'open' : 
                           process.platform === 'win32' ? 'start' : 'xdg-open';
        console.log(`\n💡 Tip: Run \`${openCommand} ${options.output}\` to open in browser`);
        
      } catch (e: any) {
        logger.error(`Failed: ${e.message}`);
        process.exit(1);
      }
    });

  // dsl serve - Serve annotation UI locally
  dsl
    .command('serve <evalFile>')
    .description('Start local server for annotation UI')
    .option('-p, --port <port>', 'Port number', '3456')
    .option('-t, --traces <file>', 'Pre-load traces file')
    .option('--theme <theme>', 'UI theme (light, dark)', 'dark')
    .action(async (evalFile: string, options) => {
      try {
        const dslContent = fs.readFileSync(evalFile, 'utf-8');
        const spec = parseEvalSpec(dslContent);
        
        const { generateAnnotationUI } = await import('../../dsl/ui-generator');
        
        // Generate HTML with embedded traces if provided
        let html = generateAnnotationUI(spec, options.traces || '', 'annotations.jsonl', {
          theme: options.theme,
        });
        
        // If traces file provided, embed it
        if (options.traces && fs.existsSync(options.traces)) {
          const tracesContent = fs.readFileSync(options.traces, 'utf-8');
          const traces = tracesContent.trim().split('\n').map(line => JSON.parse(line));
          
          // Inject traces into HTML
          html = html.replace(
            '<div id="fileUpload" class="file-upload">',
            `<script>
              const preloadedTraces = ${JSON.stringify(traces)};
              window.addEventListener('load', () => {
                traces = preloadedTraces;
                document.getElementById('fileUpload').style.display = 'none';
                document.getElementById('mainContent').style.display = 'grid';
                updateDisplay();
                updateStats();
              });
            </script>
            <div id="fileUpload" class="file-upload" style="display:none;">`
          );
        }
        
        // Simple HTTP server
        const http = await import('http');
        const port = parseInt(options.port);
        
        const server = http.createServer((_req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        });
        
        server.listen(port, () => {
          logger.success(`Annotation server running at http://localhost:${port}`);
          console.log('\n📝 Open your browser to start annotating');
          console.log('   Press Ctrl+C to stop the server');
          
          // Try to open browser
          const openCommand = process.platform === 'darwin' ? 'open' : 
                             process.platform === 'win32' ? 'start' : 'xdg-open';
          require('child_process').exec(`${openCommand} http://localhost:${port}`);
        });
        
      } catch (e: any) {
        logger.error(`Failed: ${e.message}`);
        process.exit(1);
      }
    });
}
