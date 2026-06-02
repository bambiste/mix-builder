#!/usr/bin/env node
import { existsSync } from 'fs';
import { publish } from './cli_prepare.js';
import chalk from 'chalk';

// Check if inquirer is installed (development convenience)
if (!existsSync('./node_modules/inquirer')) {
  console.log(chalk.yellow('⚠️  Installing required dependencies...\n'));
  try {
    const { execSync } = await import('child_process');
    execSync('pnpm add -D inquirer', { stdio: 'inherit' });
  } catch (error) {
    console.error(
      chalk.red('Failed to install inquirer. Please run: pnpm add -D inquirer')
    );
    process.exit(1);
  }
}
publish();
