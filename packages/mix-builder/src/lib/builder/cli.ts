#!/usr/bin/env node
import { existsSync } from 'fs';
import { build } from './cli_prepare.js';
import chalk from 'chalk';

// Check if inquirer is installed (development convenience)
async function checkDependencies() {
  if (!existsSync('./node_modules/inquirer')) {
    console.log(chalk.yellow('⚠️  Installing required dependencies...\n'));
    try {
      const { execSync } = await import('child_process');
      execSync('pnpm add -D inquirer', { stdio: 'inherit' });
      console.log(chalk.green('✅ Dependencies installed successfully\n'));
    } catch (error) {
      console.error(
        chalk.red(
          'Failed to install inquirer. Please run: pnpm add -D inquirer'
        )
      );
      process.exit(1);
    }
  }
}

// Main entry point
async function main() {
  try {
    await checkDependencies();
    await build();
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red('\n❌ CLI Error:'), error.message);
      if (error.stack && process.env.DEBUG) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red('\n❌ Unknown CLI error:'), error);
    }
    process.exit(1);
  }
}

main();
