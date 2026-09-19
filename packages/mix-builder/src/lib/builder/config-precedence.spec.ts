import { describe, expect, it } from 'vitest';
import { explicitArgs, parseProcessArgs, providedKeys } from '../arguments/index.js';
import { merge } from './utils.js';
import { resolveClean, resolveOutdir } from './orchestrator.js';

/**
 * A `defaultValue` must not outrank build-config.json.
 *
 * The parser fills in a value for every key that declares a default, and the config
 * merge used to end with that whole object. A default was therefore indistinguishable
 * from a flag someone typed, and it won. `clean: true` in a config file lost to the
 * parser's `clean: false` and the clean step never ran, for anyone.
 *
 * `minify` was the first symptom of this and got treated locally, by deleting its
 * default. The merge was the actual bug, and 39 options carried a default.
 */
const CONFIGS = [
  { key: 'dts', type: 'boolean' as const, defaultValue: false },
  { key: 'outdir', type: 'string' as const, defaultValue: 'dist' },
];

interface Parsed {
  dts?: boolean;
  outdir?: string;
}

const argv = (...flags: string[]) => ['node', 'mix-builder', ...flags];
const parse = (...flags: string[]) => parseProcessArgs<Parsed>(argv(...flags), CONFIGS);

describe('parseProcessArgs records what was actually passed', () => {
  it('reports nothing provided when only defaults filled in', () => {
    const args = parse();
    expect(args.dts).toBe(false);
    expect(providedKeys(args).has('dts')).toBe(false);
  });

  it('reports a flag that was passed', () => {
    const args = parse('--dts');
    expect(providedKeys(args).has('dts')).toBe(true);
  });

  it('counts values handed in by a caller as provided', () => {
    const args = parseProcessArgs<Parsed>(argv(), CONFIGS, { outdir: 'build' });
    expect(providedKeys(args).has('outdir')).toBe(true);
  });

  it('keeps provenance off the object itself, so a merge cannot pick it up', () => {
    const args = parse('--dts');
    expect(Object.keys(args)).not.toContain('providedKeys');
    expect(JSON.parse(JSON.stringify(args))).toEqual({ dts: true, outdir: 'dist' });
    expect({ ...(args as object) }).not.toHaveProperty('providedKeys');
  });
});

describe('explicitArgs', () => {
  it('is empty when everything was defaulted', () => {
    expect(explicitArgs(parse())).toEqual({});
  });

  it('carries only the typed flags', () => {
    expect(explicitArgs(parse('--dts'))).toEqual({
      dts: true,
    });
  });

  it('treats an unparsed object as having nothing explicit', () => {
    expect(explicitArgs({ dts: true })).toEqual({});
  });
});

describe('the resulting precedence', () => {
  const mergeLikeCli = (args: any, file: any) =>
    merge(args, file, explicitArgs(args));

  it('lets the config file beat a default', () => {
    const args = parse();
    expect(mergeLikeCli(args, { dts: true }).dts).toBe(true);
  });

  it('lets a typed flag beat the config file', () => {
    const args = parse('--dts=false');
    expect(mergeLikeCli(args, { dts: true }).dts).toBe(false);
  });

  it('falls back to the default when neither says anything', () => {
    const args = parse();
    expect(mergeLikeCli(args, {}).dts).toBe(false);
  });
});

describe('clean and outdir are read wherever they are declared', () => {
  it('honours a top-level clean', () => {
    expect(resolveClean({ clean: true })).toBe(true);
  });

  it('honours clean inside the esbuild block, which is where configs put it', () => {
    expect(resolveClean({ esbuild: { clean: true } })).toBe(true);
  });

  it('honours clean inside the rollup block', () => {
    expect(resolveClean({ rollup: { clean: true } })).toBe(true);
  });

  it('is false when nothing asks for it', () => {
    expect(resolveClean({})).toBe(false);
    expect(resolveClean({ esbuild: {} })).toBe(false);
  });

  it('an explicit top-level clean wins over a nested one', () => {
    // Reachable only because `clean` declares no defaultValue: an absent flag leaves it
    // undefined, so a `false` here really was asked for.
    expect(resolveClean({ clean: false, esbuild: { clean: true } })).toBe(false);
  });

  it('a nested clean is not masked by an absent top-level one', () => {
    // The whole bug: the parser used to put `clean: false` here and this returned false.
    expect(resolveClean({ clean: undefined, esbuild: { clean: true } })).toBe(true);
  });

  it('defaults outdir to dist rather than treating it as nowhere', () => {
    expect(resolveOutdir({})).toBe('dist');
  });

  it('takes outdir from the builder block', () => {
    expect(resolveOutdir({ esbuild: { outdir: 'out' } })).toBe('out');
  });

  it('a top-level outdir wins', () => {
    expect(resolveOutdir({ outdir: 'top', esbuild: { outdir: 'nested' } })).toBe('top');
  });
});

describe('nothing hands clean a concrete default', () => {
  it('no arg-parser config declares one', async () => {
    // Same guard as `minify`, for the same reason: a default here is read as a choice
    // and outranks the config file. Keep `clean` absent when it is absent.
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));

    for (const file of ['utils.ts', 'esbuild/base.ts']) {
      const src = readFileSync(join(here, file), 'utf-8');
      const match = /key:\s*'clean',([\s\S]*?)\n\s*\},/.exec(src);
      if (!match) continue; // not every arg config declares clean
      expect(match[1], `${file} must not give clean a defaultValue`).not.toMatch(
        /defaultValue/,
      );
    }
  });
});

describe('the cli no longer merges the whole parsed-args object over the file', () => {
  it('both merge sites use explicitArgs', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'cli_prepare.ts'),
      'utf-8',
    );
    // A merge ending in a bare `cliArgs` is the bug this guards.
    expect(src).not.toMatch(/merge\([^)]*,\s*cliArgs\s*\)/s);
    expect(src.match(/explicitArgs\(cliArgs\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
