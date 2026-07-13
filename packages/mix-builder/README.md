# @bambiste/mix-builder

A fast library bundler on top of **esbuild** and **Rollup**. Point it at your entries,
pick your formats, and it emits `esm` / `cjs` / `iife` bundles — with CDN globals and a
per-file **raw + gzip** size report.

## Install

```bash
pnpm add -D @bambiste/mix-builder
# npm i -D @bambiste/mix-builder · yarn add -D @bambiste/mix-builder
```

Ships as ESM/CJS with a `mix-builder` CLI (and a `mix-publisher` for releases).

## Usage

### CLI

```bash
# esbuild, esm + cjs, minified, clean output dir, emit .d.ts
npx mix-builder --builder=esbuild --formats=esm,cjs --minify --clean --dts
```

### Config file

Keep options in a JSON config and pass `--buildConfigFile`:

```jsonc
// build-config.json
{
  "builder": "esbuild",
  "outdir": "dist",
  "esbuild": {
    "entries": ["src/index.ts"],
    "formats": ["esm", "cjs"]
  }
}
```

```bash
npx mix-builder --buildConfigFile=build-config.json
```

An alternate config runs a separate pass — e.g. a CDN build that doesn't disturb the
default one:

```jsonc
// build-config.cdn.json — iife globals for unpkg/jsdelivr
{
  "builder": "esbuild",
  "outdir": "dist/cdn",
  "esbuild": {
    "entries": { "src/cdn/signal.ts": { "globalName": "Signal", "formats": ["iife"] } },
    "noExternal": true
  }
}
```

## Output

Every build prints an aligned table of the bundles it emitted, with raw and gzip sizes:

```
◆ mix-builder

  ✓ Built signal.ts [iife] in 43ms
  ✓ Built reactive.ts [iife] in 20ms
  ✓ esbuild · 2 entries · 2 ok · 63ms

  Output · dist
  ─────────────────────────────────────────────
  cdn/reactive.global.js   29.64 KB   8.68 KB gz
  cdn/signal.global.js      3.36 KB   1.29 KB gz
  ─────────────────────────────────────────────
  2 files                  33.00 KB   9.97 KB gz

✓ Built 2 entries in 73ms
```

Only the files written by the current run are listed (mtime-filtered), so incremental
builds don't re-report bundles from a previous pass.

## Highlights

- **esbuild or Rollup** (`--builder=esbuild|rollup|both`), or per-entry config.
- **Multi-format** output: `esm`, `cjs`, `iife`.
- **CDN globals** — per-entry `globalName` + `noExternal` produce self-contained
  `*.global.js` for `<script>` use on unpkg / jsdelivr.
- **Size reporting** — raw + gzip per file, with a total.
- **Typings** — `--dts` emits `.d.ts` alongside the bundles.
- **External handling** — auto-externalize deps, or `noExternal` to inline them.

## License

MIT © Bambiste
