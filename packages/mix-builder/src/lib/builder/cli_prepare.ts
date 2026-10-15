#!/usr/bin/env node
import inquirer, { Question, DistinctQuestion } from 'inquirer';
import { explicitArgs, parseProcessArgs } from '../arguments/index.js';
import {
  BUILDER_PROPS_CONFIG,
  BuilderConfig,
  loadConfigFile,
  validateConfig,
  displayConfigSummary,
  merge,
  MIxConfig,
} from './utils.js';
import chalk from 'chalk';
import { buildWithMixBuilder } from './orchestrator.js';

const builderTypes = ['rollup', 'esbuild', 'both'] as const;
const formats = ['es', 'esm', 'cjs', 'umd', 'iife'];
const platforms = ['browser', 'node', 'neutral'];
const environments = ['development', 'production'];

interface CLIAnswers {
  builder: 'rollup' | 'esbuild' | 'both';
  formats: string[];
  platform: 'browser' | 'node' | 'neutral';
  nodeEnv: 'development' | 'production';
  minify: boolean;
  sourcemap: boolean;
  bundle: boolean;
  splitting: boolean;
  treeShaking: boolean;
  dts: boolean;
  reactExternal: boolean;
  litExternal: boolean;
  libExternal: boolean;
  watch: boolean;
  clean: boolean;
  copy_pkg: boolean;
  debug: boolean;
  confirm: boolean;
}

/**
 * Parse command line arguments provided by the user
 */
function parseCliArguments(): Partial<BuilderConfig> {
  const args = parseProcessArgs<Partial<BuilderConfig>>(
    process.argv,
    BUILDER_PROPS_CONFIG
  );
  return args;
}

/**
 * Gather build options interactively from the user
 */
async function gatherBuildOptions(
  cliArgs: Partial<BuilderConfig>,
  fileConfig: BuilderConfig | null
): Promise<BuilderConfig> {
  console.log(chalk.cyan('\n🏗️  Interactive Mix Builder Configuration\n'));

  // Show existing configurations
  if (fileConfig) {
    console.log(chalk.green('✓ Loaded configuration from build-config.json'));
  }

  if (Object.keys(cliArgs).length > 0) {
    console.log(chalk.gray('\nCLI Arguments provided:'));
    Object.entries(cliArgs).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        console.log(chalk.gray(`  ${key}: ${JSON.stringify(value)}`));
      }
    });
  }

  const questions: (Question | DistinctQuestion)[] = [
    {
      type: 'rawlist',
      name: 'builder',
      message: 'Which builder(s) do you want to use?',
      choices: [
        { name: 'Both Rollup and ESBuild', value: 'both' },
        { name: 'Rollup only', value: 'rollup' },
        { name: 'ESBuild only', value: 'esbuild' },
      ],
      default: cliArgs.builder || fileConfig?.builder || 'both',
      when: () => !cliArgs.builder && !fileConfig?.builder,
    },
    {
      type: 'checkbox',
      name: 'formats',
      message: 'Select output formats:',
      choices: formats.map((f) => ({
        name: f.toUpperCase(),
        value: f,
        checked:
          cliArgs.formats?.includes(f) ||
          fileConfig?.formats?.includes(f) ||
          f === 'es',
      })),
      when: () =>
        !cliArgs.formats &&
        !fileConfig?.formats &&
        (!fileConfig?.rollup?.formats || !fileConfig?.esbuild?.formats),
      validate: (input: any) => {
        if (!input || input.length === 0) {
          return 'You must select at least one format';
        }
        return true;
      },
    },
    {
      type: 'rawlist',
      name: 'platform',
      message: 'Target platform:',
      choices: platforms,
      default:
        cliArgs.platform ||
        fileConfig?.platform ||
        fileConfig?.esbuild?.platform ||
        'browser',
      when: () =>
        !cliArgs.platform &&
        !fileConfig?.platform &&
        !fileConfig?.esbuild?.platform,
    },
    {
      type: 'rawlist',
      name: 'nodeEnv',
      message: 'Node environment:',
      choices: environments,
      default:
        cliArgs.nodeEnv ||
        fileConfig?.nodeEnv ||
        fileConfig?.esbuild?.env ||
        'production',
      when: () => !cliArgs.nodeEnv && !fileConfig?.nodeEnv,
    },
    {
      type: 'confirm',
      name: 'minify',
      message: 'Minify output?',
      default:
        cliArgs.minify ??
        fileConfig?.minify ??
        fileConfig?.esbuild?.minify ??
        true,
      when: () =>
        cliArgs.minify === undefined &&
        fileConfig?.minify === undefined &&
        fileConfig?.esbuild?.minify === undefined,
    },
    {
      type: 'confirm',
      name: 'sourcemap',
      message: 'Generate source maps?',
      default:
        cliArgs.sourcemap ??
        fileConfig?.sourcemap ??
        fileConfig?.esbuild?.sourcemap ??
        false,
      when: () =>
        cliArgs.sourcemap === undefined &&
        fileConfig?.sourcemap === undefined &&
        fileConfig?.esbuild?.sourcemap === undefined,
    },
    {
      type: 'confirm',
      name: 'bundle',
      message: 'Bundle dependencies?',
      default:
        cliArgs.bundle ??
        fileConfig?.bundle ??
        fileConfig?.esbuild?.bundle ??
        true,
      when: () =>
        cliArgs.bundle === undefined &&
        fileConfig?.bundle === undefined &&
        fileConfig?.esbuild?.bundle === undefined,
    },
    {
      type: 'confirm',
      name: 'splitting',
      message: 'Enable code splitting (ESM only)?',
      default:
        cliArgs.splitting ??
        fileConfig?.splitting ??
        fileConfig?.esbuild?.splitting ??
        true,
      when: () =>
        cliArgs.splitting === undefined &&
        fileConfig?.splitting === undefined &&
        fileConfig?.esbuild?.splitting === undefined,
    },
    {
      type: 'confirm',
      name: 'treeShaking',
      message: 'Enable tree shaking?',
      default:
        cliArgs.treeShaking ??
        fileConfig?.treeShaking ??
        fileConfig?.esbuild?.treeShaking ??
        true,
      when: () =>
        cliArgs.treeShaking === undefined &&
        fileConfig?.treeShaking === undefined &&
        fileConfig?.esbuild?.treeShaking === undefined,
    },
    {
      type: 'confirm',
      name: 'dts',
      message: 'Generate TypeScript declarations?',
      default: cliArgs.dts ?? fileConfig?.dts ?? false,
      when: () => cliArgs.dts === undefined && fileConfig?.dts === undefined,
    },
    {
      type: 'confirm',
      name: 'reactExternal',
      message: 'Treat React as external?',
      default: cliArgs.reactExternal ?? fileConfig?.reactExternal ?? false,
      when: () =>
        cliArgs.reactExternal === undefined &&
        fileConfig?.reactExternal === undefined,
    },
    {
      type: 'confirm',
      name: 'litExternal',
      message: 'Treat Lit as external?',
      default: cliArgs.litExternal ?? fileConfig?.litExternal ?? false,
      when: () =>
        cliArgs.litExternal === undefined &&
        fileConfig?.litExternal === undefined,
    },
    {
      type: 'confirm',
      name: 'libExternal',
      message: 'Treat library packages as external?',
      default: cliArgs.libExternal ?? fileConfig?.libExternal ?? false,
      when: () =>
        cliArgs.libExternal === undefined &&
        fileConfig?.libExternal === undefined,
    },
    {
      type: 'confirm',
      name: 'copy_pkg',
      message: 'Copy package.json to output?',
      default: cliArgs.copy_pkg ?? fileConfig?.copy_pkg ?? false,
      when: () =>
        cliArgs.copy_pkg === undefined && fileConfig?.copy_pkg === undefined,
    },
    {
      type: 'confirm',
      name: 'watch',
      message: 'Enable watch mode?',
      default: cliArgs.watch ?? fileConfig?.watch ?? false,
      when: () =>
        cliArgs.watch === undefined && fileConfig?.watch === undefined,
    },
    {
      type: 'confirm',
      name: 'clean',
      message: 'Clean output directory before build?',
      default: cliArgs.clean ?? fileConfig?.clean ?? false,
      when: () =>
        cliArgs.clean === undefined && fileConfig?.clean === undefined,
    },
    {
      type: 'confirm',
      name: 'debug',
      message: 'Enable debug mode?',
      default: cliArgs.debug ?? fileConfig?.debug ?? false,
      when: () =>
        cliArgs.debug === undefined && fileConfig?.debug === undefined,
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Ready to build with these settings?',
      default: false,
    },
  ];

  const answers = await inquirer.prompt<CLIAnswers>(questions);

  if (!answers.confirm) {
    console.log(chalk.yellow('\n❌ Build cancelled by user\n'));
    process.exit(0);
  }

  // Lowest to highest: the parser's defaults, then the config file, then what was
  // chosen at the prompt, then a flag actually typed on the command line.
  //
  // The order used to end in the whole `cliArgs` object, which carries a value for every
  // key that declares a `defaultValue`. That made a default indistinguishable from a
  // choice, and it silently outranked the config file: `clean: true` in
  // build-config.json lost to the parser's `clean: false` and never ran.
  const buildConfig: BuilderConfig = merge(
    cliArgs,
    fileConfig || {},
    {
      builder: answers.builder,
      formats: answers.formats,
      platform: answers.platform,
      nodeEnv: answers.nodeEnv,
      minify: answers.minify,
      sourcemap: answers.sourcemap,
      bundle: answers.bundle,
      splitting: answers.splitting,
      treeShaking: answers.treeShaking,
      dts: answers.dts,
      reactExternal: answers.reactExternal,
      litExternal: answers.litExternal,
      libExternal: answers.libExternal,
      copy_pkg: answers.copy_pkg,
      watch: answers.watch,
      clean: answers.clean,
      debug: answers.debug,
    },
    explicitArgs(cliArgs)
  );

  return buildConfig;
}

/**
 * Main CLI function
 */
export async function build() {
  try {
    // Parse CLI arguments first
    const cliArgs = parseCliArguments();
    // Load file configuration if available
    const fileConfig = loadConfigFile(cliArgs.buildConfigFile, cliArgs);
    if (fileConfig && fileConfig.builder) {
      cliArgs.builder = fileConfig.builder;
    }
    // Check if running in non-interactive mode (config file exists or CI)
    const hasConfigFile = fileConfig !== null;
    const isCI = process.env.CI === 'true';
    const hasMinimalArgs = cliArgs.builder !== undefined;

    let buildConfig: MIxConfig = {} as any;
    let configBuilder: BuilderConfig = {};

    if ((hasConfigFile && isCI) || (hasConfigFile && hasMinimalArgs)) {
      // Non-interactive mode - use config file + CLI args
      console.log(chalk.cyan('\n🤖 Running in non-interactive mode\n'));
      // Same precedence as the interactive path: defaults, then the file, then the
      // flags that were actually typed.
      for (const builder in ['rollup', 'esbuild']) {
        const conf = merge(
          cliArgs,
          ((fileConfig || {}) as any)[builder] || {},
          explicitArgs(cliArgs)
        );
        (buildConfig as any)[builder] = conf;
      }
      configBuilder = merge(cliArgs, fileConfig || {}, explicitArgs(cliArgs));
    } else if (!hasConfigFile && hasMinimalArgs && isCI) {
      // CI mode without config file but with args
      console.log(chalk.cyan('\n🤖 Running in CI mode with CLI arguments\n'));
      buildConfig = {
        rollup: cliArgs as BuilderConfig,
        esbuild: cliArgs as BuilderConfig,
      };
    } else {
      // Interactive mode - gather options with prompts
      const config = await gatherBuildOptions(cliArgs, fileConfig);
      buildConfig = { rollup: config, esbuild: config };
      configBuilder = config;
    }

    // Validate configuration
    const validation = validateConfig(configBuilder);
    if (!validation.valid) {
      console.error(chalk.red('\n❌ Configuration validation failed:\n'));
      validation.errors.forEach((error) => {
        console.error(chalk.red(`  - ${error}`));
      });
      process.exit(1);
    }

    // Display summary
    displayConfigSummary(buildConfig);

    // Set up interrupt handler
    let interrupted = false;
    process.on('SIGINT', () => {
      if (interrupted) {
        console.log(chalk.red('\n\n⚠️  Force terminating...\n'));
        process.exit(130);
      }
      interrupted = true;
      console.log(
        chalk.yellow(
          '\n\n⚠️  Build interrupted. Press Ctrl+C again to force quit.\n'
        )
      );
    });

    // Call the build orchestrator (it prints its own header + summary).
    await buildWithMixBuilder(configBuilder, buildConfig);
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red('\n❌ Build Error:'), error.message);
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
