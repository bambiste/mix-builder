---
"@bambiste/mix-builder": patch
---

The esbuild build now runs without requiring TypeScript to be installed and works with any TypeScript version.

A fresh install previously failed before any build started, because the Rollup TypeScript plugin was loaded at import time. It is loaded only when `plugins.typescript.enabled` asks for it.
