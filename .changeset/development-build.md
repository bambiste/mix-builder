---
"@bambiste/mix-builder": minor
---

`esbuild.development` now creates a second copy in `dist/dev` with `__DEV__` true and `NODE_ENV` set to development, while the regular build uses `__DEV__` false.
