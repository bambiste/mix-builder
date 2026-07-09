---
"@bambiste/mix-builder": patch
---

Add iife global-name support for CDN bundles. esbuild needs a `globalName` to expose
an iife build's exports on `window`; wire it through a per-entry `globalName` and a
`--globalName` arg, applied to the esbuild options when the format is `iife` (falling
back to a PascalCase name derived from the entry file). iife builds are now
self-contained (externals bundled in) and emit `.global.js`, so they drop straight
into a `<script>` tag.
