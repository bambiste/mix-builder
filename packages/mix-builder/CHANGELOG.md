# @bambiste/mix-builder

## 0.4.1

### Patch Changes

- 154ce26: `@rollup/plugin-terser` now uses version ^1.0.0, pulling in `serialize-javascript` ^7 which removes the vulnerability.

## 0.4.0

### Minor Changes

- 325d092: `build-config.json` now overrides parser defaults, with precedence parser defaults → config file → command-line flags, and `clean` is read from inside the esbuild or rollup block (no default) while `outdir` falls back to `dist` there. If a config file sets one of these options, it will now be applied, so adjust any code that assumed the option would be ignored.
- f81c347: `build-config.json` now supports an optional `tsc` block to run the TypeScript compiler during the build, with configurable project, enabled, emitDeclarationOnly, failOnError, and args options, and the build sequence runs clean, then tsc, then the bundlers, while the explicit esbuild `platform` setting is no longer overwritten.

## 0.3.0

### Minor Changes

- 8c9dca8: Minification now follows the output format by default, and `define` lets a config set its own compile-time constants. If you relied on minified ESM or CJS output, set `minify: true` to retain minification.

## 0.2.1

### Patch Changes

- 548b113: The esbuild build now runs without requiring TypeScript to be installed and works with any TypeScript version.

  A fresh install previously failed before any build started, because the Rollup TypeScript plugin was loaded at import time. It is loaded only when `plugins.typescript.enabled` asks for it.

## 0.2.0

### Minor Changes

- fd9c653: The builder now supports a `banner` option that prepends a copyright and authorship comment to built files, substituting tokens like `{name}`, `{version}`, `{year}` from the package's package.json.

  `include` and `exclude` globs pick which entries get it, so the file a consumer loads can be marked while internal chunks stay bare.

- 2215cc4: The `cjsTypes` option now generates a `.d.cts` file alongside each `.d.ts` in the output. This helps CommonJS consumers avoid TS1479 errors by providing properly shaped type declarations. The option is new and disabled by default to prevent unintended changes to existing projects. It is not a copy: a declaration saying `from './x.js'` would still point at the ESM file, so relative specifiers are rewritten to the `.cjs` beside them and the source map link is removed. For it to mean anything, the package's exports map has to name the two formats separately.
- 63910d5: `minify: false` now turns minification off, so a package already setting it will produce unminified output where it did not before.

## 0.1.0

### Minor Changes

- 15667c2: First public npm release. Both packages now publish to the public npm registry (MIT
  licensed, README + LICENSE shipped, `src` excluded from the tarball). `mix-builder` also
  gains per-file raw + gzip size reporting and a cleaner, restructured build log.

### Patch Changes

- 1fe9d5c: Add iife global-name support for CDN bundles. esbuild needs a `globalName` to expose
  an iife build's exports on `window`; wire it through a per-entry `globalName` and a
  `--globalName` arg, applied to the esbuild options when the format is `iife` (falling
  back to a PascalCase name derived from the entry file). iife builds are now
  self-contained (externals bundled in) and emit `.global.js`, so they drop straight
  into a `<script>` tag.
- d41fb9f: Stop reinstalling `inquirer` on every build/publish. The `mix-builder` and
  `mix-publisher` CLIs checked for `./node_modules/inquirer` in the CONSUMER's cwd and ran
  `pnpm add -D inquirer` when it wasn't there, which (under pnpm's nested layout) was
  almost every run, reinstalling it and polluting the consumer's `package.json`. `inquirer`
  is already a declared dependency of `@bambiste/mix-builder`, so it resolves from the
  package's own install; the auto-install fallback is removed.

## 0.0.1-next.1

### Patch Changes

- Add iife global-name support for CDN bundles. esbuild needs a `globalName` to expose
  an iife build's exports on `window`; wire it through a per-entry `globalName` and a
  `--globalName` arg, applied to the esbuild options when the format is `iife` (falling
  back to a PascalCase name derived from the entry file). iife builds are now
  self-contained (externals bundled in) and emit `.global.js`, so they drop straight
  into a `<script>` tag.

## 0.0.1-next.0

### Patch Changes

- d41fb9f: Stop reinstalling `inquirer` on every build/publish. The `mix-builder` and
  `mix-publisher` CLIs checked for `./node_modules/inquirer` in the CONSUMER's cwd and ran
  `pnpm add -D inquirer` when it wasn't there, which (under pnpm's nested layout) was
  almost every run, reinstalling it and polluting the consumer's `package.json`. `inquirer`
  is already a declared dependency of `@bambiste/mix-builder`, so it resolves from the
  package's own install; the auto-install fallback is removed.
