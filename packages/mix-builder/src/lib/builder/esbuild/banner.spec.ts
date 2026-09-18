import { describe, expect, it } from 'vitest';
import { bannerApplies, resolveBanner, substituteTokens } from './banner.js';

const pkg = {
  name: '@acme/widget',
  version: '2.3.1',
  license: 'MIT',
  homepage: 'https://example.com',
  author: { name: 'A Person', email: 'a@example.com' },
};

describe('substituteTokens', () => {
  it('fills the package fields', () => {
    expect(substituteTokens('{name} v{version} {license}', pkg)).toBe(
      '@acme/widget v2.3.1 MIT',
    );
  });

  it('takes the name out of an author object', () => {
    expect(substituteTokens('by {author}', pkg)).toBe('by A Person');
  });

  it('takes an author string as written', () => {
    expect(substituteTokens('by {author}', { author: 'A Person <a@example.com>' })).toBe(
      'by A Person <a@example.com>',
    );
  });

  it('fills the current year', () => {
    expect(substituteTokens('{year}', pkg)).toBe(String(new Date().getFullYear()));
  });

  it('leaves an unknown token as written', () => {
    // A visible typo beats a silently empty line shipping in every file.
    expect(substituteTokens('(c) {yr} {name}', pkg)).toBe('(c) {yr} @acme/widget');
  });

  it('blanks a known token the package does not set', () => {
    expect(substituteTokens('[{license}]', { name: 'x' })).toBe('[]');
  });
});

describe('bannerApplies', () => {
  const cwd = '/repo/pkg';

  it('applies to everything when include is omitted', () => {
    expect(bannerApplies('src/internal/util.ts', {}, cwd)).toBe(true);
  });

  it('applies only to include when given', () => {
    const config = { include: ['src/index.ts', 'src/cdn/*.ts'] };
    expect(bannerApplies('src/index.ts', config, cwd)).toBe(true);
    expect(bannerApplies('src/cdn/widget.ts', config, cwd)).toBe(true);
    expect(bannerApplies('src/internal/util.ts', config, cwd)).toBe(false);
  });

  it('exclude wins over include', () => {
    const config = { include: ['src/**/*.ts'], exclude: ['src/**/*.spec.ts'] };
    expect(bannerApplies('src/a.ts', config, cwd)).toBe(true);
    expect(bannerApplies('src/a.spec.ts', config, cwd)).toBe(false);
  });

  it('matches an absolute source path against the package-relative glob', () => {
    // The builder hands over whatever path the entry carries, which is often absolute.
    expect(bannerApplies('/repo/pkg/src/index.ts', { include: ['src/index.ts'] }, cwd)).toBe(
      true,
    );
  });
});

describe('resolveBanner', () => {
  const cwd = '/repo/pkg';

  it('takes a string as the js banner for every entry', () => {
    expect(resolveBanner('/* {name} */', 'src/any.ts', pkg, cwd)).toEqual({
      js: '/* @acme/widget */',
    });
  });

  it('returns undefined with no banner configured', () => {
    expect(resolveBanner(undefined, 'src/index.ts', pkg, cwd)).toBeUndefined();
  });

  it('returns undefined for an entry outside include', () => {
    const banner = { js: '/* x */', include: ['src/index.ts'] };
    expect(resolveBanner(banner, 'src/other.ts', pkg, cwd)).toBeUndefined();
  });

  it('returns undefined for an empty banner, so no bare comment marker is emitted', () => {
    // esbuild treats `{ js: '' }` as a banner and still writes the marker.
    expect(resolveBanner({ js: '' }, 'src/index.ts', pkg, cwd)).toBeUndefined();
    expect(resolveBanner('', 'src/index.ts', pkg, cwd)).toBeUndefined();
  });

  it('carries a css banner independently of the js one', () => {
    const resolved = resolveBanner(
      { css: '/* {name} styles */' },
      'src/index.ts',
      pkg,
      cwd,
    );
    expect(resolved).toEqual({ css: '/* @acme/widget styles */' });
    expect(resolved).not.toHaveProperty('js');
  });

  it('substitutes into both', () => {
    expect(
      resolveBanner({ js: 'v{version}', css: 'v{version}' }, 'src/index.ts', pkg, cwd),
    ).toEqual({ js: 'v2.3.1', css: 'v2.3.1' });
  });
});
