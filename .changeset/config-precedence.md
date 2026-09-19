---
"@bambiste/mix-builder": minor
---

`build-config.json` now overrides parser defaults, with precedence parser defaults → config file → command-line flags, and `clean` is read from inside the esbuild or rollup block (no default) while `outdir` falls back to `dist` there. If a config file sets one of these options, it will now be applied, so adjust any code that assumed the option would be ignored.
