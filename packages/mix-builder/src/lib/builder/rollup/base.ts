import type { RollupOptions, OutputOptions } from 'rollup';
import { BaseBuilderConfig, Entries } from '../base.js';
import { ArgParserConfig } from 'src/lib/arguments/index.js';

type IRollupOptions = Omit<RollupOptions, 'input' | 'output' | 'external'>;
export interface RollupBuilderConfig
  extends IRollupOptions,
    BaseBuilderConfig<IRollupOptions> {
  /**
   * Entry points
   */

  /**
   * Rollup output overrides
   */
  output?: OutputOptions | OutputOptions[];
}
