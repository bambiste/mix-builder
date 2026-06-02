/**
 * Advanced External Resolver for Mix Builder
 * Supports strings, regex patterns, functions, and complex configurations
 */

import {
  legacyLitExternals,
  legacyReactExternals,
  libExternals,
} from './base.js';

/**
 * External pattern types supported
 */
export type ExternalPattern =
  | string
  | RegExp
  | ((id: string, importer?: string) => boolean);

/**
 * External configuration object
 */
export interface ExternalConfig {
  /**
   * Package name or pattern
   */
  pattern: ExternalPattern;

  /**
   * Whether to include sub-paths (e.g., 'react' -> 'react/*')
   */
  includeSub?: boolean;

  /**
   * Condition for when to apply this external
   */
  condition?: (id: string, importer?: string) => boolean;

  /**
   * Description for documentation
   */
  description?: string;
}

/**
 * External definition - can be string, regex, function, or config object
 */
export type ExternalDefinition =
  | string
  | RegExp
  | ExternalConfig
  | ((id: string, importer?: string) => boolean);

/**
 * Predefined external presets
 */
export const EXTERNAL_PRESETS = {
  /**
   * React and related packages
   */
  react: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom/client',
    'react-dom/server',
    /^react($|\/)/,
    /^react-dom($|\/)/,
  ] as ExternalDefinition[],

  /**
   * Lit and web components
   */
  lit: [
    'lit',
    'lit-html',
    'lit-element',
    '@lit/reactive-element',
    /^lit($|\/)/,
    /^lit-html($|\/)/,
    /^lit-element($|\/)/,
    /^@lit($|\/)/,
  ] as ExternalDefinition[],

  /**
   * Common library patterns
   */
  lib: [/^@awc($|\/)/, /^@adafri($|\/)/] as ExternalDefinition[],

  /**
   * Node.js built-in modules
   */
  node: [
    'fs',
    'path',
    'crypto',
    'http',
    'https',
    'stream',
    'util',
    'buffer',
    'events',
    'os',
    'process',
    'child_process',
    'url',
    'querystring',
    'zlib',
    /^node:/,
  ] as ExternalDefinition[],

  /**
   * Build tool and native modules
   */
  native: [/\.node$/, /^native\//] as ExternalDefinition[],

  /**
   * Common development dependencies
   */
  devDeps: [
    /^@types\//,
    /^@typescript-eslint\//,
    /^eslint/,
    /^prettier/,
    /^jest/,
    /^vitest/,
    /^@testing-library\//,
  ] as ExternalDefinition[],
} as const;

/**
 * External resolver options
 */
export interface ExternalResolverOptions {
  /**
   * External patterns to apply
   */
  externals?: ExternalDefinition[];

  /**
   * Include React as external
   */
  reactExternal?: boolean;

  /**
   * Include Lit as external
   */
  litExternal?: boolean;

  /**
   * Include library packages as external
   */
  libExternal?: boolean;

  /**
   * Include Node.js built-ins as external
   */
  nodeExternal?: boolean;

  /**
   * Use package.json dependencies as externals
   */
  pkgExternal?: boolean;

  /**
   * Package.json dependencies
   */
  dependencies?: Record<string, string>;

  /**
   * Package.json peer dependencies
   */
  peerDependencies?: Record<string, string>;

  /**
   * Skip all external processing
   */
  skipExternal?: boolean;

  /**
   * Additional custom patterns
   */
  customPatterns?: ExternalDefinition[];

  /**
   * Format being built (affects behavior)
   */
  format?: 'es' | 'esm' | 'cjs' | 'umd' | 'iife';

  /**
   * Include sub-paths for string patterns
   */
  includeSubPaths?: boolean;
}

/**
 * Convert external definition to testable function
 */
function externalToFunction(
  external: ExternalDefinition
): (id: string, importer?: string) => boolean {
  // Already a function
  if (typeof external === 'function') {
    return external;
  }

  // RegExp pattern
  if (external instanceof RegExp) {
    return (id: string) => external.test(id);
  }

  // String pattern
  if (typeof external === 'string') {
    return (id: string) => {
      return id === external || id.startsWith(`${external}/`);
    };
  }

  // Config object
  if (
    typeof external === 'object' &&
    external !== null &&
    'pattern' in external
  ) {
    const config = external as ExternalConfig;
    const patternTest = externalToFunction(config.pattern);

    return (id: string, importer?: string) => {
      // Check condition if provided
      if (config.condition && !config.condition(id, importer)) {
        return false;
      }

      // Test pattern
      if (!patternTest(id, importer)) {
        return false;
      }

      return true;
    };
  }

  // Unknown type - always false
  return () => false;
}

/**
 * Resolve externals for ESBuild
 * ESBuild expects an array of strings and regex patterns
 */
export function resolveEsbuildExternals(
  options: ExternalResolverOptions
): (string | RegExp)[] {
  if (options.skipExternal) {
    return [];
  }

  const externals: (string | RegExp)[] = [];

  // Add preset externals
  if (options.reactExternal) {
    externals.push(...legacyReactExternals());
    // externals.push(
    //   ...(EXTERNAL_PRESETS.react.filter(
    //     (e) => typeof e === 'string' || e instanceof RegExp
    //   ) as (string | RegExp)[])
    // );
  }

  if (options.litExternal) {
    externals.push(...legacyLitExternals());
    // externals.push(
    //   ...(EXTERNAL_PRESETS.lit.filter(
    //     (e) => typeof e === 'string' || e instanceof RegExp
    //   ) as (string | RegExp)[])
    // );
  }

  if (options.libExternal) {
    externals.push(...libExternals());
    // externals.push(
    //   ...(EXTERNAL_PRESETS.lib.filter(
    //     (e) => typeof e === 'string' || e instanceof RegExp
    //   ) as (string | RegExp)[])
    // );
  }

  if (options.nodeExternal) {
    externals.push(
      ...(EXTERNAL_PRESETS.native.filter((e) => typeof e === 'string') as (
        | string
        | RegExp
      )[])
    );
  }

  // Add package.json dependencies
  if (options.pkgExternal) {
    const deps = [
      ...Object.keys(options.dependencies || {}),
      ...Object.keys(options.peerDependencies || {}),
    ];

    for (const dep of deps) {
      externals.push(dep);
      if (options.includeSubPaths !== false) {
        // externals.push(new RegExp(`^${escapeRegex(dep)}($|\\/)`));
        externals.push(dep);
      }
    }
  }

  // Add custom externals
  if (options.externals) {
    for (const external of options.externals) {
      if (typeof external === 'string') {
        externals.push(external);
        // if (options.includeSubPaths !== false) {
        //   externals.push(new RegExp(`^${escapeRegex(external)}($|\\/)`));
        // }
      }
      // else if (external instanceof RegExp) {
      //   externals.push(external);
      // } else if (typeof external === 'object' && 'pattern' in external) {
      //   const config = external as ExternalConfig;
      //   if (typeof config.pattern === 'string') {
      //     externals.push(config.pattern);
      //     if (
      //       config.includeSub !== false &&
      //       options.includeSubPaths !== false
      //     ) {
      //       externals.push(
      //         new RegExp(`^${escapeRegex(config.pattern)}($|\\/)`)
      //       );
      //     }
      //   } else if (config.pattern instanceof RegExp) {
      //     externals.push(config.pattern);
      //   }
      // }
    }
  }

  // Add custom patterns
  if (options.customPatterns) {
    for (const pattern of options.customPatterns) {
      if (typeof pattern === 'string' || pattern instanceof RegExp) {
        externals.push(pattern);
      }
    }
  }

  // Remove duplicates
  return Array.from(new Set(externals));
}

/**
 * Resolve externals for Rollup
 * Rollup expects a function that returns boolean
 */
export function resolveRollupExternals(
  options: ExternalResolverOptions
): (id: string, importer?: string, isResolved?: boolean) => boolean {
  if (options.skipExternal) {
    return () => false;
  }

  const externalFunctions: ((id: string, importer?: string) => boolean)[] = [];

  // Add preset externals
  if (options.reactExternal) {
    externalFunctions.push(
      ...EXTERNAL_PRESETS.react.map((e) => externalToFunction(e))
    );
  }

  if (options.litExternal) {
    externalFunctions.push(
      ...EXTERNAL_PRESETS.lit.map((e) => externalToFunction(e))
    );
  }

  if (options.libExternal) {
    externalFunctions.push(
      ...EXTERNAL_PRESETS.lib.map((e) => externalToFunction(e))
    );
  }

  if (options.nodeExternal) {
    externalFunctions.push(
      ...EXTERNAL_PRESETS.node.map((e) => externalToFunction(e))
    );
    externalFunctions.push(
      ...EXTERNAL_PRESETS.native.map((e) => externalToFunction(e))
    );
  }

  // Add package.json dependencies
  if (options.pkgExternal) {
    const deps = [
      ...Object.keys(options.dependencies || {}),
      ...Object.keys(options.peerDependencies || {}),
    ];

    for (const dep of deps) {
      if (options.includeSubPaths !== false) {
        externalFunctions.push(
          (id: string) => id === dep || id.startsWith(`${dep}/`)
        );
      } else {
        externalFunctions.push((id: string) => id === dep);
      }
    }
  }

  // Add custom externals
  if (options.externals) {
    externalFunctions.push(
      ...options.externals.map((e) => externalToFunction(e))
    );
  }

  // Add custom patterns
  if (options.customPatterns) {
    externalFunctions.push(
      ...options.customPatterns.map((e) => externalToFunction(e))
    );
  }

  // Return combined function
  return (id: string, importer?: string) => {
    return externalFunctions.some((fn) => fn(id, importer));
  };
}

/**
 * Escape special regex characters in string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create external configuration with smart defaults
 */
export function createExternalConfig(
  options: ExternalResolverOptions
): ExternalResolverOptions {
  return {
    includeSubPaths: true,
    ...options,
  };
}

/**
 * Validate external definition
 */
export function validateExternal(
  external: any
): external is ExternalDefinition {
  if (typeof external === 'string') return true;
  if (external instanceof RegExp) return true;
  if (typeof external === 'function') return true;
  if (
    typeof external === 'object' &&
    external !== null &&
    'pattern' in external
  ) {
    return validateExternal(external.pattern);
  }
  return false;
}

/**
 * Get preset by name
 */
export function getPreset(
  name: keyof typeof EXTERNAL_PRESETS
): ExternalDefinition[] {
  return EXTERNAL_PRESETS[name] || [];
}

/**
 * Combine multiple presets
 */
export function combinePresets(
  ...names: (keyof typeof EXTERNAL_PRESETS)[]
): ExternalDefinition[] {
  return names.flatMap((name) => getPreset(name));
}

/**
 * Test if an id matches any external pattern
 */
export function isExternal(
  id: string,
  externals: ExternalDefinition[],
  importer?: string
): boolean {
  return externals.some((external) => {
    const testFn = externalToFunction(external);
    return testFn(id, importer);
  });
}

/**
 * Convert string array to external definitions with sub-paths
 */
export function stringsToExternals(
  packages: string[],
  includeSubPaths = true
): ExternalDefinition[] {
  if (!includeSubPaths) {
    return packages;
  }

  return packages.flatMap((pkg) => [
    pkg,
    new RegExp(`^${escapeRegex(pkg)}($|\\/)`),
  ]);
}

/**
 * Load package.json and create external config
 */
export function createPkgExternalConfig(
  packageJson: {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  },
  options: Partial<ExternalResolverOptions> = {}
): ExternalResolverOptions {
  return {
    ...options,
    dependencies: packageJson.dependencies,
    peerDependencies: packageJson.peerDependencies,
    pkgExternal: options.pkgExternal ?? true,
  };
}
