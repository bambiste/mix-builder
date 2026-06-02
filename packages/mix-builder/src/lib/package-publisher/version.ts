/**
 * @fileoverview Version Management Utilities
 * @description Handles version history, tag determination, and remote package version queries
 * @version 2.0.0
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import * as path from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Version history entry
 */
interface VersionHistoryEntry {
  version: string;
  tag: string;
  date: string;
  type?: string;
  suffix?: string | null;
}

/**
 * Version history file structure
 */
interface VersionHistory {
  lastVersion: string;
  lastPublishDate: string | null;
  history: VersionHistoryEntry[];
}

/**
 * Options for determining NPM tag
 */
interface DetermineTagOptions {
  tag?: string;
  suffix?: string;
  type?: string;
  version?: string;
}

/**
 * Options for saving version history
 */
interface SaveVersionOptions {
  version: string;
  tag: string;
  versionType?: string;
  suffix?: string;
}

/**
 * Package version map
 */
interface PackageVersionMap {
  [packageName: string]: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VERSION_FILE = '.awc-version.json';
const MAX_HISTORY_ENTRIES = 10;
const DEFAULT_VERSION = '0.0.0';
const FALLBACK_LAST_VERSION = '0.0.0';
// const FALLBACK_LAST_VERSION = '6.0.5';

// Tag detection patterns
const TAG_PATTERNS: Record<string, RegExp> = {
  alpha: /alpha/i,
  beta: /beta/i,
  next: /next/i,
  canary: /canary/i,
  rc: /rc/i,
};

// ============================================================================
// VERSION HISTORY MANAGEMENT
// ============================================================================

/**
 * Load version history from disk
 * @param versionFile - Path to version history file (optional)
 * @returns Version history object with defaults if file doesn't exist
 */
export function loadVersionHistory(
  versionFile: string = VERSION_FILE
): VersionHistory {
  try {
    if (!existsSync(versionFile)) {
      console.log(
        chalk.gray(`No version history found at ${versionFile}, using defaults`)
      );
      return createDefaultHistory();
    }

    const content = readFileSync(versionFile, 'utf8');
    if (!content || content.trim() === '') {
      console.warn(
        chalk.yellow(`Version file ${versionFile} is empty, using defaults`)
      );
      return createDefaultHistory();
    }

    const versionData = JSON.parse(content);

    // Validate structure
    if (!isValidVersionHistory(versionData)) {
      console.warn(
        chalk.yellow(
          `Invalid version history structure in ${versionFile}, using defaults`
        )
      );
      return createDefaultHistory();
    }

    return {
      lastVersion: versionData.lastVersion || FALLBACK_LAST_VERSION,
      lastPublishDate: versionData.lastPublishDate || null,
      history: Array.isArray(versionData.history) ? versionData.history : [],
    };
  } catch (err) {
    const error = err as Error;
    console.warn(
      chalk.yellow(
        `Could not load version history from ${versionFile}: ${error.message}`
      )
    );
    return createDefaultHistory();
  }
}

/**
 * Create default version history
 * @returns Default version history object
 */
function createDefaultHistory(): VersionHistory {
  return {
    lastVersion: FALLBACK_LAST_VERSION,
    lastPublishDate: null,
    history: [],
  };
}

/**
 * Validate version history structure
 * @param data - Data to validate
 * @returns True if valid
 */
function isValidVersionHistory(data: any): data is VersionHistory {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.lastVersion === 'string' &&
    (data.lastPublishDate === null ||
      typeof data.lastPublishDate === 'string') &&
    Array.isArray(data.history)
  );
}

/**
 * Save version history to disk
 * @param options - Version information to save
 * @param versionFile - Path to version history file (optional)
 */
export function saveVersionHistory(
  options: SaveVersionOptions,
  versionFile: string = VERSION_FILE
): void {
  const { version, tag, versionType, suffix } = options;

  // Validate inputs
  if (!version || typeof version !== 'string') {
    throw new Error('Version is required and must be a string');
  }
  if (!tag || typeof tag !== 'string') {
    throw new Error('Tag is required and must be a string');
  }
  if (!isValidSemanticVersion(version)) {
    console.warn(
      chalk.yellow(
        `Version ${version} does not appear to be valid semver, saving anyway`
      )
    );
  }

  try {
    const currentData = loadVersionHistory(versionFile);
    const timestamp = new Date().toISOString();

    const newEntry: VersionHistoryEntry = {
      version,
      tag,
      date: timestamp,
      type: versionType || 'unknown',
      suffix: suffix || null,
    };

    const newHistory: VersionHistory = {
      lastVersion: version,
      lastPublishDate: timestamp,
      history: [newEntry, ...currentData.history].slice(0, MAX_HISTORY_ENTRIES),
    };

    writeFileSync(versionFile, JSON.stringify(newHistory, null, 2), 'utf8');
    console.log(chalk.green(`✓ Version history saved to ${versionFile}`));
  } catch (err) {
    const error = err as Error;
    console.error(
      chalk.red(
        `Failed to save version history to ${versionFile}: ${error.message}`
      )
    );
    throw error;
  }
}

/**
 * Validate semantic version format
 * @param version - Version string to validate
 * @returns True if valid semver
 */
function isValidSemanticVersion(version: string): boolean {
  const semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(version);
}

// ============================================================================
// TAG DETERMINATION
// ============================================================================

/**
 * Determine the appropriate NPM tag based on version and options
 * @param options - Options for tag determination
 * @returns NPM tag string
 */
export function determineTag(options: DetermineTagOptions): string {
  // If tag is explicitly provided, use it (highest priority)
  if (options.tag && options.tag.trim() !== '') {
    return options.tag.trim();
  }

  // If version has a suffix, determine tag from suffix (second priority)
  if (options.suffix && options.suffix.trim() !== '') {
    const tag = detectTagFromSuffix(options.suffix);
    if (tag) {
      console.log(
        chalk.gray(`Auto-detected tag '${tag}' from suffix '${options.suffix}'`)
      );
      return tag;
    }
  }

  // If version string contains pre-release identifier, detect from it
  if (options.version && options.version.includes('-')) {
    const prerelease = options.version.split('-')[1];
    if (prerelease) {
      const tag = detectTagFromSuffix(prerelease);
      if (tag) {
        console.log(
          chalk.gray(
            `Auto-detected tag '${tag}' from version '${options.version}'`
          )
        );
        return tag;
      }
    }
  }

  // Determine tag based on version type (third priority)
  if (options.type) {
    const tag = detectTagFromVersionType(options.type);
    console.log(
      chalk.gray(`Using tag '${tag}' based on version type '${options.type}'`)
    );
    return tag;
  }

  // Default to 'latest' as the safest option
  console.log(chalk.gray(`Using default tag 'latest'`));
  return 'latest';
}

/**
 * Detect appropriate tag from version suffix
 * @param suffix - Version suffix string
 * @returns Detected tag or null
 */
function detectTagFromSuffix(suffix: string): string | null {
  const normalizedSuffix = suffix.toLowerCase().trim();

  // Check against known patterns
  for (const [tag, pattern] of Object.entries(TAG_PATTERNS)) {
    if (pattern.test(normalizedSuffix)) {
      return tag;
    }
  }

  // Special case: if it starts with a number, it might be a pre-release
  if (/^\d/.test(normalizedSuffix)) {
    return 'next';
  }

  // If we have an unrecognized suffix, default to 'next' for safety
  return 'next';
}

/**
 * Detect appropriate tag from version type
 * @param type - Version increment type
 * @returns NPM tag
 */
function detectTagFromVersionType(type: string): string {
  switch (type.toLowerCase()) {
    case 'major':
      // Major versions default to 'next' to allow testing before promoting to 'latest'
      return 'next';
    case 'minor':
    case 'patch':
      // Minor and patch versions are stable enough for 'latest'
      return 'latest';
    default:
      // Unknown types default to 'latest'
      return 'latest';
  }
}

// ============================================================================
// REMOTE VERSION QUERIES
// ============================================================================

/**
 * Get the latest published version of a package from Google Artifact Registry
 * @param packageName - Name of the package to query
 * @param registry - Registry configuration (optional)
 * @returns Package version map
 */
export async function getPackageVersion(
  packageName: string,
  registry?: {
    repository?: string;
    location?: string;
    project?: string;
  }
): Promise<PackageVersionMap> {
  const packageVersions: PackageVersionMap = {};

  if (!packageName || typeof packageName !== 'string') {
    console.error(chalk.red('Package name is required and must be a string'));
    return { [packageName || 'unknown']: DEFAULT_VERSION };
  }

  try {
    // Build the gcloud command with configurable parameters
    const repo = registry?.repository || 'awc';
    const location = registry?.location || 'us-central1';
    const project = registry?.project || 'adafri-backend';

    const versionCommand = `gcloud artifacts versions list \
      --package="${packageName}" \
      --repository="${repo}" \
      --location="${location}" \
      --project="${project}" \
      --format="json" \
      --limit=1 \
      --sort-by="~createTime"`;

    console.log(
      chalk.gray(
        `Querying version for ${packageName} from ${location}/${repo}...`
      )
    );

    const versionOutput = execSync(versionCommand, {
      encoding: 'utf-8',
      timeout: 30000, // 30 second timeout
      stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr unless error
    });

    if (!versionOutput || versionOutput.trim() === '') {
      console.warn(
        chalk.yellow(
          `No version information returned for ${packageName}, using default`
        )
      );
      packageVersions[packageName] = DEFAULT_VERSION;
      return packageVersions;
    }

    const versions = JSON.parse(versionOutput);

    if (!Array.isArray(versions) || versions.length === 0) {
      console.log(
        chalk.gray(
          `No published versions found for ${packageName}, using ${DEFAULT_VERSION}`
        )
      );
      packageVersions[packageName] = DEFAULT_VERSION;
      return packageVersions;
    }

    // Extract version from the name field (format: projects/.../versions/{version})
    const latestVersionEntry = versions[0];
    if (
      !latestVersionEntry ||
      !latestVersionEntry.name ||
      typeof latestVersionEntry.name !== 'string'
    ) {
      console.warn(
        chalk.yellow(
          `Invalid version entry structure for ${packageName}, using default`
        )
      );
      packageVersions[packageName] = DEFAULT_VERSION;
      return packageVersions;
    }

    const versionParts = latestVersionEntry.name.split('/');
    const latestVersion = versionParts[versionParts.length - 1];

    if (!latestVersion || latestVersion.trim() === '') {
      console.warn(
        chalk.yellow(
          `Could not extract version from entry for ${packageName}, using default`
        )
      );
      packageVersions[packageName] = DEFAULT_VERSION;
      return packageVersions;
    }

    packageVersions[packageName] = latestVersion;
    console.log(
      chalk.green(`✓ Found version ${latestVersion} for ${packageName}`)
    );
  } catch (error) {
    const err = error as Error & { code?: string; stderr?: string };

    // Handle specific error cases
    if (err.code === 'ETIMEDOUT') {
      console.error(chalk.red(`Timeout querying version for ${packageName}`));
    } else if (err.stderr && err.stderr.includes('NOT_FOUND')) {
      console.log(
        chalk.gray(
          `Package ${packageName} not found in registry, using ${DEFAULT_VERSION}`
        )
      );
      packageVersions[packageName] = DEFAULT_VERSION;
      return packageVersions;
    } else if (err.stderr && err.stderr.includes('PERMISSION_DENIED')) {
      console.error(
        chalk.red(
          `Permission denied when querying ${packageName}. Check your credentials.`
        )
      );
    } else {
      console.error(
        chalk.red(`Failed to get package version for ${packageName}:`),
        err.message
      );
    }

    // Return default version on error
    packageVersions[packageName] = DEFAULT_VERSION;
  }

  return packageVersions;
}

/**
 * Get versions for multiple packages in parallel
 * @param packageNames - Array of package names
 * @param registry - Registry configuration (optional)
 * @returns Combined package version map
 */
export async function getPackageVersions(
  packageNames: string[],
  registry?: {
    repository?: string;
    location?: string;
    project?: string;
  }
): Promise<PackageVersionMap> {
  if (!Array.isArray(packageNames) || packageNames.length === 0) {
    console.warn(chalk.yellow('No package names provided'));
    return {};
  }

  console.log(
    chalk.cyan(`\nQuerying versions for ${packageNames.length} packages...\n`)
  );

  const results = await Promise.allSettled(
    packageNames.map((name) => getPackageVersion(name, registry))
  );

  const combinedVersions: PackageVersionMap = {};

  results.forEach((result, index) => {
    const packageName = packageNames[index];
    if (result.status === 'fulfilled') {
      Object.assign(combinedVersions, result.value);
    } else {
      console.error(
        chalk.red(`Failed to get version for ${packageName}: ${result.reason}`)
      );
      combinedVersions[packageName] = DEFAULT_VERSION;
    }
  });

  console.log(chalk.cyan('\n✓ Version query complete\n'));
  return combinedVersions;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export { VERSION_FILE, DEFAULT_VERSION, FALLBACK_LAST_VERSION };
