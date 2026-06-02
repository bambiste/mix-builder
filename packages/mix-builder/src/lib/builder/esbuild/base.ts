import type { BuildOptions as EsbuildOptions } from 'esbuild';
import { type ArgParserConfig } from '../../arguments/index.js';
import { BaseBuilderConfig, formatResolver } from '../base.js';
import { BUILDER_PROPS_CONFIG } from '../utils.js';

type IEsbuilOption = Omit<
  EsbuildOptions,
  'entryPoints' | 'external' | 'format'
>;
export interface EsbuildBuilderConfig
  extends IEsbuilOption,
    BaseBuilderConfig<IEsbuilOption> {
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
