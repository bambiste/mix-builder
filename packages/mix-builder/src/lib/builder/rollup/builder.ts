import { rollup, RollupOptions, OutputOptions, RollupBuild } from 'rollup';
import * as babelPlugin from '@rollup/plugin-babel';
import * as commonjsPlugin from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import * as terserPlugin from '@rollup/plugin-terser';
import * as jsonPlugin from '@rollup/plugin-json';
import * as typescriptPlugin from '@rollup/plugin-typescript';
import * as copyPluginModule from 'rollup-plugin-copy';
import glob from 'fast-glob';

const babel = (babelPlugin as any).default || babelPlugin;
const commonjs = (commonjsPlugin as any).default || commonjsPlugin;
const terser = (terserPlugin as any).default || terserPlugin;
const json = (jsonPlugin as any).default || jsonPlugin;
const typescript = (typescriptPlugin as any).default || typescriptPlugin;
const copyPlugin = (copyPluginModule as any).default || copyPluginModule;
import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import {
  BASE_ARGS,
  init_build,
  resolveOutDir,
  type EntryConfig,
  type BaseBuilderConfig,
} from '../base.js';
import {
  resolveRollupExternals,
  createExternalConfig,
  type ExternalResolverOptions,
} from '../externals.js';
import { copyPkgJson } from '../../utils/index.js';
import { ArgParserConfig } from 'src/lib/arguments/index.js';
import { BUILDER_PROPS_CONFIG } from '../utils.js';

/**
 * Rollup builder configuration interface
 */
export interface RollupBuilderConfig extends BaseBuilderConfig<any> {
  /**
   * Export mode
   */
  exports?: 'auto' | 'default' | 'named' | 'none';

  /**
   * Generate source maps
   */
  sourcemap?: boolean;

  /**
   * Minify output
   */
  minify?: boolean;

  /**
   * Tree shaking
   */
  treeshake?: boolean;

  /**
   * Preserve modules structure
   */
  preserveModules?: boolean;

  /**
   * Global variables for UMD/IIFE
   */
  globals?: Record<string, string>;

  /**
   * Build type
   */
  buildType?: 'bundled' | 'external' | 'inline' | 'runtime';

  /**
   * Babel options
   */
  babel?: {
    includes?: string[];
    exclude?: string[];
  };

  /**
   * Plugin configurations
   */
  plugins?: {
    typescript?: {
      enabled?: boolean;
      config?: any;
    };
    babel?: {
      enabled?: boolean;
      includes?: string[];
      exclude?: string[];
    };
  };

  /**
   * Files to copy after build
   */
  copy?: Array<{ src: string; dest: string }>;

  /**
   * Additional files to copy (supports glob patterns)
   */
  copyFiles?: Array<{
    /**
     * Source path or glob pattern
     */
    from: string | string[];
    /**
     * Destination path
     */
    to: string;
    /**
     * Flatten directory structure
     */
    flatten?: boolean;
    /**
     * Transform file contents
     */
    transform?: (
      contents: Buffer,
      filename: string
    ) => Buffer | string | Promise<Buffer | string>;
    /**
     * Rename files
     */
    rename?: (name: string, extension: string, fullPath: string) => string;
  }>;

  /**
   * Legacy copy_pkg option
   */
  copy_pkg?: boolean;
}

/**
 * Rollup argument parser configuration
 */
export const ROLLUP_PROPS_CONFIG = [
  ...BUILDER_PROPS_CONFIG,
  {
    key: 'exports',
    type: 'string' as const,
    expectedValues: ['auto', 'default', 'named', 'none'],
    defaultValue: 'named',
  },
  {
    key: 'sourcemap',
    type: 'boolean' as const,
    defaultValue: true,
  },
  {
    key: 'minify',
    type: 'boolean' as const,
    defaultValue: false,
  },
  {
    key: 'treeshake',
    type: 'boolean' as const,
    defaultValue: true,
  },
  {
    key: 'preserveModules',
    type: 'boolean' as const,
    defaultValue: false,
  },
] as ArgParserConfig[];

/**
 * Format resolver for Rollup
 */
function formatResolver(value?: any): 'es' | 'cjs' | 'umd' | 'iife' {
  if (
    typeof value === 'undefined' ||
    (typeof value === 'string' &&
      (value.toLowerCase() === 'es' ||
        value.toLowerCase() === 'esm' ||
        value.length === 0))
  ) {
    return 'es';
  }
  return value;
}

/**
 * Resolve Rollup configuration
 */
async function resolveConfig(
  entry: EntryConfig<RollupBuilderConfig>,
  options: RollupBuilderConfig,
  pkg: any
): Promise<{
  inputOptions: RollupOptions;
  outputOptions: OutputOptions;
}> {
  const format = formatResolver(entry.format);
  const buildType = entry.buildType || options.buildType || 'bundled';
  const ext = entry.extensions || options.extensions || [];
  const extensions = ext.length > 0 ? ext : ['.js', '.jsx', '.ts', '.tsx'];
  const exportsMode = entry.exports || options.exports || 'named';
  const sourcemap = options.sourcemap !== undefined ? options.sourcemap : true;
  const minify = options.minify !== undefined ? options.minify : false;
  const treeshake = options.treeshake !== undefined ? options.treeshake : true;

  // Resolve output directory
  // const subdir = path.dirname(entry.filePath!).replace(`${process.cwd()}/`, '');
  // let outputDir: string;

  // if (options.resolveOutDir) {
  //   outputDir = options.resolveOutDir(entry, options);
  // } else if (subdir.startsWith('/') || !subdir) {
  //   outputDir = options.outdir || 'dist';
  // } else {
  //   outputDir = path.join(options.outdir || 'dist', subdir);
  // }

  const outputDir = options.resolveOutDir!(entry, options);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  // File extension mapping
  const extMap: Record<string, string> = {
    es: '.mjs',
    cjs: '.cjs',
    umd: '.umd.js',
    iife: '.iife.js',
  };

  // Build plugins array
  const plugins: any[] = [];
  // Node resolve plugin
  plugins.push(
    nodeResolve({
      preferBuiltins: true,
      mainFields: ['main', 'module'],
      extensions,
      browser: format !== 'cjs',
      dedupe: ['lit', 'react', 'react-dom'],
    })
  );

  // CommonJS plugin
  plugins.push(
    commonjs({
      defaultIsModuleExports: true,
      transformMixedEsModules: true,
    })
  );

  // TypeScript plugin
  if (options.plugins?.typescript?.enabled !== false) {
    const tsConfigPath = path.resolve(
      path.join(process.cwd(), 'tsconfig.build.json')
    );
    if (existsSync(tsConfigPath)) {
      plugins.push(
        typescript({
          tsconfig: tsConfigPath,
          incremental: false,
          ...(options.plugins?.typescript?.config || {}),
        })
      );
    }
  }

  // Babel plugin
  const babelConfig = options.plugins?.babel || options.babel;
  const babelEnabled = options.plugins?.babel
    ? options.plugins.babel.enabled !== false
    : true;
  if (babelEnabled) {
    const babelPlugins =
      buildType === 'runtime'
        ? [
            ['@babel/plugin-transform-runtime'],
            [
              '@babel/plugin-syntax-import-attributes',
              { deprecatedAssertSyntax: true },
            ],
            ['@babel/plugin-proposal-decorators', { version: '2023-05' }],
          ]
        : [
            [
              '@babel/plugin-syntax-import-attributes',
              { deprecatedAssertSyntax: true },
            ],
            ['@babel/plugin-proposal-decorators', { version: '2023-05' }],
          ];

    plugins.push(
      babel({
        presets: [
          ['@babel/preset-env', { modules: false }],
          '@babel/preset-typescript',
          [
            '@babel/preset-react',
            {
              runtime: 'automatic',
            },
          ],
        ],
        plugins: babelPlugins,
        babelHelpers: buildType !== 'runtime' ? 'bundled' : 'runtime',
        include: babelConfig?.includes || undefined,
        exclude: babelConfig?.exclude || ['node_modules/**', '**/*.cts'],
        extensions,
      })
    );
  }

  // JSON plugin
  plugins.push(json());

  // Advanced copy files functionality
  if (options.copyFiles && options.copyFiles.length > 0) {
    const copyTargets = await Promise.all(
      options.copyFiles.map(async (copyConfig) => {
        const sources = Array.isArray(copyConfig.from)
          ? copyConfig.from
          : [copyConfig.from];
        const files: string[] = [];

        // Resolve glob patterns
        for (const source of sources) {
          if (source.includes('*') || source.includes('?')) {
            const matches = (
              await glob(source, {
                cwd: process.cwd(),
                absolute: false,
              })
            ).filter((m) => !m.endsWith('.spec.ts'));
            files.push(...matches);
          } else {
            files.push(source);
          }
        }

        return {
          src: files,
          dest: copyConfig.to,
          flatten: copyConfig.flatten,
          transform: copyConfig.transform,
          rename: copyConfig.rename,
        };
      })
    );

    plugins.push(
      copyPlugin({
        targets: copyTargets,
        verbose: options.log !== false,
      })
    );
  }

  // Legacy copy plugin (only for last build)
  if (options.copy && options.copy.length > 0) {
    plugins.push(
      copyPlugin({
        targets: options.copy,
        verbose: options.log !== false,
      })
    );
  }

  // Terser plugin for minification
  if (minify || format === 'umd' || format === 'iife') {
    plugins.push(terser());
  }

  // Input options
  const inputOptions: RollupOptions = {
    input: entry.filePath!,
    plugins,
    preserveSymlinks: true,
    treeshake: treeshake,
  };

  // Output options
  const outputOptions: OutputOptions = {
    dir: outputDir,
    format: format === 'es' ? 'esm' : format,
    sourcemap,
    exports: exportsMode as any,
    name: entry.name || options.name,
    entryFileNames: (chunkInfo) => {
      const name = chunkInfo.name.replace(/\.js$/, '');
      return `${name}${extMap[format] || '.js'}`;
    },
  };

  // Add globals for UMD/IIFE
  if (
    (format === 'umd' || format === 'iife') &&
    (entry.globals || options.globals)
  ) {
    outputOptions.globals = entry.globals || options.globals;
  }

  return { inputOptions, outputOptions };
}

/**
 * Build a single entry with Rollup
 */
async function buildEntry(
  entry: EntryConfig<RollupBuilderConfig>,
  options: RollupBuilderConfig
): Promise<RollupBuild | null> {
  const inputFile = entry.filePath!;

  // Skip test files
  if (inputFile.endsWith('test.ts') || inputFile.endsWith('test.tsx')) {
    return null;
  }

  if (options.log) {
    console.log(`Building ${path.basename(inputFile)} with Rollup...`);
  }

  try {
    // Load package.json
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    // Prepare entry externals
    const entry_externals = entry.externals || [];

    // Create external resolver options
    const externalOptions: ExternalResolverOptions = createExternalConfig({
      externals: entry_externals,
      reactExternal: options.reactExternal,
      litExternal: options.litExternal,
      libExternal: options.libExternal,
      nodeExternal: options.nodeEnv === 'production' ? false : true,
      pkgExternal:
        options.pkgExternal || formatResolver(entry.format) === 'cjs',
      dependencies: pkg.dependencies,
      peerDependencies: pkg.peerDependencies,
      skipExternal: options.skipExternal,
      customPatterns: options.external || [],
      format: formatResolver(entry.format),
      includeSubPaths: true,
    });

    // Add runtime externals for runtime build type
    const buildType = entry.buildType || options.buildType || 'bundled';
    if (buildType === 'runtime') {
      if (!externalOptions.customPatterns) {
        externalOptions.customPatterns = [];
      }
      externalOptions.customPatterns.push(
        '@babel/runtime',
        '@babel/core',
        '@babel/types',
        '@babel/parser',
        '@babel/traverse',
        'browserslist'
      );
    }

    // Check if in bundlers project
    const bundlers = ['bundles'];
    const directory_name = path.basename(process.cwd());
    if (!bundlers.some((b) => b === directory_name)) {
      // Add lib externals when not in bundlers project
      if (!externalOptions.libExternal) {
        externalOptions.libExternal = true;
      }
    } else {
      if (options.log) {
        console.log('  Project uses bundler - including all @awc packages');
      }
    }

    // Resolve externals using advanced resolver
    const externalFunction = resolveRollupExternals(externalOptions);

    // Get Rollup configuration
    const { inputOptions, outputOptions } = await resolveConfig(
      entry,
      options,
      pkg
    );

    // Add external function to input options
    inputOptions.external = externalFunction;

    // Build with Rollup
    const bundle = await rollup(inputOptions);

    // Generate output
    await bundle.write(outputOptions);

    // Close bundle
    await bundle.close();

    if (options.log) {
      console.log(`✅ Built ${path.basename(inputFile)}`);
    }

    // Copy package.json if requested
    if (options.copy_pkg) {
      copyPkgJson(process.cwd(), options.outdir || 'dist');
    }

    return bundle;
  } catch (error) {
    console.error(
      `❌ Failed to build rollup ${path.basename(inputFile)}:`,
      (error as Error).message
    );
    if (options.debug) {
      console.error(error);
    }
    return null;
  }
}

/**
 * Build all entries
 */
async function _build(build: ReturnType<typeof init_build>) {
  const { args, entries, options } = build;
  const builds: (RollupBuild | null)[] = [];

  for (const entry of entries) {
    const result = await buildEntry(entry, args as RollupBuilderConfig);
    builds.push(result);
  }

  return builds.filter((b) => b !== null);
}

/**
 * Main export function to build with Rollup
 */
export function buildWithRollup() {
  const opts: Partial<RollupBuilderConfig> = {
    resolveOutDir,
  };

  const build_value = init_build(
    'rollup',
    [...BASE_ARGS, ...ROLLUP_PROPS_CONFIG],
    opts
  );
  const { args } = build_value;

  if (!args.use || (args.use as string) === 'rollup') {
    _build(build_value).catch(console.error);
  }
}

/**
 * Export default for dynamic import in orchestrator
 */
export default _build;
