import { readFileSync } from 'fs';
import { resolveFrom } from '../utils/index.js';
import { cwd } from 'process';
import glob from 'fast-glob';
import { ArgParserConfig, parseProcessArgs } from '../arguments/index.js';
import path from 'path';

export interface BaseBuilderConfig<Option> {
  /**
   * File extensions to resolve
   */
  extensions?: string[];

  buildConfigFile?: string;

  /**
   * External dependencies
   */
  externals?: string[];

  entries: Entries<Option>;

  reactExternal?: boolean;
  litExternal?: boolean;
  libExternal?: boolean;

  /**
   * Output formats
   */
  formats?: Array<BuildFormat>;
  defineExternals?: (options: Partial<Option>) => string[];
  resolveOutDir?: (
    entry: EntryConfig<Option>,
    options: Partial<Option>
  ) => string;
  nodeEnv?: 'development' | 'production';
  skipExternal?: boolean;
  external?: string[];
  pkgExternal?: boolean;
  debug?: boolean;
  log?: boolean;
  dts?: boolean;
  use?: 'tsup' | 'esbuild';
  copy_pkg?: boolean;
  rootDir?: string;
  outdir?: string;
  [key: string]: any;
}

export type BuildFormat = 'es' | 'esm' | 'cjs' | 'iife' | 'umd';

export const BASE_ARGS: ArgParserConfig[] = [
  {
    key: 'reactExternal',
    type: 'boolean',
  },
  {
    key: 'litExternal',
    type: 'boolean',
  },
  {
    key: 'libExternal',
    type: 'boolean',
  },
] as const;
export interface EntryConfig<Option> extends BaseBuilderConfig<Option> {
  name?: string;
  buildType?: 'bundled' | 'external' | 'inline';
  filePath?: string;
  file?: string;
  format?: BuildFormat | BuildFormat[];
  extensions?: string[];
  externals?: string[];
  plugins?: any[];
  /** iife global name (window.<globalName>); required for iife, ignored otherwise. */
  globalName?: string;
}
export type Entries<Option> = Record<string, EntryConfig<Option>> | string[];

const VALID_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.cts'];
const VALID_FORMATS = ['es', 'cjs', 'umd', 'system', 'iife', 'amd'];

export const filterFormat = (_formats: BuildFormat[]) => {
  if (Array.isArray(_formats) && _formats.length > 0) {
    const formats = _formats.filter((s) => VALID_FORMATS.some((f) => f === s));
    return formats;
  }
  return [];
};

export const filterExtensions = (_extensions: any, format = undefined) => {
  let extensions: string[] = [];
  if (Array.isArray(_extensions) && _extensions.length > 0) {
    extensions.push(
      ..._extensions.filter((s) => VALID_EXTENSIONS.some((f) => f === s))
    );
    return extensions;
  } else if (
    format &&
    typeof _extensions === 'object' &&
    _extensions[format] &&
    Array.isArray(_extensions[format])
  ) {
    extensions.push(
      ..._extensions[format].filter((s) =>
        VALID_EXTENSIONS.some((f) => f === s)
      )
    );
  }
  return extensions;
};

export const filterEntries = <Option extends BaseBuilderConfig<any>>(
  _entry: EntryConfig<Option>,
  globalFormats: string[],
  globalExtensions: string[],
  globalExternals: string[]
) => {
  if (typeof _entry === 'string') {
    return {
      formats: globalFormats,
      externals: globalExternals,
      extensions: globalExtensions,
    };
  } else if (typeof _entry === 'object') {
    const entry = { ..._entry };
    let _formats = filterFormat(entry.formats!);
    if (_formats.length > 0) {
      let formats = _formats.slice();
      return { ...entry, formats };
    }
  }
  return null;
};

export const formatEntries = <Option extends BaseBuilderConfig<any>>(
  entries: any[],
  globalFormats: any,
  globalExtensions: any,
  globalExternals: any,
  exports: any
): { [key: string]: EntryConfig<Option> } | null => {
  if (typeof entries === 'object' && !Array.isArray(entries)) {
    return entries as { [key: string]: EntryConfig<Option> };
  }

  if (Array.isArray(entries)) {
    let dataEntries: { [key: string]: EntryConfig<Option> } = {} as {
      [key: string]: EntryConfig<Option>;
    };
    return (
      entries
        .flatMap<{ [key: string]: EntryConfig<Option> }>((_entry: any) => {
          if (typeof _entry === 'string') {
            // console.log("_entry", _entry)
            const e = {
              [_entry]: {
                formats: globalFormats,
                externals: globalExternals,
                extensions: globalExtensions,
                exports,
              },
            } as unknown as { [key: string]: EntryConfig<Option> };
            dataEntries = { ...dataEntries, ...e };
          } else if (
            typeof _entry === 'object' &&
            _entry.file &&
            _entry.file.length > 0
          ) {
            const entry = { ..._entry } as EntryConfig<Option>;
            const formats = filterFormat(entry.formats!);
            const extensions = filterExtensions(entry.extensions);
            const externals = entry.externals;
            const e = {
              [entry.file!]: {
                formats,
                extensions,
                ...(externals ? { externals: externals } : {}),
              },
            };
            // console.log("_entry", e)
            dataEntries = { ...dataEntries, ...e } as any;
          }
          return dataEntries;
        })
        .pop() || null
    );
  }
  return null;
};

export function formatResolver(value?: any) {
  if (
    typeof value === 'undefined' ||
    (typeof value === 'string' &&
      (value.toLowerCase() === 'es' || value.length === 0))
  ) {
    return 'esm';
  }
  return value;
}

export function mergeOptions<T extends BaseBuilderConfig<any>>(
  options: T,
  config: T
) {
  for (const key in config) {
    if (!(key in options)) {
      (options as any)[key] = (config as any)[key];
    }
  }
}

export const getDynamicInputs = (builder: 'rollup' | 'esbuild', args?: any) => {
  const defaultIgnore = [
    '**/node_modules/**', // Ignore node_modules
    '**/*.spec.ts', // Ignore spec.ts files
    '**/*.test.ts', // Ignore test.ts files
    '**/__tests__/**', // Ignore __tests__ directories
    '**/__mocks__/**', // Ignore __mocks__ directories
    '**/dist/**', // Ignore dist directories
    '**/build/**', // Ignore build directories
    '**/.git/**', // Ignore .git directories
    '**/*.d.ts', // Ignore TypeScript declaration files
  ];
  try {
    const build_config_file =
      args !== null && typeof args === 'object' && args.buildConfigFile
        ? args.buildConfigFile
        : 'build-config.json';
    const baseDir = args && args.baseDir ? args.baseDir : cwd();
    const buildConfig = readFileSync(
      resolveFrom(baseDir, build_config_file),
      'utf-8'
    );
    const parsed = JSON.parse(buildConfig);
    const rollupConfigs = parsed[builder];
    if (rollupConfigs && rollupConfigs.entries) {
      const gFormat = filterFormat(rollupConfigs.formats);
      const gExtensions = filterExtensions(rollupConfigs.extensions);
      const gExternal = rollupConfigs.externals;
      const entries = formatEntries(
        rollupConfigs.entries,
        gFormat,
        gExtensions,
        gExternal,
        rollupConfigs.exports
      );
      // console.log('entries', entries)
      if (entries) {
        const entriesKeys = Object.keys(entries);
        return {
          data: entriesKeys
            .flatMap((k) => {
              const ev = { ...entries }[k];
              // console.log('ev', ev);
              if (k.includes('*')) {
                const files = glob.sync(`${cwd()}/${k}`, {
                  ignore: [...defaultIgnore],
                });
                // console.log('glob is', files)
                return files.map((f) =>
                  filterEntries(
                    {
                      ...{ ...entries }[k],
                      plugins: rollupConfigs.plugins,
                      buildType: ev.buildType
                        ? ev.buildType
                        : rollupConfigs.buildType,
                      filePath: f,
                    },
                    gFormat,
                    gExtensions,
                    gExternal
                  )
                );
              }
              const entry = filterEntries(
                {
                  ...{ ...entries }[k],
                  plugins: rollupConfigs.plugins,
                  buildType: ev.buildType
                    ? ev.buildType
                    : rollupConfigs.buildType,
                  filePath: `${cwd()}/${k}`,
                },
                gFormat,
                gExtensions,
                gExternal
              );
              return entry;
            })
            .filter((a) => a !== null),
          copy: rollupConfigs.copy,
        };
      }
    }
  } catch (e) {
    console.log('error occurated', e);
  }
  return [] as unknown as {
    data: any[];
    copy: any;
  };
};

export const flattenedInputs = <Option extends BaseBuilderConfig<any>>(
  builder: 'rollup' | 'esbuild',
  args?: any
) => {
  const values = getDynamicInputs(builder, args);
  const builds = values.data.slice().flatMap((entry, index) => {
    let formats = Array.from(entry.formats);
    return formats.slice().flatMap((format, _index) => {
      return { ...entry, format } as unknown as EntryConfig<Option>;
    });
  });
  return builds;
};

export function init_build<
  T extends BaseBuilderConfig<any> = BaseBuilderConfig<any>
>(
  builder: 'rollup' | 'esbuild',
  arguments_config: ArgParserConfig[],
  options?: Partial<T>
) {
  const args = parseProcessArgs<T>(
    process.argv,
    [...arguments_config],
    options
  );
  const entries = flattenedInputs(builder, args);
  args.resolveOutDir = resolveOutDir;
  return { entries, args, options };
}

// export function resolveOutDir(
//   entry: any,
//   options: Partial<BaseBuilderConfig<any>>
// ) {
//   let {
//     baseDir = process.cwd(),
//     rootDir = process.cwd(),
//     outdir = 'dist',
//   } = { ...options };
//   const subdir = entry.filePath.replace(`${process.cwd()}/`, '');
//   const baseName = path.dirname(subdir);
//   let out: string;
//   out = `${outdir || 'dist'}`;
//   if (baseName.length > 0) {
//     if (options.rootDir) {
//       if (
//         baseName !== options.rootDir &&
//         baseName.startsWith(options.rootDir)
//       ) {
//         out += `/${baseName.replace(options.rootDir + '/', '')}`;
//       }
//     } else {
//       out += `/${baseName}`;
//     }
//   }
//   return out;
// }

/**
 * Resolves the output directory for an entry file, similar to TypeScript's rootDir behavior
 * Returns a relative path from the current working directory
 */
// export function resolveOutDir(
//   entry: EntryConfig<any>,
//   options: Partial<BaseBuilderConfig<any>> = {}
// ): string {
//   // Get configuration with defaults
//   let { baseDir = process.cwd(), rootDir, outdir = 'dist' } = { ...options };

//   // if (outdir === '') {
//   //   outdir = 'dist';
//   // }
//   // Resolve all paths to absolute for computation
//   const resolvedBaseDir = path.resolve(baseDir);
//   const resolvedEntryPath = path.resolve(path.normalize(entry.filePath!));
//   if (resolvedEntryPath.includes('\\')) {
//     console.log('resolved', resolvedEntryPath);
//   }

//   // Determine root directory
//   let resolvedRootDir: string;
//   if (rootDir) {
//     resolvedRootDir = path.isAbsolute(rootDir)
//       ? path.resolve(rootDir)
//       : path.resolve(resolvedBaseDir, rootDir);
//   } else {
//     resolvedRootDir = resolvedBaseDir;
//   }

//   // Calculate relative path from rootDir to entry directory
//   const entryDir = path.dirname(resolvedEntryPath);
//   const relativeToRoot = path.relative(resolvedRootDir, entryDir);

//   // Check if entry is under rootDir
//   const isEntryUnderRoot =
//     !relativeToRoot.startsWith('..') &&
//     !path.isAbsolute(relativeToRoot) &&
//     relativeToRoot !== '';

//   // Build output path
//   let outputPath = outdir;

//   if (isEntryUnderRoot) {
//     // Preserve directory structure relative to rootDir
//     outputPath = path.posix.join(outdir, relativeToRoot);
//   }
//   // else: entryConfig<any> is outside rootDir, output directly to outdir root

//   // Return relative path (normalize separators)
//   return path.normalize(outputPath);
// }

// /**
//  * Returns full output path information including directory and file
//  */
// export function resolveOutputPath(
//   entry: EntryConfig<any>,
//   options: Partial<BaseBuilderConfig<any>> = {}
// ): {
//   outDir: string; // Output directory for this entry (relative)
//   outputPath: string; // Full output path for this entry (relative)
//   fileName: string; // Output file name
// } {
//   const outDir = resolveOutDir(entry, options);
//   const fileName = path.basename(entry.filePath!);

//   return {
//     outDir,
//     outputPath: path.join(outDir, fileName),
//     fileName,
//   };
// }
//

/**
 * Normalize a path for the current platform
 * This handles:
 * - Converting between forward/backward slashes based on platform
 * - Resolving relative paths (., ..)
 * - Removing redundant separators
 */

/**
 * Normalize a path for the current platform
 */
function normalizePath(inputPath: string): string {
  return path.normalize(inputPath);
}

/**
 * Resolves the output directory for an entry file, similar to TypeScript's rootDir behavior
 * Returns a path normalized for the current platform
 */
export function resolveOutDir(
  entry: any,
  options: Partial<BaseBuilderConfig<any>> = {},
  debug = false
): string {
  // Get configuration with defaults
  const { baseDir = process.cwd(), rootDir } = options;

  // Handle outdir with proper defaulting
  let { outdir = 'dist' } = options;

  // If outdir is explicitly set to empty string, still use 'dist'
  if (outdir === '' && options.outdir === '') {
    outdir = 'dist';
  }

  // Normalize the entry path to handle mixed separators
  const normalizedEntryPath = normalizePath(entry.filePath);

  // Resolve all paths to absolute for computation
  const resolvedBaseDir = path.resolve(baseDir);
  const resolvedEntryPath = path.resolve(normalizedEntryPath);

  // Determine root directory
  let resolvedRootDir: string;
  if (rootDir) {
    resolvedRootDir = path.isAbsolute(rootDir)
      ? path.resolve(rootDir)
      : path.resolve(resolvedBaseDir, rootDir);
  } else {
    resolvedRootDir = resolvedBaseDir;
  }
  if (debug) {
    console.log('debug', {
      baseDir,
      normalizedEntryPath,
      resolvedBaseDir,
      resolvedEntryPath,
      resolvedRootDir,
    });
  }

  // Calculate relative path from rootDir to entry directory
  const entryDir = path.dirname(resolvedEntryPath);
  const relativeToRoot = path.relative(resolvedRootDir, entryDir);

  // Check if entry is under rootDir
  const isEntryUnderRoot =
    !relativeToRoot.startsWith('..') &&
    !path.isAbsolute(relativeToRoot) &&
    relativeToRoot !== '';

  // Build output path
  let outputPath = outdir;

  if (isEntryUnderRoot) {
    // Preserve directory structure relative to rootDir
    outputPath = path.join(outdir, relativeToRoot);
  }
  // else: entry is outside rootDir, output directly to outdir root

  // Normalize the output path
  return normalizePath(outputPath);
}

/**
 * Returns full output path information including directory and file
 */
export function resolveOutputPath(
  entry: any,
  options: Partial<BaseBuilderConfig<any>> = {}
): {
  outDir: string; // Output directory for this entry
  outputPath: string; // Full output path for this entry
  fileName: string; // Output file name
} {
  const outDir = resolveOutDir(entry, options);
  const fileName = path.basename(entry.filePath);
  const outputPath = path.join(outDir, fileName);

  return {
    outDir: normalizePath(outDir),
    outputPath: normalizePath(outputPath),
    fileName,
  };
}

// function normalizePath(inputPath: string): string {
//   return path.normalize(inputPath);
// }

/**
 * Resolves the output directory for an entry file, similar to TypeScript's rootDir behavior
 * Returns a path normalized for the current platform
 */
// export function resolveOutDir(
//   entry: any,
//   options: Partial<BaseBuilderConfig<any>> = {}
// ): string {
//   // Get configuration with defaults
//   const { baseDir = process.cwd(), rootDir, outdir = 'dist' } = options;

//   // Resolve all paths to absolute for computation
//   const resolvedBaseDir = path.resolve(baseDir);
//   const resolvedEntryPath = path.resolve(entry.filePath);

//   // Determine root directory
//   let resolvedRootDir: string;
//   if (rootDir) {
//     resolvedRootDir = path.isAbsolute(rootDir)
//       ? path.resolve(rootDir)
//       : path.resolve(resolvedBaseDir, rootDir);
//   } else {
//     resolvedRootDir = resolvedBaseDir;
//   }

//   // Calculate relative path from rootDir to entry directory
//   const entryDir = path.dirname(resolvedEntryPath);
//   const relativeToRoot = path.relative(resolvedRootDir, entryDir);

//   // Check if entry is under rootDir
//   const isEntryUnderRoot =
//     !relativeToRoot.startsWith('..') &&
//     !path.isAbsolute(relativeToRoot) &&
//     relativeToRoot !== '';

//   // Build output path
//   let outputPath = outdir;

//   if (isEntryUnderRoot) {
//     // Preserve directory structure relative to rootDir
//     outputPath = path.join(outdir, relativeToRoot);
//   }
//   // else: entry is outside rootDir, output directly to outdir root

//   // Normalize for the current platform
//   return normalizePath(outputPath);
// }

/**
 * Returns full output path information including directory and file
 */
// export function resolveOutputPath(
//   entry: any,
//   options: Partial<BaseBuilderConfig<any>> = {}
// ): {
//   outDir: string; // Output directory for this entry
//   outputPath: string; // Full output path for this entry
//   fileName: string; // Output file name
// } {
//   const outDir = resolveOutDir(entry, options);
//   const fileName = path.basename(entry.filePath);
//   const outputPath = path.join(outDir, fileName);

//   return {
//     outDir: normalizePath(outDir),
//     outputPath: normalizePath(outputPath),
//     fileName,
//   };
// }

/**
 * Utility function to convert any path to forward slashes (useful for consistent test expectations)
 */
// export function toForwardSlashes(inputPath: string): string {
//   return inputPath.replace(/\\/g, '/');
// }

// /**
//  * Utility function to convert any path to backward slashes (for Windows)
//  */
// export function toBackwardSlashes(inputPath: string): string {
//   return inputPath.replace(/\//g, '\\');
// }

/**
 * Alternative version that can return absolute paths if needed
 */
export function resolveOutputPathAbsolute(
  entry: EntryConfig<any>,
  options: Partial<BaseBuilderConfig<any>> = {}
): {
  outDir: string; // Absolute output directory
  outputPath: string; // Absolute output path
  fileName: string;
  relativeOutDir: string; // Relative output directory
  relativeOutputPath: string; // Relative output path
} {
  const { baseDir = process.cwd(), outdir = 'dist' } = options;

  // Resolve base directory
  const resolvedBaseDir = path.resolve(baseDir);

  // Get relative output directory
  const relativeOutDir = resolveOutDir(entry, options);

  // Convert to absolute
  const absoluteOutDir = path.resolve(resolvedBaseDir, relativeOutDir);
  const fileName = path.basename(entry.filePath!);
  const absoluteOutputPath = path.join(absoluteOutDir, fileName);

  return {
    outDir: absoluteOutDir,
    outputPath: absoluteOutputPath,
    fileName,
    relativeOutDir,
    relativeOutputPath: path.join(relativeOutDir, fileName),
  };
}

export function legacyReactExternals() {
  return ['react', 'react/*'];
}
export function legacyLitExternals() {
  return ['lit', 'lit/*', '@lit/*'];
}
export function libExternals() {
  return ['@fluixi/*'];
}

export function defineExternals(
  options: Partial<BaseBuilderConfig<any>>,
  externals?: string[]
) {
  const external: string[] = externals || [];
  if (options.reactExternal) {
    external.push(...legacyReactExternals());
  }
  if (options.litExternal) {
    external.push(...legacyLitExternals());
  }
  if (options.libExternal) {
    external.push(...libExternals());
  }
  return external;
}
