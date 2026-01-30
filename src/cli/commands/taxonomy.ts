/**
 * Taxonomy Commands
 * Build, show, and update failure taxonomy
 */

import * as fs from 'fs-extra';
import chalk from 'chalk';
import { TaxonomyEngine } from '../../core/taxonomy-engine';
import { TaxonomyStore } from '../../core/storage';

export const taxonomyCommand = {
  async build(options: {
    annotations: string;
    user: string;
    output: string;
  }): Promise<void> {
    console.log(chalk.blue.bold('🏗️  Building Failure Taxonomy\n'));

    try {
      const engine = new TaxonomyEngine(options.output, options.annotations);
      const taxonomy = await engine.build(options.user);

      console.log(chalk.green('✅ Taxonomy built successfully!\n'));
      
      // Display results
      console.log(chalk.white.bold('Statistics:'));
      console.log(`  Total annotated: ${taxonomy.stats.totalAnnotated}`);
      console.log(`  Pass rate: ${(taxonomy.stats.passRate * 100).toFixed(1)}%`);
      console.log(`  Failed traces: ${taxonomy.stats.totalFailed}\n`);

      console.log(chalk.white.bold('Failure Categories:'));
      taxonomy.categories.forEach((cat, idx) => {
        const percentage = taxonomy.stats.totalFailed > 0
          ? ((cat.count / taxonomy.stats.totalFailed) * 100).toFixed(1)
          : '0.0';
        console.log(`  ${idx + 1}. ${chalk.yellow(cat.name)}: ${cat.count} (${percentage}%)`);
        if (cat.description) {
          console.log(`     ${chalk.gray(cat.description.substring(0, 100))}`);
        }
      });

      console.log(chalk.gray(`\n💾 Saved to: ${options.output}`));

    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  },

  async show(options: {
    taxonomy: string;
  }): Promise<void> {
    try {
      const store = new TaxonomyStore(options.taxonomy);
      const taxonomy = await store.load();

      if (!taxonomy) {
        console.log(chalk.yellow('No taxonomy found. Run "taxonomy build" first.'));
        return;
      }

      console.log(chalk.blue.bold('📊 Failure Taxonomy\n'));
      console.log(chalk.gray(`Last updated: ${taxonomy.lastUpdated}`));
      console.log(chalk.gray(`Maintained by: ${taxonomy.annotator}\n`));

      console.log(chalk.white.bold('Statistics:'));
      console.log(`  Total annotated: ${taxonomy.stats.totalAnnotated}`);
      console.log(`  Passed: ${taxonomy.stats.totalPassed}`);
      console.log(`  Failed: ${taxonomy.stats.totalFailed}`);
      console.log(`  Pass rate: ${(taxonomy.stats.passRate * 100).toFixed(1)}%\n`);

      console.log(chalk.white.bold('Categories (sorted by frequency):'));
      console.log(chalk.gray('-'.repeat(60)));

      taxonomy.categories.forEach((cat, idx) => {
        const percentage = taxonomy.stats.totalFailed > 0
          ? ((cat.count / taxonomy.stats.totalFailed) * 100).toFixed(1)
          : '0.0';
        
        console.log(`${idx + 1}. ${chalk.yellow.bold(cat.name)}`);
        console.log(`   Count: ${cat.count} (${percentage}% of failures)`);
        console.log(`   ${chalk.gray(cat.description || 'No description')}`);
        console.log('');
      });

    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  },

  async update(options: {
    taxonomy: string;
    annotations: string;
  }): Promise<void> {
    console.log(chalk.blue.bold('🔄 Updating Failure Taxonomy\n'));

    try {
      const engine = new TaxonomyEngine(options.taxonomy, options.annotations);
      const taxonomy = await engine.update();

      console.log(chalk.green('✅ Taxonomy updated!\n'));
      console.log(`Total categories: ${taxonomy.categories.length}`);
      console.log(`Pass rate: ${(taxonomy.stats.passRate * 100).toFixed(1)}%`);

    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
};
