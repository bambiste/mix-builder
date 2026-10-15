/**
 * @fileoverview NPM package publisher
 * @description Handles publishing packages to npm with version management, error recovery, and progress tracking
 * @version 2.0.0
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import * as glob from 'fast-glob';
import * as path from 'path';
import { cwd } from 'process';
import ora, { Ora } from 'ora';
import chalk from 'chalk';
import logUpdate from 'log-update';
import {
  loadVersionHistory,
  saveVersionHistory,
  determineTag,
} from './version.js';
import { parseProcessArgs } from '../arguments/index.js';
import { merge, PUBLISH_PROPS_CONFIG } from './utils.js';
import { resolveFrom } from '../utils/resolver.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Package dependency types
 */
type DependencyType = 'dependencies' | 'devDependencies' | 'peerDependencies';

/**
 * Version increment types
 */
type VersionType = 'major' | 'minor' | 'patch';

/**
 * Publication tag types
 */
type PublishTag = 'latest' | 'next' | 'beta' | 'alpha' | 'canary' | string;

/**
 * Build configuration interface matching the JSON schema
 */
export interface BuildConfig {
  /** List of package names to publish */
  packages: string[];
  /** Directory paths to exclude from discovery */
  excluded: string[];
  /** Package names to exclude from publishing */
  excluded_packages: string[];
  /** Path to build configuration file */
  buildConfigFile?: string;
  /** Enable global build before publishing */
  global_build?: boolean;
  /** Enable individual package builds */
  package_build?: boolean;
  /** Version increment type (major, minor, patch) */
  type?: VersionType;
  /** NPM tag for publication */
  tag?: PublishTag;
  /** Base version to increment from */
  version?: string;
  /** Version suffix (e.g., 'beta', 'rc.1') */
  suffix?: string;
  /** NPM registry URL */
  registry?: string;
  /** Glob pattern for finding package.json files */
  content: string;
  /** Directory containing packages (default: 'packages') */
  packages_dir?: string;
  /** Base path for resolving files */
  basePath?: string;
  /** Whether to use public or restricted access */
  access?: 'public' | 'restricted';
  /** Dry run mode - don't actually publish */
  dryRun?: boolean;
  /** Skip build step */
  skipBuild?: boolean;
  /** Timeout for build/publish operations in ms */
  timeout?: number;
  /** Test mode - don't actually publish */
  testMode?: boolean;
  /** Whether the publish is scoped */
  scoped?: boolean;
}

/**
 * Package.json structure
 */
interface PackageJson {
  name: string;
  version: string;
  description?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Publication state for recovery
 */
interface PublishState {
  completedPackages: Set<string>;
  currentVersion: string;
  interrupted: boolean;
  startTime: number;
  failedPackages: Map<string, string>;
}

/**
 * Progress tracking
 */
interface ProgressTracker {
  total: number;
  current: number;
  currentPackage: string;
  status: string;
  startTime: number;
  estimatedTimeRemaining: number;
}

/**
 * Publication result
 */
interface PublishResult {
  packageName: string;
  version: string;
  success: boolean;
  error?: string;
  duration: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATE_FILE = '.publish-state.json';
const DEFAULT_PACKAGES_DIR = 'packages';
const DEFAULT_TIMEOUT = 300000; // 5 minutes
const DEFAULT_ACCESS = 'restricted';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Global publication state
 */
const publishState: PublishState = {
  completedPackages: new Set(),
  currentVersion: '',
  interrupted: false,
  startTime: Date.now(),
  failedPackages: new Map(),
};

/**
 * Load previous publication state from disk
 * @returns {boolean} True if state was loaded successfully
 */
function loadState(): boolean {
  try {
    if (!existsSync(STATE_FILE)) {
      return false;
    }

    const savedState = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    publishState.completedPackages = new Set(
      savedState.completedPackages || []
    );
    publishState.currentVersion = savedState.currentVersion || '';
    publishState.startTime = savedState.startTime || Date.now();
    publishState.failedPackages = new Map(
      Object.entries(savedState.failedPackages || {})
    );

    if (publishState.completedPackages.size > 0) {
      console.log(chalk.yellow('\n📦 Found interrupted publish state:'));
      console.log(
        chalk.dim(
          `  Completed: ${publishState.completedPackages.size} packages`
        )
      );
      console.log(chalk.dim(`  Version: ${publishState.currentVersion}`));
      if (publishState.failedPackages.size > 0) {
        console.log(
          chalk.red(`  Failed: ${publishState.failedPackages.size} packages`)
        );
      }
      console.log();
      return true;
    }

    return false;
  } catch (err) {
    console.warn(chalk.yellow('⚠️  Could not load previous state'));
    return false;
  }
}

/**
 * Save current publication state to disk
 */
function saveState(): void {
  try {
    const state = {
      completedPackages: Array.from(publishState.completedPackages),
      currentVersion: publishState.currentVersion,
      startTime: publishState.startTime,
      failedPackages: Object.fromEntries(publishState.failedPackages),
    };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn(chalk.yellow('⚠️  Could not save state'));
  }
}

/**
 * Clean up state file
 */
function cleanupState(): void {
  try {
    if (existsSync(STATE_FILE)) {
      unlinkSync(STATE_FILE);
    }
  } catch (err) {
    // Ignore cleanup errors
  }
}

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

/**
 * Validate build configuration
 * @param {BuildConfig} config - Configuration to validate
 * @throws {Error} If configuration is invalid
 */
function validateConfig(config: BuildConfig): void {
  const errors: string[] = [];

  if (!config.packages || config.packages.length === 0) {
    errors.push('packages array is required and must not be empty');
  }

  if (!config.content) {
    errors.push('content (glob pattern) is required');
  }

  if (!Array.isArray(config.excluded)) {
    errors.push('excluded must be an array');
  }

  if (!Array.isArray(config.excluded_packages)) {
    errors.push('excluded_packages must be an array');
  }

  if (config.type && !['major', 'minor', 'patch'].includes(config.type)) {
    errors.push('type must be one of: major, minor, patch');
  }

  if (config.version && !/^\d+\.\d+\.\d+/.test(config.version)) {
    errors.push('version must be in semver format (x.y.z)');
  }

  if (config.timeout && (config.timeout < 0 || config.timeout > 3600000)) {
    errors.push('timeout must be between 0 and 3600000 (1 hour)');
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid configuration:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }
}

/**
 * Load configuration file from disk
 * @param {string} [fileName] - Configuration file name
 * @returns {BuildConfig | null} Loaded configuration or null
 */
function loadConfigFile(fileName?: string): BuildConfig | null {
  const name = fileName || 'package-publish.json';
  const fp = path.join(cwd(), name);

  if (!existsSync(fp)) {
    console.warn(chalk.yellow(`⚠️  Config file not found: ${name}`));
    return null;
  }

  try {
    const content = readFileSync(resolveFrom(cwd(), name), 'utf-8');
    const parsed = JSON.parse(content) as BuildConfig;

    // Validate the loaded config
    validateConfig(parsed);

    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${name}`);
    }
    throw err;
  }
}

/**
 * Parse and merge build options from command line and config file
 * @returns {BuildConfig} Merged configuration
 */
function parseAndMergeOptions(): BuildConfig {
  const args = parseProcessArgs<Partial<BuildConfig>>(process.argv, [
    ...PUBLISH_PROPS_CONFIG,
  ]);

  const fileConfig = loadConfigFile(args.buildConfigFile);

  if (fileConfig) {
    const merged = merge(args, fileConfig) as BuildConfig;
    validateConfig(merged);
    return merged;
  }

  // Use args only, with defaults
  const config: BuildConfig = {
    packages: args.packages || [],
    excluded: args.excluded || [],
    excluded_packages: args.excluded_packages || [],
    content: args.content || `**/${DEFAULT_PACKAGES_DIR}/*/package.json`,
    packages_dir: args.packages_dir || DEFAULT_PACKAGES_DIR,
    basePath: args.basePath || cwd(),
    global_build: args.global_build ?? true,
    package_build: args.package_build ?? true,
    type: args.type || 'patch',
    tag: args.tag || 'latest',
    version: args.version,
    suffix: args.suffix || '',
    registry: args.registry,
    access: args.access || DEFAULT_ACCESS,
    dryRun: args.dryRun || false,
    skipBuild: args.skipBuild || false,
    timeout: args.timeout || DEFAULT_TIMEOUT,
  };

  validateConfig(config);
  return config;
}

// ============================================================================
// VERSION MANAGEMENT
// ============================================================================

/**
 * Increment version according to semver rules
 * @param {string} version - Current version
 * @param {VersionType} type - Increment type
 * @param {string} suffix - Optional suffix
 * @returns {string} New version
 */
function incrementVersion(
  version: string,
  type: VersionType,
  suffix: string
): string {
  // Extract base version and existing suffix
  const [baseVersion, existingSuffix] = version.split('-');
  const parts = baseVersion.split('.').map(Number);

  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const [major, minor, patch] = parts;

  let newVersion: string;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
    default:
      throw new Error(`Unknown version type: ${type}`);
  }

  return suffix ? `${newVersion}-${suffix}` : newVersion;
}

// ============================================================================
// PACKAGE MANAGEMENT
// ============================================================================

/**
 * Load and parse package.json
 * @param {string} filePath - Path to package.json
 * @returns {PackageJson} Parsed package.json
 */
function loadPackageJson(filePath: string): PackageJson {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as PackageJson;
  } catch (err) {
    throw new Error(`Failed to load package.json: ${filePath}`);
  }
}

/**
 * Update package dependencies to new version
 * @param {PackageJson} pkg - Package to update
 * @param {string[]} workspacePackages - List of workspace package names
 * @param {string} newVersion - Version to set
 */
function updateDependencies(
  pkg: PackageJson,
  workspacePackages: string[],
  newVersion: string
): void {
  const depTypes: DependencyType[] = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
  ];

  depTypes.forEach((depType) => {
    const deps = pkg[depType];
    if (deps) {
      Object.keys(deps).forEach((dep) => {
        if (workspacePackages.includes(dep)) {
          if (
            deps[dep] === 'workspace:*' ||
            deps[dep].startsWith('workspace:')
          ) {
            deps[dep] = newVersion;
          }
        }
      });
    }
  });
}

/**
 * Execute command with timeout
 * @param {string} command - Command to execute
 * @param {object} options - Execution options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Buffer} Command output
 */
function execWithTimeout(
  command: string,
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
  config: BuildConfig
): Buffer {
  if (config.testMode) {
    console.log(`Test mode enabled, skipping command execution: ${command}`);
    return Buffer.from('');
  }
  const timeout = config.timeout || DEFAULT_TIMEOUT;
  try {
    return execSync(command, {
      stdio: 'pipe',
      // timeout,
      ...options,
    });
  } catch (err: any) {
    if (err.killed) {
      throw new Error(`Command timed out after ${timeout}ms: ${command}`);
    }
    throw err;
  }
}

/**
 * Discover package.json files
 * @param {BuildConfig} config - Build configuration
 * @returns {string[]} Array of package.json file paths
 */
function discoverPackages(config: BuildConfig): string[] {
  const basePath = config.basePath || cwd();
  if (config.scoped) {
    // Scoped packages mean that the process only affects the current package
    const packageJsonPath = path.join(basePath, 'package.json');
    if (existsSync(packageJsonPath)) {
      return [packageJsonPath];
    }
    throw new Error('Scoped packages must be run from a package directory');
  }
  const packagesDir = config.packages_dir || DEFAULT_PACKAGES_DIR;
  const globPath = resolveFrom(basePath, config.content);

  const ignorePatterns = [
    path.join(basePath, packagesDir, '**', 'node_modules', '**'),
    path.join(basePath, packagesDir, '**', 'dist', '**'),
    path.join(basePath, packagesDir, '**', 'build', '**'),
    path.join(basePath, packagesDir, '**', '.nx', '**'),
  ];

  const packageFiles = glob.sync(globPath, {
    ignore: ignorePatterns,
  });

  // Filter out excluded paths
  return packageFiles.filter((filePath) => {
    return !config.excluded.some(
      (ex) => `${basePath}/${packagesDir}/${ex}/package.json` === filePath
    );
  });
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

/**
 * Create progress tracker
 * @param {number} total - Total number of packages
 * @returns {ProgressTracker} Progress tracker instance
 */
function createProgressTracker(total: number): ProgressTracker {
  return {
    total,
    current: 0,
    currentPackage: '',
    status: 'initializing',
    startTime: Date.now(),
    estimatedTimeRemaining: 0,
  };
}

/**
 * Update progress display
 * @param {ProgressTracker} progress - Progress tracker
 * @param {string} [status] - Current status message
 * @param {string} [title] - Progress title
 */
function updateProgress(
  progress: ProgressTracker,
  status?: string,
  title?: string
): void {
  const percent = Math.round((progress.current / progress.total) * 100) || 0;
  const bar = '█'.repeat(Math.round(percent / 2)).padEnd(50, '░');

  const elapsed = Date.now() - progress.startTime;
  const avgTimePerPackage =
    progress.current > 0 ? elapsed / progress.current : 0;
  const remaining = (progress.total - progress.current) * avgTimePerPackage;
  const remainingMin = Math.ceil(remaining / 60000);

  logUpdate(`
${chalk.bold(title || '📦 Publishing Packages')}
${bar} ${percent}% (${progress.current}/${progress.total})
${chalk.cyan(progress.currentPackage)}
${chalk.dim(status || progress.status)}
${remainingMin > 0 ? chalk.dim(`~${remainingMin} min remaining`) : ''}
  `);
}

// ============================================================================
// PUBLISHING
// ============================================================================

/**
 * Build individual package
 * @param {string} packageDir - Package directory
 * @param {PackageJson} pkg - Package metadata
 * @param {number} timeout - Build timeout
 * @returns {Promise<void>}
 */
async function buildPackage(
  packageDir: string,
  pkg: PackageJson,
  config: BuildConfig
): Promise<void> {
  if (!pkg.scripts?.build) {
    return; // No build script
  }

  try {
    execWithTimeout(`cd ${packageDir} && pnpm run build`, {}, config);
  } catch (err: any) {
    throw new Error(`Build failed: ${err.message}`);
  }
}

/**
 * Pack package
 * @param {string} packageDir - Package directory
 * @param {PackageJson} pkg - Package metadata
 * @param {number} timeout - Pack timeout
 * @returns {Promise<string>} Path to packed tarball
 */
async function packPackage(
  packageDir: string,
  pkg: PackageJson,
  timeout: number,
  config: BuildConfig
): Promise<string | null> {
  if (config.testMode) {
    console.log(`Test mode: Skipping pack of ${pkg.name}@${pkg.version}`);
    return null;
  }

  try {
    const command =
      pkg.name === 'vscode-intellisense'
        ? `cd ${packageDir} && pnpm run pack`
        : `cd ${packageDir} && pnpm pack`;

    execWithTimeout(command, {}, config);

    // Return tarball name
    const tarballName = `${pkg.name.replace('@', '').replace('/', '-')}-${
      pkg.version
    }.tgz`;
    return path.join(packageDir, tarballName);
  } catch (err: any) {
    throw new Error(`Pack failed: ${err.message}`);
  }
}

/**
 * Publish package to npm
 * @param {string} packageDir - Package directory
 * @param {PackageJson} pkg - Package metadata
 * @param {BuildConfig} config - Build configuration
 * @param {number} timeout - Publish timeout
 * @returns {Promise<void>}
 */
function publishPackage(
  packageDir: string,
  pkg: PackageJson,
  config: BuildConfig
): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    if (config.testMode) {
      console.log(`Test mode: Skipping publish of ${pkg.name}@${pkg.version}`);
      resolve(undefined);
    }
    const access = config.access || DEFAULT_ACCESS;
    const tag = config.tag || 'latest';

    let command = `cd ${packageDir} && pnpm publish --access ${access} --no-git-checks --tag ${tag}`;

    if (config.registry) {
      command += ` --registry ${config.registry}`;
    }

    if (config.dryRun) {
      command += ' --dry-run';
    }

    // let command = `cd ${packageDir} && pnpm run build`;
    try {
      const buffer = execWithTimeout(command, {}, config);
      resolve(buffer);
    } catch (err: any) {
      console.log('promise rejected', err);
      // throw new Error(`Publish failed: ${err.message}`);
      reject(Error(`Publish failed: ${err.message}`));
    }
  });
}

/**
 * Process single package
 * @param {string} filePath - Path to package.json
 * @param {BuildConfig} config - Build configuration
 * @param {string} newVersion - New version to publish
 * @param {ProgressTracker} progress - Progress tracker
 * @returns {Promise<PublishResult>}
 */
async function processPackage(
  filePath: string,
  config: BuildConfig,
  newVersion: string,
  progress: ProgressTracker
): Promise<PublishResult> {
  const startTime = Date.now();
  const originalContent = readFileSync(filePath, 'utf-8');
  const pkg = loadPackageJson(filePath);
  const packageDir = path.dirname(filePath);

  const result: PublishResult = {
    packageName: pkg.name,
    version: newVersion,
    success: false,
    duration: 0,
  };

  try {
    // Skip if already completed
    if (publishState.completedPackages.has(pkg.name)) {
      result.success = true;
      result.duration = Date.now() - startTime;
      return result;
    }

    // Skip if not in package list
    if (!config.packages.includes(pkg.name) && !config.scoped) {
      updateProgress(
        progress,
        'Skipped (not in package list)',
        `Skipping ${pkg.name}...`
      );
      result.success = true;
      result.duration = Date.now() - startTime;
      return result;
    }

    // Skip if private
    if (pkg.private) {
      updateProgress(
        progress,
        'Skipped (private package)',
        `Skipping ${pkg.name}...`
      );
      result.success = true;
      result.duration = Date.now() - startTime;
      return result;
    }

    progress.currentPackage = chalk.bold(pkg.name);
    updateProgress(progress, 'Processing...', `Processing ${pkg.name}...`);

    // Update dependencies
    if (pkg.name !== 'vscode-intellisense') {
      updateDependencies(pkg, config.packages, newVersion);
    }

    // Build package
    if (config.package_build && !config.skipBuild) {
      updateProgress(progress, 'Building...', `Building ${pkg.name}...`);
      await buildPackage(packageDir, pkg, config);
    }

    // Update version
    pkg.version = newVersion;
    if (config.testMode) {
      console.log(`Test mode enabled, skipping write`);
    } else {
      writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
    }

    // Pack package
    updateProgress(progress, 'Packing...', `Packing ${pkg.name}...`);
    await packPackage(
      packageDir,
      pkg,
      config.timeout || DEFAULT_TIMEOUT,
      config
    );

    // Publish package
    if (pkg.name !== 'vscode-intellisense') {
      updateProgress(
        progress,
        `Publishing version ${newVersion}...`,
        `Publishing ${pkg.name}...`
      );
      await publishPackage(packageDir, pkg, config);

      updateProgress(
        progress,
        chalk.green('✓ Successfully published'),
        `${pkg.name} published successfully ✨`
      );
      console.log('update progress done');

      publishState.completedPackages.add(pkg.name);
      saveState();
    }

    result.success = true;
    result.duration = Date.now() - startTime;
  } catch (err: any) {
    result.success = false;
    result.error = err.message;
    result.duration = Date.now() - startTime;

    publishState.failedPackages.set(pkg.name, err.message);
    updateProgress(progress, chalk.red(`✗ Error: ${err.message}`));

    return result;
  } finally {
    // Restore original package.json
    try {
      if (config.testMode) {
        console.log(`Test mode enabled, skipping write`);
      } else {
        writeFileSync(filePath, originalContent);
      }

      if (config.testMode) {
        console.log(`Test mode enabled, skipping cleanup`);
      } else {
        // Cleanup tarball
        if (pkg.name !== 'vscode-intellisense') {
          execSync(`cd ${packageDir} && rm -f *.tgz`, { stdio: 'pipe' });
        }
      }
    } catch (cleanupErr) {
      console.warn(chalk.yellow(`⚠️  Cleanup failed for ${pkg.name}`));
    }
  }
  return result;
}

// ============================================================================
// MAIN PUBLISHING LOGIC
// ============================================================================

/**
 * Run global build
 * @param {BuildConfig} config - Build configuration
 * @param {Ora} spinner - Spinner instance
 * @returns {Promise<void>}
 */
async function runGlobalBuild(
  config: BuildConfig,
  spinner: Ora
): Promise<void> {
  if (!config.global_build || config.skipBuild) {
    return;
  }

  spinner.start('Running global build...');

  try {
    const filter = config.excluded_packages
      .map((e) => `--filter=!${e}`)
      .join(' ');

    if (config.testMode) {
      console.log(`Test mode enabled, skipping global build`);
    } else {
      execWithTimeout(
        'pnpm build:except',
        { env: { ...process.env, FILTER: filter } },
        config
      );
    }

    spinner.succeed('Global build completed');
  } catch (err: any) {
    spinner.fail('Global build failed');
    throw new Error(`Global build failed: ${err.message}`);
  }
}

/**
 * Main publishing function
 * @param externalConfig - Optional configuration to merge with parsed args and config file
 * @returns {Promise<void>}
 */
export async function publishPackages(
  externalConfig?: Partial<BuildConfig>
): Promise<void> {
  console.log(chalk.bold.cyan('\n🚀 NPM Package Publisher\n'));
  let config: BuildConfig;
  try {
    config = parseAndMergeOptions();

    // Merge external config if provided (from CLI or other sources)
    if (externalConfig) {
      config = merge(config, externalConfig) as BuildConfig;
      validateConfig(config);
    }
  } catch (err: any) {
    console.error(chalk.red('❌ Configuration error:'));
    console.error(chalk.red(err.message));
    process.exit(1);
  }
  // console.log('publish config', config);

  if (config.testMode) {
    console.log(chalk.bold.cyan('\nTest Mode Enabled ⚠️\n'));
  }
  if (config.scoped) {
    console.log(chalk.bold.cyan('\nScoped Packages Enabled 🎯\n'));
  }
  // Load version history
  const versionHistory = loadVersionHistory();
  const lastVersion = config.version || versionHistory.lastVersion || '0.0.0';
  const versionType = config.type || 'patch';
  const suffix = config.suffix || '';
  const tag = determineTag(config as any);

  // Display configuration
  console.log(chalk.dim('Configuration:'));
  console.log(chalk.cyan('  Version type:'), versionType);
  console.log(chalk.cyan('  Suffix:'), suffix || '(none)');
  console.log(chalk.cyan('  Previous version:'), lastVersion);
  console.log(chalk.cyan('  Tag:'), tag);
  console.log(chalk.cyan('  Access:'), config.access || DEFAULT_ACCESS);
  console.log(chalk.cyan('  Registry:'), config.registry || 'default');
  console.log(chalk.cyan('  Dry run:'), config.dryRun ? 'yes' : 'no');

  if (versionHistory.lastPublishDate) {
    console.log(
      chalk.cyan('  Last publish:'),
      new Date(versionHistory.lastPublishDate).toLocaleString()
    );
  }

  // Show recent version history
  if (versionHistory.history.length > 0) {
    console.log(chalk.dim('\nRecent versions:'));
    versionHistory.history.slice(0, 5).forEach((entry: any) => {
      console.log(
        chalk.dim(
          `  ${entry.version} (${entry.tag}) - ${new Date(
            entry.date
          ).toLocaleDateString()}`
        )
      );
    });
  }

  // Load previous state
  const hasResumedState = loadState();

  if (hasResumedState) {
    console.log(chalk.yellow('Resuming previous publish process...\n'));
  }

  const spinner = ora();

  // Handle interruption
  let interruptCount = 0;
  process.on('SIGINT', () => {
    interruptCount++;
    if (interruptCount === 1) {
      publishState.interrupted = true;
      console.log(
        chalk.yellow('\n⚠️  Interrupting - finishing current package...')
      );
      console.log(chalk.dim('Press Ctrl+C again to force exit\n'));
    } else {
      console.log(chalk.red('\n❌ Forced exit - progress saved'));
      saveState();
      process.exit(1);
    }
  });

  try {
    // Discover packages
    const packageFiles = discoverPackages(config);

    if (packageFiles.length === 0) {
      console.warn(chalk.yellow('⚠️  No packages found'));
      return;
    }

    const progress = createProgressTracker(packageFiles.length);
    const newVersion = incrementVersion(lastVersion, versionType, suffix);
    publishState.currentVersion = newVersion;

    updateProgress(
      progress,
      `Preparing to publish ${packageFiles.length} packages`,
      `Version ${lastVersion} → ${newVersion}`
    );

    // Run global build
    if (publishState.completedPackages.size === 0) {
      await runGlobalBuild(config, spinner);
    }

    // Process each package
    const results: PublishResult[] = [];

    for (const filePath of packageFiles) {
      if (publishState.interrupted) {
        console.log(
          chalk.yellow('\n⚠️  Publishing interrupted - progress saved')
        );
        saveState();
        process.exit(1);
      }

      progress.current++;
      const result = await processPackage(
        filePath,
        config,
        newVersion,
        progress
      );
      results.push(result);
    }

    // Save version history
    if (!config.dryRun) {
      saveVersionHistory({ version: newVersion, tag, suffix, versionType });
    }

    // Cleanup state
    cleanupState();
    logUpdate.clear();

    // Display results
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(chalk.bold.green('\n✨ Publication complete!\n'));
    console.log(chalk.cyan(`Version: ${newVersion}`));
    console.log(chalk.cyan(`Tag: ${tag}`));
    console.log(chalk.green(`Successful: ${successful}`));

    if (failed > 0) {
      console.log(chalk.red(`Failed: ${failed}`));
      console.log(chalk.dim('\nFailed packages:'));
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(chalk.red(`  ✗ ${r.packageName}: ${r.error}`));
        });
      process.exit(1);
    }

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    console.log(
      chalk.dim(`\nTotal time: ${Math.round(totalDuration / 1000)}s\n`)
    );
  } catch (err: any) {
    saveState();
    logUpdate.clear();
    console.error(chalk.red('\n❌ Publication failed:\n'));
    console.error(chalk.red(err.message));
    console.error(
      chalk.dim('\nProgress has been saved. Run again to resume.\n')
    );
    process.exit(1);
  }
}
