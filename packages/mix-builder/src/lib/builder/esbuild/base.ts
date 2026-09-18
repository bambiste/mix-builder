import type { BuildOptions as EsbuildOptions } from 'esbuild';
import type { BannerOption } from './banner.js';
import { type ArgParserConfig } from '../../arguments/index.js';
import { BaseBuilderConfig, formatResolver } from '../base.js';
import { BUILDER_PROPS_CONFIG } from '../utils.js';

type IEsbuilOption = Omit<
  EsbuildOptions,
  'entryPoints' | 'external' | 'format' | 'banner'
>;
export interface EsbuildBuilderConfig
  extends IEsbuilOption,
    BaseBuilderConfig<IEsbuilOption> {
  /**
   * Write a `.d.cts` beside every `.d.ts`, for a `"type": "module"` package that also ships
   * commonjs. Without one, a `require` consumer resolves ESM-shaped types and TypeScript
   * reports TS1479 against a file that runs perfectly well.
   *
   * Off by default: it only makes sense for a package whose exports name the two formats
   * separately.
   */
  cjsTypes?: boolean;
  /**
   * Advanced file copying with glob pattern support
   */
  copyFiles?: Array<{
    /**
     * Source path or glob pattern(s)
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

  /**
   * A comment prepended to built files, for copyright and authorship.
   *
   * A string is the JavaScript banner for every entry. The object form adds a `css`
   * banner and `include`/`exclude` globs, so an entry a consumer loads can be marked
   * while internal chunks are left alone.
   *
   * `{name}`, `{version}`, `{description}`, `{license}`, `{homepage}`, `{author}` and
   * `{year}` are substituted from package.json, so the text does not go stale at a
   * release. An unrecognised token is left as written, because a visible typo is better
   * than a silently empty line.
   *
   * @example
   * ```json
   * { "banner": "/*! {name} v{version} | (c) {year} {author} | {license} *\/" }
   * ```
   *
   * @example Only the public entries:
   * ```json
   * {
   *   "banner": {
   *     "js": "/*! {name} v{version} *\/",
   *     "include": ["src/index.ts", "src/cdn/*.ts"]
   *   }
   * }
   * ```
   */
  banner?: BannerOption;
}
/**
 * Default configuration for esbuild arguments for cli
 *
 * `ESBUILD_PROPS_CONFIG`\
 * `skipExternal` and `external` are mutually exclusive
 *
 * `pkgExternal` for making external from package.json dependencies defaults to `false`
 *
 * `env` defaults to `production`\
 * Reference: https://esbuild.github.io/api/#build
 */
export const ESBUILD_PROPS_CONFIG: ArgParserConfig[] = [
  ...BUILDER_PROPS_CONFIG,
  {
    key: 'minify',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'minifySyntax',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'minifyWhitespace',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'minifyIdentifiers',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'bundle',
    type: 'boolean',
    defaultValue: true,
  },
  {
    key: 'cjsTypes',
    type: 'boolean',
    defaultValue: false,
  },
  {
    key: 'sourcemap',
    type: 'boolean',
    defaultValue: false,
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
    key: 'format',
    type: 'string',
    expectedValues: ['es', 'cjs', 'esm', 'iife'],
    defaultValue: 'esm',
    handler: formatResolver,
  },
  {
    // Global variable an iife build hangs its exports on (window.<globalName>).
    // Required by esbuild for iife; ignored for esm/cjs.
    key: 'globalName',
    type: 'string',
  },
  {
    key: 'entryNames',
    type: 'string',
    defaultValue: '[name]',
  },
  {
    key: 'chunkNames',
    type: 'string',
    defaultValue: '[name]-[hash]',
  },
  {
    key: 'assetNames',
    type: 'string',
    defaultValue: '[name]-[hash]',
  },
  {
    key: 'target',
    type: 'string',
    defaultValue: 'es2021',
  },
  {
    key: 'platform',
    type: 'string',
    defaultValue: 'browser',
    expectedValues: ['browser', 'node', 'neutral'],
  },
  {
    key: 'legalComments',
    type: 'string',
    defaultValue: 'none',
    expectedValues: ['inline', 'none', 'eof', 'linked', 'external'],
  },
  {
    key: 'charset',
    type: 'string',
    defaultValue: 'utf8',
    expectedValues: ['utf8'],
  },
  {
    key: 'outExtension',
    type: 'string',
  },
] as const;
