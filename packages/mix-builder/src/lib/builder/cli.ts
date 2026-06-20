#!/usr/bin/env node
import { build } from './cli_prepare.js';
import chalk from 'chalk';

// inquirer is a declared dependency of @bambiste/mix-builder, so it resolves from the
// package's own install — cli_prepare imports it directly. (The old code ran
// `pnpm add -D inquirer` in the CONSUMER's project on every build when
// `./node_modules/inquirer` wasn't in the cwd, which reinstalled it each time and
// polluted the consumer's package.json.)

// Main entry point
async function main() {
  try {
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
