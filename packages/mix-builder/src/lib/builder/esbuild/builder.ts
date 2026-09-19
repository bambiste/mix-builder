import { build, BuildOptions, BuildResult } from 'esbuild';
import { resolveBanner } from './banner.js';
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import {
  BASE_ARGS,
  defineExternals,
  init_build,
  libExternals,
  resolveOutDir,
  type EntryConfig,
} from '../base.js';
import { ESBUILD_PROPS_CONFIG, type EsbuildBuilderConfig } from './base.js';
import {
  resolveEsbuildExternals,
  createExternalConfig,
  type ExternalResolverOptions,
} from '../externals.js';
import fs from 'fs';
import path from 'path';
import { copyPkgJson } from '../../utils/index.js';
import glob from 'fast-glob';

function formatResolver(value?: any) {
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

/**
 * Resolves configuration for esbuild
 * @param {T} options - esbuild options
 * @returns ```js
 * {config: T, pkg: any}
 * ```
 */
function resolveConfig<T extends EsbuildBuilderConfig = EsbuildBuilderConfig>(
  options: T
) {
  let {
    env = 'production',
    bundle = true,
    splitting = true,
    noExternal = false,
    minify,
    minifySyntax = true,
    minifyWhitespace = true,
    minifyIdentifiers = true,
    sourcemap = false,
    format = 'esm',
    external = [],
    pkgExternals = format === 'cjs' ? true : false,
    treeShaking = true,
    outExtension = {
      '.js': format === 'esm' ? '.mjs' : format === 'cjs' ? '.cjs' : '.js',
      '.jsx': format === 'esm' ? '.mjs' : format === 'cjs' ? '.cjs' : '.jsx',
    },
    // chunkNames = 'chunks/[name]-[hash]',
    entryNames = '[name]',
    chunkNames = '[name]-[hash]',
    assetNames = '[name]-[hash]',
    platform = format === 'cjs' ? 'node' : 'browser',
    target = 'es2021',
    legalComments = 'none',
    charset = 'utf8',
    outdir = 'dist',
    defineExternals,
  } = options;
  // console.log('output to use is', options.outdir);
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const pkg_externals = pkgExternals
    ? [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
      ].flatMap((dep) => [dep, `${dep}/*`])
    : [];
  // Who loads the file decides: iife goes straight into a browser, esm and cjs go
  // through a bundler that minifies anyway. An explicit `minify` still wins.
  const minifying = format === 'cjs' ? false : minify ?? format === 'iife';

  // Base esbuild options
  // console.log('tree shaking is', treeShaking)
  const config: BuildOptions = {
    bundle,
    sourcemap, // smaller bundle
    target,
    format,
    // The destructured default already decides by format. Recomputing it here ignored an
    // explicit `platform`, and the symptom was a node package failing to resolve
    // `node:fs` in its esm output, because `browser` does not treat builtins as external.
    platform,
    // Gated on `minify`, not defaulted beside it. These three carry a concrete `true`
    // default, so on their own they kept minifying everything when `minify: false` was
    // asked for. With minification on they still work as opt-outs.
    minify: minifying,
    minifySyntax: minifying && minifySyntax,
    minifyWhitespace: minifying && minifyWhitespace,
    minifyIdentifiers: minifying && minifyIdentifiers,
    legalComments,
    charset,
    // The build's own NODE_ENV first, then the config's, so a project can override it
    // and add compile-time constants. Values substitute as written; a string needs its
    // quotes.
    define: {
      'process.env.NODE_ENV': '"' + env + '"',
      ...(options.define ?? {}),
    },
    external:
      noExternal && format !== 'cjs'
        ? []
        : [...(pkgExternals ? pkg_externals : []), ...external],
    treeShaking,
    splitting: format === 'esm' ? splitting : false,
    outExtension,
    entryNames,
    chunkNames,
    assetNames,
    outdir,
    jsx: 'automatic',
    jsxImportSource: 'react',
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.js': 'js',
      '.jsx': 'jsx',
      '.json': 'json',
    },
    tsconfigRaw: {
      compilerOptions: {
        target: typeof target === 'string' ? target : target[0] ?? 'latest',
        jsx: 'react-jsx',
        jsxImportSource: 'react',
        strict: true,
        experimentalDecorators: true,
      },
    },
  };
  if (defineExternals && !noExternal && format !== 'cjs') {
    config.external = [...(config.external || []), ...defineExternals(config)];
    // console.log('defined externals', config.external);
  }

  return { config, pkg };
}

/**
 * Copy files based on copyFiles configuration
 */
async function processCopyFiles(
  copyFilesConfig: EsbuildBuilderConfig['copyFiles'],
  outputDir: string,
  log: boolean = true
): Promise<void> {
  if (!copyFilesConfig || copyFilesConfig.length === 0) {
    return;
  }

  for (const copyConfig of copyFilesConfig) {
    const sources = Array.isArray(copyConfig.from)
      ? copyConfig.from
      : [copyConfig.from];
    const files: string[] = [];

    // Resolve glob patterns
    for (const source of sources) {
      if (source.includes('*') || source.includes('?')) {
        const matches = await glob(source, {
          cwd: process.cwd(),
          absolute: false,
        });
        files.push(...matches);
      } else {
        files.push(source);
      }
    }

    // Copy each file
    for (const file of files) {
      const sourcePath = path.resolve(process.cwd(), file);
      if (!existsSync(sourcePath)) {
        if (log) {
          console.warn(`⚠️  Source file not found: ${file}`);
        }
        continue;
      }

      const fileName = path.basename(file);
      const fileExt = path.extname(file);
      const baseName = path.basename(file, fileExt);

      let destFileName = fileName;
      if (copyConfig.rename) {
        destFileName = copyConfig.rename(baseName, fileExt, file);
      }

      let destPath: string;
      if (copyConfig.flatten) {
        destPath = path.join(outputDir, copyConfig.to, destFileName);
      } else {
        const relativePath = path.relative(process.cwd(), path.dirname(file));
        destPath = path.join(
          outputDir,
          copyConfig.to,
          relativePath,
          destFileName
        );
      }

      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      // Copy or transform file
      if (copyConfig.transform) {
        const contents = readFileSync(sourcePath);
        const transformed = await copyConfig.transform(contents, fileName);
        writeFileSync(destPath, transformed as any);
        if (log) {
          console.log(
            `  📄 Transformed and copied: ${file} → ${path.relative(
              process.cwd(),
              destPath
            )}`
          );
        }
      } else {
        copyFileSync(sourcePath, destPath);
        if (log) {
          console.log(
            `  📄 Copied: ${file} → ${path.relative(process.cwd(), destPath)}`
          );
        }
      }
    }
  }
}

async function _build(build: ReturnType<typeof init_build>) {
  const { args, entries } = build;
  const builds: BuildResult<BuildOptions>[] = [];
  console.log('Building with esbuild ' + entries.length, 'entries');
  for (const entry of entries) {
    const treeShake = entry.filePath?.endsWith('icons.ts') ? false : true;
    const b = await buildEntry(entry, { ...args, treeShaking: treeShake });
    if (b) {
      builds.push(b);
    }
  }

  return builds;
}

async function buildEntry(
  entry: EntryConfig<EsbuildBuilderConfig>,
  options: EsbuildBuilderConfig
) {
  const inputFile = entry.filePath!;
  if (inputFile.endsWith('test.ts')) {
    return null;
  }
  const outputName = entry.name;
  if (options.log) {
    console.log(`Building ${inputFile} -> ${outputName}`);
  }
  const entry_externals = entry.externals || [];

  // Load package.json for dependency resolution
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  // Create external resolver options
  const externalOptions: ExternalResolverOptions = createExternalConfig({
    externals: entry_externals,
    reactExternal: options.reactExternal,
    litExternal: options.litExternal,
    libExternal: options.libExternal,
    nodeExternal: false,
    pkgExternal: options.pkgExternal || formatResolver(entry.format) === 'cjs',
    dependencies: pkg.dependencies,
    peerDependencies: pkg.peerDependencies,
    skipExternal: options.skipExternal,
    customPatterns: options.external || [],
    format: formatResolver(entry.format),
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
  } else {
    console.log('project use bundler including all @awc packages');
  }

  // Resolve externals using advanced resolver
  const external = resolveEsbuildExternals(externalOptions);
  const { config } = resolveConfig({
    ...options,
    external: external as any,
    format: formatResolver(entry.format),
  });
  const outputDir = options.resolveOutDir!(entry, options);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  // Resolved per entry, so `include`/`exclude` can mark the files a consumer loads and
  // leave internal chunks bare. Undefined when this entry gets none.
  const banner = resolveBanner(options.banner, inputFile, pkg);
  const buildOptions = {
    ...config,
    entryPoints: [inputFile],
    outdir: outputDir,
    ...(banner ? { banner } : {}),
  };

  try {
    const result = await build(buildOptions);
    if (options.log) {
      console.log(`✅ Built ${inputFile}`, result.errors);
    }
    if (options.copy_pkg) {
      copyPkgJson(process.cwd(), options.outdir || 'dist');
    }

    // Process copyFiles if configured
    if (options.copyFiles) {
      await processCopyFiles(options.copyFiles, outputDir, options.log);
    }

    // builds.push(result);
    return result;
  } catch (error) {
    console.log('esbuild external are', external);
    // console.error(`❌ Failed to build ${inputFile}:`, error);
  }
  return null;
}

/**
 * @deprecated A second esbuild implementation, kept for anyone importing it directly.
 *
 * The CLI does not reach this: it goes through `buildWithMixBuilder` in
 * `orchestrator.ts`, which has its own esbuild path. Two implementations of one thing
 * is how they drift, and they already had: the `minify` bug fixed here was fixed twice,
 * because a fix to one left the other wrong.
 *
 * Removing it changes the package's public surface, so it waits for a major. Until
 * then, changes belong in both.
 */
export function buildWithEsBuild() {
  const opts: Partial<EsbuildBuilderConfig> = {
    defineExternals,
    resolveOutDir,
  };

  const build_value = init_build(
    'esbuild',
    [...BASE_ARGS, ...ESBUILD_PROPS_CONFIG],
    opts
  );
  const { entries, args } = build_value;

  // Resolve clean and banner: a CLI flag takes precedence, then build-config.json.
  //
  // Read here rather than merged in `flattenedInputs`, which only consumes the entry
  // keys. Widening that merge would start honouring keys it has always ignored, and
  // `minify` is one of them, so an existing config could quietly change what it builds.
  let shouldClean: boolean = args.clean ?? false;
  try {
    const configFile = args.buildConfigFile || 'build-config.json';
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    if (!shouldClean) shouldClean = config?.esbuild?.clean === true;
    if (args.banner === undefined && config?.esbuild?.banner !== undefined) {
      args.banner = config.esbuild.banner;
    }
  } catch {}

  if (shouldClean) {
    const outdir = args.outdir || 'dist';
    if (existsSync(outdir)) {
      fs.rmSync(outdir, { recursive: true, force: true });
      console.log(`🧹 Cleaned ${outdir}`);
    }
  }

  if (!args.use || args.use === 'esbuild') {
    _build(build_value).catch(console.error);
  }
}
