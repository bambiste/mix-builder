import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'builder.ts'), 'utf-8');

/**
 * The rollup TypeScript plugin needs a TypeScript that has a compiler API, and it is
 * loaded on demand so the esbuild path never needs one at all.
 *
 * `@rollup/plugin-typescript` reaches into `typescript` as it is imported. Importing it
 * at module scope therefore broke every build in a project without TypeScript, or with
 * a TypeScript the plugin cannot drive, including an esbuild build that never wanted it.
 * That shipped in 0.1.0 and 0.2.0: `npm i @bambiste/mix-builder` and running it failed
 * with `Cannot read properties of undefined (reading 'ES2015')`.
 */
describe('the rollup TypeScript plugin is loaded on demand', () => {
  it('is not imported at module scope', () => {
    const importLine = /^import .*['"]@rollup\/plugin-typescript['"]/m;
    expect(source).not.toMatch(importLine);
  });

  it('is imported inside the branch that wants it', () => {
    expect(source).toMatch(/await import\(\s*'@rollup\/plugin-typescript'\s*\)/);
  });

  it('checks for the compiler API rather than a version range', () => {
    // A range needs updating every release; the capability does not.
    expect(source).toMatch(/createProgram/);
    expect(source).not.toMatch(/typescript@?\s*['"][<>^~]/);
  });
});

/**
 * The detection rule, applied to the shapes that actually ship.
 *
 * TypeScript 7 is the Go port: it exports `version` and `versionMajorMinor` and nothing
 * else, so anything driving the compiler API fails inside itself with a message that
 * names none of this.
 */
const hasCompilerApi = (api: { createProgram?: unknown } | undefined): boolean =>
  typeof api?.createProgram === 'function';

describe('compiler API detection', () => {
  it('rejects the TypeScript 7 shape', () => {
    expect(hasCompilerApi({ version: '7.0.2' } as never)).toBe(false);
  });

  it('accepts a TypeScript that exposes createProgram', () => {
    expect(hasCompilerApi({ createProgram: () => undefined } as never)).toBe(true);
  });

  it('rejects an absent typescript', () => {
    expect(hasCompilerApi(undefined)).toBe(false);
  });

  it('agrees with the TypeScript installed in this repo', async () => {
    const ts = (await import('typescript')) as unknown as {
      default?: { createProgram?: unknown };
      createProgram?: unknown;
    };
    const api = ts.default ?? ts;
    expect(hasCompilerApi(api)).toBe(true);
  });
});
