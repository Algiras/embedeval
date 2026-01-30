/**
 * Hugging Face CLI Command
 * Search and browse HF embedding models
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { 
  searchHuggingFaceModels, 
  getHuggingFaceModelInfo
} from '../../providers/huggingface';
import { logger } from '../../utils/logger';

interface HuggingFaceOptions {
  search?: string;
  limit?: string;
  model?: string;
  info?: boolean;
}

export async function huggingfaceCommand(options: HuggingFaceOptions, _command: Command): Promise<void> {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (options.model && options.info) {
      // Show detailed info about a specific model
      console.log(chalk.blue(`\nFetching info for ${options.model}...\n`));
      
      const modelInfo = await getHuggingFaceModelInfo(options.model, apiKey);
      
      console.log(chalk.bold(modelInfo.name));
      console.log(chalk.gray('─'.repeat(80)));
      console.log(`\n${modelInfo.description || 'No description available'}\n`);
      
      console.log(chalk.bold('Stats:'));
      console.log(`  Downloads: ${modelInfo.downloads.toLocaleString()}`);
      console.log(`  Likes: ${modelInfo.likes.toLocaleString()}`);
      
      console.log(chalk.bold('\nTags:'));
      console.log(`  ${modelInfo.tags.join(', ')}`);
      
      if (modelInfo.siblings && modelInfo.siblings.length > 0) {
        console.log(chalk.bold('\nFiles:'));
        modelInfo.siblings.slice(0, 10).forEach(file => {
          console.log(`  • ${file}`);
        });
        if (modelInfo.siblings.length > 10) {
          console.log(`  ... and ${modelInfo.siblings.length - 10} more files`);
        }
      }
      
      console.log(chalk.bold('\nUsage in EmbedEval:'));
      console.log(chalk.cyan(`  --variants huggingface:${modelInfo.id}`));
      console.log(chalk.gray(`  # Or in config.yaml:`));
      console.log(chalk.gray(`  # - type: huggingface`));
      console.log(chalk.gray(`  #   model: ${modelInfo.id}`));
      console.log(chalk.gray(`  #   apiKey: \${HUGGINGFACE_API_KEY}`));
      
      console.log('');
      return;
    }

    // Search for models
    const query = options.search || 'sentence-transformers';
    const limit = parseInt(options.limit || '20', 10);
    
    console.log(chalk.blue(`\nSearching Hugging Face for "${query}"...\n`));
    
    const models = await searchHuggingFaceModels(query, limit, apiKey);
    
    if (models.length === 0) {
      console.log(chalk.yellow('No models found. Try a different search query.\n'));
      return;
    }

    // Display results
    console.log(chalk.bold(`Found ${models.length} embedding models:\n`));
    
    const choices = models.map((model, index) => ({
      name: `${index + 1}. ${chalk.cyan(model.id)} ${chalk.gray(`(${model.downloads.toLocaleString()} downloads, ${model.likes} likes)`)}`,
      value: model,
      short: model.id,
    }));
    
    choices.push({
      name: chalk.gray('Cancel'),
      value: null as any,
      short: 'cancel',
    });

    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message: 'Select a model to view details (or use in your config):',
      choices,
      pageSize: 15,
    }]);

    if (!selected) {
      console.log(chalk.gray('\nCancelled\n'));
      return;
    }

    // Show selected model details
    console.log(chalk.blue(`\n${selected.id}`));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(`\n${selected.description || 'No description available'}\n`);
    
    console.log(chalk.bold('Stats:'));
    console.log(`  Downloads: ${selected.downloads.toLocaleString()}`);
    console.log(`  Likes: ${selected.likes.toLocaleString()}`);
    
    console.log(chalk.bold('\nTags:'));
    console.log(`  ${selected.tags.join(', ')}`);
    
    console.log(chalk.bold('\nUsage:'));
    console.log(chalk.cyan(`  embedeval ab-test --variants huggingface:${selected.id}`));
    console.log(chalk.gray(`\n  # Or add to config.yaml:`));
    console.log(chalk.gray(`  providers:`));
    console.log(chalk.gray(`    - type: huggingface`));
    console.log(chalk.gray(`      model: ${selected.id}`));
    console.log(chalk.gray(`      apiKey: \${HUGGINGFACE_API_KEY}  # Optional, for Inference API`));
    
    console.log('');

  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
