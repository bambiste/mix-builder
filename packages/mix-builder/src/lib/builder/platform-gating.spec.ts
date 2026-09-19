import { describe, expect, it } from 'vitest';

/**
 * An explicit `platform` has to reach esbuild.
 *
 * esbuild treats node builtins as external under `platform: 'node'` and tries to bundle
 * them under `browser`. A node package therefore has to be able to say so, and both
 * esbuild paths used to decide the platform from the format alone, overwriting whatever
 * was configured. The symptom was `Could not resolve "node:fs"` in the esm output of a
 * package whose config asked for node.
 *
 * Same shape of bug as the `minify` gating, in the same two files, so it is guarded the
 * same way.
 */
function resolvePlatform(args: { platform?: string; format: string }): string {
  return args.platform || (args.format === 'cjs' ? 'node' : 'browser');
}

describe('platform resolution', () => {
  it('defaults esm to browser', () => {
    expect(resolvePlatform({ format: 'esm' })).toBe('browser');
  });

  it('defaults cjs to node, which is where it is loaded', () => {
    expect(resolvePlatform({ format: 'cjs' })).toBe('node');
  });

  it('an explicit platform wins for esm, so builtins stay external', () => {
    expect(resolvePlatform({ platform: 'node', format: 'esm' })).toBe('node');
  });

  it('an explicit platform wins for cjs too', () => {
    expect(resolvePlatform({ platform: 'browser', format: 'cjs' })).toBe('browser');
  });

  it('passes neutral through', () => {
    expect(resolvePlatform({ platform: 'neutral', format: 'esm' })).toBe('neutral');
  });
});

describe('neither esbuild implementation recomputes platform over the configured one', () => {
  it('no build options object hardcodes the format check for platform', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));

    for (const file of ['orchestrator.ts', 'esbuild/builder.ts']) {
      const src = readFileSync(join(here, file), 'utf-8');
      // `platform: format === 'cjs' ? ...` with nothing in front of it discards an
      // explicit value. Either `platform,` or an `args.platform ||` fallback is fine.
      expect(src, `${file} must not discard a configured platform`).not.toMatch(
        /platform:\s*format\s*===/,
      );
    }
  });
});
