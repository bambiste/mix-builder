/**
 * CommonJS type declarations for a dual-format package.
 *
 * A package with `"type": "module"` that ships one `.d.ts` for both its `import` and
 * `require` conditions gives CommonJS consumers ESM-shaped types. TypeScript then reports
 * TS1479, "cannot be imported with require", even though the `.cjs` file beside it runs
 * perfectly well. The fix is a second declaration whose extension says CommonJS.
 *
 * Copying is not enough. A declaration that says `from './x.js'` still points at the ESM
 * file, so the same complaint reappears one level down; relative specifiers are rewritten to
 * the `.cjs` beside them, which is what the bundler emitted anyway.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

/** `from './x.js'`, `require('../y.js')`, `import('./z.js')`, the specifier only. */
const RELATIVE = /(\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]*?)\.js\2/g;

/** A declaration's own map does not follow it, and a dangling link is worse than none. */
const MAP_COMMENT = /^\/\/# sourceMappingURL=.*$/gm;

/** What a `.d.cts` should contain, given the `.d.ts` beside it. */
export function toCjsDeclaration(source: string): string {
  return source.replace(RELATIVE, (_m, lead: string, quote: string, path: string) =>
    `${lead}${quote}${path}.cjs${quote}`,
  ).replace(MAP_COMMENT, '').trimEnd() + '\n';
}

function* declarations(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* declarations(full);
    else if (name.endsWith('.d.ts')) yield full;
  }
}

/**
 * Write a `.d.cts` beside every `.d.ts` under `outDir`. Returns how many were written.
 *
 * Runs after the bundles, so the `.cjs` files the rewritten specifiers point at are already
 * there. Existing `.d.cts` files are overwritten: they are generated, not authored.
 */
export function emitCjsTypes(outDir: string, log = false): number {
  let written = 0;
  for (const file of declarations(outDir)) {
    const target = file.replace(/\.d\.ts$/, '.d.cts');
    writeFileSync(target, toCjsDeclaration(readFileSync(file, 'utf-8')));
    written++;
  }
  if (log && written) console.log(`📝 ${written} .d.cts written for commonjs consumers`);
  return written;
}
