---
"@bambiste/mix-builder": minor
---

`build-config.json` now supports an optional `tsc` block to run the TypeScript compiler during the build, with configurable project, enabled, emitDeclarationOnly, failOnError, and args options, and the build sequence runs clean, then tsc, then the bundlers, while the explicit esbuild `platform` setting is no longer overwritten.
