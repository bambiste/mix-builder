---
"@bambiste/mix-builder": patch
---

esbuild now builds all ESM entries in a single run per group of equal options, emitting shared modules as a single chunk while keeping output paths unchanged and writing banners on each entry that requests one.
