# @bambiste/mix-builder

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
  `pnpm add -D inquirer` when it wasn't there — which (under pnpm's nested layout) was
  almost every run, reinstalling it and polluting the consumer's `package.json`. `inquirer`
  is already a declared dependency of `@bambiste/mix-builder`, so it resolves from the
  package's own install; the auto-install fallback is removed.
