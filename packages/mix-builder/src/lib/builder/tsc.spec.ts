import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveTscBin, runTsc, tscApplies, tscArgs } from './tsc.js';

describe('tscApplies', () => {
  it('is false without a block, so an existing config builds as before', () => {
    expect(tscApplies(undefined)).toBe(false);
  });

  it('is true for a block with no keys, which reads as asking for the default project', () => {
    expect(tscApplies({})).toBe(true);
  });

  it('honours an explicit disable', () => {
    expect(tscApplies({ enabled: false })).toBe(false);
    expect(tscApplies({ project: 'tsconfig.lib.json', enabled: false })).toBe(false);
  });
});

describe('tscArgs', () => {
  it('defaults to tsconfig.json', () => {
    expect(tscArgs({})).toEqual(['-p', 'tsconfig.json']);
  });

  it('takes the named project', () => {
    expect(tscArgs({ project: 'tsconfig.lib.json' })).toEqual([
      '-p',
      'tsconfig.lib.json',
    ]);
  });

  it('adds emitDeclarationOnly when asked', () => {
    expect(tscArgs({ project: 'a.json', emitDeclarationOnly: true })).toEqual([
      '-p',
      'a.json',
      '--emitDeclarationOnly',
    ]);
  });

  it('passes extra flags through as written, after the project', () => {
    expect(tscArgs({ args: ['--pretty', 'false'] })).toEqual([
      '-p',
      'tsconfig.json',
      '--pretty',
      'false',
    ]);
  });
});

describe('resolveTscBin', () => {
  it('finds the compiler this package depends on', () => {
    // mix-builder has typescript itself, so resolution from here must succeed.
    expect(resolveTscBin(process.cwd())).toBeTruthy();
  });

  it('returns undefined where typescript cannot be resolved', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mb-no-ts-'));
    try {
      // A bare temp directory has no node_modules above it inside tmp.
      expect(resolveTscBin(dir)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('runTsc', () => {
  it('does nothing without a block', () => {
    expect(runTsc(undefined)).toEqual({
      ran: false,
      ok: true,
      skipped: 'not configured',
    });
  });

  it('does nothing when disabled, without needing the project to exist', () => {
    expect(runTsc({ enabled: false, project: 'nope.json' }).ran).toBe(false);
  });

  it('says which project is missing rather than failing inside tsc', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mb-tsc-missing-'));
    try {
      expect(() => runTsc({ project: 'tsconfig.lib.json' }, dir)).toThrow(
        /project "tsconfig.lib.json", which does not exist/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('runTsc against a real compiler', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'mb-tsc-real-'));
    mkdirSync(path.join(dir, 'src'));
    writeFileSync(
      path.join(dir, 'src', 'index.ts'),
      'export const greet = (who: string): string => `hi ${who}`;\n',
    );
    // Link the compiler in so resolution from this directory finds one.
    const ts = path.dirname(
      require.resolve('typescript/package.json', { paths: [process.cwd()] }),
    );
    mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    require('node:fs').symlinkSync(ts, path.join(dir, 'node_modules', 'typescript'));
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('emits the declarations exports.types would point at', () => {
    writeFileSync(
      path.join(dir, 'tsconfig.lib.json'),
      JSON.stringify({
        compilerOptions: {
          declaration: true,
          outDir: 'dist',
          rootDir: 'src',
          module: 'nodenext',
          moduleResolution: 'nodenext',
          target: 'es2022',
        },
        include: ['src/**/*.ts'],
      }),
    );

    const result = runTsc({ project: 'tsconfig.lib.json' }, dir);
    expect(result.ran).toBe(true);
    expect(result.ok).toBe(true);
    expect(existsSync(path.join(dir, 'dist', 'index.d.ts'))).toBe(true);
    expect(existsSync(path.join(dir, 'dist', 'index.js'))).toBe(true);
  });

  it('emitDeclarationOnly leaves the JS to the bundlers', () => {
    rmSync(path.join(dir, 'dist'), { recursive: true, force: true });
    const result = runTsc(
      { project: 'tsconfig.lib.json', emitDeclarationOnly: true },
      dir,
    );
    expect(result.ok).toBe(true);
    expect(existsSync(path.join(dir, 'dist', 'index.d.ts'))).toBe(true);
    expect(existsSync(path.join(dir, 'dist', 'index.js'))).toBe(false);
  });

  it('fails the build on a type error', () => {
    writeFileSync(path.join(dir, 'src', 'bad.ts'), 'export const n: number = "no";\n');
    try {
      expect(() => runTsc({ project: 'tsconfig.lib.json' }, dir)).toThrow(/tsc exited/);
    } finally {
      rmSync(path.join(dir, 'src', 'bad.ts'));
    }
  });

  it('failOnError false reports the failure without throwing', () => {
    writeFileSync(path.join(dir, 'src', 'bad.ts'), 'export const n: number = "no";\n');
    try {
      const result = runTsc(
        { project: 'tsconfig.lib.json', failOnError: false },
        dir,
      );
      expect(result.ran).toBe(true);
      expect(result.ok).toBe(false);
    } finally {
      rmSync(path.join(dir, 'src', 'bad.ts'));
    }
  });
});

describe('the orchestrator sequences tsc between clean and the bundlers', () => {
  it('calls it after cleanOutputDirectory and before any builder', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'orchestrator.ts'),
      'utf-8',
    );
    const clean = src.indexOf('cleanOutputDirectory(config.outdir)');
    const tsc = src.indexOf('runTsc(config.tsc)');
    const esbuild = src.indexOf('await buildWithESBuild(');
    expect(clean, 'clean call not found').toBeGreaterThan(-1);
    expect(tsc, 'tsc call not found').toBeGreaterThan(-1);
    expect(esbuild, 'esbuild call not found').toBeGreaterThan(-1);
    // Ordering is the whole point: a clean after tsc deletes the declarations.
    expect(tsc).toBeGreaterThan(clean);
    expect(tsc).toBeLessThan(esbuild);
  });
});
