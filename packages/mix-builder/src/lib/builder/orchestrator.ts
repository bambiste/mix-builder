import chalk from 'chalk';
import { existsSync, rmSync, readFileSync, readdirSync, statSync } from 'fs';
import { gzipSync } from 'zlib';
import {
  BuilderConfig,
  getBuilderConfig,
  formatDuration,
  createProgressIndicator,
  MIxConfig,
  merge,
} from './utils.js';
import {
  init_build,
  BASE_ARGS,
  type EntryConfig,
  defineExternals,
  resolveOutDir,
  libExternals,
} from './base.js';
import { ESBUILD_PROPS_CONFIG } from './esbuild/base.js';
import { ROLLUP_PROPS_CONFIG } from './rollup/builder.js';
import { build as esbuildBuild, BuildOptions, BuildResult } from 'esbuild';
import {
  resolveEsbuildExternals,
  createExternalConfig,
  type ExternalResolverOptions,
} from './externals.js';
import path from 'path';
import { mkdirSync } from 'fs';
import { copyPkgJson } from '../utils/index.js';

interface BuildProgress {
  current: number;
  total: number;
  builder: string;
  entry: string;
  format: string;
}

interface BuildStats {
  builder: 'rollup' | 'esbuild';
  entries: number;
  success: number;
  failed: number;
  duration: number;
  outputs: Array<{
    entry: string;
    format: string;
    size?: number;
    duration: number;
  }>;
}

/**
 * Clean output directory
 */
function cleanOutputDirectory(outdir: string): void {
  if (existsSync(outdir)) {
    console.log(chalk.gray(`  Cleaning ${outdir}...`));
    rmSync(outdir, { recursive: true, force: true });
  }
}

/**
 * Display build progress
 */
function displayProgress(progress: BuildProgress): void {
  const percent = Math.round((progress.current / progress.total) * 100);
  const bar =
    '█'.repeat(Math.floor(percent / 2)) +
    '░'.repeat(50 - Math.floor(percent / 2));

  console.log(
    chalk.gray(
      `  [${bar}] ${percent}% | ${progress.builder} | ${progress.entry} (${progress.format})`
    )
  );
}

/**
 * Display build statistics
 */
function displayBuildStats(stats: BuildStats): void {
  const failed = stats.failed > 0;
  const glyph = failed ? chalk.red('✗') : chalk.green('✓');
  const parts = [
    chalk.bold(stats.builder),
    chalk.gray(`${stats.entries} ${stats.entries === 1 ? 'entry' : 'entries'}`),
    failed
      ? chalk.red(`${stats.failed} failed`)
      : chalk.green(`${stats.success} ok`),
    chalk.gray(formatDuration(stats.duration)),
  ];
  console.log(`  ${glyph} ${parts.join(chalk.gray(' · '))}`);
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Bundle files we report sizes for (skip maps, typings, and other assets). */
const BUNDLE_RE = /\.(m?js|cjs|css)$/;

interface OutputFile {
  rel: string;
  raw: number;
  gzip: number;
}

/**
 * Walk `dir` and collect every bundle file with its raw + gzip size. When `since`
 * is given, only files written during this run (mtime >= since) are reported, so an
 * incremental build doesn't re-list bundles left by a previous one.
 */
function collectBundles(dir: string, since = 0): OutputFile[] {
  const out: OutputFile[] = [];
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const full = path.join(current, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (BUNDLE_RE.test(name) && !name.endsWith('.d.ts') && st.mtimeMs >= since) {
        const buf = readFileSync(full);
        out.push({
          rel: path.relative(dir, full),
          raw: buf.byteLength,
          gzip: gzipSync(buf).byteLength,
        });
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * Print an aligned table of the emitted bundles with raw + gzip sizes, plus a total.
 */
function renderOutputFiles(outdir: string, since = 0): void {
  const files = collectBundles(outdir, since);
  if (files.length === 0) return;

  const nameW = Math.max(...files.map((f) => f.rel.length), 4);
  const rawW = Math.max(...files.map((f) => formatSize(f.raw).length), 3);
  const gzW = Math.max(...files.map((f) => formatSize(f.gzip).length), 2);
  const rule = chalk.gray('  ' + '─'.repeat(nameW + rawW + gzW + 8));

  console.log(chalk.cyan(`\n  Output`) + chalk.gray(` · ${outdir}`));
  console.log(rule);
  for (const f of files) {
    const name = chalk.gray(f.rel.padEnd(nameW));
    const raw = chalk.white(formatSize(f.raw).padStart(rawW));
    const gz = chalk.green(formatSize(f.gzip).padStart(gzW) + ' gz');
    console.log(`  ${name}   ${raw}   ${gz}`);
  }
  console.log(rule);
  const rawTotal = files.reduce((s, f) => s + f.raw, 0);
  const gzTotal = files.reduce((s, f) => s + f.gzip, 0);
  console.log(
    chalk.gray(
      `  ${String(files.length).padStart(1)} file${files.length === 1 ? '' : 's'}`.padEnd(nameW + 2) +
        `   ${formatSize(rawTotal).padStart(rawW)}   ${formatSize(gzTotal).padStart(gzW)} gz`
    )
  );
}

/**
 * Build with ESBuild
 */
async function buildWithESBuild(config: BuilderConfig): Promise<BuildStats> {
  const startTime = Date.now();

  const esbuildConfig = getBuilderConfig(config, 'esbuild');

  // Initialize build
  const opts = {
    ...esbuildConfig,
    defineExternals,
    resolveOutDir,
  };

  const buildData = init_build(
    'esbuild',
    [...BASE_ARGS, ...ESBUILD_PROPS_CONFIG],
    opts
  );
  const { entries, args } = buildData;

  if (!entries || entries.length === 0) {
    console.log(chalk.yellow('  ⚠️  No ESBuild entries found'));
    return {
      builder: 'esbuild',
      entries: 0,
      success: 0,
      failed: 0,
      duration: 0,
      outputs: [],
    };
  }

  const stats: BuildStats = {
    builder: 'esbuild',
    entries: entries.length,
    success: 0,
    failed: 0,
    duration: 0,
    outputs: [],
  };

  const progress = createProgressIndicator(entries.length);

  // Build each entry
  for (const entry of entries) {
    const entryStartTime = Date.now();
    const inputFile = entry.filePath!;

    if (inputFile.endsWith('test.ts') || inputFile.endsWith('test.tsx')) {
      continue;
    }

    try {
      const treeShaking = inputFile.endsWith('icons.ts')
        ? false
        : args.treeShaking ?? true;

      const entry_externals = entry.externals || [];

      // Load package.json for dependency resolution
      const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

      // Create external resolver options
      const format = formatResolver(entry.format);
      const externalOptions: ExternalResolverOptions = createExternalConfig({
        externals: entry_externals,
        reactExternal: args.reactExternal,
        litExternal: args.litExternal,
        libExternal: args.libExternal,
        nodeExternal: false,
        pkgExternal: args.pkgExternal || format === 'cjs',
        dependencies: pkg.dependencies,
        peerDependencies: pkg.peerDependencies,
        skipExternal: args.skipExternal || args.noExternal,
        customPatterns: args.external || [],
        format: format,
        includeSubPaths: true,
      });

      // Check if in bundlers project
      const bundlers = ['bundles'];
      const directory_name = path.basename(process.cwd());
      if (!bundlers.some((b) => b === directory_name)) {
        // Add lib externals when not in bundlers project
        if (!externalOptions.libExternal) {
          externalOptions.libExternal = true;
        }
      }

      // Resolve externals using advanced resolver
      const external = resolveEsbuildExternals(externalOptions);

      const outputDir = args.resolveOutDir
        ? args.resolveOutDir(entry, args)
        : args.outdir || 'dist';

      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // iife needs a global name to hang exports on (window.<globalName>). Take it from
      // the entry, else the args, else derive a PascalCase name from the entry file.
      const isIife = format === 'iife';
      const globalName = isIife
        ? entry.globalName || args.globalName || deriveGlobalName(inputFile)
        : undefined;

      const buildOptions: BuildOptions = {
        entryPoints: [inputFile],
        outdir: outputDir,
        bundle: args.bundle ?? true,
        sourcemap: args.sourcemap ?? false,
        target: args.target || 'es2021',
        format: format === 'esm' ? 'esm' : format,
        ...(globalName ? { globalName } : {}),
        platform: args.platform || (format === 'cjs' ? 'node' : 'browser'),
        minify: format === 'cjs' ? false : args.minify ?? true,
        minifySyntax: args.minifySyntax ?? true,
        minifyWhitespace: args.minifyWhitespace ?? true,
        minifyIdentifiers: args.minifyIdentifiers ?? true,
        legalComments: args.legalComments || 'none',
        charset: args.charset || 'utf8',
        define: {
          'process.env.NODE_ENV': `"${
            args.nodeEnv || args.env || 'production'
          }"`,
        },
        // iife is meant to be dropped into a <script> tag, so bundle everything in.
        external: ((args.noExternal || isIife) && format !== 'cjs' ? [] : external) as any,
        treeShaking,
        splitting: format === 'esm' ? args.splitting ?? true : false,
        outExtension: args.outExtension || {
          '.js':
            format === 'esm'
              ? '.mjs'
              : format === 'cjs'
                ? '.cjs'
                : isIife
                  ? '.global.js'
                  : '.js',
        },
        entryNames: args.entryNames || '[name]',
        chunkNames: args.chunkNames || '[name]-[hash]',
        assetNames: args.assetNames || '[name]-[hash]',
        jsx: args.jsx || 'automatic',
        jsxImportSource: args.jsxImportSource || 'react',
        loader: {
          '.ts': 'ts',
          '.tsx': 'tsx',
          '.js': 'js',
          '.jsx': 'jsx',
          '.json': 'json',
        },
        tsconfigRaw: {
          compilerOptions: {
            target:
              typeof args.target === 'string'
                ? args.target
                : args.target?.[0] ?? 'latest',
            jsx: 'react-jsx',
            jsxImportSource: 'react',
            strict: true,
            experimentalDecorators: true,
          },
        },
      };
      const result = await esbuildBuild(buildOptions);

      if (args.copy_pkg) {
        copyPkgJson(process.cwd(), args.outdir || 'dist');
      }

      const duration = Date.now() - entryStartTime;
      stats.success++;
      stats.outputs.push({
        entry: path.basename(inputFile),
        format: format,
        duration,
      });

      if (args.log) {
        const progressInfo = progress.increment();
        console.log(
          chalk.green(
            `  ✓ Built ${path.basename(
              inputFile
            )} [${format}] in ${formatDuration(duration)}`
          )
        );
      }
    } catch (error) {
      stats.failed++;
      const duration = Date.now() - entryStartTime;
      console.error(
        chalk.red(`  ✗ Failed to build ${path.basename(inputFile)}:`),
        (error as Error).message
      );
    }
  }

  stats.duration = Date.now() - startTime;
  return stats;
}

/**
 * Build with Rollup
 */
async function buildWithRollup(config: BuilderConfig): Promise<BuildStats> {
  const startTime = Date.now();

  const rollupConfig = getBuilderConfig(config, 'rollup');

  const stats: BuildStats = {
    builder: 'rollup',
    entries: 0,
    success: 0,
    failed: 0,
    duration: 0,
    outputs: [],
  };

  // Check if Rollup configuration exists
  if (!rollupConfig || !rollupConfig.entries) {
    console.log(chalk.yellow('  ⚠️  No Rollup entries found'));
    return stats;
  }

  try {
    // Import Rollup dynamically
    const rollupModule = await import('./rollup/builder.js');

    // Check if default export is a function
    if (rollupModule.default && typeof rollupModule.default === 'function') {
      // Initialize Rollup build
      const rollupBuildData = init_build(
        'rollup',
        [...BASE_ARGS, ...ROLLUP_PROPS_CONFIG],
        {
          ...rollupConfig,
          resolveOutDir,
        }
      );
      // // console.log('rollup build data', rollupBuildData);
      // rollupBuildData.args = merge(rollupBuildData.args, rollupConfig);
      // rollupBuildData.options = rollupConfig;

      // Execute build
      const builds = await rollupModule.default(rollupBuildData);

      if (Array.isArray(builds)) {
        stats.entries = builds.length;
        stats.success = builds.filter((b) => b !== null).length;
        stats.failed = builds.length - stats.success;
      }

      console.log(chalk.green('  ✓ Rollup build completed'));
    } else {
      console.log(chalk.yellow('  ⚠️  Rollup builder not properly configured'));
    }
  } catch (error) {
    stats.failed++;
    console.error(
      chalk.red('  ✗ Rollup build failed:'),
      // (error as Error).message
      error
    );
  }

  stats.duration = Date.now() - startTime;
  return stats;
}

/**
 * Format resolver for ESBuild
 */
function formatResolver(value?: any): 'esm' | 'cjs' | 'iife' {
  if (
    typeof value === 'undefined' ||
    (typeof value === 'string' &&
      (value.toLowerCase() === 'es' ||
        value.toLowerCase() === 'esm' ||
        value.length === 0))
  ) {
    return 'esm';
  }
  return value;
}

// PascalCase global from a file path: signal/index.ts -> Signal, my-lib.ts -> MyLib.
function deriveGlobalName(inputFile: string): string {
  let base = path.basename(inputFile).replace(/\.[cm]?[jt]sx?$/, '');
  if (base === 'index') base = path.basename(path.dirname(inputFile));
  return base
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/**
 * Main orchestrator function
 */
export async function buildWithMixBuilder(
  config: BuilderConfig,
  mixconfig: MIxConfig
): Promise<void> {
  const startTime = Date.now();
  const allStats: BuildStats[] = [];

  console.log(chalk.bold.cyan('\n◆ mix-builder\n'));

  // Clean output directory if requested
  if (config.clean && config.outdir) {
    console.log(chalk.gray(`  cleaning ${config.outdir}`));
    cleanOutputDirectory(config.outdir);
  }

  // Determine which builders to run
  const runRollup = config.builder === 'rollup' || config.builder === 'both';
  const runEsbuild = config.builder === 'esbuild' || config.builder === 'both';

  // Check if using legacy 'use' parameter
  if (config.use) {
    if (config.use === 'esbuild') {
      config.builder = 'esbuild';
    } else if (config.use === 'rollup') {
      config.builder = 'rollup';
    }
  }

  try {
    // Run ESBuild if configured
    if (runEsbuild || config.use === 'esbuild') {
      const conf = {
        ...config,
        ...(config.esbuild ?? {}),
      };
      const esbuildStats = await buildWithESBuild(conf);
      allStats.push(esbuildStats);
      displayBuildStats(esbuildStats);
    }

    // Run Rollup if configured
    if (runRollup || config.use === 'rollup') {
      const conf = {
        ...config,
        ...(config.rollup ?? {}),
      };
      const rollupStats = await buildWithRollup(conf);
      allStats.push(rollupStats);
      displayBuildStats(rollupStats);
    }

    // Per-file raw + gzip sizes for the bundles this run emitted.
    if (config.outdir) renderOutputFiles(config.outdir, startTime);

    // Overall summary line.
    const totalDuration = Date.now() - startTime;
    const totalSuccess = allStats.reduce((sum, s) => sum + s.success, 0);
    const totalFailed = allStats.reduce((sum, s) => sum + s.failed, 0);

    if (totalFailed > 0) {
      console.log(
        chalk.red(`\n✗ ${totalFailed} failed`) +
          chalk.gray(` · ${totalSuccess} ok · ${formatDuration(totalDuration)}\n`)
      );
      throw new Error(`Build completed with ${totalFailed} error(s)`);
    }

    console.log(
      chalk.green(`\n✓ Built ${totalSuccess} ${totalSuccess === 1 ? 'entry' : 'entries'}`) +
        chalk.gray(` in ${formatDuration(totalDuration)}\n`)
    );
  } catch (error) {
    throw error;
  }
}
