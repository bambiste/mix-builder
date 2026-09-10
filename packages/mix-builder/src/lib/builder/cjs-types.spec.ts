import { describe, it, expect } from 'vitest';
import { toCjsDeclaration } from './cjs-types.js';

/**
 * The point of a `.d.cts` is that a CommonJS consumer stops seeing ESM-shaped types. A copy
 * that still points at `./x.js` reproduces the problem one level down, so the rewriting is
 * the part worth pinning.
 */
describe('toCjsDeclaration', () => {
  it('points a relative export at the cjs beside it', () => {
    expect(toCjsDeclaration(`export * from './ir/nodes.js';\n`)).toBe(
      `export * from './ir/nodes.cjs';\n`,
    );
  });

  it('rewrites every form a specifier takes', () => {
    const source = [
      `import type { A } from '../a.js';`,
      `export { b } from './b.js';`,
      `declare const c: import('./c.js').C;`,
      `declare const d: typeof require('../d.js');`,
    ].join('\n');
    expect(toCjsDeclaration(source)).toBe(
      [
        `import type { A } from '../a.cjs';`,
        `export { b } from './b.cjs';`,
        `declare const c: import('./c.cjs').C;`,
        `declare const d: typeof require('../d.cjs');`,
      ].join('\n') + '\n',
    );
  });

  it('leaves a bare specifier alone', () => {
    // A package name resolves through its own exports map, which already knows both formats.
    const source = `import type { Plugin } from 'vite';\nexport * from '@scope/pkg/sub.js';\n`;
    expect(toCjsDeclaration(source)).toBe(source);
  });

  it('leaves a relative specifier with no extension alone', () => {
    expect(toCjsDeclaration(`export * from './x';\n`)).toBe(`export * from './x';\n`);
  });

  it('drops the source map link, which does not follow the copy', () => {
    const source = `export declare const a = 1;\n//# sourceMappingURL=a.d.ts.map\n`;
    expect(toCjsDeclaration(source)).toBe(`export declare const a = 1;\n`);
  });

  it('does not touch a .js inside a string that is not a specifier', () => {
    const source = `export declare const file: './not-a-specifier.js';\n`;
    expect(toCjsDeclaration(source)).toBe(source);
  });
});
