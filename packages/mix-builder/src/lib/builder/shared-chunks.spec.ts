import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { buildShared, groupShared, type SharedEntry } from './orchestrator.js';

/**
 * Built one at a time, two entries that import the same module each got a copy of it, and
 * with it a copy of its state: a registry one entry wrote was not the one the other read.
 * Built together, the module is emitted once, as a chunk both import.
 */
let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

function project(): { entry: (file: string, outDir: string, banner?: string) => SharedEntry } {
  root = mkdtempSync(join(tmpdir(), 'mix-shared-'));
  mkdirSync(join(root, 'src/sub'), { recursive: true });
  writeFileSync(join(root, 'src/state.ts'), 'export const registry = new Map<string, number>();\n');
  writeFileSync(join(root, 'src/a.ts'), "import { registry } from './state';\nexport const write = (k: string) => registry.set(k, 1);\n");
  writeFileSync(join(root, 'src/sub/b.ts'), "import { registry } from '../state';\nexport const read = (k: string) => registry.get(k);\n");
  return {
    entry: (file, outDir, banner) => ({
      inputFile: join(root, file),
      outputDir: join(root, outDir),
      banner: banner ? { js: banner } : undefined,
      format: 'esm',
      buildOptions: {
        bundle: true,
        splitting: true,
        format: 'esm',
        platform: 'node',
        outExtension: { '.js': '.mjs' },
        entryNames: '[name]',
        chunkNames: '[name]-[hash]',
        logLevel: 'silent',
      },
    }),
  };
}

describe('esm entries built together', () => {
  it('share one copy of a module they both import, and keep their paths', async () => {
    const { entry } = project();
    const dist = join(root, 'dist');
    await buildShared([entry('src/a.ts', 'dist', '/*! banner */'), entry('src/sub/b.ts', 'dist/sub')], dist);

    expect(existsSync(join(dist, 'a.mjs'))).toBe(true);
    expect(existsSync(join(dist, 'sub/b.mjs'))).toBe(true);
    const a = await import(pathToFileURL(join(dist, 'a.mjs')).href);
    const b = await import(pathToFileURL(join(dist, 'sub/b.mjs')).href);
    a.write('key');
    expect(b.read('key')).toBe(1);
  });

  it('put a banner on the entry that asked for it, not on the shared chunk', async () => {
    const { entry } = project();
    const dist = join(root, 'dist');
    await buildShared([entry('src/a.ts', 'dist', '/*! banner */'), entry('src/sub/b.ts', 'dist/sub')], dist);
    expect(readFileSync(join(dist, 'a.mjs'), 'utf8').startsWith('/*! banner */')).toBe(true);
    expect(readFileSync(join(dist, 'sub/b.mjs'), 'utf8').startsWith('/*! banner */')).toBe(false);
  });

  it('keeps entries whose options differ in separate builds', () => {
    const { entry } = project();
    const plain = entry('src/a.ts', 'dist');
    const other = entry('src/sub/b.ts', 'dist/sub');
    other.buildOptions = { ...other.buildOptions, external: ['react'] };
    expect(groupShared([plain, entry('src/sub/b.ts', 'dist/sub')])).toHaveLength(1);
    expect(groupShared([plain, other])).toHaveLength(2);
  });
});
