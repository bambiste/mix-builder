---
"@bambiste/mix-builder": patch
---

Updates esbuild to ^0.28.1. The bundled `__commonJS` and `__esm` helpers now rethrow an initialization error on subsequent calls instead of returning a partially initialized module.
