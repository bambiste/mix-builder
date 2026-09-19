import { ArgParserConfig } from '../arguments/index.js';
import type { TscConfig } from './tsc.js';
import { readFileSync, existsSync } from 'fs';
import { resolveFrom } from '../utils/index.js';
import { cwd } from 'process';
import chalk from 'chalk';

/**
 * Configuration for parsing builder command arguments
 */
export const BUILDER_PROPS_CONFIG: ArgParserConfig[] = [
  {
    key: 'buildConfigFile',
    type: 'string',
    defaultValue: 'build-config.json',
  },
  {
    key: 'builder',
    type: 'string',
    expectedValues: ['rollup', 'esbuild', 'both'],
    defaultValue: 'both',
  },
  {
    key: 'use',
    type: 'string',
    expectedValues: ['rollup', 'esbuild', 'tsup'],
  },
  {
    key: 'outdir',
    type: 'string',
    defaultValue: 'dist',
  },
  {
    key: 'rootDir',
    type: 'string',
    defaultValue: '.',
  },
  {
    key: 'baseDir',
    type: 'string',
    defaultValue: '.',
  },
  {
    key: 'formats',
    type: 'array',
  },
  {
    key: 'extensions',
    type: 'array',
  },
  {
    key: 'externals',
    type: 'array',
  },
  {
    key: 'reactExternal',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'litExternal',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'libExternal',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'pkgExternal',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'skipExternal',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'nodeEnv',
    type: 'string',
    expectedValues: ['development', 'production'],
    defaultValue: 'production',
  },
  {
    key: 'debug',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'log',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'dts',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'copy_pkg',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'minify',
    type: 'boolean',
    // No default, so the builder can pick by format: iife is loaded straight into a
    // browser and is minified, esm and cjs go through a bundler that minifies anyway.
    // A default here wins over that and cannot be told apart from someone asking.
  },
  {
    key: 'sourcemap',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'bundle',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'splitting',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'treeShaking',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'platform',
    type: 'string',
    expectedValues: ['browser', 'node', 'neutral'],
    defaultValue: 'browser',
  },
  {
    key: 'target',
    type: 'string',
    defaultValue: 'es2021',
  },
  {
    key: 'watch',
    type: 'boolean',
    defaultValue: false,
  },
  {
    // No defaultValue, deliberately, same as `minify`. A concrete `false` here is
    // indistinguishable from someone asking not to clean, and it masked the value a
    // config file declared inside its builder block. Absent means absent, and the
    // orchestrator reads it as "no".
    key: 'clean',
    type: 'boolean',
  },
];

/**
 * Builder configuration interface
 */
export interface BuilderConfig {
  buildConfigFile?: string;
  builder?: 'rollup' | 'esbuild' | 'both';
  use?: 'rollup' | 'esbuild' | 'tsup';
  outdir?: string;
  rootDir?: string;
  baseDir?: string;
  formats?: string[];
  extensions?: string[];
  externals?: string[];
  reactExternal?: boolean;
  litExternal?: boolean;
  libExternal?: boolean;
  pkgExternal?: boolean;
  skipExternal?: boolean;
  nodeEnv?: 'development' | 'production';
  debug?: boolean;
  log?: boolean;
  dts?: boolean;
  copy_pkg?: boolean;
  minify?: boolean;
  sourcemap?: boolean | string;
  bundle?: boolean;
  splitting?: boolean;
  treeShaking?: boolean;
  platform?: 'browser' | 'node' | 'neutral';
  target?: string | string[];
  watch?: boolean;
  clean?: boolean;
  /** Run tsc before the bundlers, for the declarations `exports.types` points at. */
  tsc?: TscConfig;
  rollup?: any;
  esbuild?: any;
  [key: string]: any;
}

export type MIxConfig = Record<'rollup' | 'esbuild', BuilderConfig> & {
  builder?: 'rollup' | 'esbuild' | 'both';
};
/**
 * Deep merge utility that properly handles objects, arrays, and symbols
 * @param objects - Objects to merge (later objects override earlier ones)
 * @returns Merged object
 */
export const merge = <T extends Record<string, any>>(
  ...objects: Partial<T>[]
): T => {
  const result: any = {};

  for (const obj of objects) {
    // Skip null, undefined, or non-object values
    if (!obj || typeof obj !== 'object') continue;

    // Handle regular properties
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        const existing = result[key];

        // Skip undefined values
        if (value === undefined) continue;

        // Merge arrays by concatenating (and removing duplicates for unique arrays)
        if (Array.isArray(value) && Array.isArray(existing)) {
          result[key] = [...existing, ...value];
        }
        // Deep merge objects
        else if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          existing &&
          typeof existing === 'object' &&
          !Array.isArray(existing)
        ) {
          result[key] = merge(existing, value);
        }
        // Override with new value (including null, false, empty string, 0)
        else {
          result[key] = value;
        }
      }
    }

    // Handle symbols
    const symbols = Object.getOwnPropertySymbols(obj);
    for (const symbol of symbols) {
      const value = (obj as any)[symbol];
      const existing = result[symbol];

      // Skip undefined values
      if (value === undefined) continue;

      if (Array.isArray(value) && Array.isArray(existing)) {
        result[symbol] = [...existing, ...value];
      } else if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        existing &&
        typeof existing === 'object' &&
        !Array.isArray(existing)
      ) {
        result[symbol] = merge(existing, value);
      } else {
        result[symbol] = value;
      }
    }
  }

  return result as T;
};

/**
 * Removes duplicate values from an array
 * @param arr - Array to deduplicate
 * @returns Array with unique values
 */
export const unique = <T>(arr: T[]): T[] => {
  return Array.from(new Set(arr));
};

/**
 * Validates that a value matches expected type
 * @param value - Value to validate
 * @param expectedType - Expected type name
 * @returns True if valid
 */
export const validateType = (value: any, expectedType: string): boolean => {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return (
        typeof value === 'object' && !Array.isArray(value) && value !== null
      );
    default:
      return false;
  }
};

/**
 * Load configuration from build-config.json file
 */
export function loadConfigFile(
  configFileName?: string,
  cliArgs?: any
): MIxConfig | null {
  const name = configFileName || 'build-config.json';
  const dir = cliArgs?.baseDir || cwd();

  try {
    const configPath = resolveFrom(dir, name);
    if (!existsSync(configPath)) {
      return null;
    }

    const content = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);

    return parsed;
  } catch (error) {
    if ((error as any).code !== 'ENOENT') {
      console.error(
        chalk.red(`Error loading config file ${name}:`),
        (error as Error).message
      );
    }
    return null;
  }
}

/**
 * Validate builder configuration
 */
export function validateConfig(config: BuilderConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate builder selection
  if (
    config.builder &&
    !['rollup', 'esbuild', 'both'].includes(config.builder)
  ) {
    errors.push(
      `Invalid builder: ${config.builder}. Must be 'rollup', 'esbuild', or 'both'`
    );
  }

  // Validate formats
  if (config.formats && Array.isArray(config.formats)) {
    const validFormats = ['es', 'esm', 'cjs', 'umd', 'iife'];
    const invalidFormats = config.formats.filter(
      (f) => !validFormats.includes(f)
    );
    if (invalidFormats.length > 0) {
      errors.push(
        `Invalid formats: ${invalidFormats.join(
          ', '
        )}. Valid formats: ${validFormats.join(', ')}`
      );
    }
  }

  // Validate platform
  if (
    config.platform &&
    !['browser', 'node', 'neutral'].includes(config.platform)
  ) {
    errors.push(
      `Invalid platform: ${config.platform}. Must be 'browser', 'node', or 'neutral'`
    );
  }

  // Validate nodeEnv
  if (
    config.nodeEnv &&
    !['development', 'production'].includes(config.nodeEnv)
  ) {
    errors.push(
      `Invalid nodeEnv: ${config.nodeEnv}. Must be 'development' or 'production'`
    );
  }

  // Validate entries exist for selected builders
  if (config.builder === 'rollup' || config.builder === 'both') {
    if (!config.rollup || !config.rollup.entries) {
      errors.push('Rollup configuration requires entries');
    }
  }

  if (config.builder === 'esbuild' || config.builder === 'both') {
    if (!config.esbuild || !config.esbuild.entries) {
      errors.push('ESBuild configuration requires entries');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Display configuration summary
 */
export function displayConfigSummary(config: BuilderConfig): void {
  console.log(chalk.cyan('\n📋 Build Configuration Summary:\n'));

  const summary: [string, string][] = [];

  if (config.builder) {
    summary.push(['Builder', config.builder]);
  }

  if (config.outdir) {
    summary.push(['Output Directory', config.outdir]);
  }

  if (config.formats && config.formats.length > 0) {
    summary.push(['Formats', config.formats.join(', ')]);
  }

  if (config.platform) {
    summary.push(['Platform', config.platform]);
  }

  if (config.target) {
    summary.push([
      'Target',
      Array.isArray(config.target) ? config.target.join(', ') : config.target,
    ]);
  }

  if (config.nodeEnv) {
    summary.push(['Environment', config.nodeEnv]);
  }

  // Boolean flags
  const flags: [string, boolean | undefined][] = [
    ['Minify', config.minify],
    ['Source Maps', !!config.sourcemap],
    ['Bundle', config.bundle],
    ['Code Splitting', config.splitting],
    ['Tree Shaking', config.treeShaking],
    ['TypeScript Declarations', config.dts],
    ['Copy package.json', config.copy_pkg],
    ['React External', config.reactExternal],
    ['Lit External', config.litExternal],
    ['Library External', config.libExternal],
    ['Debug Mode', config.debug],
    ['Watch Mode', config.watch],
  ];

  flags.forEach(([key, value]) => {
    if (value !== undefined) {
      summary.push([key, value ? 'Yes' : 'No']);
    }
  });

  if (config.externals && config.externals.length > 0) {
    summary.push(['Externals', config.externals.join(', ')]);
  }

  const maxKeyLength = Math.max(...summary.map(([key]) => key.length));
  summary.forEach(([key, value]) => {
    console.log(
      `  ${chalk.gray(key.padEnd(maxKeyLength))}: ${chalk.white(value)}`
    );
  });

  // Display builder-specific entry counts
  if (config.rollup && config.rollup.entries) {
    const entryCount = Array.isArray(config.rollup.entries)
      ? config.rollup.entries.length
      : Object.keys(config.rollup.entries).length;
    console.log(
      chalk.gray(`\n  Rollup Entries: ${chalk.white(String(entryCount))}`)
    );
  }

  if (config.esbuild && config.esbuild.entries) {
    const entryCount = Array.isArray(config.esbuild.entries)
      ? config.esbuild.entries.length
      : Object.keys(config.esbuild.entries).length;
    console.log(
      chalk.gray(`  ESBuild Entries: ${chalk.white(String(entryCount))}`)
    );
  }

  console.log();
}

/**
 * Get builder-specific configuration
 */
export function getBuilderConfig(
  config: BuilderConfig,
  builder: 'rollup' | 'esbuild'
): any {
  const baseConfig = {
    outdir: config.outdir,
    rootDir: config.rootDir,
    formats: config.formats,
    extensions: config.extensions,
    externals: config.externals,
    reactExternal: config.reactExternal,
    litExternal: config.litExternal,
    libExternal: config.libExternal,
    pkgExternal: config.pkgExternal,
    skipExternal: config.skipExternal,
    nodeEnv: config.nodeEnv,
    debug: config.debug,
    log: config.log,
    dts: config.dts,
    copy_pkg: config.copy_pkg,
  };

  const builderSpecific = config[builder] || {};

  return merge(baseConfig, builderSpecific);
}

/**
 * Format file size for display
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

/**
 * Create progress indicator
 */
export function createProgressIndicator(total: number) {
  let current = 0;
  const startTime = Date.now();

  return {
    increment() {
      current++;
      const percent = Math.round((current / total) * 100);
      const elapsed = Date.now() - startTime;
      const avgTime = elapsed / current;
      const remaining = Math.round((total - current) * avgTime);

      return {
        current,
        total,
        percent,
        elapsed,
        remaining,
      };
    },
    finish() {
      return {
        current: total,
        total,
        percent: 100,
        elapsed: Date.now() - startTime,
        remaining: 0,
      };
    },
  };
}
