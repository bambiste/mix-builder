import path from 'node:path';
import picomatch from 'picomatch';

/**
 * A comment prepended to built files, for copyright and authorship.
 *
 * esbuild has a `banner` option already, but it is a raw string applied to every file in
 * a build. Two things are missing for the usual case. The text almost always wants the
 * package name, version and year in it, and hand-editing those at each release is how
 * they go stale. And a package rarely wants the banner on everything: the entry a
 * consumer loads is worth marking, forty internal chunks are not.
 *
 * So this resolves the text per entry, substituting from package.json, and decides
 * whether that entry gets one at all.
 */
export interface BannerConfig {
  /** The comment to prepend to JavaScript output. Tokens are substituted. */
  js?: string;
  /** The comment to prepend to CSS output. Tokens are substituted. */
  css?: string;
  /**
   * Entries that get the banner, as globs against the source path relative to the
   * package. Everything gets it when omitted.
   */
  include?: string[];
  /** Entries that never get it, applied after `include`. */
  exclude?: string[];
}

/** A string is shorthand for `{ js: value }` applied to every entry. */
export type BannerOption = string | BannerConfig;

/** What a token substitution can read. Anything package.json carries, plus the year. */
export interface BannerFields {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  homepage?: string;
  author?: string | { name?: string; email?: string; url?: string };
  [field: string]: unknown;
}

function authorName(author: BannerFields['author']): string {
  if (!author) return '';
  if (typeof author === 'string') return author;
  return author.name ?? '';
}

/**
 * Replace `{token}` with the matching package.json field.
 *
 * An unknown token is left as written rather than blanked. A banner reading
 * `Copyright {yr}` is a typo worth seeing in the output; one reading `Copyright ` looks
 * deliberate and ships.
 */
export function substituteTokens(text: string, fields: BannerFields): string {
  const values: Record<string, string> = {
    year: String(new Date().getFullYear()),
    name: fields.name ?? '',
    version: fields.version ?? '',
    description: fields.description ?? '',
    license: fields.license ?? '',
    homepage: fields.homepage ?? '',
    author: authorName(fields.author),
  };
  return text.replace(/\{(\w+)\}/g, (whole, token: string) =>
    token in values ? values[token] : whole,
  );
}

/**
 * Whether `sourcePath` is one of the files the banner was asked for.
 *
 * Matched against the path relative to the package root, with forward slashes, so a
 * config written on one platform behaves the same on another.
 */
export function bannerApplies(
  sourcePath: string,
  config: BannerConfig,
  cwd: string = process.cwd(),
): boolean {
  const relative = path.relative(cwd, path.resolve(cwd, sourcePath)).split(path.sep).join('/');
  if (config.exclude?.length && picomatch.isMatch(relative, config.exclude)) return false;
  if (!config.include?.length) return true;
  return picomatch.isMatch(relative, config.include);
}

/**
 * The esbuild `banner` for one entry, or undefined when it gets none.
 *
 * Returning undefined rather than an empty object matters: esbuild treats a `banner` of
 * `{ js: '' }` as a banner and the comment marker still lands in the file.
 */
export function resolveBanner(
  banner: BannerOption | undefined,
  sourcePath: string,
  fields: BannerFields,
  cwd: string = process.cwd(),
): { js?: string; css?: string } | undefined {
  if (!banner) return undefined;
  const config: BannerConfig = typeof banner === 'string' ? { js: banner } : banner;
  if (!config.js && !config.css) return undefined;
  if (!bannerApplies(sourcePath, config, cwd)) return undefined;

  const out: { js?: string; css?: string } = {};
  if (config.js) out.js = substituteTokens(config.js, fields);
  if (config.css) out.css = substituteTokens(config.css, fields);
  return out;
}
