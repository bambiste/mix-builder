---
"@bambiste/mix-builder": minor
---

The `cjsTypes` option now generates a `.d.cts` file alongside each `.d.ts` in the output. This helps CommonJS consumers avoid TS1479 errors by providing properly shaped type declarations. The option is new and disabled by default to prevent unintended changes to existing projects. It is not a copy: a declaration saying `from './x.js'` would still point at the ESM file, so relative specifiers are rewritten to the `.cjs` beside them and the source map link is removed. For it to mean anything, the package's exports map has to name the two formats separately.
