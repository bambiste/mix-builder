import inquirer, { Question, DistinctQuestion } from 'inquirer';
import { publishPackages } from './publish.js';
import { parseProcessArgs } from '../arguments/index.js';
import { PUBLISH_PROPS_CONFIG } from './utils.js';
import chalk from 'chalk';
import type { BuildConfig } from './publish.js';

const versionTypes = ['patch', 'minor', 'major'] as const;
const commonTags = ['latest', 'next', 'beta', 'alpha', 'canary', 'stable'];
const accessLevels = ['public', 'restricted'] as const;

interface CLIAnswers {
  type: 'major' | 'minor' | 'patch';
  needsSuffix: boolean;
  suffix?: string;
  customTag: boolean;
  tag?: string;
  customTagValue?: string;
  globalBuild: boolean;
  packageBuild: boolean;
  access: 'public' | 'restricted';
  dryRun: boolean;
  skipBuild: boolean;
  confirm: boolean;
}

/**
 * Parse command line arguments provided by the user
 */
function parseCliArguments(): Partial<BuildConfig> {
  const args = parseProcessArgs<Partial<BuildConfig>>(
    process.argv,
    PUBLISH_PROPS_CONFIG
  );
  return args;
}

/**
 * Gather publish options interactively from the user
 */
async function gatherPublishOptions(
  cliArgs: Partial<BuildConfig>
): Promise<Partial<BuildConfig>> {
  console.log(chalk.cyan('\n📦 Interactive Package Publisher\n'));

  // Show CLI arguments if provided
  if (Object.keys(cliArgs).length > 0) {
    console.log(chalk.gray('CLI Arguments provided:'));
    Object.entries(cliArgs).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        console.log(chalk.gray(`  ${key}: ${JSON.stringify(value)}`));
      }
    });
  }

  const questions: (Question | DistinctQuestion)[] = [
    {
      type: 'rawlist',
      name: 'type',
      message: 'What type of version update?',
      choices: [...versionTypes],
      default: cliArgs.type || 'patch',
      when: () => !cliArgs.type,
    },
    {
      type: 'confirm',
      name: 'needsSuffix',
      message: 'Do you want to add a version suffix (for pre-releases)?',
      default: false,
      when: () => !cliArgs.suffix,
    },
    {
      type: 'input',
      name: 'suffix',
      message: 'Enter the suffix (e.g., beta.1, alpha.2):',
      when: (answers) => answers.needsSuffix && !cliArgs.suffix,
      validate: (input: string) => {
        if (input.trim() === '') return 'Suffix cannot be empty';
        return true;
      },
    },
    {
      type: 'confirm',
      name: 'customTag',
      message: 'Do you want to specify a custom tag?',
      default: !!cliArgs.tag,
      when: () => !cliArgs.tag,
    },
    {
      type: 'rawlist',
      name: 'tag',
      message: 'Select a tag:',
      choices: [
        ...commonTags,
        new inquirer.Separator(),
        {
          name: 'Custom tag',
          value: 'CUSTOM',
        },
      ],
      when: (answers) => answers.customTag && !cliArgs.tag,
    },
    {
      type: 'input',
      name: 'customTagValue',
      message: 'Enter your custom tag:',
      when: (answers) =>
        answers.customTag && answers.tag === 'CUSTOM' && !cliArgs.tag,
      validate: (input: string) => {
        if (input.trim() === '') return 'Tag cannot be empty';
        return true;
      },
    },
    {
      type: 'rawlist',
      name: 'access',
      message: 'Package access level:',
      choices: accessLevels,
      default: cliArgs.access || 'restricted',
      when: () => cliArgs.access === undefined,
    },
    {
      type: 'confirm',
      name: 'globalBuild',
      message: 'Run global build?',
      default: cliArgs.global_build ?? true,
      when: () => cliArgs.global_build === undefined && !cliArgs.skipBuild,
    },
    {
      type: 'confirm',
      name: 'packageBuild',
      message: 'Run individual package builds?',
      default: cliArgs.package_build ?? true,
      when: () => cliArgs.package_build === undefined && !cliArgs.skipBuild,
    },
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Run in dry-run mode (no actual publishing)?',
      default: cliArgs.dryRun ?? false,
      when: () => cliArgs.dryRun === undefined,
    },
    {
      type: 'confirm',
      name: 'skipBuild',
      message: 'Skip build steps?',
      default: cliArgs.skipBuild ?? false,
      when: () => cliArgs.skipBuild === undefined,
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Ready to publish with these settings?',
      default: false,
    },
  ];

  const answers = await inquirer.prompt<CLIAnswers>(questions);

  if (!answers.confirm) {
    console.log(chalk.yellow('\n❌ Publishing cancelled by user\n'));
    process.exit(0);
  }

  // Merge interactive answers with CLI arguments
  const publishOptions: Partial<BuildConfig> = {
    ...cliArgs,
    type: (cliArgs.type || answers.type) as 'major' | 'minor' | 'patch',
    suffix: cliArgs.suffix || (answers.needsSuffix ? answers.suffix : ''),
    tag:
      cliArgs.tag ||
      (answers.customTag
        ? answers.tag === 'CUSTOM'
          ? answers.customTagValue
          : answers.tag
        : undefined),
    global_build: cliArgs.global_build ?? answers.globalBuild,
    package_build: cliArgs.package_build ?? answers.packageBuild,
    access: (cliArgs.access || answers.access) as 'public' | 'restricted',
    dryRun: cliArgs.dryRun ?? answers.dryRun,
    skipBuild: cliArgs.skipBuild ?? answers.skipBuild,
  };

  return publishOptions;
}

/**
 * Display a summary of the publish configuration
 */
function displaySummary(options: Partial<BuildConfig>): void {
  console.log(chalk.cyan('\n📋 Publish Configuration Summary:\n'));

  const summary = [
    ['Version Type', options.type || 'patch'],
    ['Version Suffix', options.suffix || 'none'],
    ['NPM Tag', options.tag || 'auto-determined'],
    ['Access Level', options.access || 'restricted'],
    ['Global Build', options.global_build ? 'Yes' : 'No'],
    ['Package Build', options.package_build ? 'Yes' : 'No'],
    ['Skip Build', options.skipBuild ? 'Yes' : 'No'],
    ['Dry Run', options.dryRun ? 'Yes' : 'No'],
  ];

  if (options.registry) {
    summary.push(['Registry', options.registry]);
  }
  if (options.timeout) {
    summary.push(['Timeout', `${options.timeout / 1000}s`]);
  }
  if (options.packages && options.packages.length > 0) {
    summary.push(['Packages', options.packages.join(', ')]);
  }
  if (options.excluded && options.excluded.length > 0) {
    summary.push(['Excluded Dirs', options.excluded.join(', ')]);
  }
  if (options.excluded_packages && options.excluded_packages.length > 0) {
    summary.push(['Excluded Pkgs', options.excluded_packages.join(', ')]);
  }

  const maxKeyLength = Math.max(...summary.map(([key]) => key.length));
  summary.forEach(([key, value]) => {
    console.log(
      `  ${chalk.gray(key.padEnd(maxKeyLength))}: ${chalk.white(value)}`
    );
  });
  console.log();
}

/**
 * Main CLI function
 */
export async function publish() {
  try {
    // Parse CLI arguments first
    const cliArgs = parseCliArguments();

    // Check if running in non-interactive mode (all required args provided)
    const hasAllRequiredArgs =
      cliArgs.type !== undefined &&
      (cliArgs.tag !== undefined || cliArgs.suffix !== undefined);

    let publishOptions: Partial<BuildConfig>;

    if (hasAllRequiredArgs && process.env.CI === 'true') {
      // CI mode - use CLI args directly
      console.log(chalk.cyan('\n🤖 Running in CI mode (non-interactive)\n'));
      publishOptions = cliArgs;
    } else {
      // Interactive mode - gather options with prompts
      publishOptions = await gatherPublishOptions(cliArgs);
    }

    // Display summary
    displaySummary(publishOptions);

    // Set up interrupt handler
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n⚠️  Publish interrupted by user\n'));
      process.exit(130);
    });

    // Call the publishPackages function with merged options
    console.log(chalk.cyan('🚀 Starting publication process...\n'));

    await publishPackages(publishOptions);

    console.log(chalk.green('\n✅ Publication completed successfully!\n'));
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      if (error.stack && process.env.DEBUG) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red('\n❌ Unknown error:'), error);
    }
    process.exit(1);
  }
}
