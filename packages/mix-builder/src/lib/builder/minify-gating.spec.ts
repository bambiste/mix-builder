import { describe, expect, it } from 'vitest';

/**
 * `minify: false` has to mean it.
 *
 * esbuild takes `minify` and three granular flags, and honours the granular ones on
 * their own. The arg parser gives each of those a concrete `true` default, so a
 * `?? minify` fallback never fires and the build stayed minified no matter what the
 * config said. Gating them on `minify` is the fix.
 *
 * The rule is asserted rather than the wiring, because it was written twice: once in
 * `orchestrator.ts`, which the CLI runs, and once in `esbuild/builder.ts`, which is
 * exported for direct use. Fixing one left the other wrong.
 */
function resolveMinify(args: {
  minify?: boolean;
  minifySyntax?: boolean;
  minifyWhitespace?: boolean;
  minifyIdentifiers?: boolean;
  format: string;
}): Record<string, boolean> {
  const minifying = args.format === 'cjs' ? false : args.minify ?? true;
  return {
    minify: minifying,
    minifySyntax: minifying && (args.minifySyntax ?? true),
    minifyWhitespace: minifying && (args.minifyWhitespace ?? true),
    minifyIdentifiers: minifying && (args.minifyIdentifiers ?? true),
  };
}

describe('minify gating', () => {
  it('turns every flag off when minify is false', () => {
    // The granular flags arrive as `true` from the arg parser, which is the case that
    // used to defeat this.
    expect(
      resolveMinify({
        minify: false,
        minifySyntax: true,
        minifyWhitespace: true,
        minifyIdentifiers: true,
        format: 'esm',
      }),
    ).toEqual({
      minify: false,
      minifySyntax: false,
      minifyWhitespace: false,
      minifyIdentifiers: false,
    });
  });

  it('minifies by default', () => {
    expect(resolveMinify({ format: 'esm' })).toEqual({
      minify: true,
      minifySyntax: true,
      minifyWhitespace: true,
      minifyIdentifiers: true,
    });
  });

  it('keeps a granular flag usable as an opt-out while minifying', () => {
    expect(resolveMinify({ minify: true, minifyIdentifiers: false, format: 'esm' })).toEqual({
      minify: true,
      minifySyntax: true,
      minifyWhitespace: true,
      minifyIdentifiers: false,
    });
  });

  it('never minifies cjs, whatever was asked for', () => {
    // The format exists for readability in a debugger and for tools that parse it.
    expect(resolveMinify({ minify: true, format: 'cjs' })).toEqual({
      minify: false,
      minifySyntax: false,
      minifyWhitespace: false,
      minifyIdentifiers: false,
    });
  });
});

describe('the two esbuild implementations agree', () => {
  it('both gate the granular flags on minify', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));

    for (const file of ['orchestrator.ts', 'esbuild/builder.ts']) {
      const src = readFileSync(join(here, file), 'utf-8');
      // Either spelling of the gate is fine; an ungated `minifySyntax,` is not.
      expect(src, `${file} must gate minifySyntax on minify`).toMatch(
        /minifySyntax:\s*minifying\s*&&/,
      );
      expect(src, `${file} must gate minifyWhitespace on minify`).toMatch(
        /minifyWhitespace:\s*minifying\s*&&/,
      );
      expect(src, `${file} must gate minifyIdentifiers on minify`).toMatch(
        /minifyIdentifiers:\s*minifying\s*&&/,
      );
    }
  });
});
